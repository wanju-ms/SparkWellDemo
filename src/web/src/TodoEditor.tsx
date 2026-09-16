import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertCircle, Check, Circle, LoaderCircle, Save, X } from 'lucide-react'
import { TodoClientError } from '../client/todo-client'
import type { Todo, TodoInput, TodoUpdate } from '../client/todo-client'
import { characterCount, DEFAULT_STATUS, TODO_LIMITS, validateTodo } from '../client/todo-item'
import CreatedAt from './CreatedAt'

type Props = { todo?: Todo; onSave: (input: TodoUpdate) => Promise<void>; onClose: () => void }

function localDeadline(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export default function TodoEditor({ todo, onSave, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const savingRef = useRef(false)
  const [draft, setDraft] = useState<TodoInput>(() => ({
    task: todo?.task ?? '', description: todo?.description ?? '',
    status: todo?.status === 'completed' ? 'completed' : DEFAULT_STATUS,
    dueAt: todo?.dueAt ?? null,
  }))
  const [deadline, setDeadline] = useState(() => localDeadline(todo?.dueAt))
  const [deadlineError, setDeadlineError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [taskTouched, setTaskTouched] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const errors = validateTodo(draft)
  const overdue = todo?.status === 'overdue'

  useEffect(() => {
    const modal = dialog.current!
    modal.showModal()
    return () => modal.close()
  }, [])

  function updateDraft(patch: Partial<TodoInput>) {
    setDraft(current => ({ ...current, ...patch }))
    setFailure(null)
  }

  function changeDeadline(value: string, invalid = false) {
    setDeadline(value)
    const date = value ? new Date(value) : null
    const valid = !invalid && (!date || (!Number.isNaN(date.getTime()) && localDeadline(date.toISOString()) === value))
    setDeadlineError(!valid)
    if (valid) updateDraft({ dueAt: date?.toISOString() ?? null })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setTaskTouched(true)
    if (savingRef.current || Object.keys(errors).length || deadlineError) return
    savingRef.current = true
    setSaving(true)
    setFailure(null)
    try {
      const input: TodoUpdate = { task: draft.task, description: draft.description, dueAt: draft.dueAt }
      if (!overdue) input.status = draft.status
      await onSave(input)
      onClose()
    } catch (error) {
      setFailure(error instanceof TodoClientError ? error.message : 'Could not reach the service. Try again.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const taskError = (taskTouched || draft.task.length > 0) ? errors.task : undefined

  return <dialog ref={dialog} className="editor-modal" aria-labelledby="editor-title"
    onCancel={event => { event.preventDefault(); if (!savingRef.current) onClose() }}
    onClick={event => { if (event.target === event.currentTarget && !savingRef.current) onClose() }}>
    <form onSubmit={submit} noValidate>
      <div className="modal-heading"><h2 id="editor-title">{todo ? 'Edit todo' : 'New todo'}</h2>
        <button className="icon-button" type="button" aria-label="Close editor" title="Close editor" disabled={saving} onClick={onClose}><X size={20} /></button>
      </div>
      <fieldset className="editor-fields" disabled={saving}>
        <div className="field">
          <div className="field-heading"><label htmlFor="todo-task">Task</label><span className={errors.task && draft.task ? 'counter invalid' : 'counter'}>{characterCount(draft.task)} / {TODO_LIMITS.task}</span></div>
          <textarea id="todo-task" value={draft.task} onChange={event => updateDraft({ task: event.target.value })} onBlur={() => setTaskTouched(true)} rows={2} autoFocus aria-invalid={Boolean(taskError)} aria-describedby={taskError ? 'task-error' : undefined} />
          {taskError && <p className="field-error" id="task-error">{taskError}</p>}
        </div>
        <div className="field">
          <div className="field-heading"><label htmlFor="todo-description">Description <span className="optional">Optional</span></label><span className={errors.description ? 'counter invalid' : 'counter'}>{characterCount(draft.description)} / {TODO_LIMITS.description}</span></div>
          <textarea id="todo-description" value={draft.description} onChange={event => updateDraft({ description: event.target.value })} rows={4} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? 'description-error' : undefined} />
          {errors.description && <p className="field-error" id="description-error">{errors.description}</p>}
        </div>
        <div className="field">
          <div className="field-heading"><label htmlFor="todo-due-at">Due at</label>{!deadline && <span className="optional">No deadline</span>}</div>
          <div className="deadline-input">
            <input id="todo-due-at" type="datetime-local" value={deadline} onChange={event => changeDeadline(event.target.value, event.target.validity.badInput)} aria-invalid={deadlineError} aria-describedby={deadlineError ? 'deadline-error' : undefined} />
            <button className="icon-button" type="button" title="Clear deadline" aria-label="Clear deadline" onClick={() => changeDeadline('')} disabled={!deadline}><X size={17} /></button>
          </div>
          {deadlineError && <p id="deadline-error" className="field-error">Enter a valid local date and time.</p>}
        </div>
        <fieldset className="status-field"><legend>Status</legend>{overdue
          ? <span className="status-label overdue" role="status">Overdue</span>
          : <div className="status-options">
          <label className={draft.status === 'incomplete' ? 'selected' : ''}><input type="radio" name="status" value="incomplete" checked={draft.status === 'incomplete'} onChange={() => updateDraft({ status: 'incomplete' })} /><Circle size={16} />Incomplete</label>
          <label className={draft.status === 'completed' ? 'selected' : ''}><input type="radio" name="status" value="completed" checked={draft.status === 'completed'} onChange={() => updateDraft({ status: 'completed' })} /><Check size={17} />Completed</label>
        </div>}</fieldset>
        <CreatedAt value={todo ? todo.createdAt : null} />
      </fieldset>
      {failure && <div className="save-error" role="alert"><AlertCircle size={18} /><span>{failure}</span></div>}
      <footer className="modal-footer"><button className="button secondary" type="button" disabled={saving} onClick={onClose}>Cancel</button>
        <button className="button primary" type="submit" disabled={saving || Object.keys(errors).length > 0 || deadlineError}>{saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{saving ? 'Saving' : 'Save todo'}</button>
      </footer>
    </form>
  </dialog>
}