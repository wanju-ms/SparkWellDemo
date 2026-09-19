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
schema-version: 2
implementation-id: web-client
artifacts:
  - derived-from: [todo-item, todo-service]
    paths:
      - src/web/client/todo-client.ts
      - src/web/client/todo-validation.ts
```

This is a hypothetical example, not a configuration or mapping for this project.

| Field | Meaning |
| --- | --- |
| `schema-version` | Required integer, `2` for grouped storage; legacy `1` remains readable. |
| `implementation-id` | Required registered implementation ID, matching the filename. |
| `artifacts` | Required list of output groups. An empty list is valid. |
| `artifacts[].paths` | Non-empty list of distinct project-relative paths to existing files within the implementation's `source-root`. A path occurs only once across all groups. |
| `artifacts[].derived-from` | Non-empty list of distinct model Artifact IDs forming the complete association set for every file in the group. |

Paths use `/` and stay inside the project, including after resolving symlinks.
Directories are not outputs. Sources follow the
[Artifact Document Specification](artifact-document-spec.md) and may be Sparks,
Constraints, Aspects, or Collaborations. Merely reading a document does not make
it a source of the file.

Tool writes combine files with identical complete source sets into one group, with an inline `derived-from` list and one explicit path per line.
Source IDs and paths are sorted alphabetically; groups have a deterministic order based on their sorted source lists.
The format remains many-to-many: a group can name several Artifacts without repeating its files in other groups.

Legacy version `1` uses per-file records with `path` and `derived-from`, in either block or flow YAML.
Readers expand both versions to the same per-file representation; new or changed maps are written as version `2`.
Updates with no mapping changes preserve the existing bytes, including a legacy storage format.

Duplicate YAML keys, unknown fields, duplicate output paths, malformed
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

Tool JSON results retain the expanded version `1` map with individual `path` records, so filtering and file lookup do not depend on storage groups.
Update inputs also remain per-file: each upsert supplies `path` and its complete `derived-from` list, never `paths`.
An update supplies complete replacement records for specified paths and/or paths
to remove from the map. Records for other paths remain unchanged. Removing a
record changes only the map, not the output file. Updating an Artifact ID is an
explicit mapping change, not a name inferred from similar files.

Changing one file's source set moves only that file to the appropriate group on the next write; other files in its former group keep their associations.
Removing one file leaves the remaining group members intact, and empty groups are omitted.

The resulting map must satisfy the format and reference rules. Stale records can
be explicitly corrected or removed; they are never silently discarded. Temporary
JSON returned by a selection tool is not an Implementation Map.