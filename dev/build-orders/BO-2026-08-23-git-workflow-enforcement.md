---
title: Git Workflow Optimization — Enforcement & Migration Build Order
date: 2026-08-23
author: Nova
status: planning
requested_by: Spencer
consumed_by: (unassigned — any harness session with Orchestrator role)
source_research: docs/design/Solo Git Workflow Optimization.md (Gemini DR v2, operator-approved); dev/nova/outbox/2026-08-23-git-workflow-echo-amendment-draft.md (Nine Rules, G1–G9)
fids_emitted: []
---

# BO-2026-08-23-git-workflow-enforcement

## Overview

Operationalize the approved Solo Git Workflow (Nine Rules G1–G9) so the workflow stops being a
document and becomes enforced behavior. Two tracks:

1. **Protocol track** (operator-only, no agent): fold the amendment into ECHO.md + LEARNINGS.md.
2. **Mechanical track** (agent-executable): FIDs that make the rules *checkable* — because a
   lesson without an enforcement point is decorative.

### Non-negotiable constraints

- **Agents never execute git commands** (Rule G1). Every FID below is config/docs/tooling that
  *supports* the single human committer or validates artifacts — none of them give agents git
  execution tools.
- Zero external runtime deps; zero-warning quality gates unchanged at push time.
- Public main remains release-only via `scripts/public-release.ts`; granular history between
  tags per Rule G6 (operator-approved tradeoff).
- ECHO Perfection Loop governs each FID: RED → WRITE → AUDIT → ADVERSARIAL.

## Research Foundation

- `docs/design/Solo Git Workflow Optimization.md` — Gemini Deep Research v2 spec (operator-corrected:
  line-count thresholds removed in favor of logical atomicity).
- `dev/nova/outbox/2026-08-23-git-workflow-echo-amendment-draft.md` — Nine Rules G1–G9 + Recovery
  Playbook + Migration Checklist + "What Stays Exactly The Same."
- Operator realizations 2026-08-23: local commits ≠ publishes; logical atomicity over numeric caps.

## Staged Data / Current State

| Item | State |
| --- | --- |
| Amendment draft | Complete (v1), in Nova outbox, status DRAFT |
| ECHO.md | No G-rules yet |
| dev/LEARNINGS.md | No git-workflow entries yet |
| `.gitmessage` + `commit.template` | Not configured |
| `git maintenance` | Not enabled on primary clone |
| OneDrive bundle backups | Not started (no baseline bundle exists) |
| FID template | Resolution section has no required `Commit:` field |
| Pre-push hook (`.githooks/pre-push`) | Exists and works (credential scan + eslint + lint:md) — untouched by this BO |
| Working tree | May contain uncommitted WIP from concurrent sessions — migration must be safe on dirty tree |

## Phased Build Order

### Phase 0 — Protocol adoption (OPERATOR ONLY, ~15 min, no FID)

Not agent work. Listed first because every downstream gate depends on it.

1. Fold the Nine Rules (G1–G9) into `ECHO.md` as a new section ("Version-Control Workflow Laws")
   or appendix — operator's call on placement.
2. Add LEARNINGS.md entries for the three load-bearing lessons:
   - local commits ≠ publishes (release-only-public-main preserved)
   - logical atomicity replaces line-count thresholds
   - graceful degradation can MASK dead paths (the basher root cause is the canonical example)

**Gate:** ECHO.md contains G1–G9 verbatim or near-verbatim before Phase 1 FIDs open.

### Phase 1 — Mechanical enforcement (FIDs, agent-executable)

| FID | Title | Scope | Depends On | Acceptance Gates |
| --- | --- | --- | --- | --- |
| 1 | Commit message template | Create `.gitmessage` matching Rule G8 (`<type>(<scope>): <desc> (<FID>)`, imperative lowercase ≤72); wire `git config commit.template .gitmessage` via root `prepare` script alongside existing hooksPath setup; add format doc comment inside template | Phase 0 | File exists; `prepare` script idempotent; template shown in `git commit` dry-run; typecheck ×4 unaffected |
| 2 | FID template `Commit:` field | Update FID template (Recorder domain): add required `Commit:` field to Resolution section; update Recorder instructions + auto-archive checks to verify hash presence; document that working-tree closure is deprecated (Rule G2 supersedes) | Phase 0 | New FIDs created after merge include the field; Recorder validation rejects empty field; archived FID examples updated where cheap |
| 3 | Bundle backup script | `scripts/git-bundle-backup.ts`: wraps baseline + incremental bundle commands from Rule G5 (full bundle once, then `last-backup..main` incrementals), writes to configurable OneDrive path, runs `git bundle verify` after create, advances/moves the `last-backup` marker only on verify success; `--baseline` flag for one-time full archive | Phase 0 | Script creates + verifies bundles end-to-end on a scratch clone; failure mid-way does NOT advance marker; path configurable via env/config; zero warnings under eslint |
| 4 | Push-strat preflight check (optional but recommended) | Extend release tooling docs or a small check script: before `public-release.ts` cut, assert (a) working tree clean, (b) all closed FIDs this week have recorded commit hashes (Rule G2 audit), (c) latest bundle verified (Rule G5). Fail-closed output naming exactly which condition failed | 1–3 | Check runs green on compliant state; red on each violated condition individually; integrates as documented pre-release step without modifying public-release.ts behavior |

### Phase 2 — Migration execution (OPERATOR + committer session, no new FIDs needed)

Run the amendment draft's Migration Checklist in order (safe on dirty tree):

1. `.gitmessage` wired (FID 1 landed) → `git config commit.template .gitmessage`
2. `git maintenance start` (one-time, Rule G7)
3. Baseline bundle via FID 3 script `--baseline`; tag/marker advanced on verify success
4. Drain current working tree: path-scoped staging per closed area (Rule G4), G8-formatted
   messages, one commit per coherent change (Rule G3) — reversible, no rush

**Gate:** `git log --oneline` shows atomic per-area commits; bundle restore drill passes on a
scratch clone (`clone → fetch incrementals → verify refs`).

## Dependency Graph

```text
Phase 0 (operator: ECHO.md + LEARNINGS.md)
   │
   ├──> FID 1 (.gitmessage) ──┐
   ├──> FID 2 (Commit: field) │
   ├──> FID 3 (bundle script) ─┤
   │                           ├──> Phase 2 (migration + drain)
   └──> FID 4 (preflight) ─────┘
```

FIDs 1–3 are independent of each other; FID 4 depends on all three. Phase 2 requires everything.
Suggested emission order for a target session: 1 → 3 → 2 → 4 (script work while governance edits
settle).

## Open Questions for Operator

1. **ECHO placement:** new numbered law section vs. appendix for G1–G9? (Phase 0, operator's call.)
2. **OneDrive path:** confirm absolute path for `<onedrive>/savant-backups/` so FID 3's default
   config lands correct on first run.
3. **FID 4 scope:** preflight script now, or defer until the first post-migration release? Cheap
   either way — recommend now while context is hot.
4. **Marker mechanism:** FID 3 needs a "last backup" pointer — tag (`last-backup`) vs. plain file
   with ref hash. Recommend tag (survives clone, visible in `git tag -l`); flag if you prefer file.

## What This BO Deliberately Does NOT Do

- No changes to `scripts/public-release.ts` behavior (release pipeline stays as-is).
- No agent git execution anywhere (G1 absolute).
- No force-push policies introduced; existing AGENTS.md "do not force-push main" stands.
- No squash-to-release; granular public history is the accepted new normal (G6).
