# Hermes Story Farm — Live Idea Pipeline (2026-10-08)

**Status:** ACTIONABLE — 3-day cron sweep, first run executed 2026-10-08.
**Source:** hermes-agent.nousresearch.com/docs/user-stories (371 tiles claimed; 321 clean
tiles extracted live). The Discord-archive repo (teknium1/nous-discord-archive, 60 stars)
is STALE (last commit 2026-08-18) — the page is the only live source.

## What this is

Teknium's scraper pipeline (Discord archive → first-person story extraction → dedupe →
masonry collage) doubles as the cheapest competitive-intelligence feed in the space:
~400 complaints/ideas/features from real Hermes users, pre-verified, linked to sources,
zero tokens to acquire. The farm makes it LIVE for Savant: a 3-day sweep diffs the page,
extracts new tiles, classifies them, and appends roadmap candidates to the shelf.

## Baseline (2026-10-08, first sweep)

Snapshot: `hermes-story-farm-baseline-2026-10-08.json` (sibling file) — 321 clean tiles,
deduped by URL, classified by keyword:
- **workflow: 86** ("I run X every day", scheduled, always-on) — validations of the persistence thesis
- **memory-system: 72** (second brain, profiles, Obsidian, skills) — the continuity layer wins in the market
- **pain: 44** ("wish", "took too long", "problem") — feature requests wearing complaints' clothes
- **economics: 31** (money saved, free, pricing) — pricing signals
- **other: 88** — unclassified, review on later passes

## The 3-day loop

1. Fetch the page (one curl, no API key, all tiles inline in the HTML)
2. Diff story URLs against the last snapshot JSON — extract only NEW tiles
3. Classify new tiles (complaint/feature/workflow/pricing) + append to shelf
4. Digest to Spencer's DM: N new stories, M roadmap candidates, top 5

## Registration

Cron: every 3 days, deliver origin. Baseline JSON = the frozen side of the diff.
Re-activation trigger: any cron failure — check the page is still serving tiles inline
(they may move to client-render or an API; the extractor assumes inline tiles).

## Sweep log
- 2026-10-08 (first): 321 tiles, 44 pain / 86 workflow / 72 memory-system / 31 economics / 88 other — baseline v2
- 2026-10-10: 0 new stories (parser upgraded v2→v3, 7 nav/footer leaks dropped) — delta note
- 2026-10-13: 0 new stories, 0 rotation (set-comparison verified; keep-first dedupe false-positive pitfall found and recorded) — delta note

## The pattern (why this matters)

Teknium built the scraper to market Hermes; it doubles as the requirements-research
feed for a competitor. Every complaint is a feature request; every workflow description
is free validation of the persistence thesis; the sourcing is one click from primary.
Zero-token acquisition vs ~35 searches per manual directory validation.
