<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Build/Release Script System A–Z Audit — Savant-Code (post-release-system FID closure)

**Version:** v0.0.21
**Scope:** the canonical release orchestrator + binary-build workflow + launcher +
pre-push gates + package dry-runs + legacy script retirement.
**FIDs under test:** FID-2026-0808-001 (public release pipeline), FID-2026-0808-002
(token-native automation), FID-2026-0808-003 (deterministic gates), FID-2026-0809-002
(binary asset verification) — all closed + archived 2026-08-09.
**Purpose:** Prove the build/release script system is sound end-to-end after the
release-system FID closure and the removal of the legacy dispatch scripts, before the
operator runs any release. Read-only except the documented writable paths.

## Ground Rules

- Run from the repository root unless a command changes directory explicitly.
- Record exact exit codes. Use `PASS`, `FAIL`, or `DEFERRED`.
- Do NOT publish, upload, push, tag, or commit. Do NOT mutate npm/GitHub.
- The ONLY writable paths are `dev/scratchpad/` and `/tmp/`.
- `bun run release:public:preview` and `bun run release:public:diagnose` are
  read-only by contract — they may be run.

## Tier 1 — Release orchestrator

### T1.1 — Preview mode (read-only contract)
`bun run release:public:preview` — exit 0, prints the full mutation plan, extracts the
current CHANGELOG section (`Changelog section ready: ## v0.0.21 — 2026-08-06`), and
lists the 5 binary assets to verify post-publish.

### T1.2 — Diagnose mode (gate manifest, read-only)
`bun run release:public:diagnose` — runs the exact canonical gate manifest
(build:sdk → typecheck → test → eslint → lint:md → prettier → npm pack dry-runs)
with file-backed redacted transcripts and an evidence-finalized receipt.

### T1.3 — Release contract test suite
`bun test scripts/public-release.test.ts` — 52 pass / 1 fail (sole failure is the
pre-existing environment-dependent `ensurePinnedBunOnPath`).

### T1.4 — Lockfile gate
`bun install --frozen-lockfile` — exit 0 (pinned Bun 1.3.14).

## Tier 2 — Binary-build workflow (CI)

### T2.1 — Workflow structure
`.github/workflows/build-release-binaries.yml`: 5-matrix targets, `fail-fast: false`,
frozen-lockfile install, pinned Bun 1.3.14, `--clobber` uploads, and the post-matrix
`verify-release-assets` job that resolves the release tag itself and asserts all 5
tarballs.

### T2.2 — Env-integrity gate
`cd cli && bun test src/__tests__/unit/build-binary-env.test.ts` — 13 pass / 0 fail.

### T2.3 — Launcher targets
`cli/release-core/launcher.js`: `PLATFORM_TARGETS` present; download base URL is
`https://github.com/savant0x/savant-code/releases/download` (correct public repo).

## Tier 3 — Package dry-runs

### T3.1 — `savant-code` (CLI launcher)
`cd cli/release && npm pack --dry-run` — name savant-code, version 0.0.21, 5 files
(index.js, launcher.js, http.js, package.json, README.md).

### T3.2 — `@savant-code/sdk`
`cd sdk && npm pack --dry-run` — name @savant-code/sdk, version 0.0.21, includes
dist/ + tree-sitter wasm.

## Tier 4 — SDK build + verify

`cd sdk && bun run build && bun run verify` — build exit 0 (ESM + CJS + d.ts);
verify exit 0 (all steps pass).

## Tier 5 — Pre-push gates

### T5.1 — Hook wiring
`.githooks/pre-push` runs the pushed-range credential scan
(`scripts/pre-push-scan.ts`) + `eslint --max-warnings 0` + `lint:md` +
`prettier --check`; wired via root `prepare` (`git config core.hooksPath .githooks`).

### T5.2 — Credential scan suite
`bun test scripts/pre-push-scan.test.ts` — pass.

## Tier 6 — Repo hygiene / legacy retirement

### T6.1 — Version alignment
`VERSION` = `0.0.21`; all 15 `package.json` files = `0.0.21`.

### T6.2 — Legacy release scripts gone
- `cli/scripts/release.ts`, `sdk/scripts/release.js`, `savant-free/cli/release.ts` — absent.
- `scripts/release.py`, `scripts/sync-agents.py` (foreign `fame0528/savant-protocol`
  helpers) — absent (removed 2026-08-09).
- No `release:cli` / `release:sdk` / `release:savant-free` chains in any manifest.
- `savant-free-private` appears only in the SPEC.md retirement note.

### T6.3 — Static gates
- `bun x eslint . --max-warnings 0` — exit 0.
- `bun run lint:md` — exit 0 (ECHO.md + dated research docs reconciled).
- `bunx prettier --check .` — exit 0 (or check changed files individually).
- Typecheck × 4: common / agents / sdk / cli / agent-runtime exit 0.

## Report Contract

Produce `dev/scratchpad/az-test-build-release-system-results.md` with a summary table
(T1–T6), per-check evidence (exact commands + exit codes), and a
GO / NO-GO / GO WITH CAVEATS verdict. The verdict rules: GO requires T1–T6 pass;
NO-GO on any release-safety failure; live GitHub/npm mutation checks are DEFERRED by
design (this audit never mutates public state).
