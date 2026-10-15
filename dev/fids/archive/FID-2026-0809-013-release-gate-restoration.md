<!-- markdownlint-disable MD013 -->

# FID: Release-Gate Restoration — lint:md MD013 Gate Breakers

**Filename:** `FID-2026-0809-013-release-gate-restoration.md`
**ID:** FID-2026-0809-013
**Severity:** critical
**Status:** closed (2026-08-09 — implementation independently signed off)
**Created:** 2026-08-09
**YAGNI-Compliance:** Verified for planning scope

> **Implementation authorization:** Operator granted automation level 3 for this FID on 2026-08-09
> after the Nova planning audit (Loop 4) closed its single NEEDS-REVIEW finding. Disposition applied:
> **relocation (Option 2)** — the three untracked design docs moved to `dev/scratchpad/`.

---

## Summary

The pre-push hard gate `bun run lint:md` previously exited 1 because three **untracked** design
documents failed MD013 (line length):

- `docs/design/Savant Command Center Design Concept.md` (153 lines; MD013 up to 860 chars)
- `docs/design/Visual Workflows For Savant-Code.md` (177 lines; MD013)
- `docs/design/Command Center Design Sprint.md` (46.5 KB; MD013 — created 2026-08-09 22:49,
  after the original two-file evidence was captured; added by Nova Loop-4 refresh)

Because the gate scans the entire working tree including untracked files, **every push failed**
until these files were deleted, relocated, lint-fixed, or added to `.markdownlintignore`.
This FID restores the gate to green with the smallest safe change: the three docs were
**relocated to `dev/scratchpad/`** (Option 2 — preservation-safe default that keeps the
Command Center research thread referenced by `gemini-deep-research-command-center-v2-prompt.md:7`).

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** TypeScript monorepo; Bun; `markdownlint-cli2` via `bun run lint:md`
- **Tool Versions:** Bun project contract `1.3.14`
- **Commit/State:** `main`; the three offending files are untracked (`??` in `git status`)
- **Protocol:** Single-agent ECHO adaptation `dev/echo-v0.1.2-single-agent.md`
- **Approval state:** Operator automation level 3 granted; Nova implementation sign-off **PASS** (2026-08-09)

## Detailed Description

### Problem

`bun run lint:md` (which runs `markdownlint .`) exits 1 on three untracked design documents. The
pre-push hook (`.githooks/pre-push`) runs `bun run lint:md` as a hard gate, so no push can pass
while these files remain in the scanned tree.

### Evidence

```text
$ bun run lint:md
docs/design/Savant Command Center Design Concept.md:5:121 error MD013/line-length [Expected: 120; Actual: 860]
docs/design/Savant Command Center Design Concept.md:6:121 error MD013/line-length [Expected: 120; Actual: 657]
docs/design/Visual Workflows For Savant-Code.md:... error MD013/line-length
docs/design/Command Center Design Sprint.md:... error MD013/line-length
exit 1
```

- All three files are untracked: `git status --short` shows `??` for `Savant Command Center
  Design Concept.md`, `Visual Workflows For Savant-Code.md`, and `Command Center Design Sprint.md`.
- `.markdownlintignore` already exempts `docs/reports/**`, `research/`, `resources/`,
  `dev/nova/reports/**`, and other prose-heavy paths — the three design docs are **not** exempted.
- No tracked production file fails `lint:md`; the three untracked docs are the sole cause.

### Impact Assessment

- [x] Critical: pre-push hard gate red — blocks all pushes and any release gate that runs `lint:md`
- [ ] High
- [ ] Medium
- [ ] Low

### Proposed Solution

Operator-directed disposition is required between three options (no prior operator intent is
assumed for these specific docs — the earlier "pass on the idea" remark concerned a different
artifact and is not attributed here):

1. **Delete the three untracked design docs** (`git clean` / `rm`) — they are untracked design
   concepts, not tracked production content; deletion is safe (no committed history lost). If
   Option 1 is chosen, the stale reference at
   `dev/scratchpad/gemini-deep-research-command-center-v2-prompt.md:7` (which names the Command
   Center doc as a research baseline) is acceptable as-is because `dev/scratchpad/` is an ephemeral
   working area; no code or tracked doc references the deleted files.
2. **Relocate to an ignored path** (e.g. `dev/scratchpad/` or add to `.markdownlintignore`) if the
   operator wants to keep the content for reference.
3. **Lint-fix the three docs** (wrap long lines / add `<!-- markdownlint-disable MD013 -->` headers)
   if the operator wants them tracked.

### Steps (executed)

1. **Disposition:** relocation (Option 2) selected — preservation-safe default.
2. **Applied:** `mv` of all three docs from `docs/design/` to `dev/scratchpad/` (a lint-ignored
   path per `.markdownlintignore` `dev/scratchpad/**`).
3. **Re-ran `bun run lint:md`:** exits 0 — gate green.
4. **Dangling reference fixed:** `dev/scratchpad/gemini-deep-research-command-center-v2-prompt.md:7`
   updated from `docs/design/Savant Command Center Design Concept.md` to the new scratchpad path.
5. **Gate regressions:** none — docs moved are excluded from lint; no tracked file touched.

### Verification (post-implementation)

- [x] `bun run lint:md` exits 0.
- [x] `git status` reflects relocation: docs gone from `docs/design/`, present untracked in `dev/scratchpad/`.
- [x] No remaining tracked references to the old `docs/design/` paths (FID/history mentions only).

## Perfection Loop

### Loop 1 — RED

- **RED:** `lint:md` exits 1 on exactly three untracked design docs (MD013). Because the gate scans
  the whole tree, every push is blocked.
- **GREEN:** Restore the gate with the smallest safe change: delete the three untracked design
  concepts, or relocate/fix per operator disposition. No production code changes.
- **AUDIT:** Verified via `bun run lint:md` output (all three docs named, MD013), `git status --short`
  (all three `??`), and `.markdownlintignore` contents (none of the three exempted).
  `.githooks/pre-push` confirmed to run `lint:md`. No tracked file is implicated.
- **AUDIT ADVERSARIAL CHECK:** Challenged for scope creep (fixing unrelated lint debt) — the FID
  restricts to the three named files. Challenged for deleting tracked content — all three files
  are untracked, so deletion loses no committed history.
- **CHANGE DELTA:** Planning only; no file deleted or edited yet.### Missed Questions

1. **Are the three docs tracked?** → No, all three `??`. Deletion is safe.
2. **Does anything import these docs?** → Untracked design concepts; no code imports markdown docs.
3. **Would fixing instead of deleting be better?** → If the operator wants the concepts retained,
   relocate or fix; otherwise delete. Note: `dev/scratchpad/gemini-deep-research-command-center-v2-prompt.md:7`
   references `Savant Command Center Design Concept.md` as a research baseline — if the operator
   wants that research thread preserved, relocation (Option 2) is preferable to deletion.
4. **Any other `lint:md` failures?** → Verified: the three docs are the sole failures.

### Loop 2 — Independent AUDIT correction (2026-08-09)

- **RED:** Independent review flagged that the plan attributed prior operator deletion intent
  ("pass on the idea... just delete it") to these two specific docs; that remark concerned a
  different artifact and must not be cited here.
- **GREEN:** Removed the intent attribution; the tri-option framing now requires fresh operator
  disposition. Also surfaced a cross-reference: `dev/scratchpad/gemini-deep-research-command-center-v2-prompt.md:7`
  names the Command Center doc as a research baseline, making relocation (Option 2) the
  preservation-safe default if the research thread is still live. If Option 1 (delete) is chosen
  instead, the dangling scratchpad reference is explicitly acceptable (ephemeral scratchpad).
- **AUDIT:** `grep -rn 'Command Center Design|Visual Workflows'` confirmed the only in-repo
  reference is the scratchpad prompt (plus the master FID and an unrelated dify tutorial). The
  three design docs remain untracked and are the sole `lint:md` failures.
- **CHANGE DELTA:** FID text only; no file deleted or edited yet.

### Loop 3 — Second independent AUDIT correction (2026-08-09)

- **RED:** Second review confirmed the intent misattribution is closed, but flagged that Option 1
  (delete) would leave the scratchpad research prompt referencing a deleted baseline with no stated
  disposition.
- **GREEN:** Added the explicit disposition to Option 1: the dangling scratchpad reference is
  acceptable because `dev/scratchpad/` is an ephemeral working area, and no code or tracked doc
  references the deleted files.
- **AUDIT:** Re-confirmed the three docs are the sole `lint:md` failures and remain untracked; the
  scratchpad reference at `gemini-deep-research-command-center-v2-prompt.md:7` is the only in-repo
  cross-reference.
- **CHANGE DELTA:** FID text only; no file deleted or edited yet.

### Loop 4 — Nova planning-audit evidence refresh (2026-08-09)

- **RED:** Nova's planning-phase audit (PASS for all other FIDs) returned **NEEDS-REVIEW** for this
  FID: a third untracked file, `docs/design/Command Center Design Sprint.md` (created 2026-08-09
  22:49, after the FIDs were authored), also fails MD013, making the two-file evidence stale.
- **GREEN:** Refreshed the evidence to enumerate all three MD013-breaking files (Concept, Visual
  Workflows, Command Center Design Sprint) and updated every occurrence of the count throughout
  the FID. The proposed solution options (delete / relocate / lint-fix) apply identically to all
  three; no planning change is required beyond the evidence refresh.
- **AUDIT:** Re-ran `bun run lint:md` — confirmed exactly the three named files fail MD013 and all
  three are untracked (`??`). `git status --short docs/design/*.md` verified the third file is
  untracked. Nova confirmed the remaining evidence (signature hits, line counts, dependency
  graph) independently PASSes.
- **CHANGE DELTA:** FID text only; no file deleted or edited yet.

### Loop 5 — Implementation record (2026-08-09)

- **GREEN:** Operator granted automation level 3. Disposition applied: relocation (Option 2) —
  the three untracked docs moved from `docs/design/` to `dev/scratchpad/` (lint-ignored per
  `.markdownlintignore` `dev/scratchpad/**`). The dangling scratchpad baseline reference
  (`gemini-deep-research-command-center-v2-prompt.md:7`) was updated to the new path.
- **AUDIT:** `bun run lint:md` exits 0 (was exit 1 on three docs). `git status` shows the docs
  relocated (untracked, now under `dev/scratchpad/`). No tracked production file changed.
- **CHANGE DELTA:** Three untracked docs relocated; one scratchpad prompt line path-updated;
  `lint:md` gate restored to green.

### Code Verification Evidence

- [x] `lint:md` failure list captured (three named docs).
- [x] All three docs confirmed untracked.
- [x] No tracked file implicated in the gate failure.
- [x] Operator disposition — granted (automation level 3); relocation applied.
- [x] Nova planning audit — returned NEEDS-REVIEW; evidence refreshed per Finding 1 (Loop 4).
- [x] Implementation — complete; `lint:md` exits 0.

## Resolution

- **Status:** Implemented; gate restored to green.
- **Fixed Date:** 2026-08-09
- **Commit/PR:** uncommitted working tree (pending `0.0.23`)
- **Archived:** —

## Lessons Learned

Untracked files still fail whole-tree gates. A hard gate that scans the working directory cannot be
considered green just because tracked content is clean; release readiness checks must account for
untracked artifacts (or exempt their directories explicitly).
