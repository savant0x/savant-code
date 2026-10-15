<!-- markdownlint-disable MD013 -->

# Anti-Vibe-Check Integration Prompt for Savant Agent

**Date:** 2026-08-05
**Source:** Nova (third-party audit)
**Purpose:** Review Anti-Vibe-Check system and absorb adversarial verification into ECHO Protocol

---

## Context

You are reviewing the Anti-Vibe-Check system (https://github.com/NickyStaffs29/Anti-Vibe-Check) for integration into
Savant Code via ECHO Protocol.

Anti-Vibe-Check is a 30-check security audit system that verifies its own findings. Five section auditors run in
parallel, then an adversarial verifier tries to refute every failure and re-audits every unevidenced pass.

**Reference files:**

- Audit: `dev/nova/outbox/2026-08-05-anti-vibe-check-audit.md`
- Source (local): `resources/Anti-Vibe-Check-main/`
- Source (GitHub): https://github.com/NickyStaffs29/Anti-Vibe-Check
- Checklist: `resources/Anti-Vibe-Check-main/reference/checklist.md`

---

## Your Task

1. **Read the Anti-Vibe-Check system** — Understand the architecture, agent hierarchy, evidence rules, and adversarial
1. verification
2. **Compare to ECHO Protocol** — Map Anti-Vibe-Check concepts to existing ECHO agents and laws
3. **Identify gaps** — What does Anti-Vibe-Check do that ECHO doesn't?
4. **Propose integration** — How to absorb the adversarial verification concept into ECHO
5. **Create FID** — Write a FID for the integration

---

## Key Concepts to Absorb

### 1. Adversarial Self-Verification

After the Verifier passes, run an adversarial verification step:

- Fresh agent instance (not the Verifier, not the Detective)
- Tries to **refute** every FAIL finding
- **Re-audits** every PASS that lacked cited evidence
- Questions assumptions the auditors made
- Has zero write tools

**Why this matters:** A reviewer that inherits the auditor's framing just re-derives the auditor's conclusions. The
adversarial pass is explicitly designed to find what the auditors missed.

### 2. Evidence Rules

Enforce strict evidence rules in the Verifier:

- Every **PASS** must cite file:line with quoted code
- Every **FAIL** must cite file:line with quoted code
- **NEEDS-REVIEW** for out-of-reach evidence (dashboard config, etc.)
- Prevent rubber-stamping

**Why this matters:** Without evidence rules, the Verifier can claim "tests pass" without showing the test output.
Evidence rules force proof.

### 3. Fresh Verifier Instance

Ensure the Verifier is always a fresh instance:

- Never reuse the agent that wrote the code (Forge)
- Never reuse the agent that found the issues (Detective)
- Fresh context = fresh perspective

**Why this matters:** An agent that was in the room when the code was written has context bias. A fresh agent sees the
code cold.

### 4. Model Tiering (Future Consideration)

Consider model tiering for cost optimization:

- **Orchestrator:** Frontier model (current behavior)
- **Detective/Forge:** Cheap model at max reasoning
- **Verifier:** Fresh frontier instance at max effort

**Why this matters:** "A cheap model at max reasoning substantially outperforms the same model at its default." Five
parallel auditors at max effort cost a fraction of one top-tier pass.

---

## Proposed ECHO Integration

### New Agent: Adversary

**Phase:** POST-AUDIT
**Role:** Adversarial verification of the Verifier's findings

**Capabilities:**

- Read-only access
- Run tests
- Check call-graph reachability
- Cannot write code
- Fresh instance (never reused)

**Behavior:**

1. Receive Verifier's findings
2. Try to refute every FAIL finding
3. Re-audit every PASS that lacked cited evidence
4. Question assumptions
5. Report findings to Orchestrator

### Updated Verifier Behavior

**Add evidence rules:**

- Every PASS must cite file:line with quoted code
- Every FAIL must cite file:line with quoted code
- NEEDS-REVIEW for out-of-reach evidence

### Updated Perfection Loop

```text
RED → GREEN → AUDIT → ADVERSARIAL → SELF-CORRECT → COMPLETE
  ↑                                              |
  └──────────────────────────────────────────────┘
```text

The ADVERSARIAL state runs after AUDIT and before SELF-CORRECT. If the Adversary finds issues, they feed back into
SELF-CORRECT.

---

## FID Template

Create a FID following the standard format:

```text

# FID-YYYY-MMDD-NNN: Adversarial Verification for ECHO Protocol

## Metadata

- **ID:** FID-YYYY-MMDD-NNN
- **Severity:** high
- **Status:** created
- **Created:** YYYY-MM-DD
- **Author:** [Agent name]

## Problem Statement

[What's missing and why]

## Evidence

[File paths, line numbers, grep output]

## Root Cause Analysis

[Why the problem exists]

## Proposed Solution

[What to change — Adversary agent, evidence rules, updated Perfection Loop]

## Verification

[How to verify the fix works]

## FID History

- YYYY-MM-DD HH:MM — Status: created — Initial draft

```text

---

## Success Criteria

1. Adversary agent defined with restricted tools
2. Evidence rules added to Verifier
3. Updated Perfection Loop FSM diagram
4. FID created and converged
5. Tests pass (typecheck × 4, ESLint, lint:md)
6. Nova audit pass

---

## Constraints

- Follow ECHO Protocol v0.2.0
- Do not modify existing agents (Detective, Forge, Verifier) — add new ones
- Maintain backward compatibility
- All changes must go through the Perfection Loop
- Evidence must be cited in FID (file:line, grep output)