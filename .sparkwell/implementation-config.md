# Implementation Configuration

Configuration reference for `/spark-impl`. `implementations` describe what to
produce and how; `bindings` associate Sparks with those configurations. A Spark
can use several configurations, and a configuration can serve many Sparks.

Configuration can choose frameworks, libraries, service providers, and output
locations while preserving the model's recorded behavior, data ownership, service
contracts, and lifecycle guarantees. Model metadata follows the
[Artifact Document Specification](artifact-document-spec.md).

When a configuration choice affects behavior or lifecycle guarantees, first use
[Resolve Delivery Scope in the Guide](design-modeling-guide.md) to distinguish
delivery limits from changes to model commitments. If Artifact files need editing,
obtain separate, explicit approval for those files through
[Spark Design](../.github/skills/spark-design/SKILL.md).

## Central File

Use `.sparkwell/config.yaml` with three top-level fields:

| Field | Meaning |
| --- | --- |
| `schema-version` | Required integer, currently `1`. |
| `implementations` | Required map from implementation ID to its configuration. May be empty. |
| `bindings` | Required list of matching rules. May be empty. |

Implementation keys are unique lowercase kebab-case IDs, such as `web-ui`.
Binding `implementation` and `depends-on` values reference these keys, not Spark
or binding IDs. Implementation entries need no nested `id` field.

| Implementation Field | Meaning |
| --- | --- |
| `source-root` | Required path to the code or other output directory. It may not exist yet. |
| `stack` | Optional non-empty string naming the main technology, such as `react`, `aspnet`, or `openapi`. It is not a fixed generator category. |
| `depends-on` | Optional list of distinct implementation IDs whose outputs this implementation needs. Omission means no dependencies. |
| `guidance` | Optional non-empty string containing inline implementation instructions. YAML multiline text is allowed. |
| `guidance-file` | Optional path to a readable Markdown file containing implementation instructions. |

Paths in the YAML use `/`, are relative to the project root, and stay within that
project. Secrets belong in the project's normal secure configuration.

## Guidance

Use `guidance` or `guidance-file`, not both. Both may be omitted when the task and
existing project make the expected implementation clear; `stack` alone does not
define its outputs.

Guidance describes applicable Spark responsibilities, outputs, and technology
choices in plain language. For example, it can specify TanStack Query for remote
data and React hooks for local interaction state.

The binding and shared-output rules in this reference apply to every
implementation, whether guidance is present or not. Keep guidance focused on
target-specific choices instead of restating these common rules.

Guidance files are plain Markdown without configuration metadata; their filenames
do not define implementation IDs. Document-relative links can reuse shared guidance.
Native project files remain the source for dependency versions, build commands,
and established code structure.

## Bindings

Each binding names a registered `implementation` and a non-empty `match` list.
A binding's optional `id` names the rule for reference. It must be a non-empty
lowercase kebab-case string, unique within `bindings`. It does not affect matching
or pair deduplication.

Each `match` item is a non-empty map of selectors:

| Selector | Matches |
| --- | --- |
| `id` | An exact Spark ID. |
| `spark-type` | A declared Spark type from the model specification. |
| `id-pattern` | A whole-ID pattern: `*` matches zero or more characters, and `?` matches one character. Other characters are literal. |

Selector values are non-empty strings and match metadata case-sensitively, not
filenames or body text. Missing `spark-type` cannot match that selector; `*-ui`
matches an ID suffix, not all UI Sparks.

- List items use OR; fields within an item use AND.
- Rules are additive; neither order nor specificity overrides another rule.
- Repeated matches select the same Spark and implementation pair only once.

Bindings describe associations, not work scope. Related Constraints, Aspects, and
Collaborations need no bindings just to supply design context.

A match must also fit the configuration's outputs. For example, an HTTP-client
configuration does not fit a background Service without an HTTP interface.
Unmatched Sparks have no configured implementation.

Every Spark whose implementation is to be generated needs a binding to its
producing implementation, including Data Sparks. Any supported selector can
provide that explicit match; a separate binding per ID is unnecessary. A binding
does not require a separate file, package, or runtime component. Other Sparks may
remain unbound when they only supply context or their existing outputs are reused.
If their implementation must be created or updated, resolve the missing binding
before generating it rather than inheriting a consumer's binding.

Sharing a source root is valid when outputs differ; conflicting output claims or
incompatible instructions are configuration conflicts.

## Dependencies

`depends-on` links to required outputs, not runtime service availability, package
dependencies, or deployment order. Referenced implementations must exist;
self-dependencies and cycles are invalid.

Guidance identifies the needed outputs and their use; the dependency edge alone
does not. Suitable upstream outputs satisfy a dependency without implying
regeneration or permission to edit them.

Each prerequisite uses its own bindings, restricted to Sparks needed by the
consumer. A dependency neither copies the consumer's Spark selection nor selects
everything bound upstream. Spark `uses` is a separate design relationship.

`uses` and `composes` identify dependency or part candidates, not implicit
implementation targets. Including composed parts in the work still resolves each
part through its own bindings. Neither relationship authorizes generating every
available implementation of the related Spark.

## Shared Outputs

Use guidance and existing package or contract boundaries to identify one producing
implementation and stable output locations for each shared representation.
Consumers in that boundary reference the shared definition instead of generating
their own copies. Binding the same Data Spark to every consuming service's
implementation does not by itself establish sharing.

For example, services A and B in one client package should import the same Todo
type. TypeScript and Swift clients need separate representations; that is not
duplication within one shared boundary. Multiple files may together implement a
representation, so this rule does not impose one file per Spark.

Pair deduplication prevents repeated selection of a Spark/implementation pair;
it does not detect equivalent definitions in different files. Existing code and
Implementation Maps locate reusable outputs, while the implementation workflow
checks reuse and repeat-run behavior. Maps remain provenance, not generation
completion flags.

## Example

This hypothetical contract-first setup uses `api-contract` as the shared interface
source for the server and client. It is not the current project's configuration;
its named Sparks and guidance file must exist in a project using it.

```yaml
schema-version: 1

implementations:
  api-contract:
    source-root: src/contracts
    stack: openapi
    guidance: |
      Generate and maintain the shared HTTP interface for the selected services.
      Describe it with OpenAPI, preserving the Spark-defined capabilities.
        Place data schemas in OpenAPI components.

  api-server:
    source-root: src/api
    stack: aspnet
    depends-on: [api-contract]
    guidance: |
      Implement the selected services using the matching OpenAPI documents
      produced by api-contract and the behavior defined in their Sparks.
        Provide the selected Data Sparks' server types.

  web-client:
    source-root: src/web/client
    stack: typescript
    depends-on: [api-contract]
    guidance-file: .sparkwell/implementations/web-client.md

  web-ui:
    source-root: src/web
    stack: react
    depends-on: [web-client]
    guidance: Use web-client outputs for the service interactions in the selected UI Sparks.

bindings:
  - match: [{id: todo-service}, {id: reminder-service}]
    implementation: api-contract
  - match: [{id: todo-item}]
    implementation: api-contract
  - match: [{id: todo-service}, {id: reminder-service}]
    implementation: api-server
  - match: [{id: todo-item}]
    implementation: api-server
  - id: service-clients
    match: [{id: todo-service}, {id: reminder-service}]
    implementation: web-client
  - match: [{id: todo-item}]
    implementation: web-client
  - match: [{spark-type: ui}]
    implementation: web-ui
```

`api-contract` defines the shared routes, request and response formats,
serialization, and errors. `api-server` owns the corresponding server types,
shared by its handlers. The external guidance explains how `web-client` uses
the contract to generate service access code and one shared representation for
each selected Data Spark. Both service clients reference that representation.
The UI imports the client types rather than generating them again; it does not
need its own `todo-item` binding for that reuse. Client and UI generation do not
require a running server.

In the server-first variant, `api-contract` and its binding are absent.
`api-server` has no `depends-on` entry and its guidance describes maintaining the
HTTP interface. `web-client` instead has `depends-on: [api-server]` and guidance
identifying the server's exported interface or source code as input.

These examples do not define fixed configuration modes. OpenAPI is optional;
work without HTTP needs no HTTP contract. A Monitor can use its own stack while
keeping the model's execution and data-access commitments.

## Validity Rules

  Duplicate YAML keys, unknown fields, malformed values, unresolved implementation
  references, and violations of the rules above are invalid. Omitted optional lists
  mean empty lists; `null` is invalid.

## Scope of This Format

  This format excludes Packs, inheritance, and fixed binding roles. Task planning,
  approval, execution, validation runs, reporting, and code provenance are separate
  from the configuration reference.