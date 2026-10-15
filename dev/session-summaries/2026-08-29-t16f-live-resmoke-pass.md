# T16-F Live Re-Smoke — PASS (agent-run via CDP, 2026-08-29 ~20:30–20:45 EDT)

**Method:** launched the real desktop app (`savant-desktop.exe` debug build
2026-08-28) with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223`,
against the vite dev server (`bun run dev:renderer`, port 1420, fresh `dist/`
build 2026-08-29 20:28 containing all defect A/B/C fixes). Drove the webview
over the Chrome DevTools Protocol with scratchpad scripts
(`dev/scratchpad/deck-smoke.cjs`, `deck-shot-diff.cjs`, `deck-run-smoke.cjs`,
`deck-final-sample.cjs`, `pixel-diff.cjs` — gitignored scratchpad).

**Evidence:**

1. **Webview healthy:** after CDP `Page.navigate` to `http://localhost:1420/`
   (the debug exe had loaded a dead-port error page because the vite dev
   server wasn't running yet): `reducedMotion:false`, 1 WebGL canvas,
   buttons `["Projectdesktop","Deck","Chat"]`.
2. **rAF ticker running:** 37–38 frames per 600 ms ≈ ~62 fps, measured both
   before and after switching to the Deck view. The ticker is NOT parked.
3. **Full GLB cast mounted:** console shows `[deck] mount <role>: glb` for all
   10 roles (savant, detective, forge, verifier, recorder, thinker, scout,
   researcher, scribe, adversary) — no fallback silhouettes.
4. **Scene actually animates (pixel evidence):** full-window screenshots
   (2560×1369, 3,504,640 px):
   - idle pair 1.5 s apart: **0.42%** pixels changed (14,775 px)
   - idle pair 3 s apart: 5.29% changed
   - during active run, pairs 4 s apart: **11.11%** and **45.92%** changed
   A frozen deck diffs 0.00%. Saved `C:/tmp/deck-frame-{1,2}.png`,
   `C:/tmp/deck-run-{1,2,3}.png`, `C:/tmp/deck-final-{1,2}.png`.
5. **Live chat → deck pipe works end-to-end:** typed a real prompt via CDP,
   sent it, switched to Deck. `[deck] batch:` lines streamed:
   - `batch: 3 events | savant=on | walkers=0 active/0 total | tools=0`
   - `batch: 2 events | savant=on | walkers=1 active/1 total | tools=1 in-flight`
   - `batch: 5/2/5 events | walkers=1 active/1 total | pulse=2→3→4`
   → events flow chat → gateway → live driver → FloorState; a walker went
   active with a tool in flight and pulses fired across the run.

**Verdict:** T16-F **PASS** — motes, spinners, and robots animate on the live
deck during an active run. The reduced-motion ticker park (defect A) is gone.

**Caveats (honest):** agent-run via CDP against the debug exe + vite dev
server (not the packaged build); the pixel diffs + `[deck] batch:` telemetry
are objective, but an operator eyeball of the packaged build remains the gold
standard. T17-F (role accents read distinctly) and T18-C (chest-height
nameplates) were code-verified with green gates this session but not visually
confirmed in this smoke — same carried boundary.

**Run artifacts:** `C:/tmp/deck-*.png`; probe scripts
`dev/scratchpad/deck-smoke.cjs`, `deck-shot-diff.cjs`, `deck-run-smoke.cjs`,
`deck-final-sample.cjs`, `pixel-diff.cjs` (gitignored scratchpad). App + vite
dev server shut down cleanly after the run.
