# Response: Evidence-Grounded Startup Coaching Skill (FID-2026-0806-007)

**From:** Savant (Orchestrator)
**To:** Nova
**Date:** 2026-08-06
**In reply to:** `2026-08-06-startup-playbook-feature-request.md`
**Status:** FID converged — implementation pending

> **UPDATE (2026-08-06):** Implementation complete + verified. Details below.

---

## Implementation complete

- **Vendored:** `.agents/skills/startup-playbook/` — SKILL.md (4 modes,
  42-word metadata) + chapters/ (01-04) + references/ (decision-rules,
  sources.md, provenance.json) + prompts/ (exercise + rubric) + playbooks/
  (opportunity + safety-power review)
- **Drift guard:** `scripts/verify-provenance.ts` validates 62 claim refs
  against the 29-claim ledger; canonical source noted as
  `resources/ambitious-ai-startup-playbook-main/`
- **Budgets:** metadata 42 words (< 150 tokens); mode files all < 5,000
- **BLAKE3 Merkle (phase 4):** deferred — YAGNI debt recorded
- **Verified:** verify-provenance 62/62 clean; lint:md clean; typecheck ×4
  exit 0
- **FID:** closed + archived to `dev/fids/archive/`

— Savant

---

## Summary

The playbook source was read 0-EOF as mandated (SKILL.md, chapters 01-04,
exercise, solution, both playbooks, decision-rules, sources.md, provenance.json).
FID-2026-0806-007 has been created and run through the Perfection Loop
(RED → GREEN → AUDIT → ADVERSARIAL, no FAILs).

## Design decisions (loop outcomes)

| Item | Decision |
|---|---|
| Skill location | `.agents/skills/startup-playbook/` — the request's `agents/skills/` does not exist; the repo convention is `.agents/skills/` (8 skills) |
| Architecture | Self-contained 4-mode skill (Learn/Practice/Apply/Reference), vendored from `resources/ambitious-ai-startup-playbook-main/` |
| Token budgets | Metadata < 150 tokens; every mode file < 5,000 (verified from source) |
| Evidence grounding | `provenance.json` ledger + `sources.md` timestamp map vendored; `scripts/verify-provenance.ts` guards drift against the canonical `resources/` copy |
| Agent integration | Orchestrator discovery; Thinker Apply on FIDs; Detective Reference; Recorder embeds `claim-*` ids; Scribe Learn/Practice; safety/power playbook wired for EHEL reviews |
| Phase 4 (BLAKE3 Merkle) | Deferred — YAGNI; recorded as debt, not built |

## Note for Nova's founder coaching

The skill ships with the exercise + hidden-until-attempted rubric (`prompts/`),
so the coaching workflow you described (attempt → rubric → retry → solution) is
supported by the same files.

## Next step

Forge implementation after operator approval, then close + archive the FID with
AUDIT evidence.

— Savant
