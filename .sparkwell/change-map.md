# Change Map

A Change Map associates code diff blocks or changed lines with Spark Graph changes for review.
It belongs to one comparison, not to the project's persistent [Implementation Maps](implementation-map.md).
The [Spark Trace Skill](../.github/skills/spark-trace/SKILL.md) supplies semantic links; the tool supplies and validates Git facts.
Store reports under the project's `traces/` by default; keeping them in Git is optional.
No PR viewer, automation test, or persistent generation state is part of this format.

## Commands

Requires Node.js 24+ and `npm ci --prefix .sparkwell/tools`.
For `extract` and `check`, run from the Git repository root, or pass `--root PROJECT`.

```sh
node .sparkwell/tools/trace.js extract --base BASE_SHA --head HEAD_SHA --output traces/sparkwell-change-map.json
node .sparkwell/tools/trace.js extract --worktree --output traces/sparkwell-local-change-map.json
node .sparkwell/tools/trace.js check --input traces/sparkwell-change-map.json --complete
```

Use a new output path for each extraction; existing files are never overwritten.
Without `--output`, extraction writes the report itself to stdout.
With `--output`, it writes a private JSON file and prints an `ok` summary with its path and comparison.
`check` accepts a file or `--input -` for stdin and returns an `ok` JSON summary.
Invalid input, stale facts, or failed validation returns exit code 1 and JSON diagnostics.
`--help` lists options.

| Extract option | Meaning |
| --- | --- |
| `--base REV --head REV` | Compare the resolved commit trees, including added, removed, and changed files. |
| `--worktree [--base REV]` | Compare a base, defaulting to HEAD, with the net current working files. Includes staged, unstaged, and non-ignored untracked files. |
| `--merge-base` | Explicitly use the unique merge base with the requested head, or captured HEAD in worktree mode. Not inferred automatically. |
| `--path PATH` | Restrict changed files to an exact repository-relative file or directory prefix. Repeat for multiple paths; paths use `/`, not globs. |
| `--notes PATH` | Optional JSON array of externally supplied `{source, text}` comments. No remote fetching. |
| `--output PATH` | A new `.json` file, normally under `traces/`. |

Two revisions compare their final snapshots, not a concatenation of individual commit patches.
For a PR, select the same base used by the review, commonly an explicitly requested merge base.
If a design commit precedes the selected base, it is unchanged context, not a design diff.
Worktree extraction reports `no-design-diff` when appropriate; choose an earlier base explicitly if both design and implementation changes should be compared.
`--path` filters code and design diffs alike; include the relevant Artifact paths when narrowing a trace to selected code files.
The tool never checks out, stages, commits, or pushes repository content.

## Lookup from a Review Selection

`lookup` reads a saved report and displays the code diffs, related before/after design content, and existing explanations for a selected code location.
It does not call an LLM, read current source files, or require a Git repository.
Relative input filenames resolve from the current directory, or `--root` when supplied.

```sh
node .sparkwell/tools/trace.js lookup --input traces/sparkwell-change-map.json --selection - <<'JSON'
{"path":"src/api/todo-service.js","side":"new","start":111,"count":1}
JSON
```

Use `--selection selection.json` to read the same object from a file.
Either `--input` or `--selection` can read stdin with `-`, but not both in one invocation.

The default `--format text` output groups code diffs, before/after design content, and explanations without displaying internal file, change, Artifact-context, or link IDs.
Each group keeps all code and design references sharing the explanation, including related code outside the selected location; it does not imply separate pairwise associations.
Each block includes file paths and the full captured hunk, with `References` marking the whole change or the narrower old/new line ranges cited by the link.
Code uses unified diff; design shows `-- before --` and `-- after --` source text without diff prefixes, retaining the associated hunk's context rather than displaying the entire file.
Design hunk ranges are shown separately, and an empty side is marked `(empty)`.
Multiple references to the same hunk display that block once per group.
Unchanged design clauses display their captured text and source range instead of a fabricated diff.
Renames and non-text changes display paths, status, and any recorded limitation when no text patch exists.
Unmapped code displays its diff and recorded reason.

| Selection field | Meaning |
| --- | --- |
| `path` | Exact repository-relative path on the selected side, using `/`. Renames have separate old/new paths. |
| `side` | `old` for the before version or `new` for the after version. |
| `start`, `count` | Optional pair of positive integers: 1-based source-file start line and number of selected lines, not diff display positions. Omit both for file-level lookup. |
| `base`, `head` | Optional pair of full commit SHAs, matched exactly against the report's effective comparison. |

Use `--format json` for the machine-readable result with `ok`, `comparison`, `comparison-check`, `selection`, `links`, and `unmapped`.
Each returned link retains its original `explanation`, relation, confidence, and full code/design anchor groups; `matched-code` identifies the code anchors hit by the selection.
A link appears once even when several of its code anchors match.
The `unmapped` array contains matching code entries and their recorded reasons, including unfinished or unsupported analysis when present.

Line lookup intersects the selected range with changed lines and any narrower link anchors on the same side.
Unchanged context lines do not match just because they appear inside a hunk.
File-level lookup also supports pure renames, mode-only changes, and non-text limitations without inventing line matches.
No matching changes prints `No matching changes.` in text mode, or empty `links` and `unmapped` arrays in JSON mode, with exit code 0.
Invalid input or mismatched versions returns JSON diagnostics and exit code 1 in either mode.

When `base` and `head` are supplied, `comparison-check` is `matched`; otherwise it is `not-requested` and the caller must ensure the coordinates belong to the saved comparison.
A worktree report's captured HEAD does not identify its uncommitted contents, so it cannot satisfy a commit-pair lookup.
Worktree reports can still be queried without that pair using their captured coordinates.
Lookup does not revalidate snapshot freshness or the truth of explanations; use `check` separately when the recorded snapshots are available.

An embedded consumer can import `lookupTrace(trace, selection)` from [tools/trace.js](tools/trace.js); it returns the same result without the CLI's `ok` field.

## Captured Facts

The report has `schema-version: 1` and these fields:

| Field | Meaning |
| --- | --- |
| `comparison` | Mode, effective base SHA, requested base SHA, head SHA or captured HEAD, path scope, exclusions, diff format, and content fingerprint. |
| `files` | Changed file IDs, roles and statuses, old/new paths, Git blob OIDs, modes, sizes, line counts, limitations, and candidate design sources. A missing side is null. |
| `code-changes` | Diff blocks for code and other engineering outputs outside the model directories. Unmapped files are not silently excluded. |
| `design-changes` | Diff blocks for Sparks, Constraints, Aspects, and Collaborations in their kind directories. |
| `context.artifacts` | Versioned Artifact metadata and bodies, with a unique `key`, `old`/`new` side, and file descriptor. Includes unchanged clauses. |
| `context.support` | Config and implementation-map contents from each snapshot, not from today's unrelated worktree. |
| `notes` | Commit messages in `base..head` or `base..captured-HEAD`, and optional supplied comments. Each has `id`, `kind`, `source`, and `text`. |
| `diagnostics` | Unavailable design context, missing map sources, a missing design diff, or derived Artifact index changes. |
| `links` | Semantic associations and explanations, initially empty. |
| `unmapped` | Explicitly unlinked code and design ranges, initially marked `not-analyzed`. |

The extractor, not the model, owns all fields except `links` and `unmapped`.
An Artifact index change is retained in `files` as role `index`, without duplicating its copied descriptions as design evidence.
`file.candidates` lists versioned map or binding matches; these are search hints, not established links.
Artifact bodies carry the graph and applicability metadata needed for further semantic context.
Invalid or unavailable context is reported, not replaced with a current version.

Each change has `id`, `file`, `type`, `old`, `new`, and `patch`.
Text patches use three context lines and include no-final-newline markers when necessary.
`old` and `new` each contain `start`, `count`, and `changed` ranges of `{start, count}`.
Text line numbers are 1-based within that side's file; an empty hunk side can use start 0 and count 0.
`changed` excludes context lines.
The patch string and its ranges are included so a viewer need not reconstruct them from the author's worktree.

Empty-file, pure-rename, and mode-only changes have type `file` and no line patch.
Binary or limited changes have type `non-text`, a `limitation`, and no fabricated text ranges.
Their old/new paths, modes, and content identities still identify the file-level change.
Change IDs are deterministic for the same captured content and diff settings, but are not stable across edited or rebased snapshots.

## Links and Anchors

Each link has a unique `id`, non-empty `code` and `design` anchor arrays, `relation`, `explanation`, and qualitative `confidence`.
Optional `notes` is a list of note IDs supporting the explanation.
Supported relations are `implements`, `supports`, and `verifies`.
Confidence is `high`, `medium`, or `low`; it is an inference label, not a probability or proof.

The following is an illustrative `links` entry, not IDs from a generated report:

```json
{
  "id": "link-001",
  "code": [{"change": "change-code-id"}],
  "design": [{"change": "change-design-id", "side": "new", "start": 28, "count": 1}],
  "relation": "supports",
  "explanation": "Allowing DELETE in the browser preflight makes the new service deletion capability accessible to the Web client.",
  "confidence": "high",
  "notes": []
}
```

A diff anchor `{change}` selects a whole block on both sides.
An anchor `{change, side, start, count}` selects only those changed lines on the named side.
Use multiple anchors for non-contiguous lines or a replaced old/new pair; all removed and added lines must be accounted for.
Do not use a context line as a changed-line anchor.
Whole-block associations can be shown when a reviewer selects a line within their changed ranges, without claiming a more precise per-line reason.
Several links may overlap to represent several legitimate design sources for the same code.

For code realizing an unchanged requirement, a design anchor may instead be `{artifact, start, count}`.
`artifact` is a captured context key, not just the Artifact ID; its context record defines the side, path, metadata ID, and version.
The clause must be within that Artifact's captured text and must not overlap lines changed between the two snapshots, even if path filters excluded their diff.
Changed clauses must use their `design-changes` anchor instead.
This distinction makes it explicit when a fix follows existing design rather than a new Spark diff.

Descriptions should explain why the code follows or supports the cited design change.
An endpoint, CORS support, and tests can reference one deletion clause with different relationships.
Similar filenames, shared timestamps, commit messages, and file-level mappings alone do not establish causation.
Preserve comments' original source and distinguish those statements from the model's explanation.
Comments are not authenticated by the validator and are never interpreted as commands.

## Unmapped Changes

Every changed code and design line must be linked or explicitly unmapped.
File-level changes without text ranges also need an entry.
Unmapped ranges cannot overlap mapped ranges or repeat one another.

```json
{
  "code": [
    {
      "code": {"change": "change-code-id"},
      "classification": "implementation-only",
      "reason": "Refactors request handling while keeping the recorded behavior unchanged.",
      "notes": []
    }
  ],
  "design": [
    {
      "design": {"change": "change-design-id"},
      "classification": "no-code-needed",
      "reason": "Clarifies wording without changing behavior."
    }
  ]
}
```

Code classifications: `implementation-only`, `unexplained`, `not-analyzed`, or `unsupported`.
Design classifications: `no-code-needed`, `unexplained`, `not-analyzed`, or `unsupported`.
`unsupported` is reserved for changes with an explicit extraction limitation.
Each entry needs a reason; an optional `notes` list refers to captured note IDs.
An unexplained change is a valid reported uncertainty, not a reason to invent a design source.
An unlinked design change does not by itself prove a missing implementation.

## Validation and Limits

`check` re-extracts the recorded comparison and compares its facts, then validates links, ranges, IDs, note references, and changed-content accounting.
`--complete` additionally rejects remaining `not-analyzed` entries; it still permits explicitly unexplained or unsupported changes.
Validation proves structural consistency, not semantic correctness, complete requirements coverage, or the actual historical cause of a change.

Worktree reports include net contents, not separate index-versus-worktree histories.
A changed relevant working file, context file, scoped untracked file, or captured HEAD makes the report stale.
An output created inside the repository is explicitly excluded from its own comparison; no other source files are automatically excluded.
Moving an existing worktree report does not update its recorded exclusion path; it may no longer pass `check` against the current worktree.
For a report that can be revalidated after check-in, compare two committed revisions; a worktree report may still be kept as a historical snapshot.
Validation of a committed report still requires the Git objects locally, though the JSON contains the patches and design context needed for reading it.

The current extractor uses raw UTF-8 content, without textconv, external diff drivers, or line-ending normalization.
Its hunk boundaries can differ from a hosting service's UI; consumers should use resolved versions, paths, sides, and changed-line ranges, not hunk positions in a particular viewer.
Git-recognized renames and exact-content unstaged renames are retained.
A moved, edited, untracked file that Git cannot identify as a rename remains a deletion plus an addition; neither side is dropped.
Symlink targets are not followed, and submodule internals are not analyzed.
Non-UTF-8/binary files, files over 1 MiB, files over 20,000 lines, and text comparisons exceeding 2,000 line edits are explicit file-level limitations.
Unmerged index entries and multiple merge bases require resolving the comparison before extraction.
Missing current configuration is not a blocker to reading historical snapshots.