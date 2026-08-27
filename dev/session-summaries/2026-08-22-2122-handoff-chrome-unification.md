# Handoff — Chrome Unification Program (FID-2026-0822-005..011)

**Date:** 2026-08-22 21:22 EDT
**Status at handoff:** working tree carries ALL fixes below
(release-only-commits — nothing committed; next automation release sweeps it)

## ⚠️ Operator action required to SEE the fixes

Restart the TUI (`bun run --cwd=cli dev`). A long-lived session renders code
loaded at launch. If you are running an **installed v0.0.27 binary**, today's
fixes are NOT in it — they ship with the next release.

## Closed + archived this session

- **FID-2026-0822-006** — chrome unification round 1: TrafficLightPanel as the
  single panel utility (TerminalCommandDisplay, CompactionSignal,
  set_output, sequentialthinking framed; AgentBranchItem re-skinned rounded +
  surface + header lights). Verifier PASS, Adversary CONFIRMED. Post-closure
  live smoke recorded in the archived record.
- **FID-2026-0822-009** — streaming-reflow defects: root cause = panel chrome
  consumes 4 cols but renderers subtracted 2. Fixes: shared
  `TRAFFIC_PANEL_WIDTH_ALLOWANCE=4` + `flexShrink:1` on markdown inline hosts.
  Live-verified @90 cols across two sessions (byte-checked clean borders).
  Merged-glyph class closed as capture/streaming artifact.

## Fixed this session (active queue)

- **FID-2026-0822-011** (`fixed`) — read_files framed; add_message registered
  (NEW AddMessageComponent); Thinking reasoning panels converted to chrome
  (= the display half of -010, closing your tmux-cli/reasoning reports once
  you restart). Tests added (AddMessage 3, ReadFiles 3); eslint/typecheck
  green. OPEN inside it: human expanded-state check — expand a tmux-cli
  branch and confirm read_files/add_message panels render framed.

## Still OPEN (tracked, do not silently drop)

- **FID-2026-0822-010** — CORE defect open: mid-word clipping of an
  UNIDENTIFIED sibling renderer (`thinker-spawn│`, `(handled│`). Round 2
  delivered the Thinking chrome conversion but did not triage the clipping
  renderer. Next step: identify that renderer + its width source.
- **FID-2026-0822-007** — hex-hardcoding cleanup (13 files/27 sites,
  analyzed, ready to implement). ⚠️ Concurrent session filed a DUPLICATE
  `-007-holographic-command-deck.md` — same-date number collision needs
  operator arbitration (rename one side).
- **CompactionSignal parity** — carried from -006; needs a natural compaction
  event observed live.
- **Sidebar overlap** — `Context nous/ste77.7k/1048.6k` Model/Context row
  collision once Mode=HYBRID renders (fid-011-smoke s9/s10/s12). Needs its
  own FID.
- **`sixteen.` tail-loss** — repro vs raw tool args owned in -009 closure.
- reminder.-border row — triaged mid-stream transient; monitor next live pass.

## New FIDs filed this session

- FID-2026-0822-007 (hex cleanup, analyzed) · FID-2026-0822-009 (closed) ·
  FID-2026-0822-010 (created, open) · FID-2026-0822-011 (fixed, active).

## Verification status at close

- cli typecheck exit 0; eslint --max-warnings 0 on all changed files;
  focused suites green (38/0 round 1, 18/0 + 10/0 + 14/0 + 6/0 subsequent).
- `lint:md` exit 0 repo-wide.
- Live TUI verified @90 cols across four WSL tmux sessions (captures under
  `dev/scratchpad/fid-006-smoke/`, `fid-009-smoke/`, `fid-011-smoke/`).

## Infra lessons for the next session

- Drive tmux via `wsl -e tmux ...` with `MSYS_NO_PATHCONV=1`; Git Bash has no
  tmux and mangles /mnt paths otherwise.
- TUI runs altscreen: walk history with the app's PageUp; `capture-pane -S`
  returns only the last screenful. Plain `-p` captures can show merged-glyph
  artifacts absent from `-e` — cross-check before filing renderer bugs.
- send-keys usually needs Enter twice (~2s apart). Completion detection:
  marker text visible AND worker spinner gone (md5 stability false-positives
  mid-run — timer line re-renders lazily).
- zustand v5 serves getInitialState() under react-dom/server: component tests
  need the capture-and-swap mock.module pattern (see
  cli/src/components/__tests__/compaction-signal.test.tsx).
- apply_patch delete_file intermittently double-wraps its discriminator;
  basher relay drops output silently — ground-truth every mutation with
  run_readonly_command (wsl rm fallback proven).
