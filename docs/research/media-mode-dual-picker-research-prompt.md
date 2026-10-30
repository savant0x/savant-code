# Research prompt — dual-mode model picker (text vs. media generation)

**FID:** `FID-2026-1030-002`
**Created:** 2026-10-30
**Status:** prompt authored, research not yet run
**Evidence base:** `docs/reports/video-modality-feasibility.md` (FID-2026-1030-001)

---

## How to use this artifact

The prompt below is written to be copied verbatim into a deep-research service
(Gemini Deep Research was the intended target). Attach the files listed in
"Attachment manifest" before submitting, so the research has the repository's
own governance context rather than a summary of it.

Once research returns, the result feeds the design decision recorded in
"Open decision" below. No code is written until that decision converges.

---

## Repository links

| Purpose | Link |
|---|---|
| Subject repository | `https://github.com/savant0x/savant-code` |
| Reference implementation studied | `https://github.com/anomalyco/opencode` (the `packages/ai` workspace) |
| Published package | `https://www.npmjs.com/package/savant-code` |

**Local facts to state in the prompt** (the research service cannot infer these):
release `v0.0.36`, TypeScript monorepo on Bun, ECHO Protocol v0.2.0 governance.

---

## Attachment manifest

| File | Why it is in scope |
|---|---|
| `ECHO.md` | The engineering protocol. Establishes that a design must converge in a FID before any code is written — the research should respect that constraint. |
| `protocol.config.yaml` | Workspace list, verbatim command set, and the live gates. Gives the model concrete structure to reason against. |
| `ARCHITECTURE.md` | Agent roster and runtime enforcement model. |
| `SCOPE.md` | The approved-work register. Shows what a landed design must write into. |
| `docs/reports/video-modality-feasibility.md` | The evidence base this research extends. Contains the drop-point analysis and the open live-probe questions. |

Attach at minimum `ECHO.md`. The others sharpen the answer but are not
prerequisites.

---

## The prompt

The block below is the deliverable. Copy from `# Design Research Request` to the
end of section 6.

````markdown
# Design Research Request: A Dual-Mode Model Picker for a Coding Harness (Text vs. Media Generation)

## 1. Who I am and what I need

I maintain **Savant-Code**, an open-source, terminal-native, multi-agent AI coding
assistant. I want your help designing **one specific architectural decision** and
I want it grounded in how real systems solve it, not in generic advice.

**The decision:** Savant's model picker currently shows only text/coding models.
I want to add the ability to run **image and video generation models** through the
same harness. My working hypothesis is a **mode switch**: a setting that toggles
the picker between a *text mode* (coding models only) and a *media mode*
(image/video generation models). I want you to pressure-test that hypothesis
against prior art and tell me whether it is the right shape — and if not, what is.

Please treat the mode-switch idea as a *hypothesis to evaluate*, not a conclusion
to defend. I am specifically interested in where it breaks.

## 2. Context — what the codebase looks like today

**Repository:** `https://github.com/savant0x/savant-code`
**I will attach:** `ECHO.md` (my engineering protocol) and relevant config files.

Key facts about the current architecture, so you can reason concretely:

- **Stack:** TypeScript monorepo, Bun runtime, React/OpenTUI for the terminal UI.
- **Provider layer:** `packages/llm-providers/` implements an OpenAI-compatible
  provider. It builds exactly four model kinds from one factory
  (`createOpenAICompatible` in `openai-compatible-provider.ts`):
  `chat`, `completion`, `embedding`, and `image`.
- **The only generation shape that exists** is
  `OpenAICompatibleImageModel` (`openai-compatible/image/openai-compatible-image-model.ts`).
  It implements `ImageModelV2` from `@ai-sdk/provider`, POSTs to
  `/images/generations`, and decodes a **synchronous** response:
  `{ data: [{ b64_json }] }`. There is no job id, no status poll, no result fetch,
  no artifact expiry.
- **Model discovery:** a daily harvest pipeline scrapes free-tier provider
  catalogs and maintains a candidate roster. It already **discovers video models**
  (e.g. `grok-imagine-video-1.5`, `MiniMax-H3`, `veo-3.1-ref`,
  `lyria-3-clip-preview`, `gemini-omni-1.1-flash`) and writes them into the roster.
- **The drop point:** `cli/src/utils/openrouter-models/catalog-filter.ts`
  contains a regex `NON_CODING_MODEL_PATTERN` that explicitly names
  `image|video|veo|lyria|tts|embedding|…|omni` and classifies any match as
  **not a coding-harness model**. A second function `assessCodingModel()` drops
  a model with `reason: 'specialist'` on the name match, and with
  `reason: 'non-text'` if its `outputModalities` do not include `'text'`.
  The filter's own comment says its catalog is "consumed by the coding harness,
  not by the product's media, retrieval, safety, or research surfaces."
- **Consequence:** video models are discovered, listed, and correctly excluded
  from the coding picker — because there is no media surface for them to enter.
- **Reference implementation I studied:** a sibling open-source agent project
  (`https://github.com/anomalyco/opencode`, the `packages/ai` workspace) has
  implemented a full media-modality abstraction. Its `VideoModel` / `VideoClient`
  / `MediaModel` triad treats video as a peer of image/speech/transcription, with
  a `MediaProtocol.queued` route (submit → poll status → fetch result → cancel)
  used by four provider protocols (Google Veo, xAI, Runway, fal.ai). Its API
  surface is `Video.request | start | generate | resume | stream` plus a tagged
  event union (`generation-queued | generation-progress | video | finish`).
  I have reviewed this code; I do not want to port it wholesale, because its
  Effect-based service layer does not match my plain-async architecture.

## 3. The core problem to solve

A coding harness and a media-generation harness have **structurally different
execution shapes**:

| | Text / coding | Video generation |
|---|---|---|
| Latency | seconds | 30 s – several minutes |
| Response | streamed tokens | a job id, then an artifact URL |
| Interaction | conversational, multi-turn | one-shot prompt → artifact |
| Cost unit | tokens | seconds of video / credits |
| Failure modes | refusal, truncation | moderation filter, expiry, quota |
| Retry semantics | re-prompt | re-submit is expensive; poll instead |

My hypothesis is that a **mode switch** (text mode ↔ media mode) is the cleanest
way to reconcile these, because the two shapes should not be peer-selectable in
one flat picker.

## 4. Questions I need you to answer

Please answer each explicitly, and **cite prior art with links** wherever possible.

### Q1 — Prior art: how do real systems gate model selection by modality?

Survey how the following handle *multi-modality model selection in one product*:
OpenAI Playground / API, Google AI Studio, Anthropic Console, Replicate,
fal.ai, Vercel AI Gateway, Cursor, GitHub Copilot, LM Studio, Ollama, ComfyUI,
InvokeAI, and any agent framework you consider relevant (LangChain, Vercel AI SDK,
Mastra, etc.). For each: is modality a **mode/tab**, a **filter facet**, a
**separate product surface**, or **one unified list**? What did they choose and
why? Which choices have visibly failed or been reversed?

### Q2 — Is "mode switch" the right primitive?

Evaluate my hypothesis against alternatives:

- **(a) Mode switch** — a top-level setting that swaps the picker's model set.
- **(b) Filter facets** — one picker, checkboxes for modality (text/image/video).
- **(c) Separate product surfaces** — no shared picker at all.
- **(d) Capability-driven** — the picker shows whatever the current *task*
  requires; the agent declares the modality it needs, not the user.
- **(e) Hybrid** — e.g. mode switch for the primary picker, capability-driven
  for agent-invoked generation.

For each, give the failure mode. Specifically: **what breaks when a user is in
text mode but the agent decides mid-task that it needs to generate an image?**
That transition case is the one I am least sure about, and I want a concrete
recommendation with reasoning.

### Q3 — State, persistence, and least-surprise

If a mode switch exists:

- Where should the mode live — ephemeral session state, a persisted setting,
  or per-conversation?
- What happens to an in-flight session when the mode flips?
- Should the mode be per-window, per-project, or global?
- How do you avoid the failure mode where a user is silently in the "wrong"
  mode and sees an empty or confusingly-filtered model list?
- What signals make the current mode unmistakable in a TUI (no mouse, limited
  chrome)?

### Q4 — The execution model: singular vs. plural, sync vs. queued

My review of the reference implementation suggests the real missing piece is not
"a video model" but **a queued, poll-until-ready generation primitive** that
image and video can share (image today is synchronous and inline; video is
submit-then-poll). Evaluate:

- Should the abstraction be a **modality-generic generation route**
  (parameters: sync vs. queued), or keep sync-image and queued-video as
  separate contracts?
- How should a long-running job be surfaced in a terminal UI — progress bar,
  event stream, background job list? What do real CLIs do?
- How do you handle a job whose artifact **expires** (my reference implementation
  notes Google Veo files live 2 days behind an API key, Runway outputs 24–48 h)?
- Cancellation, resumption across process restart, and cost guarding for
  expensive jobs — what patterns are proven?

### Q5 — The agent-tool question

If Savant gains image/video generation, it should arguably be an **agent tool**
(the agent generates media as part of a task) rather than only a user-driven
picker. Address:

- Tool-versus-picker: which is primary, and does that change the mode design?
- Tool schema for a long-running generation task — how do you keep the agent loop
  from blocking for 3 minutes? What do frameworks with long-running tools do?
- How should generated artifacts be surfaced back into a conversation and into
  the repo working tree?
- Budget/abuse controls when an autonomous agent can spend real money per call.

### Q6 — Security, compliance, and safety

- Provider credential handling when the artifact URL itself is credential-bearing
  (my reference implementation's assets carry live provider headers transiently
  and forbid persisting them). What is the correct discipline?
- Provenance and disclosure duties: C2PA Content Credentials, the EU AI Act
  Article 50 machine-readable-marking requirement (effective 2 Aug 2026), and
  US CSAM reporting duties. What must a small open-source coding agent
  *actually* implement, versus what is out of scope for its scale?
- Moderation outcomes: how should a content-policy refusal from a provider be
  represented so the user understands it is the provider's decision, not a bug?

### Q7 — What I have probably not considered

Tell me what I have missed. What is the non-obvious trap in adding media
generation to a coding harness? What decision will I regret in two years if I
get it wrong now?

## 5. What I want back

1. **A direct recommendation** on Q2 with the reasoning and the rejected
   alternatives stated plainly.
2. **A concrete design sketch** for the recommended approach: where the mode
   lives, how the picker filters, how the generation route is shaped, how a
   long-running job is surfaced.
3. **A prioritized list of traps** (Q7) with the mitigating design move for each.
4. **A short list of prior-art links** worth reading in full.
5. **Explicitly: where you disagree with my hypothesis**, and what evidence would
   change your mind.

Please distinguish **evidence** (a system actually does X, with a source) from
**your opinion** (X seems better). I would rather have a small number of
well-sourced claims than a large number of confident ones.

## 6. Scope note

This is a **design research** task, not an implementation task. I am not asking
for code. I am asking which shape to commit to before I write the FID — a
Feature Implementation Document that must converge before any code is written,
per my engineering protocol (attached).

Do not propose a specific library to install unless you can name a system that
has shipped it at scale. Do not propose a database schema — that is downstream
of the shape decision and would be premature.
````

---

## Open decision

The research result feeds exactly one decision:

> **Is a user-facing mode switch the right primitive for gating model selection by
> modality, and how is the agent-invoked generation case served?**

Candidate answers the research is expected to weigh are the five in Q2. The
recommendation becomes the shape spec for a design FID; no implementation work
begins before that FID converges.

## Deliberate exclusions

Recording what the prompt does **not** ask, so the omissions are choices rather
than oversights:

- **No provider or model recommendation.** Which video provider to integrate first
  depends on the live capability probes recorded as open questions in
  `docs/reports/video-modality-feasibility.md` §4, and those need operator-held
  API keys. A literature search cannot answer them and mixing the two would
  blur both.
- **No database schema.** Downstream of the shape decision.
- **No library recommendation requested.** The prompt explicitly asks for
  shipped-at-scale systems rather than installable packages.