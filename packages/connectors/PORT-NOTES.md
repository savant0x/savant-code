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
| 4-space indent                                      | Savant prettier (2-space)                            | Repo convention; upstream fn normalization ignores formatting                 |

## Kept as-is

zod 4 (same major as Savant), the `typescript` package for compiler fn
normalization (already a Savant devDep), `canonicalize` (RFC 8785, MIT — the
one new runtime dep), the credential env convention
`<PROVIDER>_CREDENTIALS_<FIELD>` with credentials injected inside the
transport port only (upstream D16), and the closed-term fn lint whitelist.
