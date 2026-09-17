---
id: todo-service
description: "Loads and saves Todos and provides atomic status transitions for client requests and background checks."
kind: spark
spark-type: service
uses: [todo-item]
---

# Todo Service

## Saved Data

The service owns the authoritative Todo collection and the provider that actually
reads and writes it. The current demo uses a Node.js HTTP server with one
in-memory collection shared by the web and iOS clients. The server starts empty;
data survives client reloads and restarts while that server process runs, but
is lost when the server restarts. Client snapshots are not the authority.

## Operations

Inputs and returned records follow [Todo Item](todo-item.md).

| Operation | Input | Successful Output | Behavior |
| --- | --- | --- | --- |
| `list` | None | All saved Todo records | Reconcile overdue state before reading the collection, including stored `createdAt` and `dueAt`. Return an empty collection when no records exist; report an error if reconciliation or loading fails. |
| `create` | `task`, `description`, `status`; optional `dueAt` | The complete saved Todo | Allocate an ID following Todo Item's identity rules, assign `createdAt` from the server clock, and resolve the input's status using the deadline rules before saving. |
| `update` | `id`, `task`, `description`; optional `status` and `dueAt` | The complete saved Todo | Reconcile the current record, apply permitted edits, and resolve its resulting status while retaining `createdAt`. A missing target returns a not-found error, not a newly created record. |
| `delete` | `id` | Success confirmation | Remove the record in any status. Return success only after removal, or if the ID is already absent. Report storage failures. |

- Validate create and update inputs against Todo Item's rules even when the caller already
  validated them. Invalid input returns a validation error without committing
  any requested edits. Reject client-supplied `createdAt` and `status: overdue`.
- Creation with omitted `dueAt` uses Todo Item's default. On update, omitted
  `dueAt` retains the saved deadline and null clears it; omitted `status` is
  resolved from the saved state and Todo Item's transition rules.
- If the reconciled current status is overdue and an update supplies a manual
  status, reject the edits with a status-conflict error containing the latest
  complete record. This also applies to a request prepared before the deadline.
- Recheck the latest record and service clock when committing any status change.
  Client writes and background transitions are serialized and atomic per Todo. A failed write
  leaves no partial changes from that operation; independently committed system
  transitions are not rolled back by a rejected or failed client request.
- Deletion removes the record from later reads, with no undo or recycle bin.
  Updates and background checks cannot recreate it.

## Internal Checks

| Capability | Input | Result |
| --- | --- | --- |
| `overdueCandidates` | None | IDs of saved Todos that meet Todo Item's overdue condition at the service's current time. |
| `markOverdue` | Todo ID | Recheck the latest record and clock, then atomically apply the overdue transition if still eligible. Return the resulting record, or an unchanged/not-found result; report storage failures. |

These are internal capabilities, not client HTTP operations. They use the same
status rules as read/write reconciliation; a candidate is not permission to
overwrite a newer completion or deadline. Clients obtain changes through `list`,
without a push or subscription endpoint. Cross-participant ordering is described
in [Todo Expiration Sync](../collaborations/todo-expiration-sync.md).

## Deferred Persistence

Durable storage remains a product goal beyond this demo: saved records must
survive application and server closure and be available to later loads. The demo
provider does not fulfill that guarantee. The durable storage technology remains
open.