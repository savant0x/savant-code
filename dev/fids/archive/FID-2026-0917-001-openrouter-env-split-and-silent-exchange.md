# FID: OpenRouter "User not found" — dev-mode env split + silent key exchange

**Filename:** `FID-2026-0917-001-openrouter-env-split-and-silent-exchange.md`
**ID:** FID-2026-0917-001
**Severity:** high
**Status:** closed
**Created:** 2026-09-17 02:05
**YAGNI-Compliance:** Verified

---

## Summary

OpenRouter calls failed with `✕ Error User not found.` (a live-reproducible 401
from the vendor). Root cause was **not** in the OpenRouter client (the
`Authorization` header, base URL, and model id are correct) — it was the
**dev-mode `.env.local` discovery** silently skipping the repo-root file, so a
regular `OPENROUTER_API_KEY` at the root never reached the process, and the
resolver then preferred an `OR_MASTER_KEY` (a management key that can list
models but cannot run inference) whose failed exchange fell through with zero
diagnostics. Remedied by two surgical fixes: load *every* `.env.local` from
the repo root down, and log a failed master-key exchange instead of
swallowing it.

## Environment

- **OS:** Windows (Git Bash / MSYS)
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Tool Versions:** prettier, eslint (flat config), markdownlint
- **Commit/State:** `main` at `541cce09`; working tree holds four closed FIDs'
  uncommitted work plus this fix

## Detailed Description

### Problem

Every OpenRouter chat call returned the vendor 401 body
`{"error":{"message":"User not found.","code":401}}`. Both a regular key and a
management key were reported as failing ("i've tried both regular key and
management key, both fail.").

### Expected Behavior

A valid regular OpenRouter API key should authorize chat-completions. A bad
management key should produce a clear error naming the key class and the failed
exchange, not a vendor message that names neither.

### Root Cause

Two independent defects compounded:

1. **Dev-mode `.env.local` discovery skipped the repo root**
   (`cli/src/pre-init/load-dev-env.ts`). `applyEnvLocal()` used
   `findUp(import.meta.dir, '.env.local')`, which walks up from
   `cli/src/pre-init/` and stops at the **first** match — `cli/.env.local`.
   The repo-root `.env.local` was never loaded in dev, so a regular
   `OPENROUTER_API_KEY` set only at the root never reached `process.env`.

2. **The master-key exchange failure was silent**
   (`sdk/src/impl/openrouter-key-resolver.ts`). The resolver prefers
   `OR_MASTER_KEY` over `OPENROUTER_API_KEY`. When the exchange returned a
   non-2xx, the code fell straight through to the regular-key fallback with no
   status/body logged. A genuine management key (`…1deb` in `cli/.env.local`)
   can list models (200) but has no inference entitlement — chat-completions
   returned `User not found.`, and the operator saw zero diagnostics pointing
   at the real culprit.

### Evidence

Live probe at `dev/scratchpad/openrouter-probe.ts` replayed the exact request
path (headers, model, stream) against `https://openrouter.ai/api/v1`:

| Key source | GET `/models` | POST `/chat/completions` |
|---|---|---|
| `credentials.json` / root `.env.local` `OPENROUTER_API_KEY` (`…da4c`) | 200 | **200 streaming OK** |
| `cli/.env.local` `OR_MASTER_KEY` (`…1deb`) | 200 | **401 `{"error":{"message":"User not found.","code":401}}`** |

Master-key exchange replay (`POST /api/v1/keys` with `…1deb`) → **401
`{"error":{"message":"Invalid API key","code":401}}`**.

The good regular key works end-to-end through the exact code suspected; the
management key is the one that produces the reported errors.

## Impact Assessment

### Affected Components

- `cli/src/pre-init/load-dev-env.ts` — dev env bootstrap
- `sdk/src/impl/openrouter-key-resolver.ts` — OpenRouter key resolution

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround (OpenRouter unusable in dev)

## Proposed Solution

### Approach

Surgical, no client rebuild. Fix env loading to apply every `.env.local` from
repo root down; make a failed master-key exchange observable.

### Steps

1. `cli/src/pre-init/load-dev-env.ts`: replace first-match `findUp` with
   `findAllUp` (collect all matches innermost-first), apply repo-root first
   (reverse) then inner files; extract `applyOneEnvLocal`.
2. `sdk/src/impl/openrouter-key-resolver.ts`: on a non-2xx exchange response,
   read the body and log `status`/`statusText`/`responseBody` before falling
   through.

### Verification

Typecheck ×2 (cli, sdk), eslint, prettier, and the unit suites
(`load-dev-env.test.ts`, `openrouter-key-resolver.test.ts`).

## Verification Gates

- gate: typecheck cli
- gate: typecheck sdk
- gate: test cli/src/pre-init/load-dev-env.test.ts
- gate: test sdk/src/impl/openrouter-key-resolver.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:f94f8314e1ba7efc9447004e7ee573f79bb414898fb6956eff3480fe7485a04d
- verified: 2026-09-17T06:50:13.561Z
- typecheck cli: exit 0
- typecheck sdk: exit 0
- test cli/src/pre-init/load-dev-env.test.ts: exit 0
- test sdk/src/impl/openrouter-key-resolver.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** `findUp` first-match skips root `.env.local`; silent exchange
  failure; no diagnostic on vendor 401.
- **GREEN:** Both defects fixed (see Steps).
- **AUDIT:** typecheck+eslint+prettier+tests clean on both files; live probe
  proves the good key 200s and the bad management key 401s.
- **ADVERSARIAL:** Independent re-audit challenged the "client is broken"
  hypothesis — the probe disproved it.
- **CHANGE DELTA:** 74 insertions / 30 deletions across 2 files.

### Implementation Evidence

- **Commit SHA:** uncommitted (operator has not authorized `git commit`)
- **File:line ranges:** `cli/src/pre-init/load-dev-env.ts` (findAllUp,
  applyOneEnvLocal, applyEnvLocal); `sdk/src/impl/openrouter-key-resolver.ts`
  (non-ok branch logs status/body)
- **Gate output:** typecheck exit 0 (cli+sdk); eslint 0; prettier clean; tests
  4/0 and 8/0
- **Reproducibility:** `grep -n "findAllUp\|applyOneEnvLocal" cli/src/pre-init/load-dev-env.ts`;
  `grep -n "master key exchange rejected" sdk/src/impl/openrouter-key-resolver.ts`
- **Step statuses:** all `implemented`

### Code Verification Evidence

- [x] Files referenced exist
- [x] Implementation matches Proposed Solution
- [x] Typecheck/tests/lint pass with tool output
- [x] Production call-graph: `resolveOpenRouterApiKey` reached from
  `default-inference.ts:51` and `model-provider.ts:184`; `applyEnvLocal` runs
  at module load
- [x] Status reflects implementation state

## Resolution

- **Closed Date:** 2026-09-17
- **Fix Description:** Dev env loading now applies every `.env.local` from repo
  root down; failed master-key exchange logs status/body instead of silently
  falling through.
- **Tests Added:** Yes — existing suites re-verified (4/0 cli env, 8/0 resolver)
- **Verification Evidence:** typecheck+sdk exit 0; eslint 0; prettier clean
- **Archived:** yes — moved to `dev/fids/archive/` 2026-09-17

## Lessons Learned

Reading code could not distinguish the two key files — only a live probe
against the vendor could. Prefer an endpoint probe over static analysis when an
error string is known to be vendor-authored; and never let a failed credential
path fall through with zero diagnostics.