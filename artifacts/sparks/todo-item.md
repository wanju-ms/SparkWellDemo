---
id: todo-item
description: "Defines Todo fields, stable identity, validity rules, and deadline-based status transitions."
kind: spark
spark-type: data
---

# Todo Item

A Todo is one independently editable task. Text length counts user-perceived
characters (Unicode grapheme clusters), not bytes or encoding units.

| Field | Type | Meaning / Rule |
| --- | --- | --- |
| `id` | Opaque identifier | Unique within the Todo collection and unchanged by edits. Distinguishes records even when their business fields are identical. |
| `task` | Text | At most 300 characters; must contain non-whitespace text. |
| `description` | Text | At most 1,000 characters; may be empty. |
| `status` | Enum | `incomplete`, `completed`, or `overdue`. Defaults to `incomplete`; only the system can enter or leave `overdue`. |
| `createdAt` | UTC timestamp | Required for a created Todo. Records its first successful creation time, is immutable, and is serialized in RFC 3339 format. |
| `dueAt` | UTC timestamp or null | Editable deadline, serialized in RFC 3339 format. Defaults to null, meaning no deadline; existing records without the field have the same meaning. Past deadlines are allowed. |

## Status Changes

- Using authoritative service time `now`, an `incomplete` Todo becomes `overdue`
	when `dueAt` is set and `now > dueAt`, including during creation or update.
- A `completed` Todo does not become overdue. Changing it to `incomplete` applies
	the same deadline rule to the resulting state.
- An `overdue` Todo returns to `incomplete` after a successful deadline change
	clears `dueAt` or sets it to a time greater than or equal to `now`. Otherwise it
	stays overdue, including on content-only edits. Manual status changes are
	available again only after this recovery is saved.