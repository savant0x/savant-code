# FID: Expose the connectors catalog as agent-runtime tools (connector_* tool family)

**Filename:** `FID-2026-0930-003-expose-connectors-agent-runtime-tools.md`
**ID:** FID-2026-0930-003
**Severity:** medium
**Status:** converged
> (`converged` is the correct pre-implementation status per
> FID-2026-0915-004; `fixed` is deprecated-but-accepted legacy language —
> do not use it for new FIDs. The receipt contract still keys to
> `fixed | verified` so archived records remain valid.)
**Created:** 2026-09-30 14:05
**Automation level:** 3
> (Authority this FID needs to be actioned **without asking**: `1` approval-gated,
> `2` within approved scope, `3` fully automatable. The session ceiling is
> `protocol.config.yaml` → `session.autonomy_level`; an item is actioned without
> approval only when its level is ≤ the session level. No level lifts the G-laws,
> credential handling, Law 3, or the project-directory boundary — see
> "Automation Levels" in the governing protocol.)
**YAGNI-Compliance:** Pending

---

## Summary

`@savant-code/connectors` (FID-2026-0930-001/-002) is a green, registered
library that no agent can reach: nothing in `packages/agent-runtime`,
`common`, or the bundled agents imports it, so the launch catalog
(tinyfish, exa, firecrawl) is dead code from the runtime's perspective —
Law 4 (reachability) is unmet by construction. This FID wires the catalog
into the agent tool vocabulary as a small **meta-tool family** following the
`composio_*` precedent: `connector_search` (browse the catalog),
`connector_describe` (endpoint contract + parameter schema),
`connector_invoke` (execute an endpoint through the engine), plus
`connector_credentials` (report which vendor env keys are present —
names only, never values). The engine executes sync endpoints only
(async/resource machinery stripped in T106 first); credentials are resolved
at run time from env vars by the engine's own seam (`resolveCredentialEnv` /
`envParamsResolver`); results flow back as `jsonToolResult`. SDK parity
follows the composio honest-error precedent until an SDK-side executor is
justified.

## Environment

- **OS:** Windows (win32, bash shell)
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14 (root `engines.bun`)
- **Tool Versions:** zod ^4.2.1 (both sides), ajv ^12 + ajv-formats ^3
  (engine validation seam), typescript 5.5.4 (compiler-side only)
- **Commit/State:** working tree 2026-09-30; `packages/connectors` green
  (workspace tsc exit 0, 10/10 offline tests), registered in root chains +
  `VALIDATION_WORKSPACE_POLICY` (FID-2026-0930-002)

## Detailed Description

### Problem

The connection layer exists but is unreachable from the agent surface:

1. `packages/agent-runtime` has no dependency on
   `@savant-code/connectors` (`packages/agent-runtime/package.json`
   dependencies: knowledge-graph, gpt-tokenizer, zod-from-json-schema,
   lodash — no connectors), and no import of it anywhere under
   `packages/agent-runtime/src`.
2. `common/src/tools/constants.ts:69` (`toolNames`) and
   `common/src/tools/list.ts:119` (`toolParams`) contain no
   `connector_*` entries, so the union type, params map, safety registry,
   and call schema cannot express these calls.
3. The bundled Savant agent's `toolNames` list (`agents/savant/savant.ts:142`)
   has no connector entries — and as a **meta-tool family**, no per-agent
   edit is required: reachability comes from the executor's catalog wiring,
   not agent rosters (same as composio, which no bundled agent lists).
4. The session-1 amendment (FID-2026-0930-001) and SCOPE.md T106 note that
   the vendored engine still carries upstream async/resource internals —
   a network-exposing tool must not advertise run modes the launch catalog
   cannot honor.

### Expected Behavior

After wiring:

- The model can call `connector_search`, `connector_describe`,
  `connector_invoke`, `connector_credentials`; all four parse through
  `toolParams`, dispatch through `executeToolCall`
  (`packages/agent-runtime/src/tools/tool-executor/native.ts:22`), and hit
  handlers under `packages/agent-runtime/src/tools/handlers/tool/`.
- Safety metadata follows the composio precedent
  (`common/src/tools/safety-registry-orchestration.ts:160-179`):
  `connector_search` / `connector_describe` = `network`/`allow`
  (catalog reads over the in-repo bundle — no egress);
  `connector_invoke` = `network`/`prompt` (vendor egress);
  `connector_credentials` = `read`/`allow` (env key NAMES only).
- Endpoint execution goes through the engine's sync run path only; the
  stripped async/resource surface cannot be reached from the tool input
  schema.
- SDK mode (`sdk/src/run/tool-call.ts`) answers `connector_invoke` honestly
  when it has no local executor (composio precedent at
  `sdk/src/run/tool-call.ts:281-295`) rather than failing opaque.

### Root Cause

Not a defect — a missing integration step. The connectors workspace was
deliberately ported library-first (FID-2026-0930-001) with the tool-surface
wiring scheduled as the session-2 follow-up; this FID is that follow-up.

### Evidence

```text
packages/agent-runtime/package.json — dependencies: @savant-code/knowledge-graph,
  gpt-tokenizer, zod-from-json-schema, lodash (no @savant-code/connectors)
common/src/tools/constants.ts:69-114 — toolNames union; no connector_* names
common/src/tools/list.ts:119-147 — toolParams map ends at ponytail_debt +
  ...composioMetaToolParams; no connector_* params
common/src/tools/safety-registry-orchestration.ts:160-179 — composio entries
  (network/allow for search+schemas, network/prompt for manage, mixed/prompt
  for execute) — the precedent shapes
packages/agent-runtime/src/tools/handlers/list.ts:76-133 — handler record is
  an exhaustive Record<ToolName, …>; adding names without handlers fails tsc
sdk/src/run/tool-call.ts:281-295 — composio unavailable branch (honest error)
agents/savant/savant.ts:142-150 — Savant toolNames list (buildArray; no
  connector entries needed — meta tools ride the executor)
```

Precedent for the runtime import mechanism: `packages/agent-runtime`
resolves `@savant-code/*` through tsconfig paths
(`packages/agent-runtime/tsconfig.json` extends `tsconfig.base.json`;
`common/src/tools/*` imports work without a package.json dependency entry),
so `@savant-code/connectors` imports follow the same path-mapping route —
dependency injection keeps the handler testable without the workspace.

## Impact Assessment

### Affected Components

- `common/src/tools/constants.ts` — toolNames union (+`CONNECTOR_TOOL_NAMES`
  const, following `COMPOSIO_META_TOOL_NAMES` in `common/src/constants/composio.ts`)
- `common/src/tools/params/tool/connectors.ts` — new params module (zod)
- `common/src/tools/list.ts` — toolParams spread + clientToolCallSchema options
- `common/src/tools/safety-registry-orchestration.ts` — 4 safety entries
- `packages/agent-runtime/src/tools/handlers/tool/connector*.ts` — 4 handlers
- `packages/agent-runtime/src/tools/handlers/list.ts` — handler registration
- `packages/connectors` — no source changes (consumer side only); a
  session-2 read path for the checked-in compiled bundle
- `sdk/src/run/tool-call.ts` — connector branch (honest-error until SDK executor)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] Medium: New network-capable tool surface; mitigated by prompt-gated
      invoke, env-only credentials, sync-only engine, and the existing
      sandbox gate chain (`native.ts:93` pre-dispatch gates run before any
      handler).
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Meta-tool family over the catalog (4 tools, not N endpoint tools), mirroring
the composio design so every registration surface already has a proven
shape. The connector surface is data-driven: `connector_invoke` takes
`{ provider, endpoint, input, mode }`; the endpoint contract (needed by the
model to fill `input`) comes from `connector_describe`, which reads the
endpoint doc — the doc IS the contract (catalog invariant,
`packages/connectors/src/core/catalog.ts:63`).

Engine consumption rule (decided from compiler imports): agent-runtime
consumes a **checked-in compiled bundle** built by the connectors package's
own build step — never the compiler at run time. `compiler/normalize.ts:23`
and `compiler/lint.ts:1` import the `typescript` package; a tool handler
must not pull that into the agent runtime dependency graph. The engine
(`Engine`, `runEndpoint`-equivalent via `loadEndpoint`) is the only engine
surface the handlers import.

Handler shape follows `read-files.ts`: typed `ToolName` alias, `satisfies
SavantCodeToolHandlerFunction<ToolName>`, `await previousToolCallFinished`
first, `jsonToolResult` output. Engine deps enter handlers by parameter
injection (catalog-loader + bundle-provider functions), keeping the
handler record import-light and testable offline (replay fixtures exist —
`packages/connectors/src/testing/fixtures.ts`).

### Steps

1. **common: names + params + safety.** Add
   `CONNECTOR_TOOL_NAMES = ['connector_search', 'connector_describe',
   'connector_invoke', 'connector_credentials']` to
   `common/src/tools/constants.ts` (spread into `toolNames` — NOT into
   `publishedTools`; SDK publishes via clientToolCallSchema, composio
   precedent). Author `params/tool/connectors.ts`: `connector_search`
   `{ provider?, category?, query? }`; `connector_describe`
   `{ provider, endpoint }`; `connector_invoke`
   `{ provider, endpoint, input, mode?: 'replay' | 'live' }` with
   `input: jsonObjectSchema`; `connector_credentials`
   `{ provider }` with `outputSchema` enumerating credential field names.
   Spread into `toolParams` + append 4 options to `clientToolCallSchema`
   (`common/src/tools/list.ts:186-209`). Safety entries in
   `safety-registry-orchestration.ts` after the composio block. The
   `toolSafetyRegistry` load-time completeness check
   (`common/src/tools/safety-registry.ts:17-24`) fails loudly if any is
   missed.
2. **connectors: bundle read path (no compiler in consumers).** Add a
   package-internal module that loads the checked-in compiled bundle JSON
   (build step emits it at package build; the T106 strip lands before this
   FID implements, so the engine surface is sync-only by then). Expose
   `loadLaunchBundle()` + engine `loadEndpoint`-style runtime entry. Verify
   the bundle file is gitignored or committed deliberately (decision
   recorded in PORT-NOTES.md) and that `connector_describe` reads docs
   straight from the bundle (catalog functions
   `listProviders`/`listEndpoints`/`inspectEndpoint`).
3. **agent-runtime: handlers.** Author 4 handlers under
   `tools/handlers/tool/` (`connector-search.ts`, `connector-describe.ts`,
   `connector-invoke.ts`, `connector-credentials.ts`); register in
   `handlers/list.ts:76-133`. `connector_invoke` resolves credentials via
   the engine's `resolveCredentialEnv`/`envParamsResolver` seam only; it
   never reads vendor key VALUES into handler state or logs. Egress goes
   through the engine's transport (auth injected at egress); the handler
   does no fetch of its own.
4. **sdk: honest-error parity.** In `sdk/src/run/tool-call.ts`, add a
   connector branch beside the composio one: `connector_invoke` returns an
   honest `errorMessage` (SDK executor not implemented);
   `connector_search`/`connector_describe`/`connector_credentials` MAY be
   served locally from the bundle if trivial (implementer's judgment,
   recorded in the FID evidence) — otherwise same honest-error. Either
   way, no silent opaque failure.
5. **Tests (repo-relative, also declared as gates):**
   - `packages/connectors/src/__tests__/catalog-tools-surface.test.ts` —
     bundle loads; describe returns the tinyfish doc; invoke replay of
     tinyfish settles `{credits:{},evidence:{}}` through the tool-facing
     entry (reuses existing fixtures, offline).
   - `common/src/tools/__tests__/connector-tool-params.test.ts` — 4 names
     in union+params+client schema; safety entries present with expected
     effect/permission; registry completeness check passes.
   - `packages/agent-runtime/src/__tests__/connector-handlers.test.ts` —
     handler dispatch via injected fake bundle+engine: search filters,
     describe errors on unknown endpoint (INVALID_INPUT shape), invoke
     replay-mode result flows through `jsonToolResult`, credentials
     reports names only with a fake env (asserting no value leaks into the
     output JSON).
6. **Docs + ledger.** `packages/connectors/README.md` (tool surface
   section), PORT-NOTES.md bundle-visibility decision, session summary.
   AGENTS.md needs no workspace-count change (no new workspace).

### Verification

- All three new suites pass offline (no network in CI).
- `bun run typecheck` root chain green (common + agent-runtime legs prove
  the exhaustive-record registration).
- `quality` gate exit 0 (file ceiling respected — params/handlers each
  well under 300 lines).
- Reachability evidence for Law 4: the handler record
  (`handlers/list.ts`) contains the four entries and
  `toolSafetyRegistry` completeness check passes at module load — both
  cited with file:line in the FID evidence at implementation.
- SDK branch: unit assertion that `connector_invoke` without executor
  yields the honest-error JSON (in `connector-handlers.test.ts` or a small
  sdk-side check if the branch lives in sdk/).

> Contract rule (FID-2026-0918-006): every promised test artifact names its
> repo-relative `*.test.ts` path, and each appears as a declared
> `- gate: test <path>` below.

## Verification Gates

- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: typecheck packages/connectors
- gate: test common/src/tools/__tests__/connector-tool-params.test.ts
- gate: test packages/connectors/src/__tests__/catalog-tools-surface.test.ts
- gate: test packages/agent-runtime/src/__tests__/connector-handlers.test.ts
- gate: quality

## Perfection Loop

### Loop 1 — RED

- **RED:** Issues identified at authoring: (1) the compiler imports the
  `typescript` package (`compiler/normalize.ts:23`, `compiler/lint.ts:1`) —
  importing compile-at-run from agent-runtime would drag a transpiler into
  the runtime dependency graph; mitigated by the checked-in-bundle rule
  (step 2). (2) `packages/connectors` package.json exports `.` →
  `src/index.ts`, which does not exist yet — either create the index or
  import subpaths (`./core`, `./engine`); step 2 pins subpath imports and
  records the index decision in PORT-NOTES.md. (3) The exhaustive handler
  record means adding names to `toolNames` without handlers breaks the
  common→agent-runtime typecheck — good (loud failure), but it orders the
  steps: common first, handlers in the same change set, never merged
  half-done. (4) `new Function` instantiation at engine run: a tool handler
  triggering it inherits whatever the engine lints at compile; sync-only
  launch endpoints are already proven by the replay suite (FID-001 gates).
  (5) Scope-creep risk: per-endpoint tools (one tool per endpoint) rejected
  — catalog is 3 providers today and would flood the tool vocabulary;
  meta-tools keep the surface fixed-size (YAGNI: Pending until
  implementation confirms 4 tools suffice).
- **GREEN:** Not applicable yet — converged plan; implementation opens the
  session-2 wiring step after T106 lands.
- **AUDIT:** Document-level audit 2026-09-30: every cited seam read this
  session — `native.ts:22` (executeToolCall signature),
  `handlers/list.ts:76-133` (exhaustive record),
  `safety-registry.ts:13-24` (completeness check),
  `list.ts:119-147` (toolParams shape) and `:186-209` (clientToolCallSchema
  options), `constants.ts:69-114` (toolNames + publishedTools),
  `sdk/src/run/tool-call.ts:281-295` (composio honest-error),
  `catalog.ts:63` (inspectEndpoint doc-as-contract),
  `agents/savant/savant.ts:142-150` (toolNames buildArray). Gate shapes
  checked against `scripts/validation-gates.ts:22-55` (all three typecheck
  workspaces present with requiredTypecheck: true) and the template's
  allowlist (Verification Gates section). Declared probe-free: no
  repo-gate check needs proving; the parity probe pattern is not required
  here.
- **ADVERSARIAL:** Strongest refutation attempt: "MCP already provides
  third-party tools — why wire connectors at all?" Rebuttal: MCP requires
  an external server process per vendor; the connectors layer is
  declarative, in-repo, offline-compilable, and replay-testable with no
  process supervision — the composio meta-tools survive as the
  hosted-catalog path while connectors serve the in-repo catalog. Second
  attempt: "connector_invoke duplicates run_terminal_command egress."
  Rebuttal: terminal egress is prompt-gated shell execution with no input
  schema; connector invoke is schema-validated, engine-transported, and
  credential-seamed — a different (and safer) egress class, which is
  exactly what the `network`/`prompt` safety entry encodes.
- **CHANGE DELTA:** 0% (initial authoring pass).

### Missed Questions

> Surface every question that should have been asked when this FID was
> created, answer it with the most robust default derivable from inspection,
> and fold the answer back into the relevant sections.

1. **Do bundled agents need `toolNames` edits to reach these tools?** No —
   composio meta-tools are in no bundled agent's list
   (`agents/bundled-agents.generated-data/*` grep shows none) yet are part
   of the tool vocabulary; reachability is executor-level. Folded into
   Problem item 3 / Approach.
2. **Does the SDK publish these to client UIs?** Not automatically —
   `publishedTools` (`constants.ts:117-137`) omits composio and will omit
   connectors; the client publishes via `clientToolCallSchema`, which this
   FID extends, so SDK-side parsing accepts the calls (parse) while
   execution answers honestly (step 4). Folded into step 1 + 4.
3. **Where do vendor API keys come from?** Env vars via the engine's
   existing seam (`resolveCredentialEnv`, `envVarFor` —
   `engine/mod.ts` exports); no new storage, no key VALUES in tool output.
   The `connector_credentials` tool reports names/presence only. Folded
   into steps 1/3.
4. **Replay mode in production — is a live tool allowed to run replay?**
   Yes, bounded: `mode` defaults to `live`; `replay` requires a fixture
   source and is the test path. Production agents call live; replay is how
   the suite proves behavior offline. Folded into step 1 schema + step 5.
5. **What if the bundle file is stale relative to connector sources?**
   The connectors package build recompiles; the tool-params suite asserts
   bundle loads, and a drift probe is OUT of scope here (YAGNI) — noted as
   a possible follow-up if drift bites.
6. **Why 4 tools and not a single `connector` tool with an action enum?**
   Safety metadata is per-tool (`effect`/`permission` differ: search
   allow vs invoke prompt); one tool would force prompt on catalog reads.
   Folded into Approach.
7. **Windows/Bun constraints?** No new runtime deps; bundle load is
   `readFile` + `JSON.parse`; fixture paths use `fileURLToPath` (session-1
   port note). Folded into step 2/5.

### Implementation Evidence (REQUIRED for `closed`)

> Not yet fillable — status is `converged`. This section fills at closure.

- [ ] **Commit SHA:** pending implementation
- [ ] **File:line ranges:** pending implementation
- [ ] **Gate output:** pending implementation
- [ ] **Reproducibility:** pending implementation
- [ ] **Step statuses:** Steps 1–6 `blocked pending session-2 execution`
      (sequenced after T106); none started; no step is deferred and none
      is dropped.

### Code Verification Evidence

> Pre-implementation state: referenced code is existing repo infrastructure
> and the session-1 package. Verified this session (reads captured above):
> `packages/agent-runtime/src/tools/tool-executor/native.ts:22` (executor
> entry), `packages/agent-runtime/src/tools/handlers/list.ts` (exhaustive
> handler record), `common/src/tools/constants.ts:69` (toolNames),
> `common/src/tools/list.ts:119` (toolParams) and `:186`
> (clientToolCallSchema options), `common/src/tools/safety-registry.ts:17`
> (completeness check), `common/src/tools/safety-registry-orchestration.ts:160-179`
> (composio precedent), `sdk/src/run/tool-call.ts:281` (honest-error
> branch), `packages/connectors/src/core/catalog.ts:63` (doc-as-contract),
> `packages/connectors/package.json` (exports map; `.` → missing
> `src/index.ts`), `packages/agent-runtime/package.json` (no connectors
> dependency — path-mapping route confirmed from tsconfig extends).
> Status `converged` reflects reality: no wiring code exists yet.

## Resolution

- **Closed Date:** — (open)
- **Fix Description:** —
- **Tests Added:** —
- **Verification Evidence:** —
- **Archived:** —

## Lessons Learned

(At convergence, provisional:) The composio meta-tool family turned out to
be a load-bearing precedent: every surface a new tool must touch (union,
params, client schema, safety, handler record, SDK branch) already had a
worked example, which converted an unknown-shape integration into a
checklist. When porting a library, deferring the tool-surface wiring to its
own FID keeps the port green and single-concern — but the wiring FID must be
authored while the port's seams are fresh; every cite in this document
comes from the same session.
