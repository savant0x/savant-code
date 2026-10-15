# Session Summary: 2026-09-28 — post-release verification + FID-2026-0928-013 (archived-FID closure guard)

**Session ID:** 2026-09-28-post-release-t97-fid0928-013-guard
**Status:** completed
**Branch:** `main` (no commit — operator defers push; tree carries the session's
uncommitted work; release v0.0.34 previously verified in sync with
`origin/main` at `f929e978`)

---

## Initial State

First post-release session. v0.0.34 pushed hours earlier (operator). Operator
directive: governance is `dev/echo-v0.1.2-single-agent.md` only (not
`ECHO.md`). Operator selected "Rule on T97"; the T97 disposition ruling itself
was skipped in the ask_user, and the ceremony-guard ruling ("Guard this
session") was given. Session ceiling: level 3.

---

## Work Completed

### Release verification (5/5 assertions, repo's own post-release standard)

- Tag `v0.0.34` on origin → `f929e978`, tag HEAD binding = `origin/main` = HEAD
- npm `savant-code@0.0.34` served; `dist-tags.latest` = `0.0.34`
- GitHub release published 2026-09-29T01:43:31Z, `draft: false`, `pre: false`
- All 5 tarball assets present
- G5 bundle marker: `git rev-list last-backup..main --count` = 0 (backup current)

### T97 re-measured (repo's own `parseFidStatus`, no re-implemented regex)

- 436 archived records / 395 `closed` / 41 problem records (39 non-closed +
  2 with no `**Status:**` line: `FID-2026-0807-010`/`-011`)
- The T97 disposition ruling was **not** given; T97 stays open in SCOPE.md
  (figures refreshed there), blocked pending operator ruling — the lawful
  state. Pre-cutoff August batch (~30) + 2 malformed remain its surface.

### FID-2026-0928-013 — archived-FID closure guard (closed + archived)

- **Operator ruling:** "Guard this session" (ceremony status-flip defect).
- **RED:** live scope guards (`scope-register-completeness` /
  `scope-register-open-items-only`) caught this very FID unregistered — the
  register check fired on its own author. Fixed with the register line +
  T97 refresh; both live legs 23/0 after.
- **GREEN (RED-first pins):** `validateArchivedFidClosures` in
  `scripts/fid-gates.ts:175-247`; probe `scripts/audit-fid-archived-closures.ts`;
  wired `scripts/validate-repository.ts:261`. Cutoff 2026-09-15
  (FID-2026-0915-004 vocabulary ruling); dated
  `- **Archived-Declined:** operator-approved YYYY-MM-DD` marker.
- **First live catch: 9 post-cutoff violators, not the 3 identified at
  authoring** — eight status-flip misses (0916-007, 0917-004, 0917-006,
  0918-001/-002/-003/-004, 0928-005) + the 0919-009 operator decline.
  All eight had per-record closure evidence (six in-record `Closed Date`
  lines, two citing G2 `69f6e7a7`; two via README/CHANGELOG ledger).
  Repairs: eight status flips → `closed`, one dated decline marker.
- **AUDIT:** suite 8/8 (RED leg = import error pre-change); probe
  exit 1 (9 catches) → exit 0 after repairs; full battery green (below);
  call-graph: two production callers grep-cited.
- **Closure:** status `closed`, Resolution filled, moved to
  `dev/fids/archive/`, receipt re-stamped 3/3 LIVE at the archived path
  (byte-consistent), CHANGELOG entry under 0.0.34, archive index entry,
  register line removed per the open-items-only rule.

### Idea-shelf / other

- Scratchpad probe (`t97-recount.ts`) created, used, removed (ephemeral).
- No commits (G1/G2 operator-gated); no git execution by the agent.

---

## Issues Discovered

1. **The closure ceremony's status flip is a real, recurring defect class** —
   9 instances, not 2; the register's 2026-09-28 T97 figures were stale within
   one session-generation. The new guard makes any future instance fail
   `validate:repository` (`fid.archive.not-closed`).
2. `bun test` path args are substring filters (T67, AGENTS.md-pinned): the
   `./path` form needs `.test` in the filter; use substring filters from the
   workspace root (`cd packages/agent-runtime && bun test scope-register`).
3. A new active FID must get its SCOPE.md register line **at creation** — the
   live scope guards fail the test battery until it exists.

---

## Validation Results (final state)

- `bun run typecheck` — PASS (exit 0, all legs incl. `typecheck:scripts`)
- `bun run test` — PASS (421 pass / 0 fail, final leg; 2 live-scope failures
  mid-flight were the missing register line, fixed)
- `bun x eslint . --max-warnings 0` — PASS
- `bun run lint:md` — PASS
- `bunx prettier --check .` — PASS (probe file reformatted once)
- `bun run quality:report` — PASS (1498 baselined files)
- `bun run validate:repository` — PASS
- `bun run fid:verify --check` — PASS (new guard included)
- `bun run scripts/audit-fid-archived-closures.ts` — PASS (exit 0)
- `scope-register-check` / `scope-guard-check` — PASS (0 issues each)
- Receipt for FID-2026-0928-013: 3/3 LIVE at `dev/fids/archive/…-013-…md`

## Perfection Loop Summary

| Loop | Target | RED | GREEN | AUDIT | Delta |
|------|--------|-----|-------|-------|-------|
| FID-2026-0928-013 | archived-FID closure guard | import error pre-change; probe caught 9 live | validator + probe + wiring + 9 record repairs | 8/8 pins, full battery, call-graph | fid-gates.ts, probe, wiring, 8-pin suite, 9 archived records, SCOPE, CHANGELOG, READMEs |

## Open Questions / Blockers

- **T97 disposition ruling still owed by the operator** (tiered proposal was
  presented and skipped): per-record vs. tiered vs. mechanism-only for the
  ~30 pre-cutoff August records + 2 malformed.
- T94 (README callout shape), T83-E (two backup branches — operator git),
  T95-B/C, R1/R2/R3, T62-followup(2)(3), T87-B — all level 1, operator-blocked.
- Commit/push operator-gated (G1/G2); FID-2026-0928-013's Resolution cites
  the pending commit.
