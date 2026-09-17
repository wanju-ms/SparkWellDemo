import { expect, test } from '@playwright/test'

test('create, reload, edit, cancel, validation, and responsive layout use the real service', async ({ page }, testInfo) => {
  const task = `Review ${testInfo.project.name} release`
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'New todo', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'New todo', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Not created yet', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Save todo' })).toBeDisabled()
  await expect(dialog.getByRole('radio', { name: 'Incomplete', exact: true })).toBeChecked()
  await dialog.getByLabel('Task', { exact: true }).fill(task)
  await dialog.getByLabel('Description', { exact: false }).fill('Check the shared API and both apps.')
  await dialog.getByRole('button', { name: 'Save todo' }).click()
  await expect(dialog).not.toBeVisible()
  let row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: task, exact: true }) })
  await expect(row).toContainText('Incomplete')
  await expect(row.locator('time')).toBeVisible()
  const createdAt = await row.locator('time').getAttribute('datetime')
  expect(createdAt).toBeTruthy()
  await page.reload()
  await expect(row).toBeVisible()
  await expect(row.locator('time')).toHaveAttribute('datetime', createdAt!)
  await row.getByRole('button', { name: `Edit ${task}`, exact: true }).click()
  await expect(dialog.locator('time')).toHaveAttribute('datetime', createdAt!)
  await dialog.getByLabel('Task', { exact: true }).fill('Unsaved changes')
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(row).toContainText(task)
  await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0)
  await row.getByRole('button', { name: `Edit ${task}`, exact: true }).click()
  await expect(dialog.getByLabel('Task', { exact: true })).toHaveValue(task)
  await dialog.getByLabel('Task', { exact: true }).fill('a'.repeat(301))
  await expect(dialog.getByText('Use 300 characters or fewer.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Save todo' })).toBeDisabled()
  await expect(dialog.getByLabel('Task', { exact: true })).toHaveValue('a'.repeat(301))
  await dialog.getByLabel('Task', { exact: true }).fill('a'.repeat(300))
  await dialog.getByLabel('Description', { exact: false }).fill('b'.repeat(1001))
  await expect(dialog.getByText('Use 1000 characters or fewer.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Save todo' })).toBeDisabled()
  await dialog.getByLabel('Description', { exact: false }).fill('b'.repeat(1000))
  await expect(dialog.getByRole('button', { name: 'Save todo' })).toBeEnabled()
  await dialog.getByLabel('Task', { exact: true }).fill(`${task} complete`)
  await dialog.getByLabel('Description', { exact: false }).fill('Ready for review.')
  await dialog.getByRole('radio', { name: 'Completed', exact: true }).check()
  await page.screenshot({ path: testInfo.outputPath('editor.png'), fullPage: true, animations: 'disabled' })
  await dialog.getByRole('button', { name: 'Save todo' }).click()
  await expect(dialog).not.toBeVisible()
  row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: `${task} complete`, exact: true }) })
  await expect(row).toContainText('Completed')
  await expect(row.locator('time')).toHaveAttribute('datetime', createdAt!)
  await page.reload()
  await expect(row).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('todos.png'), fullPage: true, animations: 'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('loading failures can be retried and are not presented as an empty list', async ({ page }) => {
  await page.route('**/todos', route => route.fulfill({ status: 500, json: { code: 'service_error', message: 'Unavailable' } }))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Could not load todos')
  await expect(page.getByText('No todos yet')).toHaveCount(0)
  await page.unroute('**/todos')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('button', { name: 'New todo', exact: true })).toBeEnabled()
})

test('pending saves cannot close the modal and failed saves keep the draft', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New todo', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Task', { exact: true }).fill('Preserve this draft')
  await expect(dialog.getByText('Not created yet', { exact: true })).toBeVisible()
  let releaseSave!: () => void
  const pending = new Promise<void>(resolve => { releaseSave = resolve })
  await page.route('**/todos', async route => {
    if (route.request().method() !== 'POST') return route.continue()
    await pending
    await route.fulfill({ status: 500, json: { code: 'service_error', message: 'Could not save. Try again.' } })
  })
  await dialog.getByRole('button', { name: 'Save todo' }).click()
  await expect(dialog.getByRole('button', { name: 'Saving', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Close editor' })).toBeDisabled()
  await expect(dialog.getByText('Not created yet', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  releaseSave()
  await expect(dialog.getByRole('alert')).toContainText('Could not save')
  await expect(dialog.getByText('Not created yet', { exact: true })).toBeVisible()
  await expect(dialog.getByLabel('Task', { exact: true })).toHaveValue('Preserve this draft')
  await expect(page.getByRole('listitem').filter({ hasText: 'Preserve this draft' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).not.toBeVisible()
})

test.describe('creation time display', () => {
  test.use({ locale: 'en-GB', timezoneId: 'America/Los_Angeles' })

  test('uses a read-only column and local absolute time without changing input or order', async ({ page }, testInfo) => {
    const todos = [
      { id: 'first', task: 'Review the release', description: 'Ready for review.', status: 'incomplete', createdAt: '2026-09-15T00:05:06.123Z' },
      { id: 'second', task: 'Earlier task', description: '', status: 'completed', createdAt: '2026-09-14T00:05:06.123Z' },
    ]
    await page.route('**/todos', route => route.fulfill({ json: todos }))
    await page.goto('/')
    await expect(page.getByRole('listitem').getByRole('heading')).toHaveText(['Review the release', 'Earlier task'])
    const row = page.getByRole('listitem').first()
    await expect(row.locator('time')).toHaveText('14 Sept 2026, 17:05')
    await expect(row.locator('time')).toHaveAttribute('datetime', todos[0].createdAt)
    const columnLayout = await row.evaluate(element => {
      const content = element.querySelector('.todo-content')!.getBoundingClientRect()
      const column = element.querySelector('.created-at')!.getBoundingClientRect()
      return column.left >= content.right && Math.abs(column.top - content.top) < 2
    })
    expect(columnLayout).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath('creation-time-list.png'), fullPage: true, animations: 'disabled' })

    await row.getByRole('button', { name: 'Edit Review the release' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.locator('time')).toHaveText('14 Sept 2026, 17:05')
    await expect(dialog.locator('.created-at input, .created-at textarea, .created-at select')).toHaveCount(0)
    await dialog.getByLabel('Task', { exact: true }).fill('An unsaved edit')
    await expect(dialog.locator('time')).toHaveAttribute('datetime', todos[0].createdAt)
    await page.route('**/todos/first', async route => {
      expect(route.request().postDataJSON()).toEqual({ task: 'An unsaved edit', description: 'Ready for review.', status: 'incomplete', dueAt: null })
      await route.fulfill({ status: 500, json: { code: 'service_error', message: 'Could not save. Try again.' } })
    })
    await dialog.getByRole('button', { name: 'Save todo' }).click()
    await expect(dialog.getByRole('alert')).toContainText('Could not save')
    await expect(dialog.locator('time')).toHaveText('14 Sept 2026, 17:05')
    await expect(dialog.locator('time')).toHaveAttribute('datetime', todos[0].createdAt)
    await page.screenshot({ path: testInfo.outputPath('creation-time-editor.png'), fullPage: true, animations: 'disabled' })
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(row.getByRole('heading')).toHaveText('Review the release')
  })
})

test('a past deadline becomes read-only overdue and clearing it recovers through the real API', async ({ page }, testInfo) => {
  const task = `Overdue ${testInfo.project.name}`
  await page.goto('/')
  await page.getByRole('button', { name: 'New todo', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Task', { exact: true }).fill(task)
  await dialog.getByLabel('Due at', { exact: true }).fill('2020-01-01T12:00')
  await dialog.getByRole('button', { name: 'Save todo' }).click()
  await expect(dialog).not.toBeVisible()
  const row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: task, exact: true }) })
  await expect(row.locator('.status-label')).toHaveText('Overdue')
  await expect(row.locator('.due-at-column time')).toBeVisible()
  await row.getByRole('button', { name: `Edit ${task}`, exact: true }).click()
  await expect(dialog.getByRole('radio')).toHaveCount(0)
  await expect(dialog.getByRole('status')).toHaveText('Overdue')
  await dialog.getByRole('button', { name: 'Clear deadline' }).click()
  await expect(dialog.getByRole('status')).toHaveText('Overdue')
  await expect(dialog.getByLabel('Due at', { exact: true })).toHaveValue('')
  await page.screenshot({ path: testInfo.outputPath('overdue-editor.png'), animations: 'disabled' })
  const requestPromise = page.waitForRequest(request => request.method() === 'PUT')
  await dialog.getByRole('button', { name: 'Save todo' }).click()
  expect((await requestPromise).postDataJSON()).toEqual({ task, description: '', dueAt: null })
  await expect(dialog).not.toBeVisible()
  await expect(row.locator('.status-label')).toHaveText('Incomplete')
  await expect(row.locator('.due-at-column')).toContainText('No deadline')
  await row.getByRole('button', { name: `Edit ${task}`, exact: true }).click()
  await expect(dialog.getByRole('radio', { name: 'Completed', exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('deadline-list.png'), fullPage: true, animations: 'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test.describe('overdue synchronization', () => {
  test.use({ timezoneId: 'UTC', locale: 'en-GB' })

  test('polling refreshes system state without replacing a draft and pauses in background', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-09-15T11:59:58Z') })
    let current = { id: 'polling', task: 'Polling task', description: 'Original', status: 'incomplete', dueAt: '2026-09-15T12:00:00Z', createdAt: '2026-09-14T09:00:00Z' }
    let reads = 0
    let fail = false
    await page.route('**/todos', route => {
      reads += 1
      return route.fulfill({ status: fail ? 500 : 200, json: fail ? { code: 'service_error', message: 'Offline' } : [current] })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Edit Polling task', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Task', { exact: true }).fill('Unsaved task')
    await dialog.getByLabel('Due at', { exact: true }).fill('2035-01-01T10:00')
    current = { ...current, status: 'overdue' }
    await page.clock.fastForward(5000)
    await expect(dialog.getByRole('status')).toHaveText('Overdue')
    await expect(dialog.getByLabel('Task', { exact: true })).toHaveValue('Unsaved task')
    await expect(dialog.getByLabel('Due at', { exact: true })).toHaveValue('2035-01-01T10:00')
    await expect(dialog.getByRole('radio')).toHaveCount(0)
    fail = true
    await page.clock.fastForward(5000)
    await expect(page.locator('.refresh-error')).toContainText('Could not refresh')
    await expect(page.getByRole('listitem').getByRole('heading')).toHaveText('Polling task')
    await expect(dialog.getByLabel('Task', { exact: true })).toHaveValue('Unsaved task')
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    const backgroundReads = reads
    await page.clock.fastForward(15000)
    expect(reads).toBe(backgroundReads)
    fail = false
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect(page.locator('.refresh-error')).toHaveCount(0)
    expect(reads).toBeGreaterThan(backgroundReads)
  })

  test('a status conflict preserves edits and retries recovery without a manual status', async ({ page }) => {
    const current = { id: 'conflict', task: 'Conflict task', description: '', status: 'incomplete', dueAt: '2026-09-15T12:00:00Z', createdAt: '2026-09-14T09:00:00Z' }
    await page.route('**/todos', route => route.fulfill({ json: [current] }))
    await page.goto('/')
    await page.getByRole('button', { name: 'Edit Conflict task', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Task', { exact: true }).fill('Preserved edit')
    await dialog.getByRole('radio', { name: 'Completed', exact: true }).check()
    let attempts = 0
    await page.route('**/todos/conflict', route => {
      attempts += 1
      const body = route.request().postDataJSON()
      if (attempts === 1) {
        expect(body).toMatchObject({ task: 'Preserved edit', status: 'completed' })
        return route.fulfill({ status: 409, json: { code: 'status_conflict', message: 'Deadline passed.', current: { ...current, status: 'overdue' } } })
      }
      expect(body).toEqual({ task: 'Preserved edit', description: '', dueAt: null })
      return route.fulfill({ json: { ...current, ...body, status: 'incomplete' } })
    })
    await dialog.getByRole('button', { name: 'Save todo' }).click()
    await expect(dialog.getByRole('alert')).toContainText('Deadline passed')
    await expect(dialog.getByRole('status')).toHaveText('Overdue')
    await expect(dialog.getByLabel('Task', { exact: true })).toHaveValue('Preserved edit')
    await dialog.getByRole('button', { name: 'Clear deadline' }).click()
    await dialog.getByRole('button', { name: 'Save todo' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByRole('listitem').getByRole('heading')).toHaveText('Preserved edit')
  })
})

test.describe('deletion', () => {
  test('confirmation, cancellation, and deletion of every status use the real API', async ({ page, request }, testInfo) => {
    const api = 'http://127.0.0.1:43100'
    await page.goto('/')
    for (const status of ['incomplete', 'completed', 'overdue']) {
      const task = `Delete ${status} ${testInfo.project.name}`
      const created = await request.post(`${api}/todos`, { data: {
        task, description: 'Only this record is removed.', status: status === 'completed' ? 'completed' : 'incomplete',
        dueAt: status === 'overdue' ? '2020-01-01T00:00:00Z' : null,
      } })
      const todo = await created.json()
      await page.getByRole('button', { name: 'Reload todos', exact: true }).click()
      const row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: task, exact: true }) })
      await row.getByRole('button', { name: `Delete ${task}`, exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Delete todo?' })
      await expect(dialog).toContainText(task)
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(row).toBeVisible()
      expect((await (await request.get(`${api}/todos`)).json()).some((entry: { id: string }) => entry.id === todo.id)).toBe(true)
      await row.getByRole('button', { name: `Delete ${task}`, exact: true }).click()
      await page.screenshot({ path: testInfo.outputPath(`delete-${status}.png`), fullPage: true, animations: 'disabled' })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await dialog.getByRole('button', { name: 'Delete todo', exact: true }).click()
      await expect(dialog).not.toBeVisible()
      await expect(row).toHaveCount(0)
      expect((await request.delete(`${api}/todos/${todo.id}`)).status()).toBe(204)
      await page.reload()
      await expect(row).toHaveCount(0)
    }
  })

  test('pending and failed deletion keep the record and allow a successful retry', async ({ page }) => {
    const todo = { id: 'delete-retry', task: 'Delete only after success', description: '', status: 'incomplete', createdAt: '2026-09-15T09:00:00Z', dueAt: null }
    let removed = false
    let attempts = 0
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    await page.route('**/todos', route => route.fulfill({ json: removed ? [] : [todo] }))
    await page.route('**/todos/delete-retry', async route => {
      attempts += 1
      expect(route.request().method()).toBe('DELETE')
      if (attempts === 1) {
        await held
        return route.fulfill({ status: 500, json: { code: 'service_error', message: 'Could not delete. Try again.' } })
      }
      removed = true
      await route.fulfill({ status: 204 })
    })
    await page.goto('/')
    await page.getByRole('button', { name: `Delete ${todo.task}`, exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete todo?' })
    await dialog.getByRole('button', { name: 'Delete todo', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Deleting', exact: true })).toBeDisabled()
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: `Edit ${todo.task}`, exact: true, includeHidden: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    expect(attempts).toBe(1)
    release()
    await expect(dialog.getByRole('alert')).toContainText('Could not delete')
    await expect(page.locator('.todo-row')).toHaveCount(1)
    await dialog.getByRole('button', { name: 'Retry delete' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByText('No todos yet', { exact: true })).toBeVisible()
    expect(attempts).toBe(2)
  })

  test('an old poll cannot restore a confirmed deletion before the next refresh completes', async ({ page }) => {
    const todo = { id: 'old-delete-poll', task: 'Never restore this record', description: '', status: 'incomplete', createdAt: '2026-09-15T09:00:00Z', dueAt: null }
    let reads = 0
    let releaseOld!: () => void
    let releaseFresh!: () => void
    const old = new Promise<void>(resolve => { releaseOld = resolve })
    const fresh = new Promise<void>(resolve => { releaseFresh = resolve })
    await page.clock.install()
    await page.route('**/todos', async route => {
      reads += 1
      if (reads === 2) {
        await old
        return route.fulfill({ json: [todo] })
      }
      if (reads > 2) {
        await fresh
        return route.fulfill({ json: [] })
      }
      return route.fulfill({ json: [todo] })
    })
    await page.route('**/todos/old-delete-poll', route => route.fulfill({ status: 204 }))
    await page.goto('/')
    await expect(page.getByRole('button', { name: `Delete ${todo.task}`, exact: true })).toBeVisible()
    await page.clock.fastForward(5000)
    await expect.poll(() => reads).toBe(2)
    await page.getByRole('button', { name: `Delete ${todo.task}`, exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete todo', exact: true }).click()
    await expect(page.getByText('No todos yet', { exact: true })).toBeVisible()
    releaseOld()
    await expect.poll(() => reads).toBe(3)
    await expect(page.locator('.todo-row')).toHaveCount(0)
    releaseFresh()
    await expect(page.getByText('No todos yet', { exact: true })).toBeVisible()
  })

  test('refresh resolves a lost deletion response without restoring the record', async ({ page }) => {
    const todo = { id: 'lost-delete-response', task: 'Deletion response lost', description: '', status: 'incomplete', createdAt: '2026-09-15T09:00:00Z', dueAt: null }
    let removed = false
    await page.clock.install()
    await page.route('**/todos', route => route.fulfill({ json: removed ? [] : [todo] }))
    await page.route('**/todos/lost-delete-response', route => {
      removed = true
      return route.abort('failed')
    })
    await page.goto('/')
    await page.getByRole('button', { name: `Delete ${todo.task}`, exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete todo?' })
    await dialog.getByRole('button', { name: 'Delete todo', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('Could not confirm deletion')
    await expect(page.locator('.todo-row')).toHaveCount(1)
    await page.clock.fastForward(5000)
    await expect(dialog).not.toBeVisible()
    await expect(page.getByText('No todos yet', { exact: true })).toBeVisible()
  })

  for (const result of ['poll', 'not-found', 'late-success', 'late-conflict']) {
    test(`keeps the draft when deletion is confirmed by ${result}`, async ({ page }, testInfo) => {
      const todo = { id: 'deleted-edit', task: 'Deleted elsewhere', description: 'Original', status: 'incomplete', createdAt: '2026-09-15T09:00:00Z', dueAt: null }
      let removed = false
      let failRead = false
      let release!: () => void
      const held = new Promise<void>(resolve => { release = resolve })
      await page.clock.install()
      await page.route('**/todos', route => route.fulfill({ status: failRead ? 500 : 200, json: failRead ? { code: 'service_error', message: 'Read failed' } : removed ? [] : [todo] }))
      await page.route('**/todos/deleted-edit', async route => {
        if (result === 'not-found') {
          removed = true
          return route.fulfill({ status: 404, json: { code: 'not_found', message: 'This Todo no longer exists.' } })
        }
        await held
        return result === 'late-conflict'
          ? route.fulfill({ status: 409, json: { code: 'status_conflict', message: 'Old conflict', current: { ...todo, status: 'overdue' } } })
          : route.fulfill({ json: { ...todo, ...route.request().postDataJSON() } })
      })
      await page.goto('/')
      await page.getByRole('button', { name: `Edit ${todo.task}`, exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Edit todo' })
      await dialog.getByLabel('Task', { exact: true }).fill('Keep this unsaved input')
      await dialog.getByLabel('Description', { exact: false }).fill('Available to copy')
      await dialog.getByLabel('Due at', { exact: true }).fill('2035-01-01T10:00')
      if (result !== 'poll') {
        await dialog.getByRole('button', { name: 'Save todo' }).click()
        if (result !== 'not-found') await expect(dialog.getByRole('button', { name: 'Saving', exact: true })).toBeDisabled()
      }
      if (result !== 'not-found') {
        removed = true
        if (result === 'poll') {
          failRead = true
          await page.clock.fastForward(5000)
          await expect(page.locator('.refresh-error')).toBeVisible()
          await expect(dialog.getByText(/This Todo was deleted/)).toHaveCount(0)
          failRead = false
        }
        await page.clock.fastForward(5000)
        await expect(dialog.getByText(/This Todo was deleted/)).toBeVisible()
        release()
      }
      await expect(dialog.getByRole('button', { name: 'Save todo' })).toBeDisabled()
      await expect(dialog.getByLabel('Task', { exact: true })).toHaveValue('Keep this unsaved input')
      await expect(dialog.getByLabel('Description', { exact: false })).toHaveValue('Available to copy')
      await expect(dialog.getByLabel('Task', { exact: true })).toBeEnabled()
      await expect(dialog.getByLabel('Task', { exact: true })).toHaveJSProperty('readOnly', true)
      await expect(dialog.getByLabel('Due at', { exact: true })).toHaveValue('2035-01-01T10:00')
      await expect(page.locator('.todo-row')).toHaveCount(0)
      await expect(dialog.getByText(/This Todo was deleted/)).toBeInViewport()
      await page.screenshot({ path: testInfo.outputPath(`deleted-draft-${result}.png`), fullPage: true, animations: 'disabled' })
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
      await page.getByRole('button', { name: 'New todo', exact: true }).click()
      await expect(page.getByRole('dialog').getByLabel('Task', { exact: true })).toHaveValue('')
    })
  }
})