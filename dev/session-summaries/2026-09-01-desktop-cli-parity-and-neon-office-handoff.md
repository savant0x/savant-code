# Session Handoff — 2026-09-01 — Desktop/CLI parity + neon-noir office deck

**Status:** Code-complete, all gates green, but NOT yet visually re-verified end-to-end
after the last renderer-side change. Pick up with a live reload + eyeball pass over the
chat transcript and the deck, then decide whether to commit the 138-file working tree.

---

## The one-sentence summary the next session needs

The desktop chat UI now matches the CLI block-for-block (title-cased tool headers with
per-tool previews, a real context-window tracker, live activity status + phase chip, model
badge, copy footer, simple-item renderers, silent FID updates), and the deck was rebuilt
from the all-black "random blocks" floor into a proper neon-noir office with a robot cast;
the remaining work is a visual smoke test and a decision on committing.

## What passed this session (all gates green)

`desktop` suite runs green at **328 tests / 0 fail**, `tsc --noEmit` exit 0 across
desktop/common/sdk/agent-runtime/cli, eslint `--max-warnings 0`, prettier, `lint:md`.

### FID-2026-0901-006 — desktop ↔ CLI UI parity (the big one; P4–P17 staged)

Renderer-side only, no sidecar rebuild needed (just reload). Most-recent first:

- **P17** (today's last push): FID list is now **silent** (updates the FID queue panel
  only — no more wall of `FID … → analyzed/closed` in the transcript); active **model
  badge** in the header (captured from `activity.thinking.model`); **live-activity phase
  chip** so the phase rail isn't all-dark on a normal chat run (FSM chips still only light
  from real `transition_phase` events — G2 no-guess); and `sequentialthinking` /
  `write_todos` / `suggest_followups` collapsed previews fixed (they were showing a bare
  `}` from the JSON result — now defer to their dedicated `💭 Thought N/M` / `N/M todos`
  previews).
- **P14–P16**: Title-Case tool names + per-tool collapsed previews; `write_file` compact
  summary (no more all-additions diff wall); `write_todos` ✓/○ checklist card; thinking
  panel chrome; tool-card copy footer with `+N/−M` diff counter; simple-item renderers for
  `web_search` / `read_url` / `skill`.
- **P13**: context window tracker — `context 42% · 84k/200k`. **The window is NOT
  hardcoded**: the gateway resolves it from the model catalog and threads it through
  `client.run` → `ContextCompactor`. `200_000` is only a last-resort fallback when
  resolution fails.
- **Earlier in the FID**: activity stream surfaced (RunStatusBar), timestamps below
  messages, followups un-hidden, markdown table column truncation fix, duplicate deck
  figure on role spawn fix.

### FID-2026-0831-002 / -001 — neon-noir office deck rebuild

Replaced the all-black "random blocks" floor with a real office: procedural PBR textures
(no bundled image assets), desks, walls, bookshelves, plants, emissive neon. The Savant
**logo** (`assets/logo.png`) is the central emblem with a cyan glow stroke; Savant stands
on the command tile at 2–3× scale with a distinct model. Agents are **robots** with
role-colour accent glows, non-static (they walk to their stations / sit at desks), and
agents no longer overlap the desks. Nameplates are a canvas-drawn AAA design (role-accent
glow stroke, status dot, uppercase title + subtitle). Added desk name labels.

The **"SAVANT OPERATIONS" wall sign is `/dev override`-removed** — the back wall is clean.
`officeWalkerCast()` dedupe: a spawned subagent replaces its standby filler figure, so no
duplicate Thinker (the "Savant the Thinker" duplicate is fixed).

### FID-2026-0901-001 — sidecar env + SDK client init

The sidecar now finds `.env.local` beside the exe and in repo-root candidates (dev layout),
and the gateway `defaultRunPrompt` was fixed to thread `contextWindow` + `compression`
(microCompact:false) so the desktop no longer micro-compacts every turn. Sidecar rebuilt
(`build:sidecar --entry ../cli/src/server-command.ts --target bun-windows-x64`).

### FID-2026-0828-001 / -002, FID-2026-0829-001 — compaction summary + deck live fidelity

Compaction summary block, deck live-driver event mirroring, session-scoped deck driver.

---

## Open / not-yet-verified items (the real handoff)

1. **Visual smoke test** — after the P17 renderer changes, reload the app and eyeball:
   - chat: model badge in header, live phase chip during a run, seq-thinking cards showing
     `💭 Thought N/M`, no FID wall, copy footer on a finished tool card.
   - deck: neon-noir office still renders; Savant on the command tile; agents at stations;
     no duplicate Thinker; logo not too bright (dim to taste).
2. **Commit decision** — 138 files modified/untracked on `main`. Nothing staged yet. This
   is a large working tree spanning several FIDs; decide whether to commit in one go or
   split per FID. **Do not force-push.**
3. **Left-open step 7 in FID-0901-006** — a deeper block-by-block CLI *visual parity* pass
   on a live native smoke (the design-language pass was done; the "exact same rendering as
   the TUI" polish is the remaining slice).
4. **Diagnostics** — the deck driver/runtime debug logs (`[deck] batch: …`, `[deck] cast
   N/10 mounted`, `[deck] mount`) are still in place; decide whether to keep or strip.
5. **Phase rail on a real Perfection Loop turn** — P17 keeps FSM chips G2-honest; confirm
   they lit on a real loop turn (a normal chat run intentionally won't).

## Useful commands

```bash
# Run the desktop suite + gates
cd desktop && bun test src/ && bun x tsc --noEmit && bun x eslint src/ --max-warnings 0

# Rebuild the sidecar after a gateway/runtime change
bun run --cwd desktop build:sidecar --entry ../cli/src/server-command.ts --target bun-windows-x64

# Launch
bun tauri dev   # (from desktop/)
```

## FIDs touched this session (open)

- `dev/fids/FID-2026-0901-006-desktop-cli-ui-parity.md` (P4–P17; the main thread)
- `dev/fids/FID-2026-0901-001-sidecar-env-and-sdk-client-init.md`
- `dev/fids/FID-2026-0901-003-deck-ambient-life-interaction.md`
- `dev/fids/FID-2026-0831-001-deck-rebuild-neon-noir-office.md`
- `dev/fids/FID-2026-0831-002-deck-office-visual-correction.md`
- `dev/fids/FID-2026-0829-001-deck-visual-activity.md`
- `dev/fids/FID-2026-0828-001-compaction-summary-output.md`
- `dev/fids/FID-2026-0828-002-deck-live-fidelity.md`
