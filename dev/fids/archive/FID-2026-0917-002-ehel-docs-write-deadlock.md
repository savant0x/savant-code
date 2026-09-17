# FID: EHEL Law 3 gate deadlocked writes on a lint-failing markdown doc

**Filename:** `FID-2026-0917-002-ehel-docs-write-deadlock.md`
**ID:** FID-2026-0917-002
**Severity:** high
**Status:** closed
**Created:** 2026-09-17 16:15
**YAGNI-Compliance:** Verified

---

## Summary

The EHEL pre-write Law 3 gate blocked **every** write tool call — including the
exact `str_replace` that would have fixed the violation — because a markdown
document (`dev/handoff.md`) sat in `dirtyFiles` with a failing markdownlint
(MD040) run that kept it out of `verifiedFiles`. The violation blocked its own
remedy: a classic write/verify ordering deadlock. Root cause was a policy that
existed in one place but was never wired into the other: `classifyFileKind`
already classifies `*.md` as `docs` and `evaluateWritesAtStepBoundary` already
declares "documentation artifacts gate on markdownlint, never on Law 3 / Verifier
criteria" — but the pre-write gate checked only the `isExemptWritePath` prefix
list (`dev/fids/`, `dev/nova/`, `dev/scratchpad/`), which omits `docs/`,
`dev/handoff.md`, `dev/session-summaries/`, and `README.md`.

## Environment

- **OS:** Windows (Git Bash / MSYS)
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Tool Versions:** markdownlint, prettier, eslint (flat config)
- **Commit/State:** `main` at `6323ce23`; 6 commits ahead of `origin/main`,
  unpushed

## Detailed Description

### Problem

After a `write_file` to `dev/handoff.md`, the harness ran `lint:md`, which
reported 2 MD040 violations (bare ```` ``` ```` fences). The operator then
observed every subsequent write tool call — including the `str_replace` to add
```` ```text ```` to those very fences — return:

```text
[ECHO Enforcement] BLOCKED: Law 3: Verify before proceeding — 1 unverified
file(s): [dev/handoff.md]. Run typecheck/lint before more writes.
```

The session could not recover through any write tool. The operator had to paste
the handoff content into chat and instruct a restart.

### Expected Behavior

A documentation artifact that fails markdownlint should be corrected through a
write tool, and the correction path must never be blocked by the failure it
corrects. Docs verify via markdownlint (an advisory `info` channel at the step
boundary plus Law 15 at turn end), never via the hard-blocking Law 3 code gate —
the contract `evaluateWritesAtStepBoundary` already implements.

### Root Cause

`pre-write-gates.ts` computed its blocking set from **all** dirty files:

```ts
const unverifiedDirty = [...params.state.dirtyFiles].filter(
  (f) => !params.state.verifiedFiles.has(f),
)
```

with only `isExemptWritePath(targetPath)` as a carve-out — a prefix list missing
every ordinary doc path. Meanwhile `echo-compliance-core.ts: classifyFileKind`
and `evaluateWritesAtStepBoundary` already applied the docs/code split
(FID-2026-0814-004 H-03) at step boundaries. The pre-write gate never consulted
that single source of truth, so the split was enforced after writes but not
before them.

A second, independent blocker: `bun run lint:md` exits 1 repo-wide on
`dev/wiki/patterns/*.md` (MD013, 286-char machine-authored sample lines). That
directory is machine-generated pattern capture, but it was not in
`.markdownlintignore`, so no doc in the repo could ever reach a passing
markdownlint state while it was present.

### Evidence

```text
$ bun run lint:md
dev/handoff.md:22 error MD040/fenced-code-language Fenced code blocks should have a language specified [Context: "```"]
dev/handoff.md:55 error MD040/fenced-code-language Fenced code blocks should have a language specified [Context: "```"]
dev/wiki/patterns/code-search-3887c6d58119.md:9:121 error MD013/line-length Line length [Expected: 120; Actual: 286]
dev/wiki/patterns/str-replace-51e2c2a5f761.md:9:121 error MD013/line-length Line length [Expected: 120; Actual: 160]
error: script "lint:md" exited with code 1
```

The block message named the fix tool's own target, proving the cycle.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/echo/pre-write-gates.ts` — Law 3 blocking set
- `packages/agent-runtime/src/echo/__tests__/pre-write-gates-law3.test.ts` —
  regression tests
- `dev/handoff.md` — the 2 MD040 fences (the trigger artifact)
- `.markdownlintignore` — `dev/wiki/**` exemption

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken (all write tools wedged), workaround only via
  session restart with pasted content

## Proposed Solution

### Approach

Wire the existing docs/classifier into the gate that was missing it — one
predicate change reusing `classifyFileKind` as the single source of truth. No
new function, no new config, no policy invented here. Code verification is
untouched: a dirty **code** file still hard-blocks exactly as before.

### Steps

1. `pre-write-gates.ts`: restrict `unverifiedDirty` to code-kind files via
   `classifyFileKind(f) === 'code'`; import the existing classifier.
2. `pre-write-gates-law3.test.ts`: add three regression tests — docs-only dirty
   set does not block; the self-fix write to a dirty doc does not block; a mixed
   doc+code dirty set still blocks and names only the code file.
3. `dev/handoff.md`: add `text` to the two bare fences.
4. `.markdownlintignore`: exempt `dev/wiki/**` (machine-generated; same
   precedent as `dev/scratchpad/**` and `dev/provider-candidates/**`).

### Verification

Typecheck the workspace, run the law3 suite, and confirm the repo-wide
`lint:md` exit flips 1 → 0.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/echo/__tests__/pre-write-gates-law3.test.ts
- gate: quality

## Perfection Loop

### Loop 1 — RED

- **RED:** Two independent blockers: (a) the Law 3 gate blocked its own
  correction path for docs; (b) `dev/wiki` kept `lint:md` failing repo-wide, so
  no doc could ever earn verification credit.
- **GREEN:** Docs/code split wired into the pre-write gate via `classifyFileKind`;
  `dev/handoff.md` fences fixed; `dev/wiki/**` exempted.
- **AUDIT:** typecheck exit 0; law3 suite 8/0 (3 new); eslint 0; prettier clean;
  `lint:md` repo-wide exit 0 (was exit 1).
- **ADVERSARIAL:** The live harness reproduced the block mid-session on the very
  fix commit, proving the reproduction is deterministic, and confirming the fix
  targets the real gate.
- **CHANGE DELTA:** 51 insertions / 1 deletion across 2 source files
  (`pre-write-gates.ts` + its test); plus 2 doc/config edits
  (`dev/handoff.md` fences, `.markdownlintignore` entry) and this FID.

### Missed Questions

1. *Should docs ever block at all?* — No. `evaluateWritesAtStepBoundary` already
   answers this: docs gate on markdownlint only. The pre-write gate was the
   inconsistency.
2. *Does this weaken code verification?* — No. The filter keeps code files in the
   blocking set; a mixed doc+code set still blocks (pinned by a test).
3. *What about the repo-wide lint failure?* — Fixing `handoff.md` alone would
   leave `lint:md` at exit 1, so no doc could earn credit. The `dev/wiki`
   exemption was required for the primary fix to be verifiable.

### Implementation Evidence

- **Commit SHA:** `f8d46ee2` (gate + tests), `9fb99351` (handoff fences +
  dev/wiki exemption), `be9b71ec` (FID + session summary); closure records
  `2394ac2f`
- **File:line ranges:**
  `packages/agent-runtime/src/echo/pre-write-gates.ts` (import +
  `unverifiedDirty` filter), `.../__tests__/pre-write-gates-law3.test.ts`
  (3 new tests), `dev/handoff.md:22,55`, `.markdownlintignore` (dev/wiki/**)
- **Gate output:** typecheck exit 0; law3 8 pass / 0 fail; eslint 0; prettier
  clean; `bun run lint:md` exit 0
- **Reproducibility:**
  `grep -n "classifyFileKind" packages/agent-runtime/src/echo/pre-write-gates.ts`
- **Step statuses:** all `implemented`

### Code Verification Evidence

- [x] Files referenced exist
- [x] Implementation matches Proposed Solution
- [x] Typecheck/tests/lint pass with tool output
- [x] Production call-graph: `runPreWriteGates` is reached from
  `tool-pipeline.ts` before every write dispatch; `classifyFileKind` is the same
  authority `evaluateWritesAtStepBoundary` already uses
- [x] Status reflects implementation state

## Resolution

- **Closed Date:** 2026-09-17 16:30
- **Fix Description:** The Law 3 pre-write gate now filters its blocking set to
  code-kind files via the existing `classifyFileKind` classifier, so a
  markdownlint failure on a doc can be written through to fix itself; the
  trigger doc's fences were corrected and machine-generated `dev/wiki/**` was
  exempted from MD013.
- **Tests Added:** Yes — 3 regression tests (docs-only non-blocking, self-fix
  non-blocking, mixed doc+code still blocks naming only code)
- **Verification Evidence:** typecheck exit 0; law3 8/0; eslint 0; prettier
  clean; repo `lint:md` exit 0
- **Archived:** 2026-09-17 — moved to `dev/fids/archive/`, CHANGELOG entry
  appended, receipt re-stamped at the archived path. The gate fix was proven
  shipped in the BUILT artifact (`sdk/dist/index.cjs:48430` +
  `dist/index.mjs:48334` carry `classifyFileKind(f) === "code"` in
  `runPreWriteGates` only, leaving the Law 15 advisory scanner correctly
  unguarded) after `bun run build` in `sdk/`; runtime probe extracted the
  shipped function and confirmed docs-only unblocks while code still blocks.

## Lessons Learned

A policy enforced at one lifecycle point and not another is a latent deadlock.
The docs/code split was already the law at step-boundary evaluation — the
pre-write gate simply never consulted it. When a gate's block message names the
exact tool call that would fix the violation, the gate is not enforcing
verification, it is enforcing stagnation.

### Verification Receipt

- fingerprint: sha256:dd19e5b839c5811ed4111a09a6357222534894f9c53733cb901577ca7796a9df
- verified: 2026-09-17T20:35:01.357Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/echo/__tests__/pre-write-gates-law3.test.ts: exit 0
- quality: exit 0

### Verification Receipt

- fingerprint: sha256:308ca0f3fbaee7f8b7ab395e223ae3166d5143b5e26aa0f152a757867e8d3163
- verified: 2026-09-17T20:41:43.006Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/echo/__tests__/pre-write-gates-law3.test.ts: exit 0
- quality: exit 0

### Verification Receipt

- fingerprint: sha256:9762c3fdb336264d17964d9e8ca176ee803ea5050f8f0e1c713986b026a7c098
- verified: 2026-09-17T21:52:13.299Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/echo/__tests__/pre-write-gates-law3.test.ts: exit 0
- quality: exit 0
