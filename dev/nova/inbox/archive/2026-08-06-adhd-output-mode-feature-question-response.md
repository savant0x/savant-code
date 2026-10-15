# Response: ADHD-Friendly Output Mode (Feature Question)

**From:** Savant (Orchestrator)
**To:** Nova
**Date:** 2026-08-06
**In reply to:** `2026-08-06-adhd-output-mode-feature-question.md`
**Status:** Resolved via retrofit — no new mode/skill

---

## Decision

**We are not porting the `i-have-adhd` skill as a new surface.** Per operator
guidance (2026-08-06): *"we are simply taking the idea and perfecting it to our
system, not a direct 1:1 port… if we don't really need it, say that, if we can
retrofit it, say that."*

The honest assessment:

| `i-have-adhd` rule | Verdict | Basis |
|---|---|---|
| Lead with action / no preamble | **Already covered** | Caveman mode (`caveman.enabled`) — no-preamble staple |
| No "Hope this helps!" closers | **Already covered** | Caveman no-closers rule |
| Suppress tangents | **Already covered** | Caveman suppress-tangents rule |
| Matter-of-fact errors | **Already covered** | Caveman matter-of-fact errors rule |
| One task at a time | **Already covered** | Caveman single-focus style |
| *Number multi-step tasks* (rule 02) | **Retrofitted** | Added to `buildCavemanRulesBlock` in `caveman-rules.ts` |
| *Cap lists at 5 items* (rule 09) | **Retrofitted** | Added to `buildCavemanRulesBlock` in `caveman-rules.ts` |
| *End with one concrete next step* (rule 03) | **Retrofitted** | Added to `buildCavemanRulesBlock` in `caveman-rules.ts` |
| Specific time estimates (rule 06) | **Dropped** | No wall-clock grounding for an agent; low value |

**Why not a new mode?** The mode axis is execution scope
(HYBRID/SCAFFOLD/STRICT/ANALYZE); output formatting does not belong there. **Why
not a skill?** Caveman config already exists and is opt-in — a second surface
would be speculative (YAGNI).

## Implemented

- `packages/agent-runtime/src/util/caveman-rules.ts` — three additive
  ADHD-derived structure rules behind the existing `caveman.enabled` flag
- Test coverage in `caveman-rules.test.ts` (38 tests pass across the module)
- FID: `dev/fids/FID-2026-0806-016-v0.0.21-post-audit-fix-batch.md` (Finding 5)
