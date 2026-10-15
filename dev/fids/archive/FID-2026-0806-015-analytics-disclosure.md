# FID: Analytics Disclosure

**Filename:** `FID-2026-0806-015-analytics-disclosure.md`
**ID:** FID-2026-0806-015
**Severity:** low
**Status:** closed
**Created:** 2026-08-06
**Author:** Savant
**YAGNI-Compliance:** Verified
**Source:** Nova fresh-user teardown Bug #7
**Reply to:** `dev/nova/inbox/2026-08-06-fresh-user-teardown-bug-report.md`

---

## Problem

`analyticsEnabled: true` with PostHog by default. Privacy-conscious fresh
users are not told before first run that analytics are on.

## RED — evidence (verified against working tree, 2026-08-06)

| Claim | Evidence |
|---|---|
| Default-on | `cli/src/utils/settings.ts:20` — `analyticsEnabled: true` in `DEFAULT_SETTINGS`; `docs/privacy.md:117` confirms `true` for new/legacy settings |
| PostHog wired | `cli/package.json:45` — `posthog-node`; launcher.js PostHog capture; `NEXT_PUBLIC_POSTHOG_API_KEY` |
| Controls exist | `/telemetry status|enable|disable` (CHANGELOG v0.0.15+), `docs/privacy.md` control surface |
| README lacks disclosure | Grep README.md for analytics/telemetry mention: NO-MATCH in the quick-start section |

## GREEN — design (loop-converged)

| Decision | Design |
|---|---|
| README disclosure | Add a "Privacy" section to README: analytics default-on, what is collected (PostHog usage events), how to disable (`/telemetry disable` or `analyticsEnabled: false`) |
| First-run notice | One-line notice on first launch when `analyticsEnabled` is unset: "Usage analytics are on by default — disable with /telemetry disable" |
| Default stays on | No behavior change to the default (operator's existing posture); disclosure only |
| Opt-in reconsideration | Recorded as an open question for launch review, not implemented here |

## AUDIT — double-audit evidence

- `DEFAULT_SETTINGS.analyticsEnabled = true` verified at settings.ts:18.
- `/telemetry` command registered in the command registry (CHANGELOG + command files) — the control surface exists.
- README quick-start verified — no analytics disclosure today.
- `docs/privacy.md` already documents the full control surface — README just needs the pointer.

## ADVERSARIAL — verdicts

| Challenge | Verdict |
|---|---|
| Should default flip to opt-in? | CONFIRMED as a product decision for launch review — this FID ships disclosure only, avoiding churn before the gateway launch |
| First-run notice is annoying? | ADJUSTED — single muted line, shown once (settings flag), not a blocking prompt |
| GDPR/EU concern | CONFIRMED — disclosure + existing controls satisfy the transparency bar; opt-in flip is the launch-review follow-up |

## Loop 2 (double-audit, 2026-08-06)

- **RED:** AUDIT pass found (1) template metadata non-compliance; (2)
  citation drift — `analyticsEnabled: true` at `settings.ts:20` not :18.
- **GREEN:** metadata block brought to template contract; citation corrected.
- **AUDIT (fresh tool output):** `grep -n analyticsEnabled
  cli/src/utils/settings.ts` → :20 `analyticsEnabled: true` in DEFAULT_SETTINGS
  (field type at :52). `cli/package.json:45` `posthog-node ^5.8.0` confirmed.
  `telemetry` slash command registered (`cli/src/commands/defs/core.ts:56`,
  handler at `cli/src/commands/telemetry.ts`). README quick-start grep:
  NO-MATCH for analytics/telemetry disclosure.
- **CHANGE DELTA:** < 2% (metadata + one citation line).

### Missed Questions

1. Does the launcher also track before the settings file exists? → Yes —
   launcher.js PostHog capture runs pre-CLI; the README disclosure + first-run
   notice must cover the launcher's update-failure events too.
2. Should the first-run notice be dismissible permanently? → Yes — persist a
   `analyticsNoticeSeen` flag; show once.

## Convergence

Zero actionable improvements remain. Loop terminated → COMPLETE state.
**Nova verdict (2026-08-06):** ✅ APPROVED — see
`dev/nova/inbox/2026-08-06-fid-009-015-fresh-user-teardown-nova-audit-response.md`.
Awaiting operator approval for IMPLEMENT.

## Resolution

- **Fixed By:** Savant (Savant ECHO v0.1.2)
- **Fixed Date:** 2026-08-06
- **Fix Description:** README Privacy & Telemetry section (default-on disclosure, /telemetry disable path, ads separate); one-line first-run notice in index.tsx (stderr, shown once via settings.analyticsNoticeShown).
- **Tests Added:** settings.test.ts analytics-notice-shown-once test.
- **Verified By:** Savant (implementation AUDIT) — typecheck ×4 exit 0; full-repo eslint exit 0; prettier clean; lint:md 0; SDK suite 452 pass / 0 fail; CLI suite 2874 pass / 0 fail
- **Commit/PR:** *(pending — operator commits/pushes)*
- **Archived:** 2026-08-06

## Lessons Learned

Default-on telemetry without a first-run mention reads as surveillance, not
instrumentation. Disclosure costs one line; trust costs everything — and the
control surface (already built) is only useful if users know it exists.
