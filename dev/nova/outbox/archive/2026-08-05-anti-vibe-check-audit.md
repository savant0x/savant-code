<!-- markdownlint-disable MD013 -->

# Anti-Vibe-Check Deep Audit & Integration Analysis

**Date:** 2026-08-05
**Source:** https://github.com/NickyStaffs29/Anti-Vibe-Check
**Purpose:** Deep audit for absorption into Savant Code via ECHO Protocol

---

## System Overview

Anti-Vibe-Check is a 30-check security audit system for vibe-coded apps that verifies its own findings. It runs five
section auditors in parallel, then an adversarial verifier tries to refute every failure and re-audits every unevidenced
pass.

**Key Architecture:**

- 7 agents total: Manager, 5 Section Auditors, Verifier
- Read-only end-to-end — nothing can edit source
- Evidence rules: every PASS must cite code, every FAIL must cite file:line
- Fresh Verifier instance — never reused from audit phase
- Model tiers: Frontier orchestrator, cheap model at max reasoning for auditors, fresh frontier for verifier

---

## What Maps to ECHO Protocol

| Anti-Vibe-Check Concept | ECHO Equivalent | Gap |
|-------------------------|-----------------|-----|
| Manager agent | Orchestrator | ✅ Already implemented |
| 5 Section Auditors | Detective agent (RED phase) | ⚠️ Partial — Detective is single, not parallel |
| Adversarial Verifier | Verifier agent (AUDIT phase) | ⚠️ Partial — Verifier checks, but doesn't adversarially refute |
| Read-only audit | Verifier has zero write tools | ✅ Already implemented |
| Evidence rules (cite code) | ECHO Law 3 (Verify Before Proceed) | ⚠️ Partial — ECHO verifies but doesn't require cited evidence |
| Fresh Verifier instance | Cross-Agent Claim Rule | ⚠️ Partial — ECHO prevents attribution, but doesn't enforce fresh instance |
| NEEDS-REVIEW verdict | Graceful degradation (Law 14) | ⚠️ Partial — ECHO degrades but doesn't have explicit NEEDS-REVIEW |
| Model tiers | Not implemented | ❌ Missing — all agents use same model |

---

## The Key Feature to Absorb: Adversarial Self-Verification

**What Anti-Vibe-Check does:**
After the 5 section auditors complete, the Verifier:

1. Tries to **refute** every FAIL finding
2. **Re-audits** every PASS that didn't cite evidence
3. Questions assumptions the auditors made
4. Is a **fresh instance** — wasn't in the room when findings were formed

**Why this matters:**
A reviewer that inherits the auditor's framing just re-derives the auditor's conclusions. The adversarial pass is
explicitly designed to find what the auditors missed.

**How this maps to ECHO:**
Currently, the Verifier checks if the code is correct. The adversarial pass asks "did the Verifier miss anything?" This
is a meta-verification layer.

---

## Evidence Rules (Critical Insight)

Anti-Vibe-Check enforces strict evidence rules:

- Every **PASS** must cite the code that makes it pass — file, line, quoted
- Every **FAIL** must cite `file:line` with the offending code quoted
- **NEEDS-REVIEW** is the correct verdict when evidence is out of reach
- Config living in dashboards cannot be confirmed from code — comes back NEEDS-REVIEW

**Why this matters for ECHO:**
ECHO's Verifier checks if code compiles and tests pass. But it doesn't require cited evidence for every claim.
Anti-Vibe-Check's evidence rules prevent rubber-stamping.

---

## Model Tiering (Economic Insight)

Anti-Vibe-Check uses a tiered model approach:

- **Orchestrator:** Frontier model (Opus/gpt-5.6-sol) at high effort
- **Manager:** Frontier model at max effort
- **Section Auditors:** Cheap model (Sonnet/gpt-5.6-luna) at max effort
- **Verifier:** Fresh frontier instance at max effort

**Key insight:** "A cheap model at max reasoning substantially outperforms the same model at its default." Five parallel
auditors at max effort cost a fraction of one top-tier pass.

**For ECHO:** This suggests the Thinker agent could use a cheaper model at max reasoning, while the Verifier uses a
fresh frontier instance.

---

## Parallel Section Auditors

Anti-Vibe-Check runs 5 section auditors in parallel:

- S1: Secrets & Supply Chain (6 checks)
- S2: Access Control (7 checks)
- S3: Injection & Untrusted Input (5 checks)
- S4: Abuse & Money (4 checks)
- S5: Surface & Exposure (8 checks)

**Why parallel:** They're independent, so serializing them costs wall-clock and buys nothing.

**For ECHO:** The Detective agent currently runs sequentially. Could be parallelized into domain-specific auditors.

---

## What to Absorb into Savant Code

### Priority 1: Adversarial Verification Step

After the Verifier passes, add an adversarial verification step:

- Fresh agent instance (not the Verifier)
- Tries to refute every finding
- Re-audits every PASS that lacked cited evidence
- Questions assumptions
- Has zero write tools

### Priority 2: Evidence Rules

Enforce evidence rules in the Verifier:

- Every PASS must cite file:line with quoted code
- Every FAIL must cite file:line with quoted code
- NEEDS-REVIEW for out-of-reach evidence
- Prevent rubber-stamping

### Priority 3: Fresh Verifier Instance

Ensure the Verifier is always a fresh instance:

- Never reuse the agent that wrote the code
- Never reuse the agent that found the issues
- Fresh context = fresh perspective

### Priority 4: Model Tiering (Future)

Consider model tiering for cost optimization:

- Orchestrator: Frontier model
- Detective/Forge: Cheap model at max reasoning
- Verifier: Fresh frontier instance

---

## Agent Prompt for Implementation

See: `dev/nova/outbox/2026-08-05-anti-vibe-check-integration-prompt.md`
