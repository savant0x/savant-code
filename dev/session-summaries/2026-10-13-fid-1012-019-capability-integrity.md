# FID-2026-1012-019 — capability integrity (2026-10-13)

**Status:** implemented, `fixed` (receipt stamped, 7/7 gates PASS live). **Program of record:**
`dev/fids/FID-2026-1012-022` (`### Work order` + `### Status board`); this pass worked wave **A1**,
record `-019`. Nothing is pushed; local commits only.

## What landed

- `common/src/util/capability-notice.ts` (new) — the shared degradation contract: a notice names the
  capability, states **unavailable** / **did not complete** in a stable first clause, carries the
  measured reason, the one resolving action and what the result is *not* evidence of. Plus a bounded
  once-per-scope claim log (clears wholesale on overflow, so nothing in a long-lived process grows).
- `packages/agent-runtime/src/llm-api/research-notice.ts` (new) — the `web_search` exhaustion notice,
  built from the selector's observed state (which keys exist; which providers ran and returned nothing).
  `research-sources.ts` therefore reports a **named degradation instead of an empty result**, and stayed
  inside the 300-line ceiling by extracting it (296 lines).
- `packages/agent-runtime/src/tools/handlers/tool/web-search.ts` — every failure is still an error; only
  the repeated advice is dropped, via a bounded per-run notice log keyed by session.
- `sdk/src/tools/code-search/flags.ts` — structural guard: a model-supplied `--` (the caller appends its
  own before the pattern) and a trailing value-taking flag with no value are dropped with a warning, so
  neither can silently change the search.
- `common/src/util/experience-classes.ts` — the new research lead maps to the existing
  `research-unavailable` cause, and the legacy pattern stays, so the 24 recorded rows keep their identity
  instead of splitting into a new class.

Gates: `common` 866/0 · `sdk` 670/0 · `agent-runtime` 2,066/0 · typechecks ×3 exit 0 ·
`quality:report` PASS · `validate:repository` PASS · `fid:verify --check` PASS · ESLint + Prettier +
`lint:md` clean. RED re-measured at `64ea8c06`: 563 records / 56 stable classes; this lane's three
classes live and **unstopped** (24/7 `research-unavailable`, 17/8 `search-executable-missing`, 7/4
`search-incomplete`). No class claim and no `fix-boundaries.json` entry — the 14-day window has not
started.

## Findings raised, not parked

- **The `search-executable-missing` class is the host's, established rather than assumed.** The recorded
  text (`… Vendored ripgrep not found; ensure @codebuff/sdk is up-to-date or set CODEBUFF_RG_PATH`)
  exists nowhere in this repository; savant's own spawn failure names `SAVANT_CODE_RG_PATH` and the
  workspace-correct repair (`sdk/src/tools/code-search/executor.ts:268`,
  `sdk/src/native/ripgrep.ts:204-215`). The class stays a census row but its cause is the host bundle.
- **A timeout record landed *after* the `-023` fix** (`2026-10-13T03:10:27.155Z`, `run_readonly_command`)
  carrying the new actionable contract text with `expectedness: undetermined`. The class changed shape
  without leaving — separating a legitimate ceiling timeout from a defect is `-024`'s classification
  gap, not a new lane. Recorded in `-023`, `-022`'s findings list and this pass.
- **Environment, not savant:** two probe commands failed here with `head: command not found` (Git Bash
  PATH) — the same shape that produced a `command-exit` capture row on 2026-10-13T02:42Z. Prefer `sed`
  in this shell; it is a host condition, not a repository defect.
- **SCOPE register, corrected in-pass again:** the `-019` write-surface line did not cover
  `common/src/util/**` or `sdk/src/tools/code-search/**`. Both were added with the work. As noted for
  `-018`, the register template should name each lane's shared utility and test surfaces up front so
  every lane stops re-deriving them.

## Still open

1. **Run-start capability preflight (plan step 7)** — deliberately not built unowned: it needs a
   prompt-time consumer, and the half that landed is the once-per-run dedupe, which neither denies
   unused capabilities nor blocks human work.
2. **Observation windows** for `-019`, `-018` and `-023` alike — real sessions over 14 days, then the
   lesson, then the class claim.
3. **Wave A1 remainder:** `-020` (edit-path friction), then `-021` (the recurrence-to-fix machinery).
