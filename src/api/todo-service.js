import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { parse } from 'yaml'

const schemas = parse(readFileSync(new URL('../contracts/todo-api.yaml', import.meta.url), 'utf8')).components.schemas
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })
const ajv = new Ajv()
addFormats(ajv)
const validDeadline = ajv.compile(schemas.DueAt)

export class TodoServiceError extends Error {
  constructor(status, body) {
    super(body.message)
    this.status = status
    this.body = body
  }
}

function validateInput(input, updating) {
  const fields = {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    fields.body = 'A Todo object is required.'
  } else {
    const taskLimit = schemas.Task['x-max-grapheme-length']
    const descriptionLimit = schemas.Description['x-max-grapheme-length']
    if (typeof input.task !== 'string' || !input.task.trim()) fields.task = 'Enter a task.'
    else if ([...segmenter.segment(input.task)].length > taskLimit) fields.task = `Use ${taskLimit} characters or fewer.`
    if (typeof input.description !== 'string') fields.description = 'Description must be text.'
    else if ([...segmenter.segment(input.description)].length > descriptionLimit) fields.description = `Use ${descriptionLimit} characters or fewer.`
    if ((!updating || Object.hasOwn(input, 'status')) && !schemas.ManualTodoStatus.enum.includes(input.status)) {
      fields.status = 'Choose incomplete or completed; overdue is set by the system.'
    }
    if (Object.hasOwn(input, 'dueAt') && (!validDeadline(input.dueAt)
      || (input.dueAt !== null && !Number.isFinite(Date.parse(input.dueAt))))) {
      fields.dueAt = 'Enter a valid date and time with a time zone, or clear the deadline.'
    }
    if (Object.keys(input).some(field => !Object.hasOwn(schemas.TodoInput.properties, field))) {
      fields.body = 'Only task, description, status, and dueAt are accepted.'
    }
  }
  if (Object.keys(fields).length) {
    throw new TodoServiceError(422, { code: 'validation_error', message: 'Check the Todo fields.', fields })
  }
}

function isOverdue(todo, now) {
  return todo.status === 'incomplete' && todo.dueAt != null && now > Date.parse(todo.dueAt)
}

function normalizeDeadline(value) {
  return value == null ? null : new Date(value).toISOString()
}

export function createTodoService({ store = new Map(), createId = randomUUID, clock = () => new Date() } = {}) {
  function commit(todo) {
    store.set(todo.id, Object.freeze({ ...todo }))
    return { ...todo }
  }

  function markOverdue(id) {
    const saved = store.get(id)
    if (!saved) return null
    const current = { ...saved, dueAt: saved.dueAt ?? null }
    return isOverdue(current, clock().getTime())
      ? commit({ ...current, status: 'overdue' })
      : current
  }

  return {
    overdueCandidates() {
      const now = clock().getTime()
      return [...store.values()].filter(todo => isOverdue(todo, now)).map(todo => todo.id)
    },
    markOverdue,
    list() {
      return [...store.values()].map(todo => markOverdue(todo.id))
    },
    create(input) {
      validateInput(input, false)
      const id = createId()
      if (store.has(id)) throw new Error('Generated ID already exists')
      const now = clock()
      const todo = { id, task: input.task, description: input.description, status: input.status, createdAt: now.toISOString(), dueAt: normalizeDeadline(input.dueAt) }
      if (isOverdue(todo, now.getTime())) todo.status = 'overdue'
      return commit(todo)
    },
    update(id, input) {
      validateInput(input, true)
      const current = markOverdue(id)
      if (!current) throw new TodoServiceError(404, { code: 'not_found', message: 'This Todo no longer exists.' })
      if (current.status === 'overdue' && Object.hasOwn(input, 'status')) {
        throw new TodoServiceError(409, {
          code: 'status_conflict',
          message: 'This Todo is overdue. Adjust or clear the deadline before changing its status.',
          current,
        })
      }
      const now = clock().getTime()
      const dueAt = Object.hasOwn(input, 'dueAt') ? normalizeDeadline(input.dueAt) : current.dueAt
      const todo = { ...current, task: input.task, description: input.description, status: input.status ?? current.status, dueAt }
      if (current.status === 'overdue' && dueAt !== current.dueAt && (dueAt === null || Date.parse(dueAt) >= now)) {
        todo.status = 'incomplete'
      } else if (isOverdue(todo, now)) {
        todo.status = 'overdue'
      }
      return commit(todo)
    },
    delete(id) {
      store.delete(id)
    },
  }
}