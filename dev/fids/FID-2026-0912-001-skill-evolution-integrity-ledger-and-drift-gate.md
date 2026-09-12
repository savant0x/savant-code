# FID: Skill evolution integrity — trust-ledger append + baselineSha drift gate (WikiSkill/SkillOpt adaptation, part 1)

**Filename:** `FID-2026-0912-001-skill-evolution-integrity-ledger-and-drift-gate.md`
**ID:** FID-2026-0912-001
**Severity:** medium
**Status:** analyzed
**Created:** 2026-09-12 (operator directive: scope the SkillOpt blueprint
and WikiSkill arXiv:2608.27454 into FIDs)
**YAGNI-Compliance:** Verified — reuses the existing VERSIONS.jsonl ledger
IO in `helpers.ts` (append-only, hashChange) for two unappended
transitions; one new metadata field (`baselineSha`) on draft creation; one
fail-closed comparison at trust. No new storage format, no new commands.
**Related:** `docs/design/SkillOpt Integration into Savant.md`
(§3 purge/backup, §4 drift); WikiSkill §3.1 (Skills Layer pinned to wiki
baselines); FID-2026-0910-001 (notification surfaces, shipped); the
operator-approved 2026-09-10 corrected plan (legs 4-5 of 6, never
implemented)

---

## Summary

The skill trust boundary is not evidence-complete: `trustSkill` and `untrustSkill`
(`common/src/util/skill-management/trust.ts:77-121`) mutate live skill state
**without appending to the per-skill VERSIONS.jsonl ledger**, even though the
ledger machinery exists and trusted/rollback paths use it. Separately, a draft
can sit in quarantine while its live target drifts (manual edits, other
harness drafts); trusting then silently clobbers the drift. WikiSkill pins
skill proposals to baselines and refuses publication on drift; this FID adds
the Savant equivalent: `baselineSha` captured at draft creation, checked
fail-closed at trust.

## Environment

- **OS:** Windows 11, Git Bash; Bun 1.3.14-pinned
- **Commit/State:** main @ `7db3fcaf` (evidence grepped this session)
- **RED evidence (file:line, this session):**
  - `trust.ts:77-91` — `trustSkill` writes live + `rmSync(draftDir)` and
    returns; ZERO `appendVersion`/ledger call. Contrast: `rollbackLiveSkill`
    and the mutation paths do record (`helpers.ts` ledger IO exists).
  - `trust.ts:94-121` — `untrustSkill` same gap: moves live → quarantine,
    no ledger append.
  - No drift guard anywhere: `grep baselineSha` across common/cli = zero
    matches; `trustSkill` accepts any draft against any live state.
  - Quarantine has no ledger at all: `.agents/skills/.quarantine/*` contains
    only SKILL.md files (ls -R, this session); live skills have
    `versions/v1/` + `VERSIONS.jsonl` (find, this session).
  - Operator-documented live instance: the `release-workflow` draft sits
    quarantined while the live skill ships superseded 0.1.0 cadence
    (session summary 2026-09-10) — the exact drift this gate refuses.

## Detailed Description

### Problem

1. History hole: `/skills untrust` then `/skills rollback` cannot reconstruct
   trust transitions — the ledger misses exactly the two operator-driven
   state flips. ZTAP claims about "operator-only trust" are unauditable.
2. Silent clobber: trusting a stale draft overwrites live skill bytes that
   changed after the draft was authored. The draft wins by surprise.

### Expected Behavior

1. `trustSkill` appends a FULL `SkillLedgerEntry` (the `rollbackDraft`
   pattern, trust.ts:50-66): `{seq, version, action: 'trust', ts,
   sessionId, reason, prevSha (live bytes before), nextSha (draft bytes),
   provenanceRef, semanticPreservation: true}` to the live skill's ledger
   as part of migration; `untrustSkill` appends `action: 'untrust'`.
   `SKILL_MANAGE_ACTIONS` extends with 'trust' | 'untrust' (consumer
   sweep gate in GREEN). Fail-open policy decision: ledger append failure
   must NOT block the operator action (the file move is primary) but MUST
   surface a warning line in the result message (Law 14: no silent error
   paths). Signatures widen to params objects `{rootDir, name, sessionId,
   reason}`; callers pass the CLI session id or literal `'operator'`.
2. Draft creation (`patchSkill`/`draftSkill` mutations) records
   `baselineSha` = hashChange(live bytes) at authoring time (create drafts:
   baseline = the live skill for patches; `null` for new skills).
3. `trustSkill` recomputes the live hash; `currentLiveSha !==
   draft.baselineSha` (for patch drafts) → terminal error:
   "Drift detected: the live skill changed since this draft was authored.
   Trust refused. Re-draft against the current baseline." Operator edits
   always win over harness drafts.

### Root Cause

The trust paths predate the ledger (added later for trusted skills) and the
09-10 corrected plan (legs: baselineSha drift gate + ledger-on-trust) was
approved but never implemented — superseded by session crash, never dropped.

### Evidence

(see Environment — all file:line, this session)

## Impact Assessment

### Affected Components

- `common/src/util/skill-management/trust.ts` (ledger appends ×2, drift gate)
- `common/src/util/skill-management/mutations.ts` (baselineSha capture)
- `common/src/util/skill-management/helpers.ts` (ledger append reuse only)
- Suites: skill-management trust/mutations pins, drift-refusal pin,
  ledger-integrity pins

### Risk Level

- [x] Medium: changes the operator trust path (fail-closed on drift is a new
      refusal mode) — mitigated by the explicit re-draft escape hatch and
      fail-open ledger policy

## Proposed Solution

### Approach

Dependency order: ledger appends first (pure addition), then baselineSha
capture, then the drift gate consuming it. Each RED-first.

### Steps

1. [ ] **RED:** trust/untrust ledger-append pins; baselineSha capture pins;
       drift-refusal pin (mock live edit post-draft → terminal error);
       no-drift pass-through pin; new-skill (null baseline) pin.
2. [ ] **GREEN:** trust.ts appends + gate; mutations.ts captures.
3. [ ] **VERIFY:** typecheck common + cli; skill-management suites;
       eslint `--max-warnings 0`; prettier; lint:md.
4. [ ] **LAW 4:** grep production callers of the drift gate (trustSkill ←
       skill_manage tool + /skills trust command).

### Live Unknowns

- Drafts authored BEFORE this FID carry no baselineSha → gate treats
  missing baseline as "unpinned" (trust allowed, warning line) — no
  migration needed, no historical backfill (YAGNI).

## Verification Gates

- gate: typecheck common / cli
- gate: test common/src/util/__tests__/ (skill-management family)
- gate: eslint --max-warnings 0 · prettier · lint:md

## Perfection Loop

### Missed Questions

1. *What about drafts authored before baselineSha exists?* — Treated as
   unpinned: trust allowed with a warning line. No backfill (YAGNI; the
   operator's three live drafts re-draft naturally on next touch).
2. *Should the drift gate also cover untrust (live → quarantine)?* — No:
   untrust moves live bytes TO quarantine; there is no baseline to
   clobber. Gate applies only at trust (draft → live).
3. *Fail-open or fail-closed on ledger-append failure?* — Fail-open with a
   surfaced warning (Law 14): the operator action is primary; blocking a
   trust because an audit append failed would invert priorities.
4. *Where does baselineSha live — frontmatter or sidecar file?* — Draft
   SKILL.md frontmatter (gray-matter already in the engine; one optional
   field; survives copy/move without extra files).

### Code Verification Evidence

Planning-stage FID: implementation evidence lands here at GREEN. RED
evidence (this session): trust.ts:77-91 and :94-121 read in full — zero
ledger calls; repo-wide grep `baselineSha` = no matches; quarantine
dirs contain SKILL.md only (ls -R); VERSIONS.jsonl + versions/v1 exist
for trusted skills (find).

## Resolution

Open — awaiting operator approval to implement (Law 2). Status stays
`analyzed` until implementation evidence exists.

### Loop 2 — AUDIT (2026-09-12, fresh greps + missed-surface hunt)

- **Finding 1 (contract imprecision, corrected):** the original GREEN
  sketch proposed a thin ledger entry `{seq, action, prevSha, nextSha,
  pendingTrust}`. Ground truth: `SkillLedgerEntry`
  (types.ts:28-41) REQUIRES `{seq, version, action, ts, sessionId,
  reason, prevSha, nextSha, provenanceRef, semanticPreservation}`, and
  `pendingTrust` is a `SkillManageResult` field, not a ledger field.
  GREEN contract corrected to the full shape.
- **Finding 2 (action union):** `SKILL_MANAGE_ACTIONS`
  (types.ts:14-22) = create|patch|edit|delete|write_file|remove_file|
  rollback — `'trust'`/`'untrust'` are NOT in it (trust currently emits
  action:'edit'). Decision: EXTEND the union with 'trust' + 'untrust'
  (honest history beats display convenience); GREEN must sweep action
  consumers (`grep -rn "action ===" common/src cli/src` + render sites)
  as a declared gate.
- **Finding 3 (signature):** `trustSkill(rootDir, name)` /
  `untrustSkill(rootDir, name)` lack the required `sessionId`/`reason`
  entry fields. Signature widens to a params object; operator-facing
  callers (skill_manage handler + `/skills trust` command) pass the CLI
  session id, or the literal `'operator'` when none exists (default).
- **Finding 4 (in-repo precedent):** `rollbackDraft`
  (trust.ts:22-74) already appends exactly the required entry shape with
  `provenanceRef: \`session:${sessionId}\`` — the GREEN pattern to copy
  verbatim (Law 13).
- **Citation re-verification:** trust.ts:77-91/:94-121 confirmed
  ledger-less (re-read); helpers.ts:79-113 (appendLedgerEntry,
  readLedgerEntries, nextLedgerSeq) confirmed reusable as-is.
- **CHANGE DELTA:** targeted GREEN corrections (~8%); RED findings
  unchanged in substance.

### Loop 3 — ADVERSARIAL self-check (2026-09-12)

- Refutation attempt on Finding 1's premise ("trust appends nothing"):
  re-read trust.ts 0-95 — no appendLedgerEntry call site; CONFIRMED.
- Refutation attempt on the union extension ("keep action:'edit' with a
  reason marker"): rejected — reason strings are free text, not
  machine-queryable; the ledger's purpose is mechanical audit. Extension
  stands.
- Half-claim split: "operator edits always win over harness drafts" is
  the DESIGN GOAL of the drift gate; the gate enforces it only for
  baseline-pinned drafts (unpinned drafts warn). Recorded as such.
- No omissions found in Affected Components; consumer sweep added as a
  GREEN gate closes the one gap the original authoring missed.
- **Verdict:** loop converges; document eligible for implementation.

### Loop 1 — Authoring (2026-09-12)

- RED findings ground-truthed by direct read + grep (no stale citations;
  the 09-10 plan's `trust.ts:77-121` line refs re-verified identical today).
- GREEN: minimal contract above; fail-open ledger + fail-closed drift is
  the deliberate asymmetric robustness default (data loss refusal > audit
  inconvenience).
- CHANGE DELTA: initial authoring.

## Lessons Learned

(none yet)
