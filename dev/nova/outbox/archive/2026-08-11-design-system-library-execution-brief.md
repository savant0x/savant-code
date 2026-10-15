<!-- markdownlint-disable MD013 -->

# Execution Brief: Savant Design-System Library (DESIGN.md Retrofit)

**Date:** 2026-08-11
**For:** FreeBuff (single-agent harness, NO signature/attribution fields — branding defense)
**From:** Nova (planning author) + Spencer (operator)
**Companion doc:** `2026-08-11-design-system-library-build-order.md` (the phased FID plan)

---

## 0. TL;DR for the executing agent

You are normalizing, hardening, and embedding a library of 74 external DESIGN.md files into Savant Code as a mechanically-enforced, offline design-system primitive. You run the ECHO Perfection Loop (RED→GREEN→AUDIT→ADVERSARIAL) on the entire corpus. You do NOT modify ECHO's 15 laws. You do NOT adopt designmd.ai's website or MCP server. You produce Savant artifacts only.

**Staging location:** `packages/design-systems/library/` (74 files, 2.3M, MIT at source)
**Source repo:** `resources/awesome-design-md/` (VoltAgent, MIT License)
**Build order:** 4 phases, 10 FIDs (FID-001 through FID-010)

---

## 1. What DESIGN.md Is (context)

DESIGN.md is Google's open format: a single markdown file an AI coding tool reads to build consistent UI. A design system = one `.md` file (colors, typography, spacing, components, do's/don'ts). Community libraries host hundreds. We curate the good ones, run them through our Perfection Loop, and embed them so our agent grounds on a vetted visual contract offline — with mechanical gates (not prompt trust) enforcing compliance.

**Why this matters:** ECHO governs *process* and *code quality* but has zero primitive for *visual design*. When an agent builds UI today, it improvises. This retrofit closes that gap.

---

## 2. Corpus State (verified this session)

### 2.1 Staging contents
`packages/design-systems/library/` contains **74 files**, all `.design.md`, MIT-licensed at the source repo.

**Format split (CRITICAL):**
- **64 files have YAML frontmatter** (`---` ... `---` with `version`, `name`, `description`, `colors`, `typography`, `spacing`, `rounded`, `components` keys)
- **10 files are plain markdown** (no frontmatter; `## 1. Visual Theme & Atmosphere`, `## 2. Color Palette & Roles` narrative prose with hex in bullets)

The 10 plain-markdown files:
`kraken`, `lamborghini`, `lovable`, `mastercard`, `runwayml`, `sanity`, `spotify`, `starbucks`, `tesla`, `theverge`

### 2.2 Key-name variance within `colors:` (must reconcile to canonical)
Brands use different token names for the same concept:
- NVIDIA: `primary`, `on-primary`, `primary-dark`, `surface-dark`, `hairline`
- Apple: `primary`, `primary-focus`, `primary-on-dark`, `ink`, `body`, `body-muted`, `canvas`, `surface-tile-1`
- raycast: contains a **non-English key `属于`** (Chinese for "belongs to") leaked into frontmatter — must be scrubbed/renamed
- WattVision (designmd.ai batch, NOT in library): used Spanish labels — excluded, but watch for similar in the 74

### 2.3 Brand names present (must be trademark-scrubbed in FID-002)
All 74 carry third-party brand names in filename + frontmatter `name` + prose body:
apple, nvidia, stripe, vercel, linear, tesla, ferrari, bmw, bmw-m, airbnb, coinbase, meta, shopify, slack, spotify, kraken, lamborghini, mastercard, starbucks, theverge, binance, bugatti, cal, clay, clickhouse, cohere, composio, cursor, dell-1996, elevenlabs, expo, ferrari, figma, framer, hashicorp, hp, ibm, intercom, kraken, lamborghini, linear.app, lovable, mastercard, meta, minimax, mintlify, miro, mistral.ai, mongodb, nike, nintendo-2001, notion, nvidia, ollama, opencode.ai, pinterest, playstation, posthog, raycast, renault, replicate, resend, revolut, runwayml, sanity, sentry, shopify, slack, spacex, spotify, starbucks, stripe, supabase, superhuman, tesla, theverge, together.ai, uber, vercel, vodafone, voltagent, warp, webflow, wired, wise, x.ai, zapier, airtable, apple, binance, bmw, bugatti, cal, claude, clay, clickhouse, cohere, coinbase, composio, cursor, dell-1996, elevenlabs, expo, figma, framer, hashicorp, hp, ibm, intercom, kraken, lamborghini, linear.app, lovable, mastercard, meta, minimax, mintlify, miro, mistral.ai, mongodb, nike, nintendo-2001, notion, nvidia, ollama, opencode.ai, pinterest, playstation, posthog, raycast, renault, replicate, resend, revolut, runwayml, sanity, sentry, shopify, slack, spacex, spotify, starbucks, stripe, supabase, superhuman, tesla, theverge, together.ai, uber, vercel, vodafone, voltagent, warp, webflow, wired, wise, x.ai, zapier

(74 unique — dedupe against the actual folder listing.)

### 2.4 Provenance notes
- Source: `resources/awesome-design-md/` — VoltAgent repo, **MIT License** (Copyright 2026 VoltAgent). This covers all 74.
- The source repo had **147 brand folders; 73 were stubs** (body said "Design system details have been moved to: https://getdesign.md/..."). Those 73 were EXCLUDED from staging. Only the 74 with full content were copied.
- Earlier designmd.ai downloads (genesis, command-center-frknaykc, flip7, wattvision, + 15 more) were staged then REPLACED by the VoltAgent 74 — the VoltAgent set is superior (real brands, structured). The old `library/` was wiped and repopulated with the 74. If you see stray designmd.ai files, they should NOT be there.
- **designmd.ai "Command Center" (frknaykc) is NOT ours** — it's a light-mode SOC dashboard with orange accent. Our cyberpunk system is authored fresh in FID-009. Do not confuse them.

---

## 3. Canonical Schema Proposal (FID-001 deliverable)

Every output file MUST conform to this structure. Propose refinements to Spencer but start here:

```yaml
---
version: savant-1.0
name: <generic-savant-artifact-name>   # e.g. fintech-precision, not stripe
description: <one-line atmospheric summary>
source_license: MIT                     # VoltAgent awesome-design-md
source_attestation: "Curated from VoltAgent/awesome-design-md (MIT). Trademark scrubbed. WCAG-AA verified."
curated_by: savant-code-perfection-loop
curated_date: 2026-08-11
fid: FID-2026-0811-XXX                 # the normalization FID

colors:
  primary: "#xxxxxx"
  on-primary: "#xxxxxx"
  primary-hover: "#xxxxxx"
  background: "#xxxxxx"
  surface: "#xxxxxx"
  surface-elevated: "#xxxxxx"
  text: "#xxxxxx"
  text-muted: "#xxxxxx"
  border: "#xxxxxx"
  success: "#xxxxxx"
  warning: "#xxxxxx"
  error: "#xxxxxx"
  info: "#xxxxxx"

typography:
  display: { fontFamily: "...", fontSize: "..px", fontWeight: "..." }
  heading: { ... }
  body: { ... }
  label: { ... }
  code: { ... }

spacing:
  base: 4px
  scale: [4, 8, 12, 16, 24, 32, 48, 64]

radius:
  sm: "..px"
  md: "..px"
  pill: "9999px"

components:
  buttons: <prose>
  cards: <prose>
  # ... etc

elevation: <prose or token list>
dos: <prose list>
donts: <prose list>
---
```

**Canonical token map (brand-idiosyncratic → canonical):**
- `primary-focus` / `primary-on-dark` → `primary-hover`
- `ink` / `body` → `text`
- `body-muted` / `ink-muted-*` → `text-muted`
- `canvas` / `background` → `background`
- `surface-tile-*` / `surface-dark` → `surface-elevated` (or keep as semantic if distinct)
- `hairline` / `outline` → `border`
- `accent-*` → keep as `primary` variant OR `info` if unused semantically
- Any non-English key (`属于`, Spanish labels) → rename to canonical English or drop

**The markdown body (after frontmatter) should retain the qualitative "why" prose** (atmosphere, do's/don'ts) — that's the agentic-reasoning fuel. Only the *structured tokens* move to frontmatter.

---

## 4. Per-FID Execution Detail

### FID-001 — Canonical Schema & Normalizer
- Write a TypeScript normalizer (suggest `packages/design-systems/src/normalize.ts` or `scripts/normalize-design.ts`).
- Detects: has `---` delimiters? → parse YAML. Else → parse `##` headings, extract hex from bullets/prose.
- Maps brand keys → canonical (see §3 map).
- Flags for HUMAN REVIEW (do not auto-fix): non-English keys, tokens that don't map to any canonical key, missing required tokens (primary/background/text), contrast conflicts.
- Emits standardized `.design.md` with compliance header.
- **GATE:** All 74 parse to canonical YAML. Zero non-English keys. Compliance header on every file. Normalizer idempotent (re-run safe).

### FID-002 — WCAG Contrast Verification (was trademark scrub; that is NOT required)
- NOTE: Trademark scrub is REMOVED. Source is MIT (VoltAgent/awesome-design-md) — free reign. VoltAgent does not own the brand design tokens (functional CSS values). DESIGN.md is Google's open industry standard. Brand names are USEFUL reference context — keep them. Do NOT rename or scrub.
- Automated WCAG AA check: every color pair (text-on-background, text-on-surface, semantic-on-surface) meets 4.5:1 (body) / 3:1 (large).
- Auto-repair where mathematically possible (adjust lightness); human-review irreducible failures.
- Emit `contrast-report.json` per system.
- **GATE:** All 74 pass AA. Report generated. Brand names retained.

### FID-004 — Bundle Integration & Config Key
- Augment `scripts/generate-protocol-bundle.ts` (the REAL generator — confirmed it includes `dev/LEARNINGS.md` at line 76; follow the same pattern).
- Parse `packages/design-systems/library/*.design.md`, emit `export const SAVANT_DESIGN_LIBRARY = { ... }` in the generated constant.
- Append active system's markdown to boot context.
- Add `design_system: '<name>'` to `protocol.config.yaml` (confirmed `single_agent:` block exists at line 95 — add sibling `design_system:`).
- **Strict:** array or omission → fatal boot error (prevents conflicting systems).
- **GATE:** Orchestrator boot loads system into RunState. CI drift-check fails if `protocol-bundle.generated.ts` stale. `design_system` array throws.

### FID-005 — Boot Grounding (Law 1 Artifact)
- Design contract becomes part of the grounding set (like ECHO.md), read at boot.
- System prompt: Thinker bases visual reasoning on injected contract.
- **DO NOT rewrite Law 1 text.** Law 1 stays "Read 0-EOF before any edit." Design is a bundle artifact, not a law change.
- **GATE:** Agent reads tokens before visual write. Zero ECHO law text modified.

### FID-006 — Slopscan EHEL Module
- Extend tool-executor + EHEL (`packages/agent-runtime/src/echo/enforcement.ts`, `packages/agent-runtime/src/tools/tool-executor/native.ts`).
- Intercept `write_file`, `str_replace`, `apply_patch` on `.tsx/.jsx/.html/.css`.
- Use `packages/code-map` (tree-sitter) to AST-scan hardcoded hex / inline styles.
- Cross-reference against active system's canonical tokens.
- Block → terminal EHEL error → forces SELF-CORRECT FSM phase.
- **GATE:** Hardcoded `color: #FF00FF` blocked. Authorized token class passes. Block triggers SELF-CORRECT.

### FID-007 — Oscillation Guard
- If Slopscan blocks >3 consecutive times for one token → auto-escalate, return exact mapped token (e.g. `Required: text-neon-cyan`).
- **GATE:** 4th block provides exact token. Agent converges.

### FID-008 — Automated Curation CLI
- `bun run curate-design <url/path>` — headless Perfection Loop for external files.
- Integrates FID-001/002/003 logic.
- **GATE:** Ingests flawed external file, identifies missing tokens, scrubs trademark, outputs compliant artifact. WCAG failures repaired in SELF-CORRECT.

### FID-009 — Command Center Cyberpunk System
- Author OUR cyberpunk DESIGN.md: `#050508` void, `#00FBFF` cyan, `#FF00FF` magenta, `#FFB000` amber, Electric Green overrides.
- Run full loop. First native consumer.
- **GATE:** Passes @google/design.md lint, WCAG AA, Slopscan. Command Center dashboard consumes its tokens.

### FID-010 — CLI/TUI Component Retrofit
- Refactor OpenTUI + React CLI components to consume Command Center tokens.
- Eliminate legacy hardcoded hex.
- **GATE:** All CLI UI uses mapped tokens. Zero visual regression across theme toggles.

---

## 5. Hard Constraints (do not violate)

1. **No ECHO law rewrites.** Design grounding = bundle artifact, not Law 1 change.
2. **No external runtime fetch.** Everything embedded. No designmd.ai MCP at runtime.
3. **Single-agent mode = NO signatures.** If running under FreeBuff/single-agent harness, do NOT write `Author:` / `Fixed By:` / `Verified By:` fields. (The harness ECHO.md allows them; the single-agent protocol forbids them — branding defense. When in doubt, omit.)
4. **MIT only.** Source is MIT. Do not pull CC-BY-NC or CC-BY-SA systems into the library.
5. **Savant branding only.** Adapted examples are Savant artifacts.
6. **Mechanical enforcement.** Gates fail the build; never trust-the-model.
7. **Perfection Loop mandatory.** No file admitted without RED→GREEN→AUDIT→ADVERSARIAL.

---

## 6. Gotchas from This Session (avoid re-discovering)

- **designmd.ai `.md` URL 404s.** Correct download path is `https://designmd.ai/api/v1/kits/{user}/{name}/download` or the directory form `/{user}/{name}`. The `.md` suffix 404s.
- **Website renders frontmatter visually** — what you see in-browser is NOT the raw file. The API download serves raw (with frontmatter). Don't judge format from the rendered page.
- **VoltAgent repo has 73 stub folders** (redirect to getdesign.md). Only 74 have content. Excluded already, but if you re-pull, skip stubs.
- **The `属于` key in raycast.design.md** — Chinese leak, scrub it.
- **Gemini research doc errors:** claimed "strict YAML frontmatter" (false — 10 are plain), contradictory VoltAgent star counts (35k vs 107k), and presented "styling not copyrightable" as fact (it's legal opinion). Treat the research doc as directional, not authoritative. Verify against the actual 74 files.
- **Bundle generator is `scripts/generate-protocol-bundle.ts`** — it already includes `dev/LEARNINGS.md` (line 76) and excludes single-agent (lines 24/40/127/234). Follow that pattern for design systems.

---

## 7. Verification Commands (run after each FID)

```bash
# Typecheck × 4 (HARD GATE)
cd sdk && bun run typecheck && cd ../common && bun run typecheck && cd ../packages/agent-runtime && bun run typecheck && cd ../../cli && bun run typecheck

# Lint (HARD GATE)
bun x eslint . --max-warnings 0
bun run lint:md

# Design-library specific
bun x prettier --check packages/design-systems/
# (custom) verify all 74 parse to canonical YAML:
bun run scripts/normalize-design.ts --check packages/design-systems/library/
# (custom) trademark scrub verify:
grep -rni "stripe\|apple\|nvidia\|tesla\|ferrari" packages/design-systems/library/ || echo "CLEAN"
```

---

## 8. Open Questions for Spencer (escalate, don't assume)

1. Keep `packages/design-systems/library/raw/` as untouchable source-of-truth? (Nova recommends yes.)
2. Canonical token vocabulary — approve §3 keys or extend?
3. 74 enough for v1, or pull more from designmd.ai MIT filter (371 available)?
4. Trademark scrub + MIT attestation sufficient, or need human legal sign-off before embed?

---

*End of execution brief. Run the Perfection Loop. Report converged FIDs to Nova for independent audit before archive.*
