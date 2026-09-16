---
id: todo-app
description: "Lists Todos with their time fields and coordinates editing and foreground refresh."
kind: spark
spark-type: ui
role: root
composes: [todo-editor]
uses: [todo-item, todo-service]
---

# Todo App

## Todos and Loading

- Display each [Todo Item](todo-item.md)'s task, description, and server-reported status, with a
  New action and an Edit action for each item.
- Show read-only `createdAt` and `dueAt` columns in each Todo row without changing
  list order. The list and editor label them "Created at" and "Due at" and use
  absolute dates with hours and minutes in the device's current locale and time
  zone; stored timestamps are unchanged. An absent deadline displays "No deadline".
- Keep the displayed collection as an in-memory snapshot of results supplied by
  [Todo Service](todo-service.md).
- On opening the App, call the service's `list` operation and display a loading
  state. A successful result populates the snapshot; an empty result shows an
  empty list.
- An initial load failure shows an error with a Retry action, not an empty-list
  result. Retry calls `list` again.
- While in the foreground, poll `list` every 5 seconds and refresh immediately
  on returning to the foreground; pause periodic polling in the background.
  A refresh failure retains the current snapshot, shows a refresh error, and
  leaves subsequent polling and manual retry available.

## Editing and Saving

1. New opens [Todo Editor](todo-editor.md) in creation mode; Edit supplies the selected Todo in editing mode.
2. When the editor submits validated input, call `create` with its editable fields or `update` with the selected ID and those fields according to the service contract. Draft changes and pending writes do not optimistically alter the list.
3. On success, insert the returned Todo or replace the item with the matching ID,
   then report success to the editor. The service result supplies the displayed
   values; a draft is not a saved record.
4. On failure, pass the error to the editor without applying requested edits. If the response includes a current record for a status conflict, apply it through the synchronization flow; a later submission follows the same save flow.

Canceling or dismissing the editor causes no user write or draft-based list
update. Apply polling, save, and conflict results using
[Todo Expiration Sync](../collaborations/todo-expiration-sync.md), keeping the
editor's saved status separate from its working input.