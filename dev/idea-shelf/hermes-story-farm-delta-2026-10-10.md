# Story-Farm Delta — 2026-10-10 (3-day sweep)

## Method
- Source: https://hermes-agent.nousresearch.com/docs/user-stories (inline tiles, NOT client-rendered)
- Parser: **v3** (clean tile-structure extraction — href/source/category/headline/quote/author/date)
- Stability check: 3 fetches; md5 churns cosmetically (Docusaurus asset-hash rotation in `<script>` URLs) — content byte-stable. **Diff tile sets (url+headline), never md5.**
- Validation: 371 tiles extracted == page's own "371 stories" claim

## Result: 0 new stories
| Signal | Baseline (v2, 10-08) | Now (v3, 10-10) | Delta |
|---|---|---|---|
| Tiles | 378 (incl. 7 nav/footer leaks) | 371 (clean) | -7 leaks, 0 story removals |
| Distinct URLs | 339 | 333 | -6 (all v2 parser artifacts) |
| Repeat-URL counts | — | identical on all 7 | 0 growth |
| Rotated stories (new headline under existing URL) | — | 0 | none |

## Dropped URLs (all non-story artifacts leaked by v2 parser)
- agentskills.io — Skills Hub footer link
- github.com/NousResearch/hermes-agent — footer repo link
- nousresearch.com — footer company link
- github.com/NousResearch/hermes-agent/edit/main/website/docs/user-stories.mdx — edit link
- github.com/NousResearch/hermes-agent/edit/main/website/src/data/userStories.json — edit link
- github.com/NousResearch/hermes-agent/issues — footer issues link

## Bucket mix (v3, 371 tiles)
- pain: 41 | workflow: 220 | memory-system: 50 | economics: 60 | other: 0
- Page categories: Dev Workflow 80, Personal Assistant 49, Business Ops 48, Integrations 33, Creative 26, Meta & Ecosystem 23, Enterprise 21, Cost Optimization 20, Privacy & Self-Hosted 13, Content Creation 12, Research 12, Messaging 11, Marketing 9, General 9, Trading & Markets 5

## Notes for next sweep
- The page's tile count has been **stable at 371 across at least 3 days** — the front-page stories are largely static; new stories may not surface until Nous rotates the featured set.
- The 7 repeat-URL hosts (nous-discord-archive txt files are the biggest: hermes-agent.txt hosts 24 tiles) rotate their content — quote-snippet diff is the reliable detector; md5 is NOT.
- Parser v3 baseline written to hermes-story-farm-baseline-2026-10-08.json (same filename, now v3 content). Next sweep diffs against its clean quote fields.
