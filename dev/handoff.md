# Session Handoff — 2026-09-17

This file is a continuation cue, not a crash dump. If you are re-opening this
work in a different CLI tool, read this first, then the session summary it
points at.

## Where things stand

- Branch `main`, **ahead of `origin/main` by 6** (not pushed — the operator
  authorized local commits only; ask before pushing).
- **Working tree is clean of source changes.** Only harness bookkeeping is
  dirty: `dev/agenda.md`, `dev/experiences/raw-traces.jsonl`, and untracked
  `dev/wiki/` — all auto-maintained, not hand-edited.
- **Active FID queue is empty** (`dev/fids/` holds only `README.md`).
- Session summary with the full evidence ledger:
  `dev/session-summaries/2026-09-16-2330-compaction-signal-pin-and-fold.md`

## What this session did

1. **Committed the prior session's five closed FIDs** as six atomic,
   path-scoped commits after the operator authorized local commits:
   ```text
   6323ce23 docs(records): changelog, ledger, summaries for FID chain
   b1b54fdc fix(sdk): OpenRouter 401 env split + exchange logs (FID-2026-0917-001)
   7c3cc577 fix(cli): compaction signal unpins + folds excerpt (FID-2026-0916-008)
   a25f07b5 fix(learnings): restructure + retire fixes (FID-2026-0916-007)
   9bd97159 fix(pruner): summary contamination guards (FID-2026-0916-006)
   d30c3249 docs(fids): close + archive atria gateway provider (FID-2026-0916-005)
   ```
   Each FID is independently revertible; `CHANGELOG.md` rode with the records
   commit so code commits stay clean.
2. **Gate failures found and fixed pre-commit**: `import/order` + an unused
   `messages` array in the new contamination pin suite, and prettier on 3
   files. Re-verified: typecheck ×3 clean, eslint 0/0, prettier clean,
   markdownlint clean, 195 tests pass/0 fail.
3. **Independent audit**: the Adversary re-audited all five FIDs' claimed
   implementations against code at file:line (Law 4 reachability confirmed)
   and returned **COMMITTABLE**. It confirmed the test-file edit dropped no
   coverage (the array was dead code) and flagged one immaterial citation
   drift (FID-008 cites `sidebar-actions.ts:203-205`; actual `:194-197`).
4. **OpenRouter 401 — follow-up, resolved live.** The operator reported the
   "User not found" 401 persisting after the FID-2026-0917-001 commit. Root
   cause was **not** the code (the FID fix is verified working): a stale
   `OPENROUTER_API_KEY` in the Windows user environment shadowed the working
   file key, and the long-running CLI process had loaded env **before** the
   operator pasted a fresh `OR_MASTER_KEY`. Added an `OR_MASTER_KEY`
   placeholder to root `.env.local`; operator pasted the real key.

## OpenRouter verification (the freshest work — RESOLVED)

Proven end to end through a probe that faithfully replicates the real CLI
boot (`--cwd=. --no-env-file` disables Bun's dotenv auto-loader, so
`load-dev-env.ts` must do all the work — `BEFORE = <none>` confirms it):

```text
BEFORE load-dev-env  OR_MASTER_KEY = <none>
AFTER  load-dev-env  OR_MASTER_KEY = sk-or-v1-7af...c895   ← root value
resolveOpenRouterApiKey() -> sk-or-v1-a84...9b56           ← exchange happened
resolved-key => HTTP 200 | {"object":"chat.completion",…}   ← no 401 anywhere
```

The full causal chain, each link evidenced:

| Claim | Evidence |
|---|---|
| FID-0017-001 env fix is live and correct | loader applied root first, skipped `cli/.env.local` (existing wins) |
| The pasted key is a genuine management key | `POST /api/v1/keys` → 201, minted a fresh regular key |
| Inference now works | resolved key → `POST /chat/completions` → 200, real completion |
| The earlier failures were stale snapshots | `cd ~ && bun -e` still showed the old `…1deb` — inherited from the running process, not any file |

**Diagnostic probes** live in `dev/scratchpad/` (gitignored, ephemeral):
`or-prodpath-probe.ts` (the faithful one), `or-exchange-probe.ts`,
`or-resolver-probe.ts`, `or-keysource-probe.ts`, `or-master-slot-probe.ts`,
`or-exchange-probe.ts`. Safe to delete; recreatable from this handoff.

## Pending after handoff

1. **Push when authorized** — 6 local commits on `main`, unpushed. The
   operator has not authorized `git push`; ask first.
2. **Optional Windows env hygiene** — the stale `OPENROUTER_API_KEY`
   (`…85db`, dead) in `HKCU\Environment` is now harmless (the exchange path
   takes precedence and never falls through to it), but can be cleared:
   `reg delete "HKCU\Environment" /v OPENROUTER_API_KEY /f`, then reopen the
   terminal.
3. **Live TUI confirmation of FID-008's fold** — verified mechanically
   (13/0 static render, both fold states) but never exercised live in the
   TUI. Worth a `/compact` confirmation before the next release push.
4. **Resume the A-Z release audit** (prior session) — 12-gate clean signal
   stands; severity-ranked findings table was interrupted. `v0.0.31` tag
   already exists on `origin` — verify what it points at before any push.

## Recurring tool pain (dev/agenda.md)

Two patterns are above the FID-promotion threshold:

- `str_replace` returning "tool result contains an error" — 12 recurrences
- `code_search` ripgrep ENOENT — 6 recurrences

## Pointers

- Session summary:
  `dev/session-summaries/2026-09-16-2330-compaction-signal-pin-and-fold.md`
- Governing protocol: `ECHO.md` (v0.2.0)
- Scope register: `SCOPE.md`
- FID ledger: `dev/fids/README.md` (all rows closed/archived; queue empty)