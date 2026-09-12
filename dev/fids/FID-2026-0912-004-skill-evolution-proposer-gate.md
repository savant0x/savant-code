# FID: Skill evolution loop — wiki-informed proposer + gate-before-present (WikiSkill/SkillOpt adaptation, part 4)

**Filename:** `FID-2026-0912-004-skill-evolution-proposer-gate.md`
**ID:** FID-2026-0912-004
**Severity:** medium
**Status:** analyzed
**Created:** 2026-09-12 (operator directive: scope the SkillOpt blueprint
and WikiSkill arXiv:2608.27454 into FIDs)
**YAGNI-Compliance:** Verified — one cold-spawned Scribe turn at session
end (the existing end-of-turn directive), one labeling seam in the
existing `/skills` rendering, one binary gate reuse (the prove machinery
EXISTS: `cli/src/commands/skills.ts:82,111` +
`scripts/evolve-skills.ts`). No new agent type, no new model, no new
command surface.
**Related:** WikiSkill §3.2.2-3.2.4 (Wiki Maintainer / Skill Proposer /
Gating-Rollback); blueprint §2 (gate-before-present: two-stage gating),
§6 (handoff isolation); FID-2026-0824-012 (governance: agent authors,
operator releases); FID-2026-0824-016/-018 (the prove/erosion machinery —
advisory today); FID-2026-0912-003 (the wiki this proposer consumes)

---

## Summary

The harness's last unwired seam: drafts are proposed from raw agenda context
alone, and the prove machinery (`/skills prove`, erosion gates) is advisory —
a draft can reach the operator with zero empirical evidence either way. This
FID completes the loop per WikiSkill: a cold-spawned Scribe (handoff
isolation — no parent conversation history) proposes ONE skill change per
qualifying pattern, grounded in the wiki (2026-0912-003) + the deduped trace;
the existing proof machinery runs BEFORE operator presentation; and every
quarantined draft renders an honest label: `[✓ PROVEN]` (proof receipt with
non-negative lift) or `[⚠ UNPROVEN — TRUSTING BLIND]` (no proof / failed
proof). The gate informs; only the operator releases.

## Environment

- **OS:** Windows 11, Git Bash; Bun 1.3.14-pinned
- **Commit/State:** main @ `7db3fcaf`
- **RED evidence (file:line, this session):**
  - Scribe drafts WITH full parent history today: the end-of-turn directive
    spawns Scribe for session-end review; no `includeMessageHistory` split
    exists (grep: zero matches for includeMessageHistory in agents/ + spawn
    paths, this session). Blueprint §6 + the 09-10 adversarial correction:
    a blanket flag would break session summaries — the split must be a
    DEDICATED cold-spawn drafting turn, not a flag on the summarizing turn.
  - Prove machinery exists but is advisory: `cli/src/commands/skills.ts:82`
    ("ADVISORY proof + erosion status accompany…"), `:111` (`/skills prove`
    usage), `scripts/evolve-skills.ts:65-83` (erosion-blocked ingestion).
    Nothing requires proof before presentation; nothing labels drafts by
    proof state in the quarantine view.
  - WikiSkill gating contract: accept only on strict improvement over the
    best-so-far (`R_val > R_best`), roll back otherwise; the 09-10
    adversarial pass added the per-task no-regression condition (from
    SkillOpt issue #67: a mean-lift criterion accepted an evaluator-gaming
    edit) — mean lift ALONE is insufficient.
  - Rejected-proposal memory: WikiSkill embeds rejected proposals in
    `skill-impact.md` so future proposers don't repeat them. Savant has no
    rejected-proposal record (grep: none).

## Detailed Description

### Problem

1. Contamination: the drafting Scribe sees the parent session's frustration
   loops and phrasing — Goodhart bait. SkillOpt engineered this away with
   handoff isolation; WikiSkill restricts the inference agent from the wiki
   for the same class of reason (context hygiene is load-bearing).
2. Ungated presentation: the operator trusts (or rejects) drafts blind. The
   machinery to prove a draft exists and is not wired into presentation.
3. No institutional memory of REJECTED proposals: a rejected draft can be
   re-proposed next session (WikiSkill explicitly prevents this).

### Expected Behavior

1. **Cold-spawn proposer:** when the session-end review finds ≥1
   wiki-promoted pattern (FID-2026-0912-003), the Orchestrator spawns a
   dedicated Scribe drafting turn with `includeMessageHistory: false`,
   whose prompt contains ONLY: the wiki index + relevant pattern pages,
   the deduped trace rows behind the pattern, and the applicable skill
   inventory. Output: at most ONE proposal (create or patch, single skill,
   WikiSkill's atomic-proposal contract), via the existing `skill_manage`
   quarantine path.
   - Mode-split honored: the SUMMARIZING Scribe turn is untouched
     (session summaries keep history); only the DRAFTING turn is isolated.
2. **Gate-before-present:** at draft creation, the deterministic gate runs
   synchronously (schema/Levenshtein — already engine-enforced at patch;
   Law 13: no duplication); the async proof runs via the existing prove
   machinery with the WikiSkill-corrected criterion: accept ONLY on
   strict validation improvement AND no per-task regression (both pinned).
   The proof receipt records `{proposalSha, verdict, lift, perTask}`.
3. **Honest labels:** the quarantine rendering shows `[✓ PROVEN]` (receipt
   with pass verdict) or `[⚠ UNPROVEN — TRUSTING BLIND]` (no receipt /
   failed) per draft. Red/high-contrast per the blueprint's visibility
   rules.
4. **Rejected-proposal memory:** on operator rejection (or gate failure),
   the proposal summary lands in the wiki (`patterns/` evidence section on
   the owning page + an index line) — WikiSkill's skill-impact.md
   equivalent. Future proposers see what was already tried.

### Root Cause

The prove machinery was built (0824-016/-018) but never wired as a
presentation prerequisite; the isolation finding came from the 09-10
adversarial pass and was never implemented.

### Evidence

(see Environment — all file:line, this session)

## Impact Assessment

### Affected Components

- Orchestrator end-of-turn directive (spawn params for the drafting turn)
- `agents/` Scribe drafting prompt (isolated-input contract)
- `cli/src/commands/skills.ts` + quarantine rendering (PROVEN/UNPROVEN labels)
- `scripts/evolve-skills.ts` / prove path (receipt persistence + criterion)
- Wiki writer (FID-2026-0912-003 helpers) gains the rejected-proposal
  evidence section
- Suites: prompt-construction pins (no-history, bounded inputs), label
  pins (proven/unproven/failed), receipt schema pins, no-regression
  criterion pins

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: one new agent turn per qualifying session-end + label
      rendering; governance unchanged (operator-only trust preserved);
      mitigated by mode-split (summaries intact) and the deterministic gate
- [ ] Low

## Proposed Solution

### Approach

Sequence AFTER 2026-0912-003 (consumes its wiki). Two independent
sub-deliverables that can land separately if the operator prefers:
(A) isolation + labels (smaller), (B) the gated proof wiring (larger,
touches prove receipt persistence).

Deliberately NOT adopted (both sources + prior adversarial rulings):
separate optimizer model (single-model constraint), benchmark replay /
dream rollouts (synthetic experience), auto-adoption (operator-only trust),
`--auto-adopt` cron evolution (governance).

### Steps

1. [ ] **RED:** isolated-prompt pins (prompt contains wiki + traces +
       inventory, contains zero parent-conversation markers); one-proposal
       pin; label pins (all three states); receipt-schema pin;
       no-regression pin (a proposal with mean lift but one per-task
       regression is REJECTED); rejected-proposal wiki-append pin.
2. [ ] **GREEN:** drafting-turn spawn + prompt builder; label rendering;
       receipt persistence; criterion enforcement; wiki evidence append.
3. [ ] **VERIFY:** typecheck cli + common; suites; eslint; prettier;
       lint:md.
4. [ ] **LAW 4:** grep the label renderer's production caller; grep the
       receipt reader.

### Live Unknowns

- Whether the free-tier models draft usefully under isolation — live
  observable only; the gate makes a bad draft HARMLESS (labeled unproven,
  rolled back if trusted and erosion flags), so the risk of trying is
  bounded.
- The first live gate acceptance may take many sessions (WikiSkill's own
  reference run: every live gate so far was a rejection or no_action —
  an honest negative they document; Savant should expect the same and
  treat rejections as the system working).

## Verification Gates

- gate: typecheck common / cli
- gate: test cli skills suites + common skill-management + new pin suites
- gate: eslint --max-warnings 0 · prettier · lint:md

## Perfection Loop

### Missed Questions

1. *Does the isolated turn break session summaries?* — No: the mode-split
   (09-10 adversarial correction) is preserved — the SUMMARIZING Scribe
   turn keeps history; only the DRAFTING turn is cold-spawned. The
   blueprint's blanket-flag text is deliberately NOT followed.
2. *What stops the proposer from spamming drafts every session?* — It only
   runs when a pattern reaches the wiki (≥3 recurrences), and produces at
   most ONE atomic proposal; the agenda ≤50-line discipline caps input;
   the operator trust gate caps output effect.
3. *Why keep the prove machinery async rather than blocking the draft?*
   — The operator can still read and judge a draft while proof runs;
   the label makes the epistemic state honest either way. Blocking would
   hide operator-relevant work behind eval latency.
4. *Is per-task no-regression checkable with free-tier models?* — The
   criterion is enforced on the RECEIPT (evals workspace prove runs);
   model quality affects the lift numbers, not the check's existence.
   A harmful-but-mean-positive edit is still rejected mechanically.

### Code Verification Evidence

Planning-stage FID: implementation evidence lands here at GREEN. RED
evidence (this session): skills.ts:82 ("ADVISORY proof + erosion status")
and :111 (`/skills prove` usage) read; evolve-skills.ts:65-83
(erosion-blocked ingestion) read; repo-wide grep `includeMessageHistory`
in agents/ + spawn paths = zero matches; no rejected-proposal record
anywhere.

## Resolution

Open — awaiting operator approval to implement (Law 2). Sequenced after
0912-003 (consumes the wiki). Status stays `analyzed` until
implementation evidence exists.

### Loop 1 — Authoring (2026-09-12)

- Grounding: paper §3.2.2-3.2.4 + Algorithm 1 read from arXiv HTML;
  blueprint §2/§6 reconciled against the 09-10 adversarial corrections
  (mode-split, per-task no-regression, no EHEL Levenshtein duplication).
- GREEN: the mode-split decision is the load-bearing correction over the
  blueprint's blanket-flag text (blueprint §6 would break session
  summaries — caught by the prior session's review, honored here).
- CHANGE DELTA: initial authoring.

## Lessons Learned

(none yet)
