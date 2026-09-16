import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, CheckCircle2, Circle, ListTodo, LoaderCircle, Pencil, Plus, RefreshCw } from 'lucide-react'
import { createTodoClient, TodoClientError } from '../client/todo-client'
import type { Todo, TodoUpdate } from '../client/todo-client'
import { DEFAULT_STATUS } from '../client/todo-item'
import { createTodoPoller } from './todo-poller'
import CreatedAt from './CreatedAt'
import TodoEditor from './TodoEditor'
import './App.css'

const client = createTodoClient(import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000')

function App() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [refreshError, setRefreshError] = useState(false)
  const [editor, setEditor] = useState<{ todo?: Todo } | null>(null)
  const poller = useRef<ReturnType<typeof createTodoPoller> | null>(null)
  const completed = todos.filter(todo => todo.status === 'completed').length
  const currentTodo = editor?.todo ? todos.find(todo => todo.id === editor.todo!.id) ?? editor.todo : undefined

  useEffect(() => {
    const refresh = createTodoPoller(client.list, loaded => {
      setTodos(loaded)
      setLoadState('ready')
      setRefreshError(false)
    }, () => {
      setLoadState(current => current === 'ready' ? current : 'error')
      setRefreshError(true)
    })
    poller.current = refresh
    const updateActivity = () => {
      if (document.visibilityState === 'visible') void refresh.start()
      else refresh.stop()
    }
    updateActivity()
    document.addEventListener('visibilitychange', updateActivity)
    return () => {
      refresh.stop()
      document.removeEventListener('visibilitychange', updateActivity)
    }
  }, [])

  function reloadTodos() {
    if (loadState !== 'ready') setLoadState('loading')
    void poller.current?.refresh()
  }

  function applyRecord(saved: Todo) {
    poller.current?.invalidate()
    setTodos(current => current.some(todo => todo.id === saved.id)
      ? current.map(todo => todo.id === saved.id ? saved : todo)
      : [...current, saved])
  }

  async function saveTodo(input: TodoUpdate) {
    const target = editor?.todo
    try {
      const saved = target ? await client.update(target.id, input) : await client.create({ ...input, status: input.status ?? DEFAULT_STATUS })
      applyRecord(saved)
    } catch (error) {
      if (error instanceof TodoClientError && error.status === 409 && error.current) applyRecord(error.current)
      throw error
    }
  }

  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <div className="brand"><span className="brand-mark"><Check size={23} strokeWidth={3} /></span><span>Todo</span></div>
          <span className="workspace-label">Personal workspace</span>
        </div>
      </header>
      <main className="workspace">
        <div className="page-heading">
          <div><p className="eyebrow">Workspace</p><h1>Your todos</h1></div>
          <button className="button primary" onClick={() => setEditor({})} disabled={loadState !== 'ready'}>
            <Plus size={18} /><span>New todo</span>
          </button>
        </div>
        <div className="list-toolbar">
          <div className="list-label"><ListTodo size={19} /><h2>All todos</h2><span className="count">{todos.length}</span></div>
          <div className="list-tools">
            {loadState === 'ready' && <span className="completion-summary">{completed} completed</span>}
            <button className="icon-button" aria-label="Reload todos" title="Reload todos" disabled={loadState === 'loading'} onClick={reloadTodos}>
              <RefreshCw size={17} className={loadState === 'loading' ? 'spin' : ''} />
            </button>
          </div>
        </div>
        {loadState === 'ready' && refreshError && <div className="refresh-error" role="alert">
          <AlertCircle size={17} /><span>Could not refresh todos.</span>
          <button className="icon-button" aria-label="Retry refresh" title="Retry refresh" onClick={reloadTodos}><RefreshCw size={17} /></button>
        </div>}
        {loadState === 'loading' && <div className="list-state" role="status"><LoaderCircle className="spin" size={28} /><h2>Loading todos</h2></div>}
        {loadState === 'error' && <div className="list-state" role="alert">
          <AlertCircle size={30} /><h2>Could not load todos</h2>
          <button className="button secondary" onClick={reloadTodos}><RefreshCw size={16} />Retry</button>
        </div>}
        {loadState === 'ready' && todos.length === 0 && <div className="list-state empty-state">
          <span className="empty-icon"><ListTodo size={35} strokeWidth={1.5} /></span><h2>No todos yet</h2>
        </div>}
        {loadState === 'ready' && todos.length > 0 && <ul className="todo-list" aria-label="Todos">
          {todos.map(todo => <li key={todo.id} className={`todo-row ${todo.status === 'completed' ? 'is-complete' : ''}`}>
            <span className="row-status-icon" aria-hidden="true">{todo.status === 'completed' ? <CheckCircle2 size={21} /> : <Circle size={21} />}</span>
            <div className="todo-content"><h3>{todo.task}</h3>{todo.description && <p>{todo.description}</p>}</div>
            <span className={`status-label ${todo.status}`}>{todo.status === 'completed' ? 'Completed' : todo.status === 'overdue' ? 'Overdue' : 'Incomplete'}</span>
            <CreatedAt value={todo.createdAt} />
            <div className="due-at-column"><CreatedAt label="Due at" empty="No deadline" value={todo.dueAt ?? null} /></div>
            <button className="icon-button edit-button" aria-label={`Edit ${todo.task}`} title="Edit todo" onClick={() => setEditor({ todo })}><Pencil size={17} /></button>
          </li>)}
        </ul>}
      </main>
      {editor && <TodoEditor key={editor.todo?.id ?? 'new'} todo={currentTodo} onSave={saveTodo} onClose={() => setEditor(null)} />}
    </>
  )
}

export default App
