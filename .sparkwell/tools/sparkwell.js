import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual, parseArgs } from 'node:util'
import { isScalar, parseDocument, stringify, visit } from 'yaml'

export const KINDS = {
  spark: 'sparks',
  constraint: 'constraints',
  aspect: 'aspects',
  collaboration: 'collaborations',
}
const SPARK_TYPES = new Set(['ui', 'data', 'logic', 'service'])
const COMMON_FIELDS = ['id', 'description', 'kind', 'sources', 'icon', 'image']
const KIND_FIELDS = {
  spark: ['spark-type', 'role', 'uses', 'composes'],
  constraint: ['applies-to', 'scope'],
  aspect: ['applies-to', 'scope'],
  collaboration: ['participants'],
}
export const CONFIG_PATH = '.sparkwell/config.yaml'
export const MAP_DIRECTORY = '.sparkwell/implementation-maps'

export class ToolError extends Error {
  constructor(code, message, location) {
    super(message)
    this.code = code
    this.location = location
  }

  diagnostic() {
    return {
      code: this.code,
      message: this.message,
      ...(this.location === undefined ? {} : { location: this.location }),
    }
  }
}

export function parseYaml(text, location) {
  try {
    const document = parseDocument(text, { uniqueKeys: true, version: '1.2' })
    const problem = [...document.errors, ...document.warnings][0]
    if (problem) throw new Error(problem.message.split('\n')[0])
    visit(document, {
      Pair(_key, pair) {
        if (!isScalar(pair.key) || typeof pair.key.value !== 'string') {
          throw new Error('Mapping keys must be strings')
        }
      },
    })
    return document.toJS({ maxAliasCount: 100 })
  } catch (error) {
    throw new ToolError('invalid-yaml', error.message, location)
  }
}

function objectFields(value, required, optional, location) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ToolError('invalid-object', 'Expected a mapping', location)
  }
  const allowed = new Set([...required, ...optional])
  const missing = required.filter(field => !Object.hasOwn(value, field))
  const unknown = Object.keys(value).filter(field => !allowed.has(field))
  if (missing.length || unknown.length) {
    const details = [
      missing.length ? `missing: ${missing.sort().join(', ')}` : '',
      unknown.length ? `unknown: ${unknown.sort().join(', ')}` : '',
    ].filter(Boolean)
    throw new ToolError('invalid-fields', details.join('; '), location)
  }
}

function textValue(value, location) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ToolError('invalid-string', 'Expected a non-empty string', location)
  }
  return value
}

function identifier(value, location) {
  textValue(value, location)
  if (value.trim() !== value || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new ToolError('invalid-id', 'Expected a lowercase kebab-case ID', location)
  }
  return value
}

function stringList(value, location, minimum = 0) {
  if (!Array.isArray(value) || value.length < minimum) {
    throw new ToolError('invalid-list', `Expected a list with at least ${minimum} items`, location)
  }
  value.forEach(entry => textValue(entry, location))
  if (new Set(value).size !== value.length) {
    throw new ToolError('duplicate-values', 'List entries must be distinct', location)
  }
  return value
}

function optionalList(object, field) {
  return Object.hasOwn(object, field) ? object[field] : []
}

function schemaVersion(value, location) {
  if (value !== 1) {
    throw new ToolError('unsupported-version', 'Expected schema-version: 1', location)
  }
}

function within(root, candidate) {
  const relative = path.relative(root, candidate)
  return relative === '' || (
    relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
  )
}

function fileState(filename) {
  try {
    return fs.lstatSync(filename)
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
}

function resolvedPath(filename) {
  const suffix = []
  let current = filename
  while (!fileState(current)) {
    const parent = path.dirname(current)
    if (parent === current) throw new Error('No existing path ancestor')
    suffix.push(path.basename(current))
    current = parent
  }
  return path.join(fs.realpathSync(current), ...suffix.reverse())
}

export function projectPath(root, value, location, fileRequired = false) {
  textValue(value, location)
  if (
    path.posix.isAbsolute(value) || path.win32.isAbsolute(value) ||
    value.includes('\\') || value.includes('\0') || value.split('/').includes('..') ||
    /^[A-Za-z]:/.test(value)
  ) {
    throw new ToolError('unsafe-path', 'Expected a project-relative path using /', location)
  }
  const filename = path.resolve(root, value)
  let resolved
  try {
    resolved = resolvedPath(filename)
  } catch {
    throw new ToolError('unsafe-path', 'Cannot resolve path', location)
  }
  if (!within(root, resolved)) {
    throw new ToolError('unsafe-path', 'Path leaves the project, including through a symlink', location)
  }
  if (fileRequired && (!fs.existsSync(filename) || !fs.statSync(filename).isFile())) {
    throw new ToolError('missing-file', 'Expected an existing file', location)
  }
  return filename
}

function relativePath(root, filename) {
  return path.relative(root, filename).split(path.sep).join('/')
}

function readText(filename) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(filename))
  } catch (error) {
    throw new ToolError('unreadable-file', 'Cannot read UTF-8 text', filename)
  }
}

export function dependencyOrder(graph, roots = [...graph.keys()], location) {
  const included = new Set()
  const pending = [...roots]
  while (pending.length) {
    const current = pending.pop()
    if (included.has(current)) continue
    if (!graph.has(current)) {
      throw new ToolError('unknown-dependency', `Unknown dependency: ${current}`, location)
    }
    included.add(current)
    pending.push(...graph.get(current))
  }
  const remaining = new Map([...included].sort().map(name => [name, new Set(graph.get(name))]))
  const ready = [...remaining].filter(([, dependencies]) => !dependencies.size).map(([name]) => name)
  const order = []
  for (let index = 0; index < ready.length; index += 1) {
    const current = ready[index]
    order.push(current)
    for (const [name, dependencies] of remaining) {
      if (dependencies.delete(current) && !dependencies.size) ready.push(name)
    }
  }
  if (order.length !== included.size) {
    const unresolved = [...included].filter(name => !order.includes(name)).sort()
    throw new ToolError('dependency-cycle', `Cyclic graph; unresolved: ${unresolved.join(', ')}`, location)
  }
  return order
}

function documentTitle(body, location) {
  const titles = []
  let fence = null
  for (const line of body.split(/\r?\n/)) {
    if (fence) {
      if (new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`).test(line)) fence = null
    } else {
      const opening = line.match(/^ {0,3}(`{3,}|~{3,})/)
      const title = line.match(/^#\s+(.+)$/)
      if (opening) fence = opening[1]
      else if (title) titles.push(title[1].trim())
    }
  }
  if (fence || titles.length !== 1 || !body.trimStart().startsWith('# ')) {
    throw new ToolError('invalid-markdown', 'Expected one H1 after frontmatter and closed code fences', location)
  }
  return titles[0]
}

function artifactFiles(directory) {
  const result = []
  for (const name of fs.readdirSync(directory).sort()) {
    const filename = path.join(directory, name)
    const entry = fs.lstatSync(filename)
    if (entry.isSymbolicLink() && fs.statSync(filename).isDirectory()) {
      throw new ToolError('symlink-directory', 'Artifact discovery does not follow directory symlinks', filename)
    }
    if (entry.isDirectory()) result.push(...artifactFiles(filename))
    else if (name.endsWith('.md')) result.push(filename)
  }
  return result
}

export function loadArtifacts(root) {
  const records = new Map()
  for (const [kind, directory] of Object.entries(KINDS)) {
    const base = projectPath(root, `artifacts/${directory}`, directory)
    if (!fs.existsSync(base)) continue
    if (!fs.statSync(base).isDirectory() || fs.lstatSync(base).isSymbolicLink()) {
      throw new ToolError('invalid-directory', 'Artifact roots must be ordinary directories', base)
    }
    for (const filename of artifactFiles(base)) {
      const relative = relativePath(root, filename)
      projectPath(root, relative, relative, true)
      const content = readText(filename)
      const header = content.match(/^---[ \t]*\r?\n([\s\S]*?)^---[ \t]*(?:\r?\n|$)/m)
      if (!header || header.index !== 0) {
        throw new ToolError('missing-frontmatter', 'Artifact must start with YAML frontmatter', relative)
      }
      if (/^[ \t]*\t/m.test(header[1])) {
        throw new ToolError('invalid-yaml', 'Use spaces for YAML indentation', relative)
      }
      const metadata = parseYaml(header[1], relative)
      objectFields(metadata, ['id', 'description', 'kind'], [...COMMON_FIELDS, ...KIND_FIELDS[kind]], relative)
      const artifactId = identifier(metadata.id, relative)
      textValue(metadata.description, relative)
      if (metadata.kind !== kind || path.basename(filename) !== `${artifactId}.md`) {
        throw new ToolError('artifact-location', 'Kind directory and filename must match metadata', relative)
      }
      if (records.has(artifactId)) {
        throw new ToolError('duplicate-id', `Artifact ID already exists: ${artifactId}`, relative)
      }
      if (Object.hasOwn(metadata, 'spark-type')) {
        textValue(metadata['spark-type'], relative)
        if (!SPARK_TYPES.has(metadata['spark-type'])) {
          throw new ToolError('invalid-spark-type', 'Unsupported spark-type', relative)
        }
      }
      if (Object.hasOwn(metadata, 'role') && metadata.role !== 'root') {
        throw new ToolError('invalid-role', 'Only role: root is supported', relative)
      }
      for (const field of ['uses', 'composes', 'applies-to', 'participants', 'sources']) {
        if (Object.hasOwn(metadata, field)) stringList(metadata[field], `${relative}:${field}`)
      }
      for (const field of ['icon', 'image']) {
        if (Object.hasOwn(metadata, field)) textValue(metadata[field], `${relative}:${field}`)
      }
      if (kind === 'constraint' || kind === 'aspect') {
        if (Object.hasOwn(metadata, 'scope') === Object.hasOwn(metadata, 'applies-to')) {
          throw new ToolError('invalid-applicability', 'Specify either applies-to or scope', relative)
        }
        if (Object.hasOwn(metadata, 'scope')) textValue(metadata.scope, relative)
        else stringList(metadata['applies-to'], relative, 1)
      }
      if (kind === 'collaboration') stringList(metadata.participants, relative, 2)
      records.set(artifactId, {
        path: relative,
        'body-line': header[0].split('\n').length,
        title: documentTitle(content.slice(header[0].length), relative),
        metadata,
      })
    }
  }
  for (const record of records.values()) {
    for (const field of ['uses', 'composes', 'applies-to', 'participants']) {
      for (const target of record.metadata[field] ?? []) {
        if (!records.has(target) || records.get(target).metadata.kind !== 'spark') {
          throw new ToolError('invalid-reference', `${field} must reference a Spark: ${target}`, record.path)
        }
      }
    }
  }
  const graph = new Map([...records].map(([name, record]) => [name, record.metadata.composes ?? []]))
  dependencyOrder(graph, undefined, 'composes')
  return new Map([...records.keys()].sort().map(name => [name, records.get(name)]))
}

function implementationGraph(config) {
  return new Map(Object.entries(config.implementations).map(([name, entry]) => [name, entry['depends-on'] ?? []]))
}

export function loadConfig(root) {
  const filename = projectPath(root, CONFIG_PATH, CONFIG_PATH, true)
  const config = parseYaml(readText(filename), CONFIG_PATH)
  objectFields(config, ['schema-version', 'implementations', 'bindings'], [], CONFIG_PATH)
  schemaVersion(config['schema-version'], CONFIG_PATH)
  objectFields(config.implementations, [], Object.keys(config.implementations ?? {}), CONFIG_PATH)
  for (const [name, entry] of Object.entries(config.implementations)) {
    const location = `${CONFIG_PATH}:implementations.${name}`
    identifier(name, location)
    objectFields(entry, ['source-root'], ['stack', 'depends-on', 'guidance', 'guidance-file'], location)
    const outputRoot = projectPath(root, entry['source-root'], location)
    if (fs.existsSync(outputRoot) && !fs.statSync(outputRoot).isDirectory()) {
      throw new ToolError('invalid-directory', 'source-root must be a directory', location)
    }
    if (Object.hasOwn(entry, 'guidance') && Object.hasOwn(entry, 'guidance-file')) {
      throw new ToolError('guidance-conflict', 'Use guidance or guidance-file, not both', location)
    }
    for (const field of ['stack', 'guidance']) {
      if (Object.hasOwn(entry, field)) textValue(entry[field], `${location}.${field}`)
    }
    if (Object.hasOwn(entry, 'guidance-file')) {
      textValue(readText(projectPath(root, entry['guidance-file'], location, true)), location)
    }
    for (const target of stringList(optionalList(entry, 'depends-on'), location)) {
      if (!Object.hasOwn(config.implementations, target)) {
        throw new ToolError('unknown-dependency', `Unknown implementation: ${target}`, location)
      }
      if (target === name) {
        throw new ToolError('dependency-cycle', 'An implementation cannot depend on itself', location)
      }
    }
  }
  dependencyOrder(implementationGraph(config), undefined, 'depends-on')
  if (!Array.isArray(config.bindings)) {
    throw new ToolError('invalid-list', 'bindings must be a list', CONFIG_PATH)
  }
  const bindingIds = new Set()
  for (const [index, binding] of config.bindings.entries()) {
    const location = `${CONFIG_PATH}:bindings[${index}]`
    objectFields(binding, ['implementation', 'match'], ['id'], location)
    textValue(binding.implementation, location)
    if (!Object.hasOwn(config.implementations, binding.implementation)) {
      throw new ToolError('unknown-implementation', `Unknown implementation: ${binding.implementation}`, location)
    }
    if (Object.hasOwn(binding, 'id')) {
      identifier(binding.id, location)
      if (bindingIds.has(binding.id)) {
        throw new ToolError('duplicate-binding-id', `Binding ID already exists: ${binding.id}`, location)
      }
      bindingIds.add(binding.id)
    }
    if (!Array.isArray(binding.match) || !binding.match.length) {
      throw new ToolError('invalid-match', 'match must be a non-empty list', location)
    }
    for (const selector of binding.match) {
      objectFields(selector, [], ['id', 'spark-type', 'id-pattern'], location)
      if (!Object.keys(selector).length) {
        throw new ToolError('invalid-match', 'A selector must not be empty', location)
      }
      for (const [field, value] of Object.entries(selector)) {
        textValue(value, location)
        if (field === 'id') identifier(value, location)
        if (field === 'spark-type' && !SPARK_TYPES.has(value)) {
          throw new ToolError('invalid-spark-type', 'Unsupported spark-type selector', location)
        }
      }
    }
  }
  return config
}

export function selectorMatches(selector, metadata) {
  return Object.entries(selector).every(([field, value]) => {
    if (field !== 'id-pattern') return metadata[field] === value
    const pattern = [...value].map(character => {
      if (character === '*') return '.*'
      if (character === '?') return '.'
      return character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }).join('')
    const match = metadata.id.match(new RegExp(`^(?:${pattern})$`, 'u'))
    return match !== null && match[0] === metadata.id
  })
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function bindingPairs(config, records, bindingIds = []) {
  const pairs = new Map()
  for (const [index, binding] of config.bindings.entries()) {
    if (bindingIds.length && !bindingIds.includes(binding.id)) continue
    const reference = binding.id ?? `/bindings/${index}`
    for (const [artifactId, record] of records) {
      if (record.metadata.kind !== 'spark') continue
      if (!binding.match.some(selector => selectorMatches(selector, record.metadata))) continue
      const key = `${artifactId}/${binding.implementation}`
      if (!pairs.has(key)) {
        pairs.set(key, {
          spark: artifactId,
          implementation: binding.implementation,
          path: record.path,
          bindings: [],
        })
      }
      pairs.get(key).bindings.push(reference)
    }
  }
  return [...pairs.values()].sort((left, right) => (
    compareText(left.spark, right.spark) || compareText(left.implementation, right.implementation)
  ))
}

function sparkClosure(records, seeds, fields) {
  const found = new Set()
  const pending = [...seeds]
  while (pending.length) {
    const current = pending.pop()
    if (found.has(current)) continue
    found.add(current)
    for (const field of fields) pending.push(...(records.get(current).metadata[field] ?? []))
  }
  return found
}

function modelContext(records, selected) {
  let related = sparkClosure(records, selected, ['uses', 'composes'])
  const collaborations = new Map()
  while (true) {
    const previousSize = related.size
    for (const [artifactId, record] of records) {
      if (record.metadata.kind === 'collaboration' && record.metadata.participants.some(name => related.has(name))) {
        collaborations.set(artifactId, record)
        record.metadata.participants.forEach(name => related.add(name))
      }
    }
    related = sparkClosure(records, related, ['uses', 'composes'])
    if (related.size === previousSize) break
  }
  const context = {
    sparks: [...related].filter(name => !selected.has(name)).sort().map(name => records.get(name)),
    incoming: [],
    'explicit-rules': [],
    collaborations: [...collaborations.keys()].sort().map(name => collaborations.get(name)),
    'pending-scopes': [],
  }
  for (const [artifactId, record] of records) {
    const metadata = record.metadata
    if (metadata.kind === 'constraint' || metadata.kind === 'aspect') {
      if (Object.hasOwn(metadata, 'scope')) context['pending-scopes'].push(record)
      else {
        const targets = metadata['applies-to'].filter(name => related.has(name)).sort()
        if (targets.length) context['explicit-rules'].push({ artifact: record, 'targets-in-context': targets })
      }
    }
    if (metadata.kind === 'spark') {
      for (const field of ['uses', 'composes']) {
        for (const target of (metadata[field] ?? []).filter(name => related.has(name)).sort()) {
          context.incoming.push({ source: artifactId, path: record.path, relation: field, target })
        }
      }
    }
  }
  return { related, context }
}

export function resolveSelection(records, config, {
  sparks = [], implementations = [], bindings = [], includeComposed = false, all = false,
} = {}) {
  if (!sparks.length && !implementations.length && !bindings.length && !all) {
    throw new ToolError('selection-required', 'Select --spark, --implementation, --binding, or --all')
  }
  if (all && (sparks.length || implementations.length || bindings.length || includeComposed)) {
    throw new ToolError('invalid-selection', '--all cannot be combined with other selection options')
  }
  if (includeComposed && !sparks.length) {
    throw new ToolError('invalid-selection', '--include-composed requires --spark')
  }
  const availableSparks = [...records].filter(([, record]) => record.metadata.kind === 'spark').map(([name]) => name)
  const availableBindings = config.bindings.filter(binding => Object.hasOwn(binding, 'id')).map(binding => binding.id)
  for (const [requested, available, label] of [
    [sparks, availableSparks, 'spark'],
    [implementations, Object.keys(config.implementations), 'implementation'],
    [bindings, availableBindings, 'binding'],
  ]) {
    const missing = [...new Set(requested)].filter(name => !available.includes(name))
    if (missing.length) {
      throw new ToolError('unknown-selection', `Unknown ${label} IDs: ${missing.sort().join(', ')}`)
    }
  }
  let pairs = bindingPairs(config, records, bindings)
  if (implementations.length) pairs = pairs.filter(pair => implementations.includes(pair.implementation))
  let requestedSparks
  if (sparks.length) {
    requestedSparks = includeComposed ? sparkClosure(records, sparks, ['composes']) : new Set(sparks)
    pairs = pairs.filter(pair => requestedSparks.has(pair.spark))
  } else requestedSparks = new Set(all ? availableSparks : pairs.map(pair => pair.spark))
  const selectedSparks = new Set(pairs.map(pair => pair.spark))
  const { related, context } = modelContext(records, new Set([...requestedSparks, ...selectedSparks]))
  const graph = implementationGraph(config)
  const order = dependencyOrder(graph, [...new Set(pairs.map(pair => pair.implementation))], 'depends-on')
  const allPairs = bindingPairs(config, records)
  const prerequisites = []
  for (const name of order) {
    const consumers = order.filter(consumer => graph.get(consumer).includes(name)).sort()
    if (consumers.length) {
      prerequisites.push({
        implementation: name,
        'required-by': consumers,
        'requires-selection-review': true,
        candidates: allPairs.filter(pair => pair.implementation === name).map(pair => ({
          ...pair, 'in-model-context': related.has(pair.spark),
        })),
      })
    }
  }
  return {
    selected: pairs,
    'unbound-sparks': [...requestedSparks].filter(name => !selectedSparks.has(name)).sort(),
    'empty-selection': pairs.length === 0,
    context,
    'implementation-order': order,
    implementations: Object.fromEntries(order.map(name => [name, config.implementations[name]])),
    prerequisites,
  }
}

export function mapPath(root, implementation) {
  identifier(implementation, 'implementation-id')
  return projectPath(root, `${MAP_DIRECTORY}/${implementation}.yaml`, 'implementation-map')
}

function normalizeMap(root, implementation, data) {
  const location = `${MAP_DIRECTORY}/${implementation}.yaml`
  objectFields(data, ['schema-version', 'implementation-id', 'artifacts'], [], location)
  schemaVersion(data['schema-version'], location)
  if (data['implementation-id'] !== implementation) {
    throw new ToolError('map-identity', 'implementation-id must match the map filename', location)
  }
  if (!Array.isArray(data.artifacts)) {
    throw new ToolError('invalid-list', 'artifacts must be a list', location)
  }
  const outputs = new Map()
  for (const entry of data.artifacts) {
    objectFields(entry, ['path', 'derived-from'], [], location)
    const output = projectPath(root, entry.path, location)
    const relative = relativePath(root, output)
    if (outputs.has(relative)) {
      throw new ToolError('duplicate-output', `Repeated output path: ${relative}`, location)
    }
    const sources = stringList(entry['derived-from'], location, 1)
    sources.forEach(source => identifier(source, location))
    outputs.set(relative, { path: relative, 'derived-from': [...sources].sort() })
  }
  return {
    'schema-version': 1,
    'implementation-id': implementation,
    artifacts: [...outputs.keys()].sort().map(filename => outputs.get(filename)),
  }
}

export function readMap(root, implementation) {
  const filename = mapPath(root, implementation)
  if (!fileState(filename)) {
    return { map: { 'schema-version': 1, 'implementation-id': implementation, artifacts: [] }, snapshot: null }
  }
  if (!fs.statSync(filename).isFile()) {
    throw new ToolError('invalid-map', 'Map path must be a file', filename)
  }
  const snapshot = fs.readFileSync(filename)
  let text
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(snapshot)
  } catch {
    throw new ToolError('unreadable-file', 'Map must be UTF-8 text', filename)
  }
  return { map: normalizeMap(root, implementation, parseYaml(text, filename)), snapshot }
}

function mapDiagnostics(root, implementation, data, config, records) {
  const errors = []
  const location = `${MAP_DIRECTORY}/${implementation}.yaml`
  let sourceRoot = null
  if (!Object.hasOwn(config.implementations, implementation)) {
    errors.push(new ToolError('unknown-implementation', `Unregistered map implementation: ${implementation}`, location).diagnostic())
  } else {
    sourceRoot = resolvedPath(projectPath(root, config.implementations[implementation]['source-root'], location))
  }
  for (const output of data.artifacts) {
    const filename = projectPath(root, output.path, location)
    if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
      errors.push(new ToolError('missing-output', `Output file does not exist: ${output.path}`, location).diagnostic())
    }
    if (sourceRoot !== null && !within(sourceRoot, resolvedPath(filename))) {
      errors.push(new ToolError('outside-source-root', `Output is outside source-root: ${output.path}`, location).diagnostic())
    }
    const missing = output['derived-from'].filter(source => !records.has(source)).sort()
    if (missing.length) {
      errors.push(new ToolError('unknown-source', `Unknown model IDs: ${missing.join(', ')}`, output.path).diagnostic())
    }
  }
  return errors
}

export function inspectMaps(root, config, records, implementation, sources = []) {
  const names = new Set()
  if (implementation !== undefined) names.add(identifier(implementation, 'implementation-id'))
  else {
    Object.keys(config.implementations).forEach(name => names.add(name))
    const directory = projectPath(root, MAP_DIRECTORY, MAP_DIRECTORY)
    if (fs.existsSync(directory)) {
      if (!fs.statSync(directory).isDirectory()) {
        throw new ToolError('invalid-directory', 'Map location must be a directory', MAP_DIRECTORY)
      }
      for (const name of fs.readdirSync(directory)) {
        if (name.endsWith('.yaml')) names.add(name.slice(0, -5))
      }
    }
  }
  const results = []
  const errors = []
  for (const name of [...names].sort()) {
    const { map, snapshot } = readMap(root, name)
    errors.push(...mapDiagnostics(root, name, map, config, records))
    const filtered = map.artifacts.filter(entry => !sources.length || sources.some(source => entry['derived-from'].includes(source)))
    if (!sources.length || filtered.length) {
      results.push({
        path: `${MAP_DIRECTORY}/${name}.yaml`,
        exists: snapshot !== null,
        map: { ...map, artifacts: filtered },
      })
    }
  }
  return { maps: results, filtered: sources.length > 0, errors }
}

function mergeMap(root, implementation, current, changes) {
  objectFields(changes, [], ['upsert', 'remove'], 'map changes')
  if (!Object.keys(changes).length) {
    throw new ToolError('invalid-changes', 'Specify upsert and/or remove', 'map changes')
  }
  const replacements = normalizeMap(root, implementation, {
    'schema-version': 1,
    'implementation-id': implementation,
    artifacts: optionalList(changes, 'upsert'),
  })
  const removals = new Set(stringList(optionalList(changes, 'remove'), 'remove').map(name => (
    relativePath(root, projectPath(root, name, 'remove'))
  )))
  if (replacements.artifacts.some(entry => removals.has(entry.path))) {
    throw new ToolError('conflicting-changes', 'A path cannot appear in both upsert and remove')
  }
  const outputs = new Map(current.artifacts.filter(entry => !removals.has(entry.path)).map(entry => [entry.path, entry]))
  for (const entry of replacements.artifacts) outputs.set(entry.path, entry)
  return { ...current, artifacts: [...outputs.keys()].sort().map(filename => outputs.get(filename)) }
}

function removeTemporary(filename) {
  try {
    fs.unlinkSync(filename)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

export function updateMap(root, config, records, implementation, changes, write = false) {
  if (!Object.hasOwn(config.implementations, implementation)) {
    throw new ToolError('unknown-implementation', `Unknown implementation: ${implementation}`)
  }
  const filename = mapPath(root, implementation)
  function prepare() {
    const { map: current, snapshot } = readMap(root, implementation)
    const updated = mergeMap(root, implementation, current, changes)
    const diagnostics = mapDiagnostics(root, implementation, updated, config, records)
    if (diagnostics.length) {
      const first = diagnostics[0]
      throw new ToolError(first.code, first.message, first.location)
    }
    return { map: updated, snapshot, changed: !isDeepStrictEqual(current, updated) || snapshot === null }
  }
  let prepared = prepare()
  const result = { path: relativePath(root, filename), map: prepared.map, changed: prepared.changed, written: false }
  if (!write) return result
  if (fileState(filename)?.isSymbolicLink()) {
    throw new ToolError('unsafe-path', 'Map writes do not replace symlinks', filename)
  }
  fs.mkdirSync(path.dirname(filename), { recursive: true })
  const lockPath = filename + '.lock'
  let lock
  try {
    lock = fs.openSync(lockPath, 'wx', 0o600)
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new ToolError('map-busy', 'Another map update holds the lock; no changes were written', lockPath)
    }
    throw error
  }
  let temporaryPath = null
  try {
    prepared = prepare()
    Object.assign(result, { map: prepared.map, changed: prepared.changed })
    if (!prepared.changed) return result
    const temporary = path.join(path.dirname(filename), `.${implementation}-${randomUUID()}.tmp`)
    const descriptor = fs.openSync(temporary, 'wx', 0o600)
    temporaryPath = temporary
    try {
      fs.writeFileSync(descriptor, stringify(prepared.map), 'utf8')
      fs.fsyncSync(descriptor)
    } finally {
      fs.closeSync(descriptor)
    }
    const latestState = fileState(filename)
    if (latestState && !latestState.isFile()) {
      throw new ToolError('map-changed', 'Map changed during the update; no replacement was written', filename)
    }
    const latest = latestState ? fs.readFileSync(filename) : null
    if (!isDeepStrictEqual(latest, prepared.snapshot)) {
      throw new ToolError('map-changed', 'Map changed during the update; no replacement was written', filename)
    }
    fs.chmodSync(temporaryPath, latestState ? latestState.mode & 0o777 : 0o644)
    fs.renameSync(temporaryPath, filename)
    result.written = true
    return result
  } finally {
    try {
      if (temporaryPath !== null) removeTemporary(temporaryPath)
    } finally {
      fs.closeSync(lock)
      removeTemporary(lockPath)
    }
  }
}

function readChanges(root, source, input) {
  const text = source === '-' ? input() : readText(projectPath(root, source, source, true))
  try {
    const result = JSON.parse(text)
    parseYaml(text, source)
    return result
  } catch (error) {
    throw new ToolError('invalid-json', error.message, source)
  }
}

const COMMAND_OPTIONS = {
  inventory: [],
  check: [],
  resolve: ['spark', 'implementation', 'binding', 'include-composed', 'all'],
  'map show': ['implementation', 'source'],
  'map check': ['implementation'],
  'map update': ['implementation', 'changes', 'write'],
}

function argumentsFor(argv) {
  let parsed
  try {
    parsed = parseArgs({ args: argv, allowPositionals: true, options: {
      root: { type: 'string', default: '.' },
      help: { type: 'boolean', short: 'h' },
      spark: { type: 'string', multiple: true },
      implementation: { type: 'string', multiple: true },
      binding: { type: 'string', multiple: true },
      'include-composed': { type: 'boolean' },
      all: { type: 'boolean' },
      source: { type: 'string', multiple: true },
      changes: { type: 'string' },
      write: { type: 'boolean' },
    } })
  } catch (error) {
    throw new ToolError('arguments', error.message)
  }
  const command = parsed.positionals.join(' ')
  if (!parsed.values.help) {
    if (!Object.hasOwn(COMMAND_OPTIONS, command)) {
      throw new ToolError('arguments', 'Expected inventory, check, resolve, map show, map check, or map update')
    }
    for (const name of Object.keys(parsed.values)) {
      if (!['root', 'help', ...COMMAND_OPTIONS[command]].includes(name)) {
        throw new ToolError('arguments', `--${name} is not valid for ${command}`)
      }
    }
    if (command.startsWith('map ') && (parsed.values.implementation?.length ?? 0) > 1) {
      throw new ToolError('arguments', 'Map commands accept one --implementation')
    }
    if (command === 'map update' && (!parsed.values.implementation?.length || parsed.values.changes === undefined)) {
      throw new ToolError('arguments', 'map update requires --implementation and --changes')
    }
  }
  return { command, values: parsed.values }
}

function helpText() {
  return `Usage: node sparkwell.js [--root PROJECT] COMMAND [options]

Commands:
  inventory   Read and validate Artifact metadata without requiring configuration
  check       Validate configuration, Artifact metadata, and existing maps
  resolve     Resolve an explicit selection without generating or writing files
  map show    Show maps, optionally filtered by implementation or source Artifact
  map check   Validate maps, output files, and source references
  map update  Preview targeted map changes; --write saves them without changing code

Resolve options:
  --spark ID              Select a Spark (repeatable)
  --implementation ID     Filter implementations (repeatable)
  --binding ID            Filter named bindings (repeatable)
  --include-composed      Include composed descendants of --spark IDs
  --all                   Select all configured pairs; no other filters allowed

Map options:
  --implementation ID     One implementation; required for map update
  --source ID             Source Artifact filter for map show (repeatable)
  --changes PATH          Map update JSON file relative to project, or - for stdin
  --write                 Explicitly persist map update (default is preview only)

Values of one filter use OR; different filters intersect. --help shows this text.
`
}

export function main(argv = process.argv.slice(2), {
  output = text => process.stdout.write(text), input = () => fs.readFileSync(0, 'utf8'),
} = {}) {
  try {
    if (Number(process.versions.node.split('.')[0]) < 24) {
      throw new ToolError('unsupported-node', 'Node.js 24 or later is required')
    }
    const { command, values } = argumentsFor(argv)
    if (values.help) {
      output(helpText())
      return 0
    }
    const requestedRoot = path.resolve(values.root)
    if (!fs.existsSync(requestedRoot) || !fs.statSync(requestedRoot).isDirectory()) {
      throw new ToolError('invalid-root', 'Project root must be an existing directory', requestedRoot)
    }
    const root = fs.realpathSync(requestedRoot)
    const records = loadArtifacts(root)
    let result
    if (command === 'inventory') result = { artifacts: [...records.values()] }
    else {
      const config = loadConfig(root)
      if (command === 'resolve') {
        result = resolveSelection(records, config, {
          sparks: values.spark, implementations: values.implementation, bindings: values.binding,
          includeComposed: values['include-composed'], all: values.all,
        })
      } else if (command.startsWith('map ')) {
        const implementation = values.implementation?.[0]
        if (command === 'map update') {
          result = updateMap(root, config, records, implementation, readChanges(root, values.changes, input), values.write)
        } else {
          result = inspectMaps(root, config, records, implementation, values.source)
        }
      } else {
        const mapResult = inspectMaps(root, config, records)
        result = {
          'artifact-count': records.size,
          'implementation-ids': Object.keys(config.implementations).sort(),
          'binding-count': config.bindings.length,
          'matched-pair-count': bindingPairs(config, records).length,
          'map-count': mapResult.maps.filter(entry => entry.exists).length,
          errors: mapResult.errors,
        }
      }
    }
    const valid = !result.errors?.length
    output(JSON.stringify({ ok: valid, ...result }, null, 2) + '\n')
    return valid ? 0 : 1
  } catch (error) {
    const diagnostic = error instanceof ToolError ? error.diagnostic() : { code: 'io-error', message: error.message }
    output(JSON.stringify({ ok: false, errors: [diagnostic] }, null, 2) + '\n')
    return 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main()
}