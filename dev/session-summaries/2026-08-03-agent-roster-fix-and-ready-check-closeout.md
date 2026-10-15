# Session Summary — 2026-08-03 Agent Roster Fix + Release Ready-Check (FID-2026-0803-013)

**FID:** FID-2026-0803-013 (agent roster over-reporting — 1 LOW finding)
**Status:** Verified + archived
**Signed:** Savant

## What was done

### Agent roster over-reporting fix (FID-2026-0803-013)

- **Root cause:** The Savant orchestrator reported 13 spawnable agents when asked
  "what's the roster?". The main-agent instructions prompt auto-appends a
  functional spawn list (`strings.ts` — "You can spawn the following agents:")
  built from the 13-entry `spawnableAgents` allowlist (9 core + `basher`,
  `tmux-cli`, `browser-use`, `context-pruner` infrastructure + `researcher-web`/
  `researcher-docs` as two entries), and the system prompt contained no
  canonical roster definition — so the model parroted the spawn list back.
- **Fix:** Added an explicit `# Agent Roster` section to the Savant default
  system prompt (`agents/savant/savant.ts`, `buildDefaultSystemPrompt`):
  - The 9 canonical ECHO roles with `# / Agent / Phase / Responsibility`
    columns matching ARCHITECTURE.md (Savant/Orchestrator, Detective, Forge,
    Verifier, Thinker, Scout, Researcher, Recorder, Scribe).
  - An "Important distinction" subsection naming `researcher-web`/`researcher-docs`
    as the single Researcher role's tool libraries and `basher`/`tmux-cli`/
    `browser-use`/`context-pruner` as infrastructure helpers (spawnable but NOT
    roster members).
  - Explicit instruction: "When asked about the agent roster, report only the 9
    roles listed above."
- **Deliberately unchanged:** `spawnableAgents` allowlist (13 — functionally
  correct; removing infrastructure would break spawning) and the `strings.ts`
  addendum (the functional "what can I spawn" list). Operator later supplied the
  exact canonical roster content (ARCHITECTURE.md table format + helpers
  subsection), which replaced the initial simpler table; FID amendment recorded.

### Sibling agent audit (thinker, detective, forge, verifier + scout/scribe/recorder/researcher)

- **Clean — zero findings.** All 8 specialists have `spawnableAgents: []`, so
  the "You can spawn the following agents:" addendum never renders for them
  (structurally immune to roster over-reporting). Their prompts correctly
  forbid spawning ("Do NOT spawn other agents", "you are the editor agent").
- `base-chat.ts` (2 spawnables: `researcher-web`, `thinker-gemini`) and
  `editor-multi-prompt.ts` (3 spawnables: best-of-N editor helpers) are
  exactly-scoped and self-describing; all spawnable IDs verified to exist on
  disk (Law 4). No roster framing, no confusion.
- `thinker.ts` embeds `ECHO_PROTOCOL_INSTRUCTIONS` but the constant contains no
  roster enumeration — only role references in passing. No action needed.

### Release ready-check (full-session QC sweep)

- **Typecheck ×4** (sdk/common/agent-runtime/cli): all exit 0.
- **Test suites:** sdk 431 pass / 0 fail, common 521 pass / 0 fail,
  agent-runtime 583 pass / 0 fail.
- **ESLint** `--max-warnings 0`: clean. **`lint:md`**: exit 0.
- **Version:** 0.0.16 consistent across VERSION + root/sdk/cli manifests.
- **Open FIDs:** zero. **Eval:** baseline 4/4 PASS tracked in
  `docs/reports/savant-code-benchmark-v2-2026-08-03.md`.
- **Loose ends closed this pass:** FID-013 CHANGELOG Verification bullet added
  (the only FID missing one); FID-008 identified as a benign numbering gap
  (never committed — CHANGELOG correctly skips 007→009); savant-free
  `0.0.123` npm-track version confirmed intentional (separate release track).

## Verification

- agents typecheck exit 0; CLI typecheck exit 0 (bundle regenerated via
  `prebuild:agents`, embeds the roster); agent-runtime strings template suite
  11/11 pass; ESLint `--max-warnings 0` on changed files; `bun run lint:md`
  exit 0; forbidden-name sweep clean (Savant only). Independent AUDIT via
  code-reviewer: clean.

## Lifecycle

FID-2026-0803-013 → verified + archived. CHANGELOG v0.0.16 Added + Verification
entries present. Ready to ship as part of the v0.0.16 full release.
