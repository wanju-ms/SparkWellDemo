---
id: todo-expiration-sync
description: "Coordinates overdue monitoring, atomic transitions, polling, and editor conflict recovery."
kind: collaboration
participants: [todo-expiration-monitor, todo-service, todo-app, todo-editor]
---

# Todo Expiration Sync

## Detection and Commit

1. [Todo Expiration Monitor](../sparks/todo-expiration-monitor.md) independently asks [Todo Service](../sparks/todo-service.md) for candidates and requests their transition. Each request rechecks the latest record before committing; a candidate completed or postponed in the meantime is left unchanged.
  If a candidate no longer exists, skip it rather than retrying it as a failed transition.
2. Service read/write reconciliation and monitor requests use [Todo Item](../sparks/todo-item.md)'s rules and serialize changes per Todo. A completion committed before eligibility is reached remains completed; a later manual-status request encounters the reconciled state.
3. Only committed state is returned to clients. Failed transitions remain eligible for later checks; neither the monitor nor a failed HTTP request fabricates a successful transition.

## Polling and Editing

- [Todo App](../sparks/todo-app.md) polls the service on its foreground schedule;
  there is no push notification or subscription. Overdue state is not computed
  from the client clock. Background clients catch up when they return.
- Keep one poll in flight and coalesce later refresh requests. Discard a response
  started before a newer applied refresh, successful save, confirmed deletion, or conflict record so
  it cannot overwrite newer state. Scanning, polling, and network delays mean
  the visible change is not instantaneous.
- A fresh snapshot updates the list and [Todo Editor](../sparks/todo-editor.md)'s
  saved current status, not its working content or deadline. Preserve any manual
  status intent separately; it cannot be submitted while the current record is
  overdue.
- If a save reaches the service after the current record became overdue, a
  supplied manual status receives the service's status-conflict result. The App
  applies the returned current record and passes the error to the Editor without
  applying the rejected edits. The Editor retains its draft and shows the current
  status read-only; retry omits manual status and can submit a revised deadline.
  A successful recovery follows the normal save-and-close flow.
- A successful deletion, an accepted full-list snapshot missing a known record, or a not-found update result confirms that the record is gone.
  The App removes it from the list and notifies any editor for that ID.
  A failed refresh does not confirm deletion.
- Ignore late save or conflict results for an ID already confirmed deleted.
  Do not reinsert the record or report save success to the editor.