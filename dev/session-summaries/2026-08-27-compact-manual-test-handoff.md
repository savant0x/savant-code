# Handoff — Manual /compact Live Test (2026-08-27)

**Operator took over the live test.** This handoff lets a fresh session resume
or guide the manual `/compact` verification (FIDs -0821-001, -0822-001,
-0823-006, -0824-021, all archived — this is the live-TUI confirmation step).

## Repo state

- `main` clean at `f1388f67` (`chore(models): migrate stealth/ox-alpha to
  z-ai/glm-5.3-flash`). Tree-drain (27 commits) + gates green done earlier.
- All gates pass: typecheck ×12, tests, eslint, lint:md, prettier, protocol
  bundle, fid:verify, evals:smoke.

## What /compact does (code map)

- `cli/src/commands/defs/chat.ts` → `/compact` handler sends the **literal
  "/compact" prompt**; the savant interceptor force-spawns the context-pruner,
  which compact-and-stops.
- Pruner pipeline: `agents/context-pruner/` (`main.ts`, `summary-assembly.ts`,
  `structured-summary.ts`, `result-digests.ts` …). Ends with `set_messages` —
  transcript is replaced with a summary block + preserved recent tail.
- **Summary marker**: `SUMMARY_HEADER` in
  `agents/context-pruner/constants.ts`:
  `"This is a summary of the conversation so far. The original messages have
  been condensed to save context space."`
- **UI lifecycle**: `cli/src/components/compaction-signal.tsx` — phases
  `⚙ Compacting context…` → `✓` completion / `⛔ blocked`; sidebar shows
  token count + compaction count.

## Test findings so far (critical)

1. **OpenRouter account is out of credits** — 402 `"can only afford 2040
   tokens"` on any openrouter model. Do NOT test via openrouter.
2. **`z-ai/glm-5.3-flash` id is valid** — OpenRouter accepted the id (error
   was credits, not model-not-found). Migration is API-valid.
3. **Prod config fixed**: `~/.savant-code/settings.json` had
   `"savantCodeModelPreference": "stealth/ox-alpha"` → updated to
   `z-ai/glm-5.3-flash` (dev mode uses `~/.savant-code-dev` — untouched).
4. **Working providers (env)**: `TOKENHARBOR_API_KEY` and `NVIDIA_API_KEY`
   set. Operator runs **tokenharbor deepseek-v4-flash:free**; the dev
   settings model is `nvidia/deepseek-ai/deepseek-v4-pro-0813` (nvidia).
5. **Bun Windows pty does not set `isTTY`** on the child's stdin → the CLI
   falls into headless `--print` dispatch (empty-prompt run → EHEL block /
   model call at "boot" — the boot model-call mystery is explained).
   **Fix**: `dev/scratchpad/cli-shim.ts` fakes `isTTY` before importing
   `cli/src/index.tsx` — verified: full TUI boot screen renders through the
   pty (`One Mind. A Thousand Faces.` + `Enter a coding task`).
6. **ECHO gate**: the savant agent's EHEL blocks tool use until ECHO.md is
   read 0-EOF → the workspace must contain `ECHO.md` (driver copies the repo
   copy into the scratch ws).
7. **TUI slash-autocomplete swallows fast typed input** — typing
   `/model <id>` as one blob opens the suggestion menu and the Enter is
   eaten. For automated runs, pre-seed the model in the disposable config
   (same field `/model` writes: `savantCodeModelPreference`).
8. **Config auto-resume landmine**: cloning a config dir that contains
   `message-history.json`/`projects/` makes the CLI auto-resume the last
   session at boot. Test configs must be minimal (settings + credentials).

## Scratch test driver (gitignored — safe)

- `dev/scratchpad/manual-compact-test.ts` — pty driver: boots via shim →
  seeds `List the files in this workspace and name each one.` → sends
  `/compact` → asserts `summary of the conversation so far` appears.
- Model seed line (one edit): `settings.savantCodeModelPreference` in the
  driver — currently `tokenharbor/deepseek-v4-flash:free`. Swap to
  `nvidia/deepseek-ai/deepseek-v4-pro-0813` + provider `nvidia` to match the
  operator's nvidia variant.
- Run: `cd cli && bun ../dev/scratchpad/manual-compact-test.ts`
  (note: not `bun run`, and pass the absolute path from `cli/`).

## Manual test checklist (operator's live session)

1. Open the CLI in a scratch workspace containing `ECHO.md` + 2-3 files.
2. Select model via `/model` — `tokenharbor/deepseek-v4-flash:free` or the
   nvidia deepseek v4 id.
3. Seed: "List the files in this workspace and name each one." (tool-call
   material for the pruner).
4. Run `/compact`. Verify:
   - `⚙ Compacting context…` lifecycle line appears;
   - the transcript is replaced by a summary block beginning with the
     `SUMMARY_HEADER` text;
   - a preserved recent tail follows the summary (no invisible dataloss —
     FID-2026-0824-021);
   - sidebar compaction counter/token readout updates.
5. Report PASS/FAIL against those four checks.

## Cleanup notes

- Kill stray test CLIs:

```powershell
powershell -Command "Get-CimInstance Win32_Process -Filter \"Name='bun.exe'\" |
  Where-Object { $_.CommandLine -match 'cli-shim' } |
ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
```

- `dev/scratchpad/*.ts` are gitignored; the driver's tmp dirs live under
  `%TEMP%/savant-compact-*` and `%TEMP%/savant-ptyprobe`.
