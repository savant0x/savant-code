# @savant-code/connectors

Declarative, in-repo connector catalog over third-party web APIs — vendored
from [monid](https://github.com/monid) (MIT, © 2026 Monid Inc). See
[PORT-NOTES.md](./PORT-NOTES.md) for the full deviation ledger from upstream.

The launch catalog is **sync-only** (tinyfish, exa, firecrawl): every endpoint
executes as one declarative request — validate → auth (env-resolved at
egress) → transport → settle — with usage metered against the doc's own
rate card and the vendor's own meter winning when it reports one.

## Layout

| Path | Purpose |
| --- | --- |
| `src/core/` | Def-side schemas (`defineProvider` / `defineEndpoint` / presets), catalog inspection, sealed-unit loading |
| `src/compiler/` | `(defs, options) → bundle` pure mapping; byte-deterministic (RFC 8785 hashing) |
| `src/engine/` | Sync execution: load gates, request build, transport, settle, usage fold |
| `src/connectors/` | The vendor definitions (authoring surface) |
| `src/testing/` | Record/replay harness for offline endpoint tests |
| `src/runtime.ts` | The **tool-facing** entry — catalog browse, describe, execute |
| `src/catalog/catalog.json` | The checked-in compiled bundle (committed artifact) |

## The tool surface (FID-2026-0930-003)

The catalog is exposed to agents as a fixed-size **meta-tool family**
(`connector_search` / `connector_describe` / `connector_invoke` /
`connector_credentials`) registered in `@savant-code/common` and executed by
`@savant-code/agent-runtime` handlers under
`packages/agent-runtime/src/tools/handlers/tool/connector-*.ts`. The family
mirrors the composio precedent: per-tool safety metadata (catalog reads
`allow`, vendor egress `prompt`), env-var credential seam (names only across
the tool boundary — values are read solely inside the transport at egress),
and `jsonToolResult` outputs.

Consumers load the **checked-in compiled bundle** via
`loadLaunchBundle()` (or `loadBundleFile(path)`) and execute sealed units
through `executeEndpoint` — never the compiler at run time (the compiler
imports the `typescript` package, which must not enter a runtime dependency
graph). `mode: 'replay'` serves a recorded fixture chain through the
runtime's structural replay (zero network); hosts register their own fixture
loader, and the agent-runtime ships none (replay is the test/integration
path).

Rebuild the bundle when connector sources change:

```bash
bun run build:catalog
```

Compile is byte-deterministic (guarded by `compiler-determinism.test.ts`), so
the committed artifact is reproducible.

## Tests

```bash
bun test src/
```

All suites are offline (replay fixtures; no network in CI).
