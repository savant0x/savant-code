# Session Summary — 2026-08-28: Compaction summary output + v0.0.28 release prep

## Part 1 — FID-2026-0828-001 (compaction summary output)

Operator reported from the 2026-08-27 manual `/compact` live test: no end-of-turn
summary fired, and the sidebar window readout reset. RED investigation established:

1. **Mirror race (structural):** manual `/compact` is compact-and-stop
   (`handle-steps-factory.ts` returns immediately after the pruner spawn); the
   terminal `pruned` phase + `lastCompactionReport` are written to parent agent
   state milliseconds before the run resolves, the SDK snapshots on a 5s interval,
   the CLI mirrors terminal compaction state only via the 2s heartbeat while the
   run is alive, and `adoptAndPersist` mirrored only `contextTokenCount` — the
   terminal state was dropped on the floor for every compact-and-stop run.
2. **Summary capture orphaned:** the pruner's streamed summary has been captured
   into `prunerSummaryBuffer` (FID-2026-0824-023) but never delivered to the turn
   transcript.
3. **Reference pattern:** OpenClaw (`resources/openclaw`) delivers phase notices +
   the post-compact summary as dedicated `isCompactionNotice` payloads and the run
   proceeds; Hermes' `/compact` (alias of `/compress`) is a session-compress
   command with no summary UX.

Operator decisions (ask_user 2026-08-28): manual `/compact` **stops after the
summary** (the summary IS the turn's output); auto-compact emits the **same block
mid-turn and proceeds** (OpenClaw parity). FID-2026-0828-001 authored, Perfection
Loop converged (3 loops), presented, **operator-approved**, implemented:

- `compaction_summary` PrintModeEvent schema (`common/src/types/print-mode.ts:265`)
  + union membership (`:297`).
- Runtime emission at the pruner completion boundary
  (`spawn-agent-inline.ts:363-374`) — same excerpt as `lastCompactionReport`
  (single source of truth); fires only for real compactions (`removedMessages > 0`)
  with a non-empty summary; fold no-ops and summary-less completions stay silent;
  emission strictly precedes run resolution (works for compact-and-stop AND
  mid-turn).
- `adoptAndPersist` terminal-state mirror (`send-message-lifecycle.ts:209-224`) —
  closes the race; the `compacting → pruned` transition, counter, and panel excerpt
  now land for every run shape.
- `CompactionSummaryContentBlock` (`cli/src/types/chat.ts:123-133`) + event dispatch
  (`sdk-event-handlers.ts:101`) + `handleCompactionSummary` append (`misc.ts:47-73`)
  + `CompactionSummaryBlock` rendering through the shared TrafficLightPanel chrome
  (`compaction-summary-block.tsx`, dispatched from `single-block.tsx:142`).

Gates: typecheck common/agent-runtime/cli exit 0 · 21 focused tests 0 fail ·
agent-runtime suite 1319/0 · cli suite 1358 pass / 11 skip / 0 fail (canonical
`bun run --cwd=cli test`) · eslint `--max-warnings 0` on 13 touched files ·
prettier clean · `lint:md` clean · `fid:verify --check` sweep PASS · receipt
stamped 7/7 declared gates live PASS. Status `fixed`. Closure waits on the
committed hash (G2) + the operator live smoke (`docs/handodd.md` checklist).

## Part 2 — Task 13 resumption (v0.0.28 release prep)

- **H-A1 clean baseline:** typecheck ×12 exit 0 · root test chain (11 workspaces)
  exit 0, 0 fail · `eslint . --max-warnings 0` exit 0 · `prettier --check .`
  exit 0 · `lint:md` exit 0 · `fid:verify --check` PASS.
- **H-A2 FID reconcile:** two-way check — all 14 on-disk active FIDs (13 + new
  -0828-001) have active-table rows; no stale rows; -0820-009/-010, -0823-004,
  -0827-001 confirmed in `dev/fids/archive/`.
- **H-A3 master manifests:** -0820-007 and -0823-003 `analyzed` on disk matching
  the table; -0820-011 shelved `analyzed` is -0820-007's sole open blocker; no
  drift.
- **H-B1 version bump:** `bun run scripts/bump-version.ts 0.0.28 --docs` — VERSION
  + 18 enforced surfaces, lockfile synced + frozen-verified, protocol bundle
  regenerated, doc surfaces updated; `--check` PASS.
- **H-A4:** CHANGELOG v0.0.28 release section written (delta highlights since
  v0.0.27); this session summary written.

Remaining at handoff: H-B2 full release battery re-run on the bumped tree
(typecheck ×12 + test chain + eslint + prettier + lint:md + fid:verify), H-B3
path-scoped staging plan (operator executes per G1), H-B4 release plan
presentation (public-release.ts is operator-gated).

## Addendum — H-B2 completed (2026-08-28)

- On the bumped tree: typecheck ×12 exit 0 · root test chain exit 0 (0 fail) ·
  `eslint . --max-warnings 0` exit 0 · `prettier --check .` exit 0 · `lint:md`
  exit 0 · `fid:verify --check` PASS · `bun run build:sdk` exit 0 (dist ESM/CJS
  + types).
- `bun run ci` full run failed ONLY in `build:savant-free` — the release-env
  placeholder policy requires release placeholders
  (`pk_release_placeholder`, `https://savant-code.com/portal`,
  `release_placeholder`) while the environment carries dev placeholders.
  **Operator-directed skip:** SavantFree is unreleased — its artifact build is
  not a v0.0.28 gate; the release-env policy is release-time work owned by the
  -0820-011 shelved packaging checklist.
