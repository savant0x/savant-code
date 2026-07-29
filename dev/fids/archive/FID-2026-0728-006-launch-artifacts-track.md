# FID: Launch Artifacts Track

**Filename:** `FID-2026-0728-006-launch-artifacts-track.md`
**ID:** FID-2026-0728-006
**Severity:** medium
**Status:** closed
**Created:** 2026-07-28 14:50
**Author:** Orchestrator

---

## Summary

This track assembles, reviews, and stores all external-facing assets required for public traction. It removes launch-day scrambling by preparing polished, ECHO-compliant documentation, landing pages, and community scaffolding in advance.

## Environment

- **OS:** Cross-platform (web/community platforms)
- **Language/Runtime:** Markdown, HTML/CSS, Discord
- **Tool Versions:** Savant Code v0.0.8
- **Commit/State:** `main` post-v0.0.8 release

## Detailed Description

### Problem

The launch strategy calls for a coordinated multi-channel launch, but none of the required market-facing assets exist yet. Launching without pre-written, reviewed artifacts risks inconsistent messaging and missed opportunities.

1. **No `docs/launch/` directory** exists with pre-written copy.
2. **No landing page** exists at `savantcode.dev`.
3. **Discord server** is not set up.
4. **README hero section** is not optimized for launch traffic.
5. **Incident Response & Rollback plan** is not documented.

### Expected Behavior

- `docs/launch/` contains the HN post, first comment, Twitter/Mastodon threads, and newsletter pitch.
- A minimal dark-mode landing page exists at `savantcode.dev` linking to GitHub.
- Discord server has channels: #announcements, #ollama-setup, #byok-support, #echo-protocol-feedback.
- README begins with a one-sentence pitch, animated GIF, and install command.
- `docs/launch/incident-response.md` exists with rollback steps.

### Root Cause

Launch artifacts were treated as a future marketing task rather than a pre-launch engineering deliverable. The strategy document assumed these would be created but did not assign ownership or deadlines.

### Evidence

- Parent FID: `dev/fids/FID-2026-0728-002-launch-strategy-execution.md`
- Launch strategy: `docs/Savant Code Launch Strategy.md`
- Current README: `README.md`
- ECHO Protocol: `ECHO.md`

## Impact Assessment

### Affected Components

- `docs/launch/` — new directory
- `docs/launch/incident-response.md` — new document
- `README.md` — hero section rewrite
- External landing page (`savantcode.dev`)
- External Discord server
- External GitHub repo metadata

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Create all launch artifacts in parallel, ensuring each claim maps to verified code and ECHO values. Keep the landing page minimal and fast.

### Steps

1. Create `docs/launch/` directory.
2. Draft `docs/launch/hn-post.md`, `docs/launch/hn-first-comment.md`, `docs/launch/twitter-thread.md`, `docs/launch/mastodon-thread.md`, `docs/launch/newsletter-pitch.md`.
3. Draft `docs/launch/incident-response.md` with rollback steps.
4. Build or deploy minimal dark-mode landing page at `savantcode.dev`.
5. Create Discord server with required channels and moderation rules.
6. Rewrite README hero section with one-sentence pitch, animated GIF, install command, and Ollama setup instructions.
7. Cross-verify every marketing claim against code/docs before publishing.

### Verification

- All `docs/launch/` files exist and are reviewed by at least one maintainer.
- Landing page is live, loads fast, and links to GitHub.
- Discord invite works and channels are configured.
- README claims match verified capabilities in code.
- No external link is broken.

## Perfection Loop

### Loop 1

- **RED:** No launch artifacts exist; README is not optimized for launch traffic; no incident response plan; no community channel.
- **GREEN:** Generate `docs/launch` structure, pre-write all launch copy, build landing page, create Discord, rewrite README hero, and document incident response.
- **AUDIT:** All artifacts exist; all claims cross-verified against code; all links live.
- **CHANGE DELTA:** N/A (documentation/artifacts track).

### Missed Questions

> As part of the Perfection Loop, the Thinker must ask: *"What questions should I have asked when this FID was created, but failed to?"*

1. **Is the demo GIF optimized enough to load instantly on slow connections?** → Compress to < 2MB and provide a static fallback.
2. **Are competitor citations and links in the social pitch accurately validated and non-inflammatory?** → Re-verify all external links; avoid attacking competitors directly.
3. **Who owns the creation and moderation of the Discord on soft-launch day?** → Assign at least one moderator per active time zone.
4. **Where is the minimal landing page hosted and is HTTPS secured?** → Use GitHub Pages or Cloudflare Pages with HTTPS by default.
5. **How do we track repository star/social conversion metrics while respecting privacy-first claims?** → Do not use tracking pixels; rely on GitHub star count and self-reported Discord growth.
6. **What if HN moderators flag the post as self-promotion?** → Ensure the first comment is highly technical and transparent; follow HN guidelines exactly.
7. **Are the launch materials written by hand or generated by LLM?** → Per the strategy, all launch copy must be written by hand to maintain authenticity.

### Code Verification Evidence

- [ ] Files referenced in "Affected Components" exist in the codebase
- [ ] `docs/launch/` directory created with all planned files
- [ ] Landing page is live and links to GitHub
- [ ] Discord server configured with required channels
- [ ] README hero section rewritten and reviewed
- [ ] All marketing claims cross-verified against code

### Loop 2

- **RED:** TBD after initial artifact creation and review.
- **GREEN:** TBD
- **AUDIT:** TBD
- **CHANGE DELTA:** TBD

## Resolution

- **Fixed By:** TBD
- **Fixed Date:** TBD
- **Fix Description:** TBD
- **Tests Added:** TBD
- **Verified By:** TBD
- **Commit/PR:** TBD
- **Archived:** 2026-07-28

> When status is set to **Closed**, move this file to `dev/fids/archive/` and
> append an entry to `CHANGELOG.md`.

## Lessons Learned

- Launch artifacts are engineering deliverables, not afterthoughts.
- Every marketing claim must be traceable to code or architecture.
- Community infrastructure must exist before launch traffic arrives.
