# Session — 2026-09-30 — Connector layer port, session 2 (T106 strip + splits + closure)

## What this session was

Session-2 execution of the connector-layer program: finish the
FID-2026-0930-001 remainder recorded in the session-1 amendment — strip the
unused async/resource engine internals, split every file over the 300-line
ceiling, re-run all gates, stamp receipts for FID-2026-0930-001 and
FID-2026-0930-002, close and archive both FIDs. (T107 / FID-2026-0930-003 —
exposing the catalog to the agent-runtime tool executor — remains, sequenced
next.)

## Delivered

1. **Engine strip (sync-only surface).** The async/resource machinery is
   gone: `LoadedResource`, `RunnableResource`, `IResourceStore`,
   `linkResourceFns`, the lifecycle/resource op utils, bounded sleep, the
   resources window, and `relayTransport` all deleted. `LoadedEndpoint` now
   carries `estimate/accrued/start/run` (`run` = alias of `start`).
   Deliberate behavior change, ledgered in `PORT-NOTES.md`: async endpoint
   DOCS fail closed at LOAD with a new `ASYNC_UNSUPPORTED` code
   (`engine/errors.ts:30`, raised in `engine/link.ts:124`) instead of
   failing open mid-run; `NOT_ASYNC`/`RESOURCE_OP_FAILED` removed;
   `RETRIABLE` = `EXECUTION_FAILED` only. Firecrawl async endpoints deleted
   (`agent/`, `crawl/`, `batch-scrape/`); the sync `-status` GET endpoints
   remain.
2. **300-line ceiling met repo-wide** — the blocker that kept receipts
   unstamped. `compile.ts` 1459 → 12 modules; `engine.ts` 1231 → 211 +
   `settle.ts` 156 + `resolve.ts` 84; `link.ts` 828 → 235; `fn-utils.ts` →
   255; `transport.ts` → 215; `testing/fixtures.ts` → barrel + 3 modules;
   `categories.ts` 368 → facade 29 + core 216 + extended 151;
   `lifecycle.ts` → 187 + `lifecycle-data.ts` 194; firecrawl
   `schema/common.ts` 458 → 4 files; search `endpoint.ts` 363 → 4 files.
   Split fn bodies verbatim; extracted estimate/evidence fns gained explicit
   type annotations (lost contextual typing) — behavior re-verified by the
   replay + determinism suites. `quality: PASS (1498 baselined files)`.
3. **Lint closure.** 107 warnings → 0 (`--max-warnings 0` exit 0). Notable:
   eslint `--fix` mangled one import block (`compile-endpoint-bindings.ts`)
   — repaired by hand into a single merged `@shared/core` import; a missing
   `EnvelopeData` type import restored in `usage-fns.ts`. Lesson: splitting
   type-only imports from value imports re-triggers `import/no-duplicates`;
   lint belongs inside the split step, not after the batch.
4. **Gates, full battery.** Workspace: `tsc --noEmit` 0; `bun test src/`
   10/10 offline; eslint 0 warnings. Repo: `bun run typecheck` 13 legs +
   scripts leg 0 errors; `bun run test` 13 suites 0 fail (sdk 599, cli
   3746, common 723, agents 145, evals 171, agent-runtime 1551,
   design-systems 19, code-map 51, database 18, knowledge-graph 50,
   llm-providers 89, connectors 10, desktop 421); `lint:md`;
   `quality:report`; `scope-register-check`; `validate:repository`. (Bare
   root `bun test` sweeps ~106 environmental failures in vendored/desktop
   files — the gate is the chained `bun run test`, matching repo
   convention.)
5. **Commit (operator-authorized).** The commit-SHA closure field required
   a commit; operator chose "Commit first, then continue."
   `9816bbdf` — 192 files, +15,248/−19. Note: the repo's commit-msg guard
   rejects agent-attribution trailers (`Co-Authored-By: Codebuff`,
   "Generated with …") — committed without them per the guard's instruction.
6. **Receipts + closure.** FID-001 and FID-002 flipped to `verified`,
   Implementation Evidence filled (real SHAs, file:line cites, gate
   outputs, reproducibility greps, step statuses — nothing blocked,
   nothing deferred), `fid:verify --write` stamped both (FID-001: 5 gates;
   FID-002: 3 gates — 8/8 exit 0), `validate:repository` PASS post-stamp,
   then status → `closed`, moved to `dev/fids/archive/`, CHANGELOG
   unreleased entry added, SCOPE.md T104/T105/T106 checked off, AGENTS.md
   workspace count 12 → 13 (FID-002 edit set).

## Order-of-operations that made this legal

- All document edits (evidence, Resolution, Lessons) BEFORE
  `fid:verify --write` — the receipt fingerprint hashes everything except
  the receipt section, so any post-stamp edit invalidates it.
- `validate:repository` AFTER stamping (it live-reruns fixed/verified
  gates); the `closed` flip + archive move after validation (closed records
  are outside the contract by design; fingerprint drift at closure is
  expected and documented).
- Gates run on the exact tree that was committed (no edits between battery
  and commit).

## Frictions worth remembering

- `eslint --fix` can rewrite import blocks badly on Windows/CRLF; verify
  every auto-fixed file before re-running the gate.
- `write_file` intermittently dropped its `instructions` param (session-1
  note, recurred here once); retry with it present.
- The repo has no scripted-edit allowance for authored logic — all strip
  edits were read-then-edit; python heredocs only for verbatim mechanical
  splits, documented in file headers.

## State at end of session

- `main` @ `9816bbdf`; working tree carries only the closure docs
  (archived FIDs, CHANGELOG, SCOPE.md, this summary).
- `dev/fids/` active set: `FID-2026-0930-003-expose-connectors-agent-runtime-tools.md`
  (T107, converged, ready to implement).
- Next: implement T107 — the four meta-tools
  (`connector_search`/`connector_describe`/`connector_invoke`/
  `connector_credentials`), consuming the checked-in compiled bundle (never
  the `typescript`-importing compiler), credentials via the env seam
  (names-only), honest-error branches mirroring
  `sdk/src/run/tool-call.ts:281-295`.
