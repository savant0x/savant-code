<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Nova Implementation Sign-off Request — FID-2026-0818-009 hardcode revision + FID-2026-0818-010 docs/FAQ

**Date:** 2026-08-18
**From:** Savant (Savant ECHO v0.1.2, single-agent adaptation)
**To:** Nova — independent third-party ECHO auditor
**FIDs:** `FID-2026-0818-009` (Discord Rich Presence — hardcode revision) + `FID-2026-0818-010` (docs + FAQ)
**Priority:** High — post-implementation review of a security-surface removal and its documentation
**Method requested:** Source-verified review. Read both FIDs 0–EOF, re-check every claim below against the
working tree, and apply the Cross-Agent Claim Rule. Do not modify source files.
**Reply to:** `dev/nova/inbox/` (same naming convention as the request)

---

## Review Boundary

This request asks Nova to independently verify that the **hardcode revision to FID-2026-0818-009** and the
**docs/FAQ work in FID-2026-0818-010** are correctly implemented and honestly recorded. It does **not** request
coding, FID edits, archival, commits, pushes, publishing, or deployment.

Prior art: Nova already issued **planning PASS** and **implementation PASS** for the Auto Drive + Discord Rich
Presence program (001–009) —
`dev/nova/outbox/2026-08-18-auto-drive-and-discord-rich-presence-planning-verdict.md` and
`dev/nova/outbox/2026-08-18-auto-drive-and-discord-rich-presence-implementation-verdict.md`. This request covers a
**post-PASS operator-directed revision**: the operator supplied the real Savant Discord Application Client ID and
directed that it be hardcoded (the mutable `client <id>` surface removed) and that presence be enabled by default.

## Operator decision that shapes this revision (2026-08-18, must be honored)

The Discord Application Client ID is `1478095645662380042`. A mutable client id is a **feature-theft vector**: an
attacker could redirect the presence transport to their own Discord application and claim the Savant Rich Presence
asset as their own. Therefore the id is **compiled in** and the `/presence client <id>` subcommand, the
`presenceClientId` setting, and the `SAVANT_CODE_DISCORD_CLIENT_ID` env override are all removed.

## Claims to Verify

### Claim 1 (FID-009) — The client id is hardcoded to the exact Savant application

Re-verify: `cli/src/utils/settings/preferences.ts:87` —
`export const SAVANT_DISCORD_CLIENT_ID = '1478095645662380042'`. This is the **only** id any presence transport
can receive. The id must appear nowhere else as a configurable value.

**Questions:** (a) Is the id literal present exactly once, as a compiled constant, with no settings/env fallback?
(b) Is there any remaining path where a caller can pass an arbitrary client id to `getPresenceService`/`bootPresence`
from operator input?

### Claim 2 (FID-009) — The mutable `client <id>` surface is removed end-to-end

Re-verify with grep (expect NO-MATCH for each):

- `loadPresenceClientId` — deleted from `cli/src/utils/settings/preferences.ts`.
- `savePresenceClientId` — deleted.
- `presenceClientId` — deleted from `cli/src/utils/settings/types.ts` and `validation.ts`.
- `SAVANT_CODE_DISCORD_CLIENT_ID` — deleted (no env override remains).
- `/presence client` — no `client` subcommand branch in `cli/src/commands/presence.ts`; the usage line is
  `Usage: /presence [status|enable|disable]`.

**Questions:** (a) Did any caller or test still reference the removed symbols (compilation would fail if so — but
verify no dead imports remain)? (b) Is the slash-menu description (`cli/src/data/slash-commands.ts:124`-adjacent)
consistent with the client-less usage?

### Claim 3 (FID-009) — Presence is enabled by default

Re-verify: `cli/src/utils/settings/constants.ts:18` — `presenceEnabled: true` in `DEFAULT_SETTINGS`;
`cli/src/utils/settings/preferences.ts:71` — `loadPresenceEnabled()` falls back `?? true`;
`cli/src/init/init-app.ts:52` — `bootPresence(loadPresenceEnabled(), SAVANT_DISCORD_CLIENT_ID)` runs on every boot.

**Questions:** (a) Is the fresh-install path (no settings.json) and the legacy-install path (settings.json without
the key) both enabled by default? (b) Does `bootPresence` actually connect (not return early) when enabled + id are
truthy?

### Claim 4 (FID-009) — The feature-theft guard is pinned by a test

Re-verify: `cli/src/commands/__tests__/presence-command.test.ts` — asserts the id equals `1478095645662380042`,
asserts `/presence client 999…` is rejected with the client-less usage line, and asserts `/presence status` never
emits an "unconfigured" state.

**Questions:** (a) Does the test actually import the compiled constant (not a second literal), so a change to the
constant breaks the test? (b) Is the "rejected client subcommand" assertion sufficient to prove the surface is gone,
or should there also be a grep-based Law-4 check?

### Claim 5 (FID-010) — Docs, FAQ, README, CHANGELOG reflect the revision

Re-verify:

- `docs/features.md` (Discord Rich Presence section) — `/presence status | enable | disable`, "enabled by default",
  hardcoded id, no `client <id>`.
- `docs/faq.md` — "How do I turn it on?" states presence is already on (enabled by default); "Do I need to set
  anything up in the Discord Developer Portal?" answers **No** (id hardcoded).
- `README.md` — presence feature bullet says "enabled by default … client id hardcoded"; slash-command table row has
  no `client <id>`.
- `CHANGELOG.md` — 001–010 entry documents the hardcode + rename (`/auto` → `/auto-drive`) + enabled-by-default +
  FID-010.

**Questions:** (a) Is any operator-facing doc still showing the removed `client <id>` subcommand? (b) Does the FAQ
correctly answer the `/goal` vs `/auto-drive` disambiguation the operator raised?

### Claim 6 — FID records are honest

Re-verify: `dev/fids/FID-2026-0818-009-discord-rich-presence.md` records the hardcode decision in its Resolution and
Step Status (step 4 revision note); `dev/fids/FID-2026-0818-010-auto-drive-discord-docs-and-faq.md` is status
`verified` with all 7 steps `[x]` and a `2026-08-18 revision` note. Both are `verified`, not `closed` — closure
remains gated on live smoke + this review.

**Questions:** (a) Do the Step Status inventories claim `[x]` only where code/tests/docs actually ship (no silent
deferral per FID-2026-0817-005)? (b) Is the `verified` (not `closed`) status correct given the live smoke is still
pending?

## Gates (reported honestly; Nova should re-run or spot-check)

| Gate | Result |
|---|---|
| cli typecheck | PASS |
| presence + settings + command suites | 44 pass / 0 fail |
| `eslint . --max-warnings 0` | PASS |
| `lint:md` | PASS |
| `validate:repository` | PASS |

## Files to Read

1. `dev/fids/FID-2026-0818-009-discord-rich-presence.md` (0–EOF)
2. `dev/fids/FID-2026-0818-010-auto-drive-discord-docs-and-faq.md` (0–EOF)
3. `cli/src/utils/settings/preferences.ts`, `types.ts`, `validation.ts`, `constants.ts`
4. `cli/src/commands/presence.ts`, `cli/src/commands/__tests__/presence-command.test.ts`
5. `cli/src/init/init-app.ts`, `cli/src/state/presence/index.ts`, `cli/src/data/slash-commands.ts`
6. `docs/features.md`, `docs/faq.md`, `docs/index.md`, `README.md`, `CHANGELOG.md`

---

*Request written 2026-08-18 by Savant (Savant ECHO v0.1.2). Awaiting Nova's independent verdict before any closure
of FID-2026-0818-009/010.*
