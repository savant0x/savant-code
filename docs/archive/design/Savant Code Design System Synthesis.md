# **Savant Code Design System: Architectural Synthesis of Generative Guardrails and Deterministic Detection**

## **Executive Summary**

The rapid proliferation of large language models in software engineering has introduced a pervasive and universally
recognized phenomenon categorized as "AI Slop"—a homogenized, predictable, and structurally deficient approach to user
interface and user experience design. Because frontier models are trained on the same ubiquitous SaaS templates,
open-source component libraries, and mid-2020s structural defaults, they reliably regress to identical aesthetic and
architectural choices1. These defaults manifest persistently across generations: the overuse of the Inter font family,
generic purple-to-blue gradients, symmetric nested cards, arbitrary spacing scales, and gray text overlaid on colored
backgrounds3. As these models calculate the statistical likelihood of token arrangements rather than exercising visual
taste, they produce interfaces that function technically but fail aesthetically, resulting in a distinct "generated"
rather than "crafted" fingerprint.
To combat this homogenization within the Savant Code ecosystem, a custom, high-performance design system must be
synthesized from the industry’s two leading anti-slop architectures: Hallmark and Impeccable. Hallmark, developed by
Together AI, operates on the principle of generative guardrails. It establishes a robust 57-gate slop-test and mandates
a pre-emit self-critique scored across six axes—Philosophy, Hierarchy, Execution, Specificity, Restraint, Variety—to
force the language model out of its probabilistic comfort zone prior to output generation5. Conversely, Impeccable,
developed by Paul Bakaus, approaches the problem through a highly deterministic lens. It provides a dense, shared
vocabulary of 23 steering commands backed by 59 deterministic rules, evaluating code via Abstract Syntax Tree parsing,
static HTML analysis via JSDOM, and live browser DOM inspection1.
The optimal architecture for Savant Code—herein designated as the Savant Core Form Architecture—achieves superiority by
structurally binding Hallmark’s generative intent with Impeccable’s deterministic verification. This architecture
operates fundamentally differently from traditional runtime component libraries. It is not a CSS framework and imposes
zero impact on production bundle size8. Instead, the Savant Core Form Architecture functions as a cognitive layer
situated directly between the user’s intent and the coding agent’s execution. It dictates that the artificial
intelligence must first declare a structural blueprint by selecting a macrostructure and theme, evaluate its proposed
code against comprehensive domain references ranging from OKLCH color theory to fluid typography, and finally subject
the output to a rigorous ECHO Protocol verification gate4.
This report outlines the comprehensive taxonomy of AI design slop, provides a deductive synthesis of the minimal
high-impact ruleset covering the vast majority of generation failures, and details the technical implementation of
AST-aware scaffolding. Furthermore, it establishes the architectural proposal for baking this capability natively into
the Savant Code harness via the .agents/skills/savant-design/ directory. The resulting system is fully compatible with
Apache 2.0 licensing, relies on zero-cost dependencies, and structurally outperforms both progenitor systems by closing
the loop between generative creativity and deterministic, post-generation enforcement3.

## **The Taxonomy of AI Design Slop**

To effectively construct a deterministic detector and a generative skill for Savant Code, it is imperative to
exhaustively catalog the "tells" of AI-generated design. Artificial intelligence models do not possess innate visual
taste; they calculate the highest probability of subsequent tokens based on vast repositories of scraped code2. The
result is a taxonomy of slop that can be categorized into typographic, chromatic, spatial, behavioral, and content-based
failures.

### **Typographic Monoculture and Failures**

The most immediate indicator of an AI-generated interface is typographic homogenization. Without explicit constraints,
language models default to the safest, most ubiquitous sans-serif typefaces available in their training data, most
notably Inter, Roboto, and Open Sans4. This results in a one-font page that lacks hierarchical distinction between
display headers, body copy, and metadata6. Furthermore, when attempting to inject a "modern" or "technical" aesthetic,
models frequently misapply monospace fonts, such as JetBrains Mono or Fira Code, to non-technical consumer-facing
components4.
Models also demonstrate a fundamental misunderstanding of typographic emphasis. A reliable tell of prompt-to-HTML
generation is the placement of an italicized emphasis word inside an otherwise upright hero heading, or the application
of an all-italic display face6. Hallmark explicitly bans this through Gate 38a, enforcing that headings must remain
roman and emphasis must be carried by weight or accent color6. Additionally, AI struggles with fluid typography. Instead
of utilizing mathematically sound fluid scales, models apply arbitrary, uncalibrated pixel values, resulting in
typographic hierarchies that shatter on intermediate viewport widths4.

### **Chromatic Homogenization**

In the absence of a structured design language, models default to the "AI Palette." This aesthetic is characterized by
cyan-on-dark themes, neon accents on dark modes, and predictable purple-to-blue or purple-to-pink gradients spanning
hero sections3. Because models lack perceptual color awareness, they frequently output pure black and pure white,
failing to utilize sophisticated, tinted neutrals that carry a fraction of the primary brand hue4.
Furthermore, models frequently fail basic accessibility standards by placing gray text directly on colored backgrounds,
violating WCAG AA contrast requirements3. A critical mechanical failure is mid-render improvisation; rather than
referencing a centralized, locked token system, the model will inject inline color styles directly into components,
ensuring that the codebase becomes visually fragmented and impossible to theme systematically6.

### **Spatial and Compositional Rigidity**

Spatial slop is defined by an overreliance on symmetric, centralized alignment. Models struggle immensely with
asymmetric balance, resulting in highly centralized, rigid column layouts that lack visual rhythm4. When organizing
complex information, models default to a pattern defined as the "Card Matryoshka"—wrapping every discrete piece of
information in a bordered, rounded-corner card, and subsequently nesting those cards within other cards, which
ultimately destroys page rhythm and drastically increases cognitive load4.
Another pervasive spatial anti-pattern is the "Icon-Tile Stack." When asked to generate a feature grid, the AI will
almost universally place a large, rounded, brightly colored icon directly above every h3 heading4. Finally, padding and
margin values are often hallucinated based on probabilistic tokens rather than adhering to a rigorous baseline grid,
resulting in arbitrary 17-pixel or 23-pixel gaps that degrade the interface's structural integrity10.

### **Behavioral, Motion, and Content Failures**

Behavioral slop extends beyond visual aesthetics into the mechanical implementation of the interface. Models frequently
utilize legacy CSS animation physics, defaulting to bounce or elastic easing functions that feel distinctly dated,
rather than employing smooth, exponential deceleration curves4. They also demonstrate a lack of frontend performance
knowledge by applying CSS transitions to layout properties, which triggers expensive browser reflows, rather than
restricting animations to hardware-accelerated transforms and opacity3.
On a structural level, models fail to account for mobile viewport edge cases. This unresponsiveness results in
horizontal scrolling, clipped content, or primary tap targets that wrap awkwardly onto two lines6. From a content
perspective, models attempt to fulfill the prompt by fabricating authority. This manifests as hallucinatory performance
metrics, non-existent corporate logos, or fake user testimonials. Hallmark expressly forbids this through Gate 46,
demanding honest copy and the use of placeholders when real data is absent6. Furthermore, models often waste tokens by
hand-coding fake Safari browser windows or iPhone bezels to frame screenshots, adding unnecessary DOM weight and visual
clutter6.

## **Comparative Architectural Analysis: Hallmark vs. Impeccable**

To build a superior system for Savant Code, a deep architectural comparison of the two progenitor systems is required.
Hallmark and Impeccable operate on diametrically opposed philosophies—generative upstream constraints versus
deterministic downstream enforcement—yet both achieve significant reductions in AI slop.

### **Hallmark: Generative Guardrails and the PHESRV Gate**

Hallmark, leveraging a massive context window, focuses entirely on generative guardrails. It stops slop at the moment of
emission by forcing the language model to adopt a specific operational mode5. Hallmark defines four distinct verbs:
build, audit, redesign, and study. When building, Hallmark refuses the on-distribution defaults by requiring the AI to
select from 21 macrostructures and 20 distinct themes10.
The defining characteristic of Hallmark’s architecture is its "Macrostructure \+ Theme" approach. Before writing code,
the AI must explicitly declare a macrostructure, representing the wireframe or skeleton of the page, and then dress it
in a named theme. To prevent repetitive templates across a developer's session, Hallmark utilizes a
Theme-Diversification Rule. A newly selected theme must differ from the previous output's theme on at least one of three
specific axes: the Paper Band, the Display Style, or the Accent Hue6.
Before outputting code, Hallmark enforces a pre-emit self-critique. The model must score its own proposed design on a
scale of 1 to 5 across six axes: Philosophy, Hierarchy, Execution, Specificity, Restraint, and Variety. If any score
falls below a 3, a revision pass is automatically triggered internally6. Finally, the generated code is passed through
57 conceptual slop-test gates. These gates range from layout safety to typography purity, acting as prompt-level
constraints6.

### **Impeccable: Deterministic Detection and Composition Axes**

Impeccable approaches the problem by providing the language model with a massive vocabulary upgrade, backed by strict
deterministic tooling. Instead of a monolithic prompt, Impeccable injects seven highly specific reference documents into
the AI's context based on the task at hand4. Furthermore, it supplies 23 steering commands, establishing a shared design
vocabulary between the developer and the AI1.
While Hallmark relies on "Macrostructure \+ Theme", Impeccable relies on "Composition Axes". Impeccable’s aesthetic is
built on bold section contrast, semantic token mapping, and principles such as "Warmth With Authority" and "Poster
Logic"11. It enforces that structural composition should dictate visual rhythm, completely avoiding the SaaS minimalism
that plagues AI generation11.
Impeccable’s most powerful architectural component is its deterministic detector. Unlike Hallmark, which relies on the
LLM to self-regulate, Impeccable utilizes a standalone Command Line Interface. This CLI scans HTML, CSS, JSX, and Svelte
files against 59 deterministic rules without requiring an API key or language model intervention3. The rule engine
utilizes a dual-adapter system. A lightweight JSDOM environment provides rapid static analysis, while a browser adapter
utilizes Puppeteer to measure true layout dimensions3. This allows Impeccable to mechanically catch spatial violations
that the language model simply cannot see during text generation.

### **Synthesizing the Architectural Paradigms**

Hallmark's "Macrostructure \+ Theme" approach is exceptional for greenfield generation, ensuring structural variety from
the outset. However, it relies heavily on the LLM's ability to follow complex rules in a long context window, leading to
inevitable model drift where the AI simply ignores gates. Impeccable's "Composition Axes" and deterministic CLI ensure
absolute programmatic compliance, but lack the forced structural variety of Hallmark's macrostructures.
The optimal architecture for Savant Code must merge these paradigms. The system will use Hallmark's Macrostructure \+
Theme approach to initially scaffold the wireframe and prevent repetition. It will then apply Impeccable's Composition
Axes to refine the aesthetic relationships and typography. Finally, it will utilize Impeccable's deterministic CLI
architecture as a strict verification gate, completely removing the reliance on the LLM's self-regulation for mechanical
compliance.

## **Integration Architectures Across Frontier Coding Agents**

Understanding how Hallmark and Impeccable currently integrate with frontier coding agents is critical for designing the
Savant Code implementation. Both systems operate as "skills"—contextual instruction sets that modify the behavior of the
underlying agentic loop.

### **The SKILL.md Pattern**

The foundational integration layer for both systems is the SKILL.md pattern. This involves placing a specifically
formatted markdown file within the project or global configuration directory of the coding assistant. This file acts as
the AI's primary design vocabulary and rulebook.

* **Cursor**: Both systems integrate natively with Cursor by placing instruction files in the .cursor/rules/ directory5.
* Impeccable utilizes a pre-edit hook via .cursor/hooks.json, triggering deterministic checks before the agent commits
* an edit1.
* **Claude Code**: Integration involves placing skills in the .claude/skills/ directory. Impeccable extends this by
* modifying the .claude/settings.local.json file to run hook scripts directly within the shared settings architecture,
* honoring in-place execution1.
* **Codex**: For OpenAI’s Codex CLI, skills are installed globally in \~/.codex/skills/ or project-scoped. Impeccable
* maps its 23 commands to Codex's /prompts: prefix and relies on a committed .codex/hooks.json file to trigger its
* detector5.

### **Handling Theme Switching and Customization**

Hallmark handles theme switching dynamically during the generation phase. By parsing the prompt, the agent selects one
of the 20 catalog themes. If the prompt contains specific creative intent that falls outside the catalog, Hallmark
switches to a "Custom" route, generating a made-to-measure palette and layout while retaining the 57 slop-test gates5.
Impeccable handles customization through a one-time initialization flow. The /impeccable init command gathers project
context, brand lane, voice, and color preferences, writing this configuration to a DESIGN.md file. Subsequent commands
read this file, ensuring that the AI’s output aligns perfectly with the developer’s established design system1.
For Savant Code, the integration architecture will adopt Impeccable's automated hook injection while supporting
Hallmark's dynamic theme switching. Savant Code will utilize the .agents/skills/savant-design/ directory to house the
primary SKILL.md and domain references, ensuring cross-agent compatibility and centralized rule management1.

## **Rule Synthesis: The Minimal High-Impact Ruleset**

Synthesizing Hallmark’s 57 gates and Impeccable’s 59 rules requires eliminating redundancies and identifying the
highest-impact constraints. The overlapping rules between the two systems represent the undeniable consensus of AI
design failures, while their unique rules offer specialized protections. The goal for Savant Code is to define a minimal
set of rules that covers 90% of AI design slop without overwhelming the context window or execution latency.

### **Overlapping Consensus Rules**

| Design Domain | Hallmark Gate / Concept | Impeccable Rule / Concept | Synthesized Savant Code Rule |
| :---- | :---- | :---- | :---- |
| **Typography** | Gate 38a: Absolute ban on italic headers and single-font pages6. | Typography Reference: Ban on Inter/Roboto default; requirement for hierarchical fluid scales4. | **Typographic Purity**: Mandatory pairing of distinct display and body faces. Complete prohibition of default sans-serifs (Inter, Arial). Strict ban on italicized display headers. |
| **Color & Contrast** | Gate 48: Locked tokens; no inline hex/rgb. Gates 40-41: Strict contrast floors6. | Color Reference: Ban on pure black/white; mandate tinted neutrals and OKLCH4. | **Tokenized OKLCH Pipeline**: All color values must be expressed via named OKLCH CSS variables. Absolute ban on inline \#000 or \#FFF. Neutrals must carry a subtle base hue tint. |
| **Layout & Structure** | Gate 34: No hidden overflow; strict mobile wrapping requirements via Gates 49-526. | Layout Reference: Ban on nested cards and symmetric centering4. | **Asymmetric Resilience**: Interfaces must favor asymmetric alignment and left-aligned text. Mobile responsiveness is a hard floor (no horizontal scroll, minmax grid tracks). Nested card wrappers are strictly forbidden. |
| **UI Components** | Gate 47: No re-drawn UI chrome (e.g., fake browsers or devices)6. | AI Tells: Ban on large rounded icons above headings and side-tab borders3. | **Component Authenticity**: Reliance on semantic HTML over arbitrary UI decoration. Complete prohibition on fake browser/phone bezels and decorative icon-tile stacks. |

### **Unique Contributions to the Ruleset**

Hallmark contributes the critical "Honest Copy" rule (Gate 46), which explicitly forbids the hallucination of metrics,
testimonials, or corporate logos6. It also brings the Theme-Diversification Rule, forcing structural variation across
consecutive prompts6. Impeccable contributes deep motion design constraints, banning bounce or elastic easing and
restricting CSS transitions to hardware-accelerated properties4. Impeccable also introduces the concept of structural
AST validation, allowing rules to be enforced mathematically rather than linguistically7.

### **The Distilled 90% Coverage Matrix**

The following matrix represents the distilled, minimal ruleset for Savant Code. These rules are prioritized by their
impact on reducing the "AI feel" and are categorized by their enforcement mechanism.

| Priority | Category | Rule Definition | Enforcement Mechanism (Savant Code) |
| :---- | :---- | :---- | :---- |
| 1 | **Color** | **OKLCH Tokenization**: Absolute prohibition of uncalibrated HEX values. Force OKLCH perceptual uniformity. | Deterministic AST/Regex parsing for hardcoded hex strings during pre-commit. |
| 2 | **Typography** | **Dual-Face Hierarchy**: Ban Inter/Roboto. Mandate distinct display and body faces. | Deterministic CSS parser checking :root font-family declarations. |
| 3 | **Layout** | **Anti-Nesting & Rhythm**: Ban card \> card structures. Mandate a 4px/8px baseline grid system. | JSDOM static HTML analysis checking structural depth and explicit dimension strings. |
| 4 | **Content** | **Factual Austerity**: Ban fabricated numbers, fake logos, and hallucinatory social proof. | Generative enforcement via the Pre-Emit Self-Critique (PHESRV Gate). |
| 5 | **Motion** | **Performant Easing**: Ban layout property transitions. Enforce cubic-bezier deceleration. | Deterministic CSS AST parsing checking transition properties. |
| 6 | **Structure** | **Mobile Floor**: Ban horizontal scroll. Enforce single-column wrapping and fluid grid tracks. | Puppeteer/Browser adapter measuring getBoundingClientRect for layout overflows. |

## **Savant Core Form Architecture (SCFA) Proposal**

To exceed the capabilities of both Hallmark and Impeccable combined, the Savant Code harness requires an architecture
that seamlessly blends generative imagination with deterministic rigidity. The Savant Core Form Architecture (SCFA) is
designed to operate concurrently across four operational modes: Generative Framing, Deterministic Detection, AST-Aware
Scaffolding, and ECHO Protocol Integration.

### **Layer 1: Contextual Priming and Generative Guardrails**

When a design task is initiated, Savant Code loads a tailored .agents/skills/savant-design/SKILL.md file into the
context window. This file acts as the language model's central nervous system for design.

* **Dynamic Domain Injection**: Mirroring Impeccable’s architecture, the system dynamically injects highly specific
* reference documents based on the user's intent. If the user requests animation, motion-design.md is appended; if they
* request a theme change, color-and-contrast.md is loaded4.
* **Shared Command Vocabulary**: The agent is programmed to recognize and execute specific steering commands,
* establishing a robust vocabulary. Commands such as /craft (shape-then-build), /audit (review against anti-patterns),
* /distill (strip complex UI to its essence), and /typeset (fix fluid typography) act as immediate contextual triggers1.
* **The PHESRV Halting Gate**: Borrowing from Hallmark, before the language model is permitted to generate the final
* code block, it is explicitly instructed to halt and write a markdown reasoning block. It must evaluate its proposed
* design on the six Hallmark axes: Philosophy, Hierarchy, Execution, Specificity, Restraint, and Variety. If the model
* scores itself below a 3 on any axis, it is forced to internally self-correct before presenting output6.

### **Layer 2: AST-Aware CSS/HTML Scaffolding and Live Feedback**

Language models are inherently blind; they predict text without visually perceiving the interfaces they construct. SCFA
introduces a middle layer that intercepts the LLM's raw output before it reaches the file system.

* **Automatic Token Standardization**: A lightweight JavaScript parser analyzes the generated CSS Abstract Syntax Tree.
* If it detects hardcoded hex values or arbitrary paddings (e.g., padding: 17px), it automatically scaffolds a :root
* token block. It mathematically maps the arbitrary values to the closest design system token (e.g., var(--space-4)).
* **Live DOM Iteration**: Adapting Impeccable’s live/svelte-ast.mjs architecture, SCFA utilizes a framework-agnostic AST
* resolver. This module resolves the compiler from the user app's node\_modules at runtime and injects generated code
* directly into the browser's live DOM via a local WebSocket7. This provides the developer with real-time visual
* variants, allowing for immediate rejection or acceptance. Rejected variants trigger feedback loops, routing rationales
* back to the LLM to refine the subsequent generation.

### **Layer 3: Deterministic Detection and ECHO Protocol Gates**

The ECHO Protocol acts as the unyielding, deterministic judge of the emitted code. We deploy an optimized,
zero-dependency version of Impeccable's rule engine (cli/engine/detect-antipatterns.mjs) directly into the Savant Code
verification pipeline7.

* **Tiered Static Analysis**: The system passes the HTML, CSS, and JSX through a local JSDOM environment. Adapters run
* pure check functions (checkElementXxx) to identify mechanical violations, such as nested cards, missing overflow-x:
* clip, and invalid clamp() typography structures7.
* **True Layout Validation**: Because JSDOM cannot calculate actual spatial layout (as getBoundingClientRect() returns
* zero values), SCFA deploys a secondary browser adapter7. Utilizing a headless browser instance, the engine briefly
* mounts the UI to verify that elements do not collide, mobile wrapping behaves correctly, and primary tap targets meet
* accessibility thresholds.
* **ECHO Protocol Enforcement**: The detection script runs on every relevant file edit. If the deterministic rule engine
* detects an anti-pattern, it throws an Exit Code 23. The ECHO protocol intercepts this commit rejection, captures the
* JSON output of the violations (e.g., \[Rule Violation: icon-tile-stack detected on H3\]), feeds this specific error
* directly back into the LLM's context, and forces an automatic revision without user intervention3.

## **Core Design Skill Representation: SKILL.md Draft**

The following represents the foundational SKILL.md instruction file, designed to reside in the
.agents/skills/savant-design/ directory. It synthesizes Hallmark's strict behavioral gating with Impeccable's
deep-domain commands and OKLCH mandates.

# **Savant Core Form Architecture (SCFA) Design Skill**

## **Description**

Use this skill when the user requests to build, redesign, audit, shape, polish, or clarify a frontend user interface.
This skill enforces rigorous, high-quality, and anti-slop design principles, guaranteeing that the output looks
meticulously engineered rather than probabilistically generated.

## **Core Directives & Anti-Slop Taxonomy**

You are strictly forbidden from utilizing the statistical defaults common to AI-generated code. You must adhere to the
following deterministic rules:

### **1\. Typography Purity**

* **DO NOT** use Inter, Roboto, Arial, or system default fonts as the primary display face. You must pair a distinctive
* display font with a highly legible body font.
* **DO NOT** use italicized text in display headers or headings (font-style: italic on h1-h6 is banned).  
* **DO NOT** use monospace fonts to artificially create "developer vibes" unless the content is genuinely technical
* code.
* **DO** use fluid typography scales (clamp()) for all primary text hierarchies to ensure optical rhythm.

### **2\. Chromatic Discipline (OKLCH)**

* **DO NOT** output pure black (\#000000) or pure white (\#FFFFFF). All neutrals must be mathematically tinted with the
* anchor brand hue.
* **DO NOT** use the predictable "AI Palette" (cyan-on-dark, purple-to-blue gradients, or neon-on-dark).  
* **DO NOT** place gray text on colored backgrounds. Calculate a darker/lighter shade of the background color to
* maintain WCAG AA contrast.
* **DO** map every single color value to a defined var(--color-\*) OKLCH token in the :root block. Inline hex codes are
* banned and will trigger a pipeline failure.

### **3\. Spatial & Compositional Rigor**

* **DO NOT** wrap every distinct UI element in a rounded card.  
* **DO NOT** nest cards inside of cards (The Card Matryoshka anti-pattern).  
* **DO NOT** default to symmetric, centered-everything layouts. Favor asymmetric, left-aligned compositions that create
* visual tension and rhythm.
* **DO NOT** place a large, rounded, brightly colored icon directly above every h3 in a grid.  
* **DO** use a strict 4px/8px baseline grid for all padding, margins, and gaps.

### **4\. Honest Content & Motion**

* **DO NOT** invent or fabricate metrics (e.g., "10x faster", "Trusted by 50,000 teams"), testimonials, or corporate
* logos. If data is missing, design a structurally different layout or use explicit placeholder blocks.
* **DO NOT** hand-draw fake browser windows or phone bezels using HTML/CSS.  
* **DO NOT** use bounce or elastic easing for animations. Use smooth exponential deceleration (cubic-bezier).  
* **DO NOT** animate layout properties (width, height, padding). Animate only transform and opacity.

## **Operational Modes (Commands & Verbs)**

You are equipped to respond to specific operational commands invoked by the user:

* /build or /craft: Design a new page or component from scratch. You must first define a Macrostructure and Theme,
* ensuring the theme differs from the last generated UI (vary the Paper Band, Display Style, or Accent Hue).
* /audit: Review an existing UI against the Anti-Slop Taxonomy. Do not edit the code; provide a diagnostic punch-list of
* violations.
* /redesign: Keep the exact existing content and information architecture, but completely replace the structural
* fingerprint and CSS implementation.
* /polish: Perform a final refinement pass focusing on micro-interactions, focus states, and spacing normalization.  
* /typeset: Re-calculate and apply fluid typography scales to an existing interface.

## **Mandatory Pre-Emit Self-Critique (PHESRV Gate)**

**CRITICAL INSTRUCTION:** Before you emit any final HTML, CSS, or component code, you MUST generate a markdown reasoning
block evaluating your proposed design. You must score your design on a scale of 1 to 5 across the following six axes:

> 1. **Philosophy (P)**: Does the design serve the user's specific intent, or is it a generic template?  
> 2. **Hierarchy (H)**: Is the most critical action immediately obvious without scanning?  
> 3. **Execution (E)**: Are all tokens properly mapped? Are accessibility standards met?  
> 4. **Specificity (S)**: Is the typography paired deliberately? Are the colors mathematically tinted?  
> 5. **Restraint (R)**: Have unnecessary borders, shadows, and redundant cards been eliminated?  
> 6. **Variety (V)**: Does this structure avoid repeating the exact layout of the previous generation?

*If ANY score is below 3, you must internally revise your design plan before outputting code.*  
Upon successful generation, you must stamp the top of the code file with the exact scores as a CSS comment:/\* SCFA
Pre-Emit Critique: P\[x\] H\[x\] E\[x\] S\[x\] R\[x\] V\[x\] \*/

## **Mobile Responsiveness (Non-Negotiable)**

Your output must render flawlessly down to 320px width.

* Enforce overflow-x: clip on html and body roots.  
* Ensure tap targets (buttons, primary links) NEVER wrap to two lines.  
* Ensure image-bearing grid tracks use minmax(0, 1fr).

## **Phased Implementation Plan**

Integrating the Savant Core Form Architecture into the Savant Code harness requires a deliberate, phased rollout.
Because both Hallmark and Impeccable are open-source projects (MIT and Apache 2.0, respectively), the assimilation of
their zero-cost dependencies and structural logic can proceed without licensing friction9.

### **Phase 1: Cognitive Integration & Skill Injection**

**Objective:** Establish the design vocabulary and generative boundaries within the Savant Code language model.

> 1. **Directory Provisioning**: Create the .agents/skills/savant-design/ directory within the Savant Code global or
> 1. project-level configuration path1.
> 2. **Skill Deployment**: Deploy the finalized SKILL.md (drafted above) as the primary instruction layer.  
> 3. **Domain File Mapping**: Adapt Impeccable’s 7 domain files (typography.md, color-and-contrast.md,
> 3. spatial-design.md, motion-design.md, interaction-design.md, responsive-design.md, ux-writing.md) into a references/
> 3. subdirectory4. Configure the Savant agent to dynamically append the relevant markdown files into the context window
> 3. when corresponding keywords are detected in the user prompt.

### **Phase 2: ECHO Protocol Deterministic Integration**

**Objective:** Mechanically ensure the language model cannot hallucinate past the established design rules.

> 1. **Rule Engine Porting**: Port the core logic of Impeccable’s detect-antipatterns.mjs engine into Savant Code’s ECHO
> 1. Protocol verification scripts, establishing the rule array and metadata definitions7.
> 2. **AST Adapter Implementation**: Implement the dual-adapter system. Use the lightweight JSDOM environment adapter
> 2. (checkElementXxx(el, tag, window)) for rapid, pre-commit static analysis of all generated JSX/HTML outputs7.
> 3. **ECHO Gate Construction**: Construct a pre-commit hook within Savant Code that runs the CLI detector locally
> 3. (e.g., savant detect \--fast). If the process returns an exit code of 2 (indicating anti-patterns detected), the
> 3. ECHO protocol intercepts the commit, pipes the specific JSON output of the violations back to the language model,
> 3. and commands an automatic revision3.

### **Phase 3: The Live Scaffolding Loop**

**Objective:** Enable rapid, browser-based visual iteration to remove the latency of blind code generation.

> 1. **Framework-Agnostic Scaffolder**: Implement an AST-aware scaffolder akin to Impeccable's svelte-ast.mjs, expanding
> 1. its logic to support React/Next.js and Vue component trees7. This script operates continuously in the background,
> 1. resolving the required compiler from the user application's node\_modules at runtime.
> 2. **Agent Pluggability**: Expose a dedicated interface layer (e.g., generateVariants(event, context) \-\> {
> 2. scopedCss, variants\[\] }) that permits the Savant Code agent to stream proposed CSS changes directly into the
> 2. local development server's DOM via WebSocket injection7.
> 3. **Feedback Synchronization**: Create a bidirectional feedback loop. If the developer rejects a variant in the live
> 3. browser view, the rejection rationale is immediately routed back to the LLM, triggering the /craft loop anew with
> 3. heightened weighting on the previously failed PHESRV axes.

### **Phase 4: Statefulness and Structural Diversification**

**Objective:** Prevent repetitive template generation across sequential prompts and distinct development sessions.

> 1. **Manifest Tracking**: Implement a lightweight local JSON manifest (.savant/design.json) that persistently logs the
> 1. "Macrostructure," "Paper Band," "Display Style," and "Accent Hue" of the last five generated interface components.
> 2. **Diversification Enforcement**: When the /build or /craft command is invoked, program the agent to read the
> 2. manifest history. The agent must mathematically prove within its pre-emit reasoning block that the newly proposed
> 2. theme and macrostructure differ from the logged history on at least one distinct vector, guaranteeing structural
> 2. variety across the lifecycle of the project6.

#### **Works cited**

> 1. GitHub \- pbakaus/impeccable: The design language that makes your AI harness better at design.,
> 1. [https://github.com/pbakaus/impeccable](https://github.com/pbakaus/impeccable)
> 2. Impeccable \- Mintlify,
> 2. [https://www.mintlify.com/explore/pbakaus/impeccable](https://www.mintlify.com/explore/pbakaus/impeccable)
> 3. README.npm.md \- pbakaus/impeccable \- GitHub,
> 3. [https://github.com/pbakaus/impeccable/blob/main/README.npm.md](https://github.com/pbakaus/impeccable/blob/main/README.npm.md)
> 4. Impeccable: The Design Skill That Stops Your AI-Generated UIs from Looking Like AI (Complete Guide) \- Emelia.io,
> 4. [https://emelia.io/hub/impeccable-ai-design-skill](https://emelia.io/hub/impeccable-ai-design-skill)
> 5. GitHub \- Nutlope/hallmark: Anti-AI-slop design skill for Claude Code, Cursor, and Codex.,
> 5. [https://github.com/nutlope/hallmark](https://github.com/nutlope/hallmark)
> 6. [https://github.com/nutlope/hallmark/blob/main/skills/hallmark/SKILL.md](https://github.com/nutlope/hallmark/blob/main/skills/hallmark/SKILL.md)
> 7. impeccable/CLAUDE.md at main \- GitHub,
> 7. [https://github.com/pbakaus/impeccable/blob/main/CLAUDE.md](https://github.com/pbakaus/impeccable/blob/main/CLAUDE.md)
> 8. The Complete Guide to "Impeccable": Eradicating "Mass-Produced UI" Generated by AI｜アイドリ | AI-Driven Lab \- note,
> 8. [https://note.com/ai\_driven/n/n6c858c3617b6?hl=en](https://note.com/ai_driven/n/n6c858c3617b6?hl=en)
> 9. pbakaus/impeccable \- 55.5k Stars · Global Rank \#401 \- GitHub Star History,
> 9. [https://www.star-history.com/pbakaus/impeccable/](https://www.star-history.com/pbakaus/impeccable/)
> 10. Hallmark — A design skill that refuses to look AI-generated,
> 10. [https://www.usehallmark.com/](https://www.usehallmark.com/)
> 11. Impeccable Design Skill File \- TypeUI,
> 11. [https://www.typeui.sh/design-skills/impeccable](https://www.typeui.sh/design-skills/impeccable)
> 12. Build an AI Design System with Impeccable \- Terminal Skills,
> 12. [https://terminalskills.io/use-cases/build-ai-design-system-with-impeccable](https://terminalskills.io/use-cases/build-ai-design-system-with-impeccable)
> 13. hallmark/skills/hallmark/SKILL.md at main · Nutlope/hallmark \- GitHub,
> 13. [https://github.com/Nutlope/hallmark/blob/main/skills/hallmark/SKILL.md](https://github.com/Nutlope/hallmark/blob/main/skills/hallmark/SKILL.md)
> 14. Hallmark by Nutlope: Anti-AI-Slop Design Skill for Claude Code, Cursor, and Codex,
> 14. [https://explainx.ai/blog/nutlope-hallmark-anti-ai-slop-design-skill-july-2026](https://explainx.ai/blog/nutlope-hallmark-anti-ai-slop-design-skill-july-2026)
> 15. UX Design Agent Skill \- Impeccable,
> 15. [https://aiuxplayground.com/skills/impeccable/](https://aiuxplayground.com/skills/impeccable/)
> 16. impeccable/skill/reference/hooks.md at main \- GitHub,
> 16. [https://github.com/pbakaus/impeccable/blob/main/skill/reference/hooks.md](https://github.com/pbakaus/impeccable/blob/main/skill/reference/hooks.md)
> 17. Codex CLI Guide \- Impeccable,
> 17. [https://pbakaus-impeccable.mintlify.app/guides/codex-cli](https://pbakaus-impeccable.mintlify.app/guides/codex-cli)