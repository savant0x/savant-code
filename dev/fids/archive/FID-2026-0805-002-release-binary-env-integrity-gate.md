<!-- markdownlint-disable MD013 -->

# FID: Release-Binary Env-Integrity Gate — dev NEXT_PUBLIC_* values must never ship in env.json

**Filename:** `FID-2026-0805-002-release-binary-env-integrity-gate.md`
**ID:** FID-2026-0805-002
**Severity:** high
**Status:** closed
**Created:** 2026-08-05
**Author:** Savant

---

## Summary

`cli/scripts/build-binary.ts` builds the standalone Savant Code binary and ships a sibling
`env.json` carrying the runtime environment. The merge step copies **every**
`NEXT_PUBLIC_*` variable from the build shell's `process.env` over the canonical prod
defaults, so a dirty build shell or the repo `.env.local` silently ships dev values
(`http://localhost:3000`, a personal support email, dummy PostHog/Stripe keys) inside what
looks like a release artifact — the exact leak class that shipped a personal email in an
earlier local rebuild. This FID adds a deterministic **env-integrity gate**: the build
**fails** (exit 1, no artifacts written) when any dev `NEXT_PUBLIC_*` value would leak into
`env.json`, with two explicit escape hatches — `SAVANT_CODE_BUILD_ENV=<env>` (intentional
local dev binary, warning labeled `(dev build)`) and
`SAVANT_CODE_ALLOW_NEXT_PUBLIC_OVERRIDES=1` (CI injecting real prod keys, labeled
`(explicit override)`) — both documented in `cli/release/README.md`. The gate is a pure
exported decision function (`evaluateBinaryEnvIntegrity` → block / accepted-with-warning /
clean, with `findBinaryEnvLeaks` got/expected reporting) under an `import.meta.main` guard
so it is unit-testable without running the multi-minute compile.

## Environment

- **OS:** Windows 11 / win32 (release CI: ubuntu/macos/windows runners)
- **Language/Runtime:** TypeScript, Bun 1.3.14 (pinned in `.bun-version` and `cli/package.json` engines)
- **Tool Versions:** TypeScript 5.5.4, zod v4, OpenTUI 0.2.2
- **Commit/State:** `main` @ `b24ce38` (`release: v0.0.20` — the commit that introduced the gate); working tree at filing `bac0d53`

## Detailed Description

### Problem

`build-binary.ts` assembles `binaryEnv` by starting from `CANONICAL_NEXT_PUBLIC_DEFAULTS`
and then overlaying **every** `NEXT_PUBLIC_*` entry found in `process.env`:

```text
cli/scripts/build-binary.ts (as introduced, pre-gate)
  const binaryEnv: Record<string, string> = {
    NODE_ENV: 'production',
    ...
    ...CANONICAL_NEXT_PUBLIC_DEFAULTS,
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('NEXT_PUBLIC_') && value !== undefined) {
      binaryEnv[key] = value
    }
  }
  // env.json written at the end, no integrity check
```

A developer's shell (or the repo `.env.local`) routinely exports dev values:
`NEXT_PUBLIC_SAVANT_CODE_APP_URL=http://localhost:3000`,
`NEXT_PUBLIC_SUPPORT_EMAIL=<personal email>`, `phc_dummy`/`pk_dummy` placeholders. Before
this FID, a release build from such a shell **silently shipped those dev values** in
`env.json` next to the binary — observed in an earlier local rebuild that shipped
`localhost:3000` + a personal email. There was no failure mode; the leak was invisible
until someone inspected the artifact.

### Expected Behavior

- A **release build** (no escape hatch set) that would produce any dev `NEXT_PUBLIC_*`
  value in `env.json` **aborts with exit 1** before any artifact is written, listing every
  leaked key with got/expected values.
- **Escape hatches are explicit and labeled:** `SAVANT_CODE_BUILD_ENV=<env>` permits an
  intentional local dev build (warning `(dev build)`); `SAVANT_CODE_ALLOW_NEXT_PUBLIC_OVERRIDES=1`
  permits CI-injected real prod keys (warning `(explicit override)`). Neither is silent.
- `NEXT_PUBLIC_CB_ENVIRONMENT` can never reach `env.json` as a dev value even from a dirty
  shell (force-set to `prod` for release builds).
- The gate logic is a pure, exported, unit-testable decision function; CI documents the
  canonical env explicitly; `cli/release/README.md` covers the gate + both hatches.

### Root Cause

The build script trusted the ambient environment: it merged `process.env` over canonical
defaults and wrote `env.json` with zero validation. Because the CLI reads the sibling
`env.json` at startup (`cli/src/pre-init/load-dev-env.ts`) and workspace packages are
pre-built to minified dist, the `--define`-flag mechanism used elsewhere is not a reliable
substitute — the env file is the actual runtime source of truth, so the env file itself
needs the gate.

### Evidence

```text
cli/scripts/build-binary.ts:47-59
  // FID-2026-0805-002: canonical NEXT_PUBLIC_* defaults for release binaries.
  export const CANONICAL_NEXT_PUBLIC_DEFAULTS: Record<string, string> = {
    NEXT_PUBLIC_CB_ENVIRONMENT: 'prod',
    NEXT_PUBLIC_SAVANT_CODE_APP_URL: 'https://savant-code.com',
    NEXT_PUBLIC_WEB_PORT: '3000',
    NEXT_PUBLIC_SUPPORT_EMAIL: 'support@savant-code.com',
    NEXT_PUBLIC_POSTHOG_API_KEY: 'phc_release_placeholder',
    NEXT_PUBLIC_POSTHOG_HOST_URL: 'https://us.i.posthog.com',
    NEXT_PUBLIC_GRAVITY_PIXEL_ID: '00000000-0000-0000-0000-000000000000',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_release_placeholder',
    NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL: 'https://savant-code.com/portal',
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID: 'release_placeholder',
  }

cli/scripts/build-binary.ts:94-125  evaluateBinaryEnvIntegrity(binaryEnv, canonicalDefaults, {devBuild, allowOverrides})
cli/scripts/build-binary.ts:130-166 findBinaryEnvLeaks(binaryEnv, canonicalDefaults)
cli/scripts/build-binary.ts:~262-268  process.env.NEXT_PUBLIC_CB_ENVIRONMENT = buildEnv ?? 'prod'  (force-set BEFORE the overlay)
cli/scripts/build-binary.ts:~326-345  gate: if (integrity.block) throw — aborts with all leaks listed, before writeFileSync(envJsonPath)
cli/scripts/build-binary.ts:~349-355  if (integrity.warning) logAlways — labeled dev-build / explicit-override notice
cli/scripts/build-binary.ts:~360-364  if (import.meta.main) { main().catch(...) }  — module importable for tests
cli/src/__tests__/unit/build-binary-env.test.ts  11 tests / 50 expects (clean env, dev-leak detection, missing key,
  unexpected key, non-NEXT_PUBLIC ignored, empty env, both escape hatches + label precedence)
cli/release/README.md:158-159  "SAVANT_CODE_BUILD_ENV=<env> — build a local dev binary (skips the integrity check)."
  "SAVANT_CODE_ALLOW_NEXT_PUBLIC_OVERRIDES=1 — CI/release override when injecting real production keys ..."
.github/workflows/build-release-binaries.yml:119+  Build-binary step sets the canonical prod NEXT_PUBLIC_* env explicitly

CHANGELOG.md (v0.0.20) — FID-2026-0805-002 entry: "completed and verified end-to-end"
dev/LEARNINGS.md — "Session 2026-08-05: Release-Binary Env-Integrity Gate + E2E Proof (FID-2026-0805-002)"

End-to-end proof (both escape-hatch paths, against the real build):
  (1) dirty shell with dev NEXT_PUBLIC_* → release build aborted exit 1, all 7 leaked keys listed
      (NEXT_PUBLIC_SUPPORT_EMAIL → the personal email); shipped savant-code.exe / env.json stayed byte-identical
      (gate fires before any artifact is written)
  (2) SAVANT_CODE_BUILD_ENV=dev → exit 0, "⚠️ 8 NEXT_PUBLIC_* override(s) accepted (dev build)"
      (incl. CB_ENVIRONMENT=dev); dev binary booted ("Using environment: dev", --version → 0.0.19);
      pristine release artifacts restored byte-identical afterward
```

## Impact Assessment

### Affected Components

- `cli/scripts/build-binary.ts` — `CANONICAL_NEXT_PUBLIC_DEFAULTS`, `evaluateBinaryEnvIntegrity`, `findBinaryEnvLeaks`, force-set of `NEXT_PUBLIC_CB_ENVIRONMENT`, gate + labeled warnings, `import.meta.main` guard
- `cli/src/__tests__/unit/build-binary-env.test.ts` (new) — 11 unit tests pinning the gate contract
- `cli/bin/env.json` — the released sibling artifact the gate protects
- `cli/release/README.md` — "Building release binaries" section: gate + both escape hatches + clean-shell guidance
- `.github/workflows/build-release-binaries.yml` — CI Build-binary step now sets the canonical prod env explicitly
- `dev/LEARNINGS.md`, `CHANGELOG.md` — session lesson + release entry (this FID documents the missing paper trail)

### Risk Level

- [x] High: Major feature broken, no workaround — the leak class shipped a personal email + localhost URL in a release artifact; the gate closes the failure mode (no silent dev-value shipping)
- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Make the release env a first-class, validated artifact. Define the canonical prod defaults
once, overlay the ambient env, then run a **pure decision function** that compares the final
env against canonical: block if dev values would ship (with no escape hatch), warn (labeled)
if an explicit escape hatch accepted them. Ship the pure functions exported + guarded by
`import.meta.main` so the 11-test suite pins the contract without ever running the
multi-minute compile.

### Steps

1. **`CANONICAL_NEXT_PUBLIC_DEFAULTS`** — 10-key exported map of prod values (env, URLs, support email, release placeholders).
2. **`findBinaryEnvLeaks(binaryEnv, canonicalDefaults)`** — pure detector: dev-differing values, unexpected `NEXT_PUBLIC_*` keys (expected `<none>`), missing canonical keys (`<unset>`); non-`NEXT_PUBLIC_` keys ignored.
3. **`evaluateBinaryEnvIntegrity(binaryEnv, canonicalDefaults, {devBuild, allowOverrides})`** — pure decision: leaks + no hatch → `block: true`; leaks + hatch → `block: false`, labeled `warning`, `reason: 'dev-build' | 'override'`; clean → `block: false`, no warning. `dev-build` wins the label when both are set.
4. **Force-set `NEXT_PUBLIC_CB_ENVIRONMENT = buildEnv ?? 'prod'`** before the overlay loop — a shell `CB_ENVIRONMENT=dev` can never reach `env.json` (primary guard for that one var; the detector covers the other nine).
5. **Wire the gate in `main()`** — after env assembly, `if (integrity.block) throw` with all leaks `got/expected` (aborts before `writeFileSync(envJsonPath)`); `if (integrity.warning) logAlways`.
6. **`import.meta.main` guard** — module importable for tests; build only runs when executed directly.
7. **CI** — Build-binary step sets the canonical prod `NEXT_PUBLIC_*` block explicitly (belt-and-braces with the gate).
8. **Docs** — `cli/release/README.md` "Building release binaries": gate behavior, both escape hatches, clean-shell guidance.

### Verification

- 11 unit tests (50 expects): clean env → zero leaks; dev-leak detection (localhost / personal email / dummy keys); entirely-absent env; single missing canonical key; unexpected extra key; non-`NEXT_PUBLIC_` ignored; release gate blocks with no hatch; `SAVANT_CODE_BUILD_ENV` skips + warns `(dev build)`; `SAVANT_CODE_ALLOW_NEXT_PUBLIC_OVERRIDES=1` accepts + warns `(explicit override)`; dev-build label precedence; clean env + hatches → no warning.
- End-to-end proof against the real build (both escape-hatch paths) — aborted dirty build leaves artifacts byte-identical; dev build boots with dev env.
- Gates: CLI typecheck exit 0, focused suite 11/11, full CLI suite 2839/0, ESLint `--max-warnings 0`, markdownlint clean.

## Perfection Loop

### Loop 1

- **RED:** Cataloged the failure class — `build-binary.ts` merged all ambient `NEXT_PUBLIC_*` into `env.json` with no validation; an earlier local rebuild shipped `localhost:3000` + a personal email; no failure mode existed; `--define` flags are unreliable for pre-built dist bundles so the env file itself is the runtime source of truth and needs the gate.
- **GREEN:** Implemented the pure gate (`evaluateBinaryEnvIntegrity` / `findBinaryEnvLeaks` + `CANONICAL_NEXT_PUBLIC_DEFAULTS`), force-set of `NEXT_PUBLIC_CB_ENVIRONMENT`, block-with-leaks-listed abort before artifact writes, two labeled escape hatches, `import.meta.main` guard, CI canonical env block, and README docs; 11 unit tests pin the contract.
- **AUDIT:** Both escape-hatch paths proven end-to-end against the real build (abort with byte-identical artifacts preserved; dev build booted with dev env, pristine artifacts restored + diffed). Gates: CLI typecheck exit 0, focused 11/11, full CLI 2839/0, ESLint 0 warnings, markdownlint clean.
- **CHANGE DELTA:** ~200 lines added to `build-binary.ts` (+ export surface + gate) + new 11-test file + README/CI/doc lines.

### Missed Questions

1. **Why was this FID never filed when the work was done?** → The implementation, tests, e2e proof, README docs, CI change, CHANGELOG entry, and LEARNINGS session entry were all completed on 2026-08-05, but no FID document was created in `dev/fids/` — the A-Z v0.0.20 audit (dev/test-prompts/az-test-v0.0.20-release.md, Tier 8) flagged the gap (0 hits for `0805-002` across `dev/fids/` and `dev/fids/archive/`). Answer: filed retroactively on the same day with full ground-truth verification against the working tree — the code is the evidence, and this document now matches it.
2. **Should the gate live in `build-binary.ts` or a separate module?** → Same file, exported + `import.meta.main`-guarded. The decision functions are consumed by the one caller in `main()`; the guard keeps them unit-testable without a separate file or a compile.
3. **Why block instead of warn for the default path?** → A warning still ships the leak. The gate's contract is that a release build must never contain dev values; `SAVANT_CODE_BUILD_ENV` exists precisely so a *deliberate* dev build is a first-class, labeled path.
4. **What about the `NEXT_PUBLIC_CB_ENVIRONMENT` key specifically?** → Force-set to `prod` *before* the overlay means a dev `CB_ENVIRONMENT` in the shell can never reach `env.json` even if the merge loop runs — it is the primary guard for that one var, and `findBinaryEnvLeaks` covers the other nine.
5. **Can CI legitimately need different values?** → Yes — real prod PostHog/Stripe keys differ from the release placeholders. That is exactly what `SAVANT_CODE_ALLOW_NEXT_PUBLIC_OVERRIDES=1` is for, and the warning text labels it `(explicit override)` so the escape is never silent.
6. **Does the gate catch keys that exist in the env but not in canonical?** → Yes — `findBinaryEnvLeaks` flags unexpected `NEXT_PUBLIC_*` keys with `expected: '<none>'`, so a new dev-only var is caught even though the canonical set defines what a clean release env looks like.

### Code Verification Evidence

- [x] Files referenced in "Affected Components" exist in the codebase (re-verified at filing: `build-binary.ts` exports + gate present at the cited lines; test file present with 11 tests)
- [x] Implementation matches the proposed solution (pure decision function + force-set + block/warn wiring + `import.meta.main` guard)
- [x] Typecheck passes: CLI typecheck exit 0 (recorded at implementation); focused suite 11/11 re-run at filing
- [x] FID status updated to reflect actual implementation state: `closed` — implemented + e2e-verified 2026-08-05, filed retroactively same day

## Resolution

- **Fixed By:** Savant
- **Fixed Date:** 2026-08-05
- **Fix Description:** Added the release-binary env-integrity gate to `cli/scripts/build-binary.ts` — canonical `NEXT_PUBLIC_*` prod defaults, a pure exported decision function (`evaluateBinaryEnvIntegrity`: block / accepted-with-warning / clean with `findBinaryEnvLeaks` got/expected reporting) that **fails the release build** when dev values would leak into the sibling `env.json`, force-set of `NEXT_PUBLIC_CB_ENVIRONMENT` before the env overlay, two documented escape hatches with labeled warnings (`SAVANT_CODE_BUILD_ENV` → `(dev build)`, `SAVANT_CODE_ALLOW_NEXT_PUBLIC_OVERRIDES=1` → `(explicit override)`), and an `import.meta.main` guard for testability. CI now sets the canonical prod env block explicitly; `cli/release/README.md` documents the gate, both hatches, and clean-shell guidance.
- **Tests Added:** Yes — 11 unit tests (50 expects) in `cli/src/__tests__/unit/build-binary-env.test.ts` + end-to-end proof of both escape-hatch paths against the real build.
- **Verified By:** e2e proof (dirty shell → abort exit 1, artifacts byte-identical; dev build → exit 0 + booted) + gate battery (CLI typecheck exit 0, focused 11/11, full CLI 2839/0, ESLint 0 warnings, markdownlint clean). Re-verified at filing: focused suite 11/11.
- **Commit/PR:** `b24ce38` (`release: v0.0.20`)
- **Archived:** 2026-08-05 — moved to `dev/fids/archive/` at filing; CHANGELOG entry already present (added with the implementation, v0.0.20)

## Lessons Learned

A build gate that writes a sibling env file must **block, not warn**, on dev-value leaks —
the merge loop copies ambient `NEXT_PUBLIC_*` values, so a dirty shell or `.env.local`
silently ships `localhost:3000` + personal emails in what looks like a release artifact.
Keep the gate logic pure and exported under an `import.meta.main` guard so the contract is
unit-testable without a multi-minute compile, prove gate behavior against the real build
(both escape-hatch paths), and make every escape hatch explicit + labeled so the escape is
never silent. Also: **the paper trail is part of the change** — an implemented, tested,
CHANGELOGed, and LEARNINGS-documented FID still left a documentation gap until the A-Z
audit caught it; FID documents should be filed at implementation time, not rediscovered by
an audit.
