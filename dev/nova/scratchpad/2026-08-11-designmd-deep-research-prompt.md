<!-- markdownlint-disable MD013 -->

# Research Brief: Retrofitting the DESIGN.md Ecosystem as an Embedded Design-System Library for the Savant Code ECHO Harness

> **How to use this prompt:** Paste the entire text below into Google Gemini "Deep Research" mode. Attach the following files alongside it (they provide full technical depth — the prompt is self-sufficient even if they are skimmed): `protocol.config.yaml`, `README.md`, `ECHO.md`, `ARCHITECTURE.md`. The attached files are the authoritative source for any Savant-specific claim; this prompt embeds the essential context so the research runs standalone.

---

## 1. Your Role

You are a senior research analyst performing exhaustive web research. Your output will directly inform the architecture of a new internal feature for an AI coding harness. Do not summarize the surface of the target sites — investigate deeply, follow links, read specification documents, compare implementations, and surface non-obvious findings (format variations, tooling gaps, licensing terms, community scale, MCP/server architecture, forks, and competing domains).

## 2. Background — What Savant Code Is (context for the retrofit)

Savant Code is a TypeScript/Bun multi-agent AI coding assistant built on the **ECHO Protocol v0.2.0**. Essential facts (full detail in the attached files):

- **ECHO Protocol:** A set of 15 laws (Immutable Process Laws 1–4 + Extended Code Laws 5–15) that govern how agents work. Law 1 = "Read 0-EOF before any edit." Law 3 = "Verify before proceed." Law 15 = "Build stays clean." The protocol is non-negotiable and enforced mechanically by a harness enforcement layer (EHEL) at the tool-executor level — the model does not self-police.
- **Perfection Loop:** A Finite State Machine (RED → GREEN → AUDIT → ADVERSARIAL) that runs on a **FID** (Feature Implementation Document). Code is never written until the FID converges through all four phases.
- **10-agent roster** with strict separation of duties: Orchestrator, Detective, Forge, Verifier, Recorder, Thinker, Scout, Researcher, Scribe, Adversary.
- **Protocol bundle grounding:** At session boot, the harness embeds a generated constant (`protocol-bundle.generated.ts`) containing `ECHO.md`, `ARCHITECTURE.md`, `protocol.config.yaml`, and `dev/LEARNINGS.md`. The agent reads this bootstrap file *before* any work. This is the exact mechanism we want to extend to visual design.
- **The current gap:** ECHO governs *process* and *code quality* but has **zero primitive for visual design**. When an agent builds UI, it improvises visual decisions with no machine-readable design contract to ground on.

## 3. The Opportunity — The DESIGN.md Ecosystem

Google introduced **DESIGN.md**: a single markdown file that an AI coding tool reads to build consistent UI. A complete design system is expressed as one `.md` file (colors, typography, elevation, components, spacing, border radius, do's/don'ts). Community libraries host hundreds of these as free downloads; each file is roughly the size of a simple markdown document, so bundling many has negligible footprint.

**The core idea to retrofit:** Download and curate these design-system files, run each through Savant's Perfection Loop for quality and consistency hardening, and embed them as a **pre-loaded internal design-system library** in the harness. When the agent builds anything visual, it grounds on a vetted design contract *offline* — with mechanical gates enforcing compliance (the same way ECHO enforces code quality, but applied to design tokens and components). We do not adopt the external website or its live MCP server; we adapt the *concept* into Savant's governance model.

## 4. Research Targets (investigate ALL — follow every link you find)

Primary ecosystem sites and resources to map:

- https://designmd.ai/ — primary community library (hundreds of free design systems, MCP server, "drop the file in your repo root" install model)
- https://getdesign.md/ — secondary resource (determine precisely how it relates to or differs from designmd.ai)
- https://www.designmd.co/ — third domain (investigate relationship: same organization, fork, rebrand, or competitor of designmd.ai / getdesign.md)
- https://github.com/VoltAgent/awesome-design-md — curated awesome-list of DESIGN.md tooling, parsers, validators, examples, and ecosystem projects
- https://styles.refero.design/ai-agents/design-md-examples#examples — real-world DESIGN.md examples produced across different AI agents

From the above, recursively investigate any linked specification documents, JSON/YAML schemas, MCP server source repositories, CLI tools, format documentation, blog posts, or community discussions. Do not stop at the landing pages.

## 5. Research Questions (answer each with cited evidence and source URLs)

1. **Ecosystem map:** What is the full DESIGN.md landscape? Who maintains each domain (designmd.ai, getdesign.md, designmd.co)? Are they affiliated, competing, forks, or rebrands of one another? What is the community scale (GitHub stars, number of published design systems, contributor base, npm/MCP adoption)?
2. **Format specification:** What is the authoritative DESIGN.md schema? Enumerate *every* field/section observed across examples (colors with hex, typography/fonts, elevation/shadows, components, spacing scale, border radius, semantic status colors, do's/don'ts, etc.). Is there a formal specification or is it convention-only? Note variations between Google's original format and community extensions (VoltAgent, Refero, others).
3. **Tooling inventory:** What parsers, validators, linters, MCP servers, or CLIs exist to *consume* DESIGN.md programmatically? How does the designmd.ai MCP server work (live-fetch vs. bundled)? What is the gap between "a markdown file an agent reads" and "a machine-enforced design contract"?
4. **Quality enforcement (critical gap):** Do any existing tools validate that *generated UI actually conforms* to a DESIGN.md (token drift, component deviations, color/radius mismatches)? Or is compliance purely prompt-driven (trust-the-model)? This is the exact gap Savant would close mechanically — identify what already exists and where it falls short.
5. **Licensing assessment:** What license covers designmd.ai published systems, the awesome-design-md list, and Refero examples? Are they safe to fork, curate, redistribute, and embed inside a commercial or closed-source product such as Savant Code? Cite the actual license text/URL for each source. Flag any "non-commercial" or attribution clauses that would block embedding.
6. **Retrofit architecture (propose, do not merely describe):** Given Savant's protocol-bundle grounding model (Section 2), specify concretely how curated DESIGN.md files should be:
   - stored (file layout, naming convention, directory structure inside the repo),
   - embedded into the generated protocol bundle (`protocol-bundle.generated.ts`),
   - grounded at agent boot so Law 1 (Read 0-EOF) applies to design contracts,
   - validated by mechanical gates that *fail the build* on token/component deviation (analogous to ECHO Law 15 and to auteur's `slopscan`/`systemscan` design-lint concept),
   - versioned, cached, and drift-checked against the source files.
7. **Curation pipeline:** Propose a Perfection-Loop-shaped process (RED → GREEN → AUDIT → ADVERSARIAL) that takes external DESIGN.md files → vets them → hardens them → admits them to an internal Savant design-system library. Define what "good enough to ship" means for a design system (consistency, completeness, no contradictory tokens, accessibility baseline).
8. **Risks:** What breaks when design systems are embedded at runtime? Bundle size growth, token bloat, conflicting systems selected for one project, agent over-reliance on a single system, stale tokens after upstream changes. How does Savant's existing bundle-regeneration-and-diff drift check mitigate this? What additional guards are needed?

## 6. Deliverable Format

Return a structured research report containing:

- **Ecosystem Summary** — all domains, ownership, scale, and relationships (with evidence)
- **DESIGN.md Format Specification** — full field enumeration across all observed variants
- **Tooling Inventory** — parsers / validators / MCP servers with URLs and identified gaps
- **Licensing Assessment** — per-source license, redistribution safety, citations
- **Retrofit Architecture Proposal** — concrete file layout, bundle integration, boot grounding, and mechanical validation gates, explicitly tied to Savant's existing `generate-protocol-bundle.ts` generator and EHEL enforcement model
- **Curation Pipeline** — Perfection-Loop-shaped, with explicit acceptance criteria per design system
- **Phased Implementation Plan expressed as Savant FIDs** — propose 3–5 Feature Implementation Documents with: title, scope, dependency order, and acceptance gates. Phase them against Savant's existing roadmap. Note: the "Command Center" cyberpunk dashboard (design language: `#050508` deep void, `#00FBFF` neon cyan, `#FF00FF` hot magenta, `#FFB000` amber) is the **first consumer** of this library and should be the reference example.
- **Risk Register** — each risk with a concrete mitigation
- **Source List** — every URL investigated, grouped by finding

## 7. Constraints (Savant's engineering philosophy — do not violate)

- **We define the market, not follow it.** Do NOT recommend adopting designmd.ai's website or live MCP server wholesale. Recommend *adapting the concept* into Savant's governance model.
- **Zero external runtime dependency.** Design systems must be embedded and function fully offline. No live-fetch from any designmd server at agent runtime.
- **Mechanical enforcement over prompt trust.** Any design-compliance check must be a runnable gate that fails the build — not instructions the model can ignore.
- **FID-bound, Perfection-Loop-audited.** Every design system in the library must pass RED → GREEN → AUDIT → ADVERSARIAL before it ships.
- **Local-first, BYOK, no telemetry leaving the machine.**
- **Savant branding only.** If examples are adapted, they are Savant artifacts — no third-party branding in Savant docs or bundles.

---

*End of prompt. Attach `protocol.config.yaml`, `README.md`, `ECHO.md`, `ARCHITECTURE.md` before running.*
