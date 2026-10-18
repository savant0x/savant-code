# FID: Post-merge graph refresh aborts on binary assets under the byte cap

**Filename:** `FID-2026-1017-011-binary-asset-graph-refresh.md`
**ID:** FID-2026-1017-011
**Severity:** high
**Status:** verified
**Created:** 2026-10-17 21:10
**Automation level:** 3
**YAGNI-Compliance:** Verified — removes one redundant condition from an existing
guard and adds one regression test; no new module, dependency, service or
configuration.

---

## Summary

The lane merge's post-merge graph refresh fails in the live repository. The
merge itself lands and returns `ok: true` with a warning, so the merged file
never reaches `.savant/graph.db` until an operator runs `/graph refresh`. Two
defects were reproduced in sequence, the second only visible after the first was
repaired:

1. the index scan rejects a source whose **decoded UTF-8 string** exceeds
   `maxFileBytes` even though its **on-disk size** is under the cap — binary
   files read as UTF-8 decode invalid bytes to U+FFFD (3 bytes each), so a
   600–900 KB image expands past the 1 MB cap and aborts the whole refresh;
2. once the scan completes, the write phase violates the `file_extends`
   primary key because one file may declare several children that extend the
   same parent, and the extractor returned one row per declaration instead of
   one row per distinct parent.

This is the open BLOCKER-2 from FID-2026-1017-008's live acceptance run.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript strict, Bun 1.3.14
- **Tool Versions:** Git 2.52
- **Commit/State:** `main` at `1ef369e5` plus the uncommitted FID-2026-1017-010
  working tree

## Detailed Description

### Problem

`refreshMergedFidGraph` opens the live `.savant/graph.db`, applies the schema and
runs `updateKnowledgeGraph`. In the live repository that call threw, in order:

```text
Error: Graph source could not be read consistently; retry refresh
    at packages/knowledge-graph/src/update-scan.ts:221
    at async updateKnowledgeGraph (packages/knowledge-graph/src/update.ts:83)
    at async refreshMergedFidGraph (packages/agent-runtime/src/echo/parallel/fid-worktree-environment.ts:106)

SQLiteError: UNIQUE constraint failed: file_extends.file_id, file_extends.parent
    at upsertChangedFiles (packages/knowledge-graph/src/update.ts:230)
    at async updateKnowledgeGraph (packages/knowledge-graph/src/update.ts:124)
```

`mergeFidWorktree` catches it and reports the merged commit with the warning
`Merge landed; main graph refresh failed. Run /graph refresh before relying on
graph results.` The live A–Z run recorded this at §5.13 and FAILED §5.15
(merged file absent from the graph). The real-git probe passes because its
temporary repository contains no binary assets.

### Expected Behavior

The graph refresh indexes a repository whose assets exceed the cap **in decoded
form** but not on disk. Oversized files on disk are skipped (`null`, not a
failure). A binary asset must never abort the whole refresh, and the merge's
declared companion effect (main graph refresh) must succeed on this repository.

### Root Cause

`readSource` in `update-scan.ts` gates on disk size, then reads the file as
UTF-8 and rejects the read when the re-encoded length exceeds the cap:

```ts
const st = await fsImpl.stat(fullPath)
const size = typeof st.size === 'number' ? st.size : 0
if (size > maxFileBytes) return null
const source = await fsImpl.readFile(fullPath, 'utf8')
const after = await fsImpl.stat(fullPath)
if (
  !baseline ||
  st.size !== baseline.size ||
  st.mtimeMs !== baseline.mtimeMs ||
  after.size !== st.size ||
  after.mtimeMs !== st.mtimeMs ||
  Buffer.byteLength(source, 'utf8') > maxFileBytes
) {
  throw new Error('Graph source changed while being read')
}
```

U+FFFD replacement makes `Buffer.byteLength(decoded, 'utf8')` up to 3× the file
size for invalid UTF-8. Four tracked assets in this repository are under the
1,000,000-byte cap but over it after decoding:

| Path | Stat size | Decoded byte length |
| --- | ---: | ---: |
| `art/profile-pic.jpg` | 854,119 | 1,519,211 |
| `assets/banner.png` | 580,724 | 1,052,640 |
| `assets/logo.png` | 888,939 | 1,610,480 |
| `desktop/public/floor-assets/emblem/savant-logo.png` | 888,939 | 1,610,480 |

Every one is a read target after the index baseline ages (all four postdate the
baseline or have changed), so the scan aborts deterministically. The clause is
also redundant: `st.size` and `after.size` already prove the file did not grow
between stat and read, and the cap's intent is on-disk bytes.

The second defect is a grain mismatch. `file_extends` is keyed
`(file_id, parent)` (`schema.ts:70-74`), while `extractExtendsRelations`
returned one `{child, parent}` pair per declaration. Six tracked files declare
multiple children extending one parent, including
`packages/llm-providers/src/openai-compatible/chat/openai-compatible-api-types.ts`
(six `extends JsonRecord` declarations) and
`packages/knowledge-graph/src/extract.ts` (two `extends Y` declarations), so the
first changed file of that shape aborted the whole write transaction.

### Evidence

```text
$ cp .savant/graph.db .savant/graph.db.bak
$ bun -e "…await refreshMergedFidGraph(process.cwd())…"
REFRESH_ERR: Error: Graph source could not be read consistently; retry refresh
    at update-scan.ts:221 … at refreshMergedFidGraph
EXIT:1

$ bun -e "<enumerate + read every file ≤1e6, report decoded length>"
candidates=4
[["art/profile-pic.jpg","statSize",854119,"utf8Len",1519211],
 ["assets/banner.png","statSize",580724,"utf8Len",1052640],
 ["assets/logo.png","statSize",888939,"utf8Len",1610480],
 ["desktop/public/floor-assets/emblem/savant-logo.png","statSize",888939,"utf8Len",1610480]]

$ bun -e "<extractExtendsRelations over every source file, report repeated parents>"
filesWithDuplicateExtendsParents=6
[["common/src/testing/errors.ts",["Error"]],
 ["common/src/util/file-context.ts",["FileTreeNode"]],
 ["packages/knowledge-graph/src/extract.ts",["Y","Y"]],
 ["packages/llm-providers/src/openai-compatible/chat/openai-compatible-api-types.ts",
  ["JsonRecord","JsonRecord","JsonRecord","JsonRecord","JsonRecord","JsonRecord"]]]

$ bun -e "<refreshMergedFidGraph after both repairs>"
REFRESH_OK ms=8894
$ bun -e "<query the graph for the merged lane proof>"
[{"path":"docs/design/parallel-worktrees-lane-proof.md"}]
```

## Impact Assessment

### Affected Components

- `packages/knowledge-graph/src/update-scan.ts` — the read/consistency guard
- `packages/knowledge-graph/src/__tests__/refresh-safety.test.ts` — regression
- Consumer: `refreshMergedFidGraph` in the parallel-worktree lane merge

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists — `/graph refresh` also
      aborts; the workaround is to exclude or shrink the offending assets
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Drop the decoded-length clause and rely on the on-disk stat guard, which is the
cap the index actually promises. Keep every other consistency check unchanged:
baseline presence, pre/post stat equality against the baseline, and the
post-read size/mtime comparison that detects concurrent writes.

### Steps

1. Remove `Buffer.byteLength(source, 'utf8') > maxFileBytes` from the
   consistency condition, with a comment stating why decoding may expand bytes.
   — implemented
2. Add a regression test: a 600,000-byte invalid-UTF-8 fixture in a temp repo
   must not abort `updateKnowledgeGraph`. — implemented
3. Dedupe `extractExtendsRelations` by parent, matching the `file_extends`
   `(file_id, parent)` grain, and pin it with a two-declaration fixture. —
   implemented
4. Re-run the declared gates and the live refresh reproduction. — implemented

### Verification

`packages/knowledge-graph/src/__tests__/refresh-safety.test.ts` gains
`binary asset under the size cap does not abort the refresh` and
`duplicate extends parents keep one file_extends row`. Both are measured: the
first was run red against the unfixed scan (the exact production error) and
green after; the second passes with one `file_extends` row where the unfixed
extractor inserted twice. The live reproduction (`refreshMergedFidGraph` on
this repository) prints `REFRESH_OK`, and `.savant/graph.db` contains the
merged lane-proof row.

## Verification Gates

- gate: typecheck packages/knowledge-graph
- gate: typecheck packages/agent-runtime
- gate: test packages/knowledge-graph/src/__tests__/refresh-safety.test.ts
- gate: test packages/knowledge-graph/src/__tests__/edges-from-tokens.test.ts
- gate: test packages/agent-runtime/src/__tests__/fid-worktree-environment.test.ts
- gate: probe scripts/probes/fid-worktrees.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:eeec98626361a9357df1623bed3eaa7f93b680fe05c6a698a14a48bffe75482e
- verified: 2026-10-18T00:56:36.798Z
- typecheck packages/knowledge-graph: exit 0
- typecheck packages/agent-runtime: exit 0
- test packages/knowledge-graph/src/__tests__/refresh-safety.test.ts: exit 0
- test packages/knowledge-graph/src/__tests__/edges-from-tokens.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/fid-worktree-environment.test.ts: exit 0
- probe scripts/probes/fid-worktrees.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Live reproduction throws at `update-scan.ts:221`; four tracked assets
  are under the stat cap and over it after decoding; the clause that rejects
  them is redundant with the stat checks around it.
- **GREEN:** Remove the decoded-length clause; add the invalid-UTF-8 fixture
  regression; then dedupe extends parents when the next failure exposed the
  `file_extends` grain mismatch.
- **AUDIT:** The guard's remaining clauses cover the cases the removed one was
  meant to catch (growth between stat and read, changed mtime) plus the
  pre-scan baseline comparison. The extends dedupe keeps the first child for the
  pair and drops only repeated parents, which is exactly the persisted grain.
- **ADVERSARIAL:** A 1 MB cap on decoded text is not a security boundary; the
  graph is a regenerable local index, and the read is bounded by the on-disk
  size. Removing the clause cannot admit an unbounded read: `st.size` gates it.
- **CHANGE DELTA:** 100% (initial authoring).

### Missed Questions

1. Why did the probe pass? Its temp repository has no binary assets and no file
   with two declarations extending one parent; the defects need those shapes.
   The regression fixtures supply both deterministically.
2. Should binary files be excluded from indexing instead? That is a larger
   design change with no measured need; the scan already tolerates unparseable
   content (the parser is best-effort), and the file row is useful.
3. Does the merge allow retry? Re-running the refresh after this fix is
   sufficient; the merge's warning is loud and names its recovery, so no
   auto-retry is added.

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** filled at closure
- [x] **File:line ranges:** `packages/knowledge-graph/src/update-scan.ts:205-221`
      (decoded-length clause removed, stat checks retained);
      `packages/knowledge-graph/src/extract.ts:82-101` (extends parents deduped);
      `packages/knowledge-graph/src/__tests__/refresh-safety.test.ts:278-303`
      (both regressions)
- [x] **Gate output:** stamped below — knowledge-graph and agent-runtime
      typechecks exit 0; refresh-safety 16/16; edges-from-tokens 2/2;
      fid-worktree-environment 3/3; probe exit 0; quality PASS
- [x] **Reproducibility:** `grep -n "FID-2026-1017-011" packages/knowledge-graph/src/`
      finds the guard comment, the extractor comment and both test names
- [x] **Step statuses:** Steps 1–4 implemented

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence: `refreshMergedFidGraph` is called by
      `mergeFidWorktree` (`fid-worktree-merge.ts:34`); the live reproduction now
      prints `REFRESH_OK` and the merged lane-proof row is present
- [x] FID status reflects the actual implementation state

### Loop 2 — Independent audit and self-correction

- **RED:** The test must fail for the right reason (decoded expansion), not
  because the fixture is unreadable or too large on disk.
- **GREEN:** Fixture is 600,000 bytes of `0x80` — under the stat cap, decodes to
  roughly 1.8 MB. The assertion is that no error is thrown and the text file is
  still indexed.
- **AUDIT:** Run the suite before and after the edit to capture red → green.
- **ADVERSARIAL:** The existing read/stat race and failed-read tests must remain
  green; the removed clause is not what makes either of them pass.
- **CHANGE DELTA:** Minor (one condition + one test).

### Loop 3 — Final convergence

- **RED:** Residual risk: another consumer relies on the decoded-length cap.
- **GREEN:** Grep shows the cap is declared once in `update-scan.ts`; no other
  module reads `maxFileBytes` outside `updateKnowledgeGraph` options.
- **AUDIT:** Full `refresh-safety` suite plus the worktree environment suite.
- **ADVERSARIAL:** The live reproduction is the acceptance proof; the probe is
  not, because it never contained a binary asset.
- **CHANGE DELTA:** Converged.

## Resolution

Not yet resolved. Fix implemented and gate-verified this session; closure
records the commit and archives this record.

## Lessons Learned

A size cap must be enforced on the bytes that exist, not on a lossy decode of
them. Any guard that re-encodes file content to compare lengths will misfire on
binary data, and a fixture without binary assets cannot prove that guard works.
