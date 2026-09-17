---
id: todo-editor
description: "Edits Todo content and deadlines in a modal while keeping system state and unsaved input separate."
kind: spark
spark-type: ui
uses: [todo-item]
---

# Todo Editor

## Modal and Draft

- Use a modal for creating and editing Todos, with task and description inputs,
  a clearable `dueAt` date-time selector, manual status controls, and Save/Cancel.
- For creation, initialize a local draft with empty task and description fields
  and the status and deadline defaults defined by [Todo Item](todo-item.md).
- For editing, initialize task, description, and deadline input from the supplied
  Todo, along with a manual status choice when permitted. Keep the saved current
  status, target ID, and read-only `createdAt` separate from working input.
- Draft changes do not mutate the supplied record. Each opening initializes a
  new draft from the creation defaults or the supplied current Todo.
- Enter deadlines in the device's current time zone and convert them to the
  model's UTC representation for submission; clearing the selector submits null.
- Below the status selector, show the supplied `createdAt` as read-only text
  using [Todo App's display convention](todo-app.md), or "Not created yet" for a
  new Todo, including while saving or after failure.

## Validation and Saving

- Validate input against Todo Item's field rules. Allow invalid text to remain
  visible, show field errors, and prevent saving while invalid. Do not silently
  truncate typed or pasted text. Invalid deadline input also blocks submission.
- Offer only Todo Item's manual status choices. When the saved current status is
  overdue, show it read-only while leaving content and deadline edits available;
  changing draft input alone does not unlock the status control.
- Save submits task, description, and `dueAt`, plus a manual status only when
  editable, and the target ID when updating. The App performs the service call
  and supplies its outcome; submission alone is not a saved result.
- While a save is pending, prevent repeated submission and all modal closing
  actions.
- A successful save outcome closes the modal and clears the draft. A failed
  outcome keeps the modal open with the draft and error available for correction
  or retry.
- Consume current-status refreshes and status conflicts using
  [Todo Expiration Sync](../collaborations/todo-expiration-sync.md); preserve
  unsaved input while responding to changes in which actions are permitted.
- If the App confirms the edited record is deleted, show a notice and disable Save, including retries.
  Keep the draft available for viewing or copying until the user closes the modal.
  Do not turn it into a new Todo.
- Outside a pending save, Cancel or any other dismissal discards the draft
  without submitting it.