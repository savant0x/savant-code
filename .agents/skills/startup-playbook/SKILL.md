---
name: startup-playbook
description: "Evidence-grounded founder operating system derived from Sam Altman's Startup School 2026 interview: use AI leverage to raise ambition, exploit fast technology shifts without abandoning business fundamentals, build evidence-updated conviction and compounding relationships, and evaluate safety, power, and human agency."
version: 0.1.0
---

# Ambitious AI Startups: Leverage, Conviction, and Distributed Power

<!-- echo-critical -->

> Canonical source: `resources/ambitious-ai-startup-playbook-main/`. This skill
> is a self-contained vendor of that snapshot (FID-2026-0806-007). Re-sync from
> the canonical source, then run `scripts/verify-provenance.ts` to confirm every
> `claim-*` reference still exists in `references/provenance.json`.

## Operating contract

Act as an evidence-grounded teacher and practitioner. Route each request to
Learn, Practice, Apply, or Reference; switch modes when the learner's need
changes. Load only the smallest relevant file; never treat the package as
knowledge beyond its stated scope. When ambiguous, begin in Learn mode with one
short diagnostic question.

## Modes

### Learn

1. Diagnose the learner's goal and prerequisite mastery one question at a time.
2. Choose the next lesson from `chapters/`; skip mastered material.
3. Teach one bounded concept with an explanation, a grounded demonstration, and
   its timestamped evidence (see `references/sources.md`).
4. Ask for retrieval or application before revealing the answer.

### Practice

1. Select an exercise from `prompts/founder-thesis-stress-test.md`.
2. Present the task and success criteria WITHOUT loading `prompts/rubric.md`.
3. Evaluate against the rubric after an attempt; distinguish conceptual errors
   from execution slips; cite course evidence.
4. Give the smallest useful hint, allow one retry, then reveal the rubric.

### Apply

1. Inspect the user's actual context, constraints, and desired outcome first.
2. Choose a playbook from `playbooks/`; map course assumptions to the situation
   and label unsupported adaptations as inferences.
3. Execute through observable checkpoints; report deviations from the method.
4. Verify the result and recover with grounded alternatives.

### Reference

1. Answer the precise question first, then load the indexed chapter or
   `references/decision-rules.md` to support it.
2. Preserve exact terminology and thresholds only when evidence supports them.
3. Cite source + timestamp for consequential claims (`references/sources.md`,
   `references/provenance.json`).

## Evidence and uncertainty

`references/provenance.json` is the claim ledger; `references/sources.md` is the
human-readable timestamp map. A visible-state claim requires visual
evidence; an action or transition requires ordered temporal evidence. Never
upgrade low-confidence or inferred material into authoritative instruction.
Distinguish: source claim / project fact / inference. If the package cannot
answer, state the missing evidence.

## Savant integration

| Agent | Mode | Responsibility |
|---|---|---|
| Orchestrator | Discovery | Routes tasks; metadata (this front matter) already in prompt |
| Thinker | Apply | Applies startup strategy to architectural FIDs (GREEN planning) |
| Detective | Reference | Cross-references decisions against decision-rules |
| Recorder | Activation | Embeds `claim-*` ids (convention, not enforced) in FIDs |
| Scribe | Learn/Practice | Summarizes session knowledge from the mode files |
| EHEL | Apply | Uses `playbooks/safety-power-agency-review.md` in enforcement reviews |

## Budgets

- Metadata (name + description): must stay under 150 words (currently ~53).
- Each mode file stays under 5,000 tokens.
- `scripts/verify-provenance.ts` enforces the claim ledger and the metadata
  budget; run it after any edit or re-sync.

## Attribution

Derived from "Sam Altman: Never a Better Time to Do a Startup"
(Y Combinator, YouTube). See `references/sources.md` for the timestamped
evidence map. The source LICENSE applies to the vendored material.
