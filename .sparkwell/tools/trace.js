import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { isDeepStrictEqual, parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'
import { parsePatch, structuredPatch } from 'diff'
import { KINDS, ToolError, parseYaml, selectorMatches } from './sparkwell.js'

const MAX_TEXT_BYTES = 1024 * 1024
const fingerprint = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')
const sorted = values => [...values].sort()

function git(root, argumentsList) {
  try {
    return execFileSync('git', ['-c', 'core.fsmonitor=false', ...argumentsList], {
      cwd: root,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_NO_REPLACE_OBJECTS: '1' },
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    throw new ToolError('trace-git', error.stderr?.toString('utf8').trim() || error.message)
  }
}

function commit(root, value) {
  if (typeof value !== 'string' || !value.trim()) throw new ToolError('trace-input', 'Expected a commit revision')
  return git(root, ['rev-parse', '--verify', '--end-of-options', `${value}^{commit}`]).toString('utf8').trim()
}

function repository(root) {
  const actual = fs.realpathSync(root)
  const top = git(actual, ['rev-parse', '--show-toplevel']).toString('utf8').trimEnd()
  if (fs.realpathSync(top) !== actual) throw new ToolError('trace-root', 'Use the Git repository root')
  return actual
}

function relativeName(value) {
  if (typeof value !== 'string' || !value || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)
    || value.includes('\0') || value.split('/').some(part => part === '..' || part === '.git')) {
    throw new ToolError('trace-path', 'Expected a repository-relative path outside .git', value)
  }
  return value.replace(/\/$/, '')
}

function textEntry(filename, mode, oid, size, buffer) {
  let content = null
  let limitation = null
  if (mode === '120000') limitation = 'symlink'
  else if (mode === '160000') limitation = 'submodule'
  else if (size > MAX_TEXT_BYTES) limitation = 'large-file'
  else {
    try {
      if (buffer.includes(0)) throw new Error('Binary data')
      content = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    } catch {
      limitation = 'binary-or-non-utf8'
    }
  }
  return { path: filename, mode, oid, size, content, limitation }
}

function committedSnapshot(root, revision) {
  const result = new Map()
  const entries = git(root, ['ls-tree', '-r', '-z', '--full-tree', revision]).toString('utf8').split('\0').filter(Boolean)
  for (const entry of entries) {
    const separator = entry.indexOf('\t')
    const [mode, , oid] = entry.slice(0, separator).split(' ')
    const filename = relativeName(entry.slice(separator + 1))
    if (mode === '160000') {
      result.set(filename, textEntry(filename, mode, oid, 0, null))
      continue
    }
    const size = Number(git(root, ['cat-file', '-s', oid]).toString('utf8').trim())
    const buffer = size <= MAX_TEXT_BYTES && mode !== '120000' ? git(root, ['cat-file', 'blob', oid]) : null
    result.set(filename, textEntry(filename, mode, oid, size, buffer))
  }
  return result
}

function workingSnapshot(root) {
  const names = new Map()
  const indexed = git(root, ['ls-files', '--stage', '-z']).toString('utf8').split('\0').filter(Boolean)
  for (const entry of indexed) {
    const separator = entry.indexOf('\t')
    const [mode, oid, stage] = entry.slice(0, separator).split(' ')
    if (stage !== '0') throw new ToolError('trace-conflicts', 'Resolve unmerged index entries before tracing')
    names.set(relativeName(entry.slice(separator + 1)), { mode, oid })
  }
  for (const filename of git(root, ['ls-files', '--others', '--exclude-standard', '-z']).toString('utf8').split('\0').filter(Boolean)) {
    names.set(relativeName(filename), { mode: '100644' })
  }
  const objectFormat = git(root, ['rev-parse', '--show-object-format']).toString('utf8').trim()
  const result = new Map()
  for (const [filename, indexedEntry] of names) {
    const absolute = path.join(root, filename)
    let state
    try { state = fs.lstatSync(absolute) } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') continue
      throw error
    }
    const parent = fs.realpathSync(path.dirname(absolute))
    if ((parent !== root && !parent.startsWith(root + path.sep)) || parent === path.join(root, '.git') || parent.startsWith(path.join(root, '.git') + path.sep)) {
      throw new ToolError('trace-path', 'A file parent resolves outside the repository', filename)
    }
    if (indexedEntry.mode === '160000' && state.isDirectory()) {
      const oid = git(absolute, ['rev-parse', '--verify', 'HEAD']).toString('utf8').trim()
      const entry = textEntry(filename, '160000', oid, 0, null)
      if (git(absolute, ['status', '--porcelain', '--untracked-files=normal']).length > 0) entry.dirty = true
      result.set(filename, entry)
      continue
    }
    if (!state.isFile() && !state.isSymbolicLink()) continue
    const mode = state.isSymbolicLink() ? '120000' : state.mode & 0o111 ? '100755' : '100644'
    const buffer = state.isSymbolicLink() ? Buffer.from(fs.readlinkSync(absolute)) : state.size <= MAX_TEXT_BYTES ? fs.readFileSync(absolute) : null
    let oid
    if (buffer) {
      oid = createHash(objectFormat).update(`blob ${buffer.length}\0`).update(buffer).digest('hex')
    } else {
      oid = git(root, ['hash-object', '--no-filters', '--', filename]).toString('utf8').trim()
    }
    result.set(filename, textEntry(filename, mode, oid, buffer?.length ?? state.size, buffer))
  }
  return result
}

function descriptor(entry) {
  if (!entry) return null
  const { content, ...fields } = entry
  return { ...fields, lines: content === null || content === '' ? 0 : content.split('\n').length - (content.endsWith('\n') ? 1 : 0) }
}

function role(filename) {
  if (/^artifacts\/(sparks|constraints|aspects|collaborations)\/.+\.md$/.test(filename)) return 'design'
  return filename === 'artifacts/index.md' ? 'index' : 'code'
}

function artifact(entry, side, diagnostics) {
  if (!entry || role(entry.path) !== 'design') return null
  const key = `artifact-${fingerprint([side, entry.path, entry.oid]).slice(0, 20)}`
  try {
    const match = entry.content?.match(/^---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m)
    if (!match || match.index !== 0) throw new Error('Missing readable YAML frontmatter')
    const metadata = parseYaml(match[1], entry.path)
    if (!metadata || typeof metadata.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.id)
      || !Object.hasOwn(KINDS, metadata.kind) || !entry.path.startsWith(`artifacts/${KINDS[metadata.kind]}/`)) {
      throw new Error('Invalid Artifact identity or kind directory')
    }
    return { key, side, file: descriptor(entry), metadata, content: entry.content }
  } catch (error) {
    diagnostics.push({ code: 'artifact-context-unavailable', path: entry.path, side, message: error.message })
    return null
  }
}

function renamePairs(root, base, head) {
  const tokens = git(root, ['diff', '--name-status', '-z', '--no-ext-diff', '--no-textconv', '--find-renames=50%', base, ...(head ? [head] : []), '--'])
    .toString('utf8').split('\0').filter(Boolean)
  const pairs = []
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index++]
    const oldPath = tokens[index++]
    if (status.startsWith('R') || status.startsWith('C')) {
      const newPath = tokens[index++]
      if (status.startsWith('R')) pairs.push([oldPath, newPath])
    }
  }
  return pairs
}

function addRange(ranges, line) {
  const previous = ranges.at(-1)
  if (previous && previous.start + previous.count === line) previous.count += 1
  else ranges.push({ start: line, count: 1 })
}

function changesFor(file, oldEntry, newEntry) {
  let limitation = oldEntry?.limitation || newEntry?.limitation || null
  if (!limitation && Math.max(file.old?.lines ?? 0, file.new?.lines ?? 0) > 20000) limitation = 'line-limit'
  const patch = limitation ? null : structuredPatch(oldEntry?.path ?? '/dev/null', newEntry?.path ?? '/dev/null',
    oldEntry?.content ?? '', newEntry?.content ?? '', '', '', { context: 3, maxEditLength: 2000 })
  if (patch === undefined) limitation = 'diff-limit'
  const type = limitation ? 'non-text' : 'text'
  const hunks = patch?.hunks ?? []
  if (!hunks.length) return [{
    id: `change-${fingerprint([file.id, type]).slice(0, 20)}`, file: file.id,
    type: type === 'text' ? 'file' : type, limitation, old: { start: 0, count: 0, changed: [] }, new: { start: 0, count: 0, changed: [] }, patch: null,
  }]
  return hunks.map(hunk => {
    const oldSide = { start: hunk.oldStart, count: hunk.oldLines, changed: [] }
    const newSide = { start: hunk.newStart, count: hunk.newLines, changed: [] }
    let oldLine = hunk.oldStart
    let newLine = hunk.newStart
    for (const line of hunk.lines) {
      if (line.startsWith('-')) addRange(oldSide.changed, oldLine++)
      else if (line.startsWith('+')) addRange(newSide.changed, newLine++)
      else if (line.startsWith(' ')) { oldLine += 1; newLine += 1 }
    }
    const patch = `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n${hunk.lines.join('\n')}\n`
    return { id: `change-${fingerprint([file.id, patch]).slice(0, 20)}`, file: file.id, type, old: oldSide, new: newSide, patch }
  })
}

function scopeMatches(filename, paths) {
  return !paths.length || paths.some(prefix => filename === prefix || filename.startsWith(prefix + '/'))
}

function candidateContext(files, artifacts, support, diagnostics) {
  const parsed = support.flatMap(entry => {
    try {
      const value = parseYaml(entry.content ?? '', entry.file.path)
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a YAML mapping')
      return [{ ...entry, value }]
    } catch (error) {
      diagnostics.push({ code: 'invalid-support-context', path: entry.file.path, side: entry.side, message: error.message })
      return []
    }
  })
  for (const file of files.filter(entry => entry.role === 'code')) {
    const candidates = []
    for (const side of ['old', 'new']) {
      const snapshotFile = file[side]
      if (!snapshotFile) continue
      const sources = parsed.filter(entry => entry.side === side)
      const available = artifacts.filter(entry => entry.side === side)
      for (const source of sources) {
        if (source.file.path.startsWith('.sparkwell/implementation-maps/')) {
          for (const entry of Array.isArray(source.value.artifacts) ? source.value.artifacts : []) {
            if (entry?.path !== snapshotFile.path || !Array.isArray(entry['derived-from'])) continue
            for (const id of entry['derived-from']) {
              const matches = available.filter(candidate => candidate.metadata.id === id)
              if (!matches.length) diagnostics.push({ code: 'stale-map-source', path: source.file.path, side, artifact: id, message: 'The map source is absent from this snapshot.' })
              for (const match of matches) candidates.push({ artifact: match.key, via: 'implementation-map', source: source.file.path, implementation: source.value['implementation-id'] ?? null })
            }
          }
        } else {
          const config = source.value
          for (const binding of Array.isArray(config.bindings) ? config.bindings : []) {
            const entry = config.implementations?.[binding?.implementation]
            if (typeof entry?.['source-root'] !== 'string' || !Array.isArray(binding.match)) continue
            const prefix = entry['source-root'].replace(/\/$/, '').replace(/^\.\//, '')
            if (prefix !== '.' && snapshotFile.path !== prefix && !snapshotFile.path.startsWith(prefix + '/')) continue
            try {
              const matches = available.filter(candidate => candidate.metadata.kind === 'spark' && binding.match.some(selector =>
                selector && typeof selector === 'object' && Object.keys(selector).length > 0 && Object.values(selector).every(value => typeof value === 'string')
                && selectorMatches(selector, candidate.metadata)))
              for (const match of matches) candidates.push({ artifact: match.key, via: 'binding', source: source.file.path, implementation: binding.implementation })
            } catch (error) {
              diagnostics.push({ code: 'invalid-support-context', path: source.file.path, side, message: error.message })
            }
          }
        }
      }
    }
    file.candidates = [...new Map(candidates.map(entry => [JSON.stringify(entry), entry])).values()]
  }
}

function extractFromSnapshots(root, comparison, before, after) {
  const diagnostics = []
  const artifacts = []
  const support = []
  for (const [side, snapshot] of [['old', before], ['new', after]]) {
    for (const filename of sorted(snapshot.keys())) {
      const entry = snapshot.get(filename)
      const record = artifact(entry, side, diagnostics)
      if (record) artifacts.push(record)
      if (filename === '.sparkwell/config.yaml' || /^\.sparkwell\/implementation-maps\/.+\.yaml$/.test(filename)) {
        support.push({ side, file: descriptor(entry), content: entry.content })
      }
    }
  }
  const pairs = new Map()
  const consumed = new Set()
  for (const [oldPath, newPath] of renamePairs(root, comparison.base, comparison.head)) {
    if (before.has(oldPath) && after.has(newPath) && !after.has(oldPath)) {
      pairs.set(oldPath, [oldPath, newPath])
      consumed.add(newPath)
    }
  }
  for (const [oldPath, oldEntry] of before) {
    if (after.has(oldPath) || pairs.has(oldPath)) continue
    const matches = [...after].filter(([newPath, entry]) => !before.has(newPath) && !consumed.has(newPath) && entry.oid === oldEntry.oid && entry.mode === oldEntry.mode)
    if (matches.length === 1) {
      const newPath = matches[0][0]
      pairs.set(oldPath, [oldPath, newPath])
      consumed.add(newPath)
    }
  }
  for (const filename of sorted(new Set([...before.keys(), ...after.keys()]))) {
    if (!pairs.has(filename) && !consumed.has(filename)) pairs.set(filename, [before.has(filename) ? filename : null, after.has(filename) ? filename : null])
  }
  const files = []
  const codeChanges = []
  const designChanges = []
  for (const [oldPath, newPath] of pairs.values()) {
    if (![oldPath, newPath].some(filename => filename && scopeMatches(filename, comparison.paths))) continue
    if ([oldPath, newPath].some(filename => comparison.excluded.includes(filename))) continue
    const oldEntry = before.get(oldPath)
    const newEntry = after.get(newPath)
    if (JSON.stringify(descriptor(oldEntry)) === JSON.stringify(descriptor(newEntry))) continue
    const fileRole = [oldPath, newPath].some(filename => filename && role(filename) === 'design') ? 'design'
      : [oldPath, newPath].some(filename => filename && role(filename) === 'index') ? 'index' : 'code'
    const old = descriptor(oldEntry)
    const next = descriptor(newEntry)
    const file = { id: `file-${fingerprint([old, next]).slice(0, 20)}`, role: fileRole,
      status: !old ? 'added' : !next ? 'deleted' : oldPath !== newPath ? 'renamed' : old.mode !== next.mode ? 'type-or-mode' : 'modified', old, new: next }
    files.push(file)
    if (fileRole === 'index') {
      diagnostics.push({ code: 'derived-index', file: file.id, message: 'Artifact index changes are recorded as derived navigation, not independent design evidence.' })
      continue
    }
    const changes = changesFor(file, oldEntry, newEntry)
    if (fileRole === 'design') designChanges.push(...changes)
    else codeChanges.push(...changes)
  }
  files.sort((left, right) => (left.new?.path ?? left.old.path).localeCompare(right.new?.path ?? right.old.path, 'en'))
  candidateContext(files, artifacts, support, diagnostics)
  const notes = []
  const tip = comparison.head ?? comparison['head-at-capture']
  for (const revision of git(root, ['rev-list', '--reverse', `${comparison.base}..${tip}`]).toString('utf8').trim().split('\n').filter(Boolean)) {
    notes.push({ id: `commit-${revision}`, kind: 'commit-message', source: revision,
      text: git(root, ['show', '-s', '--format=%B', revision]).toString('utf8').trimEnd() })
  }
  if (codeChanges.length && !designChanges.length) diagnostics.push({ code: 'no-design-diff', message: 'This range has code changes but no Artifact diff. Use unchanged design context or explicitly choose a broader base; do not invent design changes.' })
  const context = { artifacts, support }
  const digest = fingerprint({ comparison, files, codeChanges, designChanges, context, notes })
  return {
    'schema-version': 1, comparison: { ...comparison, fingerprint: digest }, files,
    'code-changes': codeChanges, 'design-changes': designChanges, context, notes, diagnostics,
    links: [],
    unmapped: {
      code: codeChanges.map(change => ({ code: { change: change.id }, classification: 'not-analyzed', reason: 'Awaiting semantic analysis.' })),
      design: designChanges.map(change => ({ design: { change: change.id }, classification: 'not-analyzed', reason: 'No code association has been recorded.' })),
    },
  }
}

export function extractTrace(requestedRoot, { base, head, worktree = false, mergeBase = false, paths = [], excluded = [], comments = [] } = {}) {
  const root = repository(requestedRoot)
  if (Boolean(head) === worktree || (!worktree && !base)) throw new ToolError('trace-input', 'Select --base and --head, or --worktree with an optional --base')
  const requestedBase = commit(root, base ?? 'HEAD')
  const headAtCapture = commit(root, 'HEAD')
  const target = worktree ? null : commit(root, head)
  const bases = mergeBase ? git(root, ['merge-base', '--all', requestedBase, target ?? headAtCapture]).toString('utf8').trim().split('\n') : [requestedBase]
  if (bases.length !== 1) throw new ToolError('trace-base', 'Multiple merge bases exist; select an explicit base revision')
  const effectiveBase = bases[0]
  const comparison = {
    mode: worktree ? 'worktree' : 'commits', base: effectiveBase, head: target,
    'requested-base': requestedBase, 'merge-base': mergeBase, 'head-at-capture': worktree ? headAtCapture : null,
    paths: sorted(new Set(paths.map(relativeName))), excluded: sorted(new Set(excluded.map(relativeName))),
    'diff-format': 'raw-utf8-context-3',
  }
  const before = committedSnapshot(root, effectiveBase)
  const after = worktree ? workingSnapshot(root) : committedSnapshot(root, target)
  const result = extractFromSnapshots(root, comparison, before, after)
  if (worktree) {
    const again = workingSnapshot(root)
    const identity = snapshot => sorted(snapshot.keys()).filter(filename => !comparison.excluded.includes(filename))
      .map(filename => descriptor(snapshot.get(filename)))
    if (headAtCapture !== commit(root, 'HEAD') || fingerprint(identity(after)) !== fingerprint(identity(again))) {
      throw new ToolError('trace-worktree-changed', 'Working files changed during extraction; retry against a stable snapshot')
    }
  }
  for (const note of array(comments, 'comments')) {
    fields(note, ['source', 'text'], [], 'comment')
    nonempty(note.source, 'comment.source')
    nonempty(note.text, 'comment.text')
    const id = `comment-${fingerprint([note.source, note.text]).slice(0, 20)}`
    if (!result.notes.some(entry => entry.id === id)) result.notes.push({ id, kind: 'comment', ...note })
  }
  if (comments.length) result.comparison.fingerprint = fingerprint([result.comparison.fingerprint, result.notes.filter(note => note.kind === 'comment')])
  return result
}

function invalid(message, location) {
  throw new ToolError('invalid-change-map', message, location)
}

function fields(value, required, optional, location) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Expected an object', location)
  if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => ![...required, ...optional].includes(key))) {
    invalid('Missing or unknown fields', location)
  }
}

function nonempty(value, location) {
  if (typeof value !== 'string' || !value.trim()) invalid('Expected a non-empty string', location)
}

function array(value, location, minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum) invalid(`Expected an array with at least ${minimum} entries`, location)
  return value
}

function range(value, maximum, location) {
  if (!Number.isSafeInteger(value.start) || !Number.isSafeInteger(value.count) || value.start < 1 || value.count < 1
    || value.start + value.count - 1 > maximum) invalid('Range is outside the recorded lines', location)
  return Array.from({ length: value.count }, (_, index) => value.start + index)
}

function changedTokens(change) {
  const result = []
  for (const side of ['old', 'new']) {
    for (const segment of change[side].changed) {
      for (let line = segment.start; line < segment.start + segment.count; line += 1) result.push(`${change.id}:${side}:${line}`)
    }
  }
  return result.length ? result : [`${change.id}:file`]
}

function changeAnchor(anchor, changes, location) {
  fields(anchor, ['change'], ['side', 'start', 'count'], location)
  const change = changes.find(entry => entry.id === anchor.change)
  if (!change) invalid('Unknown change reference', location)
  const all = changedTokens(change)
  if (Object.keys(anchor).length === 1) return all
  if (!['old', 'new'].includes(anchor.side) || change.type !== 'text') invalid('A line anchor needs a text change and an old/new side', location)
  const limits = change[anchor.side]
  const lines = range(anchor, limits.start + limits.count - 1, location)
  const selected = lines.map(line => `${change.id}:${anchor.side}:${line}`)
  if (selected.some(token => !all.includes(token))) invalid('A change anchor must select changed lines, not context lines', location)
  return selected
}

function designAnchor(anchor, trace, location) {
  if (Object.hasOwn(anchor, 'change')) return changeAnchor(anchor, trace['design-changes'], location)
  fields(anchor, ['artifact', 'start', 'count'], [], location)
  const artifact = trace.context.artifacts.find(entry => entry.key === anchor.artifact)
  if (!artifact) invalid('Unknown Artifact context reference', location)
  const lines = range(anchor, artifact.file.lines, location)
  const opposite = trace.context.artifacts.filter(entry => entry.side !== artifact.side)
  const counterpart = opposite.find(entry => entry.file.path === artifact.file.path)
    ?? opposite.find(entry => entry.metadata.id === artifact.metadata.id)
  const old = artifact.side === 'old' ? artifact : counterpart
  const next = artifact.side === 'new' ? artifact : counterpart
  const differences = changesFor({ id: artifact.key, old: old?.file, new: next?.file },
    old ? { ...old.file, content: old.content } : null, next ? { ...next.file, content: next.content } : null)
  if (differences.some(change => change.type === 'non-text')) invalid('Cannot establish an unchanged clause across a limited diff', location)
  if (differences.some(change => change[artifact.side].changed.some(segment => lines.some(line => line >= segment.start && line < segment.start + segment.count)))) {
    invalid('Changed design lines must reference their diff block, not unchanged context; include the Artifact path if it was excluded', location)
  }
  return []
}

export function checkTrace(root, trace, { complete = false } = {}) {
  const immutable = ['schema-version', 'comparison', 'files', 'code-changes', 'design-changes', 'context', 'notes', 'diagnostics']
  fields(trace, [...immutable, 'links', 'unmapped'], [], 'change-map')
  fields(trace.comparison, ['mode', 'base', 'head', 'requested-base', 'merge-base', 'head-at-capture', 'paths', 'excluded', 'diff-format', 'fingerprint'], [], 'comparison')
  if (trace['schema-version'] !== 1 || !['commits', 'worktree'].includes(trace.comparison.mode)
    || typeof trace.comparison['merge-base'] !== 'boolean') invalid('Unsupported schema or comparison mode', 'comparison')
  array(trace.comparison.paths, 'comparison.paths')
  array(trace.comparison.excluded, 'comparison.excluded')
  array(trace.notes, 'notes')
  for (const [index, note] of trace.notes.entries()) {
    const location = `notes[${index}]`
    fields(note, ['id', 'kind', 'source', 'text'], [], location)
    nonempty(note.id, location)
    nonempty(note.source, location)
    if (!['commit-message', 'comment'].includes(note.kind) || typeof note.text !== 'string') invalid('Invalid note kind or text', location)
  }
  const comments = trace.notes.filter(note => note.kind === 'comment').map(note => ({ source: note.source, text: note.text }))
  const expected = extractTrace(root, {
    base: trace.comparison['requested-base'], head: trace.comparison.head,
    worktree: trace.comparison.mode === 'worktree', mergeBase: trace.comparison['merge-base'],
    paths: trace.comparison.paths, excluded: trace.comparison.excluded, comments,
  })
  for (const key of immutable) {
    if (!isDeepStrictEqual(trace[key], expected[key])) {
      throw new ToolError('trace-snapshot-mismatch', 'Captured facts differ from the requested versions or working snapshot; extract again without rewriting facts', key)
    }
  }
  array(trace.links, 'links')
  fields(trace.unmapped, ['code', 'design'], [], 'unmapped')
  array(trace.unmapped.code, 'unmapped.code')
  array(trace.unmapped.design, 'unmapped.design')
  const linkedCode = new Set()
  const linkedDesign = new Set()
  const linkIds = new Set()
  const noteIds = new Set(trace.notes.map(note => note.id))
  for (const [index, link] of trace.links.entries()) {
    const location = `links[${index}]`
    fields(link, ['id', 'code', 'design', 'relation', 'explanation', 'confidence'], ['notes'], location)
    nonempty(link.id, location)
    if (linkIds.has(link.id)) invalid('Duplicate link ID', location)
    linkIds.add(link.id)
    if (!['implements', 'supports', 'verifies'].includes(link.relation)) invalid('Unknown link relation', location)
    if (!['high', 'medium', 'low'].includes(link.confidence)) invalid('Use a qualitative confidence', location)
    nonempty(link.explanation, location)
    for (const anchor of array(link.code, `${location}.code`, 1)) {
      for (const token of changeAnchor(anchor, trace['code-changes'], location)) linkedCode.add(token)
    }
    for (const anchor of array(link.design, `${location}.design`, 1)) {
      for (const token of designAnchor(anchor, trace, location)) linkedDesign.add(token)
    }
    for (const note of array(link.notes ?? [], `${location}.notes`)) {
      if (!noteIds.has(note)) invalid('Unknown note reference', location)
    }
  }
  let pending = 0
  for (const [side, changes, linked] of [['code', trace['code-changes'], linkedCode], ['design', trace['design-changes'], linkedDesign]]) {
    const unlinked = new Set()
    for (const [index, entry] of trace.unmapped[side].entries()) {
      const location = `unmapped.${side}[${index}]`
      fields(entry, [side, 'classification', 'reason'], ['notes'], location)
      const allowed = side === 'code' ? ['implementation-only', 'unexplained', 'not-analyzed', 'unsupported'] : ['no-code-needed', 'unexplained', 'not-analyzed', 'unsupported']
      if (!allowed.includes(entry.classification)) invalid('Unknown unmapped classification', location)
      if (entry.classification === 'unsupported' && changes.find(change => change.id === entry[side]?.change)?.type !== 'non-text') {
        invalid('Only explicitly limited, non-text changes can be classified as unsupported', location)
      }
      nonempty(entry.reason, location)
      if (entry.classification === 'not-analyzed') pending += 1
      for (const note of array(entry.notes ?? [], `${location}.notes`)) {
        if (!noteIds.has(note)) invalid('Unknown note reference', location)
      }
      for (const token of changeAnchor(entry[side], changes, location)) {
        if (linked.has(token) || unlinked.has(token)) invalid('A range cannot be both linked and unmapped, or repeated as unmapped', location)
        unlinked.add(token)
      }
    }
    const missing = changes.flatMap(changedTokens).filter(token => !linked.has(token) && !unlinked.has(token))
    if (missing.length) invalid(`Unaccounted ${side} changes: ${missing.slice(0, 3).join(', ')}`, `unmapped.${side}`)
  }
  if (complete && pending) throw new ToolError('trace-incomplete', `${pending} entries still await semantic analysis`)
  return { 'code-change-count': trace['code-changes'].length, 'design-change-count': trace['design-changes'].length,
    'link-count': trace.links.length, 'unmapped-code-count': trace.unmapped.code.length, 'unmapped-design-count': trace.unmapped.design.length,
    'not-analyzed-count': pending, fingerprint: trace.comparison.fingerprint }
}

export function lookupTrace(trace, selection) {
  fields(selection, ['path', 'side'], ['start', 'count', 'base', 'head'], 'selection')
  nonempty(selection.path, 'selection.path')
  if (!['old', 'new'].includes(selection.side)) invalid('Use an old/new side', 'selection.side')
  const hasRange = Object.hasOwn(selection, 'start') || Object.hasOwn(selection, 'count')
  if (hasRange && (!Number.isSafeInteger(selection.start) || !Number.isSafeInteger(selection.count)
    || selection.start < 1 || selection.count < 1 || selection.count - 1 > Number.MAX_SAFE_INTEGER - selection.start)) {
    invalid('Provide positive integer start and count in source-file coordinates', 'selection')
  }
  if (trace?.['schema-version'] !== 1) invalid('Unsupported schema version', 'schema-version')
  fields(trace.comparison, ['mode', 'base', 'head', 'requested-base', 'merge-base', 'head-at-capture', 'paths', 'excluded', 'diff-format', 'fingerprint'], [], 'comparison')
  const checkComparison = Object.hasOwn(selection, 'base') || Object.hasOwn(selection, 'head')
  if (checkComparison) {
    nonempty(selection.base, 'selection.base')
    nonempty(selection.head, 'selection.head')
    if (trace.comparison.mode !== 'commits' || selection.base !== trace.comparison.base || selection.head !== trace.comparison.head) {
      throw new ToolError('trace-comparison-mismatch', 'Selection base/head must match the report commit snapshots; captured HEAD is not a worktree snapshot', 'selection')
    }
  }
  const files = new Map(array(trace.files, 'files').map(file => [file.id, file]))
  const changes = array(trace['code-changes'], 'code-changes')
  const selected = new Set()
  for (const change of changes) {
    const file = files.get(change.file)
    if (!file) invalid('Unknown file reference', change.id)
    if (file[selection.side]?.path !== selection.path) continue
    if (change.type !== 'text') {
      if (!hasRange) selected.add(`${change.id}:file`)
      continue
    }
    for (const segment of change[selection.side].changed) {
      const start = hasRange ? Math.max(segment.start, selection.start) : segment.start
      const end = hasRange ? Math.min(segment.start + segment.count, selection.start + selection.count) : segment.start + segment.count
      for (let line = start; line < end; line += 1) selected.add(`${change.id}:${selection.side}:${line}`)
    }
  }
  const matches = (anchor, location) => changeAnchor(anchor, changes, location).some(token => selected.has(token))
  const links = array(trace.links, 'links').flatMap((link, index) => {
    const location = `links[${index}]`
    const matched = array(link.code, `${location}.code`, 1).filter(anchor => matches(anchor, location))
    if (!matched.length) return []
    nonempty(link.explanation, `${location}.explanation`)
    return [{ ...link, 'matched-code': matched }]
  })
  const unmapped = array(trace.unmapped?.code, 'unmapped.code').filter((entry, index) => {
    const location = `unmapped.code[${index}]`
    nonempty(entry.reason, `${location}.reason`)
    return matches(entry.code, location)
  })
  return { comparison: trace.comparison, 'comparison-check': checkComparison ? 'matched' : 'not-requested', selection, links, unmapped }
}

function formatLookup(trace, result) {
  const files = new Map(trace.files.map(file => [file.id, file]))
  const lineRange = anchor => `${anchor.side} lines ${anchor.start}-${anchor.start + (anchor.count - 1)}`
  const diffBlocks = (anchors, changes, label, beforeAfter = false) => {
    const groups = new Map()
    for (const anchor of anchors) {
      changeAnchor(anchor, changes, label)
      if (!groups.has(anchor.change)) groups.set(anchor.change, [])
      groups.get(anchor.change).push(anchor)
    }
    return [...groups].map(([changeId, references]) => {
      const change = changes.find(entry => entry.id === changeId)
      const file = files.get(change.file)
      if (!file) invalid('Unknown file reference', label)
      const filename = file.old && file.new && file.old.path !== file.new.path
        ? `${file.old.path} -> ${file.new.path}` : (file.new ?? file.old).path
      const ranges = references.some(anchor => !Object.hasOwn(anchor, 'side')) ? 'whole change'
        : [...new Set(references.map(lineRange))].join(', ')
      const heading = `${label}: ${filename}\nReferences: ${ranges}`
      if (beforeAfter && change.type === 'text') {
        const patches = parsePatch(change.patch)
        if (patches.length !== 1 || patches[0].hunks.length !== 1) invalid('Expected one recorded design hunk', label)
        const hunk = patches[0].hunks[0]
        const content = prefix => {
          const lines = hunk.lines.filter(line => line.startsWith(' ') || line.startsWith(prefix))
          return lines.length ? lines.map(line => line.slice(1)).join('\n') : '(empty)'
        }
        const hunkRanges = ['old', 'new'].map(side => change[side].count
          ? lineRange({ ...change[side], side }) : `${side}: empty`).join(', ')
        return `${heading}\nHunk: ${hunkRanges}\n-- before --\n${content('-')}\n\n-- after --\n${content('+')}`
      }
      const patch = change.type === 'text' ? change.patch.replace(/\n$/, '')
        : `No text diff (${file.status}${change.limitation ? `; ${change.limitation}` : ''}).`
      return `${heading}\n--- ${file.old ? `a/${file.old.path}` : '/dev/null'}\n+++ ${file.new ? `b/${file.new.path}` : '/dev/null'}\n${patch}`
    })
  }
  const selection = result.selection
  const scope = Object.hasOwn(selection, 'start') ? lineRange(selection) : `${selection.side} file`
  const sections = [`Selection: ${selection.path} (${scope})`, result['comparison-check'] === 'matched'
    ? 'Comparison: commit snapshots matched.' : 'Comparison: not checked; using saved report coordinates.']
  for (const [index, link] of result.links.entries()) {
    const location = `links[${index}].design`
    const design = array(link.design, location, 1)
    for (const anchor of design) designAnchor(anchor, trace, location)
    sections.push(`Association ${index + 1}: ${link.relation} (confidence: ${link.confidence})`,
      ...diffBlocks(link.code, trace['code-changes'], 'Code diff'),
      ...diffBlocks(design.filter(anchor => Object.hasOwn(anchor, 'change')), trace['design-changes'], 'Design change', true))
    for (const anchor of design.filter(anchor => Object.hasOwn(anchor, 'artifact'))) {
      const artifact = trace.context.artifacts.find(entry => entry.key === anchor.artifact)
      const content = artifact.content.split('\n').slice(anchor.start - 1, anchor.start - 1 + anchor.count).join('\n')
      sections.push(`Design context (unchanged): ${artifact.file.path}\nReferences: ${lineRange({ ...anchor, side: artifact.side })}\n${content}`)
    }
    sections.push(`Explanation:\n${link.explanation}`)
  }
  for (const entry of result.unmapped) {
    sections.push(`Unmapped: ${entry.classification}`,
      ...diffBlocks([entry.code], trace['code-changes'], 'Code diff'), `Reason:\n${entry.reason}`)
  }
  if (!result.links.length && !result.unmapped.length) sections.push('No matching changes.')
  return sections.join('\n\n') + '\n'
}

function readJSON(filename, input) {
  const text = filename === '-' ? input() : fs.readFileSync(filename, 'utf8')
  try {
    const value = JSON.parse(text)
    parseYaml(text, filename)
    return value
  } catch (error) {
    throw new ToolError('trace-json', error.message, filename)
  }
}

function outputLocation(root, value) {
  const filename = path.resolve(root, value)
  if (path.extname(filename) !== '.json') throw new ToolError('trace-output', 'Use a new .json output file')
  const relative = path.relative(root, filename)
  if (relative.split(path.sep).includes('.git')) throw new ToolError('trace-output', 'Do not write inside .git')
  let ancestor = path.dirname(filename)
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor)
  const real = fs.realpathSync(ancestor)
  if (real.split(path.sep).includes('.git')) throw new ToolError('trace-output', 'Output directory resolves into .git')
  if (fs.existsSync(filename) || (() => { try { return fs.lstatSync(filename).isSymbolicLink() } catch { return false } })()) {
    throw new ToolError('trace-output-exists', 'Output already exists; use a new path instead of replacing it', filename)
  }
  if (filename.startsWith(root + path.sep) && real !== ancestor) throw new ToolError('trace-output', 'Repository output parent must not pass through a symlink', filename)
  return filename
}

export function traceMain(argv = process.argv.slice(2), { output = text => process.stdout.write(text), input = () => fs.readFileSync(0, 'utf8') } = {}) {
  try {
    if (Number(process.versions.node.split('.')[0]) < 24) throw new ToolError('unsupported-node', 'Node.js 24 or later is required')
    const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: {
      root: { type: 'string', default: '.' }, help: { type: 'boolean', short: 'h' },
      base: { type: 'string' }, head: { type: 'string' }, worktree: { type: 'boolean' },
      'merge-base': { type: 'boolean' }, path: { type: 'string', multiple: true },
      output: { type: 'string' }, notes: { type: 'string' }, input: { type: 'string' }, complete: { type: 'boolean' },
      selection: { type: 'string' }, format: { type: 'string' },
    } })
    if (values.help) {
      output(`Usage: node trace.js [--root PROJECT] extract|check|lookup [options]\n\nextract --base REV --head REV | --worktree [--base REV]\n  --merge-base       Explicitly compare from the merge base\n  --path PATH        Restrict changed files to a path or directory (repeatable)\n  --notes PATH       Optional JSON array of {source, text} comments\n  --output PATH      Write a new JSON file; omitted means stdout\n\ncheck --input PATH|- [--complete]\n  --complete         Reject entries still marked not-analyzed\n\nlookup --input TRACE_JSON|- --selection SELECTION_JSON|- [--format text|json]\n  selection         {path, side, start?, count?, base?, head?}\n                    Source-file coordinates; omit start/count for file-level lookup\n                    Use stdin for at most one input; no Git repository is required\n  --format text     Show code diffs, before/after design text, and explanations without internal IDs (default)\n  --format json     Return machine-readable links with their original references\n\nExtraction does not infer links. Check verifies snapshots and ranges, not causal truth.\nLookup reads saved explanations without revalidating the working snapshot.\n`)
      return 0
    }
    const command = positionals.join(' ')
    const options = command === 'extract' ? ['base', 'head', 'worktree', 'merge-base', 'path', 'output', 'notes']
      : command === 'check' ? ['input', 'complete'] : command === 'lookup' ? ['input', 'selection', 'format'] : null
    if (!options || Object.keys(values).some(key => !['root', 'help', ...options].includes(key))) throw new ToolError('trace-input', 'Use extract, check, or lookup with only the corresponding options')
    if (command === 'lookup') {
      if (!values.input || !values.selection || (values.input === '-' && values.selection === '-')) {
        throw new ToolError('trace-input', 'lookup requires --input and --selection; at most one can read stdin')
      }
      const format = values.format ?? 'text'
      if (!['text', 'json'].includes(format)) throw new ToolError('trace-input', 'lookup format must be text or json')
      const root = path.resolve(values.root)
      const trace = readJSON(values.input === '-' ? '-' : path.resolve(root, values.input), input)
      const selection = readJSON(values.selection === '-' ? '-' : path.resolve(root, values.selection), input)
      const result = lookupTrace(trace, selection)
      output(format === 'json' ? JSON.stringify({ ok: true, ...result }, null, 2) + '\n' : formatLookup(trace, result))
      return 0
    }
    const root = repository(path.resolve(values.root))
    if (command === 'check') {
      if (!values.input) throw new ToolError('trace-input', 'check requires --input PATH or -')
      const trace = readJSON(values.input === '-' ? '-' : path.resolve(root, values.input), input)
      output(JSON.stringify({ ok: true, ...checkTrace(root, trace, { complete: values.complete }) }, null, 2) + '\n')
      return 0
    }
    const filename = values.output ? outputLocation(root, values.output) : null
    const excluded = filename?.startsWith(root + path.sep) ? [path.relative(root, filename).split(path.sep).join('/')] : []
    const comments = values.notes ? array(readJSON(path.resolve(root, values.notes), input), 'notes') : []
    const trace = extractTrace(root, { base: values.base, head: values.head, worktree: values.worktree,
      mergeBase: values['merge-base'], paths: values.path, excluded, comments })
    if (!filename) output(JSON.stringify(trace, null, 2) + '\n')
    else {
      fs.mkdirSync(path.dirname(filename), { recursive: true })
      const descriptor = fs.openSync(filename, 'wx', 0o600)
      try { fs.writeFileSync(descriptor, JSON.stringify(trace, null, 2) + '\n'); fs.fsyncSync(descriptor) }
      finally { fs.closeSync(descriptor) }
      output(JSON.stringify({ ok: true, path: filename, comparison: trace.comparison,
        'code-change-count': trace['code-changes'].length, 'design-change-count': trace['design-changes'].length, diagnostics: trace.diagnostics }, null, 2) + '\n')
    }
    return 0
  } catch (error) {
    output(JSON.stringify({ ok: false, errors: [error instanceof ToolError ? error.diagnostic() : { code: 'trace-error', message: error.message }] }, null, 2) + '\n')
    return 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = traceMain()