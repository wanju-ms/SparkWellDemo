# Artifact Document Specification

An Artifact is a maintained unit of model knowledge. Sparks, Constraints,
Aspects, and Collaborations share a Markdown format; `kind` distinguishes their
meaning, not a modeling stage or implementation technology.

## Files and Identity

Store one document per artifact as `<id>.md` in the directory for its `kind`:

| Kind | Directory |
| --- | --- |
| `spark` | `artifacts/sparks/` |
| `constraint` | `artifacts/constraints/` |
| `aspect` | `artifacts/aspects/` |
| `collaboration` | `artifacts/collaborations/` |

The declared `kind` must match its type directory. Create directories only as
needed; subdirectories within each type directory may organize the model without
changing identity or semantics.

Begin with YAML frontmatter delimited by `---`, followed by an H1 and a readable
Markdown body. Use spaces, not tabs, for YAML indentation.

IDs are stable, non-empty lowercase kebab-case strings, unique across all
artifact kinds and folders in the project. Renaming a title or moving a document
does not change its ID. Update affected references when splitting, merging, or
replacing concepts; do not silently change what an existing ID means.

## Common Metadata

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `id` | String | Yes | Stable project-wide artifact identifier |
| `description` | String | Yes | One or two sentences summarizing the current knowledge or responsibility |
| `kind` | String | Yes | One of the four artifact kinds below |
| `spark-type` | String | No | Software-concept category for `kind: spark`, from the supported list below |
| `role` | String | No | `root` on a Spark that provides an entry point to a meaningful software scope |
| `sources` | Array of strings | No | Provenance references such as issue IDs, document paths, or URLs |
| `icon` | String | No | Persistent icon asset, relative to the document or an absolute image URL |
| `image` | String | No | Persistent illustration or design reference, relative to the document or an absolute image URL |

| Kind | Knowledge |
| --- | --- |
| `spark` | An independently meaningful software concept or responsibility, including its local behavior and rules |
| `constraint` | An independently maintained invariant, limit, or commitment with an explicit scope |
| `aspect` | A cross-cutting concern, its requirements, and its applicability scope |
| `collaboration` | Meaningful interaction among multiple Sparks, including their roles and coordination |

All artifacts, including roots, declare `kind`. `spark-type` is optional and
valid only for `kind: spark`. When present, it must be one of these values:

| Spark Type | Meaning |
| --- | --- |
| `ui` | A user-facing interaction space and its behavior |
| `data` | A data concept, its structure, identity, and validity rules |
| `logic` | An internal computation, decision, state-management, or coordination responsibility |
| `service` | A backend, background-processing, or local-resource capability the application relies on, including its contract, behavior, and lifecycle guarantees |

The `service` boundary is relative to the consuming application's internal logic;
it need not be remote, out-of-process, or third-party. A service contract can
describe caller-invoked operations or scheduled and event-driven work. Internal
state management, computation, and coordination do not become services merely
by exposing callable operations.

No other values are supported. Adding a type requires explicit user approval
and a specification update before use. If no type fits, omit the field and
report the classification gap rather than inventing a value or distorting the
concept. Classification does not change the artifact kind, directory, or identity.

A root is optional, does not own every rule, and need not reach every artifact.

The tables in this specification define the supported metadata. Describe other
knowledge in the body; changing the metadata or kind vocabulary requires a
specification change.

## Relationships and Applicability

| Field | Type | Declared by | Meaning |
| --- | --- | --- | --- |
| `uses` | Array of Spark IDs | Spark | Concepts this Spark depends on |
| `composes` | Array of Spark IDs | Spark | Structural parts of this Spark |
| `applies-to` | Array of Spark IDs | Constraint or Aspect | Explicit set of Sparks to which this knowledge applies |
| `scope` | String | Constraint or Aspect | Semantic description of the applicable Sparks, including relevant conditions or exclusions |
| `participants` | Array of Spark IDs | Collaboration | Sparks whose interaction this artifact describes |

References use IDs, not file paths or titles. Every referenced ID must resolve
to the declared target kind. Arrays contain distinct, non-empty strings; scalar
and `null` values are invalid. Omitted optional relationships mean an empty set.
Sources are non-empty strings when present and are not graph edges.

A Constraint or Aspect declares exactly one of a non-empty `applies-to` list or
a non-empty `scope`. Explicit lists enumerate targets. Semantic scope describes
membership, such as "all user-facing interactive Sparks"; it is not a query
language, glob, or executable selector. Resolve it against the current model,
including new or changed Sparks. Unclear applicability needs clarification, not
silent exclusion.

A Collaboration has at least two distinct Spark participants. Roles, sequence,
protocols, and relevant outcomes belong in its body, not in more edge types.
Participation does not imply composition or a dependency between every pair.

Relationships are stored once, on their declaring artifact. Incoming views are
derived, not manually maintained lists on the targets. Applicability does not
automatically propagate through `uses`, `composes`, or `participants`. A Markdown
link in the body does not replace or extend the linked rule's declared scope.
Multiple applicable rules remain in effect together; surface contradictions
rather than inventing precedence.

- `composes` must not form cycles: a Spark cannot directly or indirectly contain
	itself.
- Cycles in `uses` are allowed.

Relationships must match the meanings in the table above. Do not add them just
to connect every artifact to a root.

A relationship or a match through `applies-to` or `scope` does not prove that
the code implements the specified behavior correctly or completely.

## Body and Index

Keep the body concise and independently understandable, without a fixed heading
template. Distinguish intended observable behavior from chosen design mechanisms
where both are described. Keep each rule or decision with one canonical owner
and link to it elsewhere instead of copying it. State unresolved choices as
unresolved, not as accepted design.

Prose, tables, diagrams, state machines, and approved visual references can all
express knowledge. A diagram is a view of the model, not a separate authority or
a reason to create one artifact per shape. Use ordinary document-relative
Markdown links for navigation and detailed references.

Maintain `artifacts/index.md` as navigation without artifact frontmatter. Use
`ID`, `Kind`, `Spark Type`, `Description`, and `Link` columns, taking values from
each artifact's metadata and using links relative to the index. Copy `spark-type`
into `Spark Type` for Sparks that declare it; leave the cell empty for untyped
Sparks and other kinds. Include every `.md` file recursively from the four kind
directories, sorted by ID. The root index itself is not an artifact. If no
artifacts exist, retain the title and table headers only.

**Schema the topology, not the knowledge.**

## Format Examples

These separate documents illustrate the format, not an accepted Todo design or
a requirement to create every artifact kind. Referenced Sparks such as `todo`
and `todo-store` are hypothetical existing concepts in these examples.

```markdown
---
id: todo-editor
description: "Edits Todo names and descriptions while keeping unsaved input separate from saved data."
kind: spark
spark-type: ui
uses: [todo]
---

# Todo Editor

Save submits the current input; Cancel leaves saved data unchanged. Editing
operates on a draft so cancellation does not require reversing saved changes.
```

The next example stores a Todo rule separately; the same rule may instead be
owned directly by the Todo Spark.

```markdown
---
id: todo-description-length
description: "Limits a todo's description to 1,000 characters."
kind: constraint
applies-to: [todo, todo-editor]
---

# Todo Description Length

A todo's description must contain no more than 1,000 characters. The editor's
description input must enforce the same limit.
```

```markdown
---
id: keyboard-access
description: "Defines keyboard operability for interactive user-facing software."
kind: aspect
scope: "All user-facing interactive Sparks."
---

# Keyboard Access

Every action is operable by keyboard, with visible focus.
```

```markdown
---
id: todo-editing
description: "Coordinates explicit saves between the editor and Todo storage."
kind: collaboration
participants: [todo-editor, todo-store]
---

# Todo Editing

The editor submits validated input to the store. A successful save updates saved
data and closes the editor. A failed save keeps the draft and editor available.
```