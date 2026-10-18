# Model picker live retry (LIVE-003)

## Intent before implementation

Resume the outstanding LIVE-003 observation: open `/model` on the repaired
picker and capture whether the surface renders, navigates and keeps its
process alive, with timestamps and process state, so a future recurrence has
a measured baseline to compare against.

Single-agent ECHO v0.1.2 governs; strict mode and autonomy level 3. `HEAD`
equals the recorded `origin/main` at `2228fd48` with a clean working tree and
no active FID. No paid inference is authorized by the tracker, and the
repository's own prior investigation already recorded that the original
incident's cause is unestablished.

## Intake and constraints

- tmux is unavailable on this host; the previous session recorded the same and
  left live TUI acceptance as NEEDS-REVIEW.
- `Bun.Terminal` is available in Bun 1.3.14 and yields a real PTY with raw
  frames and the child's exit code, so the live surface can be observed
  without tmux.
- The dev catalog holds 2,299 rows. The earlier investigation's 4,075 figure
  included duplicate route rows; this session records the observed count
  rather than reusing the older number.
- The three-concurrent-basher condition needs real agent turns. Local Ollama
  exposes small models only (`qwen2.5:1.5b` and vision variants), which are not
  a reliable tool-calling substrate, and paid inference is not authorized. That
  condition is therefore not reconstructed; the run observes the repaired
  surface under the full real catalog instead.

## Planned work

1. Add a durable probe at `scripts/probes/live-003-picker-pty.ts` that spawns
   the real CLI on a PTY, opens `/model`, exercises navigation and filtering,
   and records boot/quiet timings, byte volume, stripped-screen content, child
   process state and RSS.
2. Run it against the repository checkout and preserve the transcript.
3. Record the outcome in `dev/tracking/internal-followups.json` as an
   observation of the repaired path, explicitly not as a cause for the
   original incident.
4. Commit and normally push the verified slice.

## Findings and implementation

`scripts/probes/live-003-picker-pty.ts` drives the real CLI through a PTY and
is the durable artifact from this session. Two runs on the developer catalog
(4,075 rows) produced identical results:

- Boot reaches the main surface in about 4.3 s with 19 KB of terminal output
  and 5.8 K printable characters. The process stayed alive throughout.
- Enter does not dispatch `/model` on this path. The slash palette re-renders
  (about 4.8 KB per keypress) and the typed command stays in the input, so no
  picker surface appeared within the 12 s deadline and the probe exits 1 with
  `picker never appeared within 12s of Enter`.
- `/help` dispatches normally through the same harness, so key delivery works
  and the blocker is specific to the slash-palette dispatch path.
- Resident memory was 842-845 MB with the full catalog mounted.
- No blank screen, no exit, and no error message were observed.

Because the operator reported opening the picker successfully in a real
terminal, the dispatch asymmetry is recorded as unclassified: a product defect
and a PTY-only artifact both remain possible, and this session does not claim
one. The probe reports `pickerOpened: false` with the retained-command flag
rather than asserting an unreachable surface.

## Limitations

- The picker was never observed live, so the repaired render path's live
  behaviour on the full catalog remains NEEDS-REVIEW.
- The original incident's question (process exit versus an alive blank screen)
  is still unanswered; nothing in this session reproduces blankness.
- Three concurrent bashers were not reconstructed. Local Ollama models are not
  a reliable tool-calling substrate and paid inference is not authorized.
- `dev/scratchpad/active/live-003-picker-pty-*.log` transcripts expire under the
  24-hour scratchpad policy; the durable facts are in the tracker and here.
- tmux is unavailable, which is why the probe uses `Bun.Terminal` instead.

## Register presentation

`SCOPE.md` gained the LIVE-003 item and its write targets before any file was
created, per Law 2 at automation level 3. The probe is a durable artifact, not
scratch: it must outlive this session so the next observation is comparable.
