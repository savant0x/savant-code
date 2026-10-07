# FID: Evidence-calibrated provider identity gauntlet

**Filename:** `FID-2026-1007-008-provider-identity-gauntlet.md`
**ID:** FID-2026-1007-008
**Severity:** high
**Status:** converged
**Created:** 2026-10-07
**Automation level:** 2
**YAGNI-Compliance:** Verified

---

## Summary

The HCNSec `kimi-k3` picker entry has a partial identity audit: its served model label and bilingual
self-identification were recorded, but its fingerprint timed out. Build a lightweight, embedded identity and
service-integrity gauntlet with bounded operator-approved active probes before deciding whether this entry is
verified. Keep the existing capability-quality score separate. An unavailable endpoint or weak signal yields
**inconclusive**, never a fraud accusation or automatic block.

## Environment and ground truth

- Windows workspace, Bun TypeScript monorepo; current tree includes other active work.
-  Source report: `dev/build-orders/LLM API Fraud Detection Research.md`, read in full on 2026-10-07. It
  proposes tokenizer, behavioral, context, and throughput probes plus an automatic 0.85 quarantine threshold.
  These are hypotheses to test, not proven local acceptance criteria.
-  `docs/provider-identity-audit-2026-09-13.md:79` records `hcnsec/kimi-k3` with a `moonshotai/kimi-k3` served
  label and matching EN/ZH self-identification, but fingerprint `(timeout)`. Section 7.1 calls this Tier 2,
  with context not cleared. This is a gap, not evidence that HCNSec served a substitute.
-  `scripts/providers/quality-gauntlet.ts:136` and `scripts/providers/lib/quality-core.ts` implement an
  operator-run eight-prompt capability check over harvested candidates. It does not establish model provenance
  or promised context. The seven-entry HCNSec picker allowlist lives in
  `common/src/constants/model-config/gateway-catalogs.ts`.
-  Research calibration: *One Token Is Enough* reports a 7.3% equal error rate even with 40 probe cells;
  *AdaptPrint* reports 80.6% top-1 attribution over 27 candidates. Neither supports a deterministic fraud
  verdict from one probe. Primary sources: <https://arxiv.org/abs/2607.10252>,
  <https://arxiv.org/abs/2608.22213>.
-  Operator addendum: `Model Identity Verification Gauntlet Technical Specification` (2026-10-07) asks for
  vectors A-E, handshake/periodic/onboarding tiers, and a 0.85 failover threshold. The referenced [ToseaAI
  implementation](https://github.com/ToseaAI/llm-fingerprint-detector) is a single-token JSD library and CLI
  using about 100-400 completions. Its own README warns that prompt drift, stale references, and serving
  changes can cause mismatch and that one verdict is evidence rather than proof. It has no bundled `kimi-k3`
  reference (its sample list includes Kimi K2), so it cannot clear this route by itself.

## Problem and expected behavior

The current audit cannot answer whether the **specific** HCNSec `kimi-k3` route consistently serves the
expected model and usable context. The existing quality runner's score could be mistaken for identity proof.
Operators need a repeatable, bounded comparison against known controls with raw observations, uncertainty, and
a decision that says exactly which claim was tested.

## Proposed solution

1.  Add a small identity-observation seam to the production routing harness and an identity/service-integrity
   mode to the existing `scripts/providers/` operator workflow. The embedded seam records already-returned
   route/model/usage metadata and exposes the latest dated verdict as advisory context before coding-task
   delegation; it does not add a network call to the user's critical path. The active mode reuses request,
   credential, timeout, and report patterns. Target an explicit host, requested model ID, base URL, and run
   time; never probe all models implicitly. Keep quality scores and identity findings in separately named
   fields/artifacts.
2.  Define a versioned probe manifest and budget before live calls. Record exact request body, response
   headers/IDs and usage metadata where available, normalized text hashes, latency, token cost, target route,
   probe version, and failure class; redact credentials and sensitive headers. Bound attempts, tokens, time,
   and spend. No unapproved background or startup execution.
3.  Implement the addendum's five vectors as separately reported evidence. **A tokenizer/byte behavior:**
   compare valid Unicode/multilingual usage against official tokenizers and matched controls; JSON cannot
   carry arbitrary malformed UTF-8, so document that limit. **B prompt/delimiter behavior:** use controlled
   canaries and harmless delimiter strings; never seek, print, or persist a real hidden system prompt. **C
   constraints:** score deterministic output requirements against controls, without equating failure to
   quantization. **D refusal/alignment:** use benign, versioned tasks and report distributional observations
   without nationality or family stereotypes. **E telemetry/context:** measure timing as operational data and
   repeated positional context retrieval as a service claim. Account for chat templates, hidden prompts, proxy
   billing overhead, and load variance; none of these vectors alone proves weight identity or precision.
4.  Use repeated behavioral/JSD probes with a first-party or independently trusted same-model control where
   available and a known different-model control. Match settings and prompt version; track within-control
   variance. Evaluate whether the ToseaAI library can be reused without importing its thresholds as local
   truth. The target is `hcnsec/kimi-k3`; the prior TokenBom `kimi-k3` success is a useful positive comparator
   only after route independence and model-version equivalence are established. If controls are unavailable,
   mark identity attribution inconclusive.
5.  Run a tiered lifecycle: passive metadata on every completed call; a bounded **Tier 1** active check on
   explicit onboarding/handshake consent, asynchronous to user requests; **Tier 2** behavioral/constraint
   checks on an opt-in schedule with quota cap; **Tier 3** deep context checks only on onboarding or operator
   request. The first user request always proceeds even if all tiers are stale or inconclusive. No hidden
   recurring spend.
6.  Emit `verified for tested claims`, `mismatch requiring review`, or `inconclusive`, each with
   claim-specific evidence and confidence bounds. A composite 0-1 score may be displayed only after local
   calibration, with each component and missing-data treatment visible. Calibrate any numeric decision
   threshold on held-out positive/negative controls and document false-positive/false-negative rates before
   use. Do not use the addendum's unvalidated 0.85 threshold. Alerts may be advisory; no automatic quarantine,
   failover, catalog removal, or user-call blocking. A confirmed mismatch triggers human review and a separate
   FID for any routing change.
7.  Re-audit HCNSec `kimi-k3` with the new manifest and record the dated result in the provider identity
   audit. Live endpoint calls require the operator's credential/quota authority and are a named gate; if
   unavailable, report **inconclusive** and keep the FID open. The offline implementation and tests can
   proceed independently.

## Verification plan and gates

-  Add deterministic fixture tests in `scripts/providers/__tests__/identity-gauntlet.test.ts` covering
  matching/mismatching/inconclusive controls, timeout, missing usage, tokenization overhead, false-positive
  restraint, budget exhaustion, redaction, composite score calibration, and no route mutation. Run from the
  repo root because this suite is in `scripts/`.
-  Add `packages/agent-runtime/src/__tests__/provider-identity-observation.test.ts` for passive route
  metadata, stale verdicts, no additional request on the user path, and advisory-only warning behavior.
- Run existing `scripts/providers/__tests__/quality-gauntlet.test.ts` to confirm capability scoring remains independent.
-  Run `bun run typecheck`, `bun x eslint . --max-warnings 0`, `bun run lint:md`, and the FID verification
  command after implementation. Record exact exit output and production call-graph evidence. Run
  the bounded live HCNSec audit only when the operator has supplied appropriate credentials and spend
  authority; attach its raw redacted evidence and exact limitations.

## Verification Gates

- gate: test scripts/providers/__tests__/identity-gauntlet.test.ts
- gate: test packages/agent-runtime/src/__tests__/provider-identity-observation.test.ts
- gate: test scripts/providers/__tests__/quality-gauntlet.test.ts
- gate: typecheck root
- gate: quality

## Perfection Loop

### Loop 1 — RED, GREEN, AUDIT, ADVERSARIAL

-  **RED:** Audit cell timed out; the quality runner checks task success rather than identity; research text
  and operator addendum call tokenizer counts and delimiter reactions deterministic proof and propose
  uncalibrated 0.85 auto-failover.
-  **GREEN:** Specified separate identity claims, controls, bounded probes, calibrated conclusions, and
  explicit live authority.
-  **AUDIT:** Source evidence above identifies the precise incomplete HCNSec cell and current runner. No live
  verification is claimed.
-  **ADVERSARIAL:** A proxy can alter usage counts or hidden prompts; random sampling varies; capability loss
  may have many causes. Each is treated as uncertainty requiring controls rather than an identity verdict.
- **CHANGE DELTA:** Initial design; correction of source report's binary-proof and quarantine claims incorporated.

### Loop 2 — independent challenge and correction

-  **RED:** TokenBom passing cannot validate HCNSec by itself; a failed context needle may be model error;
  latency cannot reveal hardware.
-  **GREEN:** Require independent route/version controls, positional repetition, distinct rejection/loss/miss
  outcomes, and diagnostic-only latency.
- **AUDIT:** Acceptance and verdict rules above now express those distinctions; no unknown threshold is implied.
-  **ADVERSARIAL:** A sophisticated proxy can mimic tested behavior. Verdict is limited to tested claims and
  date, not cryptographic weight attestation.
- **CHANGE DELTA:** Material correction to controls and claim scope.

### Loop 3 — final convergence

- **RED:** A live credential, stable reference endpoint, or allowed budget may be absent.
-  **GREEN:** Offline work is fully specified; live result remains inconclusive until authorized and observed.
  The embedded seam is passive and any active schedule is opt-in. No catalog consequence is automatic.
- **AUDIT:** Every promised test has a declared gate; final status is pre-implementation `converged`.
-  **ADVERSARIAL:** No FID closure or verified identity can be inferred from this plan. A later audit must
  cite real gate and live evidence.
- **CHANGE DELTA:** Final wording and gate alignment only.

### Missed questions

1. What is the exact claim? The route's model identity and service promises are separate; score them separately.
2.  Who supplies a trusted baseline? Use an independent same-version reference and a different-model control;
   otherwise inconclusive.
3.  What if the provider rotates? Bind each report to endpoint, requested/returned IDs, timestamp, and
   manifest version; re-test after a material change.
4.  Can this block user traffic? No. This operator audit produces evidence; any routing action needs a
   separate reviewed decision.

## Resolution

Open. No code has been written for this FID and no live HCNSec identity verdict is asserted.
