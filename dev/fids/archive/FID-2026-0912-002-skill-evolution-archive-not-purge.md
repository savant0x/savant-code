# FID: Skill evolution memory — archive-not-purge draft expiration (WikiSkill/SkillOpt adaptation, part 2)

**Filename:** `FID-2026-0912-002-skill-evolution-archive-not-purge.md`
**ID:** FID-2026-0912-002
**Severity:** high
**Status:** closed (implemented + verified 2026-09-12; archived)
**Created:** 2026-09-12 (operator directive: scope the SkillOpt blueprint
and WikiSkill into FIDs)
**YAGNI-Compliance:** Verified — replaces one `rm`-based purge with a
`rename` + one ledger line; the archive directory is inert (no loader
reads it). No new commands, no new config.
**Related:** `docs/design/SkillOpt Integration into Savant.md`
(§3 purge semantics); WikiSkill (wiki/knowledge never rolled back — the
core paper finding: persistent knowledge accumulation is critical);
operator-approved 2026-09-10 corrected plan (leg: archive-not-purge);
FID-2026-0824-012 (harness governance)

---

## Summary

`purgeRejectedDrafts` (`scripts/lessons-to-skills.ts:241-277`) **permanently
deletes** quarantined drafts older than `DRAFT_REJECTION_WINDOW_DAYS = 30`
(:38) that were never trusted. Unreviewed drafts — including
operator-relevant proposals that sat while the operator was away — are
destroyed silently. The Scribe's reasoning (WHY a draft was proposed) dies
with it. This FID replaces deletion with a monotonic move-only archive:
`.quarantine/.archive/YYYY-MM/` + an `archived` ledger line. Knowledge
accumulates; the harness never forgets.

## Environment

- **OS:** Windows 11, Git Bash; Bun 1.3.14-pinned
- **Commit/State:** main @ `7db3fcaf`
- **RED evidence (file:line, this session):**
  - `scripts/lessons-to-skills.ts:38` — `export const
    DRAFT_REJECTION_WINDOW_DAYS = 30`
  - `scripts/lessons-to-skills.ts:241` — `export function
    purgeRejectedDrafts(` with the 30-day cutoff at :246 and an unlink-style
    removal of each expired draft directory
  - `scripts/lessons-to-skills.ts:274-276` — the run path calls it
    unconditionally: `purged = purgeRejectedDrafts(rootDir)` →
    `purged ${purged.length} rejected draft(s) >30d`
  - No archive path exists: `grep -rn "\.archive"` over common/cli/scripts
    = zero production matches; `.agents/skills/.quarantine/` currently
    holds 3 unreviewed drafts (ls, this session) that the next 30-day
    window would destroy.

## Detailed Description

### Problem

The 30-day purge silently destroys pending operator decisions. The
operator may be away longer than 30 days; a draft that required a real
failure trace to author is unrecoverable. This directly violates the
harness invariant "the harness cannot forget and must not silently mutate
the workspace" (SkillOpt blueprint §3, verified against FID-2026-0824-012's
governance contract).

### Expected Behavior

1. Expired never-trusted drafts move via `fs.renameSync` from
   `.agents/skills/.quarantine/<name>/` to
   `.agents/skills/.quarantine/.archive/<YYYY-MM>/<name>/` (mkdir -p the
   month dir; on EEXIST/ENOTEMPTY name collision, suffix `-<seq>`).
2. The quarantine ledger (FID-2026-0912-001's ledger IO, or a minimal
   local record if that FID is not yet merged) records
   `{action: 'archived', from, to, date}`.
3. The quarantine loader (`skills-discovery.ts` quarantine scan) ignores
   `.archive/` by name — no context cost at 1000 drafts.
4. No deletion path remains for never-trusted drafts. `rm` appears nowhere
   in the expiration flow.

### Root Cause

The purge was authored as cleanup when quarantine was expected to be
short-lived; the harness's own governance review later ruled drafts are
operator-decision material, but the fix was never implemented (09-10 plan
leg 2, approved, superseded by crash).

### Evidence

(see Environment — all file:line, this session)

## Impact Assessment

### Affected Components

- `scripts/lessons-to-skills.ts` (purge → archive; run-path message)
- `common/src/util/skill-management/paths.ts` (archive dir helper,
  quarantine-rooted)
- `common/src/util/skill-management/files.ts` or discovery (ignore rule)
- Suites: lessons-to-skills pins (archive move, ledger line, collision
  suffix, loader-ignore), discovery pin for `.archive` invisibility

### Risk Level

- [x] High severity rating on the FINDING (silent destruction of
      operator-governed data); the fix itself is low-risk (pure move +
      append, no hot path).

## Proposed Solution

### Approach

Replace, don't deprecate: the `purgeRejectedDrafts` export becomes
`archiveRejectedDrafts` with the same call signature (run-path callers
number exactly one — Law 4 grep in GREEN). Keep `DRAFT_REJECTION_WINDOW_DAYS`
semantics (window → archive, not delete).

### Steps

1. [ ] **RED:** archive-move pin (30-day-old draft lands in
       `.archive/YYYY-MM/`, original gone); ledger-line pin; collision
       suffix pin; fresh-draft-untouched pin; loader-ignores-archive pin;
       no-deletion pin (file bytes survive).
2. [ ] **GREEN:** rename the function, implement the move, update the run
       message (`archived N rejected draft(s) >30d`).
3. [ ] **VERIFY:** typecheck common + scripts-affected workspaces; suites;
       eslint; prettier; lint:md.
4. [ ] **LAW 4:** grep the renamed export (definition + the one run-path
       caller + suite).

### Live Unknowns

- Windows `fs.renameSync` across the same volume is atomic here (same
  drive); no cross-volume case exists (archive is inside the quarantine).
- Historical drafts already destroyed by the purge are gone — no backfill
  possible; the archive starts empty. Recorded honestly, not reconstructed.

## Verification Gates

- gate: typecheck common / cli
- gate: test common/src/util/__tests__/ + scripts/__tests__/ (lessons-to-skills family)
- gate: eslint --max-warnings 0 · prettier · lint:md

## Perfection Loop

### Loop 2 — AUDIT (2026-09-12)

- **Ledger contract corrected:** 'archived' is NOT in
  `SKILL_MANAGE_ACTIONS` (types.ts:14-22); the archive entry needs the
  same union extension FID-2026-0912-001 makes ('trust' | 'untrust' |
  'archived' — one coordinated union change across both FIDs' GREEN).
  Entry shape = the full `SkillLedgerEntry` (types.ts:28-41), not the
  thin `{action, from, to}` the authoring sketched.
- **Sequencing rule made concrete:** append the entry BEFORE
  `renameSync` so the ledger line travels with the archived directory
  (the ledger lives inside the skill dir — helpers.ts:80
  `skillLedgerPath(rootDir, name)`); after the move, the quarantine
  ledger no longer exists at the old path. Verified by reading
  `appendLedgerEntry` (helpers.ts:79-87): ledger path derives from the
  skill dir, so post-move appends would silently create a NEW quarantine
  ledger — the ordering is load-bearing, pinned in GREEN tests.
- **Citation re-verification:** lessons-to-skills.ts:38/:241/:246/:274-276
  re-confirmed (re-read); no existing `.archive` handling anywhere.
- **CHANGE DELTA:** contract corrections only; approach unchanged.

### Loop 3 — ADVERSARIAL self-check (2026-09-12)

- Refutation attempt ("rename after append loses the entry"): the
  ordering rule above makes the loss impossible; the failure mode is
  instead a DUPLICATE quarantine ledger on post-move appends — the
  before-move pin is the mitigation. CONFIRMED load-bearing.
- Refutation attempt ("keep purge as fallback for .archive"): rejected —
  an unbounded archive was the explicit operator-facing contract
  ("the harness cannot forget"); disk cost is KB-scale markdown. Stands.
- Omission hunt: loader-ignore pin was present; ADD pin that the
  quarantine COUNT (`countQuarantinedDrafts`, helpers.ts:155) excludes
  `.archive/` so notification surfaces don't resurrect archived drafts.
- **Verdict:** loop converges; document eligible for implementation.

### Missed Questions

1. *Keep or rename `DRAFT_REJECTION_WINDOW_DAYS`?* — Keep the constant,
   keep the 30-day window; only the disposition changes (archive, not
   delete). Smallest contract change; the runbook text updates with it.
2. *Should archived drafts be visible via `/skills`?* — No (this FID).
   The archive is a durable record, not a work queue; surfacing it is a
   UX decision that belongs to a future FID if the operator wants it.
3. *Does the archive interact with the ledger FID (0912-001)?* — The
   archived line is a minimal local record so 002 doesn't block on 001;
   if 001 lands first, 002 consumes its ledger IO (Law 13) and the local
   record is dropped. Sequencing note pinned in both directions.
4. *Windows rename atomicity?* — Same-volume rename inside
   `.agents/skills/`; no cross-volume case exists by construction.

### Code Verification Evidence

Planning-stage FID: implementation evidence lands here at GREEN. RED
evidence (this session): lessons-to-skills.ts:38 (`DRAFT_REJECTION_WINDOW_DAYS
= 30`), :241 (`purgeRejectedDrafts`), :246 (cutoff), :274-276 (unconditional
run-path call) read in full; repo-wide grep for an archive path = zero
production matches; 3 unreviewed drafts currently in quarantine (ls).

## Resolution

**Implemented 2026-09-12 (Loop 4, RED-first).** Status `fixed`.

### Loop 4 — IMPLEMENTATION (2026-09-12, automation level 3)

- **RED:** `archive-not-purge.test.ts` — module-absent error captured
  (export `archiveRejectedDrafts` did not exist), then behavior pins
  failing against the purge implementation.
- **GREEN:** `purgeRejectedDrafts` → `archiveRejectedDrafts` in
  `scripts/lessons-to-skills.ts` — same 30-day window constant, disposition
  changed from `rmSync` to `renameSync` into
  `.quarantine/.archive/<YYYY-MM>/<name>/` (month from the draft's own
  mtime), bytes intact, plus an `ARCHIVED.json` provenance record
  (name, archivedAs, archivedAt, originalMtime, windowDays, reason).
  Collision suffix `-2`, `-3`, …; the `.`-prefixed archive is skipped on
  re-runs. CLI flag `--purge` → `--archive` with the move-only message.
- **Loop-2 self-correction applied:** the "ledger travels with the dir"
  ordering rule was WRONG in detail — the VERSIONS.jsonl ledger lives in
  the LIVE dir (paths.ts `skillLedgerPath`), which persists; appending a
  trust-union action for archived drafts would also widen the AGENT-facing
  tool surface (agents must never archive). Correct design, implemented:
  a local ARCHIVED.json record inside the archived directory. The
  append-before-rename hazard (phantom live-dir ledger) is thereby
  structurally impossible.
- **Loop-2 count pin honored:** `countQuarantinedDrafts` excludes
  `.archive/` — new pin in `skill-management-count.test.ts` (archived
  copy + pending draft → count 1).
- **Stale pin updated:** the old `purgeRejectedDrafts` behavior pin in
  `lessons-to-skills.test.ts` pinned the superseded deletion contract;
  rewritten as a rename-parity pin (fresh untouched; expired bytes
  SURVIVE in the archive).
- **AUDIT battery:** scripts suites 14/0 across 3 files (5 new archive
  pins + 9 regression); count suite 4/0; Law 4 grep: `rmSync`/`unlinkSync`
  = ZERO matches in lessons-to-skills.ts (no deletion path remains);
  eslint `--max-warnings 0`; prettier clean.
- **Out-of-scope note:** `experiences-dedup.ts --purge` rewrites the RAW
  LEDGER (14-day retention of raw traces) — a different lifecycle from
  skill drafts, governed by FID-2026-0824-012's capture contract. Not
  touched. Recorded per the Additional Rule.

### Loop 1 — Authoring (2026-09-12)

- RED findings verified by direct read of the live script (30-day constant,
  purge function, unconditional run-path call all re-confirmed today).
- GREEN: minimal contract; SkillOpt's fragile `_backup` approach explicitly
  rejected (our rollback is the VERSIONS.jsonl monotonic ledger, per the
  09-10 adversarial finding that Savant is AHEAD of upstream here).
- CHANGE DELTA: initial authoring.

## Lessons Learned

(none yet)
