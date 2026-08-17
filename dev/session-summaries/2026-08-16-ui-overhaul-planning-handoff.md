<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Session Handoff: Savant UI Overhaul — Planning Complete; 6 FIDs Open, Awaiting Implementation

**Session ID:** `2026-08-16-ui-overhaul-planning-handoff`
**Date:** 2026-08-16
**Status:** planning complete — UI reviewed, OpenTUI capability report verified + corrected, overhaul plan approved, six FIDs created and Perfection-Loop-converged but **OPEN (`analyzed`)** pending implementation authorization
**Governing protocol:** `dev/echo-v0.1.2-single-agent.md` (single-agent ECHO; `strict_mode: true`)
**Supersedes:** `2026-08-16-1400-single-agent-ui-overhaul-planning.md` (interim summary; this handoff is the authoritative closeout)

---

## Executive Summary

The 2026-08-16 planning session prepared the Savant-Code terminal UI overhaul end to end, with zero code changed:

1. **Reviewed the current UI** (code-based): strong foundation (controller/presentational split, theme detection chain, savant-ui + design-systems packages); gaps (null `ChatHeader`, `setInterval` animations, fixed 40-col sidebar, no native code/diff components).
2. **Verified the OpenTUI capability report against primary sources** and appended a corrections appendix (report §14): 5 INCORRECT claims (scope-tree keyboard, migration gotcha #1, ScrollbackSurface, useFocus/useBlur semantics, native-Yoga timing), verified list, unverified list.
3. **Wrote the approved overhaul plan** (`docs/design/ui-overhaul-plan.md`): Phase 0 (engine upgrade, first per operator decision) → Phase 4 (layout/responsiveness), with exit criteria and FID routing.
4. **Created six FIDs** (master + five phases), ran each through the Perfection Loop until its document converged. **They remain OPEN (`analyzed`) in `dev/fids/`** — closure requires implementation evidence.
5. **Restored the repo-wide `lint:md` gate** (exit 0) by fixing the untracked report file (MD013 header + MD001 fix).

Operator correction mid-session: the six FIDs were briefly closed/archived after loop convergence; the operator correctly flagged that unimplemented FIDs must not close — reverted to `analyzed` + OPEN, correction recorded in LEARNINGS.md (canonical rule `fid-closure-requires-implementation-evidence`).

---

## FID State (6 open, 0 closed this session)

| FID | Phase | Topic | Status |
|---|---|---|---|
| FID-2026-0816-002 | master | Savant UI overhaul organizing FID (gates, decisions, fact base) | **OPEN — analyzed** |
| FID-2026-0816-003 | 0 | OpenTUI 0.2.2 → 0.5.3 exact-pin upgrade (first) | **OPEN — analyzed** |
| FID-2026-0816-004 | 1 | Design tokens + visual identity | **OPEN — analyzed** |
| FID-2026-0816-005 | 2 | Animation engine adoption | **OPEN — analyzed** |
| FID-2026-0816-006 | 3 | Native code/diff components | **OPEN — analyzed** |
| FID-2026-0816-007 | 4 | Layout and responsiveness | **OPEN — analyzed** |

`dev/fids/` = these six + README + archive/. Each FID's Resolution section states "not closed — implementation pending".

---

## Decisions locked this session (plan §11)

1. **Pin policy:** exact pins `@opentui/core` + `@opentui/react` = `0.5.3` (no carets); deliberate one-time `bun.lock` regeneration; verify platform native subpackages; frozen-lockfile invariant.
2. **Live-test target:** no native tmux on this machine (Git Bash) — use **tmux in WSL (Ubuntu, installed; needs bun installed there)** for automation; **Windows Terminal** for visual acceptance; legacy ConHost as compatibility floor (exercises `OPENTUI_FORCE_EXPLICIT_WIDTH=false` guard).
3. **savant-free seam:** none — `IS_SAVANT_FREE` is a compile-time define (`SAVANT_FREE_MODE=true` via `--define`); savant-free reuses 100% of cli/ source. Status note: savant-free is **private, unreleased, on hold** — keep its build + e2e green, no release sequencing.

---

## Deliverables (all in working tree, NOT committed)

| Artifact | Path |
|---|---|
| Corrected capability report (appendix §14 + lint fixes) | `docs/design/OpenTUI Terminal UI Capabilities.md` |
| Overhaul plan (phased, approved) | `docs/design/ui-overhaul-plan.md` |
| Scope record (A–E, E = FIDs open) | `SCOPE.md` (repo root) |
| Six open FIDs | `dev/fids/FID-2026-0816-00{2..7}-*.md` |
| Lesson (closure semantics) | `dev/LEARNINGS.md` → `fid-closure-requires-implementation-evidence` |
| Interim session summary | `dev/session-summaries/2026-08-16-1400-single-agent-ui-overhaul-planning.md` |

---

## Next-session start plan (read order)

1. Boot: `dev/echo-v0.1.2-single-agent.md` 0-EOF, `protocol.config.yaml`, `dev/LEARNINGS.md`, glob `dev/fids/*.md` — the six FIDs are the work queue.
2. Read this handoff, then `docs/design/ui-overhaul-plan.md` and report §14.
3. **First work item: implement Phase 0 (FID-2026-0816-003)** — engine upgrade only, zero visual change; exit criteria in the FID. Then close it with implementation evidence (typecheck ×4, `bun test`, lint, `lint:md`, prettier, tmux smoke in WSL, savant-free e2e).
4. Phases 1–4 in order (FID-2026-0816-004..007), each closed on implementation.
5. Housekeeping: reconcile `dev/idea-shelf/opentui-design-capabilities-reference.md` (stale uncorrected copy of the report); live visual baseline pass in Windows Terminal before Phase 1 reskin.

---

## Final Gate Sweep (2026-08-16, docs-only session)

| Gate | Result |
|---|---|
| `bun run lint:md` | ✅ exit 0 (repo-wide; was red due to untracked report file — now fixed) |
| `bunx prettier --check` (all touched docs + 6 FIDs) | ✅ clean |
| markdownlint (6 FIDs, repo config) | ✅ 0 issues |
| typecheck ×4 / `bun test` / eslint | ⏸️ not run — zero code changed this session (stated honestly, not claimed) |

---

## Open Items / Blockers (next session)

1. Operator authorization to implement Phase 0 (FID-2026-0816-003) — nothing is blocked in the docs; implementation simply has not been authorized/started.
2. WSL setup prerequisite: install `bun` inside WSL Ubuntu for the tmux automation harness.
3. `dev/idea-shelf/` stale report copy — reconcile or delete.
4. No release sequencing concerns: savant-free unreleased (on hold); no commit/push performed.

## Governance / Standing Notes

- Governing doc is `dev/echo-v0.1.2-single-agent.md` (not `ECHO.md`).
- **`resources/` is local-only research and MUST stay gitignored** — never push (standing directive from the 2026-08-15 release audit).
- FID closure rule (new lesson): loop convergence on the document ≠ closure; close only with implementation evidence, status `analyzed` until then.
- `SCOPE.md` at repo root is the live audit trail.

No commit, push, release, publication, or deployment was performed.
