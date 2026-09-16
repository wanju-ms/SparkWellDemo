import createClient from 'openapi-fetch'
import type { components, paths } from './schema.d.ts'

export type Todo = components['schemas']['Todo']
export type TodoInput = components['schemas']['TodoInput']
export type TodoUpdate = components['schemas']['TodoUpdate']
export type TodoStatus = components['schemas']['TodoStatus']
export type ManualTodoStatus = components['schemas']['ManualTodoStatus']
type ApiError = components['schemas']['ApiError']

export class TodoClientError extends Error {
  readonly status: number
  readonly fields: Record<string, string>
  readonly current?: Todo

  constructor(status: number, error?: ApiError) {
    super(error?.message ?? 'The service could not complete the request.')
    this.name = 'TodoClientError'
    this.status = status
    this.fields = error?.fields ?? {}
    this.current = error?.current
  }
}

function resultData<Result>(result: { data?: Result; error?: ApiError; response: Response }): Result {
  if (!result.response.ok || result.error || result.data === undefined) {
    throw new TodoClientError(result.response.status, result.error)
  }
  return result.data
}

export function createTodoClient(baseURL: string) {
  const http = createClient<paths>({ baseUrl: baseURL.replace(/\/$/, '') })
  return {
    async list(signal?: AbortSignal): Promise<Todo[]> {
      return resultData(await http.GET('/todos', { signal }))
    },
    async create(input: TodoInput): Promise<Todo> {
      return resultData(await http.POST('/todos', { body: input }))
    },
    async update(id: string, input: TodoUpdate): Promise<Todo> {
      return resultData(await http.PUT('/todos/{id}', { params: { path: { id } }, body: input }))
    },
  }
}