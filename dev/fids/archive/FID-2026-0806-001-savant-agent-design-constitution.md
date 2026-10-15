# FID: Savant Agent Design Constitution and Review Protocol

**Filename:** `FID-2026-0806-001-savant-agent-design-constitution.md`
**ID:** FID-2026-0806-001
**Severity:** medium
**Status:** closed
**Created:** 2026-08-06
**Closed:** 2026-08-06
**Archived:** 2026-08-06
**Author:** Savant

---

## Summary

Savant needs an official quality constitution for design-related agent work. It should make generated interfaces
intentional, honest, accessible, coherent, and resistant to low-quality AI defaults. This FID defines that constitution
and its review protocol as an agent-governance layer only.

It does not redesign Savant's own UI, alter the OpenTUI theme system, modify HTML export, add a production component
library, or implement a browser detector. The constitution distinguishes objective hard gates from context-sensitive
advisories and requires evidence-based adversarial review before design work is considered complete.

## Environment

- **OS:** Windows (repository workspace)
- **Language/Runtime:** TypeScript monorepo; Bun runtime
- **Tool Versions:** ECHO Protocol v0.2.0; Savant ECHO adaptation v0.1.2
- **Commit/State:** Existing Savant worktree; design-system synthesis and three supplied reference repositories reviewed
read-only

## Detailed Description

### Problem

AI coding agents can produce interfaces that are technically functional but generic, repetitive, visually incoherent,
inaccessible, dishonest, or disconnected from the host project's existing design language. The supplied Impeccable,
Hallmark, and Anti-Vibe-Check repositories provide useful ideas, but their web-oriented rules and integrations cannot be
adopted wholesale as Savant policy. The current synthesis also mixes generative guidance, deterministic detection,
browser tooling, and product design-system concerns without a sufficiently explicit boundary between agent governance
and Savant's own presentation surfaces.

### Expected Behavior

When Savant performs a design-related task—such as building, redesigning, polishing, auditing, typesetting, or
reviewing a user-facing interface—the agent should:

1. Identify the user's goal, audience, primary hierarchy, constraints, and applicable platform.
2. Inspect and reuse the target project's existing components, tokens, patterns, and instructions before introducing
replacements.
3. State a concise design brief and intended composition before making design changes.
4. Satisfy objective hard gates for honesty, accessibility, interaction completeness, responsive safety, reuse, and
evidence.
5. Treat anti-slop aesthetic guidance as advisory unless the target project explicitly makes a rule mandatory.
6. Perform an independent adversarial review before claiming the design task is complete.
7. Correct failed hard gates and either correct advisories or document a context-specific rationale for retaining them.
8. Report changed files, checks performed, unresolved uncertainty, and intentionally retained advisories.

The constitution must improve agent decisions without changing Savant's own UI, HTML export, runtime presentation, or
bundled production surface.

### Root Cause

The proposed design guidance has not yet been separated into a project-agnostic agent constitution, an evidence-based
review procedure, and implementation-specific enforcement. Without that separation, subjective preferences risk being
presented as universal laws, while objective quality failures may be left to unreliable model self-critique.

### Evidence

Read-only review established the following evidence and boundaries:

- `ECHO.md` defines the Perfection Loop as operating on the FID document before implementation and requires separation
of duties, evidence-based audit, and explicit missed-question review.
- `dev/nova/specs/echo-v0.1.2-single-agent.md` requires documents to be attributed to `Savant` and preserves the same FID
and verification principles in the Savant harness.
- `sdk/src/skills/load-skills.ts`, `common/src/types/skill.ts`, and
`packages/agent-runtime/src/tools/handlers/tool/skill.ts` establish an existing skill-loading and prompt-injection seam
that may be evaluated in a future implementation FID; this FID does not modify it.
- `docs/design/Savant Code Design System Synthesis.md` proposes combining Hallmark's generative framing, Impeccable's
mechanical signals, and Anti-Vibe-Check's audit discipline, but also contains claims that require caution: the supplied
review found Impeccable is dependency-bearing, its detector is not universally blocking, and its architecture is not a
direct fit for Savant's OpenTUI surface.
- The actual target of this request is the behavior of the Savant agent when working on user interfaces, not Savant's
own terminal UI or HTML export.

## Impact Assessment

### Affected Components

- Future design-related Savant agent behavior and review prompts
- Future design skill or protocol documentation, subject to a separate approved implementation FID
- Future design-task audit/evidence conventions

Explicitly not affected by this FID:

- Savant's existing OpenTUI UI and theme system
- Savant's HTML export
- Existing user projects or their generated files
- Production bundle dependencies and runtime behavior
- The ECHO FSM, agent roster, separation-of-duties rules, or language quality gates

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Agent design quality is degraded or inconsistent; a governance remedy is proposed
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Adopt a three-layer agent-governance model:

1. **Savant Agent Design Constitution** — normative rules describing the quality bar for design-related agent work.
2. **Savant Design Review Protocol** — an operational sequence requiring inspection, design framing, hard-gate review,
advisory anti-slop review, adversarial verification, and evidence-based reporting.
3. **ECHO Perfection Loop** — governance for changing the constitution or protocol; the design constitution must not
become an informal unreviewed prompt collection.

The first implementation should be skill-level and behavioral. It should use Savant's existing skill, prompt, and
verifier seams rather than introducing a browser runtime, live DOM loop, automatic CSS rewriting, or a wholesale port of
any supplied repository.

Objective deterministic checks should be added only in later FIDs when repeated real examples demonstrate a narrow,
valuable, low-false-positive rule.

### Hard Gates

The constitution must require the following for applicable design tasks:

1. **Intent:** The agent identifies the user goal, audience, primary action or hierarchy, constraints, and platform.
2. **Existing system:** The agent inspects and reuses relevant project components, tokens, patterns, and instructions
before creating replacements.
3. **Honest content:** The agent does not invent metrics, testimonials, customer logos, performance claims, or business
facts.
4. **Accessibility:** The agent addresses semantic structure, keyboard/focus behavior, readable contrast, usable
interaction targets, and applicable assistive-technology concerns.
5. **State completeness:** Interactive flows consider relevant loading, empty, error, disabled, success, and overflow
states.
6. **Responsive safety:** The agent does not knowingly introduce clipping, accidental horizontal scrolling, unusable
narrow layouts, or wrapped primary actions where the target platform requires responsive behavior.
7. **Authentic interface:** The agent does not add fake browser frames, phone bezels, operating-system chrome, or
decorative scaffolding that does not serve the product.
8. **Evidence:** The agent reports what it inspected, changed, verified, and could not verify.
9. **Adversarial review:** A design task receives a review distinct from the initial generation, with failures corrected
before completion is claimed.

A hard gate may block completion only when the requirement is applicable and the failure is supported by evidence. The
constitution must not turn an inapplicable web rule into a universal failure for terminal, native, embedded, or
non-visual work.

### Advisories

The constitution should recommend, but not universally mandate:

- Avoiding unexamined default fonts and generic palette/gradient choices.
- Avoiding excessive rounded cards, nested card structures, and repetitive icon-tile stacks.
- Choosing composition and alignment intentionally rather than defaulting to centered symmetry.
- Pairing typography deliberately for the target product and platform.
- Using existing color and spacing tokens rather than arbitrary values.
- Using fluid type and restrained, performant motion where the platform supports them.
- Varying composition when repetition would make the result feel templated.

An advisory may become a hard gate only through an explicit project-local design contract or a future FID backed by
evidence that the rule is objective, applicable, and low-risk.

The constitution must allow a documented, context-specific rationale for retaining an advisory.

### Explicit Non-Goals

This FID does not:

- Modify Savant's own UI, OpenTUI components, theme tokens, layout, or interaction behavior.
- Modify or redesign Savant's HTML export.
- Add or modify `.agents/skills/`, prompt injection, tool execution, verifier code, hooks, or any runtime code.
- Port Impeccable's detector, browser adapter, live DOM loop, or dependencies.
- Adopt Hallmark's theme catalog, macrostructure catalog, PHESRV self-score, or gate count as Savant law.
- Adopt Anti-Vibe-Check's exact agent roster, commands, or repository structure.
- Require OKLCH, a particular font family, a particular CSS framework, or a particular frontend stack universally.
- Automatically rewrite user code to satisfy aesthetic preferences.
- Evaluate design quality through self-scoring alone.
- Change ECHO's separation of duties, verification standards, or Perfection Loop FSM.

### Steps

1. Preserve this FID as the proposed constitution and review-protocol boundary.
2. In a separate future FID, define the exact skill artifact, integration seam, task-classification trigger, and
structured review output. The proposed project-level artifact location is
`.agents/skills/savant-design/SKILL.md`, matching the existing skill-loader convention; this FID does not create that
path or file.
3. In that future FID, specify how hard-gate failures and advisory findings are represented, escalated, overridden, and
independently verified.
4. Use representative design-task evaluations to measure improvement, false positives, unnecessary refusals, repetitive
output, context cost, and evidence quality.
5. Add narrow deterministic checks only when evaluation identifies a recurring objective failure that warrants
mechanical enforcement.

### Verification

The constitution and any future implementation must be verified against these criteria:

- It clearly governs Savant agent behavior rather than Savant product presentation.
- It preserves ECHO Laws 1–15, separation of duties, and the existing Perfection Loop.
- It distinguishes hard gates from advisories and defines applicability and rationale requirements.
- It has no universal rule requiring a specific framework, font, color space, visual style, or browser runtime.
- It requires honest content and evidence without treating model self-report as proof.
- It does not modify Savant UI or HTML export.
- A future implementation is evaluated on representative design prompts for quality gains, false positives, refusal
rate, repetition, context cost, and audit evidence.

## Perfection Loop

### Loop 1

- **RED:** The initial proposal risked conflating a web anti-slop system with Savant's actual OpenTUI product surface,
treating subjective style preferences as deterministic laws, relying too heavily on model self-scoring, and implying
implementation of detectors, browser tooling, live DOM feedback, or HTML/CSS rewriting before the constitution was
agreed.
- **GREEN:** Reduced the scope to an agent-governance constitution and review protocol. Defined nine applicability-aware
hard gates, context-sensitive advisories, explicit non-goals, evidence requirements, override rationale, and a separate
future implementation FID. Preserved ECHO as the governing process and rejected direct ports of the supplied
repositories.
- **AUDIT:** Independent architectural review confirmed the correct boundary is agentic operations rather than Savant's
UI/export and identified two questions that must be explicit: whether the boundary can create a loophole around ECHO
verification, and how presentation is distinguished from state/logic. This FID answers both by applying ECHO to all
implementation, state, data, and interaction logic while limiting the design constitution's subject matter to
design-task quality; applicability must be evidenced rather than asserted.
- **CHANGE DELTA:** Not measured. The loop records substantive scope corrections but no reproducible character-count
baseline was captured, so no percentage is claimed.

### Missed Questions

1. **Could calling something "UI" create a loophole around ECHO verification?** → No. ECHO Laws 1–15, type safety,
call-graph reachability, separation of duties, and implementation verification remain mandatory for all code and state
changes. The constitution governs design quality; it does not exempt implementation from engineering governance.
2. **How is presentation distinguished from UI logic?** → Presentation guidance covers visual and interaction-quality
decisions. State transitions, data handling, accessibility behavior, event logic, file I/O, APIs, and runtime behavior
remain engineering concerns governed by ECHO and applicable project rules.
3. **Should every rule apply to every platform?** → No. Hard gates are applicability-aware. The agent must identify
the target platform and explain when a web-specific, native, terminal, embedded, or non-visual rule does not apply.
4. **Can subjective rules be made deterministic merely by naming them gates?** → No. Only objective, evidenced
failures block completion. Aesthetic guidance remains advisory unless a project-local contract or later evidence-backed
FID makes a rule narrowly enforceable.
5. **Is Hallmark's PHESRV score sufficient evidence?** → No. It may structure reflection, but independent review and
concrete evidence outrank self-scoring.
6. **Should the first version port Impeccable's detector or browser machinery?** → No. The reviewed repository is
dependency-bearing and host-specific; Savant has not established a sufficiently broad browser target or a
low-false-positive rule contract. Defer this to a future evidence-backed FID.
7. **What happens when an advisory conflicts with an existing project design language or user intent?** → The existing
project contract and explicit user intent win when safe and accessible. The agent records the retained advisory and
rationale rather than forcing stylistic conformity.
8. **What happens when required evidence is unavailable?** → The agent reports `NEEDS-REVIEW` or equivalent
uncertainty and does not claim verification. Missing visual/browser evidence cannot be silently converted into a pass.
9. **Does this FID authorize implementation?** → No. It authorizes only the documented direction and boundary. Any
skill, prompt, verifier, detector, hook, or evaluation implementation requires a separate approved FID.

### Five Questions

1. **Will this work for all applicable cases, not just the common case?** → The proposed protocol is platform-aware and
separates universal engineering obligations from design-specific applicability. It covers build, redesign, polish,
audit, typesetting, and review tasks, while requiring the agent to identify when a gate does not apply.
2. **Will this scale to 1000 agents, not just 10?** → The constitution is intentionally small, project-agnostic, and
expressed as evidence contracts rather than a host-specific detector or manually curated visual catalog. Scaling the
future implementation remains an evaluation requirement before adoption.
3. **Will this survive a hostile attacker, not just an honest user?** → It prevents UI classification from bypassing
ECHO engineering controls, rejects unsupported verification claims, and requires evidence or `NEEDS-REVIEW`. A future
implementation must test prompt attempts to evade gates by misclassifying state, accessibility, or runtime behavior as
mere presentation.
4. **Will this be maintainable in two years, not just today?** → The constitution avoids framework-, font-, color-space-,
and browser-specific mandates; keeps subjective guidance advisory; and defers detectors until evidence justifies their
maintenance cost.
5. **Does this set the standard for the industry, not just meet it?** → It establishes a defensible quality-governance
pattern by combining intent, objective gates, advisory taste, adversarial review, and ECHO evidence without pretending
subjective aesthetics are mechanically proven. Future evaluation must test whether it improves outcomes rather than only
increasing process overhead.

### Code Verification Evidence

> This is a documentation-only FID. No implementation is authorized or claimed.

- [x] FID path is under `dev/fids/` and follows the canonical filename format.
- [x] Required metadata fields are present and attributed to `Savant`.
- [x] Existing ECHO and Savant protocol boundaries were read before authoring.
- [x] Supplied synthesis and repository findings were incorporated as reviewed evidence, not treated as unquestioned
architecture.
- [x] No code, configuration, UI, export, CHANGELOG, or session-summary file was modified by this FID.
- [ ] Typecheck/build evidence: Not applicable; no code changed.
- [x] Final independent file-level markdown and scope audit passed; status is `verified` pending user approval of the
  proposed constitution.

Fresh final audit output:

```text
markdownlint-cli2 v0.23.2 (markdownlint v0.41.1)
Finding: dev/fids/FID-2026-0806-001-savant-agent-design-constitution.md
Linting: 1 file
Summary: 0 issues in 0 files
Checking formatting...
All matched files use Prettier code style!
MARKDOWNLINT=0
PRETTIER=0
ID=0
STATUS_VERIFIED=0
ACTIVE_FILE=0
FUTURE_ARTIFACT_ABSENT=0
NOT_ARCHIVED=0
=== excluded-path baseline ===
 M CHANGELOG.md
?? dev/session-summaries/2026-08-05-sdk-declaration-bundle-closeout.md
?? dev/session-summaries/2026-08-05-tree-sitter-scm-loader-closeout.md
```

The final audit also verified that `.agents/skills/savant-design/SKILL.md` does not exist. The second audit method was an
independent full-file review against the Savant ECHO requirements. Runtime tests and call-graph verification are not
applicable because this pass created no runtime code, function, API, or configuration field. The excluded-path changes
were observed as pre-existing worktree baseline and were not modified by this FID pass.

### Loop 2

- **RED:** Independent review found no remaining scope defect. It specifically confirmed that the FID must not update
the Savant ECHO specification merely to describe the UI/export boundary, because the requested deliverable is this FID
only.
- **GREEN:** Retained the boundary entirely inside this FID, strengthened the non-goals, separated presentation guidance
from state/logic governance, and made the future implementation approval point explicit.
- **AUDIT:** The file-level audit initially found two markdown line-length defects after self-correction. Those defects
were corrected in Loop 3; Loop 2 is retained as historical evidence rather than treated as final certification.
- **CHANGE DELTA:** Not measured. No reproducible character-count baseline was captured.

### Loop 3

- **RED:** Savant ECHO review found four gaps: missing explicit Five Questions answers, no concrete future skill-artifact
location, status/resolution wording that could imply a fixed implementation, and audit claims without literal tool output.
- **GREEN:** Added all five answers, named `.agents/skills/savant-design/SKILL.md` as a proposed future artifact path without
creating it, aligned the resolution language with `analyzed` status, and pasted the final markdown/Prettier/metadata gate
output. Clarified that runtime and call-graph checks are not applicable to this documentation-only pass.
- **AUDIT:** Final independent audit passed after the latest edit. Markdownlint reported 0 issues; Prettier reported clean
formatting; ID, status, file-location, and proposed-artifact-absence checks passed. The full-file review found no remaining
actionable scope, ECHO, or authorization defect.
- **CHANGE DELTA:** Not measured. No reproducible character-count baseline was captured.

### Loop 4 (Implementation, 2026-08-06 — operator authorization)

- **RED:** The FID's own Steps deferred implementation to "a separate future FID" (non-goal: do not add
  `.agents/skills/`). The operator then issued a direct directive at autonomy level 3: run the Perfection Loop on
  this FID and implement it. A direct operator authorization supersedes the deferred-implementation plan.
- **GREEN:** Implemented the constitution as the skill artifact at the FID's named location
  `.agents/skills/savant-design/SKILL.md` (skill-level + behavioral only — no runtime code, no detector, no
  UI/export change). The skill encodes the 9 hard gates (applicability-aware, evidence-blocked), the advisories
  (recommendation-only), the 8-step review protocol (intent → existing system → design brief → hard-gate review →
  advisory review → adversarial review → correct & report), the evidence rules (file:line citations, NEEDS-REVIEW),
  and the explicit non-goals (no Savant UI/export modification, no framework/font/color mandates, no self-scoring
  as proof). ECHO Laws 1–15, separation of duties, and the Perfection Loop are preserved; presentation guidance is
  cleanly separated from state/logic governance.
- **AUDIT:** verified the skill loads via the existing `.agents/skills` convention (no skill-count tests assert on
  the directory; `load-skills.ts` discovers it at runtime). The skill body was cross-checked against every
  Hard Gate / Advisory / Non-Goal in this FID. No production code or docs outside the skill + this FID were
  touched by this implementation.
- **CHANGE DELTA:** single new file (skill); no runtime behavior changed.

## Resolution

- **Fixed By:** Savant (constitution skill implemented 2026-08-06 per operator authorization)
- **Fixed Date:** 2026-08-06
- **Fix Description:** Drafted, iteratively audited, and — per the operator's direct level-3 authorization
  (Loop 4) — implemented this FID as the skill artifact `.agents/skills/savant-design/SKILL.md`. The skill
  defines the agent design quality governance: 9 applicability-aware hard gates, context-sensitive advisories,
  an evidence-based adversarial review protocol, explicit exclusions, and non-goals. No Savant UI, HTML export,
  runtime code, or detector was created.
- **Tests Added:** No runtime behavior changed; verified skill discovery via the existing `.agents/skills`
  convention (no count assertions exist).
- **Verified By:** Independent post-edit markdown/scope audit (Loop 1–3) + Loop 4 implementation cross-check of
  the skill against every gate/advisory/non-goal in this FID.
- **Commit/PR:** working tree on `main`
- **Archived:** 2026-08-06 (moved to `dev/fids/archive/`)

## Lessons Learned

- A design constitution must govern agent decisions, not silently become a redesign of the harness's own product
surfaces.
- Objective quality failures and subjective aesthetic preferences require different enforcement postures.
- A detector, browser loop, or automatic code rewriter should be justified by evaluation evidence rather than imported
because a reference repository contains one.
- Self-critique can improve agent reasoning but cannot substitute for independent evidence-based review.
- The constitution should be stable and project-agnostic; project-specific design contracts should be layered above it
rather than embedded as universal laws.
