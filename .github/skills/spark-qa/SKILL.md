---
name: spark-qa
description: "Create or incrementally update platform-specific manual test cases from the accepted Spark Graph for QA engineers to execute. Explicitly invoke /spark-qa with workflows, Sparks, implementations, or changes; this Skill designs human-readable cases, not automated tests or execution results."
argument-hint: "Select workflows, Sparks, changes, or implementations; optionally specify coverage, time budget, and language."
user-invocable: true
disable-model-invocation: true
---

# Spark QA

Act as a professional QA engineer designing manual tests from the accepted Spark Graph.
Create clear, human-executable cases, not automation scripts, pseudocode, or test results.
Use QA judgment to select useful scenarios and methods rather than treating every Spark as a test unit.

Use [Implementation Configuration](../../../.sparkwell/implementation-config.md) for platform selection and QA guidance, [Tools](../../../.sparkwell/tools.md) for context discovery, and the [Artifact Specification](../../../.sparkwell/artifact-document-spec.md) for model metadata.
Follow the [Modeling Guide's writing guidance](../../../.sparkwell/design-modeling-guide.md) for concise, accurate prose and stable sentence-level line breaks.

## Choose the Work

Start from the requested workflows, Sparks, design changes, or implementation targets.
Reuse a clear scope from the conversation; ask if the functional scope is missing rather than selecting the whole graph.
For change-driven work, identify the actual baseline: specified Git revisions, uncommitted changes, or the last confirmed update's edit evidence.
If the baseline cannot be established, ask for it and pause change-based updates rather than guessing what changed.
Include relevant staged, unstaged, and untracked files, and use old definitions to understand removals or renames.
Do not treat an Implementation Map or Git status as a last-run checkpoint.

Read `.sparkwell/config.yaml` and choose the implementations under test.
Explicitly requested targets take precedence over defaults, including targets with `qa: false` or no `qa` field.
Otherwise, use entries marked `qa: true`; if there are none, ask for targets.
Resolve platform names such as Web or iOS to the relevant application entries, not every library with the same language or stack.
QA defaults select platforms, not functional scope or a mandatory suite for every dependency.

Use the requested coverage, risk focus, execution budget, and language.
If coverage is unspecified, choose a proportionate, risk-based regression set.
For main-flow requests, keep the set small while retaining essential high-risk checks.
For broader coverage, expand meaningful variations and interactions without filling a quota or exhaustively combining unrelated inputs.
Use standard QA methods where they help; do not add a QA tutorial to the output.
Honor the time budget through prioritization, label time estimates as estimates, and name important omitted areas.
Use the requested language, or the existing suite's language when updating it; otherwise use the user's language.

## Read Design and Platform Context

The accepted Sparks and applicable Constraints, Aspects, and Collaborations define expected behavior.
Read the relevant bodies and diagrams, not only descriptions or a requirement summary.
Read each target's `qa-guidance` or `qa-guidance-file` when present.
Use implementation guidance, existing source, interface contracts, and project instructions only to understand the concrete test surface and environment, not as commands to generate code.
Neither QA guidance nor the current implementation overrides the accepted design.
Distinguish an explicitly limited demo delivery from an unfulfilled product commitment; report deferred behavior rather than silently omitting it or treating it as satisfied.
If code conflicts with a clear design rule, retain that expectation and report the apparent implementation mismatch without fixing code or claiming an executed test failed.
If the accepted design itself is ambiguous or contradictory, seek clarification through `/spark-design`; pause the affected cases and do not edit model files yourself.

The read-only tools require Node.js 24+ and npm; follow the documented setup when dependencies are missing.
Use `node .sparkwell/tools/sparkwell.js resolve` for selected implementations and relevant Spark context, with explicit filters rather than `--all` unless whole-project scope was requested.
Different filter types intersect: a Data or Service Spark may not bind directly to the UI under test.
In that case, resolve the source Spark and the target implementation separately, then follow relevant incoming relationships and contracts to find its observable behavior through the target.
Referenced design knowledge does not need a new binding merely to contribute test expectations.
Inspect applicable `pending-scopes`, rule targets, and collaboration participants; relationships provide candidates, not automatic coverage or scope expansion.

Use `inventory` when discovering model metadata and filtered `map show` results to locate existing implementation files when useful.
Read only the related source and documents needed to settle actions, labels, setup, and observation points.
An absent or stale map does not prove that code is absent; inspect the relevant source root and report stale references without repairing maps in this workflow.
Implementation dependencies identify generation inputs, not running services or additional targets to test independently.
Determine runtime prerequisites from actual project context.
If configuration is missing or invalid, propose a correction and obtain approval before editing it.

## Design Manual Scenarios

Organize cases by user goals, business workflows, and meaningful risks.
A case may traverse several Sparks; an editor can be one step in creating, saving, and reloading a record.
Use a focused validation case when it has independent test value, not because a Spark or field exists.
Identify shared scenarios first, then write the appropriate platform-specific actions and checks.
Each platform's cases must be usable without assembling steps from another platform's documents.
For workflows involving several selected platforms together, write one cross-platform case and identify the platform used at each step.
Do not invent cross-platform synchronization guarantees or include unselected targets without resolving the scope change.

Give QA a concrete way to prepare data, reach the required state, perform actions, and observe expected results.
Use realistic, disposable data and known environment controls; document cleanup when the case changes shared state.
Cases should not rely on a previous case's execution unless the existing suite deliberately defines that dependency.
Do not invent UI controls, endpoints, fault switches, or expected behavior.
Automation-only hooks are not automatically available to a human tester.
If failure injection, timing control, or an observation point is unavailable, mark the affected case as blocked or needing environment support and state what is missing.
Do not leave an unexplained step such as "simulate a save failure" or disguise a subjective expectation as an observable check.
Cases may be designed before implementation exists, but unresolved entry points or setup must be marked as planned rather than ready to execute.

## Write the Cases

Present a short plan naming functional scope, targets, coverage depth, comparison basis when relevant, and output locations.
An explicit generation request authorizes writing the case documents within that scope; ask only for blocking uncertainty, scope expansion, or destructive replacement.
Use an existing manual-test layout or the requested destination.
Otherwise, use `tests/manual/<implementation-id>/README.md` as the suite entry and a few `<workflow-group>.md` files for the cases.
Use the same layout under `tests/manual/cross-platform/` for cases requiring multiple platforms together.
Group by business workflow, not one document per Spark or case, and avoid one long file containing every case.
These files are derived QA documents, not a new model Artifact kind, and do not belong in the Artifact index or implementation maps.

The suite entry states target implementations, coverage, shared environment and data preparation, cleanup, and known gaps.
Add a compact case index with stable IDs, titles, priorities, and links to the case sections; explain the priority scale briefly.
Keep common setup in the suite entry rather than repeating it in every case.
Each workflow-group file names its targets and links back to the suite entry and relevant setup.
Use the existing case format where suitable; otherwise include this small set of information per case:

- Stable case ID, clear title, and the behavior being checked.
- Links to the source Artifacts whose behavior the case actually verifies, with the relevant rule or section identified.
- Preconditions and specific test data, referring to shared setup in the same suite where useful.
- A numbered step table with action and expected-result columns, so QA can compare each action with its observable outcome.
- Cleanup, platform differences, or execution blockers when relevant.

Give each case a stable ID unique within the manual suite and retain it when the scenario's identity is unchanged.
Source links form a many-to-many relationship with cases; do not list every Artifact merely read as context.
Prefer short sentences, common words, actual UI labels, and exact values or units where needed.
Preserve restrictions, failure behavior, and expected state changes when simplifying wording.
Do not expose selectors, framework internals, or test code as manual instructions.
Ordinary commands for documented setup may be referenced; do not turn the cases into an automated test harness.

## Update and Check

Inspect existing cases and reread affected files before writing.
For changes, update the affected scenarios and necessary regression cases while preserving unrelated cases, stable IDs, QA notes, and manual additions.
Make the smallest local edit; keep accurate titles, steps, expectations, setup, order, and line breaks unchanged, including inside affected cases.
Reuse the suite's wording for the same behavior rather than introducing equivalent phrasing.
Do not replace the whole suite or apply stylistic cleanup unless explicitly requested.
A wording-only Spark edit may need no test-case change.
Explain retired or replaced cases and ask before deleting existing case files or overwriting conflicting QA edits.
Preserve existing execution records as historical evidence; they do not establish a pass for changed cases.

Review cases against the accepted design, requested depth, platform context, and budget.
Check that setup is feasible, instructions are concrete, expected results are observable, cases are distinct, and IDs and source links are valid.
Keep the suite index aligned with added, moved, renamed, or retired cases, and verify its links and the workflow files' return links.
Remove needless repetition from new or necessarily changed text without losing independent checks or important outcomes.
Review this invocation's diff against the before-edit text and remove your own wording-only or formatting-only changes unless requested.
Report the written files, target platforms, covered workflows, and deferred or blocked areas.
Describe coverage qualitatively; do not infer percentages or complete coverage from case counts or graph reachability.

This workflow writes manual case documents only, apart from separately approved configuration corrections or tool setup.
Do not change application code, Artifacts, automated tests, or implementation maps; do not start the application, execute the cases, or fabricate pass/fail results.
Document validation is not evidence that the product passed testing.
Do not stage or commit changes unless separately requested.

## Example Request

```text
/spark-qa
Create manual cases for Todo creation, editing, and saving on Web and iOS.
Cover the main flows within about 30 minutes per platform, and write in Chinese.
```

Later requests can broaden the relevant risk coverage or update only scenarios affected by a confirmed design change.