# SparkWell Tools

One Node.js command provides configuration checks, Spark selection, and
[Implementation Map](implementation-map.md) management. It does not generate
application code or manual test cases, or execute the `/spark-impl` and `/spark-qa` workflows.

A separate [trace tool](tools/trace.js) extracts versioned diffs, validates the [Change Map](change-map.md) used by `/spark-trace`, and looks up saved explanations for review selections.
It does not infer semantic links or render a review UI.

## Setup

Node.js 24 or later and npm are required in the environment where the agent runs
these tools. This is also a prerequisite for the `/spark-impl`, `/spark-qa`, and `/spark-trace` workflows,
not for the generated application's runtime. From the project root:

```sh
npm ci --prefix .sparkwell/tools
```

The dependencies are `yaml` for structured metadata and `diff` for structured change blocks. The tools have their own
[package manifest](tools/package.json) and [lockfile](tools/package-lock.json),
separate from application dependencies. Python and a virtual environment are not
required.

The entry point is [tools/sparkwell.js](tools/sparkwell.js). Commands below use the
current directory as the project root; `--root PATH` before the command selects
another project. Configuration follows
[Implementation Configuration](implementation-config.md).

## Commands

| Command | Purpose | Writes Project Files? |
| --- | --- | --- |
| `inventory` | Discover and validate Artifact metadata; return paths, titles, and body line numbers. No config or index is required. | No |
| `check` | Validate config, Artifact metadata, references, dependency graphs, and existing maps. | No |
| `resolve` | Resolve explicitly requested Spark/implementation pairs, context, and prerequisites. | No |
| `map show` | Show all maps or filter by implementation and source Artifact IDs, including stale-reference diagnostics. | No |
| `map check` | Validate map structure, registered implementation IDs, output files, and model references. | No |
| `map update` | Preview targeted additions, replacements, and removals; `--write` saves the result. | Only with `--write`, and only the map |

All commands except `inventory` require a valid configuration and model metadata.
The tools do not create missing project configuration. Artifact discovery includes
untracked and nested Markdown files in the four model directories; it does not
follow directory symlinks. Paths are checked for traversal and symlink escapes.

Except for `--help`, stdout is JSON with an `ok` field. Exit code `0` means the
structural operation succeeded; `1` means invalid input, stale mappings, or an I/O
error. Errors include a code, message, and location when available. Invalid input
may stop parsing at the first error. JSON is a current result, not a saved plan or
proof that the application works.

## Select Sparks

```sh
node .sparkwell/tools/sparkwell.js inventory
node .sparkwell/tools/sparkwell.js check
node .sparkwell/tools/sparkwell.js resolve --binding service-clients
node .sparkwell/tools/sparkwell.js resolve --spark todo-app --implementation web-ui --include-composed
```

These IDs are examples and must exist in the selected project.

- `--spark ID`, `--implementation ID`, and `--binding ID` are repeatable. Values
  within an option form a union; different options intersect.
- `--spark` selects only those Sparks. `--include-composed` also includes their
  `composes` descendants; it requires `--spark`.
- `--all` selects every configured pair and reports unbound Sparks. It cannot be
  combined with other selection options. No selection never means all.
- Binding IDs select named rules, not implementations. Unnamed rules can still
  be selected through their matched Sparks or implementation.

Implementation records include optional `qa`, `qa-guidance`, and `qa-guidance-file` fields from the configuration.
The `/spark-qa` Skill chooses explicit targets or `qa: true` defaults and passes those IDs as `--implementation` filters.
`resolve` does not apply QA defaults itself or change selection based on the QA flag; dependencies remain context rather than additional manual-test targets.

The result separates these parts:

| JSON Field | Meaning |
| --- | --- |
| `selected` | Deduplicated Spark/implementation pairs with model paths and the matching binding IDs or zero-based `/bindings/N` references. |
| `unbound-sparks`, `empty-selection` | Requested Sparks without a matching implementation, or a selection with no pairs. These are not successful implementation results. |
| `context` | Related Sparks, incoming edges, explicit rule targets, Collaborations, and unresolved `pending-scopes`. |
| `implementation-order`, `implementations` | Relevant implementation configurations and a prerequisite-first ordering. Not a decision to regenerate them. |
| `prerequisites` | Upstream implementations and candidates from their own bindings. `in-model-context` is a relationship hint; `requires-selection-review` remains true. |

Only `selected` contains resolved pairs for the requested filters. Prerequisite
candidates are not added to it or treated as authorized writes. The agent chooses
which upstream outputs are actually needed and whether existing ones are suitable.

`uses` and Collaboration participants supply context, not additional selections.
Explicit rule targets are preserved rather than propagated through the graph.
Every natural-language scope is returned for agent review; the tool does not judge
its applicability. The agent still reads the actual Artifact bodies, diagrams,
guidance, and code. Metadata context is not proof of complete design coverage.

## Inspect and Update Maps

```sh
node .sparkwell/tools/sparkwell.js map show --source todo-item
node .sparkwell/tools/sparkwell.js map check --implementation web-client
```

`map show` accepts one `--implementation` and repeatable `--source` filters (OR).
It reports stale mappings without silently deleting them. An absent map is shown
with `exists: false`; it does not imply that no code exists.

Updates accept JSON through `--changes PATH` (project-relative) or `--changes -`
(stdin). For example:

```json
{
  "upsert": [
    {
      "path": "src/web/client/todo-client.ts",
      "derived-from": ["todo-service", "todo-item"]
    }
  ],
  "remove": ["src/web/client/old-client.ts"]
}
```

Either list may be omitted. Each upsert replaces that path's entire source list;
other records stay unchanged. The same path cannot appear in both lists. Removing
an already absent record is a no-op and never removes a code file. Duplicate JSON
keys are rejected. Output files and source IDs must exist for the resulting map.

```sh
node .sparkwell/tools/sparkwell.js map update --implementation web-client --changes changes.json
node .sparkwell/tools/sparkwell.js map update --implementation web-client --changes changes.json --write
```

The first command previews; the second persists. The result includes `changed`,
`written`, and the resulting map. Writes normalize YAML ordering, use an atomic
file replacement, and take a short-lived exclusive lock. Contention reports
`map-busy` without waiting; a detected external edit reports `map-changed`.
If a terminated process leaves a lock, confirm no writer is active before removing
that stale lock. No persistent run-status or selection files are created.

## Tests

[tools/test-sparkwell.js](tools/test-sparkwell.js) uses Node's built-in test runner
and isolated temporary projects.

```sh
npm test --prefix .sparkwell/tools
```

Tests cover invalid YAML and metadata, path boundaries, matching and dependencies,
scope separation, stale maps, targeted changes, and failed or concurrent writes.
They also cover QA config types, guidance files, and compatibility with existing selection behavior.
The same test command runs [trace tests](tools/test-trace.js) in isolated Git repositories, covering snapshot selection, diff coordinates, association validation, and output safety.
They test the tools, not generated application behavior or Skill reliability.