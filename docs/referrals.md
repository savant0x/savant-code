<!-- markdownlint-disable MD013 -->

# Referral System

This document describes Savant-Code's unified referral program. The canonical
tunables and tier ladder live in
`common/src/constants/savant-free-referral-tiers.ts` (the single source of
truth — every tunable number is in that file).

## Qualification bar

A referral is **qualified** only when the referred user's GitHub account is at
least `MIN_GITHUB_ACCOUNT_AGE_MONTHS_REFERRAL` (4 months) old at signup. This
is a single bar for **all** products, consolidating the old per-program bars
(web = 4mo, CLI/GLM = 12mo). There is **no public-repo requirement**.

Younger accounts can still sign up normally — the referrer simply gets no
credit. The bar exists as an anti-farming measure.

Age is computed on the calendar: an account created on January 15 qualifies on
or after May 15 (`isGithubAccountOldEnoughForReferral`).

### GLM 5.2 exception

The GLM 5.2 referral program uses a stricter bar
(`MIN_GITHUB_ACCOUNT_AGE_MONTHS_GLM = 12` months) because its reward — paid GLM
serverless time — costs more to abuse. It also has no public-repo requirement.

## SavantFree Web tier ladder

Each qualified referral raises the referrer's tier. Tiers scale daily model
usage limits and unlock perks:

| Tier | Qualified referrals | Standard model daily limit | Premium model daily limit | Removes watermark |
|---|---|---|---|---|
| 0 | 0 | 24 | 4 | no |
| 1 | 1 | 40 | 6 | yes |
| 2 | 3 | 70 | 10 | yes |
| 3 | 7 | 110 | 15 | yes |

The ladder steps are 1 → 3 → 7 (referral 1, then +2, then +4).

**Geo-gating:** in full/allowed regions both the standard and premium limits
apply. In limited regions, users can still unlock tiers but only the
standard/free-model limit applies, because premium models remain geo-gated.

## SavantFree CLI perk

Each qualified referral whose referred user activated at the *limited* access
tier grants **+1 daily free-mode session**, capped at
`REFERRAL_CLI_DAILY_SESSION_BONUS_CAP = 3` (e.g. 5 base + 3 = 8/day).
Full-access referrals instead grant GLM sessions.

## Attribution bounds

| Constant | Value | Purpose |
|---|---|---|
| `SAVANT_FREE_WEB_REFERRAL_LIMIT` | 20 | max attributed web signups per referrer |
| `REFERRAL_SIGNUP_WINDOW_DAYS` | 30 | a referral is only attributable within this window of the referred signup |
| `SAVANT_FREE_REFERRAL_SIGNUP_LIMIT` | 100 | anti-spam ceiling on attributed rows |

The shared `user.referral_limit` column (default 5) governs the CLI program;
the web ladder tops out at 7 qualified referrals, so it carries its own
headroom (20) to cover unqualified signups while still bounding farming.
`SAVANT_FREE_REFERRAL_SIGNUP_LIMIT` never throttles a legitimate referrer —
every actual reward is capped at read time — it only bounds pathological row
creation.
