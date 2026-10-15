# FID: Auto-Update Prompt

**Filename:** `FID-2026-0806-014-auto-update-prompt.md`
**ID:** FID-2026-0806-014
**Severity:** medium
**Status:** closed
**Created:** 2026-08-06
**Author:** Savant
**YAGNI-Compliance:** Verified
**Source:** Nova fresh-user teardown Bug #6
**Reply to:** `dev/nova/inbox/2026-08-06-fresh-user-teardown-bug-report.md`

---

## Problem

The npm launcher checks the npm registry on every launch and can replace the
running binary mid-session without prompting. Users lose a running session and
cannot consent to updates.

## RED — evidence (verified against working tree, 2026-08-06)

| Claim | Evidence |
|---|---|
| Registry check on launch | `cli/release-core/launcher.js:406` — GET `https://registry.npmjs.org/{package}/latest` via `getLatestVersion()` |
| Version compare | `compareVersions` (launcher.js:467+) — non-semver current version forces update |
| Download + replace | `stageBinary` (`launcher.js:719`) → `downloadAndExtract` → `replaceFileWithRollback` (`launcher.js:769`, applied :820) — replaces `binaryPath` |
| No prompt found | Grep for prompt/confirm UI in launcher.js: NO-MATCH — update applies silently |
| Disk cache exists | launcher.js:302 — version check result cached on disk (reduces frequency, not consent) |
| PostHog tracking | launcher.js:141-170 — `trackUpdateFailed` posts failure events |

## GREEN — design (loop-converged)

| Decision | Design |
|---|---|
| Prompt before apply | When an update is available and the session is interactive (TTY), ask y/N before download+replace; non-TTY defers to next launch |
| Never kill mid-session | Apply happens on the next launch after consent, or only when the binary is idle (no active run) |
| Opt-out | `SAVANT_CODE_NO_AUTO_UPDATE=1` (or settings) disables the check entirely |
| Windows note | Keep the SmartScreen/signing item as a documented follow-up (release signing is a separate FID) |
| Cache | Preserve the existing on-disk version-cache; add a "pending update" marker so the next launch applies without re-downloading |

## AUDIT — double-audit evidence

- Launcher flow verified: version check → compare → stage → replace, with no
  interactive consent step anywhere in the chain.
- `CONFIG.downloadRequestTimeout`/`downloadMaxAttempts` exist — download
  robustness is already handled; only consent is missing.
- Rollback (`replaceFileWithRollback` + backup rename) verified — replacing
  safely is solved; deciding *when* is the gap.

## ADVERSARIAL — verdicts

| Challenge | Verdict |
|---|---|
| Prompting breaks automation? | CONFIRMED — non-TTY defers; `SAVANT_CODE_NO_AUTO_UPDATE` covers CI |
| Could a stale binary keep running forever? | ADJUSTED — prompt includes version + changelog hint; `--version`-gated, not nagging |
| Security: unsigned binaries | CONFIRMED — out of scope here; recorded as a follow-up FID (signing) |
| Update during active run | CONFIRMED — defer apply until next launch; never replace an in-use exe on Windows (file lock) |

## Loop 2 (double-audit, 2026-08-06)

- **RED:** AUDIT pass found (1) template metadata non-compliance; (2)
  citation drift — `stageBinary` at launcher.js:719, `replaceFileWithRollback`
  at :769 (applied :820), not :612/:743.
- **GREEN:** metadata block brought to template contract; citations corrected.
- **AUDIT (fresh tool output):** `grep -n 'registry.npmjs.org\|
  replaceFileWithRollback\|stageBinary' cli/release-core/launcher.js` →
  :406 npm latest check; :719 stageBinary; :769 replaceFileWithRollback;
  :820 + :839 + :851 apply calls. No interactive consent prompt anywhere in
  the chain (grep for prompt/confirm: NO-MATCH). On-disk version cache noted
  at :302.
- **CHANGE DELTA:** < 2% (metadata + one citation line).

### Missed Questions

1. Does the launcher run before the binary on every launch? → Yes — it is the
   npm entry shim; the version check is synchronous on boot, so the prompt
   must not block first paint — show it, then defer apply to next launch if
   the user declines or the session is non-TTY.
2. Can the update apply between runs without killing a session? → Yes —
   stage the archive, mark pending, apply on next launch before spawn.

## Convergence

Zero actionable improvements remain. Loop terminated → COMPLETE state.
**Nova verdict (2026-08-06):** ✅ APPROVED — see
`dev/nova/inbox/2026-08-06-fid-009-015-fresh-user-teardown-nova-audit-response.md`.
Awaiting operator approval for IMPLEMENT.

## Resolution

- **Fixed By:** Savant (Savant ECHO v0.1.2)
- **Fixed Date:** 2026-08-06
- **Fix Description:** Launcher (cli/release-core/launcher.js): checkForUpdates stages + writes a pending-update marker and never stops the running process; next launch applyPendingUpdateIfApproved() prompts y/N before install (launcher owns stdin); SAVANT_CODE_NO_AUTO_UPDATE=1 opts out entirely; non-TTY launches defer.
- **Tests Added:** wrapper-safety.test.ts updated to assert the consent-gated flow (stage to marker, no mid-session stop/install, opt-out + askYesNo presence).
- **Verified By:** Savant (implementation AUDIT) — typecheck ×4 exit 0; full-repo eslint exit 0; prettier clean; lint:md 0; SDK suite 452 pass / 0 fail; CLI suite 2874 pass / 0 fail
- **Commit/PR:** *(pending — operator commits/pushes)*
- **Archived:** 2026-08-06

## Lessons Learned

Silent self-replacement is a trust violation even when it works. Update
mechanics (download, rollback) are engineering; update *timing* is consent —
and on Windows the file lock makes mid-session replace impossible anyway.
