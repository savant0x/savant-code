# Savant-Code Modes — Feature Writeup (post-rebrand, OpenRouter-only)

> Status: **diagnostic audit completed**. Pending action: redesign of the input-box AgentMode toggle after `agents/base2/base2*.ts` is renamed. Filed under FID-2026-0720-031 (to be opened when work begins).

## TL;DR — answer to "do modes do anything?"

Yes — but only half of the wire. The input-box **DEFAULT/LITE/MAX/PLaN** toggle is *partly* real:

| Half of the wire | Status post-rebrand |
|---|---|
| **Agent ID load** (`AGENT_MODE_TO_ID[mode]`) | **Live** — each mode loads a distinct `AgentDefinition` with different model default, `providerOptions`, tool list, validation, and system prompt. |
| **`costMode` value** (`AGENT_MODE_TO_COST_MODE[mode]`) | **Dead** — was meant for the now-defunct SavantCode backend. Flows through `sdk/run.ts` as a string, but no backend consumes it on the OpenRouter-direct path. |

If you only have time to read one paragraph: the toggle changes *which agent runs*; it does **not** change billing, rate limiting, telemetry, or session gating — those were backend responsibilities that no longer exist.

---

## 1. Two concepts that the prior searches conflated

There is a frequent source of confusion because the word "mode" appears in three different idioms in this codebase:

| Concept | Where defined | What it controls |
|---|---|---|
| `AgentMode` (`'DEFAULT' \| 'LITE' \| 'MAX' \| 'PLAN'`) | `cli/src/utils/constants.ts` | Which `AgentDefinition` loads + the `costMode` label forwarded to the SDK |
| `InputMode` (`'default' \| 'bash' \| 'homeDir' \| 'plan' \| 'review' \| 'interview' \| 'usage' \| 'image' \| 'help' \| 'connect:chatgpt' \| 'outOfCredits' \| 'subscriptionLimit'`) | `cli/src/utils/input-modes.ts` | Input-box prefix/slash-command context. Determines whether the AgentMode toggle is visible. |
| `costMode` (`'free' \| 'lite' \| 'normal' \| 'max' \| 'experimental' \| 'ask'`) | `common/src/constants/model-config.ts` | Legacy billing tag, passed to SDK. Same names as AgentMode labels but a separate string union. |

The input-box toggle the user sees in `DEFAULT/LITE/MAX` is the **AgentMode toggle** from the first table. The `costMode` it maps to is from the third table — and is dead on the OpenRouter-direct path.

---

## 2. Full wire path (verbatim)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  cli/src/utils/constants.ts                                             │
│    AGENT_MODE_TO_ID                                                    │
│      DEFAULT → 'base2'                                                 │
│      LITE    → IS_SAVANT_FREE ? 'base2-free' : 'base2-lite'             │
│      MAX     → 'base2-max'                                             │
│      PLAN    → 'base2-plan'                                            │
│    AGENT_MODE_TO_COST_MODE                                             │
│      DEFAULT → 'normal'                                                │
│      LITE    → IS_SAVANT_FREE ? 'free' : 'lite'                        │
│      MAX     → 'max'                                                   │
│      PLAN    → 'normal'                                                │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  cli/src/components/agent-mode-toggle.tsx                              │
│    Compact hover-expandable SegmentedControl.                           │
│    Renders only if IS_SAVANT_FREE is false (returns null otherwise).    │
│    Click "DEFAULT" → calls onToggle/onSelectMode.                      │
│    All UI action handlers funnel through resolveAgentModeClick.         │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  cli/src/state/chat-store.ts                                           │
│    Field: `lastMessageMode: AgentMode`                                 │
│    Updated by the toggle; read by use-send-message.ts.                  │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  cli/src/hooks/use-send-message.ts (~line 632)                          │
│    Reads `agentMode` from current input, reads `lastMessageMode` from   │
│    useChatStore. Resolves `agent = AGENT_MODE_TO_ID[mode]` and passes  │
│    `costMode: AGENT_MODE_TO_COST_MODE[mode]` to createRunConfig.        │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  cli/src/utils/create-run-config.ts                                    │
│    Returns RunConfig object with `agent`, `costMode`, maxAgentSteps:    │
│    MAX_AGENT_STEPS_DEFAULT, fileFilter (sensitive-file block), etc.    │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  sdk/src/run.ts                                                        │
│    Receives `costMode?: string` in RunOptions.                              │
│    Forwards to agent-runtime via callMainPrompt call.                   │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  agents/base2/{base2,base2-lite,base2-max,base2-plan,base2-fast,       │
│  base2-free}.ts                                                        │
│    Loaded agent definition:                                             │
│    - `model` (default if no override)                                  │
│    - `providerOptions`                                                 │
│    - `toolNames` (gated by isFast / noAskUser / noGravityIndex flags)   │
│    - `systemPrompt` (Savant the {Lite|Max|Plan|Fast|Free} Orchestrator) │
│    - `displayName`                                                     │
│    - `instructionsPrompt`, `stepPrompt`, `handleSteps`                 │
└─────────────────────────────────────────────────────────────────────────┘
```

The half of the wire that is **dead post-rebrand**: `costMode` and `agentDefinions`. The `costMode` parameter still flows but no backend reads it. The `agentDefinions` (legacy backend-loaded agent registry) is unused.

---

## 3. What each mode ACTUALLY produces (per working-tree evidence)

Read from `agents/base2/base2.ts` and the wrappers `agents/base2/base2-{lite,max,plan,fast,free}.ts`. Each row is the difference the runtime sees when you click the toggle in the input box.

| AgentMode | Loaded agent ID | `model` (default if no override) | `providerOptions` | Validation | Tools (vs base2) |
|---|---|---|---|---|---|
| `DEFAULT` | `base2` | `'anthropic/claude-opus-4.8'` | `{ only: ['amazon-bedrock'] }` | strict | full |
| `MAX` | `base2-max` | same as DEFAULT | `{ only: ['amazon-bedrock'] }` | strict + "keep working until satisfied" | full |
| `LITE` (SavantCode, IS_SAVANT_FREE=false) | `base2-lite` | `'minimax/minimax-m3'` (OpenRouter label) | `{ only: ['amazon-bedrock'] }` | strict | full |
| `LITE` (SavantFree, IS_SAVANT_FREE=true) | `base2-free` | `'minimax/minimax-m3'` (OpenRouter label) | `{ data_collection: 'deny' }` | strict | full |
| `PLAN` | `base2-plan` *(via `createBase2('default', { planOnly: true })`)* | `'anthropic/claude-opus-4.8'` | `{ only: ['amazon-bedrock'] }` | plan-only override (no write tools at runtime) | full |
| (used inside `noAskUser: true` shell) | `base2-fast-no-validation` | whatever model override is passed | `{ only: ['amazon-bedrock'] }` | `hasNoValidation: true` | drops `write_todos`, `suggest_followups`, `ask_user` |

Notes:
- The model strings are OpenRouter routing labels, not endpoints. `minimax/minimax-m3` and `anthropic/claude-opus-4.8` both reach OpenRouter's unified `/api/v1/chat/completions` endpoint; OpenRouter handles the underlying provider.
- `base2-free` and `base2-lite` route to the same `minimax/minimax-m3` model but differ in `providerOptions` — free mode denies data collection, lite mode restricts to bedrock (which is questionable on OpenRouter-direct, see §7).
- `modelOverride ?? ...` — if you pick a model in the model picker UI, that override wins over the AgentMode default. The picker choice is honoured regardless of mode.
- `'free'` and `'lite'` AgentMode IDs differ but produce nearly identical AgentDefinitions; the only behavioral delta is the `providerOptions`.

---

## 4. The agent-mode-toggle UI component (`cli/src/components/agent-mode-toggle.tsx`)

- Compact, hover-expandable segmented control. Returns `null` if `IS_SAVANT_FREE === true`.
- Internal `useHoverToggle()` hook manages open/close with `OPEN_DELAY_MS=0`, `CLOSE_DELAY_MS=250`, `REOPEN_SUPPRESS_MS=250` to prevent flicker on rapid hover transitions.
- Builds segments from `AGENT_MODES` (the array derived from `Object.keys(AGENT_MODE_TO_ID)`).
  - Each non-active mode renders as a clickable segment.
  - Active mode renders as a `> MODE` indicator.
- Click handlers funnel through the exported `resolveAgentModeClick(currentMode, clickedId, hasOnSelectMode)` helper:
  - Clicking an active mode → `{ type: 'closeActive' }`
  - Clicking a different mode → `{ type: 'selectMode'; mode: target }` if `onSelectMode` is provided, otherwise `{ type: 'toggleMode'; mode: target }`.
- Disabled when `inputFocused === false` (the toggle won't open if the terminal is not focused — UX rule).

### Visibility rule (which `InputMode`s expose the toggle)

From `cli/src/utils/input-modes.ts`, each `InputModeConfig` has `showAgentModeToggle`:

| InputMode | Toggle visible? |
|---|---|
| `default`, `homeDir`, `usage`, `help` | ✅ |
| `bash`, `plan`, `review`, `interview`, `image`, `connect:chatgpt`, `outOfCredits`, `subscriptionLimit` | ❌ |

Plus an unconditional override: in SavantFree builds, all toggle visibility is forced off.

Practical consequence: when the user types `/plan`, `/review`, or `/interview`, the agent-mode toggle disappears. When the user is back in the default chat, it reappears. `subscriptionLimit` and `outOfCredits` also hide it because there's no interactive mode toggle to display.

---

## 5. The `costMode` dead path

`costMode` is declared in `common/src/constants/model-config.ts`:

```typescript
export const costModes = [
  'free', 'lite', 'normal', 'max', 'experimental', 'ask',
] as const
export type CostMode = (typeof costModes)[number]
```

It flows through the wire as a string label:

1. `AGENT_MODE_TO_COST_MODE[mode]` in `constants.ts` produces one of `'free' | 'lite' | 'normal' | 'max' | 'experimental' | 'ask'`.
2. `use-send-message.ts` passes it to `createRunConfig({ costMode, ... })`.
3. `create-run-config.ts` puts it in the returned RunConfig object.
4. `sdk/src/run.ts` declares it on `RunOptions` and forwards it to `callMainPrompt(...)` in `agent-runtime`.
5. `agent-runtime` checks `isFreeMode(costMode)` to gate ChatGPT-OAuth-direct flows in `sdk/src/impl/model-provider.ts` and `gemini-with-fallbacks.ts`.

**The only runtime effect of `costMode` today** is the `isFreeMode(costMode)` check — which only matters if the user is using a ChatGPT OAuth direct connection (out-of-scope post-rebrand since OpenRouter is the universal backend). On the OpenRouter-direct path, **`costMode` is fully inert** — the value flows through but nothing reads it.

If you keep `costMode` in the wire purely as a labeling facility (or for backward compatibility with hypothetical future metering), that's fine. If you want to drop it entirely, the chain is short.

---

## 6. Files to touch for redesign (full table)

| File | What to change |
|---|---|
| `cli/src/utils/constants.ts` | Replace `AGENT_MODE_TO_ID` + `AGENT_MODE_TO_COST_MODE` tables. New modes, new IDs, new cost-mode mapping. Optionally drop `AGENT_MODE_TO_COST_MODE` entirely. |
| `cli/src/components/agent-mode-toggle.tsx` | Rename mode labels, update `buildExpandedSegments` and `resolveAgentModeClick` exports to recognize new mode strings. May rename `AgentMode` type itself. |
| `cli/src/utils/input-modes.ts` | Decide whether the toggle should appear in additional `InputMode`s. Flip `showAgentModeToggle: true` for any new contexts (e.g. `/fast` slash command). |
| `cli/src/utils/create-run-config.ts` | `CreateRunConfigParams.costMode` field — drop or repurpose. Remove from `costMode` line in the returned object. |
| `cli/src/hooks/use-send-message.ts` (around line 632) | Update `AGENT_MODE_TO_COST_MODE[mode]` lookup site. If costMode is dead, simplify to drop the field. |
| `agents/base2/{base2,base2-lite,base2-max,base2-plan,base2-fast,base2-free}.ts` | If the new mode names map to distinct agent IDs, edit the wrapper files. `agents/base2/base2.ts` `createBase2(mode, options?)` is the universal seam — most logic lives here. |
| `common/src/constants/model-config.ts` | `costModes` const array; shrink or rename if you change the union. |
| `sdk/src/run.ts` (~line 150) | `costMode: costMode ?? 'normal'` — drop or rename the field on `RunOptions`. The SDK has no enforcement, so the field is purely a wire label. |
| `agents/browser-use/browser-use.test.ts` (sav-26-040 reference) | Other tests/snapshots need a sweep if you rename the `AgentDefinition` IDs. |

---

## 7. ⚠️ Latent risk: `amazon-bedrock` is still hardcoded in non-free modes

`agents/base2/base2.ts` has:

```typescript
const defaultProviderOptions = isFree
  ? { data_collection: 'deny' as const }
  : { only: ['amazon-bedrock'] }
```

This forces every DEFAULT/MAX/LITE/PLAN run to **only** route through amazon-bedrock. If your OpenRouter-direct setup no longer includes amazon-bedrock as a routing surface (likely, since you replaced the old SavantCode backend with a master-key OpenRouter path), this would silently **fail every paid-mode request** at the AI SDK layer.

Verify before redesign ships:

```bash
cd /c/Users/spenc/dev/savant-code
grep -rn 'amazon-bedrock' agents/ common/ sdk/ packages/ 2>/dev/null | grep -v __tests__
```

If amazon-bedrock appears anywhere outside test mocks and ECHO docs, decide whether to:
- (a) Drop the `only: ['amazon-bedrock']` constraint entirely — neutral request, OpenRouter picks the cheapest route.
- (b) Repoint to whatever provider you actually use (e.g. `anthropic-direct`, `minimax-direct`).
- (c) Document Bedrock as still-approved for paid runs and confirm contract.

This is **not** an aesthetic issue — it's a runtime correctness issue. Catching this in the redesign pass is cheaper than discovering it after shipping.

---

## 8. Three redesign options (in smallest-to-largest blast radius)

### Option A — Strip `costMode` only. Keep mode toggle + AgentDefinition IDs.

- Remove `costMode` from `cli/src/utils/create-run-config.ts` (line ~92), `sdk/src/run.ts` (~line 150), `cli/src/hooks/use-send-message.ts` (~line 632).
- Keep `AGENT_MODE_TO_ID`, keep `base2-lite/base2-max/etc.` files.
- ~30 lines removed across 3 files. No UX change.
- *When to pick this:* if you want the cheapest possible cleanup and the toggle feature is acceptable as-is.

### Option B — Rename modes to match new product language.

- Replace mode label table in `cli/src/utils/constants.ts` (`DEFAULT → STANDARD`, `LITE → FAST`, `MAX → PRO`, drop or rename `PLAN`).
- Update strings in `agent-mode-toggle.tsx` (the `buildExpandedSegments` function constructs segments from `AGENT_MODES` automatically — only hardcoded labels are the `> MODE` indicator).
- Optionally rename the underlying `AgentDefinition` IDs (`base2-lite → base2-fast`, etc.).
- ~50 lines changed across 3–5 files. UX-visible change (button labels in input box).
- *When to pick this:* if the current label names don't reflect the product's new positioning.

### Option C — Collapse the toggle. Always load one agent.

- Set `AGENT_MODE_TO_ID = { DEFAULT: 'base2', LITE: 'base2', MAX: 'base2', PLAN: 'base2' }` (or just remove the mode toggle entirely).
- The picker becomes purely cosmetic; `costMode` is irrelevant.
- ~10 lines changed plus 1 component deletion.
- *When to pick this:* if you've decided one prompt pipeline + one model picker is enough and you want maximum simplicity.

There's no Option D / "do nothing" — the latent `amazon-bedrock` risk in §7 alone warrants touching this code.

---

## 9. Verification steps before making changes

Run these to confirm the wire path:

1. Boot the CLI: `cd /c/Users/spenc/dev/savant-code && bun dev`.
2. Add a one-line debug log at `cli/src/components/agent-mode-toggle.tsx` `handleSegmentClick`, e.g. `console.log('[modes] click', mode, '→', agent)`.
3. Add a debug log at `cli/src/hooks/use-send-message.ts` near line 632: `console.log('[modes] sending', { agent, costMode, modelOverride })`.
4. Click each mode (DEFAULT/LITE/MAX/PLaN), send a one-line prompt, and confirm:
   - Agent ID is what `AGENT_MODE_TO_ID[mode]` says.
   - `costMode` reaches `create-run-config.ts` and is forwarded.
5. Pick a model from the model picker UI that overrides the AgentMode default; confirm `modelOverride` wins.
6. Run `grep -rn 'amazon-bedrock' agents/ common/ sdk/ packages/ 2>/dev/null` to confirm any Bedrock leftover is intentional.

---

## 10. Decisions checklist (when you rename `base2` later)

Before touching any file, capture decisions on:

- [ ] New mode names (default + alternative flavor list)
- [ ] Whether to keep AgentDefinition-per-mode load (Option B/C) or centralize to a single agent (Option A)
- [ ] Whether `costMode` survives as a deprecated field or is fully stripped
- [ ] Whether `providerOptions.only: ['amazon-bedrock']` is still valid in the OpenRouter-direct setup
- [ ] Which **`InputMode`** contexts should still expose the toggle
- [ ] What to do with `base2-free` and `base2-lite` (which produce near-identical AgentDefinitions)
- [ ] Whether `planOnly` becomes a real `AgentMode` or stays as a `createBase2` flag
- [ ] FIDs/documentation updates: open FID-2026-0720-031 at the start of work, file CHANGELOG.md entry + migrate FID to `archive/` at close

---

## 11. Related documents

- [`ARCHITECTURE.md`](../ARCHITECTURE.md) — 9-agent roster (Orchestrator, Detective, Forge, Verifier, Recorder, Thinker, Scout, Researcher, Scribe)
- [`ECHO.md`](../ECHO.md) — Perfection Loop FSM, FID lifecycle
- [`docs/agents-and-tools.md`](agents-and-tools.md) — Agent roster breakdown
- [`docs/SAVANT-VERSIONING.md`](SAVANT-VERSIONING.md) — Versioning convention
- [`CHANGELOG.md`](../CHANGELOG.md) — FID-2026-0719-030 entry documents the agent-runtime `__tests__/` exclusion decision that touches overlapping infrastructure

Pending FIDs this writeup will fold into:
- FID-2026-0720-031 (to be opened): Modes feature redesign after base2 rename

---

*Audit performed 2026-07-20. Working-tree evidence: 8 files read directly (`agents/base2/base2.ts`, `agents/base2/base2-lite.ts`, `agents/base2/base2-max.ts`, `agents/base2/base2-free.ts`, `agents/base2/base2-plan.ts`, `agents/base2/base2-fast.ts`, `common/src/constants/model-config.ts`, `sdk/src/impl/model-provider.ts`, `cli/src/components/agent-mode-toggle.tsx`, `cli/src/utils/input-modes.ts`, `cli/src/utils/constants.ts`, `cli/src/utils/create-run-config.ts`). Conclusions: costMode path is dead post-rebrand; AgentMode toggle wire path is real but partially cosmetic; amazon-bedrock constraint is a latent runtime risk.*
