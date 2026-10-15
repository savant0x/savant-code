# Adoption wiring: every uncalled module gains a production caller (T152 / `FID-2026-1006-003`)

**Date:** 2026-10-06 · **Scope:** T152 (operator request, verbatim: "make a fid to fully
wire all of those that have no caller, if the code is there then the feature is not
complete? also this '...WP5... WP7/WP8... WP11... WP6...', i want everything completed")
**Nature:** Implementation session. Six wiring work packages implemented, verified and
closed; the FID is archived.

## What was done

`FID-2026-1006-002` closed six deliverables as "module + tests" and reported "no
production call path yet" as a *stated limitation*. The operator ruled that a
delivered-but-uncalled module is not a complete feature, and this session wired each one
to the seam that already existed for its data — not to a synthetic caller:

- **WP1 — the compaction cut plan reaches the pruner.** `planCompactionCut` is computed
  at the step boundary onto `agentState.compactionCutPlan`; the runtime forwards it as a
  spawn param and the serialized pruner honours `cutWindowStart`. The cut never lands on
  a tool result, and an over-budget boundary turn splits into two summaries that merge.
- **WP2 — the cumulative file ledger folds across successive compactions.** It folds
  behind a watermark and merges into the pruner's preserved file state, so repeated
  compaction does not lose files touched in earlier windows.
- **WP3 — the loop guard rails gate every step iteration.** `evaluateLoopGuard` runs per
  iteration; the stale-cycle, per-role-budget and iteration-cap rails are live; and the
  stop reason is *named* on `AgentState.loopStopReason` instead of inferred.
- **WP4 — preset validation has a production caller.** The orchestration preset moved
  into `protocol.config.yaml` as a declaration and `validatePreset` runs during config
  parse; error-severity issues fail the repo gate.
- **WP5 — the entry-class writers run on the CLI save path.** Model-change,
  steering-override (`custom`) and compaction-`label` entries are written by the save
  path, and a resumed chat loads only in-context rows via `getInContextMessages`.
- **WP6 — a chat switch that abandons a mid-turn run leaves a branch summary.** The
  navigation-away abort renders and persists it.

## Defects found and fixed during verification

1. **A hand-rolled config loader mis-read the repository's own formatted YAML.** Prettier
   wraps long list values across lines, and the orchestration parser silently read them
   as empty lists until a repo-gate test over the real file caught it (fix `988a2a66`).
2. **A quality-gate extraction left its census pin behind.** Moving the terminal-hook
   call out of `loop.ts` into `run-agent-step/loop/setup-cancelled.ts` failed
   FID-2026-0919-031's caller census until the pinned list named the new site — the pin
   existed precisely to catch wiring that moved or vanished.
3. **Three files crossed the 300-line quality ceiling.** They were split into cohesive
   modules rather than exempted (`ed0ceaa3`, `6dadbd31`, `6d5fbe48`).

## Verification evidence

- `bun run fid:verify dev/fids/archive/FID-2026-1006-003-wire-uncalled-adoption-modules.md --write`
  → **19/19 gates PASS**, receipt
  `fingerprint: sha256:ae0aacee30e602dbad18345c40dcb911fd83585b2d7082dbaf3b7593a168d330`
  (4 workspace typechecks + 15 named test paths, six of them wiring suites that assert
  the *caller*).
- `bun run typecheck` (13 workspaces + the scripts tree) exit 0;
  `bun x eslint . --max-warnings 0` exit 0.
- `bun run lint:md` exit 0; `bun run quality:report` → `quality: PASS`;
  `bun run validate:repository` → `validation: PASS`.
- `cd sdk && bun test src/` → 592 pass / 1 skip / 0 fail. `cd packages/agent-runtime &&
  bun test` → normalized fail-list identical to the pre-existing 76-failure baseline
  (zero new failures).
- Law 4 production greps for all six seams are pasted under
  `### Code Verification Evidence` in the archived record.

## Recorded deviations and forks

- `readProtocolConfig` calls the preset parser directly (no wrapper section), and
  validation runs *after* the config try/catch so an invalid preset is never swallowed
  by the loader's error path.
- No `DEFAULT_ORCHESTRATION` fallback was added, so exact-object config assertions stay
  valid.
- `thinking_level_change` is derived from an effective reasoning-level change; the fork
  has no dedicated thinking-level setting. The record states the derivation rather than
  implying a setting that does not exist.

## Closure

Status `converged` → `closed`; the record moved to `dev/fids/archive/` (the active queue
is empty). `CHANGELOG.md` carries the entry with the gate result, and `SCOPE.md` T152 is
marked completed with the evidence above. Six implementation commits landed locally
(`d08b7a62`, `e9bd8c81`, `927a4eb0`, `286598c0`, `0238547a`) alongside the parser fix
(`988a2a66`) and the three quality-gate extractions — no push, tag or release.

## Continuation note

The implementation session ended immediately after the `SCOPE.md` closeout edits — its
last recorded action was listing `dev/session-summaries/` to choose this file's name.
This summary, the five lessons routed into `dev/LEARNINGS.md` and the closure commit
were completed by the resumed session against the same worktree, with no source change
in between.

## Path-scoped staging plan

The record's own closure artifacts ride together in one path-scoped commit:

- `CHANGELOG.md`, `SCOPE.md`
- `dev/fids/archive/FID-2026-1006-003-wire-uncalled-adoption-modules.md` (moved from `dev/fids/`)
- `dev/session-summaries/2026-10-06-uncalled-module-wiring.md`
- `dev/LEARNINGS.md`, `dev/LEARNING-RULES.md` (the record's five lessons in governed
  space, plus their canonical-rule catalog entries)

Suggested message: `docs(fids): record the FID-2026-1006-003 closure (FID-2026-1006-003)`