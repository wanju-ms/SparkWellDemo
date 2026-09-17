import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { checkTrace, extractTrace, lookupTrace, traceMain } from './trace.js'

function project(context) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sparkwell-trace-')))
  context.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
  git('init', '-q')
  git('config', 'user.name', 'Trace Test')
  git('config', 'user.email', 'trace@example.invalid')
  git('config', 'commit.gpgsign', 'false')
  return {
    root, git,
    write(filename, content) {
      fs.mkdirSync(path.dirname(path.join(root, filename)), { recursive: true })
      fs.writeFileSync(path.join(root, filename), content)
    },
    commit(message = 'Test snapshot') {
      git('add', '.')
      git('commit', '-qm', message)
      return git('rev-parse', 'HEAD')
    },
    artifact(body, filename = 'artifacts/sparks/service.md') {
      this.write(filename, `---\nid: service\ndescription: A service.\nkind: spark\nspark-type: service\n---\n\n# Service\n\n${body}\n`)
    },
  }
}

test('trace committed snapshots provide exact changes and ignore current worktree context', context => {
  const fixture = project(context)
  fixture.artifact('Save records.')
  fixture.write('src/service.js', 'export const value = 1\n')
  const base = fixture.commit('Initial design')
  fixture.artifact('Save and delete records.')
  fixture.write('src/service.js', 'export const value = 2\n')
  const head = fixture.commit('Implement the changed design')
  fixture.artifact('Unrelated working copy')
  const result = extractTrace(fixture.root, { base, head })
  assert.equal(result.comparison.base, base)
  assert.equal(result.comparison.head, head)
  assert.equal(result['code-changes'].length, 1)
  assert.equal(result['design-changes'].length, 1)
  assert.deepEqual(result['code-changes'][0].old.changed, [{ start: 1, count: 1 }])
  assert.deepEqual(result['code-changes'][0].new.changed, [{ start: 1, count: 1 }])
  assert.match(result['design-changes'][0].patch, /\+Save and delete records\./)
  assert.ok(result.context.artifacts.every(entry => !entry.content.includes('Unrelated')))
  assert.equal(result.notes[0].text, 'Implement the changed design')
  assert.deepEqual(result.links, [])
  assert.equal(result.unmapped.code.length, 1)
})

test('trace worktree includes staged, unstaged and untracked files without changing the index', context => {
  const fixture = project(context)
  fixture.artifact('Save records.')
  fixture.write('.gitignore', 'ignored.txt\n')
  fixture.write('src/service.js', 'before\n')
  fixture.commit()
  fixture.write('src/service.js', 'staged\n')
  fixture.git('add', 'src/service.js')
  fixture.write('src/service.js', 'working\n')
  fixture.write('src/new file.ts', 'added\n')
  fixture.write('ignored.txt', 'do not inspect\n')
  const index = fixture.git('write-tree')
  const status = fixture.git('status', '--porcelain')
  const result = extractTrace(fixture.root, { worktree: true })
  assert.deepEqual(result.files.map(file => file.new?.path).sort(), ['src/new file.ts', 'src/service.js'])
  assert.match(result['code-changes'].find(change => change.patch.includes('working')).patch, /-before\n\+working/)
  assert.equal(result.diagnostics[0].code, 'no-design-diff')
  assert.equal(fixture.git('write-tree'), index)
  assert.equal(fixture.git('status', '--porcelain'), status)
})

test('trace captures additions, deletions, renames and non-text file changes', context => {
  const fixture = project(context)
  fixture.artifact('Save records.')
  fixture.write('src/old name.js', 'same content\n')
  fixture.write('src/deleted.js', 'removed\n')
  const base = fixture.commit()
  fixture.git('mv', 'src/old name.js', 'src/new name.js')
  fixture.git('rm', '-q', 'src/deleted.js')
  fixture.write('src/added.js', 'new content\n')
  fixture.write('src/binary.bin', Buffer.from([0, 1, 2]))
  fixture.write('src/empty.js', '')
  const head = fixture.commit()
  const result = extractTrace(fixture.root, { base, head })
  const rename = result.files.find(file => file.status === 'renamed')
  assert.equal(rename.old.path, 'src/old name.js')
  assert.equal(rename.new.path, 'src/new name.js')
  assert.equal(result['code-changes'].find(change => change.file === rename.id).type, 'file')
  const deletion = result['code-changes'].find(change => change.patch?.includes('-removed'))
  assert.deepEqual(deletion.old.changed, [{ start: 1, count: 1 }])
  assert.deepEqual(deletion.new.changed, [])
  assert.ok(result['code-changes'].some(change => change.type === 'non-text'))
  assert.equal(result.unmapped.code.length, 5)
  const renamedChange = result['code-changes'].find(change => change.file === rename.id).id
  for (const side of ['old', 'new']) {
    const selection = { path: rename[side].path, side }
    assert.equal(lookupTrace(result, selection).unmapped[0].code.change, renamedChange)
    assert.equal(lookupTrace(result, { ...selection, start: 1, count: 1 }).unmapped.length, 0)
  }
  assert.equal(lookupTrace(result, { path: 'src/old name.js', side: 'new' }).unmapped.length, 0)
  assert.equal(lookupTrace(result, { path: 'src/binary.bin', side: 'new' }).unmapped.length, 1)
  assert.equal(lookupTrace(result, { path: 'src/binary.bin', side: 'new', start: 1, count: 1 }).unmapped.length, 0)
  assert.equal(lookupTrace(result, { path: 'src/deleted.js', side: 'old', start: 1, count: 1 }).unmapped.length, 1)
  assert.equal(lookupTrace(result, { path: 'src/deleted.js', side: 'new', start: 1, count: 1 }).unmapped.length, 0)
  assert.equal(lookupTrace(result, { path: 'src/added.js', side: 'new', start: 1, count: 1 }).unmapped.length, 1)
})

test('trace records index changes but does not duplicate them as design evidence', context => {
  const fixture = project(context)
  fixture.artifact('Save records.')
  fixture.write('artifacts/index.md', '# Artifacts\n')
  const base = fixture.commit()
  fixture.write('artifacts/index.md', '# Artifacts\nA changed index\n')
  const head = fixture.commit()
  const result = extractTrace(fixture.root, { base, head })
  assert.equal(result.files[0].role, 'index')
  assert.equal(result['design-changes'].length, 0)
  assert.equal(result['code-changes'].length, 0)
  assert.equal(result.diagnostics[0].code, 'derived-index')
})

function changedProject(context) {
  const fixture = project(context)
  fixture.artifact('Save records.\nKeep the ID.')
  fixture.write('src/service.js', 'unchanged\nold\nlast\n')
  const base = fixture.commit()
  fixture.artifact('Save and delete records.\nKeep the ID.')
  fixture.write('src/service.js', 'unchanged\nnew\nlast\n')
  const head = fixture.commit('Add deletion')
  return { ...fixture, trace: extractTrace(fixture.root, { base, head }) }
}

function linkAll(trace) {
  trace.links = [{ id: 'link-1', code: trace['code-changes'].map(change => ({ change: change.id })),
    design: trace['design-changes'].map(change => ({ change: change.id })),
    relation: 'implements', confidence: 'high', explanation: 'The service change implements the new design behavior.' }]
  trace.unmapped = { code: [], design: [] }
  return trace
}

test('trace lookup returns each matching link once and ignores hunk context', context => {
  const trace = linkAll(changedProject(context).trace)
  const change = trace['code-changes'][0].id
  trace.links[0].code.push({ change, side: 'new', start: 2, count: 1 })
  trace.links.push({ ...trace.links[0], id: 'link-2', explanation: 'Another reason for the same code.' })
  for (const side of ['old', 'new']) {
    const result = lookupTrace(trace, { path: 'src/service.js', side, start: 2, count: 1 })
    assert.deepEqual(result.links.map(link => link.id), ['link-1', 'link-2'])
    assert.equal(result.links[0].explanation, trace.links[0].explanation)
    assert.deepEqual(result.links[0].design, trace.links[0].design)
    assert.equal(result['comparison-check'], 'not-requested')
    assert.equal(lookupTrace(trace, { path: 'src/service.js', side, start: 1, count: 1 }).links.length, 0)
    assert.equal(lookupTrace(trace, { path: 'src/service.js', side, start: 1, count: 3 }).links.length, 2)
  }
  assert.equal(lookupTrace(trace, { path: 'missing.js', side: 'new', start: 2, count: 1 }).links.length, 0)
})

test('trace lookup respects partial anchors and returns unmapped reasons on the selected side', context => {
  const trace = linkAll(changedProject(context).trace)
  const change = trace['code-changes'][0].id
  trace.links[0].code = [{ change, side: 'new', start: 2, count: 1 }]
  trace.unmapped.code = [{ code: { change, side: 'old', start: 2, count: 1 }, classification: 'implementation-only', reason: 'Remove the old implementation.' }]
  const previous = structuredClone(trace)
  const added = lookupTrace(trace, { path: 'src/service.js', side: 'new', start: 2, count: 1 })
  assert.deepEqual(added.links[0]['matched-code'], trace.links[0].code)
  assert.deepEqual(added.unmapped, [])
  const removed = lookupTrace(trace, { path: 'src/service.js', side: 'old', start: 2, count: 1 })
  assert.deepEqual(removed.links, [])
  assert.deepEqual(removed.unmapped, trace.unmapped.code)
  assert.deepEqual(trace, previous)
})

test('trace lookup uses the selected changed lines rather than the surrounding hunk', context => {
  const fixture = changedProject(context)
  fixture.write('src/service.js', 'unchanged\nnew\nlast\nextra\n')
  const trace = linkAll(extractTrace(fixture.root, { base: fixture.trace.comparison.base, worktree: true }))
  const change = trace['code-changes'][0].id
  trace.links[0].code = [{ change, side: 'new', start: 2, count: 1 }]
  trace.unmapped.code = [
    { code: { change, side: 'old', start: 2, count: 1 }, classification: 'implementation-only', reason: 'Replace the old implementation.' },
    { code: { change, side: 'new', start: 4, count: 1 }, classification: 'unexplained', reason: 'No design source found for the extra line.' },
  ]
  const extra = lookupTrace(trace, { path: 'src/service.js', side: 'new', start: 4, count: 1 })
  assert.deepEqual(extra.links, [])
  assert.deepEqual(extra.unmapped, [trace.unmapped.code[1]])
  const span = lookupTrace(trace, { path: 'src/service.js', side: 'new', start: 1, count: 4 })
  assert.equal(span.links.length, 1)
  assert.deepEqual(span.unmapped, [trace.unmapped.code[1]])
})

test('trace lookup checks explicit commit identities without confusing captured HEAD with worktree content', context => {
  const fixture = changedProject(context)
  const trace = linkAll(fixture.trace)
  const selection = { path: 'src/service.js', side: 'new', start: 2, count: 1, base: trace.comparison.base, head: trace.comparison.head }
  assert.equal(lookupTrace(trace, selection)['comparison-check'], 'matched')
  assert.throws(() => lookupTrace(trace, { ...selection, base: selection.head }), error => error.code === 'trace-comparison-mismatch')
  assert.throws(() => lookupTrace(trace, { ...selection, head: 'HEAD' }), error => error.code === 'trace-comparison-mismatch')
  const working = extractTrace(fixture.root, { base: selection.base, worktree: true })
  assert.throws(() => lookupTrace(working, selection), error => error.code === 'trace-comparison-mismatch')
})

test('trace lookup rejects invalid review coordinates and incomplete version pairs', context => {
  const trace = linkAll(changedProject(context).trace)
  const selection = { path: 'src/service.js', side: 'new', start: 2, count: 1 }
  for (const patch of [{ side: 'right' }, { path: '' }, { start: 0 }, { count: 0 }, { start: 1.5 }, { count: -1 }, { count: undefined },
    { start: Number.MAX_SAFE_INTEGER, count: 2 }, { base: trace.comparison.base }, { head: trace.comparison.head }, { position: 2 }]) {
    assert.throws(() => lookupTrace(trace, { ...selection, ...patch }))
  }
})

test('trace check validates draft coverage and complete many-to-many associations', context => {
  const fixture = changedProject(context)
  assert.equal(checkTrace(fixture.root, fixture.trace)['not-analyzed-count'], 2)
  assert.throws(() => checkTrace(fixture.root, fixture.trace, { complete: true }), error => error.code === 'trace-incomplete')
  const completed = linkAll(fixture.trace)
  assert.equal(checkTrace(fixture.root, completed, { complete: true })['link-count'], 1)
  completed.links[0].notes = [completed.notes[0].id]
  assert.equal(checkTrace(fixture.root, completed)['link-count'], 1)
})

test('trace checks old and new changed lines independently without accepting context lines', context => {
  const fixture = changedProject(context)
  const trace = linkAll(fixture.trace)
  const change = trace['code-changes'][0].id
  trace.links[0].code = [{ change, side: 'new', start: 2, count: 1 }]
  assert.throws(() => checkTrace(fixture.root, trace), /Unaccounted code/)
  trace.unmapped.code = [{ code: { change, side: 'old', start: 2, count: 1 }, classification: 'implementation-only', reason: 'Remove the old implementation.' }]
  assert.equal(checkTrace(fixture.root, trace, { complete: true })['link-count'], 1)
  trace.links[0].code[0].start = 1
  assert.throws(() => checkTrace(fixture.root, trace), /changed lines, not context/)
  trace.links[0].code[0].start = 500
  assert.throws(() => checkTrace(fixture.root, trace), /outside the recorded lines/)
})

test('trace rejects missing references, duplicate IDs, overlapping unmapped ranges and altered facts', context => {
  const fixture = changedProject(context)
  const cases = [
    trace => { trace.links[0].code[0].change = 'missing' },
    trace => { trace.links[0].design[0].change = 'missing' },
    trace => { trace.links[0].notes = ['missing'] },
    trace => { trace.links.push(structuredClone(trace.links[0])) },
    trace => { trace.links[0].explanation = '' },
    trace => { trace.links[0].confidence = 0.99 },
    trace => { trace.unmapped.code = [{ code: trace.links[0].code[0], classification: 'unexplained', reason: 'No evidence.' }] },
    trace => { trace['code-changes'][0].patch = 'invented patch' },
    trace => { trace['design-changes'][0].new.start += 1 },
  ]
  for (const mutate of cases) {
    const trace = linkAll(structuredClone(fixture.trace))
    mutate(trace)
    assert.throws(() => checkTrace(fixture.root, trace))
  }
})

test('trace links code-only corrections to unchanged design clauses without inventing a diff', context => {
  const fixture = project(context)
  fixture.artifact('Save records.')
  fixture.write('src/service.js', 'old\n')
  const base = fixture.commit()
  fixture.write('src/service.js', 'fixed\n')
  const head = fixture.commit()
  const trace = extractTrace(fixture.root, { base, head })
  const artifact = trace.context.artifacts.find(entry => entry.side === 'new')
  trace.links.push({ id: 'existing-design', code: [{ change: trace['code-changes'][0].id }],
    design: [{ artifact: artifact.key, start: 10, count: 1 }], relation: 'implements', confidence: 'medium', explanation: 'Correct the implementation of the existing save rule.' })
  trace.unmapped.code = []
  assert.equal(checkTrace(fixture.root, trace, { complete: true })['design-change-count'], 0)
})

test('trace does not permit changed design clauses to masquerade as unchanged context', context => {
  const fixture = changedProject(context)
  const trace = linkAll(fixture.trace)
  const artifact = trace.context.artifacts.find(entry => entry.side === 'new')
  trace.links[0].design = [{ artifact: artifact.key, start: 10, count: 1 }]
  assert.throws(() => checkTrace(fixture.root, trace), /must reference their diff block/)
})

test('trace rejects changed clauses excluded by path scope but permits their unchanged neighbors', context => {
  const fixture = changedProject(context)
  const trace = extractTrace(fixture.root, { base: fixture.trace.comparison.base, head: fixture.trace.comparison.head, paths: ['src'] })
  assert.equal(trace['design-changes'].length, 0)
  const artifact = trace.context.artifacts.find(entry => entry.side === 'new')
  trace.links = [{ id: 'clause', code: [{ change: trace['code-changes'][0].id }],
    design: [{ artifact: artifact.key, start: 10, count: 1 }], relation: 'implements', confidence: 'medium', explanation: 'Follow the design clause.' }]
  trace.unmapped.code = []
  assert.throws(() => checkTrace(fixture.root, trace), /include the Artifact path/)
  trace.links[0].design[0].start = 11
  assert.equal(checkTrace(fixture.root, trace, { complete: true })['link-count'], 1)
})

test('trace supports several code blocks associated with several Artifact changes', context => {
  const fixture = project(context)
  fixture.artifact('Save records.')
  fixture.write('artifacts/constraints/limit.md', '---\nid: limit\nkind: constraint\ndescription: A limit.\napplies-to: [service]\n---\n\n# Limit\n\nAt most 10 records.\n')
  fixture.write('first.js', 'before\n')
  fixture.write('second.js', 'before\n')
  const base = fixture.commit()
  fixture.artifact('Save and delete records.')
  fixture.write('artifacts/constraints/limit.md', '---\nid: limit\nkind: constraint\ndescription: A limit.\napplies-to: [service]\n---\n\n# Limit\n\nAt most 20 records.\n')
  fixture.write('first.js', 'after\n')
  fixture.write('second.js', 'after\n')
  const head = fixture.commit()
  const trace = linkAll(extractTrace(fixture.root, { base, head }))
  assert.equal(trace.links[0].code.length, 2)
  assert.equal(trace.links[0].design.length, 2)
  assert.equal(checkTrace(fixture.root, trace, { complete: true })['link-count'], 1)
  const result = lookupTrace(trace, { path: 'first.js', side: 'new', start: 1, count: 1 })
  assert.equal(result.links.length, 1)
  assert.equal(result.links[0]['matched-code'].length, 1)
  assert.deepEqual(result.links[0].code, trace.links[0].code)
  assert.deepEqual(result.links[0].design, trace.links[0].design)
})

test('trace worktree validation detects changed content and a new untracked file', context => {
  const fixture = project(context)
  fixture.artifact('Save records.')
  fixture.write('src/service.js', 'old\n')
  fixture.commit()
  fixture.write('src/service.js', 'new\n')
  const trace = extractTrace(fixture.root, { worktree: true })
  assert.ok(checkTrace(fixture.root, trace))
  fixture.write('src/service.js', 'later\n')
  assert.throws(() => checkTrace(fixture.root, trace), error => error.code === 'trace-snapshot-mismatch')
  fixture.write('src/service.js', 'new\n')
  fixture.write('src/untracked.js', 'extra\n')
  assert.throws(() => checkTrace(fixture.root, trace), error => error.code === 'trace-snapshot-mismatch')
})

test('trace candidates use versioned maps and bindings only as hints', context => {
  const fixture = project(context)
  fixture.artifact('Save records.')
  fixture.write('.sparkwell/config.yaml', 'implementations:\n  api:\n    source-root: src\nbindings:\n  - implementation: api\n    match: [{id: service}]\n')
  fixture.write('.sparkwell/implementation-maps/api.yaml', 'implementation-id: api\nartifacts:\n  - path: src/service.js\n    derived-from: [service]\n')
  fixture.write('src/service.js', 'old\n')
  const base = fixture.commit()
  fixture.write('src/service.js', 'new\n')
  const head = fixture.commit()
  fixture.write('.sparkwell/config.yaml', 'broken: [')
  const trace = extractTrace(fixture.root, { base, head })
  const file = trace.files.find(entry => entry.new.path === 'src/service.js')
  assert.equal(file.candidates.length, 4)
  assert.deepEqual(new Set(file.candidates.map(entry => entry.via)), new Set(['binding', 'implementation-map']))
  assert.deepEqual(trace.links, [])
  assert.ok(trace.context.support.every(entry => !entry.content.includes('broken')))
})

test('trace comments are explicitly sourced and may explain unmapped implementation changes', context => {
  const fixture = project(context)
  fixture.write('source.js', 'old\n')
  const base = fixture.commit()
  fixture.write('source.js', 'new\n')
  const head = fixture.commit()
  const trace = extractTrace(fixture.root, { base, head, comments: [{ source: 'Provided PR comment', text: 'This is a local refactor.' }] })
  const comment = trace.notes.find(note => note.kind === 'comment')
  trace.unmapped.code[0] = { code: trace.unmapped.code[0].code, classification: 'implementation-only', reason: 'Refactor only, according to the supplied comment.', notes: [comment.id] }
  assert.ok(checkTrace(fixture.root, trace, { complete: true }))
})

test('trace CLI writes a new self-excluded report and refuses overwrite or Git metadata paths', context => {
  const fixture = project(context)
  fixture.artifact('Save records.')
  fixture.commit()
  fixture.write('source.js', 'new\n')
  const cli = args => {
    let output = ''
    const exitCode = traceMain(['--root', fixture.root, ...args], { output: text => { output += text } })
    return { exitCode, value: JSON.parse(output) }
  }
  const written = cli(['extract', '--worktree', '--output', 'reports/trace.json'])
  assert.equal(written.exitCode, 0)
  assert.equal(cli(['check', '--input', 'reports/trace.json']).exitCode, 0)
  assert.equal(cli(['check', '--input', 'reports/trace.json', '--complete']).exitCode, 1)
  assert.equal(cli(['extract', '--worktree', '--output', 'reports/trace.json']).value.errors[0].code, 'trace-output-exists')
  assert.equal(cli(['extract', '--worktree', '--output', '.git/trace.json']).exitCode, 1)
  assert.equal(cli(['extract', '--worktree', '--complete']).exitCode, 1)
  assert.equal(cli(['check']).exitCode, 1)
})

test('trace lookup CLI reads files or stdin without Git and reports invalid input as JSON', context => {
  const fixture = changedProject(context)
  const trace = linkAll(fixture.trace)
  const selection = { path: 'src/service.js', side: 'new', start: 2, count: 1, base: trace.comparison.base, head: trace.comparison.head }
  const reportText = JSON.stringify(trace)
  const selectionText = JSON.stringify(selection)
  fixture.write('trace.json', reportText)
  fixture.write('selection.json', selectionText)
  fixture.write('src/service.js', 'unrelated current content\n')
  fs.rmSync(path.join(fixture.root, '.git'), { recursive: true, force: true })
  const cli = (args, stdin = '') => {
    let output = ''
    const exitCode = traceMain(['--root', fixture.root, 'lookup', '--format', 'json', ...args], { input: () => stdin, output: text => { output += text } })
    return { exitCode, value: JSON.parse(output) }
  }
  for (const [args, stdin] of [
    [['--input', 'trace.json', '--selection', '-'], selectionText],
    [['--input', '-', '--selection', 'selection.json'], reportText],
    [['--input', 'trace.json', '--selection', 'selection.json'], ''],
  ]) {
    const result = cli(args, stdin)
    assert.equal(result.exitCode, 0)
    assert.deepEqual(result.value, { ok: true, ...lookupTrace(trace, selection) })
  }
  assert.equal(cli(['--input', 'trace.json', '--selection', '-'], '{').value.errors[0].code, 'trace-json')
  assert.equal(cli(['--input', 'trace.json', '--selection', '-'], JSON.stringify({ ...selection, head: 'wrong' })).value.errors[0].code, 'trace-comparison-mismatch')
  assert.equal(cli(['--input', '-', '--selection', '-']).exitCode, 1)
  assert.equal(cli(['--input', 'trace.json']).exitCode, 1)
  assert.equal(cli(['--input', 'trace.json', '--selection', 'selection.json', '--complete']).exitCode, 1)
  assert.equal(fs.readFileSync(path.join(fixture.root, 'trace.json'), 'utf8'), reportText)
  assert.equal(fs.readFileSync(path.join(fixture.root, 'selection.json'), 'utf8'), selectionText)
})

test('trace lookup CLI displays code diffs and before/after design text without internal IDs', context => {
  const fixture = changedProject(context)
  const trace = linkAll(fixture.trace)
  const designChange = trace['design-changes'][0].id
  trace.links[0].design = [{ change: designChange, side: 'old', start: 10, count: 1 }, { change: designChange, side: 'new', start: 10, count: 1 }]
  const reportText = JSON.stringify(trace)
  fixture.write('trace.json', reportText)
  fixture.artifact('Unrelated current design.')
  fixture.write('src/service.js', 'unrelated current source\n')
  fs.rmSync(path.join(fixture.root, '.git'), { recursive: true, force: true })
  const cli = (selection, args = []) => {
    let output = ''
    const exitCode = traceMain(['--root', fixture.root, 'lookup', '--input', 'trace.json', '--selection', '-', ...args],
      { input: () => JSON.stringify(selection), output: text => { output += text } })
    return { exitCode, output }
  }
  const selection = { path: 'src/service.js', side: 'new', start: 2, count: 1 }
  const result = cli(selection)
  assert.equal(result.exitCode, 0, result.output)
  assert.match(result.output, /Code diff: src\/service\.js/)
  assert.match(result.output, /--- a\/src\/service\.js\n\+\+\+ b\/src\/service\.js\n@@/)
  assert.match(result.output, /-old\n\+new/)
  assert.equal(result.output.match(/Design change:/g).length, 1)
  assert.match(result.output, /References: old lines 10-10, new lines 10-10/)
  const designOutput = result.output.slice(result.output.indexOf('Design change:'))
  const change = trace['design-changes'][0]
  const expected = side => trace.context.artifacts.find(entry => entry.side === side).content.split('\n')
    .slice(change[side].start - 1, change[side].start - 1 + change[side].count).join('\n')
  assert.ok(designOutput.includes(`-- before --\n${expected('old')}\n\n-- after --\n${expected('new')}`))
  assert.doesNotMatch(designOutput, /\n@@|\n--- a\/|\n\+\+\+ b\/|\n-Save records\.|\n\+Save and delete records\./)
  assert.ok(result.output.includes(trace.links[0].explanation))
  assert.doesNotMatch(result.output, /[Uu]nrelated current|file-[0-9a-f]+|change-[0-9a-f]+|artifact-[0-9a-f]+|link-1/)
  assert.deepEqual(cli(selection, ['--format', 'text']), result)
  assert.match(cli({ ...selection, start: 1 }).output, /No matching changes\./)
  assert.equal(cli(selection, ['--format', 'other']).exitCode, 1)
  assert.equal(fs.readFileSync(path.join(fixture.root, 'trace.json'), 'utf8'), reportText)
})

test('trace lookup before/after design text handles empty sides and preserves source punctuation', context => {
  const fixture = changedProject(context)
  fixture.git('rm', '-q', 'artifacts/sparks/service.md')
  const source = '---\nid: added\ndescription: Added design.\nkind: spark\nspark-type: service\n---\n\n# Added\n\n- Keep a Markdown bullet.\n+ Keep a literal plus.\n  Keep indentation and trailing spaces.  '
  fixture.write('artifacts/sparks/added.md', source)
  fixture.write('src/service.js', 'updated\n')
  const trace = linkAll(extractTrace(fixture.root, { base: fixture.trace.comparison.head, worktree: true }))
  fixture.write('trace.json', JSON.stringify(trace))
  let output = ''
  const exitCode = traceMain(['--root', fixture.root, 'lookup', '--input', 'trace.json', '--selection', '-'],
    { input: () => JSON.stringify({ path: 'src/service.js', side: 'new', start: 1, count: 1 }), output: text => { output += text } })
  assert.equal(exitCode, 0, output)
  assert.ok(output.includes(`-- before --\n(empty)\n\n-- after --\n${source}`))
  const removed = trace.context.artifacts.find(entry => entry.side === 'old' && entry.metadata.id === 'service')
  assert.ok(output.includes(`-- before --\n${removed.content.replace(/\n$/, '')}\n\n-- after --\n(empty)`))
  assert.doesNotMatch(output, /No newline at end of file/)
})

test('trace lookup text shows captured unchanged design clauses and unmapped reasons', context => {
  const fixture = changedProject(context)
  const trace = linkAll(fixture.trace)
  const artifact = trace.context.artifacts.find(entry => entry.side === 'new')
  trace.links[0].design = [{ artifact: artifact.key, start: 11, count: 1 }]
  const change = trace['code-changes'][0].id
  trace.links[0].code = [{ change, side: 'new', start: 2, count: 1 }]
  trace.unmapped.code = [{ code: { change, side: 'old', start: 2, count: 1 }, classification: 'implementation-only', reason: 'Remove the old implementation.' }]
  fixture.write('trace.json', JSON.stringify(trace))
  fixture.artifact('Unrelated current design.')
  const cli = side => {
    let output = ''
    const exitCode = traceMain(['--root', fixture.root, 'lookup', '--input', 'trace.json', '--selection', '-'],
      { input: () => JSON.stringify({ path: 'src/service.js', side, start: 2, count: 1 }), output: text => { output += text } })
    assert.equal(exitCode, 0, output)
    return output
  }
  const added = cli('new')
  assert.match(added, /Design context \(unchanged\): artifacts\/sparks\/service\.md\nReferences: new lines 11-11\nKeep the ID\./)
  assert.doesNotMatch(added, /Design change:|-- before --|-- after --|Unrelated current design|artifact-[0-9a-f]+/)
  const removed = cli('old')
  assert.match(removed, /Unmapped: implementation-only/)
  assert.match(removed, /Reason:\nRemove the old implementation\./)
  assert.match(removed, /Code diff: src\/service\.js/)
  assert.doesNotMatch(removed, /Design change:|Design context|change-[0-9a-f]+/)
})

test('trace lookup text preserves renamed design paths and non-text limitations', context => {
  const fixture = changedProject(context)
  fixture.git('mv', 'artifacts/sparks/service.md', 'artifacts/sparks/renamed.md')
  fixture.write('artifacts/sparks/unreadable.md', Buffer.from([0, 1, 2]))
  fixture.write('src/service.js', 'updated\n')
  const trace = linkAll(extractTrace(fixture.root, { base: fixture.trace.comparison.head, worktree: true }))
  fixture.write('trace.json', JSON.stringify(trace))
  let output = ''
  const exitCode = traceMain(['--root', fixture.root, 'lookup', '--input', 'trace.json', '--selection', '-'],
    { input: () => JSON.stringify({ path: 'src/service.js', side: 'new', start: 1, count: 1 }), output: text => { output += text } })
  assert.equal(exitCode, 0, output)
  assert.match(output, /Design change: artifacts\/sparks\/service\.md -> artifacts\/sparks\/renamed\.md/)
  assert.match(output, /--- a\/artifacts\/sparks\/service\.md\n\+\+\+ b\/artifacts\/sparks\/renamed\.md\nNo text diff \(renamed\)\./)
  const limited = trace['design-changes'].find(change => change.type === 'non-text')
  assert.ok(output.includes(`--- /dev/null\n+++ b/artifacts/sparks/unreadable.md\nNo text diff (added; ${limited.limitation}).`))
  assert.doesNotMatch(output, /file-[0-9a-f]+|change-[0-9a-f]+|artifact-[0-9a-f]+|link-1/)
})

test('trace uses an explicitly requested merge base without changing branches', context => {
  const fixture = project(context)
  fixture.write('shared.js', 'initial\n')
  const ancestor = fixture.commit()
  const branch = fixture.git('symbolic-ref', '--short', 'HEAD')
  fixture.git('checkout', '-qb', 'topic')
  fixture.write('topic.js', 'topic\n')
  const head = fixture.commit()
  fixture.git('checkout', '-q', branch)
  fixture.write('main.js', 'target branch\n')
  const base = fixture.commit()
  const trace = extractTrace(fixture.root, { base, head, mergeBase: true })
  assert.equal(trace.comparison.base, ancestor)
  assert.equal(trace.comparison['requested-base'], base)
  assert.deepEqual(trace.files.map(file => file.new?.path), ['topic.js'])
  assert.equal(fixture.git('symbolic-ref', '--short', 'HEAD'), branch)
  assert.ok(checkTrace(fixture.root, trace))
})

test('trace explicit worktree base includes an earlier committed design change', context => {
  const fixture = project(context)
  fixture.artifact('Save records.')
  fixture.write('service.js', 'save\n')
  const base = fixture.commit()
  fixture.artifact('Save and delete records.')
  const designCommit = fixture.commit('Design deletion')
  fixture.write('service.js', 'save and delete\n')
  const narrow = extractTrace(fixture.root, { worktree: true })
  assert.equal(narrow['design-changes'].length, 0)
  const broad = extractTrace(fixture.root, { base, worktree: true })
  assert.equal(broad['design-changes'].length, 1)
  assert.equal(broad['code-changes'].length, 1)
  assert.equal(broad.comparison['head-at-capture'], designCommit)
  assert.equal(broad.notes[0].source, designCommit)
})

test('trace keeps added and removed paths when an edited untracked rename cannot be established', context => {
  const fixture = project(context)
  fixture.write('old.js', 'one\ntwo\nthree\n')
  fixture.commit()
  fs.renameSync(path.join(fixture.root, 'old.js'), path.join(fixture.root, 'renamed.js'))
  const exact = extractTrace(fixture.root, { worktree: true })
  assert.equal(exact.files[0].status, 'renamed')
  fixture.write('renamed.js', 'one\nchanged\nthree\n')
  const edited = extractTrace(fixture.root, { worktree: true })
  assert.deepEqual(edited.files.map(file => file.status).sort(), ['added', 'deleted'])
  assert.equal(edited.unmapped.code.length, 2)
})

test('trace preserves unusual paths, missing final newlines, and explicit path scope', context => {
  const fixture = project(context)
  const filename = 'src/name\twith\nspace.js'
  fixture.write(filename, 'original')
  fixture.write('other.js', 'before\n')
  const base = fixture.commit()
  fixture.write(filename, 'updated\n')
  fixture.write('other.js', 'after\n')
  const head = fixture.commit()
  const trace = extractTrace(fixture.root, { base, head, paths: ['src/'] })
  assert.equal(trace.files.length, 1)
  assert.equal(trace.files[0].old.path, filename)
  assert.match(trace['code-changes'][0].patch, /No newline at end of file/)
  assert.ok(checkTrace(fixture.root, trace))
})

test('trace reports large, complex, mode-only and symlink changes without reading external targets', context => {
  const fixture = project(context)
  fixture.write('source.js', 'same\n')
  fixture.write('complex.txt', Array.from({ length: 1001 }, (_, index) => `old ${index}\n`).join(''))
  const base = fixture.commit()
  fs.chmodSync(path.join(fixture.root, 'source.js'), 0o755)
  fs.symlinkSync('/not-readable/external-file', path.join(fixture.root, 'link'))
  fixture.write('big.txt', 'x'.repeat(1024 * 1024 + 1))
  fixture.write('many-lines.txt', '\n'.repeat(20001))
  fixture.write('complex.txt', Array.from({ length: 1001 }, (_, index) => `new ${index}\n`).join(''))
  const trace = extractTrace(fixture.root, { base, worktree: true })
  const limitation = filename => trace['code-changes'].find(change => trace.files.find(file => file.id === change.file).new?.path === filename)
  assert.equal(limitation('link').limitation, 'symlink')
  assert.equal(limitation('big.txt').limitation, 'large-file')
  assert.equal(limitation('many-lines.txt').limitation, 'line-limit')
  assert.equal(limitation('complex.txt').limitation, 'diff-limit')
  assert.equal(limitation('source.js').type, 'file')
  assert.equal(trace.unmapped.code.length, 5)
})

test('trace malformed note entries have location-specific validation errors', context => {
  const fixture = changedProject(context)
  for (const note of [null, 'text', {}, { id: 'fake', source: 'source', kind: 'other', text: 'text' }]) {
    const trace = structuredClone(fixture.trace)
    trace.notes = [note]
    assert.throws(() => checkTrace(fixture.root, trace), error => error.code === 'invalid-change-map' && error.location === 'notes[0]')
  }
})

test('trace CLI supports an explicit external temporary directory alias', context => {
  const fixture = project(context)
  const outside = project(context)
  const alias = `${outside.root}-alias`
  fs.symlinkSync(outside.root, alias, 'dir')
  context.after(() => fs.unlinkSync(alias))
  fixture.write('source.js', 'before\n')
  const base = fixture.commit()
  fixture.write('source.js', 'after\n')
  const head = fixture.commit()
  let output = ''
  const exitCode = traceMain(['--root', fixture.root, 'extract', '--base', base, '--head', head, '--output', path.join(alias, 'trace.json')], { output: text => { output += text } })
  assert.equal(exitCode, 0, output)
  assert.ok(fs.existsSync(path.join(outside.root, 'trace.json')))
})