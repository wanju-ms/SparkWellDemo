# SparkWell Overview

SparkWell helps people and AI understand, review, and deliberately evolve
software through shared, durable knowledge. Code generation is useful, but the
model's primary purpose is continued understanding of the system. More documents
or mandatory generation steps are not the goal.

## One Current Model

Requirements, ideas, feedback, and code changes are inputs. After understanding
and review, their accepted meaning becomes maintained model knowledge. History
belongs in Git, issues, and source records rather than a parallel requirement
registry or a change log inside the current model.

The model preserves both intended product behavior and consequential software
design decisions. Keep clear which statements are product commitments and which
are chosen mechanisms, without separating them into modeling layers. Code
describes the implementation; it does not silently redefine those commitments.

## Knowledge Artifacts

Artifact is the common term for a document in the model. Its kind identifies the
knowledge it owns:

| Artifact | Main question |
| --- | --- |
| Spark | What is this software concept or responsibility, and what does it do? |
| Constraint | What invariant, limit, or commitment applies within this scope? |
| Aspect | What cross-cutting concern applies to which concepts? |
| Collaboration | How do these Sparks work together to accomplish meaningful behavior? |

A Spark may describe a user-facing interaction space, domain model, service, or
coordinator. It is not a synonym for a file, class, control, or anything worth
documenting. A Collaboration describes interaction, not an extra runtime
component. Constraints and Aspects preserve rules and scope, not implementations
that automatically enforce them.

All four kinds share the [Artifact Document Specification](artifact-document-spec.md)
and [Artifact index](../artifacts/index.md). Create only the artifacts that help
explain the current design. A small model does not need an instance of every kind.

## Boundaries and Ownership

The central modeling decision is where knowledge belongs. Use established
approaches such as responsibility-driven design, information hiding, and domain
modeling to find coherent concepts and useful boundaries. Separate them when
people can understand and evolve their responsibilities independently; merge
them when a split mainly scatters one concept across documents.

Keep local behavior and rules in their natural Spark, even if several other
Sparks rely on them. Extract a Constraint when the commitment has independent
meaning or no useful local owner. Use an Aspect for a repeatable cross-cutting
concern, not merely because a rule affects several places. Each piece of knowledge
has one canonical owner; readers follow references instead of maintaining copies.

Keep simple coordination in its responsible Spark. Use a Collaboration artifact
when a multi-Spark interaction benefits from independent understanding, review,
or change, preserving the roles and coordination that dependency edges alone
cannot explain. A design-pattern name does not require a separate artifact. The
[Design Modeling Guide](design-modeling-guide.md) provides judgment criteria and examples,
without prescribing a fixed architecture or one artifact per modeling element.

## Resolved Context and Views

An artifact document contains its own knowledge and declared relationships. To
understand a Spark, also consider incoming relationships, applicable Constraints
and Aspects, participating Collaborations, and relevant implementation links and
provenance when available. This is its resolved context.

Store each relationship once, but make it available from useful directions.
For now, the design workflow resolves this context on demand from current files,
including semantic applicability scopes. Unresolved applicability or conflicting
rules must be surfaced. Persistent reverse indexes and interactive context views
are possible tooling improvements, not additional authorities or prerequisites.

Requirements views, mockups, architecture diagrams, and interaction views can be
derived from the same maintained knowledge. They must represent what is recorded,
not infer missing product promises from code or present design gaps as decisions.

> **Store once, view many ways.**

## Work and Evolution

**Artifacts store project knowledge. Skills define process. Code implements the
design.** Reusable methods belong in Skills or project conventions; their concrete
application belongs in the model.

One design workflow accepts a change or design question and proposes updates to
the affected artifacts. Modeling is incremental: preserve accepted behavior and
record unresolved decisions and uncovered scope. The in-scope product intent and
design should be understandable without reconstructing the original conversation.
Do not require all internal design decisions before useful modeling can begin.

Separate the system's intended behavior and lasting project responsibilities
from the current task's design and delivery scope. A partial delivery neither
removes accepted knowledge nor proves that external dependencies are implemented.

Relationships and applicability identify candidates for review. Actual changes,
their meaning, and the collaborators' responsibilities determine which artifacts
need updates. A code change can reveal a model problem, but accepting a new design
or product behavior remains an explicit decision.

The design Skill stops at model review. Implementation requires its own authorized
scope, and model validation does not replace code review, tests, or runtime checks.
When a derived view disagrees with its source, correct the view or review the
owning artifact rather than maintaining conflicting copies.
