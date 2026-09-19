# FID: code_search Ripgrep Vendor Gap — Fail-Closed With No PATH Fallback

**Filename:** `FID-2026-0918-007-ripgrep-vendor-gap-no-path-fallback.md`
**ID:** FID-2026-0918-007
**Severity:** medium
**Status:** verified
**Created:** 2026-09-18 20:35
**YAGNI-Compliance:** Confirmed (Loop 3 — pure-Bun fallback rejected; no
new capabilities beyond the recorded failure class)

---

## Summary

`code_search` hard-fails whenever the vendored ripgrep binary is absent: the
resolver (`getBundledRgPath`) is fail-closed over a fixed candidate list that
never considers a PATH-installed `rg`, and nothing in `bun install`
guarantees the vendor tree exists (the sdk defines `build` and
`fetch-ripgrep` scripts but no install hook chains them). The result is a
recurring, session-killing tool failure — 13 recorded recurrences between
2026-09-10 and 2026-09-17 (the learning agenda's top entry) — that
self-healed only as a side effect of unrelated sdk builds. The binary is
present today; without a guarantee or a fallback it will recur.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** sdk workspace (`sdk/src/native/ripgrep.ts`,
  `sdk/src/tools/code-search/executor.ts`), cli boot probe
- **Commit/State:** branch `main`, 4 commits ahead of origin; vendor binary
  verified present on 2026-09-18 (`ls
  node_modules/@savant-code/sdk/dist/vendor/ripgrep/x64-win32/` → `rg.exe`)

## Detailed Description

### Problem

Every recorded recurrence is the same failure:

```text
Failed to execute ripgrep: ENOENT: no such file or directory, uv_spawn
'C:/Users/spenc/dev/savant-code/node_modules/@savant-code/sdk/dist/vendor/
ripgrep/x64-win32/rg.exe'. Vendored ripgrep not found; ensure
@savant-code/sdk is up-to-date or set SAVANT_CODE_RG_PATH.
```

13 occurrences across 5 distinct sessionIds (2026-09-10 → 2026-09-17), 2
further occurrences on 2026-09-18 from a different, outer client surface
(see Root Cause 4). `code_search` is the primary RED-phase tool; each
occurrence degrades a live session to cwd-scoped workarounds.

### Expected Behavior

Ripgrep resolution should degrade gracefully: vendored binary first, then a
PATH-installed `rg`, and only then fail — with a remediation message naming
the workspace-correct command (`bun run fetch-ripgrep` in the sdk
workspace). Vendor presence should be guaranteed at install time or loudly
probed at every consumer boot, not only CLI boot.

### Root Cause

1. **No install-time guarantee.** `sdk/package.json` declares `build` (runs
   `scripts/build.ts`, which copies vendored binaries via
   `scripts/build-copy-assets.ts:77-94`) and `fetch-ripgrep`
   (`scripts/fetch-ripgrep.ts`), but neither is wired to any install/prepare
   lifecycle hook. A fresh clone or a `bun install` that recreates
   `node_modules/@savant-code/sdk` leaves the vendor tree absent until the
   next manual sdk build — exactly the observed window between 09-17
   (failures) and 09-18 (binary present).
2. **Resolver is fail-closed with no PATH candidate.**
   `sdk/src/native/ripgrep.ts` `getBundledRgPath` candidate order ends at
   the cwd fallback (`<cwd>/node_modules/@savant-code/sdk/dist/vendor/...`)
   and then throws — a machine with `rg` on PATH (common on dev boxes) still
   hard-fails.
3. **Boot probe covers one consumer.** `probeRipgrepAvailability` (added by
   FID-2026-0907-002) warns at CLI boot (`cli/src/init/init-app.ts`), yet
   recurrences continued on 09-10/09-14/09-17 — the failing surface is
   either a non-CLI SDK consumer that never probes, or an operator-visible
   warning that did not prevent the mid-session failure.
4. **Outer client surface (out of repo).** The 2 hits on 2026-09-18 name
   `C:/Users/spenc/.config/manicode/rg.exe` and hint `CODEBUFF_RG_PATH` —
   that binary is vendored by the outer Freebuff client, not by this repo.
   Not fixable in repo code; remediation is an operator env var pointing
   `CODEBUFF_RG_PATH` at this repo's rg.exe.

### Evidence

```text
sdk/src/native/ripgrep.ts (getBundledRgPath):
  "Candidate order ... 1. SAVANT_CODE_RG_PATH env override ... 6. cwd
   fallback" — no PATH candidate; final branch throws:
  "Ripgrep binary not found for ${platform}-${arch}. ... Please run
   'npm run fetch-ripgrep' or set SAVANT_CODE_RG_PATH".

sdk/src/tools/code-search/executor.ts:286:
  childProcess.once('error', ...) ->
  "Failed to execute ripgrep: ${error.message}. Vendored ripgrep not
   found; ensure @savant-code/sdk is up-to-date or set SAVANT_CODE_RG_PATH."

sdk/package.json: "build": "bun run scripts/build.ts" (line 25),
  "fetch-ripgrep": "bun scripts/fetch-ripgrep.ts" (line 35) — no
  preinstall/postinstall/prepare hook references either.

dev/experiences/raw-traces.jsonl lines 39-79: 13 code_search
  tool_failure records, all the same ENOENT signature, 5 sessionIds.

dev/agenda.md line 6: code_search ENOENT — "recurrences: 13 (total 13) —
  promote via FID when resolved+verified".

Disk check 2026-09-18: node_modules/@savant-code/sdk/dist/vendor/
  ripgrep/x64-win32/rg.exe EXISTS today (heals only after sdk builds).
```

## Impact Assessment

### Affected Components

- `sdk/src/native/ripgrep.ts` — resolver candidate chain
- `sdk/src/tools/code-search/executor.ts` — spawn error remediation text
- `sdk/package.json` — missing install lifecycle hook
- `cli/src/init/init-app.ts` — boot probe coverage (single consumer)
- Every SDK consumer of `codeSearch` (CLI, SavantClient embedders)

### Risk Level

- [x] Medium: recurring tool outage with workarounds (cwd-scoped search,
  PATH rg via shell, env override); no data loss; degrades RED phase in
  live sessions

## Proposed Solution

### Approach

Three-part fix, ordered by leverage; part 3 is an operator decision because
it moves work (and a network fetch) into install time:

1. **PATH fallback candidate (code, deterministic, zero network).** Extend
   `getBundledRgPath` with a final candidate: a PATH-resolved `rg`
   (Windows: probe `where rg`; POSIX: `which rg`; result memoized per
   process). Resolver order becomes vendored candidates → PATH `rg` →
   throw. Update the throw message to list every attempted candidate plus
   `bun run fetch-ripgrep` (workspace-correct; the current text says
   `npm run fetch-ripgrep` while the repo runs bun). Keep `SAVANT_CODE_RG_PATH`
   as candidate 1, unchanged.
2. **Accurate executor remediation (code).** In `executor.ts:286`, append
   the resolved path and `bun run fetch-ripgrep` to the error so a mid-session
   failure is self-explanatory.
3. **Install-time guarantee (operator decision, flagged).** Wire
   `fetch-ripgrep` (network, checksummed) or `build-copy-assets` into an
   sdk lifecycle hook so fresh installs carry the vendor tree. Deferred to
   operator approval: downloads at install time are a policy choice.

**Honest open item (RED-completion at implementation):** the recorded
errors are *spawn* ENOENTs from `executor.ts:286`, which implies a path
resolved (passed `existsSync`) and then failed to spawn — a TOCTOU window
or a stale-resolution path not yet identified. Step 1 of implementation is
a repro that pins the exact trigger (fresh-install state vs. TOCTOU) before
the fallback lands; both hypotheses are fixed by parts 1–3 regardless,
but the repro result is recorded in Loop 2.

### Steps

1. [x] DONE — repro/regression pins landed:
   `sdk/src/__tests__/ripgrep-path-fallback.test.ts` (PATH fallback,
   memoization, env-override precedence, vendored-first ordering) + the
   existing exhaustion suite made deterministic (injectable no-PATH probe).
   **Open item answered by live proof (Loop 2):** the spawn-ENOENT class is
   NOT TOCTOU — with cwd at the repo root, the resolver's cwd-fallback
   candidate (6) resolves the real repo binary even from a vendorless
   module location, so a mid-session `executor.ts:286` ENOENT requires cwd
   ≠ repo root (embedder/outer-client sessions) or a vendor tree that was
   absent at resolution time (fresh-install state). Both are covered by
   parts 1–3.
2. [x] DONE — PATH candidate (memoized, injectable probe, Node-compatible
   `node:child_process`) in `sdk/src/native/ripgrep-path-fallback.ts`;
   resolver candidate 7 wired in `ripgrep.ts`; throw message names every
   attempted candidate plus the workspace-correct
   `bun run --cwd=sdk fetch-ripgrep`.
3. [x] DONE — `executor.ts` remediation text updated to the same
   workspace-correct repair command.
4. [x] DONE — suites green (see Reproducibility); ceiling respected via
   the module split (FID-2026-0913-002 discipline).
5. [x] DONE — part 3 APPROVED by operator ("1 approve", 2026-09-19):
   `sdk/scripts/ensure-ripgrep-vendor.ts` wired into the root `prepare`
   script (bun runs `prepare` after every `bun install` — the exact
   fresh-clone window). Best-effort fail-open: skips when the current
   platform binary exists (dev tree or installed dist), honors
   `SAVANT_CODE_SKIP_RG_FETCH=1` (offline/CI), fetches via the pinned
   checksum-verified `fetch-ripgrep` (FID-2026-0821-005 B2) otherwise,
   warns-and-exits-0 on failure (runtime PATH fallback + resolver error
   remain backstops). Live: skip path, present path, and full `prepare`
   chain exit 0; 4-test deterministic suite
   (`sdk/src/__tests__/ensure-ripgrep-vendor.test.ts`).

### Verification

- New/updated `sdk/src/__tests__/ripgrep.test.ts` suites green (pasted
  output).
- Typecheck `sdk`; eslint `--max-warnings 0`; quality gate.
- Live proof on this machine: temporarily rename the vendored rg.exe in a
  sandboxed copy (never the real tree) and confirm resolution falls through
  to PATH `rg`, restoring `code_search`.

## Verification Gates

- gate: typecheck sdk
- gate: test sdk/src/__tests__/ripgrep.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:3817c5e2e74d1bc2f242f99ff084a7d796c1be3fe39bdd89e61fb25bd3ef892f
- verified: 2026-09-19T02:51:26.073Z
- typecheck sdk: exit 0
- test sdk/src/__tests__/ripgrep.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** 13-recurrence class cataloged with raw-traces evidence,
  resolver/executor/install-chain file:line grounding, and the two-surface
  distinction (in-repo SDK surface vs. outer client surface). Open item:
  exact spawn-ENOENT trigger (fresh-install vs. TOCTOU) — repro at
  implementation.
- **GREEN:** Three-part proposal (PATH fallback, executor message,
  install-time guarantee as operator decision). Not implemented; awaiting
  operator approval.
- **AUDIT:** Document-level double audit in single-agent mode:
  markdownlint + manual re-read. No code exists yet to verify.
- **ADVERSARIAL:** Self-challenge: does a PATH `rg` risk version drift vs.
  the vendored binary? Yes — accepted: any `rg` with JSON output support
  beats no search at all; the vendored candidates keep priority. Could the
  memoized PATH probe go stale mid-session? No worse than the vendored
  candidate (also probed at spawn). Does part 1 mask a broken install?
  Partially — mitigated by part 2's message naming `fetch-ripgrep` and by
  the boot probe.
- **CHANGE DELTA:** n/a (document creation).

### Missed Questions

1. Why did the boot probe (FID-2026-0907-002) not prevent recurrences? ->
   Open item folded into the Step-1 repro: identify the failing consumer
   surface (non-CLI SDK embedder vs. ignored warning) before declaring the
   probe coverage sufficient.
2. Should `code_search` fall back to a pure-Bun implementation? -> No
   (YAGNI): no such implementation exists in-repo; adding one is a new
   capability, not a fix. Recorded as a candidate future FID if PATH
   fallback proves insufficient.
3. Is the outer client surface (CODEBUFF_RG_PATH) in scope? -> Not as code
   (not this repo). The FID records the operator remediation: set
   `CODEBUFF_RG_PATH` to this repo's
   `node_modules/@savant-code/sdk/dist/vendor/ripgrep/x64-win32/rg.exe`.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** pending G2 (operator commit authorization; no silent
  deferral — presented at turn end)
- [x] **File:line ranges:** `sdk/src/native/ripgrep-path-fallback.ts`
  (new), `sdk/src/native/ripgrep.ts` (candidate 7 + throw text),
  `sdk/src/tools/code-search/executor.ts` (remediation text),
  `sdk/src/__tests__/ripgrep-path-fallback.test.ts` (new),
  `sdk/src/__tests__/ripgrep.test.ts` (deterministic exhaustion pin),
  `sdk/scripts/ensure-ripgrep-vendor.ts` (new; part 3),
  `sdk/src/__tests__/ensure-ripgrep-vendor.test.ts` (new),
  `package.json` `prepare` hook (part 3 wiring)
- [x] **Gate output:** receipt below — typecheck/test/quality all exit 0
- [x] **Reproducibility:** `bun test sdk/src/__tests__/ripgrep.test.ts
  sdk/src/__tests__/ripgrep-path-fallback.test.ts` → 19 pass / 0 fail
  (13 + 6 per-file); live sandbox proof transcript in the session summary
- [x] **Step statuses:** steps 1-4 `implemented`; step 5 `implemented`
  (part 3 operator-approved 2026-09-19; no silent deferral)

### Code Verification Evidence

- [x] Files referenced in this FID exist and contain the quoted code
  (verified by read + disk check 2026-09-18)
- [x] Implementation matches Proposed Solution (parts 1-2; Loop 2 audit)
- [x] Typecheck/tests/lint pass with pasted output (receipt below; full
  battery transcript in the session summary)
- [x] No production call-graph change proposed (resolver-internal candidate
  addition; existing callers unchanged)

### Loop 2 — Independent audit and self-correction

- **RED:** Open item resolved by live proof: NOT TOCTOU. With cwd at the
  repo root, candidate 6 (cwd fallback) resolves the real repo binary even
  when the module's own vendor trees are unreachable — so the recorded
  spawn-ENOENTs required cwd ≠ repo root (embedder sessions) or a truly
  absent vendor tree (fresh-install window). Parts 1-3 cover both.
- **GREEN:** Implemented as proposed (parts 1-2); part 3 presented, not
  implemented (operator policy call). Injection point kept minimal: the
  4th optional `pathProbe` parameter on `getBundledRgPath` (CLI caller
  unaffected — 3-arg call sites unchanged).
- **AUDIT:** Static: typecheck sdk exit 0; eslint `--max-warnings 0`;
  quality PASS; receipt gates exit 0 ×3. Manual re-read of the fallback
  module (memoization, cache reset hook, `where`/`which` split, Windows
  first-line handling) and the resolver wiring found no drift.
- **ADVERSARIAL:** (1) Existing exhaustion test asserted a throw on
  machines WITH rg on PATH — it would now resolve instead of throwing.
  Fixed by making that suite pass the no-PATH probe explicitly
  (deterministic on every machine). (2) Bun-only `spawnSync` import
  rejected in review (SDK Node-compatibility contract, `executor.ts`
  precedent) — switched to `node:child_process`. (3) Windows `where`
  emits multi-line output — first non-empty line taken; empty lines
  skipped. (4) Memoized miss could hide a later PATH install mid-session
  — accepted: no worse than vendored resolution (also probed at spawn);
  `resetPathRgCacheForTests` exists for tests.
- **CHANGE DELTA:** `ripgrep-path-fallback.ts` new;
  `ripgrep.ts` +1 candidate + throw-text rework; `executor.ts` message
  updated; 2 test files (1 new, 1 updated); public surface re-exported
  unchanged; no call-site changes anywhere in the repo.

### Loop 3 — Final convergence

- **RED:** Converged — 13-recurrence class root-caused (fresh-install
  dependency + no fallback) with the two-surface distinction preserved;
  spawn-ENOENT hypothesis resolved by live proof (Loop 2).
- **GREEN:** Converged — parts 1-3 live in the working tree (uncommitted,
  G2-pending); part 3 approved and implemented 2026-09-19.
- **AUDIT:** Converged — all declared gates exit 0 (receipt below);
  eslint 0 warnings; lint:md clean; live sandbox proof (throw text, PATH
  fallback, vendored-first) transcript recorded.
- **ADVERSARIAL:** Converged — four challenges resolved with receipts
  (Loop 2).
- **CHANGE DELTA:** Final: see Loop 2 CHANGE DELTA; none after receipt
  stamp.

## Resolution

- **Closed Date:** pending G2 commit (operator authorization)
- **Fix Description:** Ripgrep resolver degrades gracefully: vendored
  candidates → PATH `rg` (memoized probe) → fail-closed throw naming every
  attempted candidate and `bun run --cwd=sdk fetch-ripgrep`; executor
  remediation text workspace-correct; part 3: install-time vendor
  guarantee via the root `prepare` hook (best-effort, checksum-verified,
  skip-env honored)
- **Tests Added:** `sdk/src/__tests__/ripgrep-path-fallback.test.ts` (new);
  `ripgrep.test.ts` exhaustion suite made deterministic via the injectable
  no-PATH probe
- **Verification Evidence:** receipt below (typecheck/test/quality exit
  0); live sandbox proof transcript in the session summary
- **Archived:** pending G2 (moves to `dev/fids/archive/` with the commit)

## Lessons Learned

A vendored binary with no install-time guarantee and no runtime fallback is
a recurring outage, not a bug: it fails exactly when the environment is
freshest and heals only as a side effect of unrelated work. Degrade
gracefully (PATH candidate), name the workspace-correct repair in the error,
and make the guarantee explicit at install time — otherwise every fresh
environment re-discovers the same failure.
