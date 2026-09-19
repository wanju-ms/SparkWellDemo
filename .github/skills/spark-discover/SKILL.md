---
name: spark-discover
description: "Discover meaningful Sparks from existing code and bring an existing project into SparkWell. Explicitly invoke /spark-discover to analyze implementation behavior, propose model boundaries, and after human confirmation create or update Artifacts, implementation configuration, and maps without changing application code."
argument-hint: "Select a project, capability, module, or source paths; optionally request analysis only or continue a confirmed model/config/map proposal."
user-invocable: true
disable-model-invocation: true
---

# Spark Discover

Understand an existing implementation and propose the software knowledge worth maintaining as a Spark model.
After confirmation, record that model, its implementation configuration, and evidence-backed file mappings in the same workflow.
This is an entry point for adopting existing code, not code generation or a redesign of the system.

Use the [Overview](../../../.sparkwell/sparkwell-overview.md), [Modeling Guide](../../../.sparkwell/design-modeling-guide.md), and [Artifact Specification](../../../.sparkwell/artifact-document-spec.md) for concepts, boundaries, knowledge ownership, relationships, and writing rules.
Use [Implementation Configuration](../../../.sparkwell/implementation-config.md), [Implementation Map](../../../.sparkwell/implementation-map.md), and [Tools](../../../.sparkwell/tools.md) for implementation targets, bindings, and map operations.
Read the relevant repository instructions and existing project guidance; do not import the full design and implementation workflows as another sequence to execute.

## Establish Scope

Start from the requested repository, capability, module, or source paths.
In a multi-root workspace, identify the intended project explicitly rather than using the active editor's folder.
Reuse a clear scope from the conversation; ask when ambiguity blocks analysis.
For a broad project request, first survey entry points and package boundaries, then propose a useful bounded starting scope rather than reading every file or modeling every component.

State the inspected code version and model scope.
Unless another version is requested, inspect the current working tree, including relevant staged, unstaged, and untracked files.
For historical analysis, use the specified snapshot's code, model, configuration, and maps without checking it out.
Before recording historical findings as the current model, establish their applicability to the current working tree with the user; do not silently replace current knowledge with an older snapshot.

Inspect existing Artifacts, the index, configuration, and maps before proposing additions.
Before analyzing code, read `.sparkwell/config.yaml` when present and each relevant implementation's `guidance` or `guidance-file` contents.
Read and follow the applicable project instructions referenced there.
Do this even when bindings are absent; identify relevant implementations from the requested scope and `source-root`.
Missing model directories, configuration, or maps are normal for a project being adopted, not evidence that implementation is absent.
Use installed `inventory`, filtered `resolve`, and `map show` commands where applicable; `inventory` does not require configuration.
If tools or dependencies are missing, analysis can proceed from files; arrange the documented tool setup before tool-driven writes rather than inventing another config or map format.
Invalid or stale existing data should be reported and corrected only within the confirmed scope, not discarded to make adoption easier.

## Understand the Implementation

Begin with concrete entry points and follow the code that owns or decides the behavior.
Trace relevant inputs, outputs, state and data ownership, persistence, lifecycle, failures, cancellation, background work, and cross-component coordination.
Read callers, contracts, dependencies, configuration, tests, and native project files as needed to settle these questions.
Distinguish actual behavior from a test's asserted expectation, a comment, or an external guarantee that has not been verified.
Do not claim tests ran or behavior was observed at runtime when only source was inspected.

Use implementation knowledge to explain responsibilities, not to convert each file, class, hook, component, or helper into an Artifact.
Identify meaningful rules and interactions even when they span several files or implementation layers.
Do not invent the original author's intent or rationale; cite evidence where available and identify uncertainty where it affects the proposed model.
Existing behavior can inform the accepted design baseline through review, but suspected defects do not automatically become requirements to preserve.
Surface conflicts with accepted model commitments separately instead of rewriting those commitments to match code.

## Propose the Model

Apply the Modeling Guide to candidate responsibilities, semantic compression, canonical rule ownership, and collaboration boundaries.
Reuse or extend an existing Artifact when it already owns the knowledge; keep stable IDs and avoid duplicate concepts across platforms or directories.
Inspect relevant incoming and outgoing relationships, applicable Constraints and Aspects, and Collaboration participants before changing an existing boundary.
Create other Artifact kinds only when their distinct meaning warrants independent maintenance; not every project needs every kind.
Keep implementation details in code unless they are consequential design knowledge worth maintaining.

For each proposed Artifact, explain its responsibility, important behavior or rules, relationships, and supporting implementation locations.
Identify platform-specific scope, inspected conditions, unknowns, and uncovered areas where they matter.
A useful partial model is a valid result; do not fill uninspected behavior with invented decisions or require enough detail to recreate the entire implementation.
Explain which nearby candidates remain implementation details or belong to an existing owner when that helps justify the boundary.

Before presenting the proposal, check the draft against a plausible change within its stated scope, using the Guide's criteria for useful detail.
Can the draft and its model references identify the responsible owner, behavior or constraints to change or preserve, and collaborators to review without reconstructing those decisions from code?
Use the check to add evidence-backed knowledge or remove unnecessary component-internal explanations, not to add hypothetical requirements or a checklist section to the Artifact.

Write ordinary Artifact bodies under the existing specification, not a special code-derived format.
`spark-type` is optional; do not force a category, introduce tags, or add descriptive/generative metadata.
The Guide's initial-origin `Note` is optional and can be adapted; it is not a required section or a claim that the model cannot support a new implementation.
An unchanged model is valid when the requested scope is already adequately represented.

## Propose Configuration and Maps

Infer implementation targets from the project's actual maintained outputs, source roots, package boundaries, contracts, and build or generation inputs.
Reuse existing implementation IDs and conventions; do not create a target for every Spark, file, or dependency.
Propose only the configuration needed for the selected scope, without adding future platforms or reorganizing the project.
For a missing configuration, use the existing schema with the observed implementations and proposed bindings; do not require code generation to establish it.

Derive `source-root`, optional `stack`, and concise guidance from inspected project evidence.
Reference existing guidance files where suitable, or use inline guidance; creating additional guidance documents requires a separately agreed scope.
Keep framework choices and output locations in configuration, not duplicated business rules, credentials, or a new inventory of dependency versions and build commands.
Use `depends-on` only for required outputs consumed from another implementation, not every runtime call, package dependency, or Spark relationship.
Keep shared contract and type production aligned with the existing architecture rather than imposing contract-first or server-first organization.

Propose bindings that match both the selected Sparks and the target's actual outputs.
Use an ID match when a type or pattern would select unrelated concepts; an untyped Spark can still be explicitly bound.
Context-only Artifacts do not need bindings, and associations do not authorize regeneration.
Preserve existing QA settings; add or change QA defaults only when they are part of the reviewed proposal, not merely because an application was discovered.

Propose map entries for existing files whose responsibilities, rules, contracts, or tests have an evidenced relationship to the model.
Trace the modeled responsibilities and behavior from entry points to files that directly define rules, manage state, compute outputs, perform effects, or coordinate interactions.
Do not stop at assembly or forwarding code; retain those entry files when the assembly or coordination itself is modeled.
Configuration, data definitions, and tests can also qualify; identify the modeled knowledge each proposed association directly implements or verifies.

Stop at responsibility boundaries rather than collecting the full dependency tree.
Code references and Spark `uses` or `composes` relationships do not propagate mappings.
Direct implementation files can be mapped without a separate Spark for each component.

When extracting or transferring responsibilities between Artifacts, recheck affected existing mappings even when their referenced IDs remain valid.
Propose removing or reassigning associations that no longer have direct evidence; retain multiple associations when the file still implements or verifies knowledge from each Artifact.

Mappings are many-to-many and can be recorded without changing the implementation.
`derived-from` does not establish that the Artifact historically generated the code, nor that the implementation is complete or correct.
Retain each affected path's complete valid source list and all unrelated records; report uncertain associations separately without writing them or claiming complete mapping coverage.
Explicitly list proposed removals or corrections rather than inferring renames or deleting stale records silently.

## Confirm Before Writing

Present one coherent adoption proposal before creating or changing any project files.
Include the inspected scope and version, the proposed model and its evidence, and separately identifiable configuration and map changes with their target paths.
For Artifacts, include names, IDs, kinds, relationships, and relevant before/after meaning rather than only a list of filenames.
For configuration, identify implementation targets, source roots, dependencies, bindings, and guidance changes.
For maps, identify proposed file associations and removals, with unresolved candidates kept separate.

State prominently that Artifact, configuration, and map files will be created or changed while application code remains untouched.
Stop and wait for explicit confirmation of the proposed model and the included configuration/map scope.
Invoking this Skill authorizes analysis, not acceptance of an unseen model or automatic file writes.
One confirmation may cover the whole reviewed proposal; approval of only one part does not authorize the others.
An analysis-only request ends with the proposal.

## Record and Validate

After confirmation, re-read the affected source and destination files.
Preserve intervening edits; if they materially change the evidence or proposal, explain the impact and obtain confirmation of the revision before writing.
Make the smallest necessary edits and retain accurate wording, metadata, relationships, configuration, and mappings outside the approved change.
Do not reformat or rewrite unrelated content to make the project appear uniform.

Write approved Artifacts in the specification's four kind directories and synchronize `artifacts/index.md` as navigation for the complete current model.
Then create or update the approved entries in `.sparkwell/config.yaml`, preserving unrelated implementations, bindings, and guidance.
Resolve the approved Spark/implementation pairs with the existing tool to check that bindings and required output dependencies reflect the proposal without unintentionally selecting unrelated work.
Do not add targets or bindings merely to eliminate every unbound Spark.

Use `map show` and `map update` to preview targeted records for the approved implementations, then persist the reviewed changes with `--write`.
Supply complete source lists for each affected path and use JSON stdin with `--changes -` when practical, without maintaining a second mapping or handoff file.
Create maps only after their implementation IDs, source Artifacts, and existing file paths are available for validation.
If the preview differs materially from the approved associations, resolve that difference before writing.

Run `inventory` for model-only work, or `check` after configuration and maps are recorded, and inspect index and Markdown links against the Artifact Specification.
Review the final delta against the confirmed proposal; no-op reruns should preserve already accurate files.
Report structural failures or unavailable checks without broadening scope, deleting unrelated records, or claiming the adoption is fully validated.
Structural checks and mappings are not semantic correctness or coverage proofs; a separate `/spark-review` can examine the accepted claims.

## Boundaries and Handoff

Writes are limited to approved Artifacts, `artifacts/index.md`, `.sparkwell/config.yaml`, and targeted maps under `.sparkwell/implementation-maps/`.
Do not edit application code, tests, schemas, package or build files, tools, Skills, or project instructions as part of adoption.
Do not run the application, tests, or builds, or perform Git writes, checkouts, staging, commits, or pushes.
Keep findings and proposals in the conversation; do not create additional status registries, persistent plans, or copied source snapshots.
Recommend separately authorized implementation or verification work when the analysis reveals a defect or missing capability.

Report actual Artifact/config/map changes, their inspected basis, validation results, unresolved questions, and uncovered scope in the user's language.
Do not equate a recorded model with complete system coverage, successful implementation, or readiness to generate another platform.
After adoption, use `/spark-design` for design changes, `/spark-impl` for implementation work, and `/spark-review` for read-only semantic review.
Subsequent discovery may add another bounded part of the same model without recreating the project setup.

## Example Request

```text
/spark-discover
Analyze the existing permission synchronization flow in this project.
Propose meaningful Sparks and the implementation configuration and file mappings they need.
After I confirm the proposal, record the agreed files without changing application code.
```