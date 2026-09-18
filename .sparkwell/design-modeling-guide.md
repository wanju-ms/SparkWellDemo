# SparkWell Design Modeling Guide

Judgment criteria for organizing current software knowledge as Artifacts. Shared
principles and document rules remain in the [Overview](sparkwell-overview.md)
and [Artifact Document Specification](artifact-document-spec.md).

## Start With the Design Question

Use the requested behavior, capability, design question, or change to select
scope. Read the relevant current model, accepted project constraints, and
implementation context. Roots and indexes orient the work; neither defines a
mandatory traversal or decomposition. A diff locates changes but does not replace
the current meaning of affected artifacts.

Preserve accepted observable behavior and quality commitments explicitly, rather
than expecting readers to infer them from an implementation choice. Distinguish
those commitments from mechanisms and design rationale in the owning artifact.
Unresolved product or design choices remain open; a missing decision is not
permission to invent a requirement.

Judge completeness against the task, not the entire product or the ability to bootstrap a new implementation.
When describing existing software, record the part supported by inspected code and other evidence; identify unknowns and uncovered scope without inventing behavior to complete the model.
For new or changed behavior, aim for a coherent high-level design within the agreed delivery scope, not a prose implementation.
Retain the concepts, key contracts, state lifecycles, and collaborations needed
to understand how the requested behavior works. Include detail when it changes
a boundary, rule, collaborator's expectations, or consequential design tradeoff.
Routine helper methods, framework wiring, and branch-by-branch mechanics belong
in implementation. If a body becomes a code walkthrough, summarize the underlying
responsibility or protocol rather than spreading the same detail over more
artifacts. Preserve meaningful conditions instead of cutting them to meet a
word count.

## Resolve Delivery Scope

Distinguish intended system behavior, the project's responsibility boundary, and
the part being designed or delivered now. Resolve these from the request and
accepted project or conversation context; do not require a separate scope form
or ask the author to repeat a settled boundary.

- For frontend-only work, cover frontend responsibilities and any required
	external service contracts, not backend internals. Reuse existing contracts;
	otherwise propose the needed contract and identify unconfirmed assumptions.
	Propose mock behavior explicitly, and do not treat it as real persistence or
	proof that a backend fulfills the contract.
- For frontend-and-backend work, identify client and server responsibilities and
	their communication contract, including validation, authoritative data, and
	persistence where required. Trace the end-to-end state path and important
	failures across both sides; a storage abstraction alone does not explain the
	backend design. Recommend a coherent design without waiting for the author to
	name each component, while leaving unnecessary technology choices open.
- Treat "frontend first" as an iteration boundary, not a permanent product
	exclusion. Preserve accepted backend knowledge even when no backend work is
	authorized in this iteration.

Clarify an unknown boundary only when it blocks a coherent proposal; otherwise
state the interpretation and any consequential open decisions. Do not silently
assume either a remote backend or a mock-only delivery. Separate guarantees
implemented in scope from those required of external dependencies; a client
proxy does not own the remote system's durable data.

Keep temporary work limits in the proposal and report. Preserve accepted,
lasting responsibility boundaries and external contracts in the relevant
knowledge owners. No new artifact kind, metadata field, or duplicated business
model is needed to express the work scope.

## Use Established Methods Selectively

Follow methods selected for the task or established by the project. Otherwise,
choose proportionate methods for the question: responsibility-driven design or
CRC and information hiding for boundaries and collaboration; DDD for domain
invariants and consistency boundaries; use cases, sequence models, or state
models for behavior and lifecycles; C4 for structural context and communication.

These are examples, not a required list or sequence. Use established practices
without creating a Spark-specific version of each method. Reconcile their
findings into one design; a diagram box, class, or pattern role does not by itself
justify a separate artifact.

## Choose Spark Boundaries

Start with a coherent software concept or responsibility and the decisions it
owns. Consider which information changes together, which invariants and state
need one owner, and which details collaborators should not need to know.
Cohesion, coupling, and reasons for change inform the boundary; code layout and
visual grouping alone do not determine it.

Check existing Sparks first. Reuse one when its responsibility and contract
already meet the need. If the new behavior belongs to the same responsibility,
prefer proposing an extension and explain its impact on existing behavior and
consumers. Propose a new Spark when no existing owner fits or extending one
would mix unrelated responsibilities. Similar names alone do not establish a match.

Split when concepts have independently meaningful responsibilities, decisions,
or lifecycles. Merge when readers must reconstruct one concept from repeated
rules or mostly forwarding documents. Compare alternatives under the same
accepted requirements and a plausible change. Hypothetical changes test a
boundary; they are not new scope or reasons to prebuild extra concepts.

Discover candidates from the responsibilities implied by accepted scenarios,
not only names in the request. An editor's data-entry and submission
responsibilities may justify a Spark separate from application composition and
navigation. A separate page, dialog, or draft implementation is not a prerequisite
for that boundary.

**Example:** A simple list may remain within an application Spark. A list with
its own selection, ordering, and interaction model may be easier to understand
separately. Neither a separate UI component in code nor the app's small size
settles that decision.

Name the knowledge owner by meaning, not by where a rule is displayed, executed,
or first discovered. A domain rule can be owned by one Spark and enforced by
several collaborators. The root or current caller does not automatically own it.

For UI Sparks, retain agreed interaction spaces, actions, navigation, states,
and visual requirements. Design references and interaction notes can be clearer
than prose; a Figma component is not a mandatory Spark boundary. For other
concepts, preserve the data semantics, contracts, state ownership, and decisions
needed to understand them. Leave routine coding detail to implementation.

Keep logical design independent of runtime and technology by default. Include
platform-specific details when relevant to explicit requirements or confirmed
project constraints. A UI does not imply a browser, and persistence does not
imply local or device-only storage. Ownership, loading, commit behavior, and
state lifecycles can be designed without selecting a storage API or database.
Neither the `service` type nor a repository abstraction implies a remote backend.
Technology neutrality does not justify leaving required responsibility or
deployment boundaries unexplained.
If a new platform or technology choice is necessary for an in-scope decision,
propose it for confirmation; otherwise defer it to implementation without
blocking logical design.

## Classify Sparks

Choose `spark-type` from the specification's supported list based on the Spark's
primary responsibility, not its name or implementation form. Leave unclear
classification open for review rather than forcing a category. Classification
supports understanding, filtering, and views; it does not determine boundaries,
rule ownership, or architecture.

- An independent in-memory store, calculator, or runtime coordinator can be
	`logic`; the record structure it manages remains `data`. Local file or database
	access can be `service`, even within the application's process.
- A monitor that owns continued expiration checks while the client is closed is
	`service`; a calculation invoked by that monitor can be `logic`. The distinction
	is the owned service lifecycle, not merely using a timer or background thread.
- A UI or service remains classified by its main responsibility even when it
	contains state or calculations. Do not extract that logic merely to classify it.
- A React Hook may implement internal logic, a UI interaction, or client access
	to a service. Its form alone neither selects `logic` nor justifies a new Spark.
	One Spark can be implemented by several hooks, components, and functions.

A Service Spark can describe a contract and required behavior realized by client
access code and a backend or local provider implementation. Keep the parts'
responsibilities explicit within the agreed delivery scope, including which
provider owns authoritative data. Multiple implementation parts do not by
themselves require separate Sparks.

## Name Artifacts

Choose concise IDs that identify the concept and its granularity or responsibility
without relying on directories or metadata. Compare related names for ambiguity
even before collisions exist: `todo-item` and `todo-collection` distinguish an
item from its collection, while a bare `todo` could also mean the application.

If a name could describe either data or UI, add a qualifier that makes the role
clear. For example, prefer `todo-list-ui` to `todo-list` for a list interface;
`-component` alone may still leave its category unclear. Add responsibility or
type qualifiers only where useful, not mechanically to already clear names such
as `todo-editor`.

## Describe Data Models

For data Sparks, describe the logical fields needed by the in-scope behavior.
Consider whether instances with identical contents must still be selected,
referenced, or updated separately. When identity is needed, propose its field,
uniqueness scope, and stability; do not add IDs to every model. An instance ID
belongs in the data model's body and is distinct from the artifact's frontmatter
`id`. Specify how IDs are generated only when it materially affects the design.

Use a field table when it makes types, meanings, and rules easier to compare,
with columns such as `Field`, `Type`, and `Meaning / Rule`. Cover the logical
fields in the agreed scope, not every possible database or framework column.
Define field rules in the table or prose, not both. A table is an optional way
to express the model, not a required template or a physical database schema.

## Describe Service Contracts

Design service capabilities from the requested behavior and agreed scope. In the
owning Service Spark, describe each capability's purpose, concept-level inputs
and outputs, and important success and failure behavior. Include triggers and
execution-lifecycle commitments for scheduled or event-driven work. Reference
Data Sparks for their data semantics and rules.

## Organize Artifact Bodies

During incremental updates, apply these writing rules only to new or necessarily changed text unless the user requests a broader rewrite.
Do not polish accurate existing prose merely to match a preferred style.

Write titles, descriptions, and bodies as a brief, plain explanation to a teammate.
Use short active sentences and common words; give each sentence one main point and make clear who does what and when.
Use direct verbs rather than abstract phrases, and avoid formal or academic wording.
Keep technical terms and established names when needed for accuracy; explain unfamiliar terms briefly.
Use simple headings such as "Saving", not "Submission Lifecycle", and avoid repeated labels such as "Ownership:".

Shorten wording, not meaning.
Remove filler, repeated facts, generic assurances, and explanations of common engineering knowledge.
Preserve every distinct rule, condition, limit and unit, state change, failure outcome, scope boundary, and unresolved choice, including restrictions such as "only" and "until".
Keep requirements, recommendations, and open questions distinct.
Before finishing, simplify the prose once more and check that no design fact or condition was lost.

**Wording example:** Write "If saving succeeds, close the modal and clear the draft" instead of "A successful save outcome closes the modal and clears the draft".

Organize multi-paragraph bodies covering distinct topics under concise `##`
headings. Use `###` and `####` only for meaningful subdivisions, without requiring
every level. Choose headings from the content; keep brief single-topic bodies
unsectioned. Reorganize existing content rather than adding introductions,
summaries, or repeated rules.

Within sections, prefer flat bulleted lists for multiple distinct points, with
one meaningful point per item. Use numbered lists when sequence matters. Keep
short paragraphs for a single point or a connected explanation, and tables for
structured fields or comparisons. Do not repeat the same content in prose and
lists, or add detail merely to fill list items.

Use semantic line breaks for prose: keep each complete sentence on its own source line instead of wrapping at a fixed column width.
Keep continuation sentences indented within their list item, and use blank lines only for paragraph boundaries.
Use editor soft wrapping for display; preserve line breaks in unchanged text rather than reflowing surrounding paragraphs or whole files.
Leave YAML, Markdown tables, and fenced code or diagrams in their required layout.

For Logic Sparks, use Mermaid flowcharts for decisions or data flow and state
diagrams for state changes when they help. Keep simple logic in prose and diagrams
at design level, not as code walkthroughs.

Let diagrams show the main flow and text supply conditions, guarantees, and
rationale that the diagrams leave out, without repeating each step. Use consistent
names and keep both aligned with the rules, participants, and contracts. Resolve
contradictions rather than choosing one representation silently. Diagram choice
does not determine Artifact or runtime component boundaries.

## Place Rules and Cross-Cutting Concerns

For each accepted rule, distinguish its canonical owner, where it applies, and
how each in-scope responsibility enforces or responds to it. Recording data
validity alone does not describe the UI's input or submission behavior.

Define each shared rule and its parameters once in the canonical owner's body.
This also applies to nonnumeric decisions such as initial state, resets, and
retention. Other Sparks describe their local enforcement or coordination and
link to the owner instead of redefining the shared decision. For example, a
collection may define "Each run starts empty and discards its data on exit."
Its consuming App says "Displays the collection's current values." Writing
"Displays the initially empty collection" still repeats a shared fact, even
though it appears in a descriptive clause rather than a separate rule.
A rule does not need a metadata field or separate Constraint just to be referenced.

State each rule once, even when the input repeats it as an allowed range, an
equivalent maximum, or rejection of the remaining values. Delete equivalent
claims rather than joining them into one sentence. Preserve distinct scope,
conditions, exceptions, outcomes, enforcement behavior, and meaningful design
rationale.

**Wording example:** "Every Todo creation or update requires a description of
fewer than 1,000 characters." The maximum and rejected range are already implied;
omit them instead of appending more clauses.

Consider both local ownership and an independent Constraint for shared rules.
Keep a local rule with its natural Spark when that makes it easy to understand
and maintain. Extract it when the commitment merits independent review or change,
or has no useful local owner. Multiple enforcement points alone do not decide
the choice. Once extracted, the Constraint is the rule's canonical owner; its
targets own their data or interaction behavior and enforcement, not another
definition of that rule. An Aspect expresses a repeatable concern across
independent concepts, not every rule that has multiple enforcement points.

**Example:** Suppose a Todo description must have fewer than 1,000 characters.
Check both data validity and the editor's submission behavior. Preventing excess
input and allowing invalid input while blocking submission are different UI
choices; clarify the intended behavior when it matters. If data and UI enforcement
are both accepted and the rule is maintained as a Constraint, its `applies-to`
includes both Todo and Todo Editor. If Todo remains the owner and input prevention
is chosen, the editor describes limiting typed and pasted input by reference to
Todo's rule, without restating the threshold as 999 characters.

Keyboard accessibility across independent interactive concepts can instead be
an Aspect with a semantic scope. These are conditional placement examples, not
requirements for every Todo product.

An Aspect can own its requirements directly. Reference an independently maintained
Constraint when useful rather than creating a mandatory Aspect/Constraint pair
or copying the same rule. Choose explicit targets for a concrete set, or semantic
scope when applicability follows a shared property. Linked rules keep their own
scope; changing an Aspect does not silently widen them.

## Model Concrete Collaborations

Choose where to describe an interaction by its understanding and maintenance
value, not just participant count or the presence of a design-pattern name.

- Keep a short flow in its coordinating Spark when it naturally explains that
	Spark's responsibility without obscuring the rest of its design.
- Extract a Collaboration when the interaction itself benefits from independent
	review or change, such as a shared protocol or complex coordination of state,
	failures, and recovery. A single coordinator does not rule out extraction.
- Consider merging a Collaboration into its coordinating Spark when the separate
	document mainly adds navigation between fragments of one responsibility.
	Preserve accepted ordering, guards, and outcomes and update affected references.

When extracted, record participants and roles, significant ordering or state
transitions, relevant failure or cancellation behavior, and the rationale for
consequential coordination choices. Name an adopted pattern when it helps
explain the concrete design, without copying its general tutorial.

Use Mermaid in Collaboration bodies when a diagram makes the interaction easier
to follow. Prefer sequence diagrams for messages and ordering; use flowcharts for
branching or parallel work, or state diagrams for cross-participant lifecycle
transitions. Short interactions may be clearer as prose.

Keep each participant's local responsibilities in its Spark. The Collaboration
owns their protocol and coordination, referring to existing rules rather than
repeating them. A runtime coordinator can itself be a Spark; the Collaboration
is the description of participants working together, not another coordinator.
A pattern entirely internal to one Spark does not require artificial participants.

**Example:** If an App coordinates one Editor's Save/Cancel with a Repository,
the short flow can stay in the App while referencing each participant's contract.
If the design includes multiple editing entry points and shared conflict or
recovery rules, a separate Editing Collaboration may make that protocol easier
to review. Both placements retain the interaction semantics; neither requires
different runtime components merely to match the documents.

## Resolve Context and Review Changes

Assess a Spark with its incoming and outgoing relationships, applicable
Constraints and Aspects, participating Collaborations, and relevant source or
implementation references. Resolve Constraint and Aspect applicability from
their `applies-to` or `scope`; a target Spark needs no backlink. Do not add a
sentence or link merely to repeat that an external rule applies. Keep body
references when they explain local behavior or a design decision, such as an
editor's response to invalid input.

Re-evaluate semantic scopes when Sparks or scopes change; ask about material
ambiguity and expose conflicts instead of inventing precedence.

Use `composes` for actual whole-to-part structure, not mere appearance in the
same UI or participation in a flow. Use `uses` for a dependency. Reusability or
being auxiliary does not decide between them. Scope and participant links serve
different purposes and do not automatically create either relationship.

Walk representative in-scope scenarios across local behavior, applicable rules,
and collaborations. Check that product commitments are preserved and the recorded
design explains how responsibilities work together. References alone establish
neither requirement coverage nor implementation correctness.

Consider affected collaborators and applicability, but do not equate context
with permission to edit every related artifact. Revise only decisions affected
by the change, including scope and participant relationships when necessary.
Keep remaining questions and uncovered scope explicit; do not add artifacts
merely to complete a taxonomy.