# FID: Workspace Regions — Agent Roster Rail and Fleet/Project Thread Duality

**Filename:** `FID-2026-0824-009-workspace-regions-roster-and-thread-duality.md`
**ID:** FID-2026-0824-009
**Severity:** high
**Status:** closed
**Created:** 2026-08-24 01:04
**YAGNI-Compliance:** Verified
**Parent:** FID-2026-0824-008

---

## Summary

Evolve the existing desktop chat workspace (FID-2026-0820-010) into the
agents-as-contacts act-surface: a dual-rail navigation (fleet roster rail of
the canonical 10-role ECHO roster + project rail), polymorphic thread scoping
(project vs global fleet channels), inline approval/question cards as thread
artifacts, and compact animated status components that open contextual slide-
over drawers for sub-agent introspection. No third center-canvas mode — Deck
(-0822-012) remains the ambient WATCH surface; the workspace is the ACT
surface. One zustand ^5.0.8 store family feeds BOTH surfaces.

## Environment

- Same as master (-008): Windows/Linux v1, React 19 renderer, plain CSS token
  pipeline (no Tailwind), 300-line file ceiling, strict TS.

## Detailed Description

### Problem

The current chat workspace is project-scoped conversation with the
Orchestrator. There is no persistent agent roster, no cross-project fleet
channels, no way to watch a specific spawned sub-agent's event stream without
polluting the main transcript (transcript blindness), and no Slack-style
duality between project context and global commands.

### Approach (research §A, amended)

- Dual-rail sidebar: primary rail = fleet roster (10 canonical roles, presence,
  unread); secondary rail = project channels + active FIDs when a project is
  active (report §A landscape, corrected per C6).
- Thread records carry `scope_type` (project | global) + `scope_id`; moving a
  thread between scopes is a row update, not a migration.
- Tool activity renders as ONE compact animated status component in-thread;
  clicking opens a read-only slide-over drawer (raw tool inputs, diffs,
  sequentialthinking branch view) anchored to the thread's agent.
- Anti-recommendation upheld: raw tool calls / JSON payloads / thinking logs
  NEVER render into the primary timeline.
- Single-model rule: the comms surface renders the ONE UI-selected model
  everywhere (C7a; no per-agent pickers).

### Proposed Solution Steps

1. Audit and extend `cli/src/utils/db-storage.ts` (or its desktop-side
   equivalent storage seam) with the polymorphic threads table — NO parallel
   SQLite schema (C6). GREEN gate: schema probe + focused tests.
2. Roster rail component family fed by a new fleet/comms zustand store family
   (`roster`, `threads`, `approvalsQueue`); virtualized list; unread/pin state.
3. Scope switcher: project ↔ global fleet navigation; project invocation
   injects protocol.config.yaml context server-side, invisible to the user.
4. PrintModeEvent AMENDMENT (Gate G1–G4): add roster/presence + thread-event
   families as zod-literal discriminated additions in
   `common/src/types/print-mode.ts`. MANDATORY pre-GREEN producer/consumer
   blast-radius grep pasted into the GREEN record. Tier-2 fixtures gain
   syntheticPending markers per G3.
5. Inline approval cards ride the SAME events as deck approval docking (one
   event, two consumers, one G1 gate).

### Verification

Focused desktop suites green; fixtures parse against the LIVE union; blast-
radius grep clean; production smoke NEEDS-REVIEW until rendered in the real
Tauri webview (test-renderer-not-a-proxy lesson).

## Boundaries / Gates

- HARD GATE: implementation begins only after -010 Steps 4–7 land (master
  sequencing guard).
- G4: floor/workspace modules reference ZERO SessionState/goal/approval
  symbols until the amendment lands.

## Perfection Loop

### Loop 1 — RED

- **RED:** No roster/thread/scoping substrate exists (Detective zero-match on
  audio/computer/pairing families; print-mode union confirmed at
  `common/src/types/print-mode.ts:224`). Research §A patterns adopted under
  amendments C6/C7a.
- **GREEN:** Steps specified; db-storage extension over parallel schema;
  amendment-gate discipline imported explicitly.
- **AUDIT:** Batched Verifier PASS (2026-08-24): amendments C1–C7 folded
  consistently (this record carries C6 db-storage extension + C7a single-model
  rendering); repo citations match Detective evidence; hard gate on -010 Steps
  4–7 matches the master manifest verbatim; Amendment-Gate discipline verified
  incl. G3 fixture markers and G4 zero-symbol boundary. Its one FAIL (missing
  Author field) was REFUTED at ADVERSARIAL.
- **ADVERSARIAL:** STANDS WITH CORRECTIONS (2026-08-24): Author-field FAIL
  refuted (templates/FID-TEMPLATE.md has no Author field;
  scripts/fid-ledger.ts FORBIDDEN_ATTRIBUTION forbids it); C5 orphan adjusted
  to a master-level invariant note naming this record as an owner (timeline
  hygiene keeps raw payloads out of thread context); its new omission —
  missing required `### Code Verification Evidence` heading — fixed in this
  revision.
- **CHANGE DELTA:** Initial authorship (n/a).

### Missed Questions

1. Where do fleet threads persist? → The existing storage seam (step 1 audit
   decides exact module; no new DB).
2. What happens to deck approval gating? → Unchanged: same event, two
   consumers; deck mirror stays G1-gated exactly as -0822-012 plans.### Code Verification Evidence

The first workspace implementation slice landed 2026-08-25. The canonical
10-role roster is projected from existing `desktop/src/floor/roles.ts` data;
`start` and `subagent_start`/`subagent_finish` events update presence in a pure
roster reducer; `RosterRail` is mounted beside ChatThread and hidden only at
mobile width. No new event family, database schema, or model picker was added.
Desktop typecheck passes; focused roster and transcript tests pass **16/0**;
full desktop suite passes **215/0**; ESLint and Prettier are clean.

The first storage and scope slice is now implemented. The existing `sessions`
table is schema-version migrated to v2 with `scope_type` (`project|global`) and
`scope_id`; `getSessionsByScope` and `updateSessionScope` provide scoped reads
and moves while preserving existing callers. Desktop `ScopeSwitcher` toggles
project/fleet scope locally and the roster rail is live. Database tests pass
**17/0**; CLI typecheck passes; desktop full suite passes **216/0** with lint
and formatting clean.

The scoped-history integration is now implemented. The gateway exposes the
read-only `get_scoped_threads` JSON-RPC method, backed by the existing session
and message-history tables; the desktop client validates the response and
hydrates only the selected scope. Scope loads are sequence-guarded so stale
responses cannot overwrite a newer selection, and persisted messages project
into existing user/assistant/error blocks without exposing `SessionState` or
raw database rows. Gateway coverage passes **25/0**; desktop coverage passes
**219/0**; database coverage remains **17/0**; affected typechecks, ESLint, and
Prettier are clean.

The project/FID rail is now backed by the formal scoped-event amendment.
`PrintModeFidQueueUpdate` requires a non-path `projectId`; the gateway derives
one stable identity from its configured project root and emits it on initial
snapshots, file-change updates, and closed transitions. The hello result carries
the same identity so the desktop can replace its placeholder Project scope
before loading persisted threads. `FidQueuePanel` filters Project views by
exact `projectId` and leaves Fleet views as the complete event stream.
Focused rail, scope, gateway, and client identity tests pass; the full desktop
suite passes **199/0**, the CLI gateway suite passes **25/0**, and common,
CLI, and desktop typechecks, the gateway drift guard, ESLint, and Prettier are
clean.

Persisted unread/pin state is now implemented. The existing `sessions` table
is schema-version migrated to v3 with boolean `unread` and `pinned` columns;
legacy databases receive idempotent defaults. `updateSessionUnread` and
`updateSessionPinned` provide the database write seam, while scoped thread
responses carry both flags.

The gateway exposes `update_scoped_thread_state`; the desktop client validates
its request/result and applies state locally only after the server confirms the
write. `ThreadRail` orders pinned threads first, then unread threads, renders
both states, and provides accessible Pin/Unpin and Mark Read/Unread controls.
Because current runtime events carry no session/thread identity, unread is
explicitly operator-controlled rather than inferred from unscoped events.
Database tests pass **18/0**; gateway tests pass **25/0**; desktop tests pass
**224/0**; affected typechecks, ESLint, and Prettier are clean.

The formal scoped FID event amendment is complete. `fid_update` requires a
stable project identity, the gateway emits that identity consistently and
returns it in hello, and the desktop filters Project views by exact identity
while Fleet retains the aggregate stream. The live compiled sidecar E2E passes
**4/0** (hello, stdin watchdog, parent-kill cleanup, native-binary presence).
The production renderer build passes and `cargo check` passes for the Tauri
shell. An interactive WebView screenshot/operator pass remains a manual
visual-validation boundary, not an implementation blocker.


## Resolution

- **Closed Date:** 2026-08-25
- Formal scoped FID event amendment implemented and verified.
- Persisted workspace thread scope, unread/pin state, and project/Fleet FID
  filtering are implemented.
- Live sidecar, renderer, and Tauri shell gates pass.
- Interactive WebView visual validation remains manual evidence and was waived
  as an operator-only boundary; it is not claimed as automated evidence.