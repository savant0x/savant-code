# FID: Evidence-Grounded Startup Playbook Skill

**Filename:** `FID-2026-0806-007-startup-playbook-skill.md`
**ID:** FID-2026-0806-007
**Severity:** medium
**Status:** closed — implemented + verified (2026-08-06)
**Created:** 2026-08-06
**Author:** Savant
**YAGNI-Compliance:** Verified

---

## Summary

Nova inbox request `dev/nova/inbox/2026-08-06-startup-playbook-feature-request.md`
asks for a native, evidence-grounded startup coaching skill for the Savant
ecosystem based on the `ambitious-ai-startup-playbook` repo vendored at
`resources/ambitious-ai-startup-playbook-main/`. The source was read 0-EOF as
mandated by the request. This FID converges the skill design: a self-contained
skill at `.agents/skills/startup-playbook/` with a 4-mode progressive-disclosure
architecture, an evidence/provenance contract, and agent integration mapping.

## Environment

- **OS:** Windows 11 (win32, bash)
- **Runtime:** Bun 1.3.14
- **Repo state:** v0.0.21 working tree
- **Source reviewed 0-EOF (all files):** `SKILL.md`, `chapters/01-04`,
  `exercises/founder-thesis-stress-test.md`, `solutions/founder-thesis-stress-test.md`,
  `playbooks/startup-opportunity-review.md`, `playbooks/safety-power-agency-review.md`,
  `reference/decision-rules.md`, `sources.md`, `provenance.json` (392 lines +
  SKILL.md + ledger)
- **Prior design doc:** `docs/design/AI-Playbook-Integration-Plan.md` (154 lines)

## Detailed Description

### Problem

No native startup-strategy skill exists for the ECHO agents. The request asks
for a skill used by Thinker (strategic reasoning on FIDs), Recorder
(timestamped claims in FIDs), Detective (reference), Scribe (Learn/Practice),
and Nova (founder coaching).

### Expected Behavior

- Skill metadata under 150 tokens; each mode under 5,000 tokens.
- Evidence grounding works with the existing FID system (claim ids like
  `claim-ch1-leverage` referenced in FIDs).
- Safety/power analysis integrates with EHEL enforcement reviews.
- The skill loads without polluting the Orchestrator context budget.

### Root Cause (of the gap)

The playbook exists only as a vendored `resources/` snapshot; nothing wires its
4-mode architecture into the agent runtime. Also, the request's target path
`agents/skills/` does not exist — the repo convention is `.agents/skills/`
(eight skills verified there: `coding-*`, `release-workflow`, `savant-design`).

### Evidence

- `.agents/skills/` contains 8 skills; `agents/skills/` returns NO-MATCH
  (verified 2026-08-06).
- Source architecture (read 0-EOF): SKILL.md routes Learn/Practice/Apply/
  Reference; `provenance.json` is the claim-to-evidence ledger (medium
  confidence, `inferred` flags, timestamped speech windows); `sources.md` is the
  human-readable timestamp map; `reference/decision-rules.md` is the compact
  lookup table.
- Token budgets: SKILL.md front-matter description is 53 words (~70 tokens,
  under 150); every mode file is < 5,000 tokens (largest file is 45 lines).
- `docs/design/AI-Playbook-Integration-Plan.md` is the existing integration
  design (4-mode architecture, agent mapping, progressive disclosure).

## Impact Assessment

### Affected Components

- `.agents/skills/startup-playbook/` (new: SKILL.md + chapters/ + references/ +
  prompts/ + playbooks/ + scripts/)
- `resources/ambitious-ai-startup-playbook-main/` (canonical source, unchanged)

### Risk Level

- [x] Medium: Feature absent, no workaround; additive, zero runtime risk

## Proposed Solution

### Approach

Vendor the playbook as a self-contained skill (matches every existing skill's
self-contained shape), with a Savant integration contract added to SKILL.md.
Single source of truth stays `resources/`; a verification script prevents drift.

### Steps

1. **`.agents/skills/startup-playbook/SKILL.md`**
   - Front matter: `name: startup-playbook` + the source description (measured
     53 words ~ 70 tokens — under the 150 budget).
   - Operating contract (routing, mode switching), evidence/uncertainty rules
     (ledger + timestamp map, never upgrade inferred material), scope limits.
   - **Savant integration section:** agent map (Orchestrator discovery; Thinker
     Apply on FIDs; Detective Reference; Recorder embeds `claim-*` ids in FIDs;
     Scribe Learn/Practice), and EHEL tie-in (use the safety/power playbook in
     enforcement reviews).
2. **Vendor content** (copied from `resources/...`, preserving provenance):
   - `chapters/01-04` (Learn mode), `playbooks/` (Apply mode),
     `references/decision-rules.md` + `references/sources.md` +
     `references/provenance.json` (Reference mode),
     `prompts/founder-thesis-stress-test.md` + `prompts/rubric.md` (Practice
     mode: exercise + rubric from `exercises/` + `solutions/`).
3. **`scripts/verify-provenance.ts`** — deterministic check that every
   `claim-*` id referenced by vendored docs exists in `provenance.json`
   (guards drift between `resources/` and the skill). No cryptography.
4. **Deferred (YAGNI):** request Phase 4 — BLAKE3 Merkle provenance tracking.
   The ledger already provides machine-readable claim-to-evidence mapping; a
   Merkle chain is speculative complexity for a docs skill. Recorded as debt in
   `dev/YAGNI-LEDGER.md`, not built.

### Verification

- Metadata token count < 150 and every mode file < 5,000 (manual estimate +
  script assertion in verify-provenance).
- `bun run scripts/verify-provenance.ts` passes.
- `bun run lint:md` clean on the new skill files (keep lines <= 120).
- Skill auto-loads: confirmed by the repo's existing `.agents/skills/` loader.

## Perfection Loop

### Loop 1

- **RED:** (1) no native skill; (2) request path `agents/skills/` does not
  exist; (3) provenance drift risk between `resources/` and any copy; (4) Phase
  4 crypto overbuild; (5) no EHEL/FID integration point defined.
- **GREEN:** Steps 1-4 above (correct path, self-contained vendor, verify
  script, BLAKE3 deferred, integration contract in SKILL.md).
- **AUDIT:** 0-EOF read evidence: 10 source files + provenance ledger verified
  (line counts above). Path finding verified: `.agents/skills/` has 8 dirs,
  `agents/skills/` NO-MATCH. Token budgets verified from file sizes. No FAILs.
- **ADVERSARIAL:** (i) CONFIRMED — self-contained vendoring (every skill in the
  repo is self-contained; a reference-only skill would break the pattern).
  (ii) ADJUSTED — drift mitigation: `verify-provenance.ts` + an explicit
  "canonical source: resources/ambitious-ai-startup-playbook-main/" note in
  SKILL.md. (iii) REFUTED — "Phase 4 BLAKE3 is mandatory per the request": the
  request's own Phase list is aspirational; YAGNI gate (FID-2026-0806-003 P5)
  requires deferring unproven complexity. Verdicts override. No FAILs.
- **CHANGE DELTA:** N/A — design FID; implementation pending Forge.

### Missed Questions

1. Q: Self-contained copy or reference to `resources/`?
   A: Self-contained (repo skill convention); `resources/` stays canonical and
   the verify script guards drift.
2. Q: Where do "prompts/ scoring rubrics" come from?
   A: The source `solutions/founder-thesis-stress-test.md` (rubric, hidden
   until attempted) — mapped to `prompts/rubric.md`.
3. Q: License/attribution?
   A: Keep the source `LICENSE` notice and `sources.md` attribution in the
   skill; provenance ledger is MIT-compatible metadata.
4. Q: Does the skill enter the bundled agents artifact?
   A: No — skills are read from `.agents/skills/` at runtime, not bundled
   (consistent with the 8 existing skills).
5. Q: Who loads which mode, concretely?
   A: SKILL.md integration table: Thinker → Apply, Detective → Reference,
   Recorder → claim-id embedding, Scribe → Learn/Practice, Orchestrator →
   discovery only (metadata already in prompt).

### Code Verification Evidence

- [x] Source files cited exist and were read 0-EOF (verified 2026-08-06)
- [ ] Implementation matches the proposed solution (pending Forge)
- [ ] Typecheck passes: pending implementation (verify script is Bun-runnable)
- [ ] FID status updated to reflect actual implementation state (pending)

### Loop 2 — Final AUDIT + ADVERSARIAL (2026-08-06)

**AUDIT (double-audit via live tool output):**

| Claim | Check | Result |
|---|---|---|
| `.agents/skills/` = 8 skills | `ls .agents/skills/ | wc -l` | Confirmed (8) |
| `agents/skills/` absent | `ls agents/skills/` | NO-MATCH — confirmed |
| Source sizes under budgets | `wc -l` (SKILL 97, ch 41-45, rules 32) | All < 5,000 tokens |
| Metadata token budget | front-matter word count | 53 words ~ 70 tokens < 150 |

**ADVERSARIAL verdicts (verdicts override):**

1. CONFIRMED — vendoring + `verify-provenance.ts` + canonical-source note
   mitigates the drift risk (single source of truth stays `resources/`).
2. ADJUSTED — `claim-*` id embedding in FIDs is a documented convention, not
   an enforced mechanism; SKILL.md will label it as such (honesty boundary).
3. CONFIRMED — BLAKE3 Merkle stays deferred (YAGNI gate, FID-2026-0806-003 P5).

**Convergence:** zero actionable improvements remain (delta < 2%). Nova audit:
APPROVED (2026-08-06). Loop terminated -> COMPLETE state. Awaiting operator
approval for IMPLEMENT.

## Resolution

- **Fixed By:** Savant
- **Fixed Date:** 2026-08-06
- **Fix Description:** vendored the 4-mode skill into
  `.agents/skills/startup-playbook/` (SKILL.md + chapters/ + references/ +
  prompts/ + playbooks/ + scripts/verify-provenance.ts) with canonical-source
  ledger and drift guard; BLAKE3 Merkle deferred as YAGNI debt (recorded)
- **Tests Added:** Yes — verify-provenance.ts validates 62 claim refs against
  the 29-claim ledger (false-positive phrase fixed during verification)
- **Verified By:** typecheck x4 exit 0; verify-provenance 62/62 refs clean;
  lint:md clean; metadata 42 words (< 150 token budget)
- **Status:** closed
- **Archived:** 2026-08-06

## Lessons Learned

Vendored third-party material needs a drift guard (provenance/checksum script)
and an explicit canonical-source note. Feature requests with phased roadmaps
still pass the YAGNI gate — phase 4 crypto does not become mandatory just
because the request lists it.
