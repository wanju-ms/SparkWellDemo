import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { createTodoApp } from '../api/server.js'
import { createExpirationMonitor } from '../api/expiration-monitor.js'

const root = fileURLToPath(new URL('../../', import.meta.url))
const store = new Map()
let serviceTime = null
const app = createTodoApp({ store, clock: () => new Date(serviceTime ?? Date.now()) })
const monitor = createExpirationMonitor(app.locals.todoService)
let writes = []
let pauseWrites = false
let pendingResponses = []
let reads = 0
let readMode = 'normal'
let pendingReads = []

async function readJSON(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function respond(response, code, body) {
  response.writeHead(code, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

const server = createServer(async (request, response) => {
  if (request.method === 'POST' && request.url.startsWith('/__test/')) {
    try {
      const body = await readJSON(request)
      switch (request.url) {
        case '/__test/reset':
          for (const pending of pendingResponses) pending.destroy()
          for (const pending of pendingReads) pending.response.destroy()
          pendingResponses = []
          pendingReads = []
          pauseWrites = false
          writes = []
          reads = 0
          readMode = 'normal'
          serviceTime = body.now ?? null
          store.clear()
          for (const todo of body.todos ?? []) store.set(todo.id, todo)
          break
        case '/__test/pause':
          pauseWrites = true
          break
        case '/__test/fail':
          pauseWrites = false
          for (const pending of pendingResponses) {
            respond(pending, 500, { code: 'service_error', message: 'Simulated save failure.' })
          }
          pendingResponses = []
          break
        case '/__test/clock':
          serviceTime = body.now
          break
        case '/__test/pause-reads':
          readMode = 'pause'
          break
        case '/__test/fail-reads':
          readMode = 'fail'
          break
        case '/__test/release-reads':
          readMode = body.mode ?? 'normal'
          for (const pending of pendingReads) {
            if (!pending.response.destroyed) respond(pending.response, 200, pending.todos)
          }
          pendingReads = []
          break
        case '/__test/state':
          break
        default:
          respond(response, 404, { message: 'Unknown test control.' })
          return
      }
      respond(response, 200, { writes, todos: [...store.values()], pendingCount: pendingResponses.length, reads, pendingReadCount: pendingReads.length })
    } catch {
      respond(response, 400, { message: 'Invalid test control request.' })
    }
    return
  }
  if (request.method === 'GET' && request.url === '/todos') {
    reads += 1
    if (readMode === 'fail') {
      respond(response, 500, { code: 'service_error', message: 'Simulated refresh failure.' })
      return
    }
    if (readMode === 'pause') {
      pendingReads.push({ response, todos: app.locals.todoService.list() })
      return
    }
  }
  if (['POST', 'PUT'].includes(request.method) && /^\/todos(?:\/|$)/.test(request.url)) {
    const paused = pauseWrites
    const chunks = []
    request.on('data', chunk => chunks.push(chunk))
    request.on('end', () => {
      let body = null
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch {}
      writes.push({ method: request.method, path: request.url, body })
      if (paused) pendingResponses.push(response)
    })
    if (paused) return
  }
  app(request, response)
})

await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})

try {
  await monitor.start()
  const endpoint = `http://127.0.0.1:${server.address().port}`
  console.log(`Isolated iOS test API: ${endpoint}`)
  const child = spawn('xcodebuild', [
    '-project', 'src/ios/TodoApp.xcodeproj',
    '-scheme', 'TodoApp',
    '-destination', process.env.IOS_TEST_DESTINATION ?? 'platform=iOS Simulator,name=iPhone 17 Pro',
    '-derivedDataPath', 'src/ios/DerivedData',
    'CODE_SIGNING_ALLOWED=NO',
    '-parallel-testing-enabled', 'NO',
    ...process.argv.slice(2),
    'test', '-quiet',
  ], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      DEVELOPER_DIR: process.env.DEVELOPER_DIR ?? '/Applications/Xcode.app/Contents/Developer',
      TEST_RUNNER_TODO_UI_TEST_API_URL: endpoint,
    },
  })
  const [exitCode] = await once(child, 'exit')
  process.exitCode = exitCode ?? 1
} finally {
  monitor.stop()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}