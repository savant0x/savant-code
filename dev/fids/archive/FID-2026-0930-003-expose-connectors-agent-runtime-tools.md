# FID: Expose the connectors catalog as agent-runtime tools (connector_* tool family)

**Filename:** `FID-2026-0930-003-expose-connectors-agent-runtime-tools.md`
**ID:** FID-2026-0930-003
**Severity:** medium
**Status:** closed
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
**YAGNI-Compliance:** Resolved at implementation — the 4-tool meta-family
covers the 9-endpoint launch catalog with a fixed-size surface (Law 13: the
shape generalizes to any future provider without new tool names); per-endpoint
tools remain rejected.

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

### Verification Receipt

- fingerprint: sha256:5f50e69cc80e67bdfc3c30b5fbf807572ca21d5d727d7200935e399b8a09ad44
- verified: 2026-10-01T14:06:42.075Z
- typecheck common: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck packages/connectors: exit 0
- test common/src/tools/__tests__/connector-tool-params.test.ts: exit 0
- test packages/connectors/src/__tests__/catalog-tools-surface.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/connector-handlers.test.ts: exit 0
- quality: exit 0

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

### Loop 2 — RED (implementation session, 2026-09-30)

- **RED:** Implementation began (registration surfaces all landed: union,
  params, client schema, safety, handler record, SDK branch) and the root
  typecheck gate failed with **49 errors** at the `packages/agent-runtime`
  leg (common leg alone: 0). Mechanism, measured: the vendored engine uses a
  package-private tsconfig path alias `@shared/core` → `./src/core/mod.ts`
  (declared only in `packages/connectors/tsconfig.json`; 49 real import
  statements across compiler/, engine/, connectors/, testing/, runtime.ts,
  __tests__ — plus `@shared/compiler` ×2 and `@shared/testing` ×1, all in
  connectors' own test files; `@shared/*` appears NOWHERE else in the repo).
  tsc with `moduleResolution: bundler` resolves `@savant-code/connectors/runtime`
  through the workspace symlink's exports map and compiles the connectors
  SOURCE into the consumer's program — where the alias is undefined: 11 ×
  TS2307, cascading into TS7006 implicit-any and TS18046 in transport.ts.
  The FID's compiler-stays-out rule is confirmed intact: `@shared/compiler`
  is imported only by connectors' own test files; the runtime entry imports
  none of it.
- **GREEN:** Two decisions, recorded here as the presentation before the
  change (level 3):
  1. **De-alias the vendored import specifiers (Option A).** Rewrite the
     52 `@shared/core` / 2 `@shared/compiler` / 1 `@shared/testing` import
     specifiers to intra-package relative paths. Rejected Option B — mapping
     `@shared/core` into each consumer's tsconfig — because it repeats a
     ritual for every future consumer (Five Questions Q1) and points the
     dependency direction the wrong way (Q4): a vendored package's private
     alias is not a public surface. Every other workspace in this repo uses
     plain relative imports; the package becomes self-contained and resolves
     under ANY consumer program. Substitution recorded in PORT-NOTES.md.
     Prose comments that reference `@shared/*` as historical upstream names
     stay (they cite the port's origin, not a live module).
  2. **Create `src/index.ts` as a barrel.** `package.json` declares
     `"." → ./src/index.ts` but the file does not exist — a dangling export
     declaration (a consumer importing the package root fails at runtime).
     PORT-NOTES had deferred the index "until a consumer needs it", but the
     declaration itself already promises it; a two-line barrel re-exporting
     the runtime entry closes the gap honestly. PORT-NOTES row updated.
- **CHANGE DELTA:** Loop-2 GREEN adds the two decisions above; no plan
  section rewritten.

### Loop 2 continuation — the SDK leg (same session)

- **RED (second mechanism, measured):** after the de-alias, the full root
  chain failed at the **sdk** leg with **281 × TS5097** (`import path can
  only end with a '.ts' extension when 'allowImportingTsExtensions' is
  enabled`) on connectors sources. `sdk/tsconfig.json` path-maps
  `@savant-code/agent-runtime/*` to SOURCE, so the SDK program transitively
  compiles the connectors files (through the handler imports), and the SDK
  sets `allowImportingTsExtensions: false` while every connectors file uses
  Deno-style `.ts` import extensions (452 specifiers — the vendored
  convention; stripping them is a 452-site rewrite, exactly the
  "too repetitive by hand" signal the protocol says to stop at).
- **GREEN (decision 3):** fix at the consumer's config, following the SDK's
  own established posture: (a) `sdk/tsconfig.json` → `true` (typecheck-only,
  `tsc --noEmit`); (b) `sdk/tsconfig.build.json` → `true` (declaration emit
  with `emitDeclarationOnly: true` — TS permits the flag in exactly this
  mode); (c) `sdk/scripts/build.ts` adds `@savant-code/connectors` to the
  dts-bundle-generator `importedLibraries` list beside
  `@savant-code/agent-runtime`, keeping workspace types external in the
  bundled d.ts (the existing design for every other workspace package —
  Law 11). Runtime bundles are unaffected: Bun.build resolves `.ts`
  extensions natively, and the SDK's honest-error branch means the inlined
  connectors code is never executed in SDK mode. Verified by the sdk
  typecheck + suite + `bun run build` (d.ts generation) after the change.
  (d) `eslint.config.js` tooling override extended to `packages/*/scripts/**`:
  the de-alias moved `@shared/core` imports from the eslint `internal` group
  to `parent`, re-triggering `import/order` across 42 files; resolved with
  the project's own `eslint --fix` (T106 practice: fixer + hand-verified
  output), and the one remaining `no-console` in
  `packages/connectors/scripts/build-catalog.ts` is exactly the
  "dedicated CLI script" class the tooling override's own rationale names —
  the override list predates the 13th workspace. `packages/*/src` stays
  governed.
- **CHANGE DELTA:** adds decision 3 only; no plan section rewritten.

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

- [x] **Commit SHA:** `7187d1ec` — `feat(tools): expose the connectors
      catalog as agent-runtime tools (FID-2026-0930-003)` (78 files,
      +5980/−197), operator-authorized 2026-10-01.
- [x] **File:line ranges:**
      - `common/src/constants/connectors.ts:11-16` (CONNECTOR_TOOL_NAMES,
        4 names) + `:20-24` (`isConnectorMetaToolName` guard)
      - `common/src/tools/constants.ts:3` (import), `:95`
        (`...CONNECTOR_TOOL_NAMES` in toolNames), `:3` publishedTools
        untouched (meta-tools ride clientToolCallSchema — composio
        precedent)
      - `common/src/tools/list.ts:11` (import), `:119`
        (`...connectorMetaToolParams` in toolParams), `:212-226`
        (4 clientToolCallSchema options)
      - `common/src/tools/safety-registry-orchestration.ts:181-202`
        (4 safety entries: search/describe network+allow, invoke
        network+prompt, credentials read+allow)
      - `packages/agent-runtime/src/tools/handlers/list.ts:86-89`
        (4 handler-record entries — the exhaustive Record makes this
        the compile-enforced Law-4 half)
      - `packages/agent-runtime/src/tools/handlers/tool/connector-{bundle,
        search,describe,invoke,credentials}.ts` (15/39/37/83/82 lines,
        all under the 300 ceiling; DI via `BundleProvider`, env-seam
        credentials, no direct fetch in any handler)
      - `sdk/src/run/tool-call.ts:4` (import), `:249-266` (honest-error
        branch beside the composio one)
      - `packages/connectors/src/runtime.ts` (tool-facing runtime entry,
        253 lines) + `src/index.ts` (root barrel) + `src/runtime-replay.ts`
        (structural replay, 88 lines)
      - De-alias: 54 files' `@shared/*` specifiers → intra-package
        relative (`packages/connectors/src/**`, `scripts/build-catalog.ts`);
        tsconfig `paths` removed (`packages/connectors/tsconfig.json`);
        ledgered in PORT-NOTES.md substitution table
      - SDK leg: `sdk/tsconfig.json` + `sdk/tsconfig.build.json`
        (`allowImportingTsExtensions: true` in no-emit/declaration-only
        contexts), `sdk/scripts/build.ts` (+connectors in
        `importedLibraries`), `eslint.config.js` (+`packages/*/scripts/**`
        tooling override)
- [x] **Gate output:** all 7 declared gates exit 0 on the final tree
      (2026-10-01): root typecheck chain (14 legs incl. connectors) 0
      errors; `common` connector-tool-params 8 pass / 0 fail;
      `packages/connectors` catalog-tools-surface 17 pass / 0 fail
      (workspace 27/27 incl. the pre-existing 10);
      `packages/agent-runtime` connector-handlers 10 pass / 0 fail;
      `quality: PASS (1498 baselined files)`; root `bun run test` 0 fail
      (all 13 workspace suites); sdk suite 600 tests / 0 fail incl. the
      2-test SDK honest-error pin (`sdk/src/__tests__/connector-tool-call.test.ts`);
      eslint `--max-warnings 0` exit 0; `lint:md` exit 0;
      `validate:repository` PASS; `build:catalog` regenerates the artifact
      (3 providers, 9 endpoints).
- [x] **Reproducibility:** from a clean checkout of the committed tree:
      `bun install && bun run typecheck && bun run test && bun x eslint .
      --max-warnings 0 && bun run lint:md && bun run quality:report` —
      offline (replay fixtures; the only env dependency is the
      credentials-presence test, which sets and restores its own var).
      `bun run build:catalog` from `packages/connectors` regenerates
      catalog.json byte-identically (compiler-determinism gate).
- [x] **Step statuses:** Step 1 (common names/params/safety)
      `implemented`; Step 2 (bundle read path — `loadLaunchBundle`,
      runtime entry, committed-artifact decision in PORT-NOTES, index
      barrel) `implemented`; Step 3 (4 handlers + registration + env-seam
      credentials) `implemented`; Step 4 (SDK honest-error parity —
      uniform branch for all four names, the FID's "otherwise same
      honest-error" arm) `implemented`; Step 5 (three suites, exact
      declared paths) `implemented`; Step 6 (README tool-surface section,
      PORT-NOTES decisions, session summary at close) `implemented`.
      Loop-2 additions (de-alias, SDK config leg, eslint override) are
      `implemented` per the Loop-2 GREEN record. No step is deferred and
      none is dropped.

### Code Verification Evidence

> Post-implementation state (ground-truthed 2026-10-01): every cited file
> exists and carries the described implementation — registration verified
> by grep (`handlers/list.ts:86-89`, `safety-registry-orchestration.ts:181-202`,
> `constants.ts:95`, `list.ts:119+212-226`, `sdk/src/run/tool-call.ts:249`),
> behavior verified by the three new offline suites plus the SDK
> honest-error pin, and Law-4 by the exhaustive handler Record (a missing
> entry fails the agent-runtime typecheck) together with the
> `toolSafetyRegistry` module-load completeness check. The connectors
> package is self-contained: zero `@shared/*` specifiers remain
> (`grep -rn "from '@shared/'" packages/connectors → 0`), the alias is
> removed from its tsconfig, and `src/index.ts` exists so the `.` export
> declaration is no longer dangling.

## Resolution

- **Closed Date:** 2026-10-01 (commit `7187d1ec`)
- **Fix Description:** the connectors catalog is reachable from the agent
  tool vocabulary as a 4-tool meta-family (composio precedent) — names,
  params, client schema, safety entries, DI-shaped handlers, checked-in
  bundle consumption (never the compiler), env-seam credentials (names
  only across the tool boundary), SDK honest-error parity — plus the
  cross-workspace import repairs the implementation surfaced (de-alias of
  the vendored `@shared/*` specifiers, `src/index.ts` barrel, SDK
  `.ts`-extension acceptance in no-emit contexts, d.ts external, eslint
  tooling override).
- **Tests Added:** `common/src/tools/__tests__/connector-tool-params.test.ts`
  (8), `packages/connectors/src/__tests__/catalog-tools-surface.test.ts`
  (17), `packages/agent-runtime/src/__tests__/connector-handlers.test.ts`
  (10), `sdk/src/__tests__/connector-tool-call.test.ts` (2) — all
  declared gates or declared-Verification artifacts, all offline.
- **Verification Evidence:** see Implementation Evidence above (gate
  outputs, file:line citations, reproducibility recipe).
- **Archived:** `dev/fids/archive/FID-2026-0930-003-expose-connectors-agent-runtime-tools.md`
  (2026-10-01; closure edits follow the receipt stamp, so the stored
  fingerprint reflects the verification that earned `verified` — the
  documented by-design drift at closure)

## Lessons Learned

(At convergence, provisional:) The composio meta-tool family turned out to
be a load-bearing precedent: every surface a new tool must touch (union,
params, client schema, safety, handler record, SDK branch) already had a
worked example, which converted an unknown-shape integration into a
checklist. When porting a library, deferring the tool-surface wiring to its
own FID keeps the port green and single-concern — but the wiring FID must be
authored while the port's seams are fresh; every cite in this document
comes from the same session.
