# Implementation Map

An Implementation Map records file-level associations between model Artifacts and existing implementation files.
It supports lookup and impact analysis, not progress tracking.
Bindings describe intended associations; maps describe actual outputs.

## Location

Each implementation has an optional map at
`.sparkwell/implementation-maps/<implementation-id>.yaml`. The ID is a key in
`implementations` from the [configuration](implementation-config.md), not a
binding ID. Maps are project files suitable for version control.

## Format

```yaml
schema-version: 1
implementation-id: web-client
artifacts:
  - path: src/web/client/todo-client.ts
    derived-from: [todo-service, todo-item]
```

This is a hypothetical example, not a configuration or mapping for this project.

| Field | Meaning |
| --- | --- |
| `schema-version` | Required integer, currently `1`. |
| `implementation-id` | Required registered implementation ID, matching the filename. |
| `artifacts` | Required list of output records. An empty list is valid. |
| `artifacts[].path` | Unique project-relative path to an existing file within the implementation's `source-root`. |
| `artifacts[].derived-from` | Non-empty list of distinct model Artifact IDs whose design the file implements. |

Paths use `/` and stay inside the project, including after resolving symlinks.
Directories are not outputs. Sources follow the
[Artifact Document Specification](artifact-document-spec.md) and may be Sparks,
Constraints, Aspects, or Collaborations. Merely reading a document does not make
it a source of the file.

Output records are ordered by path and source IDs alphabetically when written by
the tools. Duplicate YAML keys, unknown fields, duplicate output paths, malformed
values, and `null` are invalid. Missing output files, source IDs, or implementation
IDs make a map stale; they do not authorize deleting files or inferring a rename.

## Meaning

- A file can implement several Artifacts; an Artifact can contribute to several
  files and implementations.
- Existing code can be mapped after a model is created, without changing or regenerating the code.
  `derived-from` names the modeled knowledge the file realizes; it does not prove that the Artifact preceded or generated the file.
- Code, tests, and interface definitions can be mapped. Build outputs, caches,
  lock files, and generic tooling are not mapped merely because they were created.
- A missing map or entry does not prove that an implementation is absent.
- A mapping does not prove completeness, correctness, test success, ownership,
  or permission to overwrite a file.
- Validation failure does not erase the fact that a file was created or changed.
- Maps contain no completion flags, test results, content hashes, timestamps,
  credentials, or copies of model definitions.

## Map Existing Code

A human or agent can propose associations by inspecting accepted Artifacts and the existing code, with the connecting responsibilities or rules as evidence.
Similar filenames, reading a document, or sharing a source directory alone does not establish an association.
Mapping work needs its own authorized scope; a design-only or read-only review does not authorize map writes.
Use the existing preview and targeted update workflow in [Tools](tools.md); no code edit or generation run is required.
[Spark Discover](../.github/skills/spark-discover/SKILL.md) can include Artifacts, configuration, and maps in one confirmed proposal when adopting existing code.

## Targeted Changes

An update supplies complete replacement records for specified paths and/or paths
to remove from the map. Records for other paths remain unchanged. Removing a
record changes only the map, not the output file. Updating an Artifact ID is an
explicit mapping change, not a name inferred from similar files.

The resulting map must satisfy the format and reference rules. Stale records can
be explicitly corrected or removed; they are never silently discarded. Temporary
JSON returned by a selection tool is not an Implementation Map.