---
name: spark-impl
description: "Create or incrementally update implementation files from the accepted Spark model and project implementation configuration. Explicitly invoke /spark-impl with selected Sparks, bindings, implementations, or changes."
argument-hint: "Specify Spark, binding, or implementation IDs, or identify the model or code changes to implement."
user-invocable: true
disable-model-invocation: true
---

# Spark Implementation

Create or update the necessary implementation files from the current model.
Preserve its design while using engineering judgment for implementation details.

Use [Implementation Configuration](../../../.sparkwell/implementation-config.md)
for configuration semantics, [Tools](../../../.sparkwell/tools.md) for commands and
JSON results, and [Implementation Map](../../../.sparkwell/implementation-map.md)
for output mappings. Model metadata follows the
[Artifact Document Specification](../../../.sparkwell/artifact-document-spec.md).

## Follow the Model

The accepted Sparks and applicable Constraints, Aspects, and Collaborations define
the behavior to implement. Read their relevant text and diagrams, not just metadata
or a requirement summary. Configuration and existing engineering artifacts supply
technology choices and concrete interfaces; they do not override model commitments.

Choose ordinary code structure, helpers, library APIs, and algorithms using the
selected guidance and existing project conventions. Not every implementation
detail needs another Spark or user decision.

If code or configuration conflicts with a sound model, correct that implementation
choice within the agreed scope rather than weakening the model.
If the model is incomplete, contradictory, infeasible, or unsuitable, explain the
issue and recommend a design change. Pause the affected implementation and ask for
that separate update through `/spark-design`, with its design-confirmation step.

For this handoff, use a separate confirmation with a prominent heading in the
user's language stating that Spark/Artifact files will be changed. Show the
affected IDs and paths and the before/after behavior or guarantees. Ask explicitly
for permission to edit those model files, separately from permission to continue
implementation. Accepting a demo or configuration choice alone is not model-edit
approval.

Resume against the accepted update; do not silently bypass or rewrite the model
to fit code. Unconfirmed requirements are not implementation instructions.

## Choose the Work

Start from the requested Spark, binding, implementation, code defect, or change.
Reuse a clear scope from this conversation; if none is established, clarify it
rather than selecting the whole graph. A new implementation can start from an
explicit selection without a diff.

For change-driven work, state the comparison basis: the specified Git revisions,
uncommitted changes, or the last confirmed update's actual edit evidence. Inspect
the relevant current files, including staged, unstaged, and untracked content;
use old definitions for removals and renames. Clarify an unavailable baseline
rather than treating a map or Git status as a last-run checkpoint.

Identify changes in meaning before choosing outputs. A wording-only model edit
may need no code change. For changed Constraints, Aspects, or Collaborations,
trace the old and new meaning through targets, scope, participants, and the Sparks
that enforce or consume their rules. Resolve implementations for each affected
owner, including a service enforcing changed data rules even if it is not a listed
target. Keep unaffected consumers as context rather than selecting them for edits.

## Resolve Configuration and Context

The tools require Node.js 24+ and npm; use the documented setup if dependencies
are absent. Read `.sparkwell/config.yaml` and resolve the selection with
`node .sparkwell/tools/sparkwell.js resolve`, using the narrowest suitable
`--spark`, `--binding`, and `--implementation` filters. Use `--include-composed`
only when the request includes those parts, and `--all` only for explicit whole
project scope. Use the tool's matching and dependency results, not a second parser.

Read only the selected guidance and relevant linked project instructions. If
configuration is missing, unsuitable, or contradictory, propose the smallest
correction and obtain confirmation before changing it. Apply the configuration's
binding requirement to every Spark whose implementation must be created or
updated, including Data Sparks. Pause the affected generation when a needed
binding is missing; do not infer its target from a consumer or from its type.

Tools may scan model metadata to resolve references, but their context and
prerequisite candidates are not a list of files to read or regenerate in full.
Read the selected Artifact bodies and the rules and collaboration details needed
for this task. Evaluate relevant `pending-scopes`; explicit applicability does
not spread through graph edges. Follow further references only to answer a
concrete design or impact question. Keep JSON results in the conversation rather
than maintaining another persistent plan.

Use `map show` filtered by implementation and source Artifact IDs to locate
existing outputs. Check those files and nearby source, native configuration, and
tests. Missing or stale mappings do not prove code is absent; search the relevant
source roots before creating another implementation. A map is provenance, not
proof of correctness or permission to overwrite.

For each needed prerequisite, identify the actual input from guidance and existing
outputs. Resolve dependencies and included parts found through `uses`, `composes`,
or implementation prerequisites using their own bindings and only the targets
needed by the consumer. Reuse suitable outputs; include missing or affected ones
in the plan in dependency order. Ask before prerequisite writes expand the
authorized scope; after approval, continue that work within this invocation.
Unrelated upstream candidates and downstream implementations remain unchanged
unless their impact is part of the request; report required follow-up work outside
that scope.

## Plan and Implement

Combine required pairs across the selected consumers and prerequisites before
planning writes; handle each `(Spark ID, implementation ID)` pair once. Follow the
[Shared Outputs rules in Implementation Configuration](../../../.sparkwell/implementation-config.md)
for every selected target. Identify the producing implementation and existing or
planned locations of shared definitions in the plan.

Derive generation order from the actual outputs each selected consumer needs.
Respect the tool's `implementation-order` for configured prerequisites; use
guidance and existing code to identify dependencies within an implementation.
Reuse or establish required interfaces, schemas, and types before their consumers.
A usable contract can be sufficient without completing or starting its provider.
Spark type and binding order do not determine this sequence; `uses` and `composes`
help discover inputs and parts but are not automatically generation prerequisites.

Spark `uses` cycles are allowed. For mutually dependent outputs, establish their
shared interfaces first or implement the participating pairs as one coherent
group rather than forcing a topological order on the Spark graph. Arrange routine
ordering within the authorized scope yourself; independent work need not wait
for unrelated outputs. Clarify material uncertainty about required inputs,
ownership, or design rather than asking the author for a node-by-node schedule.

Present a concise plan: selected Spark/implementation pairs, comparison basis when
relevant, required output order and reuse, intended changes, and focused validation.
An explicit implementation request authorizes routine work within that scope; do not
require another confirmation for every step. Ask for blocking uncertainty,
scope expansion, consequential configuration changes, or destructive replacement.

Make the smallest coherent change to existing outputs. Re-read relevant files
before writing and preserve intervening edits; revisit the plan if they materially
change it. Scaffold an absent target only within the agreed configuration and
scope. Reuse established generators where appropriate, without hand-editing their
generated files or forcing a one-Spark-to-one-file layout.
For a new generator, build integration, or test integration, validate the smallest
representative output from the current task with the project's toolchain through
the relevant generation, compilation, or execution steps before expanding
implementation; reuse the verified setup for subsequent work.

Use the configured interface source for communicating implementations, whether
it is a contract document or server code. Check actual inputs, results, and errors
instead of independently guessing compatible interfaces. Keep Spark-defined rules,
state ownership, and lifecycle guarantees intact, including background behavior.

Limit changes to necessary implementation, integration, and test files. Preserve
unrelated behavior in shared files and inspect affected callers when needed.
If the selected code already satisfies the current design, validation without
rewriting it is a valid result. Repeated work with unchanged inputs reuses the
same outputs without duplicate definitions or unnecessary rewrites; model changes
update the existing representation rather than creating another copy.

## Verify and Record

Derive test expectations from accepted model behavior and constraints, and verify
each affected implementation against them. Clarify model ambiguity that affects
expected behavior through the design-confirmation process before relying on an
interpretation. Run focused native-project checks and add or update the smallest
useful tests for changed behavior, covering relevant success, boundary, failure,
and lifecycle cases and interactions across changed parts. Repair implementation
defects in scope; surface design conflicts instead of weakening the tests or model.
A build or mock alone does not verify behavior that requires a real service or
platform. Keep check results tied to the behavior and implementation actually
exercised, noting unavailable checks and remaining gaps.

When shared generation is affected, verify that two consumers together and a
later consumer-only run reuse the same definition and output locations. Use
focused tests or a scoped rehearsal, and report any unverified repeat-run behavior;
pair deduplication and valid maps alone do not establish it.

After output edits and validation-driven fixes, use `map update` to preview and
persist targeted records with `--write`. Supply each changed path's complete source
list, retaining valid sources for behavior the file still implements. Include
model Artifacts whose design it actually realizes, not everything read. Preserve
unrelated records; explicitly correct moved or deleted paths. Record actual output
changes even when validation fails, reporting validation and map-update failures
separately. Do not create a map merely for files inspected or validated.

Report the implementation IDs, actual changes and source model IDs. For important
behaviors, name the implementation, supporting checks, and observed outcomes;
identify failed, blocked, or unverified behavior separately. Test totals may
summarize these results, but do not replace behavioral evidence or imply complete
coverage. Distinguish a completed implementation part from the whole service or
product. Keep the report brief and do not stage or commit changes unless separately
requested.