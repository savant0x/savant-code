# Elephant-Goldfish Model Extraction Audit

**Target:** `resources/elephant-goldfish-model-main`

**Audit date:** 2026-11-02

**Purpose:** Identify EGM ideas that may improve Savant-Code after a separate
Perfection Loop, retrofit design, and production call-graph verification. This
report does not authorize implementation and does not treat EGM's documents or
test results as proof that a proposed harness feature is production-ready.

## Executive assessment

EGM is primarily a workflow and review system rather than an application runtime.
Its core idea is to separate deep-context design work (“Elephant”) from fresh,
zero-context critique (“Goldfish”), then keep the resulting design as an
artifact before implementation (`README.md:16-20`; `docs/designs/architecture.md:40-56`).
That maps directly to Savant's separation of duties, FID Perfection Loop,
Thinker, Verifier, Adversary, Recorder, and Scribe roles.

The highest-value extraction is not a second design workflow. It is a narrow
set of EGM invariants that can strengthen the existing harness: fresh-context
adversarial review, artifact-first delivery, semantic separation of architecture
from implementation, explicit reviewer status and convergence, design-to-code
drift detection, and behavior-level skill scenarios. EGM's plugin-specific
commands, prompt wording, marketplace packaging, and user-facing workflow
should not be copied directly.

## Evidence and verification boundary

- The source is a Python/documentation/plugin repository with seven skills,
  eight reviewer personas, document standards, packaging scripts, and unit and
  integration tests.
- Declared offline tests are `pytest tests/unit` (`TESTING.md:37-64`), with
  opt-in authenticated Claude and Codex integration suites
  (`TESTING.md:68-112`).
- The offline suite was run in this environment: **233 passed, 10 failed**.
  All ten failures were Windows symlink tests blocked by `WinError 1314`
  privilege requirements in `tests/unit/test_packaging.py:149` and `:310-340`.
  No full pass is claimed.
- EGM explicitly says reviews do not replace tests or human judgment
  (`README.md:84-95`) and its AI policy requires human review and verification
  (`AI_POLICY.md:1-13`). These constraints are compatible with Savant's
  evidence and operator-authority rules.
- The test record contains environment-specific and incomplete native evidence,
  including partial or unverified runs (`TESTING.md:122-163`). It is useful as
  a recording pattern, not as blanket support evidence.

## Candidate extraction register

### P1 — Fresh-context adversarial review as a first-class audit mode

**Prototype evidence:** EGM assigns the design author the full project context
and Goldfish reviewers only the document plus explicitly referenced source
material (`README.md:16-20`; `docs/designs/review.md:25-38`). The review stages
use separate comprehension, design-critic, structural, style, and readiness
personas (`docs/designs/review.md:64-100`).

**Why it fits:** Savant already has Verifier and Adversary roles, but EGM gives
a sharper contract for what an independent reviewer may know. This can reduce
confirmation bias and make “fresh review” evidence distinguishable from a
writer's self-assessment.

**Retrofit required:** Define how the harness supplies a bounded evidence pack
without leaking parent conversation, private memory, credentials, or unreviewed
claims. Preserve the existing Verifier zero-tool and Adversary override rules.
Do not treat fresh context alone as evidence; require cited source bytes and
actual gate output.

**Recommendation:** High-value FID candidate. Extend the current audit contract
rather than introducing a parallel reviewer roster.

### P1 — Artifact-first long-form workflow

**Prototype evidence:** EGM forbids dumping long proposals and review reports in
chat and requires workspace or side-panel artifacts with concise notifications
(`skills/egm-review/SKILL.md:30-43`). Its architecture treats drafts, review
reports, and specifications as persistent artifacts
(`docs/designs/architecture.md:51-56,163-177`).

**Why it fits:** Savant already has FIDs, session summaries, reports, skills,
agenda files, and durable evidence. A common artifact-first contract could keep
large evidence out of conversation context while preserving an auditable path.

**Retrofit required:** Reconcile artifact locations with canonical `dev/fids/`,
`docs/reports/`, `dev/session-summaries/`, quarantine skills, and the single-agent
scope register. Define retention, ownership, sensitive-data handling, and
whether an artifact is evidence, a draft, or an operator decision.

**Recommendation:** Extract the contract and classification rules, not the
EGM filenames or UI assumptions.

### P1 — Semantic split between feature architecture and implementation plan

**Prototype evidence:** EGM discovers a boundary between `FeatureRange` and
`DetailedRange` before review; its feature-spec mode can intentionally stop
before implementation readiness (`skills/egm-review/SKILL.md:146-189`). The
draft skill separates overview/goals, technical plan, alternatives, and detailed
implementation (`skills/egm-draft/SKILL.md:163-242`).

**Why it fits:** This complements ECHO's RED/GREEN/AUDIT loop by separating
architectural convergence from file-level execution. It could prevent a design
review from being distracted by premature code details while still requiring a
separate readiness gate.

**Retrofit required:** Map `FeatureRange`/`DetailedRange` to FID sections and
avoid creating a second lifecycle state machine. Define which questions must be
resolved before a FID can become `converged`, and which are implementation audit
questions.

**Recommendation:** Strong process extraction. Add as a FID template or review
contract only after checking existing FID templates and validators.

### P1 — Multi-stage review pipeline with explicit gates

**Prototype evidence:** EGM runs Zoom Out, Comprehension, Critic, Intermediate
Zoom Out, and Implementation Readiness in order
(`docs/designs/review.md:40-62`). The stages cover YAGNI, self-containment,
failure modes, post-critique pruning, exact files/signatures, and tests
(`docs/designs/review.md:64-100`).

**Why it fits:** This is close to ECHO's RED → GREEN → AUDIT → ADVERSARIAL →
COMPLETE flow and can provide review prompts that catch different failure modes
without mixing them into one generic pass.

**Retrofit required:** Preserve the ECHO FSM and authority model. Stages may
only produce evidence and recommendations; they cannot silently edit approved
scope, bypass FID convergence, or replace the operator's decision.

**Recommendation:** Extract the review lens matrix and stage-specific evidence
requirements, not an additional pipeline controller.

### P1 — Explicit convergence based on unsettled findings and reviewer status

**Prototype evidence:** The review loop distinguishes settled findings from
fixed findings, treats missing reviewer status as “not run,” requires two clean
rounds, and caps the loop at five rounds
(`skills/egm-review-loop/SKILL.md:151-179`). Its test scenarios pin these
behaviors (`skills/egm-review-loop/test_scenarios.yaml:31-53`).

**Why it fits:** ECHO already has convergence and circuit-breaker rules. EGM
offers a concrete way to prevent false convergence when a reviewer failed,
returned no report, or merely repeated a previously contested finding.

**Retrofit required:** Compare the semantics with ECHO's 10-iteration limit,
2%-change convergence, oscillation detection, and adversarial verdict. Define
one canonical status vocabulary; do not let “settled” become a silent scope
drop or substitute for operator-approved blocking.

**Recommendation:** High-value validator/test candidate. Add negative tests for
missing reviewer evidence and reintroduced findings.

### P2 — Design-to-code drift reporting

**Prototype evidence:** `egm-drift-report` reads each design, locates referenced
source, verifies current symbols and paths, and reports only missing features,
incomplete models, shortcuts, and architectural divergence
(`skills/egm-drift-report/SKILL.md:17-47`).

**Why it fits:** Savant has FIDs, design docs, generated protocol bundles,
tracking records, and call-graph reachability requirements. A focused drift
probe could detect when a converged plan no longer describes the code before
closure or during maintenance.

**Retrofit required:** Make code the ground truth for implementation status but
keep FID metadata as the audit record. Require exact source reads and grep
output, distinguish intentional evolution from drift, and never infer runtime
reachability from names alone.

**Recommendation:** Extract as an advisory or declared FID gate after a pilot
against one existing design/FID pair.

### P2 — Readiness standard with zero unresolved implementation choices

**Prototype evidence:** The readiness standard requires explicit target files,
actionable steps, rationale, and tests (`resources/document_standards/implementation-readiness-standard.md:1-34`).
The draft skill separately forbids implementation code in the design and
requires every touched file to be listed with rationale
(`skills/egm-draft/SKILL.md:215-242`).

**Why it fits:** This reinforces FID-Bound Execution and Law 1: an implementer
should not guess the architecture, target paths, schema, or edge-case policy.

**Retrofit required:** Avoid making the standard so rigid that small simple
tasks need heavyweight documents. Route by task complexity as ECHO already
does, and ensure the standard does not authorize writing before convergence.

**Recommendation:** Fold the checklist into the FID template/validator and
apply it to complex tasks only.

### P2 — Structured resolution taxonomy for review findings

**Prototype evidence:** `egm-resolve` classifies each finding as `CONTEST`,
`ESCALATE`, `PROPOSE FIX`, or `DECLINE`, requiring readable evidence for a
contest and preserving user triage (`skills/egm-resolve/SKILL.md:54-82`). It
then writes an annotated report before any proposed repair
(`skills/egm-resolve/SKILL.md:84-107`).

**Why it fits:** Savant needs a disciplined distinction between confirmed
defects, unverified claims, operator decisions, and accepted findings. This
could improve Verifier/Adversary reporting without allowing an agent to dismiss
scope silently.

**Retrofit required:** Translate categories into ECHO's lawful states:
completed or blocked pending an operator ruling. “Decline” and “settled” must
not become agent-side deferral. Require durable evidence for every disposition.

**Recommendation:** Extract the evidence taxonomy, but rename or constrain
statuses to the canonical ECHO vocabulary in a dedicated FID.

### P2 — Scenario-driven skill contract tests

**Prototype evidence:** EGM stores deterministic scenario fixtures for preset
ordering, stage bypass, undefined jargon, missing SLOs, vague tasks, style
violations, and comprehension behavior (`skills/egm-review/test_scenarios.yaml:15-125`).
The offline unit suite validates frontmatter, links, manifests, packaging, and
scenario coverage (`TESTING.md:37-64`).

**Why it fits:** Savant has skills, agent definitions, runtime gates, and tests
for protocol behavior. Scenario fixtures can express behavioral contracts that
ordinary unit tests cannot capture, especially tool-use ordering and forbidden
actions.

**Retrofit required:** Define a stable fixture schema, avoid tests that assert
model wording rather than behavior, keep secrets and account-bearing traces
out of fixtures, and run deterministic checks separately from live provider
gauntlets.

**Recommendation:** Extract the fixture pattern for skills and protocol gates;
pilot it on one existing skill before broad adoption.

### P3 — Recursive documentation/bootstrap with code-grounded contracts

**Prototype evidence:** `egm-bootstrap` builds bottom-up directory contracts,
uses a read-only explorer, cites symbols/invariants/side effects, verifies links,
and rereads every generated file (`skills/egm-bootstrap/SKILL.md:98-152,202-240,381-400`).
It also contains a mandatory approval gate for trees larger than 15 directories
(`skills/egm-bootstrap/SKILL.md:112-123`).

**Why it fits:** Savant has a large monorepo, architecture docs, generated
artifacts, and a recurring documentation-drift problem. The contract shape can
help agents navigate unfamiliar workspaces without inventing APIs.

**Retrofit required:** Never allow generated docs to overwrite human content
without a read/merge contract. Do not use unbounded subagent spawning; Savant
has explicit fan-out/depth limits. Ensure generated documents are excluded from
credential and attribution leakage.

**Recommendation:** Extract the code-grounded contract schema and final link
verification, not the unbounded orchestration behavior.

## Do not extract directly

1. **EGM's slash-command names and plugin manifests.** They are tied to
   Antigravity, Claude, Codex, and marketplace packaging (`README.md:22-48`;
   `plugin.json`). Savant has its own skill and agent registration model.
2. **The “no context” claim as an absolute.** Fresh reviewers still receive
   target documents and referenced source. Savant must explicitly define the
   evidence pack and prevent accidental parent-context leakage.
3. **EGM's authorship and human-name metadata.** The single-agent ECHO protocol
   forbids agent attribution in repository artifacts; extracted templates must
   omit author fields unless the product's own document policy requires them.
4. **Unbounded bootstrap fan-out.** EGM's bootstrap design permits unbounded
   workers after approval (`skills/egm-bootstrap/SKILL.md:166-198`), which
   conflicts with Savant's bounded subagent fan-out and depth controls.
5. **Automatic textual repair from review findings.** EGM permits approved
   fixes through `egm-resolve` (`skills/egm-resolve/SKILL.md:138-175`); Savant
   must still enforce read-0-EOF, present-before-act, FID convergence, and
   explicit operator rulings for blocked or dropped work.
6. **Live integration claims from the test table.** EGM's own testing guide
   records partial and unavailable native evidence (`TESTING.md:122-163`), so
   those rows cannot be imported as support guarantees.

## Proposed extraction order

1. **Fresh-context audit contract:** define bounded evidence, isolation, and
   citation requirements for Verifier and Adversary.
2. **FID semantic split and readiness checklist:** strengthen complex-task
   convergence without adding a second lifecycle.
3. **Finding taxonomy and convergence validator:** reconcile settled, blocked,
   contested, and missing-reviewer states with ECHO's canonical vocabulary.
4. **Design/code drift probe:** pilot on one existing FID and require exact
   call-graph evidence.
5. **Scenario fixtures:** add deterministic behavioral tests for one skill and
   one protocol gate.
6. **Code-grounded documentation contracts:** evaluate only after the above
   evidence surfaces are stable.

Every extraction candidate requires its own FID, RED evidence, sequential
thinking in GREEN, static and runtime AUDIT, production reachability grep, and
adversarial review. No item in this report authorizes source changes.

## Final disposition

EGM's strongest contribution to Savant is a disciplined way to separate design,
fresh review, resolution, implementation readiness, and drift monitoring. Most
of those responsibilities already exist in Savant under different names. The
correct retrofit path is to merge the evidence contracts and review lenses into
the current ECHO/FID system, not to import EGM as a parallel orchestrator.
