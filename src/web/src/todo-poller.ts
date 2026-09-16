import type { Todo } from '../client/todo-client.ts'

export function createTodoPoller(
  load: (signal: AbortSignal) => Promise<Todo[]>,
  received: (todos: Todo[]) => void,
  failed: () => void,
) {
  let active = false
  let generation = 0
  let queued = false
  let inFlight: Promise<void> | null = null
  let controller: AbortController | null = null
  let timer: ReturnType<typeof setInterval> | undefined

  function refresh(): Promise<void> {
    if (!active) return Promise.resolve()
    if (inFlight) {
      queued = true
      return inFlight
    }
    const revision = generation
    const request = new AbortController()
    controller = request
    inFlight = Promise.resolve().then(() => load(request.signal)).then(todos => {
      if (active && !request.signal.aborted && revision === generation) received(todos)
    }).catch(() => {
      if (active && !request.signal.aborted && revision === generation) failed()
    }).finally(() => {
      inFlight = null
      controller = null
      if (queued && active) {
        queued = false
        void refresh()
      }
    })
    return inFlight
  }

  return {
    refresh,
    start() {
      if (active) return inFlight ?? Promise.resolve()
      active = true
      generation += 1
      timer = setInterval(() => { void refresh() }, 5000)
      return refresh()
    },
    stop() {
      active = false
      generation += 1
      queued = false
      clearInterval(timer)
      controller?.abort()
    },
    invalidate() {
      generation += 1
      if (inFlight) queued = true
    },
  }
}