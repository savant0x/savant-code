<!-- markdownlint-disable MD013 MD003 MD041 MD040 -->

---

title: Savant Design-System Library (DESIGN.md Retrofit)
date: 2026-08-11
author: Nova
status: planning
requested_by: Spencer
consumed_by: harness model (designs FIDs) — FreeBuff executes
source_research: docs/design/DESIGN.md Savant Retrofit Plan.md; dev/nova/scratchpad/2026-08-11-designmd-deep-research-prompt.md; live verification (74 VoltAgent systems staged)
fids_emitted: []
---

# Build Order: Savant Design-System Library (DESIGN.md Retrofit)

**Date:** 2026-08-11
**Requested by:** Spencer
**Author:** Nova
**Status:** PLANNING — research complete, data staged, awaiting operator approval to enter Phase 1

---

## 1. Overview

This build order retrofits the DESIGN.md ecosystem into Savant Code as an **embedded, curated, mechanically-enforced design-system library**. The goal: when an agent builds anything visual, it grounds on a vetted design contract *offline*, with mechanical gates (not prompt trust) enforcing token compliance — the same way ECHO enforces code quality, applied to design.

**Core concept:** Download/curate external DESIGN.md files → run each through the ECHO Perfection Loop (RED → GREEN → AUDIT → ADVERSARIAL) → embed as a pre-loaded internal library in the harness protocol bundle. We adapt the *concept*, not the external website or its MCP server.

**Non-negotiable constraints (Savant engineering philosophy):**

- **Zero external runtime dependency.** Design systems embedded and function fully offline. No live-fetch from any designmd server at agent runtime.
- **Mechanical enforcement over prompt trust.** Design-compliance checks are runnable gates that fail the build — not instructions the model can ignore.
- **FID-bound, Perfection-Loop-audited.** Every design system in the library passes RED → GREEN → AUDIT → ADVERSARIAL before it ships.
- **Local-first, BYOK, no telemetry leaving the machine.**
- **Savant branding only.** Adapted examples are Savant artifacts — no third-party branding in Savant docs or bundles.
- **ECHO is non-negotiable.** No feature bypasses any of the 15 laws. Design contracts become a *bundle artifact* the agent reads at boot — Law 1 grounding, NOT a Law 1 rewording.
- **Implementation executed by FreeBuff.** Nova authors the FIDs/build order; FreeBuff runs the loop. Single-agent mode: NO signature/attribution fields (branding defense).

---

## 2. Research Foundation

| Source | Purpose |
|--------|---------|
| `docs/design/DESIGN.md Savant Retrofit Plan.md` | Gemini Deep Research: ecosystem map, format spec, tooling gap, licensing, architecture proposal, 4 FID skeleton |
| `dev/nova/scratchpad/2026-08-11-designmd-deep-research-prompt.md` | The self-contained Deep Research prompt that generated the above |
| Live verification (Nova, this session) | 19 designmd.ai MIT systems downloaded + 74 VoltAgent awesome-design-md brand systems cloned; format confirmed mixed (64 YAML / 10 plain markdown); licensing MIT at source |

**Key findings from live verification (corrects the research doc):**

1. **Format is NOT uniformly YAML.** 64/74 staged files have YAML frontmatter; 10 are plain markdown (`## Colors` narrative prose). Parser must handle both.
2. **Key-name variance within `colors:`** across brands (NVIDIA `on-primary` vs Apple `primary-focus` vs raycast's Chinese `属于` key). Requires a unified canonical token vocabulary.
3. **The designmd.ai "Command Center" is a different system** (light-mode SOC, orange accent by frknaykc) — not our cyberpunk one. Namespaced correctly in staging.
4. **VoltAgent awesome-design-md:** 147 brand folders, 73 are stubs (redirect to getdesign.md), 74 have full content. Only the 74 real ones were staged. MIT licensed at source.
5. **Gemini doc errors flagged:** "strict YAML frontmatter" overstated; VoltAgent star count contradictory (35k vs 107k); "styling not copyrightable" is legal opinion not law → licensing is a human-gate item, not a green light.

---

## 3. Staged Data (current state)

`packages/design-systems/library/` — **74 brand design systems**, 2.3M total, MIT-licensed at source.

- 64 with YAML frontmatter, 10 plain markdown
- Brands include: apple, nvidia, stripe, vercel, linear, tesla, ferrari, bmw, airbnb, coinbase, meta, shopify, slack, spotify, kraken, lamborghini, mastercard, starbucks, theverge, and 56 more
- Source repo: `resources/awesome-design-md/` (VoltAgent, MIT)

This folder is **raw staging**. It is not compliant, not normalized, not trademark-scrubbed. The Perfection Loop transforms it.

---

## 4. Phased Build Order

### Phase 1 — Canonical Schema & Normalization (the foundation)

**Goal:** Every staged system converted to one canonical YAML schema. This is the executing agent's first loop target.

> **No trademark scrub required.** Source is MIT (VoltAgent/awesome-design-md) — free reign, no attribution or notice mandated. VoltAgent does not own the underlying brand design tokens (functional CSS values, not copyrightable). DESIGN.md is Google's open industry standard, not VoltAgent's property. Brand names in the reference files are USEFUL context (agent picks "the Stripe-like system" for a fintech UI) — keep them. Do NOT rename files or scrub brands.

| FID | Title | Scope | Depends On | Acceptance Gates |
|-----|-------|-------|-----------|------------------|
| **FID-001** | Canonical DESIGN.md Schema & Normalizer | Define the unified token vocabulary (`primary`, `on-primary`, `surface`, `background`, `text`, `text-muted`, `success`, `warning`, `error`, `info`, `border`, `radius`, `spacing`, `typography`). Write a TypeScript normalizer that detects frontmatter-vs-plain, extracts tokens from both, maps brand-idiosyncratic keys to canonical, flags non-English/unmappable keys for human review, and emits standardized `.design.md` with a Savant compliance header (optional provenance note: "source: VoltAgent/awesome-design-md (MIT)"). | — | All 74 parse to canonical YAML. Zero `属于`-class non-English keys remain. Normalizer handles both formats. Compliance header present on every file. Brand names retained. |
| **FID-002** | WCAG Contrast Verification | Automated check: every color pair (text-on-background, text-on-surface, semantic-on-surface) meets WCAG AA (4.5:1 body, 3:1 large). Flag failures, auto-repair where mathematically possible (adjust lightness), human-review irreducible failures. | FID-001 | All 74 pass WCAG AA. Failures documented or repaired. Contrast report generated per system. |

### Phase 2 — Harness Integration (make it loadable)

**Goal:** Curated systems embed in the protocol bundle and ground at agent boot.

| FID | Title | Scope | Depends On | Acceptance Gates |
|-----|-------|-------|-----------|------------------|
| **FID-004** | Bundle Integration & Config Key | Augment `generate-protocol-bundle.ts` to parse the curated library, emit a typed `SAVANT_DESIGN_LIBRARY` constant, and append the active system's markdown to the boot context. Add `design_system` key to `protocol.config.yaml` (exactly one string per project; array or omission = fatal boot error). | FID-001, 002, 003 | Orchestrator boot loads selected system into RunState. CI drift-check fails build if `protocol-bundle.generated.ts` is stale. `design_system` array throws fatal error. |
| **FID-005** | Boot Grounding (Law 1 Artifact) | Design contract becomes part of the grounding set the agent reads at boot (like ECHO.md) — NOT a Law 1 rewording. System prompt instructs Thinker to base visual reasoning on injected contract. | FID-004 | Agent reads design tokens before any visual `write_file`. No ECHO law text modified. |

### Phase 3 — Mechanical Enforcement (the Slopscan gate)

**Goal:** Hardcoded visual values are blocked at the tool-executor, not trusted to the model.

| FID | Title | Scope | Depends On | Acceptance Gates |
|-----|-------|-------|-----------|------------------|
| **FID-006** | Slopscan EHEL Module | Extend tool-executor + EHEL to intercept UI file writes (`write_file`, `str_replace`, `apply_patch` on `.tsx/.jsx/.html/.css`). Use `packages/code-map` (tree-sitter) to AST-scan for hardcoded hex/inline styles. Cross-reference against active system's canonical tokens. Block violations with terminal EHEL error → forces SELF-CORRECT. | FID-004 | Hardcoded `color: #FF00FF` blocked. Authorized token class (`text-hot-magenta`) passes. Block triggers SELF-CORRECT FSM. |
| **FID-007** | Oscillation Guard | If Slopscan blocks >3 consecutive times for one token, auto-escalate: return exact mapped token string required (e.g. `Required: text-neon-cyan`) to break the loop and force convergence. | FID-006 | 4th block provides exact token. Agent converges. |

### Phase 4 — Curation Pipeline & First Consumer

**Goal:** Automate ingestion of new external systems; ship the Command Center on the library.

| FID | Title | Scope | Depends On | Acceptance Gates |
|-----|-------|-------|-----------|------------------|
| **FID-008** | Automated Curation CLI | `bun run curate-design <url/path>` — orchestrates headless Perfection Loop (RED→GREEN→AUDIT→ADVERSARIAL) for external DESIGN.md files. Integrates FID-001 normalizer, FID-002 scrub, FID-003 WCAG. Output: compliant Savant artifact admitted to library. | FID-001, 002, 003 | Pipeline ingests a flawed external file, identifies missing tokens, scrubs trademark, outputs compliant artifact. WCAG failures repaired in SELF-CORRECT. |
| **FID-009** | Command Center Cyberpunk System | Author our cyberpunk DESIGN.md (`#050508` void, `#00FBFF` cyan, `#FF00FF` magenta, `#FFB000` amber) as the first Savant-native system. Run it through the full loop. First consumer of the library. | FID-004, 006 | Cyberpunk system passes @google/design.md lint, WCAG AA, Slopscan. Command Center dashboard consumes its tokens. |
| **FID-010** | CLI/TUI Component Retrofit | Refactor existing OpenTUI + React CLI components to consume Command Center tokens mathematically. Eliminate legacy hardcoded hex. | FID-009, 006 | All CLI UI uses mapped tokens. Zero visual regression across theme toggles. |

---

## 5. Dependency Graph

```text
FID-001 (schema+normalizer)
   ├──> FID-002 (trademark scrub)      ─┐
   ├──> FID-003 (WCAG verify)         ─┤──> FID-004 (bundle integration)
   └──> FID-005 (boot grounding) is separate, depends on FID-004
                                         │
FID-004 ──> FID-005 (boot grounding)
FID-004 ──> FID-006 (slopscan) ──> FID-007 (oscillation guard)
FID-001/002 ──> FID-008 (curation CLI)
FID-004 + FID-006 ──> FID-009 (cyberpunk system) ──> FID-010 (CLI retrofit)
```

**Implementation sequence:** 001 → 002 (WCAG, parallel with 001's downstream) → 004 → (005 ∥ 006 → 007) → 008 ∥ 009 → 010

---

## 6. Open Questions for Operator

1. **Raw staging retention:** Keep `packages/design-systems/library/raw/` as untouchable source-of-truth, write curated output to library root? (Nova recommends yes — matches ECHO source-vs-converged.)
2. **Canonical token vocabulary:** Approve the FID-001 proposed keys, or extend (e.g. add `accent`, `overlay`, `shadow`)?
3. **Library scope:** 74 curated systems enough for v1, or pull more from the designmd.ai MIT filter (371 available)?
4. **Legal review:** Trademark scrub + MIT-source attestation — sufficient, or need human legal sign-off before embed? (Gemini's "safe to embed" was opinion, not law.)

---

## 7. Success Criteria

- 74 systems normalized to canonical YAML, trademark-scrubbed, WCAG-AA verified
- Active system embedded in protocol bundle, grounded at boot
- Slopscan blocks hardcoded visual values at tool-executor
- `bun run curate-design` ingests new external systems through the full loop
- Command Center cyberpunk dashboard is the first consumer, zero hardcoded hex
- All FIDs pass independent Nova planning + implementation audit before archive

---

*End of build order. Awaiting operator approval to enter Phase 1 (FID-001).*
