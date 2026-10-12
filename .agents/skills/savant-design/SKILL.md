---
name: savant-design
description: Savant Agent Design Constitution — hard gates, advisories, and evidence-based adversarial review for design-related agent work (interfaces, UI polish, typesetting, audits). Agent governance only; does not alter Savant's own UI or HTML export.
version: 0.1.0
---

# Savant Agent Design Constitution

<!-- FID-2026-0806-001 — agent-governance layer for design-related work. Load this
skill when the task is design-related: building, redesigning, polishing,
auditing, typesetting, or reviewing a user-facing interface. -->

## Scope

This constitution governs **agent decisions on design tasks**. It does NOT govern
or modify Savant's own OpenTUI UI, theme system, or HTML export, and it never
overrides ECHO Laws 1–15, separation of duties, the Perfection Loop FSM, or the
engineering quality gates. State transitions, data handling, accessibility
behavior, event logic, file I/O, APIs, and runtime behavior remain engineering
concerns governed by ECHO and the project's own rules.

Hard gates are applicability-aware: identify the target platform (web, native,
terminal, embedded, non-visual) and explain when a gate does not apply. Never
turn an inapplicable web rule into a universal failure for a non-web surface.

## Review Protocol (apply for every applicable design task)

1. **Intent.** Identify the user's goal, audience, primary action or hierarchy,
   constraints, and applicable platform.
2. **Existing system.** Inspect and reuse the target project's existing
   components, tokens, patterns, and instructions before introducing
   replacements. Prefer reuse over new construction (ECHO Law 7).
3. **Design brief.** State a concise design brief and intended composition
   before making design changes (ECHO Law 2 — present before act).
4. **Hard-gate review.** Check every applicable hard gate below; a failure
   blocks completion only when the gate is applicable and the failure is
   supported by evidence.
5. **Advisory review.** Review the anti-slop advisories; treat them as
   recommendations unless the project-local contract makes one mandatory.
6. **Adversarial review.** Run a review distinct from the initial generation —
   re-read the changed code cold, attempt to refute each claimed PASS/FAIL,
   and resolve every `file:line` citation. Adversarial findings are corrected
   before completion is claimed.
7. **Correct & report.** Correct failed hard gates; either correct advisories
   or document a context-specific rationale for retaining them. Report changed
   files, checks performed, unresolved uncertainty (`NEEDS-REVIEW`), and
   intentionally retained advisories.

## Hard Gates

A hard gate may block completion only when it is **applicable** and the failure
is **supported by evidence**.

1. **Intent** — goal, audience, primary hierarchy, constraints, and platform are
   identified before design work.
2. **Existing system** — relevant project components, tokens, patterns, and
   instructions are inspected and reused before replacements are created.
3. **Honest content** — no invented metrics, testimonials, customer logos,
   performance claims, or business facts. If content is not provided or
   verifiable, do not fabricate it.
4. **Accessibility** — semantic structure, keyboard/focus behavior, readable
   contrast, usable interaction targets, and applicable assistive-technology
   concerns are addressed.
5. **State completeness** — interactive flows consider the relevant loading,
   empty, error, disabled, success, and overflow states.
6. **Responsive safety** — no knowingly introduced clipping, accidental
   horizontal scrolling, unusable narrow layouts, or wrapped primary actions
   where the target platform requires responsive behavior.
7. **Authentic interface** — no fake browser frames, phone bezels, OS chrome,
   or decorative scaffolding that does not serve the product.
8. **Evidence** — report what was inspected, changed, verified, and could not
   be verified. Every PASS/FAIL cites `file:line` with quoted code; out-of-reach
   evidence is `NEEDS-REVIEW`, never silently converted to a pass.
9. **Adversarial review** — the design task received a review distinct from the
   initial generation, with failures corrected before completion was claimed.

## Advisories

Recommend, but do not universally mandate:

- Avoiding unexamined default fonts and generic palette/gradient choices.
- Avoiding excessive rounded cards, nested card structures, and repetitive
  icon-tile stacks.
- Choosing composition and alignment intentionally rather than defaulting to
  centered symmetry.
- Pairing typography deliberately for the target product and platform.
- Using existing color and spacing tokens rather than arbitrary values.
- Using fluid type and restrained, performant motion where the platform
  supports them.
- Varying composition when repetition would make the result feel templated.

An advisory may become a hard gate only through an explicit project-local
design contract or a future evidence-backed FID. A documented, context-specific
rationale may justify retaining an advisory; the rationale must be reported.

## Non-Goals (this skill does not)

- Modify Savant's own UI, OpenTUI components, theme tokens, or HTML export.
- Port external detectors, browser adapters, live DOM loops, or their
  dependencies.
- Mandate a specific framework, font family, color space, CSS system, or
  visual style universally.
- Rewrite user code automatically to satisfy aesthetic preferences.
- Evaluate design quality through self-scoring alone — evidence and
  independent review outrank self-assessment.
