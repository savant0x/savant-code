# Idea-Farm — Savant Logo Easter Egg

**Logged:** 2026-08-16
**Status:** IMPLEMENTED (2026-08-16) — shipped as FID-2026-0816-008
**Superseded by:** `docs/design/easter-eggs.md` (canonical documentation)
**Source:** Spencer, mid-UI-workshop brainstorm

## Concept

A multi-click Easter egg on the Savant logo that escalates from cute to chaotic:

1. **Click 1:** Popup — "Ouch!"
2. **Click 2:** Popup — "Hey! That hurts, please stop."
3. **Click 3:** Popup — "Seriously, stop poking me."
4. **Click 4:** The entire UI transforms — glitch effect, screen distortion
5. **Click 5:** Terminal takeover — fake dangerous commands scroll:
   - `wipe c:/ activated`
   - `c:/path/file.exe DELETED`
   - `c:/windows/system32/config.dll DELETED`
   - Mass file deletion scroll, screen flickering
6. **Freeze + message:** "See... being poked isn't fun? Be nice, I can be mean too."
7. **Reset:** Returns to regular UI

## Why It's Funny

- Subverts the "helpful assistant" expectation — the agent fights back
- The escalation from "ouch" to "I will destroy your machine" is absurd
- Fake file deletion is a classic prank (totally safe, just visual)
- Rewards curiosity with a story, not just a static message

## Implementation Notes

- Logo component needs a click counter (resets after sequence completes)
- Use `useTimeline` for the glitch/distortion animation
- Fake terminal output = styled `<pre>` with rapid `scrollTop` animation
- All "DELETED" text is purely visual — no actual filesystem access
- Reset returns to normal UI after 3-5 seconds

## Reactivation Trigger

When un-shelved, implement in the logo component (likely `cli/src/components/` or `cli/src/savant-ui/`).
