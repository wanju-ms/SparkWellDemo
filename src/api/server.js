import express from 'express'
import cors from 'cors'
import { createTodoService, TodoServiceError } from './todo-service.js'
import { createExpirationMonitor } from './expiration-monitor.js'

export function createTodoApp(options = {}) {
  const app = express()
  const service = options.service ?? createTodoService(options)
  app.locals.todoService = service
  const configuredOrigins = process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim())
  app.disable('x-powered-by')
  app.use(cors({
    origin(origin, done) {
      if (!origin) return done(null, true)
      if (configuredOrigins) return done(null, configuredOrigins.includes(origin))
      try {
        const url = new URL(origin)
        done(null, url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
      } catch {
        done(null, false)
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  }))
  app.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  })
  app.use(express.json({ limit: '1mb', strict: false }))

  app.get('/todos', (_request, response) => {
    response.json(service.list())
  })

  const requireJSON = (request, response, next) => {
    if (!request.is('application/json')) {
      response.status(415).json({ code: 'unsupported_media_type', message: 'Send application/json.' })
      return
    }
    next()
  }

  app.post('/todos', requireJSON, (request, response) => {
    response.status(201).json(service.create(request.body))
  })

  app.put('/todos/:id', requireJSON, (request, response) => {
    response.json(service.update(request.params.id, request.body))
  })

  app.delete('/todos/:id', (request, response) => {
    service.delete(request.params.id)
    response.status(204).end()
  })

  app.use((_request, response) => {
    response.status(404).json({ code: 'not_found', message: 'This resource does not exist.' })
  })
  app.use((error, _request, response, _next) => {
    if (error instanceof TodoServiceError) {
      response.status(error.status).json(error.body)
    } else if (error.type === 'entity.parse.failed' || error instanceof URIError) {
      response.status(400).json({ code: 'invalid_json', message: 'The request is malformed.' })
    } else if (error.type === 'entity.too.large') {
      response.status(413).json({ code: 'payload_too_large', message: 'The request is too large.' })
    } else {
      response.status(500).json({ code: 'service_error', message: 'The operation could not be completed. Try again.' })
    }
  })
  return app
}

if (import.meta.main) {
  const host = process.env.HOST ?? '127.0.0.1'
  const port = Number(process.env.PORT ?? 3000)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new RangeError('PORT must be an integer between 0 and 65535')
  }
  const app = createTodoApp()
  const monitor = createExpirationMonitor(app.locals.todoService)
  const server = app.listen(port, host)
  server.once('listening', () => {
    void monitor.start()
    console.log(`Todo API listening at http://${host}:${server.address().port}`)
  })
  server.once('close', () => monitor.stop())
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => { monitor.stop(); server.close() })
  }
  server.on('error', error => {
    console.error(error.message)
    process.exitCode = 1
  })
}