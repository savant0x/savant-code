# Session — 2026-10-01 — T107 connector tool surface (FID-2026-0930-003 implementation)

## What this session was

Session-3 execution of the connector-layer program: implement the converged
FID-2026-0930-003 — expose the connectors catalog as agent-runtime tools —
and repair the two cross-workspace import mechanisms the implementation
surfaced. The session started from an interrupted in-flight tree (the
registration surfaces had landed but the root typecheck was red) and ended
with the FID `verified`, receipt-stamped (7/7 gates live), every declared
gate green, and the closure ceremony staged behind the operator's git
authorization (G2).

## Delivered

1. **De-alias of the vendored `@shared/*` imports (Loop-2 decision 1).**
   The root typecheck failed with 49 errors at the agent-runtime leg:
   `@shared/core` is a connectors-PRIVATE tsconfig alias
   (`packages/connectors/tsconfig.json` only), and a consumer workspace
   compiling connectors source through the workspace symlink's exports map
   cannot resolve it (TS2307 → cascading TS7006/TS18046). All 54 files
   carrying live `@shared/*` specifiers (49 × `@shared/core`,
   2 × `@shared/compiler`, 1 × `@shared/testing`, plus
   `scripts/build-catalog.ts` found later) were converted to
   intra-package relative imports by hand, per depth group; the alias
   mappings were removed from the connectors tsconfig so any future
   `@shared/*` import fails loudly. Substitution ledgered in
   PORT-NOTES.md. Prose mentions of `@shared/*` (historical upstream
   names) were deliberately left.
2. **`src/index.ts` barrel (Loop-2 decision 2).** `package.json` declared
   `"." → ./src/index.ts` but the file did not exist (a dangling export
   declaration). The barrel re-exports the runtime entry; compiler and
   testing stay explicit subpaths (a root import cannot drag the
   `typescript` package into a runtime consumer). PORT-NOTES row updated.
3. **The four meta-tools, verified end-to-end.** Registration surfaces
   (union `constants.ts:95`, params `list.ts:119`, client schema
   `list.ts:212-226`, safety `safety-registry-orchestration.ts:181-202`,
   handler record `handlers/list.ts:86-89`, SDK honest-error branch
   `tool-call.ts:249-266`) — all pre-existing from the interrupted tree,
   all now gate-covered. Handlers are DI-shaped (`BundleProvider`),
   credentials resolve through the engine env seam only (names across the
   tool boundary; the `connector_credentials` output pins
   `aliasEnvVar` too), and `connector_invoke` is the sole
   network/prompt entry.
4. **Three FID-declared gate suites + the SDK honest-error pin:**
   `common/src/tools/__tests__/connector-tool-params.test.ts` (8),
   `packages/connectors/src/__tests__/catalog-tools-surface.test.ts` (17),
   `packages/agent-runtime/src/__tests__/connector-handlers.test.ts` (10),
   `sdk/src/__tests__/connector-tool-call.test.ts` (2). All offline.
   Behavior discoveries pinned en route: the tool-facing `executeEndpoint`
   resolves credentials through the REAL env seam even in replay (the
   suite supplies and restores `TINYFISH_CREDENTIALS_API_KEY`); the
   runtime replay refuses replay-mode invokes without a fixture source;
   the agent-runtime handler ships NO replay loader (honest answer —
   hosts register one).
5. **SDK leg repair (Loop-2 decision 3).** After the de-alias the chain
   failed at the sdk leg with 281 × TS5097: `sdk/tsconfig.json` path-maps
   `@savant-code/agent-runtime/*` to source, so the SDK program
   transitively compiles connectors — whose Deno-style `.ts` extensions
   the SDK config forbade. Fix at the consumer, following the SDK's own
   posture: `allowImportingTsExtensions: true` in `sdk/tsconfig.json`
   (noEmit typecheck) and `sdk/tsconfig.build.json`
   (`emitDeclarationOnly`), plus `@savant-code/connectors` in the d.ts
   generator's `importedLibraries` beside agent-runtime. 452 extension
   strips rejected as the "too repetitive by hand" signal the protocol
   says to stop at.
6. **Lint closure.** The de-alias reclassified `@shared/core` from the
   eslint `internal` group to `parent`, re-triggering `import/order`
   across 42 files (92 warnings). Resolved with `eslint --fix` (T106
   practice: fixer + hand-verified output — spot-checked files show pure
   reordering) and one config completion: the tooling `no-console: off`
   override extended to `packages/*/scripts/**` (the override list
   predates the 13th workspace; `packages/connectors/scripts/build-catalog.ts`
   is exactly the "dedicated CLI script" class its rationale names).
   `packages/*/src` stays governed.
7. **Gates, full battery (final tree, 2026-10-01).** Root typecheck chain
   (14 legs incl. connectors) 0 errors; root `bun run test` 0 fail (13
   suites; sdk 600 tests incl. the new pin); `quality: PASS (1498
   baselined files)`; eslint `--max-warnings 0` exit 0; `lint:md` exit 0;
   `validate:repository` PASS. `bun run build:catalog` regenerates the
   committed artifact (3 providers, 9 endpoints).
8. **FID closure evidence.** Loop 2 + Loop-2-continuation entries (RED/
   GREEN/CHANGE-DELTA for all three decisions), Implementation Evidence
   filled (file:line citations, gate outputs, reproducibility recipe, step
   statuses — all six steps `implemented`, none deferred, none dropped),
   Code Verification Evidence re-grounded, YAGNI resolved (4-tool family
   covers the 9-endpoint catalog at fixed size), status → `verified`,
   receipt stamped (`fid:verify --write`: 7/7 gates exit 0),
   `validate:repository` PASS post-stamp.

## Frictions worth remembering

- `write_file` dropped its `instructions` param again (agenda pattern;
  recurred this session) — retry with it present.
- Relative-import depth: anchor on the file's EXISTING relative imports
  first (the template is already in the file); recomputing depth produced
  a whole pass of off-by-one specifiers that typecheck caught.
- De-alias sweeps must grep BOTH import forms — `from '@shared/x'` and
  `import('@shared/x')`; one dynamic import in a test body survived the
  `from`-based pass.
- The quality gate caps `__tests__` files at 300 lines too (mine landed at
  312 → 299 after compaction). Test files are not exempt.
- `eslint --fix` on THIS change set was clean (pure import reordering),
  unlike the T106 mangled-import incident — but the post-fix verification
  pass stays mandatory either way.
- Removing the connectors tsconfig `paths` turned the build script's
  forgotten `@shared/core` import into a loud failure — the right
  failure mode; census scripts limited to `src/` miss `scripts/`.

## State at end of session

- Working tree: T107 implementation + FID (`verified`, receipt stamped) +
  this summary. All gates green on exactly this tree. NOT committed.
- `dev/fids/` active set: only FID-2026-0930-003.
- Next: closure ceremony awaits operator git authorization (G2):
  1. feat commit of the implementation + verified FID + summary
     (`feat(tools): expose the connectors catalog as agent-runtime tools
     (FID-2026-0930-003)`; the repo's commit-msg guard rejects
     agent-attribution trailers — commit without them, per the guard);
  2. fill the commit SHA in Implementation Evidence + status → `closed` +
     `- **Archived:**` line (fingerprint drift at closure is by design);
  3. move to `dev/fids/archive/`; CHANGELOG unreleased entry citing the
     SHA; SCOPE.md T107 checked off (completed items leave the register);
  4. docs commit (`docs(fids): close and archive FID-2026-0930-003 ...`),
     mirroring the 9816bbdf/831f33aa pattern.
