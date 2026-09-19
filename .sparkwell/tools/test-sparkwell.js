import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { stringify } from 'yaml'
import * as tools from './sparkwell.js'

function project(context) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sparkwell-tools-')))
  context.after(() => fs.rmSync(root, { recursive: true, force: true }))
  return {
    root,
    write(relative, text) {
      const filename = path.join(root, relative)
      fs.mkdirSync(path.dirname(filename), { recursive: true })
      fs.writeFileSync(filename, text)
      return filename
    },
    artifact(id, fields = {}, directory) {
      const kind = fields.kind ?? 'spark'
      const metadata = { id, description: `Describes ${id}.`, kind, ...fields }
      return this.write(
        `artifacts/${directory ?? tools.KINDS[kind]}/${id}.md`,
        `---\n${stringify(metadata)}---\n\n# ${id}\n`,
      )
    },
    config(config = { 'schema-version': 1, implementations: {}, bindings: [] }) {
      this.write(tools.CONFIG_PATH, stringify(config))
      return config
    },
    model() {
      this.artifact('todo-item', { 'spark-type': 'data' })
      this.artifact('todo-service', { 'spark-type': 'api-service', uses: ['todo-item'] })
      this.artifact('other-service', { 'spark-type': 'api-service', uses: ['todo-item'] })
      this.artifact('todo-editor', { uses: ['todo-item'] })
      this.artifact('todo-app', { composes: ['todo-editor'], uses: ['todo-service'] })
    },
    cli(argumentsList, input = '') {
      let output = ''
      const exitCode = tools.main(['--root', root, ...argumentsList], {
        output: text => { output += text },
        input: () => input,
      })
      return { exitCode, result: JSON.parse(output) }
    },
  }
}

function configuration() {
  return {
    'schema-version': 1,
    implementations: {
      contract: { 'source-root': 'src/contracts', stack: 'openapi' },
      server: { 'source-root': 'src/server', 'depends-on': ['contract'] },
      client: { 'source-root': 'src/web/client', 'depends-on': ['contract'] },
      ui: { 'source-root': 'src/web', 'depends-on': ['client'] },
    },
    bindings: [
      { id: 'clients', implementation: 'client', match: [{ id: 'todo-service' }] },
      { implementation: 'contract', match: [{ 'spark-type': 'api-service' }] },
      { implementation: 'server', match: [{ 'spark-type': 'api-service' }] },
      { implementation: 'ui', match: [{ id: 'todo-app' }, { id: 'todo-editor' }] },
    ],
  }
}

function errorCode(code, operation) {
  assert.throws(operation, error => error instanceof tools.ToolError && error.code === code)
}

test('YAML rejects duplicate keys at any depth', () => {
  for (const source of ['value: 1\nvalue: 2', 'outer:\n  value: 1\n  value: 2']) {
    errorCode('invalid-yaml', () => tools.parseYaml(source, 'test'))
  }
})

test('YAML rejects unsafe tags and non-string mapping keys', () => {
  for (const source of ['42: value', '!!python/object:example {}']) {
    errorCode('invalid-yaml', () => tools.parseYaml(source, 'test'))
  }
})

test('model discovery reads nested and untracked Artifacts without an index', context => {
  const fixture = project(context)
  fixture.artifact('item', { 'spark-type': 'data' }, 'sparks/nested')
  fixture.write('artifacts/index.md', 'Not authoritative\n')
  const record = tools.loadArtifacts(fixture.root).get('item')
  assert.equal(record.path, 'artifacts/sparks/nested/item.md')
  assert.equal(Object.hasOwn(record, 'body'), false)
})

test('all four Artifact kinds and optional Spark types are supported', context => {
  const fixture = project(context)
  fixture.model()
  fixture.artifact('rule', { kind: 'constraint', 'applies-to': ['todo-item'] })
  fixture.artifact('quality', { kind: 'aspect', scope: 'All editing interfaces' })
  fixture.artifact('saving', { kind: 'collaboration', participants: ['todo-app', 'todo-service'] })
  fixture.artifact('untyped')
  assert.equal(tools.loadArtifacts(fixture.root).size, 9)
})

test('uses cycles are allowed', context => {
  const fixture = project(context)
  fixture.artifact('first', { uses: ['second'] })
  fixture.artifact('second', { uses: ['first'] })
  assert.equal(tools.loadArtifacts(fixture.root).size, 2)
})

test('composition cycles are rejected', context => {
  const fixture = project(context)
  fixture.artifact('first', { composes: ['second'] })
  fixture.artifact('second', { composes: ['first'] })
  errorCode('dependency-cycle', () => tools.loadArtifacts(fixture.root))
})

test('missing and wrong-kind references are diagnosed', context => {
  const fixture = project(context)
  fixture.artifact('item', { uses: ['missing'] })
  errorCode('invalid-reference', () => tools.loadArtifacts(fixture.root))
  fixture.artifact('missing', { kind: 'constraint', scope: 'All items' })
  errorCode('invalid-reference', () => tools.loadArtifacts(fixture.root))
})

test('duplicate Artifact IDs are rejected', context => {
  const fixture = project(context)
  fixture.artifact('item')
  fixture.artifact('item', {}, 'sparks/nested')
  errorCode('duplicate-id', () => tools.loadArtifacts(fixture.root))
})

test('kind-specific metadata and applicability rules are checked', context => {
  const fixture = project(context)
  fixture.artifact('rule', { kind: 'constraint', scope: 'All items', 'spark-type': 'data' })
  errorCode('invalid-fields', () => tools.loadArtifacts(fixture.root))
  fixture.artifact('rule', { kind: 'constraint', scope: 'All items', 'applies-to': ['rule'] })
  errorCode('invalid-applicability', () => tools.loadArtifacts(fixture.root))
})

test('non-string spark-type produces a diagnostic', context => {
  const fixture = project(context)
  fixture.artifact('item', { 'spark-type': [] })
  errorCode('invalid-string', () => tools.loadArtifacts(fixture.root))
})

test('Spark type vocabulary accepts data, api-service, and ordinary untyped Sparks', context => {
  const fixture = project(context)
  fixture.artifact('item', { 'spark-type': 'data' })
  fixture.artifact('catalog', { 'spark-type': 'api-service', uses: ['item'] })
  fixture.artifact('app', { role: 'root', uses: ['catalog'] })
  const records = tools.loadArtifacts(fixture.root)
  assert.equal(records.get('item').metadata['spark-type'], 'data')
  assert.equal(records.get('catalog').metadata['spark-type'], 'api-service')
  assert.equal(Object.hasOwn(records.get('app').metadata, 'spark-type'), false)

  fixture.config({
    'schema-version': 1,
    implementations: { web: { 'source-root': 'src/web' } },
    bindings: [
      { id: 'data', implementation: 'web', match: [{ 'spark-type': 'data' }] },
      { id: 'services', implementation: 'web', match: [{ 'spark-type': 'api-service' }] },
      { id: 'app', implementation: 'web', match: [{ id: 'app' }] },
    ],
  })
  for (const [binding, spark] of [['data', 'item'], ['services', 'catalog'], ['app', 'app']]) {
    const resolved = fixture.cli(['resolve', '--binding', binding])
    assert.equal(resolved.exitCode, 0)
    assert.deepEqual(resolved.result.selected.map(pair => pair.spark), [spark])
  }
})

test('Spark type vocabulary rejects retired and unsupported metadata values', context => {
  const fixture = project(context)
  for (const sparkType of ['ui', 'logic', 'service', 'rest-service', 'api-client']) {
    fixture.artifact('item', { 'spark-type': sparkType })
    errorCode('invalid-spark-type', () => tools.loadArtifacts(fixture.root))
  }
})

test('Spark type vocabulary rejects retired and unsupported binding selectors', context => {
  const fixture = project(context)
  for (const sparkType of ['ui', 'logic', 'service', 'rest-service', 'api-client']) {
    fixture.config({
      'schema-version': 1,
      implementations: { web: { 'source-root': 'src/web' } },
      bindings: [{ implementation: 'web', match: [{ 'spark-type': sparkType }] }],
    })
    errorCode('invalid-spark-type', () => tools.loadConfig(fixture.root))
  }
})

test('title validation ignores fences and rejects concatenated documents', context => {
  const fixture = project(context)
  const filename = fixture.artifact('item')
  fs.appendFileSync(filename, '\n```markdown\n# Example\n```\n')
  assert.equal(tools.loadArtifacts(fixture.root).size, 1)
  fs.appendFileSync(filename, '\n# Duplicate Document\n')
  errorCode('invalid-markdown', () => tools.loadArtifacts(fixture.root))
})

test('absolute paths, traversal, and drive paths are rejected', context => {
  const fixture = project(context)
  for (const value of ['../outside', '/outside', 'C:/outside', 'src\\file', 'src/../../outside']) {
    errorCode('unsafe-path', () => tools.projectPath(fixture.root, value, 'test'))
  }
})

test('symlink escapes and dangling links are rejected', context => {
  const fixture = project(context)
  const outside = project(context)
  fs.symlinkSync(outside.root, path.join(fixture.root, 'escape'), 'dir')
  errorCode('unsafe-path', () => tools.projectPath(fixture.root, 'escape/new.txt', 'test'))
  fs.symlinkSync(path.join(fixture.root, 'missing'), path.join(fixture.root, 'dangling'))
  errorCode('unsafe-path', () => tools.projectPath(fixture.root, 'dangling', 'test'))
})

test('empty configuration is valid', context => {
  const fixture = project(context)
  const config = fixture.config()
  assert.deepEqual(tools.loadConfig(fixture.root), config)
})

test('new source roots and optional config fields are supported', context => {
  const fixture = project(context)
  const config = fixture.config(configuration())
  assert.deepEqual(tools.loadConfig(fixture.root), config)
})

test('configuration validates field types, optional nulls, and selectors', context => {
  const fixture = project(context)
  const cases = [
    [config => { config.unexpected = true }, 'invalid-fields'],
    [config => { config['schema-version'] = true }, 'unsupported-version'],
    [config => { config.implementations.client['depends-on'] = null }, 'invalid-list'],
    [config => { config.bindings[0].match = [] }, 'invalid-match'],
    [config => { config.bindings[0].match = [{}] }, 'invalid-match'],
    [config => { config.bindings[0].match = [{ 'spark-type': 'state' }] }, 'invalid-spark-type'],
  ]
  for (const [mutate, code] of cases) {
    const config = configuration()
    mutate(config)
    fixture.config(config)
    errorCode(code, () => tools.loadConfig(fixture.root))
  }
})

test('binding IDs are unique and not dependency IDs', context => {
  const fixture = project(context)
  const config = configuration()
  config.bindings.push(structuredClone(config.bindings[0]))
  fixture.config(config)
  errorCode('duplicate-binding-id', () => tools.loadConfig(fixture.root))
  config.bindings.pop()
  config.implementations.ui['depends-on'] = ['clients']
  fixture.config(config)
  errorCode('unknown-dependency', () => tools.loadConfig(fixture.root))
})

test('dependency order includes prerequisites only and rejects cycles', context => {
  const fixture = project(context)
  const config = configuration()
  const graph = new Map(Object.entries(config.implementations).map(([name, entry]) => [name, entry['depends-on'] ?? []]))
  assert.deepEqual(tools.dependencyOrder(graph, ['ui']), ['contract', 'client', 'ui'])
  config.implementations.contract['depends-on'] = ['ui']
  fixture.config(config)
  errorCode('dependency-cycle', () => tools.loadConfig(fixture.root))
})

test('guidance files must be readable and exclusive with inline guidance', context => {
  const fixture = project(context)
  const config = configuration()
  config.implementations.ui['guidance-file'] = 'docs/ui.md'
  fixture.config(config)
  errorCode('missing-file', () => tools.loadConfig(fixture.root))
  fixture.write('docs/ui.md', 'Use existing UI conventions.\n')
  assert.deepEqual(tools.loadConfig(fixture.root), config)
  config.implementations.ui.guidance = 'Other instructions'
  fixture.config(config)
  errorCode('guidance-conflict', () => tools.loadConfig(fixture.root))
})

test('QA configuration accepts optional defaults and independent guidance', context => {
  const fixture = project(context)
  const config = configuration()
  config.implementations.ui.qa = true
  config.implementations.ui['guidance-file'] = 'docs/ui.md'
  config.implementations.ui['qa-guidance'] = 'Use the desktop browser and disposable test data.'
  config.implementations.server.qa = false
  config.implementations.client.guidance = 'Reuse the contract.'
  config.implementations.client['qa-guidance-file'] = 'docs/client-qa.md'
  fixture.write('docs/ui.md', 'Use existing UI conventions.\n')
  fixture.write('docs/client-qa.md', 'Use the existing service inspection tool.\n')
  fixture.config(config)
  assert.deepEqual(tools.loadConfig(fixture.root), config)
})

test('QA configuration rejects non-booleans and invalid guidance values', context => {
  const fixture = project(context)
  for (const value of ['true', 'false', 'enable', 0, 1, null, [], {}]) {
    const config = configuration()
    config.implementations.ui.qa = value
    fixture.config(config)
    errorCode('invalid-boolean', () => tools.loadConfig(fixture.root))
  }
  for (const field of ['qa-guidance', 'qa-guidance-file']) {
    for (const value of ['', '  ', null, 1, [], {}]) {
      const config = configuration()
      config.implementations.ui[field] = value
      fixture.config(config)
      errorCode('invalid-string', () => tools.loadConfig(fixture.root))
    }
  }
})

test('QA guidance files must be readable, non-empty, and exclusive', context => {
  const fixture = project(context)
  const config = configuration()
  config.implementations.ui['qa-guidance-file'] = 'docs/qa.md'
  fixture.config(config)
  errorCode('missing-file', () => tools.loadConfig(fixture.root))
  fixture.write('docs/qa.md', ' \n')
  errorCode('invalid-string', () => tools.loadConfig(fixture.root))
  fixture.write('docs/qa.md', 'Use a disposable environment.\n')
  assert.deepEqual(tools.loadConfig(fixture.root), config)
  config.implementations.ui['qa-guidance'] = 'Other QA instructions'
  fixture.config(config)
  errorCode('qa-guidance-conflict', () => tools.loadConfig(fixture.root))
})

test('QA guidance paths cannot escape the project', context => {
  const fixture = project(context)
  const outside = project(context)
  fs.symlinkSync(outside.root, path.join(fixture.root, 'outside'), 'dir')
  outside.write('qa.md', 'External guidance.\n')
  for (const value of ['../qa.md', '/qa.md', 'C:/qa.md', 'docs\\qa.md', 'outside/qa.md']) {
    const config = configuration()
    config.implementations.ui['qa-guidance-file'] = value
    fixture.config(config)
    errorCode('unsafe-path', () => tools.loadConfig(fixture.root))
  }
})

test('CLI emits JSON errors without creating missing files', context => {
  const fixture = project(context)
  const missing = fixture.cli(['check'])
  assert.equal(missing.exitCode, 1)
  assert.equal(missing.result.errors[0].code, 'missing-file')
  assert.equal(fixture.cli(['not-a-command']).result.errors[0].code, 'arguments')
  assert.equal(fixture.cli(['inventory', '--binding', 'clients']).result.errors[0].code, 'arguments')
  assert.deepEqual(fs.readdirSync(fixture.root), [])
})

test('inventory CLI works without project configuration', context => {
  const fixture = project(context)
  fixture.artifact('item', { 'spark-type': 'data' })
  const { exitCode, result } = fixture.cli(['inventory'])
  assert.equal(exitCode, 0)
  assert.equal(result.artifacts[0].metadata.id, 'item')
  assert.equal(fixture.cli(['--root', path.join(fixture.root, 'missing'), 'inventory']).result.errors[0].code, 'invalid-root')
})

test('named binding selection excludes prerequisites and unrelated implementations', context => {
  const fixture = project(context)
  fixture.model()
  fixture.config(configuration())
  const before = fs.readdirSync(fixture.root, { recursive: true }).sort()
  const { exitCode, result } = fixture.cli(['resolve', '--binding', 'clients'])
  assert.equal(exitCode, 0)
  assert.deepEqual(result.selected.map(pair => [pair.spark, pair.implementation]), [['todo-service', 'client']])
  assert.deepEqual(result['implementation-order'], ['contract', 'client'])
  assert.equal(result.prerequisites[0]['requires-selection-review'], true)
  assert.deepEqual(Object.fromEntries(result.prerequisites[0].candidates.map(pair => [pair.spark, pair['in-model-context']])), {
    'other-service': false, 'todo-service': true,
  })
  assert.deepEqual(fs.readdirSync(fixture.root, { recursive: true }).sort(), before)
})

test('QA metadata is exposed without changing selection or prerequisite scope', context => {
  const fixture = project(context)
  fixture.model()
  const config = fixture.config(configuration())
  const originalPairs = fixture.cli(['resolve', '--all']).result.selected
  config.implementations.ui.qa = true
  config.implementations.ui['qa-guidance'] = 'Use the desktop browser.'
  config.implementations.client.qa = true
  config.implementations.client['qa-guidance-file'] = 'docs/client-qa.md'
  config.implementations.server.qa = false
  fixture.write('docs/client-qa.md', 'Use the service inspection tool.\n')
  fixture.config(config)
  const before = fs.readdirSync(fixture.root, { recursive: true }).sort()
  const { exitCode, result } = fixture.cli(['resolve', '--spark', 'todo-app', '--implementation', 'ui'])
  assert.equal(exitCode, 0)
  assert.deepEqual(result.implementations.ui, config.implementations.ui)
  assert.deepEqual(result.implementations.client, config.implementations.client)
  assert.deepEqual(result.selected.map(pair => [pair.spark, pair.implementation]), [['todo-app', 'ui']])
  assert.equal(result.prerequisites.find(entry => entry.implementation === 'client')['requires-selection-review'], true)
  assert.deepEqual(fixture.cli(['resolve', '--all']).result.selected, originalPairs)
  const explicit = fixture.cli(['resolve', '--implementation', 'server'])
  assert.equal(explicit.exitCode, 0)
  assert.equal(explicit.result['empty-selection'], false)
  assert.equal(explicit.result.implementations.server.qa, false)
  assert.equal(fixture.cli(['resolve']).result.errors[0].code, 'selection-required')
  assert.deepEqual(fs.readdirSync(fixture.root, { recursive: true }).sort(), before)
})

test('composed descendants are opt-in and uses only supplies context', context => {
  const fixture = project(context)
  fixture.model()
  fixture.config(configuration())
  const exact = fixture.cli(['resolve', '--spark', 'todo-app', '--implementation', 'ui']).result
  const expanded = fixture.cli(['resolve', '--spark', 'todo-app', '--implementation', 'ui', '--include-composed']).result
  assert.deepEqual(exact.selected.map(pair => pair.spark), ['todo-app'])
  assert.deepEqual(expanded.selected.map(pair => pair.spark), ['todo-app', 'todo-editor'])
  assert.ok(expanded.context.sparks.some(record => record.metadata.id === 'todo-service'))
})

test('implementation and binding filters intersect', context => {
  const fixture = project(context)
  fixture.model()
  fixture.config(configuration())
  const { exitCode, result } = fixture.cli(['resolve', '--binding', 'clients', '--implementation', 'server'])
  assert.equal(exitCode, 0)
  assert.equal(result['empty-selection'], true)
  assert.deepEqual(result.selected, [])
})

test('all reports unbound Sparks and repeated pair matches retain binding reasons', context => {
  const fixture = project(context)
  fixture.model()
  const config = configuration()
  config.bindings.push({
    id: 'more-clients', implementation: 'client',
    match: [{ 'id-pattern': 'todo-*', 'spark-type': 'api-service' }, { id: 'todo-service' }],
  })
  fixture.config(config)
  const result = fixture.cli(['resolve', '--all']).result
  const clients = result.selected.filter(pair => pair.implementation === 'client')
  assert.equal(clients.length, 1)
  assert.deepEqual(clients[0].bindings, ['clients', 'more-clients'])
  assert.deepEqual(result['unbound-sparks'], ['todo-item'])
})

test('whole-ID patterns are case-sensitive with only * and ? as wildcards', () => {
  const metadata = { id: 'todo-api', 'spark-type': 'api-service' }
  for (const [selector, expected] of [
    [{ 'id-pattern': '*-api' }, true], [{ 'id-pattern': 'todo-???' }, true],
    [{ 'id-pattern': 'api' }, false], [{ 'id-pattern': 'Todo-*' }, false],
    [{ 'id-pattern': 'todo-[api]' }, false], [{ 'id-pattern': 'todo-.*' }, false],
    [{ 'id-pattern': 'todo-*', 'spark-type': 'api-service' }, true],
    [{ 'id-pattern': 'todo-*', 'spark-type': 'data' }, false],
  ]) assert.equal(tools.selectorMatches(selector, metadata), expected)
  assert.equal(tools.selectorMatches({ 'spark-type': 'api-service' }, { id: 'untyped' }), false)
})

test('context preserves explicit rule targets and unresolved natural-language scopes', context => {
  const fixture = project(context)
  fixture.model()
  fixture.config(configuration())
  fixture.artifact('app-rule', { kind: 'constraint', 'applies-to': ['todo-app'] })
  fixture.artifact('plain-language', { kind: 'aspect', scope: 'All editing interfaces' })
  fixture.artifact('save-flow', { kind: 'collaboration', participants: ['todo-app', 'todo-service'] })
  const result = fixture.cli(['resolve', '--spark', 'todo-app']).result
  assert.deepEqual(result.context['explicit-rules'][0]['targets-in-context'], ['todo-app'])
  assert.equal(result.context['pending-scopes'][0].metadata.scope, 'All editing interfaces')
  assert.equal(result.context.collaborations[0].metadata.id, 'save-flow')
  assert.deepEqual(result.selected.map(pair => pair.spark), ['todo-app'])
})

test('reverse references are context, not selections', context => {
  const fixture = project(context)
  fixture.model()
  fixture.config(configuration())
  const result = fixture.cli(['resolve', '--spark', 'todo-service', '--implementation', 'server']).result
  assert.ok(result.context.incoming.some(edge => edge.source === 'todo-app' && edge.target === 'todo-service'))
  assert.equal(result.selected.some(pair => pair.spark === 'todo-app'), false)
})

test('unknown or missing selections never imply all', context => {
  const fixture = project(context)
  fixture.model()
  fixture.config(configuration())
  for (const [argumentsList, code] of [
    [[], 'selection-required'], [['--spark', 'missing'], 'unknown-selection'],
    [['--binding', 'missing'], 'unknown-selection'], [['--implementation', 'missing'], 'unknown-selection'],
    [['--all', '--spark', 'todo-app'], 'invalid-selection'],
    [['--implementation', 'ui', '--include-composed'], 'invalid-selection'],
  ]) assert.equal(fixture.cli(['resolve', ...argumentsList]).result.errors[0].code, code)
})

test('an unbound requested Spark is reported without selecting another implementation', context => {
  const fixture = project(context)
  fixture.model()
  fixture.config(configuration())
  const result = fixture.cli(['resolve', '--spark', 'todo-item']).result
  assert.deepEqual(result['unbound-sparks'], ['todo-item'])
  assert.deepEqual(result['implementation-order'], [])
})

function mapProject(context) {
  const fixture = project(context)
  fixture.model()
  fixture.configuration = fixture.config(configuration())
  fixture.write('src/web/client/todo.js', 'original code\n')
  fixture.write('src/web/client/other.js', 'unrelated code\n')
  fixture.record = (filename = 'src/web/client/todo.js', sources = ['todo-service', 'todo-item']) => ({
    path: filename, 'derived-from': sources,
  })
  fixture.update = (changes, write = false) => tools.updateMap(
    fixture.root, fixture.configuration, tools.loadArtifacts(fixture.root), 'client', changes, write,
  )
  fixture.stored = () => tools.readMap(fixture.root, 'client').map
  return fixture
}

test('map preview and read operations never create a map', context => {
  const fixture = mapProject(context)
  const preview = fixture.update({ upsert: [fixture.record()] })
  assert.equal(preview.changed, true)
  assert.equal(preview.written, false)
  assert.equal(fs.existsSync(path.join(fixture.root, tools.MAP_DIRECTORY)), false)
  const { exitCode, result } = fixture.cli(['map', 'show', '--implementation', 'client'])
  assert.equal(exitCode, 0)
  assert.equal(result.maps[0].exists, false)
  assert.equal(fs.existsSync(path.join(fixture.root, tools.MAP_DIRECTORY)), false)
})

test('map writes are targeted, sorted, idempotent, and do not change code', context => {
  const fixture = mapProject(context)
  fixture.update({ upsert: [fixture.record('src/web/client/other.js', ['other-service'])] }, true)
  const result = fixture.update({ upsert: [fixture.record()] }, true)
  assert.equal(result.written, true)
  assert.deepEqual(fixture.stored().artifacts, [
    fixture.record('src/web/client/other.js', ['other-service']),
    fixture.record('src/web/client/todo.js', ['todo-item', 'todo-service']),
  ])
  assert.equal(fixture.update({ upsert: [fixture.record()] }, true).written, false)
  assert.equal(fs.readFileSync(path.join(fixture.root, 'src/web/client/todo.js'), 'utf8'), 'original code\n')
  assert.deepEqual(fs.readdirSync(path.join(fixture.root, tools.MAP_DIRECTORY)), ['client.yaml'])
})

test('grouped map YAML combines complete source sets and preserves special paths and repeat-write bytes', context => {
  const fixture = mapProject(context)
  const specialPath = `src/web/client/${'nested-'.repeat(10)}folder/[draft], {details} #1.ts`
  fixture.write(specialPath, 'special path code\n')
  const changes = { upsert: [
    fixture.record(),
    fixture.record(specialPath, ['todo-item', 'todo-service']),
    fixture.record('src/web/client/other.js', ['other-service']),
  ] }
  const result = fixture.update(changes, true)
  const filename = tools.mapPath(fixture.root, 'client')
  const text = fs.readFileSync(filename, 'utf8')
  assert.equal(result.written, true)
  assert.deepEqual(tools.parseYaml(text, filename), {
    'schema-version': 2,
    'implementation-id': 'client',
    artifacts: [
      { 'derived-from': ['other-service'], paths: ['src/web/client/other.js'] },
      { 'derived-from': ['todo-item', 'todo-service'], paths: [specialPath, 'src/web/client/todo.js'].sort() },
    ],
  })
  assert.match(text, /  - derived-from: \[todo-item, todo-service\]\n    paths:/)
  assert.deepEqual(fixture.stored(), result.map)
  assert.equal(result.map['schema-version'], 1)
  const repeated = fixture.update(changes, true)
  assert.equal(repeated.changed, false)
  assert.equal(repeated.written, false)
  assert.equal(fs.readFileSync(filename, 'utf8'), text)
})

test('grouped map YAML accepts legacy block and flow formats without rewriting semantic no-ops', context => {
  const fixture = mapProject(context)
  const legacyMap = {
    'schema-version': 1,
    'implementation-id': 'client',
    artifacts: [fixture.record('src/web/client/todo.js', ['todo-item', 'todo-service'])],
  }
  for (const legacyText of [stringify(legacyMap), stringify(legacyMap, { collectionStyle: 'flow' })]) {
    const filename = fixture.write(`${tools.MAP_DIRECTORY}/client.yaml`, legacyText)
    assert.deepEqual(fixture.stored(), legacyMap)
    const unchanged = fixture.update({ upsert: [fixture.record()] }, true)
    assert.equal(unchanged.changed, false)
    assert.equal(unchanged.written, false)
    assert.equal(fs.readFileSync(filename, 'utf8'), legacyText)

    const changes = { upsert: [fixture.record('src/web/client/other.js', ['other-service'])] }
    const preview = fixture.update(changes)
    assert.equal(preview.changed, true)
    assert.equal(preview.written, false)
    assert.equal(fs.readFileSync(filename, 'utf8'), legacyText)
    const updated = fixture.update(changes, true)
    assert.deepEqual(updated.map, preview.map)
    const text = fs.readFileSync(filename, 'utf8')
    assert.equal(tools.parseYaml(text, filename)['schema-version'], 2)
    assert.deepEqual(fixture.stored(), updated.map)
    assert.equal(fixture.update(changes, true).written, false)
    assert.equal(fs.readFileSync(filename, 'utf8'), text)
  }
})

test('grouped map updates move and remove individual paths without changing their former peers', context => {
  const fixture = mapProject(context)
  fixture.update({ upsert: [fixture.record(), fixture.record('src/web/client/other.js')] }, true)
  const filename = tools.mapPath(fixture.root, 'client')
  assert.equal(tools.parseYaml(fs.readFileSync(filename, 'utf8'), filename).artifacts.length, 1)
  fixture.update({ upsert: [fixture.record('src/web/client/todo.js', ['other-service'])] }, true)
  assert.deepEqual(fixture.stored().artifacts, [
    fixture.record('src/web/client/other.js', ['todo-item', 'todo-service']),
    fixture.record('src/web/client/todo.js', ['other-service']),
  ])
  const filtered = fixture.cli(['map', 'show', '--source', 'todo-item'])
  assert.equal(filtered.exitCode, 0)
  assert.deepEqual(filtered.result.maps[0].map.artifacts, [fixture.record('src/web/client/other.js', ['todo-item', 'todo-service'])])
  fixture.update({ remove: ['src/web/client/todo.js'] }, true)
  assert.deepEqual(fixture.stored().artifacts, [fixture.record('src/web/client/other.js', ['todo-item', 'todo-service'])])
  fixture.update({ remove: ['src/web/client/other.js'] }, true)
  assert.deepEqual(tools.parseYaml(fs.readFileSync(filename, 'utf8'), filename).artifacts, [])
  assert.equal(fixture.cli(['map', 'check']).exitCode, 0)
})

test('grouped map validation rejects malformed groups and duplicate or unsafe paths', context => {
  const fixture = mapProject(context)
  const group = { 'derived-from': ['todo-item'], paths: ['src/web/client/todo.js'] }
  const cases = [
    [[{ ...group, paths: [] }], 'invalid-list'],
    [[{ ...group, paths: null }], 'invalid-list'],
    [[{ ...group, paths: 'src/web/client/todo.js' }], 'invalid-list'],
    [[{ ...group, paths: ['src/web/client/todo.js', 'src/web/client/todo.js'] }], 'duplicate-values'],
    [[{ ...group, paths: ['src/web/client/todo.js', 'src/web/client/./todo.js'] }], 'duplicate-output'],
    [[group, { ...group, 'derived-from': ['other-service'] }], 'duplicate-output'],
    [[{ ...group, 'derived-from': [] }], 'invalid-list'],
    [[{ ...group, 'derived-from': ['todo-item', 'todo-item'] }], 'duplicate-values'],
    [[{ ...group, paths: ['src/web/client/todo.js', '../outside.js'] }], 'unsafe-path'],
    [[{ ...group, path: 'src/web/client/todo.js' }], 'invalid-fields'],
    [[fixture.record()], 'invalid-fields'],
  ]
  for (const [artifacts, code] of cases) {
    fixture.write(`${tools.MAP_DIRECTORY}/client.yaml`, stringify({
      'schema-version': 2, 'implementation-id': 'client', artifacts,
    }))
    errorCode(code, () => tools.readMap(fixture.root, 'client'))
  }
})

test('grouped map changes still require single-file upserts', context => {
  const fixture = mapProject(context)
  fixture.update({ upsert: [fixture.record()] }, true)
  const filename = tools.mapPath(fixture.root, 'client')
  const before = fs.readFileSync(filename)
  errorCode('invalid-fields', () => fixture.update({
    upsert: [{ paths: ['src/web/client/todo.js'], 'derived-from': ['other-service'] }],
  }, true))
  assert.deepEqual(fs.readFileSync(filename), before)
})

test('removing a mapping does not remove the output file', context => {
  const fixture = mapProject(context)
  fixture.update({ upsert: [fixture.record()] }, true)
  fixture.update({ remove: ['src/web/client/todo.js'] }, true)
  assert.deepEqual(fixture.stored().artifacts, [])
  assert.equal(fs.existsSync(path.join(fixture.root, 'src/web/client/todo.js')), true)
})

test('map sources support every model Artifact kind', context => {
  const fixture = mapProject(context)
  fixture.artifact('input-rule', { kind: 'constraint', 'applies-to': ['todo-item'] })
  fixture.artifact('privacy', { kind: 'aspect', scope: 'All service clients' })
  fixture.artifact('saving', { kind: 'collaboration', participants: ['todo-app', 'todo-service'] })
  const sources = ['todo-service', 'input-rule', 'privacy', 'saving']
  fixture.update({ upsert: [fixture.record('src/web/client/todo.js', sources)] }, true)
  const { exitCode, result } = fixture.cli(['map', 'show', '--source', 'input-rule'])
  assert.equal(exitCode, 0)
  assert.equal(result.filtered, true)
  assert.deepEqual(result.maps[0].map.artifacts[0]['derived-from'], [...sources].sort())
})

test('stale output is reported and can be explicitly removed', context => {
  const fixture = mapProject(context)
  fixture.update({ upsert: [fixture.record()] }, true)
  fs.unlinkSync(path.join(fixture.root, 'src/web/client/todo.js'))
  const { exitCode, result } = fixture.cli(['map', 'check'])
  assert.equal(exitCode, 1)
  assert.equal(result.errors[0].code, 'missing-output')
  errorCode('missing-output', () => fixture.update({ upsert: [fixture.record('src/web/client/other.js')] }, true))
  assert.equal(fixture.stored().artifacts.length, 1)
  fixture.update({ remove: ['src/web/client/todo.js'] }, true)
  assert.deepEqual(fixture.stored().artifacts, [])
})

test('unknown sources remain visible until explicitly replaced or removed', context => {
  const fixture = mapProject(context)
  fixture.artifact('temporary-rule', { kind: 'constraint', scope: 'All records' })
  fixture.update({ upsert: [fixture.record('src/web/client/todo.js', ['temporary-rule'])] }, true)
  fs.unlinkSync(path.join(fixture.root, 'artifacts/constraints/temporary-rule.md'))
  const { exitCode, result } = fixture.cli(['map', 'show', '--source', 'temporary-rule'])
  assert.equal(exitCode, 1)
  assert.equal(result.errors[0].code, 'unknown-source')
  assert.equal(result.maps[0].map.artifacts.length, 1)
  fixture.update({ upsert: [fixture.record()] }, true)
  assert.equal(fixture.cli(['map', 'check']).exitCode, 0)
})

test('invalid map updates do not change existing records', context => {
  const fixture = mapProject(context)
  fixture.update({ upsert: [fixture.record()] }, true)
  const filename = tools.mapPath(fixture.root, 'client')
  const before = fs.readFileSync(filename)
  const cases = [
    [{ upsert: [fixture.record('src/web/client/missing.js')] }, 'missing-output'],
    [{ upsert: [fixture.record('src/web/client/todo.js', ['missing'])] }, 'unknown-source'],
    [{ upsert: [fixture.record('src/web/client/todo.js', [])] }, 'invalid-list'],
    [{ upsert: [fixture.record('src/web/client/todo.js', ['todo-item', 'todo-item'])] }, 'duplicate-values'],
    [{ upsert: [fixture.record(), fixture.record()] }, 'duplicate-output'],
    [{ upsert: [fixture.record()], remove: ['src/web/client/todo.js'] }, 'conflicting-changes'],
    [{ remove: null }, 'invalid-list'], [{ upsert: null }, 'invalid-list'],
    [{ unexpected: [] }, 'invalid-fields'], [{}, 'invalid-changes'],
  ]
  for (const [changes, code] of cases) {
    errorCode(code, () => fixture.update(changes, true))
    assert.deepEqual(fs.readFileSync(filename), before)
  }
})

test('map outputs must stay within the configured source root', context => {
  const fixture = mapProject(context)
  fixture.write('src/server/other.js', 'server code\n')
  errorCode('outside-source-root', () => fixture.update({ upsert: [fixture.record('src/server/other.js')] }))
  errorCode('unsafe-path', () => fixture.update({ upsert: [fixture.record('../outside.js')] }))
})

test('maps for unregistered implementations are still visible', context => {
  const fixture = mapProject(context)
  fixture.update({ upsert: [fixture.record()] }, true)
  const config = configuration()
  delete config.implementations.client
  delete config.implementations.ui['depends-on']
  config.bindings = config.bindings.filter(binding => binding.implementation !== 'client')
  fixture.config(config)
  const { exitCode, result } = fixture.cli(['map', 'show'])
  assert.equal(exitCode, 1)
  assert.equal(result.errors[0].code, 'unknown-implementation')
  assert.ok(result.maps.some(entry => entry.map['implementation-id'] === 'client'))
})

test('map identity and duplicate paths are validated', context => {
  const fixture = mapProject(context)
  const data = { 'schema-version': 1, 'implementation-id': 'server', artifacts: [] }
  fixture.write(`${tools.MAP_DIRECTORY}/client.yaml`, stringify(data))
  errorCode('map-identity', () => tools.readMap(fixture.root, 'client'))
  data['implementation-id'] = 'client'
  data.artifacts = [fixture.record(), fixture.record()]
  fixture.write(`${tools.MAP_DIRECTORY}/client.yaml`, stringify(data))
  errorCode('duplicate-output', () => tools.readMap(fixture.root, 'client'))
})

test('an existing lock prevents writes and is not removed by another writer', context => {
  const fixture = mapProject(context)
  fixture.update({ upsert: [fixture.record()] }, true)
  const lock = fixture.write(`${tools.MAP_DIRECTORY}/client.yaml.lock`, 'another writer\n')
  errorCode('map-busy', () => fixture.update({ remove: ['src/web/client/todo.js'] }, true))
  assert.equal(fs.readFileSync(lock, 'utf8'), 'another writer\n')
  assert.equal(fixture.stored().artifacts.length, 1)
})

test('failed atomic replacement preserves the map and removes temporary files', context => {
  const fixture = mapProject(context)
  fixture.update({ upsert: [fixture.record()] }, true)
  const filename = tools.mapPath(fixture.root, 'client')
  const before = fs.readFileSync(filename)
  context.mock.method(fs, 'renameSync', () => { throw new Error('test failure') })
  assert.throws(() => fixture.update({ remove: ['src/web/client/todo.js'] }, true), /test failure/)
  assert.deepEqual(fs.readFileSync(filename), before)
  assert.deepEqual(fs.readdirSync(path.dirname(filename)), ['client.yaml'])
})

test('a concurrent manual edit is not overwritten', context => {
  const fixture = mapProject(context)
  fixture.update({ upsert: [fixture.record()] }, true)
  const filename = tools.mapPath(fixture.root, 'client')
  const originalSync = fs.fsyncSync
  context.mock.method(fs, 'fsyncSync', descriptor => {
    fs.writeFileSync(filename, 'external edit\n')
    originalSync(descriptor)
  })
  errorCode('map-changed', () => fixture.update({ remove: ['src/web/client/todo.js'] }, true))
  assert.equal(fs.readFileSync(filename, 'utf8'), 'external edit\n')
  assert.deepEqual(fs.readdirSync(path.dirname(filename)), ['client.yaml'])
})

test('CLI map updates accept JSON stdin and require --write to persist', context => {
  const fixture = mapProject(context)
  const changes = JSON.stringify({ upsert: [fixture.record()] })
  const argumentsList = ['map', 'update', '--implementation', 'client', '--changes', '-']
  assert.equal(fixture.cli(argumentsList, changes).result.written, false)
  const { exitCode, result } = fixture.cli([...argumentsList, '--write'], changes)
  assert.equal(exitCode, 0)
  assert.equal(result.written, true)
  for (const invalid of ['{"remove":[],"remove":[]}', '{"upsert":[{"path":"x","path":"y"}]}', '{remove: []}', '{"remove": [],}']) {
    assert.equal(fixture.cli(argumentsList, invalid).result.errors[0].code, 'invalid-json')
  }
})

test('map commands validate arguments before reading or writing', context => {
  const fixture = mapProject(context)
  for (const argumentsList of [
    ['map', 'update', '--implementation', 'client'],
    ['map', 'update', '--changes', '-'],
    ['map', 'show', '--implementation', 'client', '--implementation', 'server'],
    ['resolve', '--all', '--write'],
  ]) assert.equal(fixture.cli(argumentsList).result.errors[0].code, 'arguments')
})

test('check includes map counts and stale-map diagnostics', context => {
  const fixture = mapProject(context)
  assert.equal(fixture.cli(['check']).result['map-count'], 0)
  fixture.update({ upsert: [fixture.record()] }, true)
  assert.equal(fixture.cli(['check']).result['map-count'], 1)
  fs.unlinkSync(path.join(fixture.root, 'src/web/client/todo.js'))
  const { exitCode, result } = fixture.cli(['check'])
  assert.equal(exitCode, 1)
  assert.equal(result.errors[0].code, 'missing-output')
})