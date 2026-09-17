# FID: OpenRouter key shadowed by Bun dotenv auto-loader in dev boot

**Filename:** `FID-2026-0917-003-openrouter-key-shadow-bun-dotenv.md`
**ID:** FID-2026-0917-003
**Severity:** critical
**Status:** verified
**Created:** 2026-09-17 19:20
**YAGNI-Compliance:** Verified

---

## Summary

Every OpenRouter call in local dev failed with `User not found.` (vendor 401)
because Bun's built-in dotenv auto-loader is **not** disabled by the `--cwd ..`
flag in the dev script, contrary to the comment in
`cli/src/pre-init/load-dev-env.ts:5-6`. With `cwd=cli/`, Bun pre-seeds
`process.env.OR_MASTER_KEY` from the **stale** `cli/.env.local` value before
`load-dev-env.ts` ever runs. Because `applyOneEnvLocal` skips any key already
in `process.env` ("existing wins"), the **good** repo-root `.env.local` value
is silently skipped forever. The resolver then exchanges a dead master key,
falls back to a dead regular key, and the vendor returns `User not found.`

## Environment

- **OS:** Windows 11 (win32), Git Bash / MSYS
- **Language/Runtime:** Bun 1.3.14 (pinned)
- **Tool Versions:** bun 1.3.14; TypeScript strict monorepo
- **Commit/State:** `main`, ahead of `origin/main` by 12; working tree clean of source

## Detailed Description

### Problem

The operator reports `✕ Error User not found.` on every OpenRouter inference
in local dev, persisting across the FID-2026-0917-001 fix (which corrected the
env-load ordering and added exchange logging) and across the SDK rebuild.

### Expected Behavior

`bun run --cwd=cli dev` should resolve `OR_MASTER_KEY` from the repo-root
`.env.local` (the value the operator pasted), exchange it for a live regular
key, and complete inference with HTTP 200.

### Root Cause

Two independent defects compose into a total shadow:

1. **`load-dev-env.ts:5-6` comment is factually false.** It claims "`bun dev`
   runs with `--cwd ..`, which disables Bun's dotenv auto-loader." `--cwd ..`
   does not disable the auto-loader. `cli/package.json:17` runs
   `bun run src/index.tsx --cwd ..` — the `--cwd ..` is passed as **script
   argv**, not consumed by Bun as a runtime flag. The process `cwd` stays
   `cli/`, so Bun auto-loads `cli/.env.local` at startup.
2. **`applyOneEnvLocal` "existing wins" makes the pre-seed permanent.** Bun
   seeds `OR_MASTER_KEY` from the stale `cli/.env.local` value
   (`sk-or-v1-2dd8917…`). `load-dev-env.ts` then applies root-first, but
   `if (!key || process.env[key]) continue` skips the good root value
   (`sk-or-v1-7af3559…`) because the slot is already occupied.

The resolver prefers `OR_MASTER_KEY` → exchanges the dead key → vendor 401
`Invalid API key` → falls back to the dead `OPENROUTER_API_KEY`
(`sk-or-v1-e14…85db`) → chat completions 401 `User not found.`

A third, lesser defect: `cli/.env.local` holds a **divergent duplicate**
`OR_MASTER_KEY` — a stale master key that is no longer valid — creating two
sources of truth for one secret.

### Evidence

Bidirectional probe — identical command, only the boot flag differs:

```text
WITHOUT --no-env-file (current behavior):
  BEFORE load-dev-env  OR_MASTER_KEY = sk-or-v1-2dd...1deb   ← stale cli value
  AFTER  load-dev-env  OR_MASTER_KEY = sk-or-v1-2dd...1deb   ← root value skipped
  exchange POST /api/v1/keys → 401 "Invalid API key"
  resolveOpenRouterApiKey() -> sk-or-v1-e14...85db            ← dead fallback
  chat POST /chat/completions → HTTP 401 "User not found."    ← OPERATOR'S ERROR

WITH --no-env-file (fix):
  BEFORE load-dev-env  OR_MASTER_KEY = <none>
  AFTER  load-dev-env  OR_MASTER_KEY = sk-or-v1-7af...c895    ← root value lands
  resolveOpenRouterApiKey() -> sk-or-v1-37a...537c            ← fresh exchange
  chat POST /chat/completions → HTTP 200 {"object":"chat.completion",…}
```

Clean-env isolation proving Bun (not the OS) supplies the stale value:

```text
$ env -i PATH=… HOME=… USERPROFILE=… bun -e '…OR_MASTER_KEY…'   (cwd=cli)
OR_MASTER_KEY=sk-or-v1-2dd8917     ← Bun auto-loaded cli/.env.local
OPENROUTER_API_KEY=NONE

$ env -i … bun --no-env-file -e '…OR_MASTER_KEY…'               (cwd=cli)
OR_MASTER_KEY=NONE                 ← auto-loader disabled

$ env -i … bun -e '…OR_MASTER_KEY…'                             (cwd=repo root)
OR_MASTER_KEY=sk-or-v1-7af3559    ← cwd=root loads the good file
```

`--cwd ..` as script argv (not a runtime flag):

```text
$ bun run ../dev/scratchpad/or-prodpath-probe.ts --cwd ..       (launched from cli/)
cwd = C:\Users\spenc\dev\savant-code\cli                         ← unchanged
```

On-disk key divergence (prefixes only; full values never printed, Law 12):

```text
root .env.local   OR_MASTER_KEY = sk-or-v1-7af3559…   ← valid
cli/.env.local    OR_MASTER_KEY = sk-or-v1-2dd8917…   ← STALE, divergent
cli/.env.local    OPENROUTER_API_KEY = (unset)
shell env         OPENROUTER_API_KEY = sk-or-v1-e14…85db ← dead fallback
```

## Impact Assessment

### Affected Components

- `cli/package.json` — dev script boot flags
- `cli/src/pre-init/load-dev-env.ts` — env-load ordering + false comment
- `cli/.env.local` — stale duplicate secret
- `sdk/src/impl/openrouter-key-resolver.ts` — downstream consumer (no change needed)

### Risk Level

- [x] Critical: a core feature (all local-dev inference via OpenRouter) is
      completely broken with no workaround that survives a process restart.

## Proposed Solution

### Approach

Make `load-dev-env.ts` the sole deterministic env loader in dev, exactly as
its own header already assumes, by disabling Bun's racing auto-loader. Then
remove the stale duplicate so there is one source of truth for the master key.

### Steps

1. Add `--no-env-file` to the CLI-entry invocation in the `cli` dev script so
   Bun's auto-loader does not pre-seed env before `load-dev-env.ts` runs.
2. Correct the false comment at `load-dev-env.ts:5-6` to describe the real
   mechanism (`--no-env-file`), replacing the wrong `--cwd ..` claim.
3. Delete the divergent stale `OR_MASTER_KEY` line from `cli/.env.local`,
   leaving the repo-root `.env.local` as the single source of truth.
4. Re-probe end to end from the real boot path; confirm HTTP 200.

### Verification

1. Clean-env probe from `cwd=cli/` with the real dev boot: resolves the root
   master key, exchanges, and completes a live chat with HTTP 200.
2. `bun run typecheck` for `cli` workspace.
3. `bun x eslint` + `bun x prettier --check` on changed source files.
4. Repo-wide `bun run lint:md`.

## Verification Gates

- gate: typecheck cli
- gate: probe dev/scratchpad/or-prodpath-probe.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:45850de02494a91cbe962239e7508a06e23646989c3be53004e669a0eb32b4cd
- verified: 2026-09-17T23:36:20.080Z
- typecheck cli: exit 0
- probe dev/scratchpad/or-prodpath-probe.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Root cause isolated with bidirectional evidence: Bun auto-loader
  not disabled + "existing wins" makes the stale pre-seed permanent; stale
  duplicate key in `cli/.env.local`.
- **GREEN:** `--no-env-file` added to dev boot; comment corrected; stale
  duplicate removed.
- **AUDIT:** Probes + typecheck + lint.
- **ADVERSARIAL:** Challenge whether the `loadBinaryEnvIfPresent` release
  path is also affected (it is not — release binaries load `env.json` and
  never touch `.env.local`; see Missed Questions).
- **CHANGE DELTA:** n/a (single pass, FID authored from complete evidence)

### Missed Questions

1. **Is the release binary path affected?** No. `load-dev-env.ts` runs
   `loadBinaryEnvIfPresent()` first; a release binary reads its sibling
   `env.json`, returns `true`, and `applyEnvLocal()` never runs. The bug is
   local-dev only.
2. **Why not delete `cli/.env.local` entirely?** It holds other dev values
   (6013 bytes). Only the divergent duplicate `OR_MASTER_KEY` is harmful;
   surgical removal preserves the rest and matches the minimal-change law.
3. **Could `OPENROUTER_API_KEY` in the shell env still shadow the resolver?**
   After the fix the master-key exchange succeeds, so Path 1 returns before
   any Path 2 fallback is consulted. The dead shell value becomes unreachable
   in the OpenRouter flow.
4. **Is `--cwd ..` itself now dead weight in the dev script?** It is passed
   as script argv and does not change cwd. It is left untouched to avoid
   scope creep; `--no-env-file` is the minimal correct fix.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** pending local commit (changes are in the working tree,
      not yet staged; this FID is written before the commit lands)
- [x] **File:line ranges:**
      - `cli/package.json:17` — dev script now
        `bun run prebuild:agents && bun --no-env-file run src/index.tsx --cwd ..`
      - `cli/src/pre-init/load-dev-env.ts:2-8` — corrected comment block
      - `cli/.env.local` — stale `OR_MASTER_KEY` line replaced with an
        explanatory comment referencing this FID
- [x] **Gate output:** pasted in `Verification` below (probe HTTP 200,
      typecheck exit 0, eslint 0, prettier clean, markdownlint exit 0)
- [x] **Reproducibility:** `grep -n 'no-env-file' cli/package.json` and
      `grep -c '^OR_MASTER_KEY=' cli/.env.local` (returns 0) both confirm
      the change is present in the working tree. Independently audited by the
      Verifier agent: all substantive items PASS, both NEEDS-REVIEW flags
      closed (zero non-`.local` `.env` files exist repo-wide per glob, so
      `--no-env-file` drops no keys; the "staged" wording is corrected here)
- [x] **Step statuses:**
      1. implemented — `--no-env-file` added
      2. implemented — comment corrected
      3. implemented — stale key removed
      4. implemented — probe returns HTTP 200

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence is present — the dev script is the
      entry point `bun run --cwd=cli dev` invokes; the probe exercises the
      real `load-dev-env` import and the real `resolveOpenRouterApiKey()`
- [x] FID status reflects the actual implementation state

## Resolution

- **Closed Date:** (set when closure is independently verified)
- **Fix Description:** `--no-env-file` added to the `cli` dev script so
      `load-dev-env.ts` is the sole env loader; the false `--cwd ..` comment
      corrected; the stale divergent `OR_MASTER_KEY` removed from
      `cli/.env.local`.
- **Tests Added:** No — verified by an end-to-end probe against the live vendor
- **Verification Evidence:**
  ```text
  probe (with --no-env-file):  AFTER = sk-or-v1-7af...c895 → HTTP 200
  probe (without, real boot):  AFTER = sk-or-v1-7af...c895 → HTTP 200
  typecheck cli: exit 0 | eslint: 0 | prettier: clean | lint:md: exit 0
  ```
- **Archived:** (set when moved to `dev/fids/archive/`)

## Lessons Learned

A comment that documents an *assumption about a tool's behavior* is a load-
bearing claim. Here the false "`--cwd ..` disables Bun's dotenv auto-loader"
note is what made FID-2026-0917-001's correct ordering fix *appear* sufficient
while the real culprit ran before it. The tell was structural, not subtle:
whenever two loaders race for one env slot and the loser is the one you
control, "existing wins" guarantees you lose. The general lesson: **verify
that a disabled path is actually disabled** — a probe that prints the value
*before* your loader runs is the only proof that you are the first writer.