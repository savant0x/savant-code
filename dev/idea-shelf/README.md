# Idea Shelf

Shelved ideas, explorations, and design references — **not active work**.
Nothing here is a commitment, a FID, or a registered task; active work lives
in `SCOPE.md` and `dev/fids/`.

## Layout

| Path | What lives here |
|---|---|
| `*.md` (this directory) | **Live shelf** — ideas with a plausible future: shelved blueprints, harvested sources with re-activation triggers, architectural syntheses |
| [`archive/`](archive/) | **Terminal records** — items realized, superseded, or resolved elsewhere. Kept as evidence, never re-activated |

Deep-research prompts are **not shelved here** — they are prompts to run, so
they live in [`../test-prompts/`](../test-prompts/) alongside the live-test
harnesses (moved 2026-09-28).

## Lifecycle

1. **Shelved** — an idea lands here with a `Status:` header, a source/attribution
   note, and (where applicable) a re-activation trigger. Deep-research prompts
   carry their paste-ready payload.
2. **Promoted** — an idea becomes real work by leaving the shelf entirely: it is
   filed as a FID under `dev/fids/`, registered in `SCOPE.md`, or captured in a
   build order. The shelf does not track in-flight work.
3. **Archived** — when an idea is realized, superseded by a canonical document,
   or resolved, the record moves to `archive/`. The move is the shelf's closure
   ceremony: no file here should keep a terminal status on the live shelf.

## Conventions

- Every file carries a `Status:` line near the top (`SHELVED`, `IMPLEMENTED`,
  `RESOLVED`, `SUPERSEDED`, …) plus a `Logged:` date.
- Sources are linked; local clones live under `resources/` and are referenced,
  not imported (license discipline — see the per-file license notes).
- Reference copies that duplicate a canonical `docs/` document must say so and
  yield to the canonical source on conflict.
- Re-activation triggers name the concrete event that should pull the item back
  into a planning conversation.

## Review

The shelf is reviewed when the operator asks. The review checks each item's
status against reality (did it ship? was it superseded?) and moves terminal
items to `archive/`. Last reviewed: **2026-09-28** — 4 of 17 items moved to
`archive/` (realized: logo easter egg, utility-tier ESLint gap, agent-skills
retrofit; superseded: OpenTUI capabilities reference; implemented same day:
custats free-offer feeds → FID-2026-0928-011), and the 5 deep-research
prompts moved to `../test-prompts/` (prompts are run, not shelved). A
same-day feature-coverage pass then verified the shipped product against
the remaining ideas: **Auto Drive is shipped** (FID-2026-0818-001..008,
`/auto-drive`) and **Discord Rich Presence is shipped**
(FID-2026-0818-009, `/presence`) — the auto-drive idea-farm note is
retained as historical spark context; the self-evolution plan's core is
substantially shipped (see the review log in `../test-prompts/README.md`);
the steering-curriculum insight is half addressed (the `/learn` mechanism
shipped; the harness-steering content has no equivalent). Remaining
genuinely-unbuilt ideas: AI partner architecture, cloudflare agent stack
patterns, mcp search rotation, zero-cost search, orchestrator tree fan-out.
