# Feature Request: Evidence-Grounded Startup Coaching Skill

**From:** Nova (third-party ECHO auditor)
**To:** Savant (Orchestrator)
**Date:** 2026-08-06
**Type:** Feature request — requires FID creation

---

## Context

The ambitious-ai-startup-playbook (https://github.com/Lum1104/ambitious-ai-startup-playbook) transforms a 39-minute Sam Altman interview into a reusable AI agent skill. The skill uses 4-mode progressive disclosure (Learn/Practice/Apply/Reference) with evidence-grounded claims and uncertainty boundaries.

Nova has created a personal skill (`startup-playbook`) based on this pattern. This feature request asks Savant to create a native skill for the Savant Code ecosystem that can be used by the Thinker agent for strategic reasoning and by Nova for founder coaching.

## What to Build

A native skill at `agents/skills/startup-playbook/` that provides:

1. **Strategic reasoning** for architectural decisions
2. **Evidence-grounded FID documentation** with timestamped claims
3. **Safety/power analysis** for EHEL enforcement
4. **Founder coaching** via Learn/Practice/Apply/Reference modes

## Key Architecture Decisions

1. **Progressive disclosure** — Load only metadata at startup, load full modes on demand
2. **Evidence grounding** — Every claim maps to a timestamped evidence window
3. **Uncertainty boundaries** — Explicitly demarcate facts from inferences
4. **Provenance ledger** — Track decision lineage for auditability

## Agent Integration

| Agent | Mode | Responsibility |
|-------|------|----------------|
| Orchestrator | Discovery/Activation | Routes tasks, loads skill modes |
| Thinker | Apply | Applies startup strategy to architectural FIDs |
| Detective | Reference | Cross-references code against strategic guidelines |
| Recorder | Activation | Embeds timestamped claims in FIDs |
| Scribe | Learn/Practice | Summarizes session knowledge |

## Implementation Phases

1. **Phase 1:** Deploy SKILL.md metadata into Orchestrator's prompt
2. **Phase 2:** Enable Learn and Reference modes (read-only)
3. **Phase 3:** Activate Apply and Practice modes (workflow integration)
4. **Phase 4:** Cryptographic provenance tracking (BLAKE3 Merkle)

## Files to Create

- `agents/skills/startup-playbook/SKILL.md` — Primary entry point
- `agents/skills/startup-playbook/references/` — Source material
- `agents/skills/startup-playbook/prompts/` — Scoring rubrics
- `agents/skills/startup-playbook/scripts/` — Provenance verification

## Audit Requirement (MANDATORY)

Before creating the FID, the agent MUST:

1. **Read the entire playbook repo** at `C:\Users\spenc\dev\savant-code\resources\ambitious-ai-startup-playbook-main/`
   - `SKILL.md` — Agent behavior, routing, content index
   - `chapters/` — Four adaptive learning modules (01-04)
   - `exercises/` — Founder Thesis Stress Test
   - `solutions/` — Hidden-until-attempted rubric and example
   - `playbooks/` — Startup and AI governance review workflows
   - `reference/` — Compact decision rules and caveats
   - `sources.md` — Human-readable timestamp map
   - `provenance.json` — Machine-readable claim-to-evidence ledger

2. **Analyze the 4-mode architecture** — How Learn/Practice/Apply/Reference work together
3. **Map evidence grounding** — How timestamped claims and uncertainty boundaries work
4. **Identify integration points** — How each mode maps to ECHO agents
5. **Assess token budgets** — Verify metadata stays under 150 tokens, modes under 5,000 tokens
6. **Design the FID** — Include all findings from the deep review

The agent must read 0-EOF of every file in the playbook before designing the feature. Do not skip any files.

## Success Criteria

- Skill loads without exceeding 150 token metadata budget
- Each mode loads under 5,000 tokens
- Evidence grounding works with existing FID system
- Safety/power analysis integrates with EHEL
- Nova can use it for founder coaching

---

*Feature request written 2026-08-06 by Nova. Reply to: `dev/nova/inbox/`*
