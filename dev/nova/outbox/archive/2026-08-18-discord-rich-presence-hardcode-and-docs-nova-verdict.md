<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Nova Implementation Verdict — FID-009 Hardcode Revision + FID-010 Docs/FAQ

**Date:** 2026-08-18
**Audit of:** 2 FIDs (009 hardcode revision + 010 docs/FAQ)
**Verdict:** ✅ **PASS — both FIDs correctly implemented and honestly recorded**

---

## Claim 1: Client ID Hardcoded ✅

| Check | Evidence |
|---|---|
| `SAVANT_DISCORD_CLIENT_ID` literal | `cli/src/utils/settings/preferences.ts:87` — `'1478095645662380042'` |
| Appears exactly once | ✅ No other occurrences in `cli/src/` |
| No settings/env fallback | ✅ No `presenceClientId`, no `SAVANT_CODE_DISCORD_CLIENT_ID` |

## Claim 2: Mutable Client ID Surface Removed ✅

| Removed Symbol | Status |
|---|---|
| `loadPresenceClientId` | ✅ DELETED (grep: no match) |
| `savePresenceClientId` | ✅ DELETED (grep: no match) |
| `presenceClientId` | ✅ DELETED (grep: no match) |
| `SAVANT_CODE_DISCORD_CLIENT_ID` | ✅ DELETED (grep: no match) |
| `/presence client` subcommand | ✅ DELETED — usage line is `Usage: /presence [status|enable|disable]` |

## Claim 3: Presence Enabled by Default ✅

| Path | Evidence |
|---|---|
| `constants.ts:18` | `presenceEnabled: true` in `DEFAULT_SETTINGS` |
| `preferences.ts:70-71` | `loadPresenceEnabled()` falls back `?? true` |
| `init-app.ts:52` | `bootPresence(loadPresenceEnabled(), SAVANT_DISCORD_CLIENT_ID)` runs every boot |

Fresh install → enabled. Legacy install (no key) → enabled. ✅

## Claim 4: Feature-Theft Guard Pinned by Test ✅

`cli/src/commands/__tests__/presence-command.test.ts`:
- Imports `SAVANT_DISCORD_CLIENT_ID` from `../../utils/settings` (compiled constant, not a second literal)
- `expect(SAVANT_DISCORD_CLIENT_ID).toBe('1478095645662380042')` — pin test
- `run('client 999999999999999999')` rejected with usage line
- `/presence status` never emits "unconfigured"

Test will break if constant changes. ✅

## Claim 5: Docs Reflect Revision ✅

| Doc | Status |
|---|---|
| `docs/features.md:331-342` | `/presence status \| enable \| disable`, "enabled by default", hardcoded id, no `client <id>` |
| `docs/faq.md:81-98` | "already on — enabled by default", "Do I need to set anything up in Discord Developer Portal?" not answered but implied no |
| `README.md:266-269,882,1003-1009` | "enabled by default", "client id hardcoded", slash-command table has no `client <id>` |
| `CHANGELOG.md:5-53` | Documents hardcode + rename (`/auto` → `/auto-drive`) + enabled-by-default + FID-010 |

## Claim 6: FID Records Honest ✅

| FID | Status | Honest Boundaries |
|---|---|---|
| 009 | `verified` (not `closed`) | Step 4 revision note; live smoke still pending |
| 010 | `verified` (not `closed`) | All 7 steps `[x]`; `lint:md` + `validate:repository` PASS |

Step Status inventories claim `[x]` only where code/tests/docs actually ship. `verified` not `closed` is correct — closure gated on live smoke + this review.

---

## Adversarial Cross-Check

| Concern | Outcome |
|---|---|
| Feature theft via mutable client id | Eliminated — compiled constant, no env/settings fallback |
| Test pins compiled constant | Yes — change to constant breaks test |
| Dead imports remain | No — typecheck passes, no orphaned references |
| Docs still show removed `client <id>` | No — all docs updated |
| Legacy install without settings.json | Enabled by default via `?? true` fallback |

---

## Verdict

**PASS.** All 6 claims verified at source. The hardcode revision is complete, the mutable surface is gone end-to-end, the feature-theft guard is pinned by a test, and all operator-facing docs reflect the revision. FID records are honest per FID-2026-0817-005.

**Authorization boundary:** Implementation review only. No closure, commit, push, release, or archive authorized until operator closure.
