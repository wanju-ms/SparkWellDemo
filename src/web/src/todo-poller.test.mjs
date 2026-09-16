import assert from 'node:assert/strict'
import test from 'node:test'
import { createTodoPoller } from './todo-poller.ts'

const drain = () => new Promise(resolve => setImmediate(resolve))

test('foreground polling runs immediately and every five seconds, stops in background, and resumes', async context => {
  context.mock.timers.enable({ apis: ['setInterval'] })
  let calls = 0
  const snapshots = []
  const poller = createTodoPoller(async () => { calls += 1; return [] }, todos => snapshots.push(todos), () => assert.fail('Unexpected error'))
  context.after(() => poller.stop())
  await poller.start()
  assert.equal(calls, 1)
  context.mock.timers.tick(4999)
  await drain()
  assert.equal(calls, 1)
  context.mock.timers.tick(1)
  await drain()
  assert.equal(calls, 2)
  poller.stop()
  context.mock.timers.tick(10000)
  await drain()
  assert.equal(calls, 2)
  await poller.start()
  assert.equal(calls, 3)
  assert.equal(snapshots.length, 3)
})

test('overlapping refreshes coalesce and a save or conflict supersedes old responses', async context => {
  const requests = []
  const snapshots = []
  const poller = createTodoPoller(() => new Promise(resolve => requests.push(resolve)), todos => snapshots.push(todos), () => assert.fail('Unexpected error'))
  context.after(() => poller.stop())
  const first = poller.start()
  await drain()
  void poller.refresh()
  void poller.refresh()
  assert.equal(requests.length, 1)
  poller.invalidate()
  requests[0]([{ id: 'stale' }])
  await first
  await drain()
  assert.equal(snapshots.length, 0)
  assert.equal(requests.length, 2)
  requests[1]([{ id: 'current' }])
  await drain()
  assert.deepEqual(snapshots, [[{ id: 'current' }]])
})

test('refresh failures do not replace the last snapshot, and stopped requests cannot publish', async context => {
  let rejectLoad
  let resolveLoad
  let failures = 0
  const snapshots = []
  const poller = createTodoPoller(() => new Promise((resolve, reject) => { resolveLoad = resolve; rejectLoad = reject }), todos => snapshots.push(todos), () => { failures += 1 })
  context.after(() => poller.stop())
  const first = poller.start()
  await drain()
  resolveLoad([{ id: 'saved' }])
  await first
  const second = poller.refresh()
  await drain()
  rejectLoad(new Error('Offline'))
  await second
  assert.equal(failures, 1)
  assert.deepEqual(snapshots, [[{ id: 'saved' }]])
  const third = poller.refresh()
  await drain()
  poller.stop()
  resolveLoad([{ id: 'obsolete' }])
  await third
  assert.deepEqual(snapshots, [[{ id: 'saved' }]])
})