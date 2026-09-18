---
name: spark-design
description: "Create or evolve the accepted software model from requirements, feedback, design questions, or model and code changes. Explicitly invoke /spark-design to maintain Sparks, Constraints, Aspects, and Collaborations."
argument-hint: "Describe a change or design question, continue a confirmed update, or specify a Git comparison."
user-invocable: true
disable-model-invocation: true
---

# Spark Design

Maintain a concise, reviewable current model that helps people understand and
deliberately evolve the software.

## Inputs and Boundaries

Read the [SparkWell Overview](../../../.sparkwell/sparkwell-overview.md),
[Design Modeling Guide](../../../.sparkwell/design-modeling-guide.md), and
[Artifact Document Specification](../../../.sparkwell/artifact-document-spec.md).
Use the Guide for modeling judgment and established methods, and the
specification for artifact kinds, fields, relationships, and index rules.

Use the [Artifact index](../../../artifacts/index.md) for orientation and inspect
actual files under `artifacts/`; a missing index entry does not prove knowledge
is absent. Read relevant accepted project constraints, design references, and
implementation context for the task.

Accept requirements and design questions directly. Preserve intended product
behavior and chosen design decisions in their natural knowledge owners. Do not
infer a new product commitment merely from existing code or a proposed mechanism.

Apply the Guide's runtime-neutral default when proposing logical responsibilities
and state behavior. Respect relevant confirmed platform constraints; do not infer
an unspecified runtime or storage technology. Include a new platform choice for
confirmation only when it is necessary for the current design.

Only write `<id>.md` artifacts in the specification's four kind directories under
`artifacts/`, and `artifacts/index.md`. This workflow does not edit application
code, tests, configuration, guides, or other Skills, or extend the metadata
vocabulary. Surface any necessary work outside these bounds rather than
performing it automatically.

## Resolve the Work Scope

Resolve the intended design and delivery boundary using the Guide's
[Resolve Delivery Scope](../../../.sparkwell/design-modeling-guide.md) criteria before
choosing the affected artifacts. Use the following basis to identify the input
changes; a Git range does not by itself determine the delivery boundary.

| Input | Basis for the work |
| --- | --- |
| A requirement, capability, or design question | The request and relevant current knowledge, without requiring a diff |
| The last confirmed update in this conversation | Its actual before/after edit evidence and summary |
| Current uncommitted model or code changes | `HEAD` to the working tree within the requested scope, including staged, unstaged, and untracked changes |
| A commit or Git comparison | The specified before/after revisions, or the selected commit relative to its parent |

State the interpreted scope and comparison basis in the proposal. Isolate a
same-conversation update from earlier edits, even within the same file, and
re-read current content. If later changes materially alter that update or the
comparison evidence is unavailable, clarify the range rather than guessing or
asking the user to restate already recorded requirements.

Use Git read-only from the project root. For uncommitted model changes:

```sh
git status --short --untracked-files=all -- artifacts/
git --no-pager diff HEAD -- artifacts/
git ls-files --others --exclude-standard -- artifacts/
```

For code-driven work, inspect the requested source paths as well. Read untracked
files explicitly; their contents are absent from the diff. Read old content for
deletions and inspect old and new identities for renames or moves. Use the
requested revisions for committed changes and clarify an ambiguous merge parent
or range. Git status alone cannot identify the last Skill invocation. Do not
stage, commit, switch or create branches, or write handoff/state files.

## Resolve Affected Context

Discover all `.md` files recursively in the specification's four kind directories,
including untracked files, and parse YAML metadata to locate IDs and relationships.
Inspect incoming as well as outgoing relationships. Collect Constraint and Aspect
applicability declarations and Collaboration participants, not just references
in the selected Spark files.

Read relevant bodies to understand local rules, responsibilities, and actual
interactions. Match explicit `applies-to` targets and evaluate semantic `scope`
against the current Sparks. Recheck applicability for new or changed Sparks and
consider both additions and removals when a scope changes. Follow the
specification's applicability rules rather than propagating scope through every
dependency or participant.

Include applicable rules and participating Collaborations in the reasoning,
identifying their canonical sources. Bring in relevant provenance and existing
implementation links when available. Clarify material scope ambiguity and rule
conflicts before relying on a particular interpretation. Do not claim complete
resolved context when relevant sources could not be inspected.

Resolve this context on demand without persisting reverse mappings or copying
external rules into target documents. Relationships identify candidates, not
mandatory edits; context does not automatically expand the authorized write
scope. Check potential impact even when relationships are missing or stale.

## Discover and Clarify

Use the Guide to judge how complete the model needs to be for the requested task.
When describing existing software, use the scenario checks below to establish what is supported, not to complete or redesign the existing system.
Identify the inspected implementation and revision in the proposal, with evidence for current-behavior claims and limits on coverage.

Before choosing artifacts, examine the requested scenarios for candidate
interaction spaces, data concepts, and coordinating responsibilities, including
ones not yet represented in the model. Use the Guide to check whether an
application or root has absorbed independently meaningful responsibilities.
Propose useful boundaries without waiting for the user to name every Spark.

Trace key scenarios from input to observable result: what data is passed, who
supplies it, how initial data is obtained, where state is held, who changes it,
and how results reach consumers. Name the responsibility supplying or holding
the actual values; naming their data type alone is insufficient. Include how
state is initialized when no existing data is available. Where saving is
involved, distinguish updating in-memory state from persistence, and explain
when data is loaded, committed, retained, reset, or discarded. For shared state,
distinguish authoritative data from caches, derived values, and local working
input where present. Recommend a coherent in-scope design rather than requiring
the author to prescribe a store or state-management approach.

For data models, identify the logical fields and instance identity needed by
these scenarios using the Guide. Use a field table when it makes the fields,
types, and rules clearer.

For service boundaries, use the Guide's
[Describe Service Contracts](../../../.sparkwell/design-modeling-guide.md) criteria to
propose the capabilities needed by the scenarios.

For each explicit rule, identify its canonical owner and the in-scope behaviors
that must enforce or respond to it. Consider an independent Constraint alongside
local ownership using the Guide. Do not omit data or UI enforcement simply
because the rule is recorded elsewhere.

Interrupt the first design with focused questions only when missing product
intent, external facts, or required project constraints block a coherent
in-scope proposal. Explain the uncertainty and offer a recommendation where
possible; use the host's question tool when available. Otherwise proceed with
one recommended design and keep nonblocking details explicitly open. For viable
internal alternatives, explain the recommendation and confirm it with the
overall design rather than asking the author to select each mechanism. Do not
repeat explicit requirements or ask about unrelated features.

Before presenting the proposal, check that every in-scope behavior and rule has
a proposed owner and its required enforcement points are covered. Check that
input sources and state/save paths are specified or explicitly unresolved, not
silently left to implementation. Walk relevant scenarios and boundary values;
preserve strict versus inclusive limits. Resolve omissions or surface unresolved
choices before confirmation. This is a design check, not a separate requirements
registry or a mandatory report template.

## Model and Propose

Apply the Guide to boundaries, canonical ownership, and responsibilities. Keep
local knowledge in its Spark; use other artifact kinds when their distinct
meaning warrants independent maintenance. Use the Guide's
[Model Concrete Collaborations](../../../.sparkwell/design-modeling-guide.md) criteria
to keep coordination in its owning Spark, extract it, or propose merging it.
An unchanged model is a valid result when no maintained meaning needs to change.

Choose proposed IDs using the Guide's
[Name Artifacts](../../../.sparkwell/design-modeling-guide.md) criteria. Keep existing
IDs stable unless a rename is explicitly confirmed.

Set `spark-type` only for Sparks, using the specification's supported values.
Apply the Guide's [Classify Sparks](../../../.sparkwell/design-modeling-guide.md) criteria
to distinguish responsibilities from implementation forms.
If classification is unclear, leave it unset and report the gap for review.
This workflow does not extend the type vocabulary.

Record relevant contracts and state decisions concisely in their owning Sparks;
place coordination according to the Guide's collaboration criteria.
Inputs, outputs, behavior, and state are design questions, not mandatory sections
or metadata fields. Keep simple state in its owner rather than introducing a
store or separate state Spark by default.

When drafting artifacts, apply the Guide's
[Place Rules and Cross-Cutting Concerns](../../../.sparkwell/design-modeling-guide.md) guidance.

Before writing, review the drafts together for high-level design depth, clarity,
and organization using [Organize Artifact Bodies](../../../.sparkwell/design-modeling-guide.md).
For incremental updates, start from the owning Artifact's existing text and terminology.
Preserve accurate wording, headings, order, and line breaks where the meaning is unaffected, unless a rewrite or formatting change was explicitly requested.
Express new or changed knowledge in the existing style and at a similar level of detail.
Prefer adding or changing the relevant sentence or clause over rewriting the surrounding paragraph.
Do not refresh still-accurate titles, frontmatter descriptions, or index cells just because the Artifact was touched.
Extra detail or a separate section should reflect semantic complexity, not the
recency of a requirement; reference existing rules instead of restating them.

Before creating, modifying, moving, or deleting artifacts, present one coherent, reviewable proposal for the requested scope.
For new or changed behavior, make the key responsibilities, data and contracts, state flow, collaboration outcomes, and consequential choices understandable before asking for confirmation.
When describing existing software, present the supported abstraction of the inspected implementation, its evidence, and the limits of what is known; do not fill gaps with proposed behavior.
This is the default first deliverable, not merely an artifact list or feature summary.
Judge completeness using the Guide's task scope, not the ability to regenerate the implementation.
Fully formatted drafts of every file are unnecessary.

Include scope and comparison basis, proposed artifact names, IDs, kinds, and
purpose or change; list deletions separately. Explain non-obvious boundaries and
rule ownership, the main design rationale, unresolved questions, and deferred
scope. Keep the presentation proportional to the task.

Treat feedback as an incremental revision of the current draft or accepted
design. Retain prior requirements, answers, and unaffected decisions; revise
the affected contracts, state flows, collaborating artifacts, and references.
Show the changes and update open questions rather than restarting discovery or
regenerating unchanged design. Ask again only for new blocking uncertainty.

Stop and wait for explicit user confirmation before changing files. Invoking
this Skill or requesting an update does not confirm an unseen design. Apply this
gate to both initial and revised designs. After confirmation, re-read relevant
documents before writing. If intervening changes materially affect the confirmed
design, explain the impact and obtain confirmation of the revised design;
otherwise preserve those changes and proceed. Retain before-edit content as
conversation evidence and apply only the agreed changes, preserving unrelated
accepted knowledge and valid references.
Track this invocation separately from pre-existing changes, including edits
within the same file. Then synchronize the complete Artifact index according to
the specification.

## Validate and Report

Check the result against the specification: YAML, required fields, kind-specific
fields including allowed `spark-type` values, stable IDs, `<id>.md` filenames,
kind-directory agreement, relationship target kinds, applicability declarations,
participants, composition cycles, links, and full index consistency.
Review proposed IDs for specificity and data/UI ambiguity using the Guide.
Review Spark classifications by their modeled responsibilities, not code forms.
Review representative in-scope scenarios using the Guide, including local intent,
applicable rules, and interaction semantics in Collaboration artifacts. Check
that relevant inputs, effects, and state/data flows can be followed across the
owning Sparks and Collaborations, with unresolved decisions explicit. Review
data fields and identity against the agreed read and update operations, and
service calls against the explicitly declared capabilities. Check platform-specific
wording against confirmed requirements and project constraints,
using the Guide's runtime-neutral default. Check the final artifact bodies for
duplicate definitions and redundant applicability reminders using the Guide's
[Place Rules and Cross-Cutting Concerns](../../../.sparkwell/design-modeling-guide.md)
and [Resolve Context and Review Changes](../../../.sparkwell/design-modeling-guide.md) sections.
Check that the design covers the agreed delivery boundary and distinguishes
in-scope responsibilities from deferred work, external guarantees, and mocks.
Do not treat structural checks as proof of behavioral coverage or working code.

Review this invocation's diff against the before-edit text.
Remove your own edits that merely restate unchanged meaning or reformat unaffected content unless that cleanup was requested.

Report actual changes with IDs and paths and enough before/after meaning to
distinguish this invocation from other edits. Include old and new identities for
moves or renames, validation results, and unresolved or uncovered scope. Keep the
supporting evidence in the conversation and say when it cannot be recovered.
Report when no model change was necessary.

Hand the model back for review. Do not present incremental work as complete
product coverage or automatically proceed to implementation; that work requires
its own authorized scope.