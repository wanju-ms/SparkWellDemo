---
name: spark-review
description: "Review semantic consistency between the accepted Spark model and existing code. Explicitly invoke /spark-review to assess trustworthiness within selected claims, implementations, and versions, reporting evidence and possible drift without changing files or certifying completeness."
argument-hint: "Select Sparks, behaviors, source paths, or implementations; optionally specify revisions or a comparison."
user-invocable: true
disable-model-invocation: true
---

# Spark Review

Assess whether the model's claims are supported by the selected implementation within the requested scope.
Follow the [Overview](../../../.sparkwell/sparkwell-overview.md) on models that cover only part of the software and the [Modeling Guide](../../../.sparkwell/design-modeling-guide.md) on judging completeness for the requested task.
Use the [Artifact Specification](../../../.sparkwell/artifact-document-spec.md) for relationships and applicability, and [Implementation Maps](../../../.sparkwell/implementation-map.md) to help locate code.
This is a semantic review, not a structural check, generation-readiness assessment, or correctness certificate.

## Scope and Versions

Start from the requested Sparks, behaviors, source paths, implementations, or changes.
Reuse a clear scope from the conversation; ask only when an ambiguity blocks the review, and do not default to the whole repository or every platform.
State the inspected model and code versions, implementation targets, and behavioral scope.
Use specified revisions when provided; otherwise inspect the current working tree, including relevant staged, unstaged, and untracked content.
Record resolved commit SHAs for committed sources and distinguish captured HEAD from uncommitted working content.
For change-driven reviews, use the agreed comparison and distinguish pre-existing differences from newly introduced ones.
Do not substitute today's model, code, configuration, or maps when reviewing a historical version.

## Read Evidence

Read the selected Artifact bodies, not only metadata or a diff.
Include relevant incoming and outgoing relationships, applicable Constraints and Aspects, and participating Collaborations.
Evaluate natural-language applicability against the selected targets; do not propagate rules through every graph edge or assume they apply to every platform.

Use the installed read-only commands in [Tools](../../../.sparkwell/tools.md) when useful: `inventory`, `resolve`, `map show`, and `map check`.
These commands inspect current working files; use read-only Git access to the corresponding files for historical context.
If configuration, maps, or tooling are unavailable, inspect the relevant sources directly and report any resulting limits rather than creating or repairing them.
Bindings and maps locate candidates, not proof that a file fully implements a claim.
Search relevant source paths when mappings are missing or stale; absence of a mapping is not absence of an implementation.

For each claim, inspect the code that actually decides the behavior, following callers, state owners, contracts, configuration, or dependencies as needed.
Read related tests and existing execution evidence when they help distinguish interpretations.
Test source shows what is asserted, not that the test ran or passed; execution evidence applies only to the versions, conditions, and paths it exercised.
Keep reading focused on the claim and identify missing evidence, such as external service behavior or runtime conditions that static code cannot establish.

## Judge Claims

Distinguish accepted commitments, observations of current behavior, explicitly deferred goals, and unknowns before comparing them with code.
Classify the reviewed claims using these outcomes; keep the evidence and uncertainty visible.

| Outcome | Meaning |
| --- | --- |
| Evidence supported | Inspected evidence supports the claim for the stated implementation, conditions, and paths. |
| Possible conflict | Evidence indicates behavior may contradict an applicable model statement or an in-scope commitment remains unfulfilled without an explicit deferral. |
| Explicitly undelivered | The model or accepted delivery scope identifies the goal as not yet delivered; do not report it as implemented. |
| Insufficient evidence | The claim, applicability, or behavior cannot be established from the inspected evidence; state what is missing. |

An omitted implementation detail or unrelated unmodeled feature is not a conflict and does not require a new Spark.
Do not require a model of existing software to cover every code path or contain enough knowledge to bootstrap another implementation.
A newly observed behavior may warrant a scope question when it changes an important responsibility or contract, but its omission alone is not proof of model drift.
Conversely, a partial model does not excuse code that contradicts a statement it does make or an applicable rule owned elsewhere.
Only classify a goal as explicitly undelivered when that boundary is actually recorded; do not infer a deferral from missing code.
Failure to find a path is not proof that it does not exist, and ambiguous wording is not evidence of a particular commitment.
Neither code nor model is automatically correct: a difference may require an implementation fix, a reviewed model correction, or clarification of scope.
Semantic agreement does not establish model completeness or guarantee generation of another realization.

## Report and Stop

Lead with possible conflicts and material evidence gaps, then summarize supported claims and explicit delivery limits.
Use the [Guide's writing guidance](../../../.sparkwell/design-modeling-guide.md) for short finding titles with supporting details beneath them.
For each reported result, name the model statement with its file and location, the implementation and evidence locations, the observed behavior or missing evidence, and the outcome with relevant conditions.
Suggest a concrete next step where needed, such as inspecting an external contract, a focused test, a scoped implementation fix, or a model proposal through `/spark-design`.
Keep the report proportional and in the user's language; group claims that share the same evidence rather than repeating code descriptions.
State what was inspected and what remains unexamined.
If no conflict was found, say so within that scope without certifying the whole model as trustworthy or the product as correct.
An unchanged model is a valid result; do not invent edits merely to produce a model diff.

Return findings in the conversation only.
Do not create or edit Artifacts, code, configuration, maps, tests, reports, or other project files.
Do not install dependencies, run the application or tests, or perform Git writes, checkouts, staging, commits, or pushes.
Recommend separately authorized verification or changes when evidence is insufficient; this review does not perform them.

## Example Request

```text
/spark-review
Review the Web Todo editing flow against the current model, focusing on Cancel and save failure.
Check the stated behavior without requiring the model to describe every implementation detail.
Report evidence, possible conflicts, and remaining uncertainty; do not modify files.
```