import type { TodoUpdate } from './todo-client.ts'

export const TODO_LIMITS = { task: 300, description: 1000 } as const
export const DEFAULT_STATUS = 'incomplete' as const
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })

export function characterCount(value: string): number {
  return [...segmenter.segment(value)].length
}

export function validateTodo(input: TodoUpdate): Partial<Record<keyof TodoUpdate, string>> {
  const errors: Partial<Record<keyof TodoUpdate, string>> = {}
  if (!input.task.trim()) errors.task = 'Enter a task.'
  else if (characterCount(input.task) > TODO_LIMITS.task) errors.task = `Use ${TODO_LIMITS.task} characters or fewer.`
  if (characterCount(input.description) > TODO_LIMITS.description) {
    errors.description = `Use ${TODO_LIMITS.description} characters or fewer.`
  }
  if (input.status !== undefined && !['incomplete', 'completed'].includes(input.status)) errors.status = 'Choose a valid status.'
  if (input.dueAt != null && !Number.isFinite(Date.parse(input.dueAt))) errors.dueAt = 'Enter a valid date and time.'
  return errors
}