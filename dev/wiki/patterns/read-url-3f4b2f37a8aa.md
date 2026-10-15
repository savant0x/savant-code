# Pattern: read_url

> Auto-maintained by the session-end review (FID-2026-0912-003).
> Mechanical distillation of a recurring failure pattern — update-only;
> never auto-deleted. Not read into agent context at boot.

- **Tool:** read_url
- **Dedup key:** `sha256:3f4b2f37a8aa55a9fc52e7fee3773c663af27354f9e61f80979d0cda341b3b57`
- **Sample line:** `Failed to fetch URL: 401 Unauthorized`
- **Recurrences (14d window):** 7 (total 9)
- **First seen:** 2026-09-16T21:12:41.357Z
- **Last seen:** 2026-10-10T06:02:13.457Z
- **Routing:** promote via FID when resolved+verified (hybrid routing rule)

## Evidence

- 2026-09-30 — recurrences 3 (total 3), first 2026-09-16, last 2026-09-27
- 2026-10-05 — recurrences 4 (total 6), first 2026-09-27, last 2026-10-05
- 2026-10-10 — recurrences 7 (total 9), first 2026-09-27, last 2026-10-10
