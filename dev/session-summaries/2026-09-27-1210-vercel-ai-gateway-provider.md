# Session Summary — 2026-09-27 12:10

**Vercel AI Gateway shipped as built-in provider `vercel` (SCOPE Task 88,
FID-2026-0927-001): FID-bound first, RED-first implementation, all gates green,
record closed + archived with receipt 13/13 LIVE at the archived path.**

## Trigger

Operator instruction: "i am interested in adding a new provider
https://vercel.com/docs/ai-gateway, i believe i have a walkthrough doc for the
full process." The walkthrough is `docs/archive/design/Adding New Providers.md`.
Operator rulings recorded verbatim in SCOPE Task 88 (2026-09-27): scope approved
**FID-bound first** (Perfection Loop converges before any code); routing prefix
**`vercel`**; credentials **two ways — via `.env.local`, and also via the cli**
(masked `/provider vercel` store; shell precedence per FID-2026-0804-001).

## Grounding (before any edit)

`dev/echo-v0.1.2-single-agent.md` read 0-EOF as the operating protocol;
`templates/FID-TEMPLATE.md`, `dev/fids/README.md`, the provider contract modules
(`common/src/providers/{registry,registry-partitioned,types,audit,provider-exception-manifest}.ts`),
`cli/src/utils/openrouter-models/{gateway,types,live-catalog,orcarouter}.ts`, all
six gate test files, both READMEs, `cli/release/README.md`, the four
hand-maintained docs surfaces, and SCOPE.md 0-EOF. FID number allocated
`FID-2026-0927-001` (no prior 0927 records).

## Intake probes (read-only, measured live)

- Keyless `GET https://ai-gateway.vercel.sh/v1/models` → **200**, 391 models,
  OpenAI list shape with gateway-specific fields: `context_window` (not
  `context_length`), `max_tokens` (not `max_completion_tokens`), numeric
  `created`, plus `pricing`/`tags`/`supported_parameters`. Upstream ids are
  vendor-namespaced **with slashes** (`alibaba/qwen-3-14b`, `openai/gpt-6-astra`).
- Keyless `POST /v1/chat/completions` → **401** (fail-closed boundary).
- No documented key-scoped balance endpoint → no `quota` field in the entry.

## Runbook gap (the session's lesson)

The archived walkthrough ("one registry entry + a catalog reference. Everything
else derives.") under-documents the current contract in two places the live code
enforces fail-closed: `common/src/providers/audit.ts` requires a `live-catalog`
entry in `PROVIDER_EXCEPTION_MANIFEST` (owner + evidence paths; existing pattern
is the `cli/src/utils/openrouter-models/*.ts` owners), and the gateway's catalog
drifts from the shared `OpenRouterModel` type. Both grounded in the contract
modules before the FID's GREEN plan was written.

## RED (before any source change)

Named failures against the unmodified tree: common **4 fail** (registry/contract
pins + audit), cli **3 fail + module-missing import**, sdk **2 fail** — the
free-mode routing leg captured `POST https://ai-gateway.vercel.sh/v1/chat/completions`
with `Bearer vercel-test-key` and the stripped wire id `alibaba/qwen-3-14b`.

## GREEN (implementation)

| File | Change |
|---|---|
| `common/src/providers/registry-partitioned-2.ts` (new) | `vercel` entry — kind gateway, `AI_GATEWAY_API_KEY` + `/provider vercel` missingKeyMessage, base `https://ai-gateway.vercel.sh/v1`, `protocol: 'openai'`, `idTransform: 'strip'`, keyless live catalog `/v1/models`, `setupAvailable: true`, `domain: 'vercel.com'`, `order: 4` |
| `common/src/providers/registry.ts` | import + spread of `PROVIDER_REGISTRY_PARTITION_2` (order preserved) |
| `common/src/providers/provider-exception-manifest.ts` | `vercel` `live-catalog` entry (owner + evidence paths) |
| `cli/src/utils/openrouter-models/vercel.ts` (new) | `parseVercelCatalog` maps the field drift (`context_window`/`max_tokens`, numeric `created` → stringified) + generic live-catalog fetcher wiring |
| `cli/src/utils/openrouter-models/gateway.ts` | merge wiring (fetch, cache fallback, combined spread, reset); in-pass doc-header repair (stale OpenCode Go/Zen names removed, Atria + Vercel added) |
| generated + hand-maintained docs | `.env.example`, `cli/release/README.md` table (via `generate:provider-docs`); needles in README.md, README.zh-CN.md, `cli/release/README.md` dotenv, `docs/{index,sdk-overview,installation,features}.md` |
| tests | new `openrouter-models-vercel.test.ts` (5) + `provider-setup-vercel.test.ts` (two-way credential legs, split at the 300-line ceiling per the FID-2026-0914-001 precedent); widened pins in `provider-contract-pins`/`provider-registry`/`provider-audit`; two sdk free-mode legs (key-missing error, one-prefix routing round-trip) |

Uniform single `vercel/` prefix on every upstream id — the orcarouter precedent
(`strip` removes exactly one segment; no passthrough branch).

## AUDIT

| Gate | Result |
|---|---|
| Touched suites | 65/0 (common, 476 expects), 27/0 (cli), 10/0 (sdk) |
| `bun run test` | 12/12 workspaces, 0 fail |
| `bun run typecheck` | exit 0 |
| `bun x eslint . --max-warnings 0` | exit 0 |
| `prettier --check` / `lint:md` | clean |
| `quality:report` | PASS (1498 baselined) |
| `validate:repository` | PASS (after the Task 88 register line named the active FID — `scope.unregistered-item` fired first, by design) |
| `generate:provider-docs:check` | "Provider reference docs are up to date." |
| Receipt | **13/13 gates PASS**, `sha256:8e60648f…`, `2026-09-27T16:07:49Z` |

Law 4 call-graph: production merge `gateway.ts:167,:236`; registry loop
`sdk/src/impl/model-provider.ts:18,:86`; the sdk leg drove the chain live
(captured request above).

## Closure ceremony

Status `created→analyzed→converged→verified→closed` with Resolution filled;
record moved to `dev/fids/archive/`; receipt re-stamped LIVE at the archived
path; CHANGELOG subsection, archive-README closure section, `dev/fids/README.md`
queue ledger, and SCOPE Task 88 (all items `[x]`, evidence inline) written;
LEARNINGS entry added (archived runbook = claim, not contract).

## Honest notes

- Keyed live inference is **not** claimed — no `AI_GATEWAY_API_KEY` existed in
  this session. The boundary (keyless catalog 200 / keyless chat 401) and the
  keyed request shape were proven via the sdk routing leg; a keyed live smoke is
  the operator's call.
- Large files (`CHANGELOG.md` 10k+ lines, `SCOPE.md` 116k chars) were read and
  edited windowed at their edit regions due to the per-file read cap.
- G2 withheld: nothing committed; commit execution stays with the operator.
