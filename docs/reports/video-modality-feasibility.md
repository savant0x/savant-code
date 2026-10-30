# Video modality feasibility — evidence report

**Status:** read-only evidence. No source code changed, no behavior changed.
**FID:** `FID-2026-1030-001`
**Created:** 2026-10-30

---

## Question

Does Savant already have access to video-capable models, and if so, why can the
harness not use them?

## Answer

Video-capable models are **already reachable** through the provider pipeline and
are **already discovered** by the daily harvest. The harness cannot use them
because it has exactly one generation shape — inline `image` — and no queued
poll-until-ready sibling. Video model IDs pass every catalog and discovery gate
and are dropped at the routing layer for lack of feature support, not for lack
of access.

This report records the three independent artifacts that corroborate that
finding, the two host probes that matter, the one host that is a trap, and the
questions that still require a live probe to answer.

---

## 1. Confirming artifacts

Three independent surfaces each list video-capable model IDs. None of them
shares a storage path or a fetch step with the others, so agreement between
them is corroboration rather than repetition.

### 1.1 Wired free-options digest

Path: `~/.savant-code-dev/free-options.md`, generated `2026-10-30T18:04:17Z`,
generation id `sha256:7ab55807451fc38f98909647db36cd220fbb4eb5732d9a38814da51c46f5edae`.

Under **"Wired — advertised free models; account access unverified"** the digest
lists video and video-adjacent model IDs behind providers whose keys are already
configured:

| Provider | Model IDs | Note |
|---|---|---|
| OpenRouter | `google/lyria-3-pro-preview`, `google/lyria-3-clip-preview` | Lyria 3 family |
| Google AI | `lyria-3-clip-preview`, `lyria-3-pro-preview`, `lyria-3.5` | three Lyria 3 IDs |
| Google AI | `gemini-omni-flash-preview`, `gemini-omni-1.1-flash` | Omni generation family |
| NVIDIA NIM | `nvidia/ai-synthetic-video-detector`, `nvidia/cosmos-reason2-8b` | video *understanding*, not generation |

The digest's own header constrains what this proves: *"it does not certify
account access or tool support"* and *"Configured keys and public listings do
not verify your account quota."* The correct reading is **advertised and wired**,
not **entitled and callable**.

### 1.2 Launch harvest scrape

Paths: `dev/provider-candidates/candidates.json` and
`dev/provider-candidates/report.md`, probe run `2026-10-30T18:04:15Z`, feed 220
records, pipeline `FID-2026-0914-003`.

The candidate roster records video model IDs as plain strings:

| Host | Host | Probe | Models |
|---|---|---|---|
| `console.flatkey.ai` | commercial aggregator | `lastBoundary: boundary-ok`, `lastProbe.reachable: true`, `latencyMs: 1051` | `sonilo-video-to-music`, `MiniMax-H3`, `grok-imagine-video`, `grok-imagine-video-1.5`, plus `grok-imagine-image`, `grok-imagine-image-2.0`, `grok-imagine-image-quality`, `grok-imagine-image-pro`, `gpt-image-2` |
| `newapi.prorisehub.com` | commercial aggregator | `lastBoundary: boundary-ok`, `lastProbe.reachable: true`, **`lastProbe.modelsCount: 0`** | `veo-3.1-ref`, `veo-3.1-extend`, `agnes-video-v2.0` |

`report.md` renders the same roster in prose:

- `- **console.flatkey.ai** (9 feed-listed†): sonilo-video-to-music, MiniMax-H3, grok-imagine-video, grok-imagine-image, grok-imagine-image-2.0, grok-imagine-image-quality … (+3 more)`
- `- **newapi.prorisehub.com** (40 feed-listed†): gpt-image-2-5-sunburst, lfm-2.5-2.6b:free, meta/muse-spark-1.1-c, sora-2, claude-opus-4-7-c, gpt-5.4-nano-c … (+34 more)`

The report's family rollup confirms both hosts carry `minimax` and `agnes`
respectively, and the readiness table places both in **Commercial aggregators**
behind a verified `ok` auth boundary.

**The host that matters.** `console.flatkey.ai` is probed healthy (`boundary-ok`,
100% uptime over 14 days, 897 ms average) and serves `grok-imagine-video-1.5`
and `MiniMax-H3` — two of the same providers the reference implementation in
`resources/opencode-dev/` integrates as first-class video routes. Its roster also
carries image-generation IDs alongside the video ones, which is the signature of
an OpenAI-compatible multimodal gateway rather than a bespoke video API.

**The host that is a trap.** `newapi.prorisehub.com` advertises `veo-3.1-ref`,
`veo-3.1-extend` and `agnes-video-v2.0`, and its boundary probe returns `ok` —
but its `lastProbe.modelsCount` is **0**. Per `docs/adding-a-provider.md`,
*"'The catalog lists N models' does not mean inference works."* This host
advertises Veo and confirmed nothing live. It is a lead, not a route, and no
design should be built against it. The same register also carries six
`model-family dropout` flags against this host (including `'minimax' no longer
listed by the feed`), which is consistent with an unstable catalog.

### 1.3 Advertised offers feed

Path: `~/.savant-code-dev/free-options.md`, section **"### Video (5)"** — a
first-class category in the offers classification:

- Vidu AI Video Free Credits
- Runway Free Plan
- Pika Free Plan
- Hailuo AI Video Free Tier
- `fal — MiniMax H3 Max Free Generations (T2V + I2V)` — marked `known: MiniMax`

Appearing as its own category is the strongest signal here: the discovery
pipeline already separates free video provisioning from free text and free
image provisioning. It is discovering the capability it cannot use.

The startup-programs section adds two credit paths to the exact providers the
reference implementation integrated: `Runway Builders Program` and
`fal Startup Program — $1,000–$5,000`.

---

## 2. The harness-side gap

The three artifacts above prove availability. The following proves the gap.

| Surface | Symbol / file | What it does today |
|---|---|---|
| **Drop point** | `cli/src/utils/openrouter-models/catalog-filter.ts` — `NON_CODING_MODEL_PATTERN`, `isCodingHarnessModel`, `assessCodingModel` | explicitly matches `video|veo|lyria|…|omni` and returns `'specialist'` / `'non-text'`; the last gate a video model meets |
| Capability flag | `common/src/constants/savant-free-models.ts` | the `SavantFreeModel` interface declares one `multimodal: boolean` member; no video-valued member exists in the file |
| Modality annotation | `common/src/constants/context-window-table-kiosapi.ts` | annotates a model `modality text+image+video->text`; video is known **only as an input modality** for context-window sizing |
| Media part routing | `packages/llm-providers/src/openai-compatible/chat/convert-to-openai-compatible-chat-messages.ts` | branches on `part.mediaType.startsWith('image/')`; every other media type falls through to an `unsupported functionality: file part media type` error |
| Generation route | `packages/llm-providers/src/openai-compatible/image/openai-compatible-image-model.ts` and `-image-settings.ts` | implements `ImageModelV2`; POSTs `/images/generations`; decodes `{ data: [{ b64_json }] }` **synchronously** — no job id, poll, result fetch or expiry |
| Provider factory | `packages/llm-providers/src/openai-compatible/openai-compatible-provider.ts` — `createOpenAICompatible` | builds exactly four model kinds (`chat`, `completion`, `embedding`, `image`); **no fifth generation kind** |

Reachability check: a repository-wide search for video generation routes across
`common/src`, `packages/llm-providers/src` and `packages/agent-runtime/src`
returns no generation-route matches — video appears only as an input modality,
a context-window annotation, or a connector category.

**Conclusion.** The pipeline discovers video models, the catalog can annotate
video modality, and the media-part router has exactly one non-text branch. Video
models are discovered, listed, and then dropped at the routing layer.

---

## 3. What each artifact does NOT prove

Recording the limits is part of the evidence, not a disclaimer.

1. **The scrape is capability-blind.** `candidates.json` stores model IDs as
   strings. Nothing in the harvest asserts that `grok-imagine-video-1.5`
   actually returns video on `console.flatkey.ai`, nor what request body it
   requires.
2. **A healthy host is not an entitled account.** `console.flatkey.ai` returning
   `boundary-ok` proves the host answers its model-listing endpoint. It does not
   prove video generation is entitled on this account, nor that a generation
   request would not return a payment or quota error.
3. **Lyria is audio-primary.** Lyria 3 is a music/audio generation family; the
   `-clip` variants generate short audio-visual clips. It is not text-to-video
   in the Veo sense. It is evidence that non-text generation modalities are
   reachable, and should not be counted as a video route.
4. **`gemini-omni-1.1-flash` is unannotated here.** The digest lists it with no
   capability annotation, so this report cannot assert video output from the
   digest alone.
5. **NVIDIA video models are understanding, not generation.**
   `nvidia/ai-synthetic-video-detector` and `nvidia/cosmos-reason2-8b` analyze
   video; they do not produce it.
6. **Offers are not wired providers.** Vidu, Pika, Hailuo, Runway and fal appear
   as offers, not as configured providers. Each would need onboarding through
   the standard provider path.

---

## 4. Open questions requiring live probes

These are unresolved and cannot be settled from artifacts on disk. Each needs an
operator-held API key.

1. **Does `console.flatkey.ai` generate video?** One request against
   `grok-imagine-video-1.5` or `MiniMax-H3`: does it return a video URL, an
   async job handle, or an error? This single answer decides whether the first
   route is an OpenAI-compatible aggregator or a bespoke provider protocol.
2. **Does `gemini-omni-1.1-flash` return video?** A live capability check on a
   wired provider. If it does, it is the cleanest first route because the key is
   already configured.
3. **Resolved (read-only, 2026-10-30).** The drop point is
   `cli/src/utils/openrouter-models/catalog-filter.ts`: `NON_CODING_MODEL_PATTERN`
   names `image|video|veo|lyria|tts|embedding|…|omni` and `isCodingHarnessModel`
   returns false for any match, while `assessCodingModel` returns
   `reason: 'specialist'` on the name match and `reason: 'non-text'` when
   `outputModalities` omits `'text'`. Every video ID the harvest found matches.
   This is correct behavior, not a defect: the filter's own comment scopes its
   catalog to "the coding harness, not by the product's media, retrieval,
   safety, or research surfaces," and no media surface exists to admit them.

---

## 5. Bearing on design

The evidence supports a narrower change than "add video provider integrations".

The harvest already discovers video models and already writes them into the
candidate roster. The offers pipeline already classifies free video
provisioning as its own category. The gap is one missing generation shape:
`packages/llm-providers` has an inline image route and no queued/poll-ready
sibling, so a model whose output is a multi-second asynchronous job has nowhere
to land.

**Scope of the missing piece.** The provider factory `createOpenAICompatible`
(`openai-compatible-provider.ts`) builds exactly four model kinds — `chat`,
`completion`, `embedding`, `image` — and attaches them as `languageModel`,
`chatModel`, `completionModel`, `textEmbeddingModel`, `imageModel`. There is no
fifth generation kind. The one generation shape that does exist,
`OpenAICompatibleImageModel`, implements `ImageModelV2` and decodes
`{ data: [{ b64_json }] }` synchronously. A queued model is therefore a new
contract, not a variant of that one. It is also only part of the answer: what is
absent is a **media surface** — a picker lane that admits non-coding models, a
generation tool, and the generation route — of which the queued primitive is one
component.

Two consequences follow, and both are recorded as findings rather than plans:

- **A single OpenAI-compatible gateway may be sufficient for a first route.**
  `console.flatkey.ai` carries video IDs on a host whose roster signature is an
  OpenAI-compatible multimodal gateway. Savant already speaks that transport for
  chat, so a modality generalization would reuse the existing provider shape
  rather than adding four bespoke protocols.
- **The queued half still needs a primitive.** Any video provider is
  submit-then-poll. `resources/opencode-dev/packages/ai/src/route/media-protocol.ts`
  implements that as `MediaProtocol.queued` with a token, status path and result
  path; it is a reference for the polling half only, not the whole design.

No implementation is proposed here. This report establishes reachability and
locates the gap; the route decision depends on probe 1 and probe 2 above.

---

## Evidence index

| Artifact | Path | What it establishes |
|---|---|---|
| Free-options digest | `~/.savant-code-dev/free-options.md` | video IDs on wired providers; the `### Video (5)` offers category |
| Harvest scrape | `dev/provider-candidates/candidates.json` | `console.flatkey.ai` roster and probe; `newapi.prorisehub.com` `modelsCount: 0` |
| Harvest report | `dev/provider-candidates/report.md` | host readiness table, model-availability prose, `newapi.prorisehub.com` dropout flags |
| Free-model capability | `common/src/constants/savant-free-models.ts` | `SavantFreeModel` declares one `multimodal: boolean` member; no video-valued member |
| Modality annotation | `common/src/constants/context-window-table-kiosapi.ts` | video known as input modality only |
| Media part routing | `packages/llm-providers/src/openai-compatible/chat/convert-to-openai-compatible-chat-messages.ts` | non-image media falls through to an error |
| Generation route | `packages/llm-providers/src/openai-compatible/image/openai-compatible-image-model.ts` | inline image generation; no video or queued sibling |
| Reference implementation | `resources/opencode-dev/packages/ai/src/route/media-protocol.ts` | `MediaProtocol.queued` — polling half only |
| Provider onboarding rule | `docs/adding-a-provider.md` | "catalog lists N models" does not mean inference works |