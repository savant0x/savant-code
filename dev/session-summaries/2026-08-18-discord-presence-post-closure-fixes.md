# Session Summary — Discord Rich Presence post-closure fixes + client id rotation (FID-2026-0818-009)

**Date:** 2026-08-18
**Status:** Closed — operator-confirmed live, no commit/push/release

## Scope

After FID-009 (Discord Rich Presence) and the Auto Drive program were already
closed + archived, the operator reported four post-closure issues in the live
presence surface. All were fixed, re-verified, and recorded as revision notes
on the archived FID-009 and in CHANGELOG.

## Findings fixed

1. **Model-vs-mode mislabel** — the `details` line rendered `Model: <mode>`
   (e.g. `Model: HYBRID`) because `buildStoreSnapshot` fed `store.agentMode`
   (the execution MODE) into the `model` field. Fixed: `model` resolves the
   actual LLM model via `resolveActiveModel()`; the mode became a distinct
   axis surfaced as the `small_image` overlay.
2. **Stuck-state** — the `state` line stayed frozen on "Awaiting Operator
   Input" because it read only `store.fsmPhase` (which stays `idle` during
   HYBRID work). Fixed: `resolveStateLine` synthesizes the live activity
   (thinking / tool / subagent / researching) when the phase is idle, so the
   presence tracks the agent in real time.
3. **Layout + model label** — Discord exposes exactly two single-line text
   fields (no newlines), so the final mapping is `details` = project basename
   + model (line 1, both short) and `state` = live phase/activity (line 2);
   the mode lives on the `small_image` hover tooltip. `sanitizeModel` now
   trims the provider prefix, strips the `:free`/`:beta`/`:online`/`:extended`
   tier suffix anywhere it appears, and maps `openrouter/free` → "OpenRouter
   Free".
4. **Client id rotation** — `SAVANT_DISCORD_CLIENT_ID` rotated
   `1478095645662380042` → `1539431002089328710` (operator-owned Discord
   application change). The Law-4 reachability guard
   (`client-id-reachability.test.ts`) and the `presence-command.test.ts` pin
   were re-pinned to the new id.

## Verification

- Presence suites: 34 pass / 0 fail (`presence.test.ts`, `client-id-reachability.test.ts`, `presence-command.test.ts`).
- cli typecheck clean; ESLint `--max-warnings 0`; markdownlint 0; Prettier clean; `validate:repository` PASS.
- `dev/quality-baseline.json` ratchet re-baselined for the three grown presence modules.
- **Live-confirmed by the operator 2026-08-18:** presence connects and renders
  correctly under the new application ("Savant Code"); nothing further outstanding.

## Boundaries

Working-tree closure only. No commit, push, release, publication, or
deployment was performed. FID-009 was already `closed` + archived; these fixes
are recorded as post-closure revision notes on the FID and in CHANGELOG rather
than reopening the FID.
