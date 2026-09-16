import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import SwaggerParser from '@apidevtools/swagger-parser'
import { createTodoApp } from './server.js'
import { createTodoService } from './todo-service.js'
import { createExpirationMonitor } from './expiration-monitor.js'

const input = { task: 'Review the design', description: '', status: 'incomplete' }

async function runApi(context, options) {
  const server = createTodoApp(options).listen(0, '127.0.0.1')
  await once(server, 'listening')
  context.after(() => new Promise((resolve, reject) => {
    server.closeAllConnections()
    server.close(error => error ? reject(error) : resolve())
  }))
  const baseURL = `http://127.0.0.1:${server.address().port}`
  return async (path = '/todos', method = 'GET', body) => {
    const response = await fetch(`${baseURL}${path}`, {
      method,
      ...(body === undefined ? {} : {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    })
    return { status: response.status, body: await response.json(), headers: response.headers }
  }
}

test('startup reports an occupied port without claiming success or masking the listen error', async context => {
  const occupied = createTodoApp().listen(0, '127.0.0.1')
  await once(occupied, 'listening')
  context.after(() => new Promise(resolve => occupied.close(resolve)))
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./server.js', import.meta.url))], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(occupied.address().port) },
    encoding: 'utf8',
    timeout: 5000,
  })
  assert.equal(result.error, undefined)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /EADDRINUSE/)
  assert.doesNotMatch(result.stderr, /TypeError/)
  assert.doesNotMatch(result.stdout, /Todo API listening/)
})

test('the shared OpenAPI contract is valid', async () => {
  const document = await SwaggerParser.validate(fileURLToPath(new URL('../contracts/todo-api.yaml', import.meta.url)))
  assert.equal(document.paths['/todos'].get.operationId, 'listTodos')
  assert.deepEqual(document.components.schemas.TodoStatus.enum, ['incomplete', 'completed', 'overdue'])
  assert.deepEqual(document.components.schemas.ManualTodoStatus.enum, ['incomplete', 'completed'])
  const { Todo, TodoInput } = document.components.schemas
  assert.ok(Todo.required.includes('createdAt'))
  assert.equal(Todo.properties.createdAt.format, 'date-time')
  assert.equal(Todo.properties.createdAt.readOnly, true)
  assert.equal(Object.hasOwn(TodoInput.properties, 'createdAt'), false)
  assert.equal(TodoInput.additionalProperties, false)
})

test('empty load, create, independent identities, update, and subsequent load', async context => {
  const request = await runApi(context)
  assert.deepEqual((await request()).body, [])
  const created = await request('/todos', 'POST', input)
  assert.equal(created.status, 201)
  assert.ok(created.body.id)
  assert.deepEqual(created.body, { id: created.body.id, ...input, createdAt: created.body.createdAt, dueAt: null })
  const duplicate = await request('/todos', 'POST', input)
  assert.notEqual(duplicate.body.id, created.body.id)
  const changed = { task: 'Reviewed', description: 'Ready to build', status: 'completed' }
  const updated = await request(`/todos/${created.body.id}`, 'PUT', changed)
  assert.equal(updated.status, 200)
  assert.deepEqual(updated.body, { id: created.body.id, ...changed, createdAt: created.body.createdAt, dueAt: null })
  const reloaded = await request()
  assert.deepEqual(reloaded.body, [updated.body, duplicate.body])
  assert.equal(reloaded.headers.get('cache-control'), 'no-store')
})

test('creation time comes from the server clock and survives later loads and updates', async context => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-15T23:59:59.123Z') })
  const request = await runApi(context)
  const created = await request('/todos', 'POST', input)
  assert.equal(created.status, 201)
  assert.equal(created.body.createdAt, '2026-09-15T23:59:59.123Z')

  context.mock.timers.tick(60_000)
  assert.deepEqual((await request()).body, [created.body])
  const updated = await request(`/todos/${created.body.id}`, 'PUT', { ...input, status: 'completed' })
  assert.equal(updated.status, 200)
  assert.deepEqual(updated.body, { ...created.body, status: 'completed' })
  assert.deepEqual((await request()).body, [updated.body])

  const nextTodo = await request('/todos', 'POST', input)
  assert.equal(nextTodo.status, 201)
  assert.equal(nextTodo.body.createdAt, '2026-09-16T00:00:59.123Z')
})

test('creation time cannot be supplied by a client on create or update', async context => {
  const request = await runApi(context)
  const created = await request('/todos', 'POST', input)
  for (const createdAt of ['2000-01-01T00:00:00Z', created.body.createdAt, null]) {
    const supplied = { ...input, createdAt }
    for (const [path, method] of [['/todos', 'POST'], [`/todos/${created.body.id}`, 'PUT']]) {
      const rejected = await request(path, method, supplied)
      assert.equal(rejected.status, 422)
      assert.equal(rejected.body.code, 'validation_error')
      assert.deepEqual((await request()).body, [created.body])
    }
  }
})

test('inclusive text boundaries count grapheme clusters', async context => {
  const request = await runApi(context)
  const cluster = '\u{1f469}\u200d\u{1f4bb}'
  const boundary = { ...input, task: cluster.repeat(300), description: 'e\u0301'.repeat(1000) }
  const created = await request('/todos', 'POST', boundary)
  assert.equal(created.status, 201)
  assert.equal(created.body.task, boundary.task)
  for (const [field, value] of [['task', cluster.repeat(301)], ['description', 'e\u0301'.repeat(1001)]]) {
    const invalid = await request(`/todos/${created.body.id}`, 'PUT', { ...boundary, [field]: value })
    assert.equal(invalid.status, 422)
    assert.ok(invalid.body.fields[field])
    assert.deepEqual((await request()).body, [created.body])
  }
})

test('invalid inputs are rejected without adding records', async context => {
  const request = await runApi(context)
  const invalidInputs = [
    { ...input, task: ' \n\t' },
    { ...input, task: 42 },
    { ...input, task: 'a'.repeat(301) },
    { ...input, description: 'a'.repeat(1001) },
    { ...input, description: null },
    { ...input, status: 'pending' },
    { ...input, id: 'client-selected' },
    { task: 'Missing fields' },
    [],
    null,
  ]
  for (const invalid of invalidInputs) {
    const response = await request('/todos', 'POST', invalid)
    assert.equal(response.status, 422)
    assert.equal(response.body.code, 'validation_error')
  }
  assert.deepEqual((await request()).body, [])
})

test('updating a missing ID never creates a record', async context => {
  const request = await runApi(context)
  const response = await request('/todos/missing', 'PUT', input)
  assert.equal(response.status, 404)
  assert.equal(response.body.code, 'not_found')
  assert.deepEqual((await request()).body, [])
})

test('failed writes retain the complete previous record; failed reads are not empty loads', async context => {
  class FailingStore extends Map {
    failWrites = false
    failReads = false
    set(key, value) {
      if (this.failWrites) throw new Error('Storage unavailable')
      return super.set(key, value)
    }
    values() {
      if (this.failReads) throw new Error('Storage unavailable')
      return super.values()
    }
  }
  const store = new FailingStore()
  const request = await runApi(context, { store })
  const created = await request('/todos', 'POST', input)
  store.failWrites = true
  assert.equal((await request(`/todos/${created.body.id}`, 'PUT', { ...input, task: 'Changed' })).status, 500)
  assert.equal((await request('/todos', 'POST', input)).status, 500)
  assert.deepEqual((await request()).body, [created.body])
  store.failReads = true
  const failedRead = await request()
  assert.equal(failedRead.status, 500)
  assert.equal(failedRead.body.code, 'service_error')
})

test('a restarted service gets an empty collection', async context => {
  const firstProcess = await runApi(context)
  await firstProcess('/todos', 'POST', input)
  assert.equal((await firstProcess()).body.length, 1)
  const restartedProcess = await runApi(context)
  assert.deepEqual((await restartedProcess()).body, [])
})

test('malformed JSON and browser preflight use the shared HTTP boundary', async context => {
  const server = createTodoApp().listen(0, '127.0.0.1')
  await once(server, 'listening')
  context.after(() => { server.closeAllConnections(); server.close() })
  const url = `http://127.0.0.1:${server.address().port}/todos`
  const invalid = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })
  assert.equal(invalid.status, 400)
  assert.equal((await invalid.json()).code, 'invalid_json')
  const unsupported = await fetch(url, { method: 'POST', body: 'text' })
  assert.equal(unsupported.status, 415)
  const preflight = await fetch(url, {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'PUT' },
  })
  assert.equal(preflight.status, 204)
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:5173')
})

test('overdue uses a strict deadline, protects completed items, and conflicts with stale status writes', async context => {
  let now = new Date('2026-09-15T12:00:00.000Z')
  const request = await runApi(context, { clock: () => now })
  const dueAt = now.toISOString()
  const created = await request('/todos', 'POST', { ...input, dueAt })
  assert.equal(created.body.status, 'incomplete')
  now = new Date('2026-09-15T12:00:00.001Z')
  const conflict = await request(`/todos/${created.body.id}`, 'PUT', { ...input, task: 'Unsaved edit', status: 'completed' })
  assert.equal(conflict.status, 409)
  assert.equal(conflict.body.code, 'status_conflict')
  assert.deepEqual(conflict.body.current, { ...created.body, status: 'overdue' })
  assert.deepEqual((await request()).body, [conflict.body.current])
  const completed = await request('/todos', 'POST', { ...input, status: 'completed', dueAt })
  assert.equal(completed.body.status, 'completed')
  const reopened = await request(`/todos/${completed.body.id}`, 'PUT', { ...input })
  assert.equal(reopened.body.status, 'overdue')
  const past = await request('/todos', 'POST', { ...input, dueAt })
  assert.equal(past.body.status, 'overdue')
})

test('only a saved deadline change recovers an overdue Todo; omitted deadline is retained', async context => {
  const now = new Date('2026-09-15T12:00:00.000Z')
  const request = await runApi(context, { clock: () => now })
  const created = await request('/todos', 'POST', { ...input, dueAt: '2026-09-14T12:00:00Z' })
  const path = `/todos/${created.body.id}`
  const content = await request(path, 'PUT', { task: 'Edited', description: 'Notes' })
  assert.equal(content.body.status, 'overdue')
  assert.equal(content.body.dueAt, created.body.dueAt)
  const sameTime = await request(path, 'PUT', { task: 'Edited', description: '', dueAt: now.toISOString() })
  assert.equal(sameTime.body.status, 'incomplete')
  assert.equal(sameTime.body.createdAt, created.body.createdAt)
  const completed = await request(path, 'PUT', { ...input, status: 'completed' })
  assert.equal(completed.body.status, 'completed')
  const other = await request('/todos', 'POST', { ...input, dueAt: '2026-09-14T12:00:00Z' })
  const cleared = await request(`/todos/${other.body.id}`, 'PUT', { task: 'Recovered', description: '', dueAt: null })
  assert.equal(cleared.body.status, 'incomplete')
  assert.equal(cleared.body.dueAt, null)
})

test('rejects system status and malformed deadlines; normalizes offset instants and legacy missing deadlines', async context => {
  const store = new Map([['legacy', { id: 'legacy', ...input, createdAt: '2026-09-15T00:00:00Z' }]])
  const request = await runApi(context, { store })
  assert.equal((await request()).body[0].dueAt, null)
  for (const changes of [{ status: 'overdue' }, { dueAt: '' }, { dueAt: '2026-02-30T12:00:00Z' }, { dueAt: '2026-09-15T12:00' }, { dueAt: 123 }]) {
    assert.equal((await request('/todos', 'POST', { ...input, ...changes })).status, 422)
    assert.equal((await request('/todos/legacy', 'PUT', { ...input, ...changes })).status, 422)
  }
  const valid = await request('/todos', 'POST', { ...input, status: 'completed', dueAt: '2026-09-15T12:00:00+08:00' })
  assert.equal(valid.body.dueAt, '2026-09-15T04:00:00.000Z')
})

test('monitor starts immediately and scans every five seconds without HTTP requests', async context => {
  context.mock.timers.enable({ apis: ['Date', 'setInterval'], now: new Date('2026-09-15T12:00:00Z') })
  const store = new Map([
    ['past', { id: 'past', ...input, dueAt: '2026-09-15T11:00:00Z' }],
    ['next', { id: 'next', ...input, dueAt: '2026-09-15T12:00:01Z' }],
    ['done', { id: 'done', ...input, status: 'completed', dueAt: '2026-09-15T11:00:00Z' }],
  ])
  const monitor = createExpirationMonitor(createTodoService({ store }))
  context.after(() => monitor.stop())
  await monitor.start()
  assert.equal(store.get('past').status, 'overdue')
  assert.equal(store.get('done').status, 'completed')
  context.mock.timers.tick(4999)
  assert.equal(store.get('next').status, 'incomplete')
  context.mock.timers.tick(1)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(store.get('next').status, 'overdue')
})

test('monitor rechecks stale candidates, retries failures, and does not overlap scans or run after stop', async context => {
  context.mock.timers.enable({ apis: ['setInterval'] })
  const errors = []
  let release
  let scans = 0
  let fail = true
  const marked = []
  const service = {
    overdueCandidates() {
      scans += 1
      if (scans === 1) return new Promise(resolve => { release = resolve })
      return ['first', 'second']
    },
    markOverdue(id) {
      if (id === 'first' && fail) throw new Error('Retry this record')
      marked.push(id)
    },
  }
  const monitor = createExpirationMonitor(service, { onError: error => errors.push(error) })
  const initial = monitor.start()
  context.mock.timers.tick(5000)
  assert.equal(scans, 1)
  release(['first', 'second'])
  await initial
  assert.equal(errors.length, 1)
  assert.deepEqual(marked, ['second'])
  fail = false
  context.mock.timers.tick(5000)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(marked, ['second', 'first', 'second'])
  monitor.stop()
  context.mock.timers.tick(5000)
  assert.equal(scans, 2)

  const store = new Map([['candidate', { id: 'candidate', ...input, dueAt: '2020-01-01T00:00:00Z' }]])
  const todos = createTodoService({ store })
  assert.deepEqual(todos.overdueCandidates(), ['candidate'])
  store.set('candidate', { ...store.get('candidate'), status: 'completed' })
  assert.equal(todos.markOverdue('candidate').status, 'completed')
  store.set('candidate', { ...store.get('candidate'), status: 'incomplete', dueAt: '2099-01-01T00:00:00Z' })
  assert.equal(todos.markOverdue('candidate').status, 'incomplete')
})