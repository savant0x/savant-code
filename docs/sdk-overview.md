# SDK Overview (`@savant-code/sdk`)

The complete engineering and product overview of the Savant-Code SDK package. This document is the
foundation for understanding, using, and — most importantly — **expanding** the SDK beyond what the
original owner shipped. Read it end to end before touching the package.

## What the SDK is

`@savant-code/sdk` is the **multi-agent runtime of Savant-Code, extracted as a reusable library.**
The CLI (`@savant-code/cli`) is the terminal UI shell; the SDK is the engine underneath it. Every
prompt sent in the CLI becomes a `SavantCodeClient.run()` call in the SDK.

The SDK is not a thin HTTP wrapper — it contains the full agent loop, tool execution sandbox, model
provider routing, ECHO Protocol governance enforcement, knowledge-file handling, checkpoint/rewind
system, skills and MCP loading, and the native-asset plumbing (ripgrep, tree-sitter).

## Package identity and distribution status

| Field | Value | Notes |
|-------|-------|-------|
| Name | `@savant-code/sdk` | |
| Version | `0.0.26` | Mirrors the monorepo version |
| Visibility | `private: false` | Ready for npm publication structurally |
| **Published to npm** | **Never** | Registry 404 confirmed by third-party audit; intentionally excluded from the published `0.0.22` release (see `dev/session-summaries/2026-08-08-1500-public-release-complete-handoff.md`) |
| Runtime targets | Node >= 18 (primary), Bun | Dual ESM/CJS output; verified to load in plain Node |
| License | Apache-2.0 | |
| Build artifacts | `dist/index.mjs`, `dist/index.cjs`, `dist/index.d.ts`, `dist/wasm/*`, `dist/vendor/ripgrep/*` | |
| Repository | `savant0x/savant-code`, `sdk/` workspace | |

The publish pipeline is fully built (`sdk/PUBLISHING.md`), and the public release pipeline plans
SDK-first publication (`@savant-code/sdk` before `savant-code`, `scripts/public-release.ts`). The
decision to publish is deferred, not blocked. See the strategic context section at the end.

## Position in the monorepo

```text
savant-code.exe  (shipped binary — bun --compile bundles everything below)
└── @savant-code/cli          UI, commands, pickers, hooks   (depends on sdk, knowledge-graph)
    └── @savant-code/sdk      THE ENGINE — agent loop, tools, providers, credentials, assets
        ├── @savant-code/common            shared types, tool schemas, constants, analytics
        ├── @savant-code/agent-runtime     agent FSM, tool handlers, spawn/subagent logic
        ├── @savant-code/code-map          tree-sitter code indexing, language detection
        └── @savant-code/llm-providers     OpenAI-compatible chat model adapter + Ollama detect
```

The CLI declares `@savant-code/sdk` as a `workspace:*` runtime dependency
(`cli/package.json`) and has **54+ import sites** across `cli/src`. The SDK is also consumed
directly by `evals/` (the benchmark harness drives `SavantCodeClient.run()` itself), the `agents/`
package tests, and `savant-free/` e2e suites.

## Complete module inventory

Source root: `sdk/src/`. Organization by area (all exports listed are public unless noted):

| Module | Responsibility |
|--------|----------------|
| `client.ts` | `SavantCodeClient` — the public entry point (`run`, `checkConnection`) |
| `run.ts` | Re-export shim → `run/execution.ts`; `RunOptions`, `SavantCodeClientOptions` types |
| `run-state.ts` + `run-state/` | `RunState` shape, session-state mutations, file-tree builder, knowledge-file selection, child-process helpers, project index |
| `custom-tool.ts` | `getCustomToolDefinition` — Zod-schema'd custom tools with `execute` handlers |
| `env.ts` | All env getters (providers, inference, direct-mode gate, OAuth token) |
| `constants.ts` | `getWebsiteUrl()` — runtime backend base URL resolution (env > bundle-time) |
| `credentials.ts` | Config dir / credentials.json, ChatGPT OAuth token storage + refresh |
| `error-utils.ts` | Typed HTTP errors, retryable-status classification, message sanitization |
| `retry-config.ts` | Retry/backoff and reconnection constants for streaming |
| `agents/load-agents.ts` | `loadLocalAgents` — loads `.agents` dirs (`.ts/.tsx/.js/.mjs/.cjs`), MCP env resolution |
| `agents/load-mcp-config.ts` | `loadMCPConfig(Sync)` — `.mcp.json` / mcp config parsing |
| `skills/load-skills.ts` | `loadSkills`, `parseSkillFileContent` — `SKILL.md` discovery |
| `tools/` | Tool handlers: `apply-patch`, `change-file`, `code-search`, `glob`, `list-directory`, `read-files`, `read-url`, `run-terminal-command`, `run-file-change-hooks`, SSRF guard |
| `impl/model-provider/` | The provider routing + factories (see `docs/design/Adding New Providers.md`) |
| `impl/openrouter-key-resolver.ts` | OpenRouter credential chain: `OR_MASTER_KEY` exchange → `OPENROUTER_API_KEY` → `INFERENCE_API_KEY`; process-lifetime cache + reset hook |
| `impl/llm/` + `impl/llm.ts` | `promptAiSdk(Stream/Structured)` — the LLM invocation layer, stream chunk handlers, tool-call repair, ChatGPT OAuth request transform |
| `impl/agent-runtime.ts` | `getAgentRuntimeImpl` — wires LLM, database, analytics, and scoped deps into the agent runtime; bounded agent-template cache (200-entry FIFO) |
| `impl/database.ts` | Backend contract: `getUserInfoFromApiKey`, `startAgentRun`, `finishAgentRun`, `addAgentStep`, `fetchAgentFromDatabase` (all short-circuited in direct mode) |
| `impl/chatgpt-backend-fetch/` | ChatGPT OAuth / Codex backend adapter: JWT account extraction, request transform, SSE stream transform |
| `native/ripgrep.ts` | `getBundledRgPath` — vendored ripgrep binary resolution |
| `validate-agents.ts` | `validateAgents` — agent-definition validation |
| `types/env.ts` | `SdkEnv` type |
| `utils/logger.ts` | Shared logger |
| `testing/env.ts` | `createTestSdkEnv` — test helper |
| `index.ts` | The public barrel — the complete export surface |

## Public API surface

### `SavantCodeClient`

```ts
const client = new SavantCodeClient({
  apiKey: process.env.SAVANT_CODE_API_KEY, // or via SAVANT_CODE_API_KEY env var
  cwd: process.cwd(),
  // ...SavantCodeClientOptions
})
```

**Constructor:** requires `apiKey` (or `SAVANT_CODE_API_KEY` env). Generates a `fingerprintId`
(`savant-code-sdk-<random>`) used for analytics. Sets a default `handleEvent` that throws on
`error` events — provide your own to handle errors gracefully.

**Methods:**

| Method | Purpose |
|--------|---------|
| `run(options)` | Executes one agent turn (or continues a session with `previousRun`). Returns a `RunState`. |
| `checkConnection()` | Pings the backend `/api/healthz` (5s timeout). **Always returns `true` in direct-provider mode** — there is no backend to ping (FID-2026-0806-009). |

### `run()` options

Client-level options (`SavantCodeClientOptions`) and per-run options (`RunOptions`) are merged.

| Option | Applies at | Purpose |
|--------|-----------|---------|
| `apiKey` | client | Backend auth (required) |
| `cwd` | client | Working directory |
| `skillsDir` | client | Directory to load `SKILL.md` skills from instead of defaults |
| `projectFiles` | client | `{ path: content }` map of project files the agent can read |
| `knowledgeFiles` | client | Knowledge files injected into context (replaces project discovery) |
| `userKnowledgeFiles` | run-state | User knowledge merged with `~/.knowledge.md` |
| `agentDefinitions` | both | Custom `AgentDefinition[]` registered for this client/run |
| `customToolDefinitions` | both | Custom tools via `getCustomToolDefinition` |
| `maxAgentSteps` | both | Step cap (safety guard; ~20 is reasonable) |
| `env` | both | Extra env vars for `run_terminal_command` (merge, custom wins) |
| `handleEvent` | both | Receives every `PrintModeEvent` (streaming UI) |
| `handleStreamChunk` | both | Token-level chunks: string, `subagent_chunk`, or `reasoning_chunk` |
| `fileFilter` | both | Classify files before reading (`blocked` / `allow-example` / `allow`); defaults to gitignore handling |
| `overrideTools` | client | Replace built-in tool implementations client-side |
| `fsSource` / `spawnSource` | client | Dependency injection for filesystem/spawn (testability) |
| `logger` / `traceWriter` | client | Observability hooks |
| `agent` | run | Agent id string (e.g. `savant-code/base@latest`, or a local custom id) or an `AgentDefinition` |
| `prompt` | run | The user prompt |
| `content` | run | Multimodal content (`text` + base64 `image` parts) |
| `params` | run | Structured JSON input for agents that declare an `inputSchema` |
| `previousRun` | run | A `RunState` from a prior call to continue the session |
| `extraToolResults` | run | Pre-inject tool result messages |
| `signal` | run | `AbortSignal` for cancellation |
| `drainSteeringMessages` | run | Steering hook — return strings injected as user prompts at step boundaries (steer a live run without aborting) |
| `extraSavantCodeMetadata` | run | Key/values merged into each LLM request's `savant_code_metadata` (e.g. `savant_free_instance_id`) |
| `onStateSnapshot` | run | Periodic `RunState` snapshots (~every 5s) so a killed process doesn't lose an in-flight turn |
| `onFileWritten` | run | Post-write hook (created/modified) |
| `checkpointDir` / `checkpointTurnId` | run | Persistent per-turn file checkpoints for `/rewind` |
| `devMode` | run | Bypass FSM tool gating and agent tool restrictions (dev only) |
| `permissionMode` | run | `safe` / `prompt` / `unsafe` sandbox permission mode |
| `modelInfoText` | run | Pre-formatted model metadata injected into the system prompt |
| `echoCompliance` | run | ECHO harness compliance: `{ mode: 'warn' | 'off', fidPaths }` (see below) |
| `provenanceMode` | run | ZTAP provenance: `'off' \| 'record' \| 'enforce'` (default `record`; `enforce` fail-closes unsigned writes) |
| `contextWindow` | run | Resolved model context window (tokens). Threaded to the ContextCompactor so thresholds, the display percent, and the pruner trigger share one window (absent → loud fallback, never a silent 200k default) |
| `compression` | run | Compression config from `protocol.config.yaml` — `microCompact`, `keepRecentTokens`, `autoCompactRatio`, `forceCompactOffset`, `microCompactMaxKeepRecent`, `microCompactFloorTokens` |

### `RunState` and output

```ts
type RunState = {
  sessionState?: SessionState   // internal state — pass back via previousRun
  output: AgentOutput           // the terminal result
  traceSessionId: string
}
```

`output` is a discriminated union (`success` with text/JSON, `error`, pause types). Success output
contains `runState` you can feed to the next `run()`.

### Event model (`PrintModeEvent`)

`handleEvent` receives a discriminated union keyed by `type`:

| Event | Meaning |
|-------|---------|
| `start` | Run started (`messageHistoryLength`) |
| `text` | Assistant text (`agentId`) |
| `tool_call` / `tool_result` | Tool invocations and results (with `toolCallId`, `toolName`, `input`/`output`) |
| `finish` | Run finished (`totalCost`) |
| `error` | Run error |
| `download` | Asset download status (`complete` / `failed`) |
| `subagent_start` / `subagent_finish` | Spawned subagent lifecycle (multi-agent orchestration) |
| `reasoning_delta` | Streaming reasoning tokens (`ancestorRunIds`, `agentId`) |
| `activity` | Runtime activity indicator: `idle`, `thinking`, `tool`, `subagent`, `researching` |
| `compliance_warning` | ECHO compliance receipts (`law1`, `law3`, `verifier_criteria`, `fid`; severity info/warning/critical) |

### Custom tools

```ts
const myTool = getCustomToolDefinition({
  toolName: 'fetch_api_data',      // must not collide with built-in ToolName
  description: 'Fetch data from an API endpoint',
  inputSchema: z.object({ url: z.url() }),   // Zod v4
  endsAgentStep: true,             // acts as a stop sequence for the LLM
  exampleInputs: [{ url: 'https://api.example.com/data' }],
  execute: async ({ url }) => [{ type: 'json', value: { ok: true } }],
})
```

`execute` returns an array of `ToolResultOutput` (text/json/image/file parts). If you want to
replace a **built-in** tool, use `overrideTools` instead of a custom tool (the type system enforces
this with a compile-time error message).

### Agents

An `AgentDefinition` (from `@savant-code/common/templates/initial-agents-dir/types/agent-definition`)
declares `id`, `model`, `displayName`, `toolNames`, `instructionsPrompt` (system prompt), optional
`inputSchema` for structured params, `outputMode`, and more. Load from disk:

```ts
const agents = await loadLocalAgents({ agentsPath: './my-agents', validate: true })
```

Supported files: `.ts`, `.tsx`, `.js`, `.mjs`, `.cjs` (auto-transpiled). Excludes `.d.ts` and
`.test.ts`. Also searches `{cwd}/.agents`, `{cwd}/../.agents`, `{homedir}/.agents` when no
`agentsPath` is given. The CLI additionally bundles a generated `bundled-agents.generated.ts`.

### Skills

Skills are `SKILL.md` files (with optional frontmatter) in a directory. `loadSkills`
discovers them from default dirs (`~/.agents/skills`, `.agents/skills`) or a custom `skillsDir`.
Loaded skills appear in the `skill` tool's description and are loaded on demand by the agent.

### MCP (Model Context Protocol)

`loadMCPConfig` / `loadMCPConfigSync` parse `.mcp.json`-style configs (stdio servers, env
interpolation with `$VAR`), enabling external MCP servers as tool sources.

### Knowledge files

Auto-discovery priority: `knowledge.md` → `AGENTS.md` → `CLAUDE.md` per directory, then user files
`~/.knowledge.md`, `~/.AGENTS.md`, `~/.CLAUDE.md`. Override with `knowledgeFiles` (replaces) or
`userKnowledgeFiles` (merges). Selection logic lives in
`run-state/knowledge-files.ts` (`selectHighestPriorityKnowledgeFile`).

### Checkpoints & rewind

Re-exported from the checkpoint store (`@savant-code/agent-runtime/tools/handlers/tool/checkpoint-store`):
`openTurn`, `captureSnapshot`, `closeTurn`, `listTurns`, `restoreTurn`, `forkFrom`,
`clearOpenTurnsForTesting`, `CHECKPOINT_RETENTION` (20 turns). Pass `checkpointDir`/`checkpointTurnId`
to `run()` to capture pre-write snapshots automatically.

### ECHO compliance enforcement (`echoCompliance`)

The runtime deterministically enforces ECHO Law 1 (read-before-write), Law 3 (verify-before-proceed),
and the mechanical Verifier-criteria flag, emitting non-blocking `compliance_warning` events plus
corrective steering. Default `mode: 'warn'`; `mode: 'off'` disables. `fidPaths` (active FIDs in
`dev/fids/`) escalates FID-touching writes to always-flag-for-review.

## The built-in tool system

The full tool registry lives in `common/src/tools/list.ts` (`toolParams`) — **~50 tools**, including:

| Area | Tools |
|------|-------|
| Files | `read_files`, `read_subtree`, `find_files`, `glob`, `list_directory`, `read_url`, `code_search` |
| Edits | `write_file`, `str_replace`, `apply_patch`, `propose_write_file`, `propose_str_replace`, `run_file_change_hooks` |
| Shell | `run_terminal_command`, `run_readonly_command`, `browser_logs` |
| Agent orchestration | `spawn_agents`, `spawn_agent_inline`, `set_output`, `set_messages`, `suggest_followups`, `lookup_agent_info`, `end_turn`, `task_completed` |
| ECHO/FSM | `transition_phase`, `write_todos`, `create_plan`, `add_subgoal`, `update_subgoal`, `add_message`, `set_scaffold_complete` |
| Research | `web_search`, `read_docs`, `deep_research`, `gravity_index`, `sequentialthinking`, `think_deeply` |
| Data | `list_tables`, `describe_table`, `execute_query`, `analyze_query` (adapter-enforced SQL safety) |
| Graph | `query_blast_radius`, `query_domain_clusters`, `query_node_edges` (knowledge graph) |
| UX | `ask_user`, `render_ui`, `skill` |
| Composio | `composio_manage_connections`, `composio_multi_execute_tool`, `composio_search_tools`, `composio_get_tool_schemas` |

**Client-side tools** (the host can handle them itself — `clientToolNames`): `apply_patch`,
`ask_user`, `browser_logs`, `code_search`, `create_plan`, `glob`, `list_directory`,
`run_file_change_hooks`, `read_url`, `run_terminal_command`, `str_replace`, `write_file`, and the
four composio meta-tools. `ToolHelpers` exposes the reference implementations.

Security: `read_url` runs an SSRF guard (`assertUrlAllowed` blocks private/link-local ranges),
`run_terminal_command` has process-group kill and bounded output buffering, `execute_query` is
write-gated with LIMIT injection and SQL redaction.

## Provider routing and credentials

The SDK is where inference happens. `getModelForRequest()` dispatches on model-id prefix
(`tokenrouter/`, `tokenharbor/`, `nvidia/`, `opencode-go/`, `openrouter/`, `commandcode/`,
`nous/`, `cloudflare/`, bare slugs). The default path is the generic OpenAI-compatible adapter targeting
`INFERENCE_BASE_URL`. Full detail and the provider-adding runbook live in
`docs/design/Adding New Providers.md` — that refactor is engine work inside this package.

**Credential chain (OpenRouter):** `OR_MASTER_KEY` (exchanged via `/api/v1/keys`, one fresh key per
process) → `OPENROUTER_API_KEY` → `INFERENCE_API_KEY`; cached per process with negative caching and
an explicit `resetOpenRouterApiKeyCache()` hook. Direct/BYOK mode is gated by
`isDirectProviderMode()` (`DIRECT_PROVIDER` OR `INFERENCE_BASE_URL`) — in that mode every backend
call short-circuits (FID-2026-0806-009).

## Environment variable reference

| Variable | Purpose |
|----------|---------|
| `SAVANT_CODE_API_KEY` | Backend API key (constructor fallback) |
| `DIRECT_PROVIDER` | Direct-mode provider name (e.g. `openrouter`) |
| `INFERENCE_BASE_URL` | Direct-mode OpenAI-compatible base URL |
| `INFERENCE_API_KEY` | SDK-specific inference key |
| `OR_MASTER_KEY`, `OPENROUTER_API_KEY` | OpenRouter credentials (master-key exchange / regular key) |
| `TOKENROUTER_API_KEY`, `TOKENHARBOR_API_KEY`, `NVIDIA_API_KEY`, `OPENCODE_GO_API_KEY`, `COMMAND_CODE_API_KEY`, `NOUS_API_KEY` | Gateway provider keys; Nous uses the direct OpenAI-compatible API and does not imply Portal OAuth |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Workers AI |
| `SAVANT_CODE_BYOK_OPENROUTER` | BYOK OpenRouter header override (`x-openrouter-api-key`) |
| `NEXT_PUBLIC_SAVANT_CODE_APP_URL` / `SAVANT_CODE_APP_URL` | Runtime backend URL override (deploy-time; Convex/Next hosts) |
| `SAVANT_CODE_RG_PATH`, `SAVANT_CODE_WASM_DIR` | Native asset paths |
| `SAVANT_CODE_CONFIG_DIR` | Config dir override (non-prod) |

## Build, verification, and distribution pipeline

`bun run build` (`sdk/scripts/build.ts`):

1. Cleans `dist/`, reads external deps from `package.json` (workspace packages stay bundled).
2. Builds ESM (`dist/index.mjs`) and CJS (`dist/index.cjs`) via `Bun.build`, `target: node`,
   sourcemaps linked, `.scm` loader for tree-sitter queries.
3. **Patches Bun-bundler export-alias bugs** (`fixBrokenExportAliases`) so downstream bundlers
   (esbuild via Convex/Vite) don't hit "not declared in this file".
4. Bundles TypeScript declarations with `dts-bundle-generator` (`dist/index.d.ts`), workspace
   packages external, zod duplicate-import fixup.
5. Copies tree-sitter WASM files (`dist/wasm/`) and vendored ripgrep binaries
   (`dist/vendor/ripgrep/`, fetched via `sdk/scripts/fetch-ripgrep.ts`).

`bun run verify` (`sdk/scripts/verify.ts`): build + typecheck + smoke + Node compatibility
subprojects (CJS/ESM load, ripgrep path, tree-sitter queries) — this is the gate that caught
`bun:sqlite` load-time breakage for Node consumers (fixed via lazy `require`).

`bun run release` (`PUBLISHING.md`): build → `npm pack --dry-run` → publish.

## Test surface

| Suite | Command | Coverage |
|-------|---------|----------|
| Unit | `bun test` | ~30 modules across `src/__tests__` (provider routing, credentials, knowledge files, run-state, tools, agents, MCP, skills, cancellation, file filter, events...) |
| E2E | `bun run test:e2e` | `streaming/`, `workflows/`, `custom-agents/`, `features/` (needs `SAVANT_CODE_API_KEY`; opt-in via `RUN_SAVANT_CODE_E2E=true`, skips gracefully) |
| Integration | `bun run test:integration` | `event-types`, `event-ordering`, `stream-chunks`, `connection-check` |
| Examples | `sdk/e2e/examples/*` | Runnable: code-reviewer, code-explainer, commit-message-generator, sdk-lint, sdk-refactor, sdk-test-gen |
| Dist smoke | `bun run smoke-test:dist` | Node CJS load of the compiled artifact |
| Verify | `bun run verify` | Build + typecheck + smoke + Node compat subprojects |

## Consumers today

| Consumer | How it uses the SDK |
|----------|---------------------|
| CLI (`cli/`) | 54+ import sites: `SavantCodeClient` (send-message lifecycle), `createRunConfig`, run-state storage, rewind (`listTurns`), provider setup (`resetOpenRouterApiKeyCache`), ripgrep (`getBundledRgPath`), skills (`loadSkills`), error utils, headless-run, MCP, agents validation, tool registry types |
| Eval harness (`evals/`) | Drives `SavantCodeClient.run()` directly as the benchmark runner — proof the SDK is independently usable |
| Agents tests (`agents/`) | `SavantCodeClient`, `loadLocalAgents` for definition tests |
| Savant-Free e2e (`savant-free/`) | `SavantCodeClient` for tester agents |
| **Future / intended** | The SDK's own comments name Convex Node actions and Next server routes as deployment targets (deploy-time URL override exists precisely for this) |

## Known asymmetries and technical debt

- **The SDK is unpublished** yet `private: false` with a full publish toolchain and README marketing
  — the public API surface has never been exercised by external consumers.
- **The provider metadata duplication** (base URLs/env vars in both `sdk` factories and `cli`
  setup) is a real drift risk — see `docs/design/Adding New Providers.md` for the single-registry
  fix.
- **Undeclared workspace dependency**: `sdk/src/index.ts` imports
  `@savant-code/agent-runtime` but `sdk/package.json` does not list it as a dependency — it works
  via workspace resolution today; a declared dependency would make the published package
  self-describing.
- **`createSavantCodeBackendModel` is misnamed** — it is the generic OpenAI-compatible fallback
  (routes to `INFERENCE_BASE_URL`), not a backend-specific adapter. Renaming it is a low-risk
  cleanup that removes a recurring source of confusion.
- Backend-bound functions (`startAgentRun`, `addAgentStep`, `getUserInfoFromApiKey`, composio,
  healthz) are stubbed or short-circuited in direct mode — the "backend" contract is dormant until
  the gateway exists.

## Expanding the SDK — roadmap considerations

The original owner deferred publishing until "the ecosystem grows." When you expand it, the highest-
value directions, roughly in dependency order:

1. **Provider registry refactor** (in `common`): collapse the provider metadata duplication so every
   future provider is a one-entry add. This is engine work that benefits the CLI and any public SDK
   equally — and it must land before adding "a lot" of providers.
2. **Gateway/client split**: the SDK's README's flagship flow (`SAVANT_CODE_API_KEY` → hosted agent
   store at `savant-code.com/store`) is downstream of the backend gateway. Decide whether the SDK
   should gain a first-class gateway client (the `Enterprise AI Gateway Research` doc is the
   groundwork) — this is the moment the SDK becomes a sellable surface.
3. **Streaming refinement**: `handleStreamChunk` exists; token-by-token streaming callbacks and
   richer event payloads are explicitly called out in the README as future work.
4. **Declared dependency hygiene** + a public API-stability policy (semver contract) before the
   first publish.
5. **Node-first posture**: the dist pipeline already targets Node >= 18 and passes compatibility
   subprojects — lean into that (serverless, CI, web) rather than Bun-only.

## Strategic context (why the SDK exists)

The SDK is how Savant-Code escapes the terminal. The CLI is the demo; the SDK is the product surface
that other tools, servers, and eventually a marketplace plug into. The business research
(`docs/research/Savant-Code Business And Backend Research.md`) describes the intended backend — a
stateful inference gateway where API keys are centralized and inference is monetized; the SDK's
arbitrary-model routing is what makes the product an "agnostic aggregator" rather than a
single-vendor lock-in. Publishing timing is a go-to-market decision, not an engineering one: the
engineering (Node compat, dual bundles, docs, examples, verification) is already done.

**Rule of thumb:** keep the engine boundary clean regardless of publish status — the CLI, the evals,
and any future public consumers all depend on it. The provider registry refactor is the highest-
leverage investment available right now.
