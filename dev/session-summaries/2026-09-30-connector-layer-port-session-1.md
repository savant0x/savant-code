# Session summary — 2026-09-30: connector layer port (session 1)

## Task

Operator-approved execution of FID-2026-0930-001 (T104) and
FID-2026-0930-002 (T105): vendor the MIT monid connector layer into a new
`packages/connectors` workspace (sync endpoints, hosted-product surfaces
stripped per the converged FIDs).

## Delivered

- **New workspace `packages/connectors`** (`@savant-code/connectors`):
  ported core (contract schemas, presets, loaders), compiler (fn
  normalization + interning + deterministic bundle), engine (sync run
  pipeline, sealed-unit loading, error taxonomy intact), testing harness
  (fixture record/replay), 3 launch connectors (tinyfish, exa, firecrawl)
  with 6 offline fixtures.
- **Port substitutions** (all logged in `packages/connectors/PORT-NOTES.md`):
  inlined contract constants replacing config.yml file IO; local
  `shared/semver.ts` replacing `@std/semver`; console-backed `Logger` seam
  replacing pino; `node:fs`/`node:path`/`node:url` replacing
  `@std/*`; `ENGINE_VERSION`/`COMPILER_VERSION` constants replacing deno.json
  reads; typed default imports replacing CJS `as any` interop dances.
- **Law 13 imports:** `sha256Hex` (common/src/util/hash.ts) and `sleep`
  (common/src/util/promise.ts) imported from their registry owners instead
  of re-declared.
- **FID-2026-0930-002 edits:** root `package.json` workspaces + both chains
  (13 legs), `scripts/validation-gates.ts` policy entry,
  `protocol.config.yaml` mirror, AGENTS.md "12→13 workspaces",
  parity probe at `scripts/__tests__/validation-manifest.parity-probe.ts`.

## Verification evidence (pasted from live runs)

- Workspace: `tsc --noEmit` exit 0 (strict + bun types); `eslint . --max-warnings 0`
  exit 0; `bun test src/` → **10 pass, 0 fail, 23 expect() calls** (offline).
- Root: `bun run typecheck` exit 0 (13 workspaces + scripts leg);
  `bun run test` exit 0 (421 pass, 0 fail); `bun run lint:md` exit 0;
  `bun scripts/scope-register-check.ts` PASS (0 issues); parity probe PASS.
- Replay proofs: tinyfish#search FREE settles `{credits:{},evidence:{}}`;
  firecrawl#scrape settles the vendor's creditsUsed meter (1 credit);
  provider 429 completes as data with zero usage; missing-url input fails
  INVALID_INPUT; double-compile is byte-identical (stableStringify equal).

## Recorded amendment (FID-2026-0930-001)

The engine ported whole rather than stripped-then-ported (compile-first
preserved greenness); the async/resource strip + the 11 over-ceiling file
splits are session-2 item **T106** (SCOPE.md, level 3), sequenced BEFORE
receipt stamping and closure — `quality` is a mandatory receipt gate, so no
`verified` status or closure occurs until T106 lands. Sequencing, not escape.

## Gate status at session end

- FID-2026-0930-001: implemented (steps 1–6 + 7 of the plan; step 7 executed
  via -002), status remains `converged` — receipt blocked on `quality` (T106).
- FID-2026-0930-002: implemented and parity-proven; receipt blocked on the
  same mandatory `quality` gate.
- No commits made (G1/G2 — operator executes or authorizes git).

## Honest notes

- `validate:repository` was NOT run this session (it live-runs declared
  gates of `fixed`/`verified` records; both FIDs remain `converged`, so the
  relevant live surface was the scope register + the declared-gate shapes).
- The launch catalog is sync-only by design; the vendored engine still
  contains the upstream async/resource code paths, unexercised by the launch
  connectors, pending T106.
- Windows `fileURLToPath` (not `.pathname`) is required for fixture paths —
  recorded as a port note for future connector authors.
