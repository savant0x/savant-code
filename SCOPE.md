# SCOPE — Open Work Register

This register contains active work and its machine-readable write targets.
Remove completed items and grants at closure. Evidence belongs in archived
FIDs, the changelog and session summaries. Historical register/disposition
records are preserved in the `dev/tracking/scope-history-*.md` snapshots; a
snapshot grants no current write authority.

Automation levels follow `dev/echo-v0.1.2-single-agent.md` and the session
ceiling in `protocol.config.yaml`. They do not override credential handling,
verification, releases or repository boundaries.

## Open items

### EMBED-001 — superseded external single-agent embed (blocked)

- [ ] Authority: automation level 3. Updating the external target is reserved
  to the operator: `C:\Users\spenc\.config\opencode\agent\echo.md` lies outside
  the project directory. No automation level lifts that boundary.

The 409-line embed, last written 2026-08-11 when inspected, predates the
canonical `dev/echo-v0.1.2-single-agent.md`. The earlier audit found missing
scripted-edit and scope-disposition rules, the active scope register contract,
autonomy levels, step accounting, progress-push/archive rulings and current FID
statuses. It also found contradictory attribution and bootstrap instructions.
Exact evidence and the operator-only replacement procedure are retained in
the history snapshot. No external write or fresh external repair is claimed.
This session uses the canonical repository protocol.

### HOME-SKILLS-001 — external skill diagnostics (blocked)

- [ ] `skills:check` reports 22 home-skill warnings and zero repository errors.
  Third-party frontmatter, size and command-policy diagnostics occur outside
  this project. Changing those installed skills requires an operator decision
  on the external targets; this repository audit does not grant that authority.
  Details are preserved in the hygiene audit report; no external fix is claimed.

### FID-2026-1022-001 — renderer listener accumulation on the /model path (open)

- [ ] Authority: automation level 3. Opened 2026-10-22 from the LIVE-004
  residuals; status `analyzed`, so no gate receipt is claimed and nothing is
  implemented.

The 2026-10-19 operator acceptance session logged five `EventTarget`
max-listener warnings in ~27 s: 11 `resize` on `CliRenderer` at 01:34:18Z, 11
`change` on `ScrollBarRenderable` at 01:34:38Z and 01:34:45Z, 11 `focus` and 11
`blur` on `CliRenderer` at 01:34:45Z. The log proves the count crossed Node's
default threshold of 10; it does not prove growth across picker cycles, and the
first warning precedes the first open by 24 s. Dimension subscribers already
collapse to one native listener through `subscribeSharedEvent`, so the count has
to be attributed. The record's first step is a counting probe
(`scripts/probes/model-picker-listener-count.ts`); a flat, attributed population
is an acceptable outcome.

### FID-2026-1022-002 — model picker keystroke breadcrumbs (open)

- [ ] Authority: automation level 3. Opened 2026-10-22 from the LIVE-004
  residuals; status `analyzed`.

The acceptance's interaction verdict ("arrow keys and filter letter responded")
has no durable evidence: the picker's keyboard callback emits nothing at any log
level, so a handled key and an ignored one are identical in
`debug/cli.jsonl`. The record adds one debug-level breadcrumb per handled key
(key name, query length, filtered row count) plus open/close records, and
extends the acceptance harness to read them back.

### FID-2026-1022-003 — CommandPalette key warning (open)

- [ ] Authority: automation level 3. Opened 2026-10-22 from the LIVE-004
  residuals; status `analyzed`.

`Each child in a list should have a unique "key" prop … Check the render method
of Button. It was passed a child from CommandPalette.` fires at 01:04:39.494Z,
01:08:14.137Z, 01:32:51.702Z and 01:39:35.113Z — before and after the `/model`
repair, so it predates it. `CommandPalette` passes four element children to
`Button`, whose render normalizes through `makeTextUnselectable`. The mechanism
is unproven, so the record's first step is a reproduction that captures
`console.error`; the fix is preferred at `Button`'s render rather than the shared
normalization helper.

## Machine-readable scope targets

`AUDIT-2026-1018` completed on 2026-10-19 and its target list is retained in
`dev/tracking/scope-history-2026-10-20.md`, which grants nothing; `EMBED-001`
and `HOME-SKILLS-001` are blocked on external targets outside this project and
hold no write grant. Governance artifacts the protocol itself requires keep
their gate-level exemptions.

`FID-2026-1021-001`, `FID-2026-1021-002` and `FID-2026-1021-003` closed and
archived on 2026-10-21 (implementations `2ae5f3c3`, `40a52e3d` and `bf5978ff`),
so their write grants are released here; the evidence lives in the archived
records, the changelog and the session summary.

`FID-2026-1022-001`, `FID-2026-1022-002` and `FID-2026-1022-003` are open and
`analyzed` (pre-implementation). Their grants cover only the paths below; each
record declares its gates but holds no receipt until it converges.

- FID-2026-1022-001: `cli/src/utils/shared-event.ts`
  `cli/src/hooks/use-terminal-dimensions.ts` `cli/src/components/model-picker.tsx`
  `cli/src/components/right-sidebar.tsx` `cli/src/components/sidebar-rail.tsx`
  `cli/src/components/right-sidebar-motion.tsx` `cli/src/hooks/use-chat-ui.ts`
  `cli/src/hooks/use-scroll-management.ts` `cli/src/hooks/use-fold-collapse.ts`
  `cli/src/chat/use-chat-header-visibility.ts`
  `cli/src/components/__tests__/model-picker-listener-baseline.render.test.tsx`
- FID-2026-1022-002: `cli/src/components/model-picker.tsx`
  `scripts/probes/live-008-model-picker-dwell.ts`
  `cli/src/components/__tests__/**`
- FID-2026-1022-003: `cli/src/components/command-palette.tsx`
  `cli/src/components/button.tsx` `cli/src/components/clickable.tsx`
  `cli/src/components/__tests__/**`
