# PORT-NOTES — deviations from upstream monid

Every intentional deviation from the vendored upstream (`resources/monid-main/`,
MIT, © 2026 Monid Inc) is recorded here with its reason, so future upstream
pulls diff mechanically. Upstream decision references (D-numbers) cite
`resources/monid-main/openspec/changes/*/design.md`.

## Strip list (not ported)

| Upstream surface                                                | Reason                                                            |
| --------------------------------------------------------------- | ----------------------------------------------------------------- |
| Resource lifecycle family (D30–D47)                             | Hosted-ownership product surface; billing-adjacent                |
| Async run protocol (`lifecycle.start/poll/stop`, run-state KV)  | Hosted run orchestration; sync endpoints cover the launch catalog |
| `relayTransport` + monid-services seams                         | Hosted aggregation/billing relay                                  |
| Credit-pool settlement (composite pool algebra, broker pricing) | Billing model                                                     |
| KV ownership store                                              | Hosted resource persistence                                       |
| Catalog publish workflow / drift suites / Apify scaffolder      | Upstream catalog-maintenance infra                                |
| Three firecrawl async endpoints (`/crawl`, `/batch/scrape`, `/agent`) + their submit/status dirs | Durable-job protocol endpoints cannot execute on the sync-only engine; the `-status` GET endpoints (sync) stay (T106) |
| Engine async/resource EXECUTION machinery (`loadResource`, `LoadedResource`, start/poll/stop phase machine, `run()` poll loop, resource ownership gate, `linkResourceFns`, lifecycle/resource fn wrappers) | T106 strip (FID-2026-0930-001 amendment): the launch catalog is sync-only; an async doc now fails closed at LOAD with `ASYNC_UNSUPPORTED` |
| Lifecycle/resource fn-ABI utils (`makeLifecycleUtils`, `makeBoundedSleep`, `makeResourcesWindow`, `undeclaredResources`, `makeResourceOpUtils`) | T106 strip: sync hooks are PURE — `ctx.utils` is the frozen `{json, money}` ABI |
| `relayTransport` stub + `NOT_ASYNC`/`RESOURCE_OP_FAILED` error codes | T106 strip; replaced by `ASYNC_UNSUPPORTED` (load-time) |

## Substitutions

| Upstream                                            | Port                                                 | Reason                                                                        |
| --------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| `Deno.env.get` (engine/transport.ts)                | `process.env` via Bun                                | Runtime parity                                                                |
| `@std/semver` (engine/link.ts)                      | local `semver-compare.ts`                            | Drop JSR dep; Savant has no semver-ordering util (checked common/src)         |
| `@std/path`, `@std/fs`                              | `node:path`, `node:fs/promises`                      | Bun-native equivalents                                                        |
| `@std/yaml` + config.yml file read (core/config.ts) | inlined frozen constants (`core/contract-config.ts`) | Removes runtime file IO; bundle bytes stay a pure function of package content |
| `pino` / `@shared/logging`                          | console-backed `HookLogger`                          | Logging is a structural seam in the engine                                    |
| `@shared/app-config`                                | dropped (only config loader used it)                 | Strip                                                                         |
| `@shared/core` → `../../core/mod.ts` (or per-depth relative) — ALL 49 import statements across `compiler/`, `engine/`, `connectors/`, `testing/`, `runtime.ts`, `__tests__/`; `@shared/compiler` ×2 and `@shared/testing` ×1 in `__tests__/` | intra-package relative specifiers; the tsconfig `paths` alias removed | FID-2026-0930-003 Loop 2: the alias was connectors-private (`packages/connectors/tsconfig.json` only); a consumer workspace (agent-runtime) compiling the connectors source through the exports map could not resolve it — 49 TS2307/TS7006/TS18046 errors at the agent-runtime typecheck leg. Relative imports make the package self-contained under ANY consumer program (repo convention — no other workspace carries a private alias). |
| 4-space indent                                      | Savant prettier (2-space)                            | Repo convention; upstream fn normalization ignores formatting                 |

## Kept as-is

zod 4 (same major as Savant), the `typescript` package for compiler fn
normalization (already a Savant devDep), `canonicalize` (RFC 8785, MIT — the
one new runtime dep), the credential env convention
`<PROVIDER>_CREDENTIALS_<FIELD>` with credentials injected inside the
transport port only (upstream D16), and the closed-term fn lint whitelist.

## Tool-surface decisions (FID-2026-0930-003)

| Decision | Reason |
| --- | --- |
| Checked-in compiled bundle at `src/catalog/catalog.json` (COMMITTED, 152K) | Tool hosts load the artifact, never the compiler — `compiler/normalize.ts:23` + `compiler/lint.ts:1` import the `typescript` package, which must not enter the agent-runtime dependency graph. Rebuild with `bun run build:catalog` when connector sources change; compile is byte-deterministic (compiler-determinism.test.ts), so the artifact is reproducible. |
| `exports['./runtime']` → `src/runtime.ts`; `.` (→ `src/index.ts`) exists as of FID-2026-0930-003 Loop 2 — a two-line barrel re-exporting the runtime entry (compiler + testing remain explicit subpaths so a root import cannot drag the `typescript` package into a runtime consumer) | The package.json declaration promised the root export; the earlier deferral left a dangling declaration (a root import would fail at runtime). Updated 2026-09-30. |
| `runtime-replay.ts` separate module | Runtime replay is a MINIMAL structural consumer of recorded chains (no zod fixture validation, no header allowlist — hosts wanting that use `@savant-code/connectors/testing`); split kept runtime.ts under the 300-line ceiling. |
