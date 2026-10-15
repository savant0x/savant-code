# FID: Spawned-Process Env Starvation (env.ts lacks the .env.local bootstrap leg)

**Filename:** `FID-2026-0906-007-spawned-process-env-bootstrap.md`
**ID:** FID-2026-0906-007
**Severity:** high
**Status:** closed
**Created:** 2026-09-06
**YAGNI-Compliance:** Verified
**Related:** FID-2026-0906-005 (the verification leg that exposed victim 2),
SCOPE `[OPEN-OUT-OF-SCOPE]` desktop sidecar E2E item (this FID discharges
it), the pre-push-hook env-prefix workaround (three session pushes)

---

## Summary

`common/src/env.ts` throws at module import when the `NEXT_PUBLIC_*` client
env keys are absent — and its bootstrap only handles the release-binary
`env.json` leg, not the local-dev `.env.local` leg. The CLI compensates with
its own pre-init loader (`cli/src/pre-init/load-dev-env.ts`); every other
spawned or sub-package entrypoint has no compensation. One missing leg,
three concrete victims: (1) the pre-push hook's `evals:smoke` gate fails on
every unattended push (three session pushes needed a manual env prefix);
(2) the desktop sidecar E2E suite fails 2/4 with 20–32s "never printed the
ready line" spawn timeouts (passes in 5.8s with the prefix); (3) the class
survives invisibly because desktop is absent from the root `test` chain
(11 workspaces — typecheck in, tests out). Fix: give `env.ts` the missing
bootstrap leg (findUp `.env.local`, existing-env-wins, exact
`load-dev-env.ts` semantics), and add desktop to the root test chain.

## Environment

- **OS:** Windows 11 host (win32, Git Bash); Bun 1.3.14-pinned
- **Commit/State:** local `5d27e7e` (ahead of origin 3, no push — automation
  level 3)
- **Evidence:** live probes 2026-09-06 (quoted below, all reproducible)

## Detailed Description

### Problem

`common/src/env.ts:71-75` throws `Invalid environment configuration` at
import time when the client env schema cannot parse. Its only bootstrap is
`loadBinaryEnvIfPresent()` (release `env.json` sibling). Local dev and test
contexts that do not import through the CLI's pre-init chain get nothing:
Bun's auto-dotenv is disabled once a script runs with `--cwd` (documented in
`load-dev-env.ts:5-9`), and `.env.local` is never loaded for children.

### Victims (all tool-evidenced)

1. **Pre-push gate (every unattended push).** `.githooks/pre-push:88-95`
   runs `bun run evals:smoke` → root `package.json:30` (`bun run --cwd=evals
   …`) → `evals/v2/src/cli.ts:4` imports `@savant-code/sdk` →
   `common/src/env.ts` throws. Live probe 2026-09-06: bare
   `bun run evals:smoke` from the repo root exits 1 with
   `Invalid environment configuration` — the exact hook context. Workaround
   used three times this session: push commands exported
   `NEXT_PUBLIC_CB_ENVIRONMENT/SAVANT_CODE_APP_URL/WEB_PORT` by hand.
2. **Desktop sidecar E2E (false failures + 23× slowdown).**
   `desktop/scripts/sidecar-e2e.integration.test.ts` spawns the real
   sidecar, which imports the same chain. Without env: 2/4 fail ("sidecar
   never printed the ready line", 20.4s + 32.1s spawn timeouts) — in
   isolation too, so not load flake. With the 3-key prefix: 4/4 pass in
   5.78s. The spawned sidecar dies before its ready line, so the harness
   reads a 23× runtime penalty as test failures.
3. **Gate coverage gap (why the class survived).** Root `package.json:56`
   `test` chains 11 workspaces; desktop is absent (its typecheck is in the
   `type_check` chain, its tests in no gate). The sidecar failure class
   never surfaced in any standard battery — it was found only because the
   T17-A verification leg ran `desktop bun test scripts/ src/` by hand.

### Expected Behavior

- Any entrypoint that imports `@savant-code/common` — root scripts, spawned
  sidecars, evals — finds and loads the repo-root `.env.local` when present,
  with the CLI's documented precedence (shell env > binary env.json >
  `.env.local`).
- The pre-push hook's smoke gate passes bare; unattended pushes need no
  env prefix.
- The desktop suite runs in the standard root battery (with its skip guard
  keeping it inert where the native sidecar binary is absent).

### Root Cause

`env.ts` grew the binary-env leg (FID-2026-0811-011 era) but never the
`.env.local` leg; the CLI solved it locally in `pre-init` instead of at the
convergence point, so every later consumer re-met the failure class.

### Evidence

- `common/src/env.ts:17-39` (`loadBinaryEnvIfPresent` — void, no
  `.env.local` leg), `:71-75` (throw at parse failure), `:42-47` (dev
  defaults are conditional — they cannot cover the 3 non-defaultable keys).
- `cli/src/pre-init/load-dev-env.ts:5-9` (the `--cwd` disables Bun's
  dotenv auto-loader — the documented mechanism), `:76-79` +
  `:88-96` (findUp + existing-env-wins parser — the precedent to mirror,
  Law 11).
- Live probes 2026-09-06: bare `bun run evals:smoke` → exit 1 (quoted
  above); bare sidecar suite → 2 fail/20-32s; prefixed sidecar suite →
  4 pass/5.78s; root `test` chain grep → 11 workspaces, no desktop.
- `.env.local` carries exactly the 3 keys dev defaults cannot cover
  (`NEXT_PUBLIC_CB_ENVIRONMENT`, `NEXT_PUBLIC_SAVANT_CODE_APP_URL`,
  `NEXT_PUBLIC_WEB_PORT`) — non-secret localhost values (grep, names only).

## Impact Assessment

### Affected Components

- `common/src/env-bootstrap.ts` (new, ~70 lines) — findUp + parser,
  testable helpers, mirroring `load-dev-env.ts`
- `common/src/env.ts` — bootstrap call before the schema parse; the inline
  `loadBinaryEnvIfPresent` gains a boolean return so the CLI's exact
  binary-XOR-dotenv precedence holds
- `package.json` (root) — `test` chain gains `--cwd=desktop test`
- `common/src/__tests__/env-bootstrap.test.ts` (new) — RED pins
- Consumers unchanged: `cli/src/pre-init/load-dev-env.ts` stays (binary
  path + idempotent double-load; removing it would touch the CLI release
  surface for zero benefit — YAGNI)

### Risk Level

- [ ] Critical
- [x] High: Major feature broken, no workaround — unattended pushes
      fail their governance gate; a whole workspace's suite is outside
      every standard gate
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Fix at the convergence point (`env.ts`), mirror the CLI precedent exactly,
and close the gate gap by adding desktop to the root chain.

### Steps

1. [x] **RED:** `common/src/__tests__/env-bootstrap.test.ts` —
       (a) parser pins on a temp fixture: comments, `export ` prefix,
       quotes, existing-env-wins; (b) findUp finds a root fixture from a
       nested start dir; (c) the class pin: a spawned
       `bun -e "import('…/common/src/env.ts')"` with a scrubbed env must
       succeed when a fixture `.env.local` is findable (fails today).
2. [x] **GREEN:** `env-bootstrap.ts` (`findUpEnvLocal`,
       `applyEnvLocalInto`, exported for tests) mirroring
       `load-dev-env.ts:73-121`; `env.ts` — `loadBinaryEnvIfPresent`
       returns boolean, `if (!loadBinaryEnvIfPresent()) applyEnvLocalInto()`
       before `rawEnv` assembly.
3. [x] **VERIFY (live, bare):** `bun run evals:smoke` from the repo root
       with NO env prefix → exit 0 (the hook context); bare
       `bun test scripts/sidecar-e2e.integration.test.ts` in desktop →
       4 pass (no 20-32s timeouts).
4. [x] **GREEN (gate gap):** root `test` script gains
       `bun run --cwd=desktop test` (last in the chain).
5. [x] **AUDIT:** root typecheck chain; root `test` chain (now 12) bare;
       eslint/prettier/lint:md; quality ratchet; the FID-2026-0905-002
       receipt re-check (its gate battery must stay green after the env.ts
       change).
6. [x] Records: SCOPE OOS item closed pointing here; LEARNINGS entry;
       CHANGELOG; archive at closure.

## Verification

- Unit: the new suite's parser/findUp/class pins.
- Live (the actual acceptance): bare smoke exit 0 + bare sidecar suite
  4/0 — both run in exactly the contexts that failed.
- Battery: root typecheck + 12-workspace test chain + gates below.

## Verification Gates

- gate: test common/src/__tests__/env-bootstrap.test.ts
- gate: typecheck common
- gate: test desktop/scripts/sidecar-e2e.integration.test.ts
- gate: test scripts/public-release-desktop.test.ts

### Verification Receipt

- fingerprint: sha256:9f76ac0c07fe76cff4f28f7dd3da6df68c2c112d4310bf9b3b288dd78a2c561f
- verified: 2026-09-06T23:50:54.136Z
- test common/src/__tests__/env-bootstrap.test.ts: exit 0
- typecheck common: exit 0
- test desktop/scripts/sidecar-e2e.integration.test.ts: exit 0
- test scripts/public-release-desktop.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** three victims cataloged with live probes (above); root cause
  pinned to the missing `.env.local` leg in `env.ts`'s bootstrap, not to
  any single harness (the CLI's pre-init proves the parser design already
  exists and works).
- **GREEN:** converge on fix-at-convergence-point + gate-gap closure.
- **AUDIT (tool-evidenced):**
  - V1 PASS — the import chain is exactly
    `evals/v2/src/cli.ts:4` → `@savant-code/sdk` → `common/src/env.ts`
    (grep quoted); the hook invokes the same script bare
    (`.githooks/pre-push:88-95`).
  - V2 PASS — `load-dev-env.ts` semantics to mirror: findUp ≤20 levels
    (`:41-53`), comment/`export `/quote handling + existing-env-wins
    (`:88-121`), binary-XOR-dotenv precedence (`:113-115`).
  - V3 FAIL → corrected: the first draft also planned removing
    `cli/src/pre-init/load-dev-env.ts` as "now redundant." Rejected: it
    owns the release-binary `env.json` leg AND the direct-routing pair
    policy (`:56-74`) — deleting it changes CLI release behavior for zero
    benefit in this scope (YAGNI + blast radius). The CLI path becomes
    harmlessly idempotent (both loaders are existing-env-wins).
  - V4 PASS — precedence design: `applyEnvLocalInto` writes only keys not
    already in `process.env`, and runs only when binary env.json is
    absent → shell > env.json > .env.local, identical to the CLI's
    documented rules.
  - V5 PASS — desktop root-chain insertion is safe: the suite's skip
    guard (`sidecar-e2e…test.ts` "native sidecar binary present") keeps
    contexts without the built binary inert; with the bootstrap fixed the
    suite is bare-green (live probe).
  - V6 NOTE — `env.ts`'s inline `loadBinaryEnvIfPresent` returns void; it
    gains `return true/false` (2-line change) so the XOR branch is
    expressible without restructuring the module.
- **ADVERSARIAL:** "Just document the env prefix for pushes" → that is
  the workaround that already failed three times in one session (any
  unattended/automation push bypasses it); the hook is a hard gate and
  must be self-sufficient. "Load .env.local unconditionally in every
  workspace's test setup instead" → N setups drift; the failure class
  lives at one import point, so the fix belongs there (Law 13). "Adding
  desktop to root `test` slows every push" → measured: +~7s bare after
  the fix (420 tests / 7.06s), against eliminating a 20-32s-per-spawn
  silent failure class and a whole-workspace gate hole.
- **CHANGE DELTA:** initial authoring (~30% — V3 rejection folded).

### Missed Questions

1. *Does loading `.env.local` in CI/release contexts weaken anything?* →
   No: the loader runs only when binary env.json is absent (never true in
   release), writes nothing over existing shell env, and CI runners have
   no repo `.env.local` (gitignored). Protected-context detection
   (`env-boundary.ts`) governs dev defaults — unchanged, orthogonal.
2. *Why not fix the hook instead (load .env.local in pre-push)?* → The
   hook is one of N victims; fixing it leaves the sidecar spawn and every
   future spawned consumer broken. The convergence point is `env.ts`.
3. *Double-load for the CLI (pre-init + env.ts)?* → Idempotent:
   both are existing-env-wins; second pass writes nothing.
4. *Should the sidecar suite also get an explicit env assertion?* → Its
   failure mode becomes structurally impossible after the fix (the
   bootstrap runs inside the spawned process itself); adding a second
   seam would pin the workaround, not the cause. The suite staying in
   the root chain is the guard.
5. *Does the smoke gate need its own env schema change?* → No: the 3
   non-defaultable keys already live in `.env.local`; nothing about the
   schema changes.

## Code Verification Evidence

- [x] Files referenced in Affected Components exist and were read 0-EOF
      (`env.ts`, `load-dev-env.ts`, `env-boundary.ts`, root `package.json`,
      `.githooks/pre-push`, the sidecar test)
- [x] Live probes quoted (bare smoke exit 1; bare sidecar 2 fail; prefixed
      4 pass/5.78s; root chain 11 workspaces)
- [x] Implementation matches the Proposed Solution (V3 rejection recorded)
- [x] FID status reflects actual state (`analyzed` — converged; code not
      yet written)

### Loop 2 — Independent audit and self-correction

- **RED:** the class pin (spawned import succeeding with a fixture) is
  the regression guard: it fails today and would fail again if the
  bootstrap leg were ever removed.
- **GREEN:** Steps 2/4; implementation must keep `env.ts` under the
  300-line ratchet (currently 99 lines — ample headroom; the new module
  carries the ~70-line bulk, Law 13).
- **AUDIT:** double audit = static (typecheck/lint) + the live bare
  probes (smoke + sidecar suite) — the same contexts that failed, now
  passing, plus the standard battery.
- **ADVERSARIAL:** "Could the bootstrap mask a genuinely misconfigured
  production env by silently supplying localhost?" → Binary env.json
  contexts never reach the loader; CI has no `.env.local`; a local shell
  that exports explicit keys wins over the file. The only new behavior is
  local dev/test finding the same file the CLI already found.
- **CHANGE DELTA:** <2%.

### Loop 3 — Final convergence

- **RED:** none in-document; live acceptance is Step 3's bare probes.
- **GREEN:** none.
- **AUDIT:** gates declared (paths verified to exist); receipt stamps at
  implementation.
- **ADVERSARIAL:** STANDS.
- **CHANGE DELTA:** <2% (converged — circuit breaker).

### Loop 4 — Implementation audit (post-GREEN)

- **RED:** implementation surfaced two findings folded in here:
  (1) **Compiled binaries have a virtual `import.meta.dir`** — the first
  GREEN pass fixed the smoke (victim 1 bare-green immediately) but the
  sidecar E2E still failed: the spawned artifact is a Bun-compiled
  executable whose `import.meta.dir` no findUp can anchor, so the module-
  anchored pass cannot reach the repo root inside it. Correction: a
  second `applyEnvLocalInto` pass anchored at `process.cwd()` in `env.ts`
  (pure fallback — existing-env-wins fills only what pass 1 could not
  find). (2) **The fix must be embedded at compile time** — the stale
  Sep-3 binary predates the bootstrap, so the rebuilt artifact is part
  of the fix: `bun run build:sidecar -- --entry cli/src/server-command.ts
  --target bun-windows-x64` (the exact invocation the desktop workflows
  use). The rebuilt binary is gitignored build output; the source fix is
  what ships.
- **GREEN:** both corrections landed in the same pass; suite re-ran bare.
- **AUDIT:** env-bootstrap 4 pass / 0 fail (parser, findUp, no-fixture,
  spawned-import class pin); typecheck common exit 0; the live bare
  probes — `evals:smoke` from the root → "Tier-1 governance smoke passed:
  5 tasks", exit 0 (the hook context that failed three pushes); bare
  sidecar E2E → 4 pass / 0 fail in 5.94s (was 2 fail / 20-32s); whole
  desktop suite bare → 420 pass / 0 fail in 6.91s; pipeline desktop
  suite 7 pass / 0 fail (FID-2026-0905-002-era receipt surface intact).
- **ADVERSARIAL:** "the cwd pass could load the wrong repo's .env.local"
  → findUp stops at the first `.env.local` above cwd; a spawned process
  inside this repo finds this repo's file, and the existing-env-wins rule
  means an explicit shell env always outranks any file. "Bun-compile could
  inline env vars at build time and make this moot" → the binary was
  built from the SAME source tree that threw without env — compile does
  not inject the keys, which is precisely why the runtime bootstrap is
  required inside the artifact.
- **CHANGE DELTA:** ~15% (two corrections + closure bookkeeping; code
  scope otherwise unchanged from the Proposed Solution).

## Implementation Evidence (REQUIRED for `closed`)

- [x] **File:line ranges:** `common/src/env-bootstrap.ts:1-77` (new —
      `findUpEnvLocal` + `applyEnvLocalInto`, mirroring
      `cli/src/pre-init/load-dev-env.ts:41-121`); `common/src/env.ts:18`
      (import), `:20-53` (`loadBinaryEnvIfPresent` → boolean), `:55-63`
      (the two-pass bootstrap: module anchor + cwd fallback);
      `package.json:56` (root `test` chain gains `--cwd=desktop test`,
      now 12 workspaces); `common/src/__tests__/env-bootstrap.test.ts`
      (4 pins incl. the spawned-import class pin)
- [x] **Gate output:** all four declared gates exit 0 (env-bootstrap 4/0;
      typecheck common; bare sidecar E2E 4/0 in 5.94s; pipeline desktop
      suite 7/0) — receipt below
- [x] **Live acceptance (bare, no env prefix):** `bun run evals:smoke` →
      exit 0, "Tier-1 governance smoke passed: 5 tasks"; bare desktop
      suite 420 pass / 0 fail in 6.91s (23× faster than the env-starved
      run, zero false failures)
- [x] **Step statuses:** Steps 1-6 all `implemented` (evidence above);
      no step `blocked` or `deferred`
- [x] **Commit SHA:** `00ff99f3` — fix(common): env.ts gains the
      .env.local bootstrap leg; desktop joins root test chain
      (FID-2026-0906-007); local commit, no push (automation level 3)
- [x] **Archived:** moved to `dev/fids/archive/` in the closure commit

## Resolution

- **Closed Date:** 2026-09-06 (same session as implementation — this
  FID's acceptance is local verification, not the release cut)
- **Fix Description:** the missing `.env.local` bootstrap leg added at
  the convergence point (`common/src/env.ts`): binary env.json XOR
  two-pass findUp (module dir, then cwd for compiled artifacts),
  existing-env-wins throughout; desktop added to the root test chain;
  sidecar binary rebuilt so the compiled artifact embeds the fix
- **Tests Added:** Yes — `common/src/__tests__/env-bootstrap.test.ts`
  (parser semantics, findUp, no-fixture null, spawned-import class pin),
  RED-first (module-absent failure, then the class pin failing pre-fix)
- **Verification Evidence:** Loop 4 AUDIT above (bare smoke exit 0; bare
  sidecar 4/0; bare desktop 420/0; all four declared gates green)
- **Archived:** 2026-09-06 → `dev/fids/archive/`; CHANGELOG entry appended

## Lessons Learned

A convergence-point module that self-bootstraps one context (release
binaries) but not the common local context (`.env.local`) imports the
failure into every consumer that does not route through the one
compensated entrypoint — the CLI's pre-init loader hid the gap for every
CLI-routed process while the hook's smoke, spawned sidecars, and future
sub-package entrypoints starved. Two corollaries: compiled executables
need a cwd-anchored fallback (their `import.meta.dir` is virtual), and a
bootstrap fix inside compiled artifacts is only live after a rebuild —
the stale artifact proves the old failure until recompiled.
