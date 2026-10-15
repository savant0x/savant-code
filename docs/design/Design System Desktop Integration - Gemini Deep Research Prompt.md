# Savant Design System × Desktop Integration — Gemini Deep Research Prompt

> **What this is:** the finalized prompt for a Gemini Deep Research run (2026-08-25).
> Copy everything below the horizontal rule into Gemini Deep Research as-is.
>
> **Attachments to include with the run** (working-tree state that may be thin or absent
> on GitHub; attachments win over crawled files where they conflict):
>
> 1. `docs/design/design-system-library.md` (full feature contract: selection,
>    authoring, persistence, enforcement, packaging)
> 2. `docs/design/Savant Visual Workspace Architecture.md` (desktop workspace +
>    command-deck blueprint, including its contrast-pair claims)
> 3. `CHANGELOG.md` excerpts covering the desktop night sessions (robot cast, token
>    pipeline, session-bridge open items) and the design-contract scanner fixes
>
> **Evaluation target:** `nexu-io/open-design` (Apache-2.0). A pinned local snapshot of
> the repo (v0.20.3) is saved at `resources/open-design-main/` in our working tree — use
> it to disambiguate when upstream has moved; cite the GitHub paths regardless so the
> report stays reproducible.
>
> **Post-run plan:** fold the report into a master + child FID suite mirroring the
> desktop chain pattern (`dev/fids/`), then run the full Perfection Loop
> (RED → GREEN → AUDIT → ADVERSARIAL) on the plan before any implementation. Expected
> landing zones: `packages/design-systems/` (schema/adapters/enforcement) and
> `desktop/` (renderer consumption), coordinated through the desktop master
> FID-2026-0820-007 chain.

---

# Deep Research Request: Mining nexu-io/open-design Into Our Design System and Tauri Desktop App

## Role

You are a senior design-engineering researcher. Produce a single comprehensive report
that evaluates **OpenDesign** (`nexu-io/open-design`) as a reference system and extracts
every pattern, mechanism, and idea worth adopting into TWO coupled efforts inside an
existing AI-coding-agent platform:

1. **Enhance an offline design-system engine** (`@savant-code/design-systems`) so its
   resource format, token vocabulary, authoring pipeline, and validation are strong
   enough to drive every visual surface we ship.
2. **Deepen the design system's integration into our Tauri v2 desktop app**, where it is
   currently consumed only as a narrow build-time color snapshot, and extend our
   mechanical write-boundary enforcement ("EHEL") to cover webview-era surfaces.

The goal is NOT a product review of OpenDesign and NOT generic design-theory surveying.
It is a disciplined technology-extraction study: for each OpenDesign subsystem, determine
what is structurally superior to ours, what is portable given our constraints, and what
looks attractive but violates them. Every recommendation must target the verified gaps
in §Known gaps. Cite primary sources (code, docs, changelogs) over marketing.

## The system under evaluation: OpenDesign

Facts you may rely on (verified against the pinned v0.20.3 snapshot):

- **What it is:** an open-source "Claude Design alternative" — a local-first native
  desktop app (Electron shell on macOS/Windows, Linux AppImage optional lane) plus a
  Next.js 16 web app, backed by a Node 24 local daemon (Express + SQLite/SSE) that
  spawns the coding-agent CLIs already installed on the machine (26 distinct CLIs) as
  the actual rendering engine, or proxies to any OpenAI-compatible endpoint BYOK.
- **Design-system packages:** 151 shipped packages centered on a brand-grade
  `DESIGN.md` Markdown contract. Legacy packages are Markdown-only; newer ones add
  `manifest.json`, compiled `tokens.css`, component fixtures, assets, and provenance
  evidence. Package shape and provenance are documented in `design-systems/README.md`
  with a `_schema/` reference directory. Switching the active system changes the next
  render's tokens. The catalog spans both brand systems AND pure aesthetic styles
  (brutalism, glassmorphism, neumorphism, neon, hud, mission-control,
  trading-terminal, bento, retro, editorial, …).
- **Lineage we share:** the original 9-section `DESIGN.md` schema traces to
  `VoltAgent/awesome-design-md` — the SAME corpus our engine staged its 74 presets
  from. This makes the two catalogs direct evolutionary siblings and every format
  comparison apples-to-apples.
- **Quality gates:** an artifact lint API (`/api/artifacts/lint`) plus a five-dimensional
  self-critique scoresheet template used as a PRE-EMIT gate before artifacts ship.
- **Plugin/skill economy:** 100+ functional skills following the Agent Skills
  `SKILL.md` convention, 15 deck templates × 36 themes, and 277 official plugins
  governed by an `open-design.json` manifest (specVersion 1.0.0): stable ID, semver,
  declared `od.capabilities[]` with minimum-grant installs (restricted installs get
  only `prompt:inject`), typed inputs, registry publishing flows.
- **Desktop internals:** Electron shell + sidecar IPC protocol (STATUS · EVAL ·
  SCREENSHOT · CONSOLE · CLICK · SHUTDOWN), sandboxed iframe artifact preview, MCP
  stdio server (`od mcp install <agent>`), loopback-bound daemon with SSRF-guarded
  proxy, HTML/PDF/PPTX/ZIP/Markdown/MP4 export surfaces (HyperFrames HTML→MP4).

## Our system (fixed constraints — evaluate everything against these)

- **SavantCode**: an open AI coding agent (Bun + TypeScript monorepo, Apache-2.0,
  no-GPL dependencies, hard 300-line file ceiling, Windows + Linux first) with a
  governed multi-agent runtime ("ECHO Protocol"): fixed 10-role roster, Perfection Loop
  FSM, machine-readable FIDs, Ed25519-signed provenance ledger, lifecycle hooks, and an
  EHEL harness-enforcement layer that mechanically blocks protocol-violating tool calls.
- **The design-system engine** (`packages/design-systems/`, offline, zero-network):
  - 74 curated presets parsed from an MIT-licensed Markdown corpus
    (`VoltAgent/awesome-design-md`) into zod-validated resources with dual SHA-256
    hashes (source + normalized) and full provenance records.
  - One Savant-native default, `savant-cyberpunk`: near-black `#050508`, neon cyan
    `#18faf9` — operator-confirmed brand provenance; inherited palette values were
    purged by governance.
  - Deterministic selection precedence `session > project > user > default`; a
    configured-but-invalid selection fails closed rather than silently falling through.
  - Versioned authoring pipeline (`DesignAuthoringInputV1`): interactive wizard and
    headless `--design-input` share one validation path; bounded resumable drafts;
    custom systems persist via temp-file + rename commit journals under approved roots
    (`<project>/.savant/design-systems/`, `<home>/.savant/design-systems/`).
  - Font references carry fallback chains and a redistribution gate: no font binary
    ships without license evidence.
  - Targets enum: `terminal | react | web`. Today only the terminal adapter exists in
    anger: `designSystemThemeOverrides()` maps canonical colors onto the CLI's ChatTheme
    (dark uses canonical tokens; light uses ONLY explicit
    `tokens.extensions.colorsByMode.light` entries so missing variants cannot clobber
    the base light theme).
- **Mechanical enforcement (EHEL)**: at the tool-executor write boundary, a
  design-contract scanner inspects proposed content of visual writes (TSX, JSX, HTML,
  CSS, OpenTUI style properties) against the ACTIVE contract's tokens and issues
  dedicated receipts (`DESIGN_CONTRACT_BLOCK`, `DESIGN_CONTRACT_NEEDS_REVIEW`). For
  string-replacement edits it evaluates the reconstructed final content, not just the
  fragment. Dynamic expressions that cannot be resolved to authorized literals are
  flagged. A known false-positive class (word-boundary collisions) is being fixed under
  a live work item. The active contract enters agent context each run; reference prose
  is data, never an instruction channel.
- **Desktop app today**: Tauri v2 shell (WebView2 on Windows / WebKitGTK on Linux) + Bun
  single-file sidecar backend speaking JSON-RPC 2.0 over a localhost WebSocket (ephemeral
  port; bearer token delivered via env/IPC only); restrictive CSP; React 19 renderer;
  zustand ^5; plain CSS. A Three.js "command-deck" floor renders the agent roster as
  holographic figures with station/walker/trail effects. We are NOT switching to
  Electron — treat Tauri as fixed and evaluate what transfers.
- **Existing desktop token bridge** (the current integration ceiling): a build-time
  generator resolves the embedded default contract and commits three generated artifacts
  (`design-tokens.generated.ts`, `tokens.css`, `floor/deck-tokens.generated.ts`); a
  drift test byte-compares them on every test run; boot code applies the CSS custom
  properties onto `document.documentElement`. Re-theming the shell is a data change,
  not a CSS rewrite — but only because the surface area covered is small (see below).

## Known gaps we want researched (verified against the working tree)

These are the load-bearing facts your recommendations must resolve. Do not re-derive
them; argue about the best way to close them.

1. **Colors-only adoption.** The desktop consumes exactly nine canonical colors as CSS
   custom properties (`--bg --border --error --fg --muted --primary --success --surface
   --warning`) plus a ten-key hex subset for the Three.js deck. The contract also
   carries typography (body/heading/code), spacing scales, radius scales, and component
   guidance — none of which reach the desktop.
2. **Build-time snapshot problem.** The desktop bakes the *embedded default* contract at
   generation time into committed artifacts. CLI-side selections (`/design use`,
   custom systems, session overrides) never cross the process boundary; changing themes
   requires regeneration + rebuild. The gateway WebSocket bridge already exists but
   carries no contract payload.
3. **No light mode outside the CLI adapter.** The `colorsByMode` extension exists and is
   honored by the terminal adapter only; the desktop has no light path at all.
4. **Contrast is exported but unenforced.** The package exports a WCAG-style
   `contrastRatio()` used by its own tests; no production surface (CLI or desktop) calls
   it. A workspace architecture doc claims contrast pairs "are validated" — the claim is
   ahead of the code.
5. **Role-accent collisions on the deck.** Ten agent roles map onto eight usable deck
   tokens; three roles share one cyan accent and two share muted gray. Differentiating
   ten identities from a tiny token set without inventing off-token hexes is unsolved.
6. **Scanner blind spots for webview-era output.** The EHEL scanner reads literal colors
   and style declarations in TSX/JSX/HTML/CSS and OpenTUI props. It does not understand
   CSS custom-property indirection (`var(--primary)`), arbitrary CSS-in-TS object maps
   (a generator works around this by using tuple tables), Three.js material colors, SVG
   fills in JSX, or canvas/WebGL pixel writes. Enforcement coverage must grow exactly as
   desktop adoption grows, or the guarantee inverts into noise.
7. **Corpus quality is uneven.** The 74 presets are curated references of wildly
   varying structure; some define rich component guidance, others barely define colors.
   There is no mechanical quality/completeness score, no contrast screening at admission,
   and fonts are uniformly non-redistributable references. OpenDesign's catalog covers
   aesthetic-style categories we do not carry at all.

## Primary sources

### SavantCode (public — crawl these; this is the system being extended)

- Repo: <https://github.com/savant0x/savant-code>
- Design-system engine: `packages/design-systems/src/` (`types.ts`, `parser.ts`,
  `library.ts`, `selection.ts`, `theme-adapter.ts`, `authoring.ts`, `drafts.ts`,
  `color-contrast.ts`)
- Feature contract: `docs/design/design-system-library.md`
- Desktop shell: `desktop/README.md`, `desktop/scripts/generate-design-tokens.ts`,
  `desktop/src/theme.ts`, `desktop/src/tokens.css`,
  `desktop/src/floor/deck-tokens.generated.ts`, `desktop/src/floor/roles.ts`,
  `desktop/src/floor/stations.ts`, `desktop/src/styles.css`
- Enforcement layer: `packages/agent-runtime/src/echo/design-contract.ts`,
  `design-contract-scan.ts`, `enforcement.ts`
- Terminal consumer: `cli/src/utils/theme-config.ts`
- Governance: `ECHO.md` (skim §Agent Roster and §Hybrid Mode only), `AGENTS.md`
  §Self-Improving Harness

### OpenDesign (public — crawl these; this is the system under evaluation)

- Repo: <https://github.com/nexu-io/open-design>
- Product overview + architecture: `README.md`, `QUICKSTART.md`,
  `docs/architecture.md`, `docs/references.md` (provenance/lineage)
- Design-system package shape: `design-systems/README.md`, `design-systems/_schema/`,
  one modern brand package WITH `manifest.json` + `tokens.css` (e.g.
  `design-systems/linear-app/`), one Markdown-only legacy package for contrast, and two
  aesthetic-style packages (e.g. `design-systems/neon/`, `design-systems/hud/`)
- Corpus sync/admission machinery: `scripts/sync-design-systems.ts`
- Quality gates: the artifact lint API implementation behind `/api/artifacts/lint`
  (`apps/daemon/src/…`) and the five-dimensional critique template
  (`design-templates/critique/`)
- Plugin economy: `plugins/spec/SPEC.md`, `plugins/spec/AGENT-DEVELOPMENT.md`,
  one scenario plugin example (e.g. `plugins/_official/scenarios/od-default/`)
- Skill protocol: `docs/skills-protocol.md`
- Desktop internals: `packages/sidecar-proto/` (IPC contract),
  `docs/agent-adapters.md`, and the daemon's runtime-definition layer
  (`apps/daemon/src/runtimes/`)
- Release notes: `RELEASE-NOTES-0.10.0.md`, `CHANGELOG.md` (feature velocity context)

Note: both repositories evolve continuously. Where crawled GitHub state conflicts with
the attachments or with the pinned `resources/open-design-main` snapshot (v0.20.3), the
attachments and snapshot win, and the report should flag the divergence explicitly.

### External landscape (supporting evidence only)

Where OpenDesign does something poorly or not at all, bring in 2024–2026 prior art:
W3C Design Tokens Community Group format adopters, style-dictionary-class pipelines,
token-based linting (stylelint allowed-list rules, ESLint restrictions, purpose-built
design linters), WCAG automation tooling, perceptual color science (OkLCH/Oklab) for
palette derivation, and theme consistency across companion apps.

## Research questions

### A. Resource format & corpus strategy (OpenDesign packages vs our zod resources)

1. Compare OpenDesign's package shape (DESIGN.md center + optional `manifest.json` /
   `tokens.css` / components / assets / provenance) against our fully normalized
   zod-validated resource (canonical tokens, dual SHA-256 hashes, provenance, font
   refs). Which structural ideas should we adopt — e.g., shipping a COMPILED
   `tokens.css` alongside source prose, component fixtures as executable truth,
   per-package asset directories — and which of ours should they envy?
2. Their catalog carries aesthetic-style categories (brutalism, glassmorphism, neon,
   hud, trading-terminal, …) alongside brand systems. Should we expand beyond brand
   references into style/aesthetic families for terminal + desktop surfaces? What
   admission criteria would keep such additions provably on-token?
3. Propose a mechanical completeness/quality score for prose-derived packages (token
   coverage breadth, contrast sanity, font-reference validity, description specificity)
   usable BOTH for screening our existing 74-resource catalog AND for judging future
   imports from OpenDesign's catalog (license-compatible, Apache-2.0/MIT only).

### B. Brand extraction & authoring pipeline

4. OpenDesign codifies brands from screenshots/URLs into reusable `DESIGN.md`
   contracts and offers curated direction pickers when no brand exists. Map that
   extraction workflow onto our `DesignAuthoringInputV1` wizard + headless path: what
   steps (reference ingest → candidate tokens → human lock-in → validated save) are
   worth adding, and how do they respect our fail-closed validation and draft bounds?
5. Their five-direction picker and critique loops shape generation BEFORE artifacts
   emit. Which elements translate to OUR flow, where generation targets codebases and
   terminals rather than standalone HTML artifacts?

### C. Enforcement & quality gates (EHEL growth path vs their lint API)

6. Study OpenDesign's artifact lint API and five-dimensional pre-emit self-critique.
   What belongs in a mechanical write-boundary scanner (our EHEL model) versus an
   advisory pre-flight critique? Propose which critique dimensions (typography scale,
   hierarchy, accessibility, consistency, brand fidelity — confirm actual dimensions
   from the source) could become receipt remediation guidance after a
   `DESIGN_CONTRACT_BLOCK`.
7. Survey 2024–2026 practice in lint-time design-token enforcement: stylelint
   declaration-property-value-allowed-list class rules, ESLint no-restricted-syntax
   patterns, purpose-built design-token linters, CI visual diffing. For each:
   precision/recall characteristics, config ergonomics, handling of custom properties
   and dynamic values.
8. Design the growth path for OUR scanner: classify CSS custom-property
   definitions/usages, TS object-literal style maps, SVG attributes in JSX, Three.js
   material parameters, canvas paint calls — keeping the receipt taxonomy
   (`DESIGN_CONTRACT_BLOCK` / `DESIGN_CONTRACT_NEEDS_REVIEW`) and fail-open vs
   fail-closed discipline sensible. Where should each check live: pre-write EHEL scan,
   CI static pass, or desktop-side runtime guard?
9. Precision engineering: given a live word-boundary false-positive class, what
   strategies (AST parsing tiers vs regex, allowlisted generated paths, tuple-table
   escapes) keep zero-tolerance enforcement viable as coverage grows?

### D. One truth across processes (contract delivery)

10. Compare architectures for keeping ONE resolved contract authoritative across a CLI
    process and a packaged desktop app: (a) build-time codegen (current), (b) runtime
    delivery over the existing localhost JSON-RPC/WebSocket gateway, (c) shared watched
    store, (d) hybrids. Weigh schema versioning, offline guarantees, drift detection,
    hot re-theme UX, bearer-token security, and cold-start (desktop before any CLI
    session). Use OpenDesign's "switch system → next render re-tokens" behavior and its
    daemon/SQLite state model as evidence, adapted to our Tauri+Bun topology.
11. What do mature multi-surface products actually do for theme-state consistency?
    Cite implementations.
12. Migration path off committed-artifact snapshots without breaking drift-test
    discipline or the offline/no-network rule.

### E. Desktop shell & preview architecture deltas

13. OpenDesign pairs an Electron shell with a privileged local daemon and sidecar IPC
    (STATUS/EVAL/SCREENSHOT/CONSOLE/CLICK/SHUTDOWN); we pair Tauri v2 + Rust supervisor
    with a Bun gateway sidecar speaking frozen JSON-RPC 2.0. Which sidecar-protocol and
    lifecycle ideas (watchdog/backoff, capability-scoped commands, screenshot/console
    channels) are worth porting INTO our existing contract — and which exist because of
    Electron-specific constraints we do not have?
14. Their sandboxed iframe artifact preview vs our restrictive-CSP webview: what can a
    Tauri app safely borrow for live-previewing generated design surfaces (if any), and
    where does our security posture demand a different shape entirely?
15. Export surfaces (HTML/PDF/PPTX/MP4 via headless Chrome pipelines): is any subset
    coherent for a coding-agent product whose artifacts ARE code, or is this a genuine
    anti-recommendation under our constraints?

### F. Marketplace, skills & governance interop

16. OpenDesign plugins use `open-design.json` with minimum-capability grants and
    registry publishing; our agent-authored skills land in quarantine until operator
    trust (`FID-2026-0824-012`), with immutable skills and Levenshtein-bounded patches.
    Compare the trust models. Is there anything in their capability-declaration or
    registry-validation mechanics that hardens OUR quarantine/trust boundary — or that
    we should deliberately reject as prompt-injection surface?

### G. Accessibility, identity accents, fonts, and the 3D deck

17. Contrast gating placement: where should a WCAG 2.x ratio check attach (corpus
    admission screening, authoring save, EHEL write scan, desktop boot assertion, CI
    report) so failures stay actionable? Cite tooling that does this well.
18. Deriving ≥10 distinguishable, contrast-safe role accents from a SMALL token set
    (OkLCH perceptual spacing, categorical-palette research, deterministic formulas —
    not hand-picked hexes), stable across themes, collision-free.
19. Motion-safety tokens: principled duration/easing tokenization that degrades under
    OS reduced-motion preferences.
20. Fonts inside a redistributable binary: bundling vs system resolution vs
    download-at-runtime (conflicts with offline rule — evaluate honestly), variable-font
    benefits, licensing evidence chains, fallback stacks from tokenized typography.
21. Token-driven 3D language: computing emissive intensities, fog/atmosphere tints,
    translucency FROM base hex tokens deterministically so the deck re-themes with the
    contract; performance budgeting for always-on ambient scenes on integrated GPUs.

## Decisions we need from you (recommendation matrix per item, with tradeoffs table)

- **D1 — Contract delivery model** for desktop ↔ CLI truth: build-time codegen vs
  gateway-delivered live contract vs hybrid (codegen as offline fallback). Must respect:
  no network, restrictive CSP, bearer-token bridge, desktop-before-session startup.
- **D2 — Canonical schema v2 additive set:** the minimal token categories to add for
  full desktop/web coverage (informed by OpenDesign's package shapes), zod evolution
  rules, hash/provenance regeneration strategy for the existing 74-resource catalog,
  and whether to compile a distributable `tokens.css` per resource.
- **D3 — Enforcement placement map:** for each new visual-output class (CSS vars, TS
  style objects, SVG/Three.js/canvas), decide EHEL pre-write scan vs CI pass vs runtime
  guard, with precision targets, receipt semantics, and which critique-gate ideas to
  absorb as advisory layers.
- **D4 — Light-mode & multi-theme architecture:** validated dual-theme structure, OS
  sync, per-surface overrides, contrast gating hooks.
- **D5 — Role-accent derivation system:** deterministic algorithm producing ≥10
  distinguishable accessible accents from the existing token set (or minimal addition),
  stable across themes, collision-guaranteed.
- **D6 — Corpus expansion & interop stance:** adopt aesthetic-style categories and/or
  import OpenDesign packages? If yes, the admission screen, license rules, and
  normalization cost; if no, the reasoning.

## Deliverable format

1. Executive summary (≤500 words) with a top-10 decisions list.
2. Section per topic (A–G): findings table with citations, recommended approach,
   second choice, and explicit anti-recommendations (attractive-but-violates-our-
   constraints items called out by name).
3. Decision matrices D1–D6 with scoring rubric (safety, maintainability, cost, DX,
   longevity, runtime performance).
4. Risk register: top 10 risks across the combined effort with mitigations.
5. Full source list with URLs; prefer primary docs/changelogs/code; flag anything where
   evidence is thin (<2024 sources or vendor claims only).