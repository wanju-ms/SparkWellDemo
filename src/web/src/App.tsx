import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, CheckCircle2, Circle, ListTodo, LoaderCircle, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
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
  const [deletion, setDeletion] = useState<{ todo: Todo; pending: boolean; error: string | null } | null>(null)
  const snapshot = useRef<Todo[]>([])
  const deletedIds = useRef(new Set<string>())
  const deletingId = useRef<string | null>(null)
  const poller = useRef<ReturnType<typeof createTodoPoller> | null>(null)
  const completed = todos.filter(todo => todo.status === 'completed').length
  const currentTodo = editor?.todo ? todos.find(todo => todo.id === editor.todo!.id) ?? editor.todo : undefined

  useEffect(() => {
    const refresh = createTodoPoller(client.list, loaded => {
      const present = new Set(loaded.map(todo => todo.id))
      for (const todo of snapshot.current) {
        if (!present.has(todo.id)) deletedIds.current.add(todo.id)
      }
      snapshot.current = loaded.filter(todo => !deletedIds.current.has(todo.id))
      setTodos(snapshot.current)
      setDeletion(current => current && deletedIds.current.has(current.todo.id) ? null : current)
      if (deletingId.current && deletedIds.current.has(deletingId.current)) deletingId.current = null
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
    if (deletedIds.current.has(saved.id)) return false
    poller.current?.invalidate()
    snapshot.current = snapshot.current.some(todo => todo.id === saved.id)
      ? snapshot.current.map(todo => todo.id === saved.id ? saved : todo)
      : [...snapshot.current, saved]
    setTodos(snapshot.current)
    return true
  }

  function removeRecord(id: string) {
    deletedIds.current.add(id)
    poller.current?.invalidate()
    snapshot.current = snapshot.current.filter(todo => todo.id !== id)
    setTodos(snapshot.current)
    setDeletion(current => current?.todo.id === id ? null : current)
    if (deletingId.current === id) deletingId.current = null
  }

  function cancelDeletion() {
    if (!deletingId.current) setDeletion(null)
  }

  async function deleteTodo() {
    if (!deletion || deletingId.current) return
    const target = deletion.todo
    deletingId.current = target.id
    setDeletion({ todo: target, pending: true, error: null })
    try {
      await client.delete(target.id)
      removeRecord(target.id)
    } catch (error) {
      if (!deletedIds.current.has(target.id)) {
        const message = error instanceof TodoClientError ? error.message : 'Could not confirm deletion. Retry or reload to check.'
        setDeletion(current => current?.todo.id === target.id ? { ...current, pending: false, error: message } : current)
      }
    } finally {
      if (deletingId.current === target.id) deletingId.current = null
    }
  }

  async function saveTodo(input: TodoUpdate) {
    const target = editor?.todo
    try {
      if (target && deletedIds.current.has(target.id)) throw new TodoClientError(404, { code: 'not_found', message: 'This Todo was deleted.' })
      const saved = target ? await client.update(target.id, input) : await client.create({ ...input, status: input.status ?? DEFAULT_STATUS })
      if (!applyRecord(saved)) throw new TodoClientError(404, { code: 'not_found', message: 'This Todo was deleted.' })
    } catch (error) {
      if (target && error instanceof TodoClientError && error.status === 404) removeRecord(target.id)
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
            <div className="row-actions">
              <button className="icon-button edit-button" aria-label={`Edit ${todo.task}`} title="Edit todo" disabled={deletion?.todo.id === todo.id && deletion.pending} onClick={() => setEditor({ todo })}><Pencil size={17} /></button>
              <button className="icon-button delete-button" aria-label={`Delete ${todo.task}`} title="Delete todo" disabled={deletion?.todo.id === todo.id && deletion.pending} onClick={() => setDeletion({ todo, pending: false, error: null })}><Trash2 size={17} /></button>
            </div>
          </li>)}
        </ul>}
      </main>
      {editor && <TodoEditor key={editor.todo?.id ?? 'new'} todo={currentTodo} deleted={!!editor.todo && !todos.some(todo => todo.id === editor.todo!.id)} onSave={saveTodo} onClose={() => setEditor(null)} />}
      {deletion && <DeleteTodoDialog todo={deletion.todo} pending={deletion.pending} error={deletion.error} onConfirm={deleteTodo} onCancel={cancelDeletion} />}
    </>
  )
}

function DeleteTodoDialog({ todo, pending, error, onConfirm, onCancel }: {
  todo: Todo; pending: boolean; error: string | null; onConfirm: () => void; onCancel: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const modal = dialog.current!
    modal.showModal()
    return () => modal.close()
  }, [])

  return <dialog ref={dialog} className="editor-modal delete-modal" aria-labelledby="delete-title"
    onCancel={event => { event.preventDefault(); if (!pending) onCancel() }}
    onClick={event => { if (event.target === event.currentTarget && !pending) onCancel() }}>
    <div className="modal-heading"><h2 id="delete-title">Delete todo?</h2></div>
    <div className="delete-details"><p className="delete-target">{todo.task}</p><p>This cannot be undone.</p></div>
    {error && <div className="save-error" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
    <div className="modal-footer">
      <button className="button secondary" disabled={pending} onClick={onCancel} autoFocus>Cancel</button>
      <button className="button danger" disabled={pending} onClick={onConfirm}>
        {pending ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={17} />}
        {pending ? 'Deleting' : error ? 'Retry delete' : 'Delete todo'}
      </button>
    </div>
  </dialog>
}

export default App
