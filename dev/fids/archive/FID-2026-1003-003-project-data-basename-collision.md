# FID: Project-data directory basename collision (audit D7)

**Filename:** `FID-2026-1003-003-project-data-basename-collision.md`
**ID:** FID-2026-1003-003
**Severity:** low
**Status:** closed (implemented + verified, 2026-10-03, commit 9f1b8068)
**Created:** 2026-10-03
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

T113 audit finding D7: `getProjectDataDir()` keys the per-project data
namespace by directory BASENAME only — two projects whose directories share
a basename (`~/work/api` and `~/clients/api`) share one
chats/checkpoints/logs namespace, so `getMostRecentChatDir` can resume
another project's conversation and trace/log sinks mix transcripts.

## Environment

- **OS:** Windows (session), Bun 1.3.14
- **Language/Runtime:** TypeScript strict monorepo
- **Tool Versions:** Bun 1.3.14
- **Commit/State:** working tree, HEAD `997ce946` + uncommitted October
  work; no commit authorized (G2)

## Detailed Description

### Problem

`cli/src/project-files.ts` — `getProjectDataDir()` joins
`getConfigDir()/projects/<basename(root)>`. The basename is not unique.
Every consumer (`run-state-storage/load.ts`, `chat-history.ts`,
`teacher/runtime.ts`, `logger/sink.ts`, `trace-writer.ts`,
`rewind.ts` via `getCurrentChatDir`) inherits the collision.

### Expected Behavior

The per-project namespace is keyed by something stable AND unique per
resolved project root, existing projects keep their history (one-time
migration), and a fresh checkout at a same-named sibling directory gets its
own namespace.

### Root Cause

The namespace key was chosen when a single project per machine was the
assumption; basename was cheap and readable, and nothing enforced
uniqueness.

### Evidence

Source-confirmed in the T113 audit (finding D7,
`dev/session-summaries/2026-10-02-full-data-flow-audit.md:265-279`):
`getProjectDataDir()` joins the basename; the consumer list is the
`getProjectDataDir` referencedBy graph.

## Impact Assessment

### Affected Components

- `cli/src/project-files.ts` (namespace key + migration)
- `cli/src/__tests__/project-data-dir-isolation.test.ts` (new)
- Existing suites that exercise `getProjectDataDir`
  (`project-files-chat-id.test.ts`, run-state-storage suites) must stay
  green.

### Risk Level

- [x] Low: silent cross-project conversation bleed; the fix preserves
  history via migration and never renames the project root itself.

## Proposed Solution

### Approach

1. Key: `projects/<basename>-<shorthash>` where shorthash is the first 8
   hex chars of SHA-256 over the normalized resolved root — `path.resolve`
   + `fs.realpathSync` when it succeeds (symlinks resolve to their target,
   so a project reached through a link keeps ONE namespace), lowercased on
   win32 so case differences in the same path cannot split the namespace.
2. Migration: on lookup, if the NEW key's directory does not exist and the
   LEGACY `<basename>` directory does, rename legacy → new (same parent
   volume; `renameSync` is atomic enough here). If the target already
   exists (post-migration, or a Windows rename refusal), proceed with the
   new directory and leave the legacy one untouched — never destructive.
3. All consumers go through `getProjectDataDir()`, so the change is
   transparent to them.

### Steps

1. `project-files.ts`: private `resolveProjectKey(root)` (resolve +
   realpath + normalize + sha256-8), `getProjectDataDir()` computing the
   new key + one-time legacy migration (guarded, non-throwing on rename
   refusal).
2. New isolation suite: same-basename roots get distinct dirs; the legacy
   directory migrates with its contents; no migration when the new dir
   already exists; case-insensitive roots (win32) share one namespace.
3. Existing suites re-run; gates; stamp receipt.

### Verification

The isolation suite proves uniqueness under basename collision, migration
fidelity, and win32 case stability, using temp project roots and a config
dir redirected to a temp dir. Declared gates below.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/__tests__/project-data-dir-isolation.test.ts
- gate: test cli/src/__tests__/project-files-chat-id.test.ts
- gate: test cli/src/utils/__tests__/run-state-storage-atomic.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:b3d716f3cfe23bdee30ab086ea6b91c3c5711479d86a329dee1d05a20ee6a825
- verified: 2026-10-03T06:24:10.929Z
- typecheck cli: exit 0
- test cli/src/__tests__/project-data-dir-isolation.test.ts: exit 0
- test cli/src/__tests__/project-files-chat-id.test.ts: exit 0
- test cli/src/utils/__tests__/run-state-storage-atomic.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

Audit finding D7 with file:line evidence; the collision is a direct read
of the key construction (`path.join(getConfigDir(), 'projects', baseName)`).

### GREEN

`<basename>-<shorthash>` keeps the name readable in the filesystem while
making it unique; migration keeps every existing project's history without
a versioned-schema ceremony.

### AUDIT

Realpath-before-hash means a project reached via different link paths or
drive-letter casing hashes to ONE key (the documented win32 lowercasing);
two DIFFERENT directories that happen to share a basename hash differently
— the collision is gone. Migration is a rename inside `getConfigDir()`'s
own tree — no cross-volume moves, no user-file risk; a refused rename
(target exists) is non-fatal and non-destructive.

### Missed Questions

1. What about the gateway's `projectId`? It derives from the FIDs
   directory's grandparent basename (`gateway.ts`) — a display-only label
   in hello/projectId, not the data namespace; out of D7's scope.
2. Can the migration run twice or race? Guarded by existence checks; a
   concurrent process either finds the new dir already present (proceeds)
   or loses a rename race (catches and proceeds). Both outcomes converge
   on the new key.
3. Does the hash make directories unrecognizable? The basename is kept as
   the prefix — `api-a1b2c3d4` — readability preserved.
4. Windows rename-onto-existing? `fs.renameSync` of a directory onto an
   existing directory fails on win32; the catch treats it as "already
   migrated" and proceeds — the legacy data stays as a harmless orphan.

### Convergence

Design grounded in project-files.ts, its consumer graph, and the auth
config-dir seam. Ready for implementation at level 3.

## Implementation Evidence

### Code Verification Evidence

- `cli/src/project-files.ts` — `resolveProjectKey(root)` (:62):
  `path.resolve` → `realpathSync` when it succeeds (symlink-true
  namespace; fresh checkouts fall back to the deterministic resolved
  path) → win32 lowercasing → SHA-256, first 8 hex; key =
  `<basename>-<shorthash>` with the basename prefix lowercased on win32
  as well, so casing differences in the same root return the SAME
  directory string (caught by the isolation suite: matching hashes alone
  still produced case-differing paths on a case-preserving volume).
  POSIX keeps original basename casing. `getProjectDataDir()` (:84)
  computes `legacyDir` (:91, unchanged `<basename>`) and the hashed
  `dataDir` (:92); one-time migration (:100-107): when the hashed dir is
  absent and the legacy dir exists, `renameSync(legacyDir, dataDir)` —
  same parent, same volume; a refused rename (already migrated / racing
  process / win32 rename-onto-existing) is caught and non-fatal, legacy
  left untouched — never destructive. Post-migration calls short-circuit
  on one `existsSync`.
- Consumers unchanged and verified transparent through the single choke
  point: `run-state-storage/load.ts`, `chat-history.ts`,
  `teacher/runtime.ts`, `logger/sink.ts`, `trace-writer.ts`, `rewind.ts`
  (via `getCurrentChatDir`), `getMostRecentChatDir`.
- Tests: `cli/src/__tests__/project-data-dir-isolation.test.ts` (new, 4
  tests, 13 asserts; isolation via the documented
  `SAVANT_CODE_CONFIG_DIR` non-prod override restored afterEach, no
  module mocking): same-basename roots get distinct, stable
  `api-<hash>` namespaces; a legacy `<basename>` dir migrates WITH its
  contents (legacy gone, history readable in the hashed dir); an
  existing hashed namespace is never overwritten (marker intact, legacy
  left in place); win32 casing differences hash to one namespace
  (skipIf-guarded to win32).

### Gate Receipts

- cli typecheck: exit 0.
- isolation suite 4 pass / 0 fail; project-files-chat-id +
  run-state-storage-atomic 14 pass / 0 fail; wider neighbor sweep
  (run-state-storage family, chat-history, teacher, trace-writer): 79
  pass / 0 fail.
- ESLint zero warnings; prettier clean; quality-report PASS (1498
  baselined files); file sizes 155 + 124 lines (ceiling fine).

### Step Status

- [x] Step 1 — `resolveProjectKey` + hashed `getProjectDataDir` with
      guarded legacy migration: implemented (:62-107).
- [x] Step 2 — isolation suite: implemented (4 pass / 0 fail).
- [x] Step 3 — existing suites + gates + receipt: implemented (stamped
      below).

## Resolution

- **Fix Description:** the per-project data namespace is keyed by
  `<basename>-<sha256-8>` of the normalized resolved root (realpath when
  available, lowercased on win32 including the basename prefix), ending
  the basename collision; a one-time guarded rename migrates every
  pre-hash project's history into its hashed namespace, non-destructive
  on refusal. No consumer changes — all flow through
  `getProjectDataDir()`.
- **Tests Added:** Yes — `project-data-dir-isolation.test.ts` (4 tests
  through the `SAVANT_CODE_CONFIG_DIR` non-prod override seam, no module
  mocking).
- **Verification Evidence:** cli typecheck exit 0; isolation 4/4;
  declared neighbor gates 14/0; neighbor sweep 79/0; ESLint zero
  warnings; quality PASS; receipt stamped by the project verifier.
- **Commit SHA:** `9f1b8068` — landed in the 2026-10-03 batch commit on
  local main (operator granted G2; local commit only, no push).
- **Archived:** 2026-10-03 (moved to `dev/fids/archive/`)

## Lessons Learned

A basename is a label, not an identity: human-readable filesystem keys need
a uniqueness guarantee too. Hashing the normalized realpath keeps the
readable prefix while making the namespace collision-proof, and a guarded
one-time rename migrates existing history without a schema ceremony.
