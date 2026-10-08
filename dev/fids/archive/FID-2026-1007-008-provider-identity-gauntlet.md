# FID: Evidence-calibrated provider identity gauntlet

**Filename:** `FID-2026-1007-008-provider-identity-gauntlet.md`
**ID:** FID-2026-1007-008
**Severity:** high
**Status:** closed
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
-  Source report: `docs/archive/reports/LLM API Fraud Detection Research.md`,
   parked out of the linted tree on 2026-10-07 and read in full the same day. It
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
- gate: test scripts/providers/__tests__/identity-gauntlet-invariants.test.ts
- gate: test scripts/providers/__tests__/identity-report.test.ts
- gate: test scripts/providers/__tests__/identity-matrix.test.ts
- gate: test packages/agent-runtime/src/__tests__/provider-identity-observation.test.ts
- gate: test scripts/providers/__tests__/quality-gauntlet.test.ts
- gate: typecheck packages/agent-runtime
- gate: probe scripts/scripts-typecheck-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:cad8743b74cffbf1c4155b7b180e1d7fc7cc32349945cefbdd2d439d06189131
- verified: 2026-10-08T01:13:34.471Z
- test scripts/providers/__tests__/identity-gauntlet.test.ts: exit 0
- test scripts/providers/__tests__/identity-gauntlet-invariants.test.ts: exit 0
- test scripts/providers/__tests__/identity-report.test.ts: exit 0
- test scripts/providers/__tests__/identity-matrix.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/provider-identity-observation.test.ts: exit 0
- test scripts/providers/__tests__/quality-gauntlet.test.ts: exit 0
- typecheck packages/agent-runtime: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- quality: exit 0

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

### Missed Questions

1. What is the exact claim? The route's model identity and service promises are separate; score them separately.
2.  Who supplies a trusted baseline? Use an independent same-version reference and a different-model control;
   otherwise inconclusive.
3.  What if the provider rotates? Bind each report to endpoint, requested/returned IDs, timestamp, and
   manifest version; re-test after a material change.
4.  Can this block user traffic? No. This operator audit produces evidence; any routing action needs a
   separate reviewed decision.

### Loop 4 — implementation, and what the pins forced

- **RED:** The declared gate list was not declarable. `typecheck root` is
  rejected by `scripts/fid-verify.ts` (`unsafe typecheck workspace "root" — not
  in VALIDATION_WORKSPACE_POLICY`); it becomes `typecheck packages/agent-runtime`
  plus the existing `probe scripts/scripts-typecheck-check.ts` for the `scripts`
  leg, and the split invariant file is declared so every promised test has its
  own gate. Every promise below has a pin rather than a claim.
- **GREEN:** Two halves, both committed. The passive seam
  (`packages/agent-runtime/src/provider-boundary/identity-observation.ts`, commit
  `7e661983`) records only what a completed call already returned and replays the
  newest dated verdict as advisory context. The active gauntlet
  (`scripts/providers/lib/identity-core.ts` + `identity-runner.ts` +
  `identity-gauntlet.ts`, commit `66abdcfa`) is a pure engine behind a thin
  transport, reachable as `bun run providers:identity`.
- **AUDIT:** The two test files read the engine's own sources and prove it cannot
  reach the network, spawn a process, read `process.env` or write a file, so
  "no additional request on the user path" is structural rather than reviewed.
  The capability runner stays independent — `quality-gauntlet.test.ts` still
  passes 6/6, so a task-success score cannot be mistaken for provenance.
- **ADVERSARIAL:** Three findings were produced by the pins rather than by
  reasoning. (1) The engine's first draft counted a control that FAILED as
  `separated` — six refused probes read as evidence of a different model. The
  pin caught it and a control with no completed sample is now `unavailable`,
  which forces `inconclusive`. (2) The '0.85 is not applied' pin failed against
  the modules' own comments, which document that they reject the threshold; the
  pin now strips comments before scanning code. (3) The CLI's first draft
  defaulted `--base-url` to a placeholder host, so a misconfigured run spent
  probes against a name nobody chose and could only ever be `inconclusive` for
  the wrong reason; the target is now explicit and required.
- **CHANGE DELTA:** Gate list corrected to declarable shapes; the engine's
  unavailable-control rule fixed; absent token usage reclassified from a
  tokenizer breach to `no-signal`; an explicit required `--base-url`.

### Loop 5 — the live leg, and the fourth defect it exposed

- **RED:** Operator authority for the live leg was granted on 2026-10-07, so
  step 7's re-audit ran against the real endpoints (target `hcnsec/kimi-k3` at
  `https://api.hcnsec.cn/v1`; independent same-model control `tokenbom/kimi-k3`
  and a different-model control `tokenbom/grok-4.6`).
- **The observation:** the target answered **HTTP 500** (`get_channel_failed` —
  no available channel for `kimi-k3` under group `auto`), and both controls
  answered **HTTP 402** (`insufficient_credits`, TokenBom balance 0.02 credits).
  The route is currently unserved and the controls are unfunded, so no identity
  signal exists to judge.
- **ADVERSARIAL:** The first run exposed a **fourth defect, and a worse one**.
  The transport recorded every error envelope as a *completed* sample with empty
  text; empty-vs-empty then hash-matched, so the report claimed both controls
  `matched` on a run where nothing succeeded — the exact false-positive this FID
  exists to prevent. Only the `--json` raw samples revealed it.
- **GREEN:** `createInvoker` now turns a non-2xx body (and a 2xx that carries no
  choices) into a `failure` sample — classes `http-<status>` and `no-content` —
  so a dead endpoint is recorded as absence, never as an empty answer. Three new
  transport pins stub `globalThis.fetch` and assert it; a dead endpoint can no
  longer read as a matched control.
- **CHANGE DELTA:** `scripts/providers/identity-gauntlet.ts` (+27 lines) and
  `identity-gauntlet-invariants.test.ts` (+71 lines); receipt re-stamped 7/7.
  The live verdict remains **inconclusive**, so the record stays open.
- **Incidental, and outside this cell:** checking whether the 500 was route-wide,
  a request for `glm-5.3-flash` (another HCNSec allowlist entry) returned
  **HTTP 200 with `"model": "longcat-2.5-preview-free"`** — a served model that
  is not the requested one. That is a `mismatch-requiring-review` for a
  *different* route, not evidence about `kimi-k3`, and per step 6 it needs its
  own reviewed decision; it is recorded here as an observation only.

### Loop 6 — the report, and the operator's ruling that closed it

- **RED:** The operator's requirement, verbatim: *"i wanted it to be a testing
  system that i could re-use moving forward, which would include a report. That's
  missing entirely."* A tool whose only output is a screen of text is not a
  testing system — a run cannot be re-read, compared across dates, or cited as
  dated evidence.
- **GREEN:** A new `scripts/providers/lib/identity-report.ts` renders a dated
  Markdown report and writes `identity-report.md` + `identity-report.json` at a
  stable, gitignored path (`dev/provider-identity/`, overridable with
  `--report-dir`), mirroring the existing `quality.json` / `report.md`
  convention and reusing the `assertWithinDev` write guard. Every run writes one
  and the CLI prints its path. The report carries the verdict, target, controls,
  budget, per-vector findings, every redacted observation with its failure class,
  the tested claims, and a "what this does not prove" section.
- **GREEN (structure):** the network transport moved out of the CLI into
  `scripts/providers/lib/identity-transport.ts`, keeping `identity-gauntlet.ts`
  at 218 lines and every touched file well under the 300-line ceiling.
- **AUDIT:** five new report pins prove the verdict/controls/negative bound are
  rendered, the exact command is recorded, no credential-shaped value reaches the
  report, both artifacts are written under `dev/`, and a path outside `dev/` is
  refused — 27 pass / 0 fail across the three suites. A real run wrote
  `dev/provider-identity/identity-report.md` and printed its path.
- **OPERATOR RULING (2026-10-07, verbatim):** *"the entire point of the gauntlet is
  so i could use it as an internal tool moving forward, not a one off case. The
  provider has stability issues i am fully aware of, hence why i wanted the
  gauntlet as well. It was supposed to be a tool i can use to test the model, not
  a fid to test one off."* The deliverable is the reusable tool; endpoint
  instability is the motivation for it, so step 7's single live leg is
  observational evidence rather than a closure blocker.
- **CHANGE DELTA:** report module + transport split + 5 pins.

### Loop 7 — the sweep, and a route is not a provider

- **RED:** The operator rejected the single-target run, verbatim: *"why does that
  gauntlet only test a single model and call it done? That's a one shot 'test', i
  wanted a gauntlet"*, *"testing a single model, saying it failed and then
  calling it done does not do 1/100th of what i need"*, and the decisive
  correction: *"just because one model is down, does not mean the entire provider
  is down. For example, i just tried glm 5.3 flash and it responded."*
- **GREEN:** `--all` sweeps every checked-in catalog route for a provider
  (`provider-models.ts` reads the registry entry's `modelsRef` and strips the
  routing prefix), `--models a,b,c` sweeps an explicit list, and `--deep` runs all
  five vectors per route instead of one handshake probe. `identity-matrix.ts`
  aggregates a per-model row, and the served `model` label the API returns is now
  a first-class signal (`classifyServedLabel`) — the check that catches a
  `glm-5.3-flash` → `longcat-2.5-preview-free` substitution the single-target run
  never surfaced.
- **AUDIT:** a live sweep of HCNSec read **7 routes — ok 1, failed 6** (per-route
  `http-500`/`http-503`/`error`) with `DeepSeek-V4-Flash` answering and serving
  `deepseek_for_coding`. The report states per route: status (ok / unavailable /
  failed), the failure class, the served label and its label verdict, probes
  completed and latency — and the provider is **not** reported as down, which is
  the correction the operator made.
- **ADVERSARIAL:** A `match` is not proof of identity (a proxy can echo a label),
  so it is a label check, never identity proof; a `mismatch` is flagged for
  review, never a fraud verdict. A route that is down is `failed`; a quota refusal
  is `unavailable` (funding — "top up"), and the two are deliberately distinct.
- **CHANGE DELTA:** new `identity-matrix.ts`, `identity-manifest.ts` and
  `provider-models.ts`; `--all`/`--models`/`--deep`; 5 sweep pins; the served-label
  signal. The record closes.

### Code Verification Evidence

- [x] Files referenced exist, verified by read:
      `packages/agent-runtime/src/provider-boundary/identity-observation.ts`,
      `packages/agent-runtime/src/__tests__/provider-identity-observation.test.ts`,
      `scripts/providers/lib/identity-core.ts`,
      `scripts/providers/lib/identity-runner.ts`,
      `scripts/providers/lib/identity-transport.ts`,
      `scripts/providers/lib/identity-manifest.ts`,
      `scripts/providers/lib/identity-matrix.ts`,
      `scripts/providers/lib/provider-models.ts`,
      `scripts/providers/lib/identity-report.ts`,
      `scripts/providers/identity-gauntlet.ts`,
      `scripts/providers/__tests__/identity-gauntlet.test.ts`,
      `scripts/providers/__tests__/identity-gauntlet-invariants.test.ts`,
      `scripts/providers/__tests__/identity-report.test.ts`,
      `scripts/providers/__tests__/identity-matrix.test.ts`,
      `package.json`
- [x] The failure output is pasted from the actual command, with its exit
      status: the non-declarable gate is the executor's own message, and the
      credential refusal prints
      `no credential for hcnsec: set HCNSEC_API_KEY or IDENTITY_API_KEY (nothing
      was sent)` at exit 1
- [x] The received value is traced rather than inferred: the control-bug pin
      failed `Expected: "unavailable" / Received: "separated"` against the
      engine's first draft, which is how the failure-to-signal confusion was
      found and fixed
- [x] Production call-graph evidence: the passive seam is imported by nothing on
      a user path yet — it is a new seam, and the record says so rather than
      implying adoption; the gauntlet's only network call is inside
      `createInvoker` in `scripts/providers/lib/identity-transport.ts`, and the
      invariant pin proves the two engine modules contain none
- [x] The report is a real artifact, not a claim: a live run wrote
      `dev/provider-identity/identity-report.md` and `.json` and printed the
      path; the pins assert the verdict, controls, command and the refusal to
      write outside `dev/`
- [x] The record's boundary is honoured and closed by the operator's ruling of
      2026-10-07 (Loop 6): the live leg ran (Loop 5) and is recorded as dated
      observational evidence — target `http-500`, controls `http-402`, verdict
      **inconclusive**, no identity claim about the route. The reusable tool is
      the deliverable, so the incomplete single-route verdict does not hold the
      record open, and no verdict was manufactured from an empty response
- [x] FID status reflects reality (`closed`): the tool is implemented, receipted,
      and produces the dated report the operator asked for

## Resolution

Closed 2026-10-07. The deliverable is a reusable, operator-run testing system —
not a one-off test of one model — per the operator's rulings in Loop 6 and
Loop 7.

**Delivered.** A passive observation seam
(`packages/agent-runtime/src/provider-boundary/identity-observation.ts`) that
records only what a completed call already returned and makes no request at all.
An operator-run gauntlet in two shapes: a single-target run (`--provider <slug>
--model <id> --base-url <url>`, optional same-model and different-model controls)
whose verdict requires both controls, and a **catalog sweep** (`--all`, or
`--models a,b,c`; `--deep` for all five vectors) that tests **every** route a
provider declares and reports each one separately. Its 0.85 auto-failover is
implemented nowhere. Every run writes a dated report under `dev/provider-identity/`
— `identity-report.md`/`.json` for one target, `identity-matrix.md`/`.json` for a
sweep — so runs are re-readable and comparable across dates. `identity-gauntlet.ts`
is a thin CLI over `lib/identity-core.ts`, `lib/identity-manifest.ts`,
`lib/identity-runner.ts`, `lib/identity-matrix.ts`, `lib/identity-transport.ts`,
`lib/identity-report.ts` and `lib/provider-models.ts`.

**A route is not a provider.** On 2026-10-07 HCNSec answered `glm-5.3-flash` with
200 while `kimi-k3` returned 500 in the same minute; a live sweep of the
seven-route catalog read **ok 1, failed 6** with `DeepSeek-V4-Flash` answering and
serving `deepseek_for_coding`. The sweep reports per route and never rolls a
single route's failure up to the host.

**Served-label signal.** The sweep's primary, control-free check compares the
`model` label the endpoint returns with the id requested (`classifyServedLabel`);
it is what exposes a substitution like the observed `glm-5.3-flash` →
`longcat-2.5-preview-free`. A `match` is not proof of identity (a proxy can echo a
label) and a `mismatch` is flagged for human review, never a fraud verdict.

**Live boundary (2026-10-07), recorded in
`docs/provider-identity-audit-2026-09-13.md` section 9:** the single-target control
run could not reach a verdict — the `kimi-k3` route answered `http-500` and both
TokenBom controls `http-402 insufficient_credits` — so that route is
**inconclusive** and nothing about its identity is claimed. The run also exposed a
transport defect (error envelopes counted as completed samples, so two dead
endpoints read as `matched`) fixed in commit `37d425be` with three pins; the
report and the sweep followed from the operator's requirement that the tool be
re-usable.

**Advisory, never automatic.** This tool never blocks a user call or changes
routing. The unrelated `glm-5.3-flash` substitution deserves its own record.

**Archived** to `dev/fids/archive/` with the receipt re-stamped at the archived
path.
