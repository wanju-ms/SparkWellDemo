import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { createTodoApp } from '../../api/server.js'
import { createTodoClient, TodoClientError } from './todo-client.ts'
import { characterCount, DEFAULT_STATUS, TODO_LIMITS, validateTodo } from './todo-item.ts'

test('typed client loads, creates, updates, and receives structured errors from the real API', async context => {
  const server = createTodoApp().listen(0, '127.0.0.1')
  await once(server, 'listening')
  context.after(() => new Promise<void>(resolve => {
    server.closeAllConnections()
    server.close(() => resolve())
  }))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const client = createTodoClient(`http://127.0.0.1:${address.port}`)
  assert.deepEqual(await client.list(), [])
  const input = { task: 'Typed client', description: '', status: DEFAULT_STATUS }
  const beforeCreate = Date.now()
  const created = await client.create(input)
  assert.ok(created.id)
  assert.equal(new Date(created.createdAt).toISOString(), created.createdAt)
  assert.ok(Date.parse(created.createdAt) >= beforeCreate)
  assert.ok(Date.parse(created.createdAt) <= Date.now())
  assert.deepEqual(await client.list(), [created])
  const updated = await client.update(created.id, { ...input, status: 'completed' })
  assert.equal(updated.id, created.id)
  assert.equal(updated.createdAt, created.createdAt)
  assert.deepEqual(await client.list(), [updated])
  await assert.rejects(client.update('missing', input), error => error instanceof TodoClientError && error.status === 404)
  await assert.rejects(client.create({ ...input, task: 'a'.repeat(301) }), error => {
    return error instanceof TodoClientError && error.status === 422 && Boolean(error.fields.task)
  })
  assert.deepEqual(await client.list(), [updated])
})

test('UI validation preserves inclusive grapheme boundaries and draft text', () => {
  const cluster = '\u{1f469}\u200d\u{1f4bb}'
  assert.equal(characterCount(cluster), 1)
  const input = { task: cluster.repeat(TODO_LIMITS.task), description: 'e\u0301'.repeat(TODO_LIMITS.description), status: DEFAULT_STATUS }
  assert.deepEqual(validateTodo(input), {})
  assert.ok(validateTodo({ ...input, task: `${input.task}${cluster}` }).task)
  assert.ok(validateTodo({ ...input, description: `${input.description}a` }).description)
  assert.ok(validateTodo({ ...input, task: ' \t\n' }).task)
  assert.equal(input.task, cluster.repeat(300))
})

test('client reads system status, exposes conflict records, and recovers with deadline-only edits', async context => {
  const server = createTodoApp().listen(0, '127.0.0.1')
  await once(server, 'listening')
  context.after(() => new Promise<void>(resolve => {
    server.closeAllConnections()
    server.close(() => resolve())
  }))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const client = createTodoClient(`http://127.0.0.1:${address.port}`)
  const input = { task: 'Deadline', description: '', status: DEFAULT_STATUS, dueAt: '2020-01-01T00:00:00Z' }
  const created = await client.create(input)
  assert.equal(created.status, 'overdue')
  assert.equal(created.dueAt, '2020-01-01T00:00:00.000Z')
  await assert.rejects(client.update(created.id, { ...input, status: 'completed' }), error => {
    return error instanceof TodoClientError && error.status === 409 && error.current?.id === created.id && error.current.status === 'overdue'
  })
  const recovered = await client.update(created.id, { task: input.task, description: '', dueAt: null })
  assert.equal(recovered.status, 'incomplete')
  assert.equal(recovered.dueAt, null)
  assert.equal(recovered.createdAt, created.createdAt)
  assert.deepEqual(await client.list(), [recovered])
})