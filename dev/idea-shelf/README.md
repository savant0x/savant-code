# Idea-Shelf

Index of shelf notes. New entries go here as one line.

- [free-llm-api-directory-2026-10.md](free-llm-api-directory-2026-10.md) — verified URL directory for Spencer's 72-item free-API list + stealth shelf status (Pixel Canary live, Space Bunny withdrawn) + meta-directory pointers. SHELVED.
- [ai-frontier-snapshot-2026-10-08.md](ai-frontier-snapshot-2026-10-08.md) — frozen baseline of the frontier board (Opus 5.5 #1, open-weight gap 13-22pts, $/task era) for a 30-day progress diff. **REVISIT 2026-11-07.** ACTIONABLE.
- [replace-subscriptions-repos-2026-10.md](replace-subscriptions-repos-2026-10.md) — all 10 repos from the "replace 10 subscriptions" video, verified w/ real URLs + transcript-garble table + agent-relevance read (freellmapi, OpenShorts MCP, VoiceStudio MCP, Dyad). SHELVED.
- [thinking-orbs-agent-status-2026-10.md](thinking-orbs-agent-status-2026-10.md) — @yogesharc/thinking-orbs: zero-dep animated AI agent status orbs (8 states incl. compacting/retrying, 15 variants). State taxonomy = free requirements research for Savant Desktop status UI. SHELVED.
- [shellshock-gateway-2026-10.md](shellshock-gateway-2026-10.md) — theRizwan/ShellShock: local free-provider gateway (Next.js + open-sse + brand.json white-label). Pattern: brand.json single-source + policy-as-config. Flag: routes stealth Big Pickle as "GPT-6.1-Sol". SHELVED.
- [context-mode-2026-10.md](context-mode-2026-10.md) — mksglu/context-mode (25.4k stars): MCP-layer context sandbox, 98% output reduction, FTS5 KB, PreCompact snapshot→restore, 17 platforms. Patterns: #852 escape-vector threat model (EHEL test case), ≤2KB priority snapshot, intent-driven filtering. SHELVED.
- [hermes-story-farm-2026-10.md](hermes-story-farm-2026-10.md) + baseline JSON — LIVE 3-day idea farm: diffs the Hermes user-stories page (371 tiles), classifies new stories, appends roadmap candidates. First sweep 10-08: 321 tiles, 44 pain / 86 workflow / 72 memory-system. Sweeps 10-10 + 10-13: 0 new stories each (page stable; rotation detected via (url,quote) set comparison — see delta notes). ACTIONABLE.
- [voxelbench-human-preference-arena-2026-10.md](voxelbench-human-preference-arena-2026-10.md) — voxelbench.ai: LIVE human-voted Elo arena for creative/voxel builds (AI voters blocked). Measures human aesthetic preference — the scalable proxy for Spencer's design eye, complementing AA/Vals/Terminal-Bench. REFERENCE SOURCE (revisit on new model drop / Nov statement-day).
- [bcbc-verification-loop-lesson-2026-10.md](bcbc-verification-loop-lesson-2026-10.md) — onehack.st post: first-hand catch of a model verification-loop failure mode + "bridge crossed" (settled state as termination condition). Maps 1:1 onto the lessons→feature recurrence classes; the gap the auto-gates don't cover (stop the DECISION re-examined, not just the action). Single-source forum post — methodology is the value. SHELVED.

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
