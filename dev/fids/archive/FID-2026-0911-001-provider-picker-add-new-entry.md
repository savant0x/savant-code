# FID: /provider Picker Add-New Entry → Full Wizard

**Filename:** `FID-2026-0911-001-provider-picker-add-new-entry.md`
**ID:** FID-2026-0911-001
**Severity:** low
**Status:** fixed (Loop 1 RED + Loop 2 GREEN recorded; Loop 3 AUDIT/ADVERSARIAL
in progress)
**Created:** 2026-09-11 (operator directive: "/provider dropdown should offer
'add new' that opens the full wizard easily")
**YAGNI-Compliance:** Verified — one picker entry + one selection branch
reusing the existing Step 7/8 wizard, grammar words, and input modes. No new
state machine, no new persistence, no new mode family.

---

## Summary

The `/provider` dropdown picker (opened by `/provider` with no args) lists
built-in and custom providers with ✓/✗ configuration badges, but offers **no
way to create a custom provider** from the picker itself. The full wizard
exists (FID-2026-0910-004 Step 7/8) but is reachable only by typing
`/provider add`. The operator wants a visible **"Add a custom provider…"**
entry in the dropdown that opens the full wizard easily — discoverability for
the entire custom-provider feature.

## Environment

- **Repo state:** `main` at `21b6b16` (FID-2026-0910-004 closed + archived;
  all 10 steps implemented, gate-verified, committed).
- **Surfaces (grep-verified):**
  - List builder: `cli/src/commands/defs/model-provider-commands.ts:52-100` —
    `/provider` no-args branch builds `builtinProviders` + `customEntries`
    and calls `useProviderPickerStore.getState().open(providers)`.
  - Store: `cli/src/state/provider-picker-store.ts:40-45` — `open()` seeds
    `selectedIndex` on the first unconfigured entry.
  - Component: `cli/src/components/provider-picker.tsx:146` — rows render
    `✓/✗` from `provider.configured` only; no action-row concept.
  - Selection: `cli/src/chat/use-chat-pickers.ts:172-203` —
    `handleProviderPickerSelect` calls `beginProviderSetup(provider)` then
    activates or enters `providerSetup` key mode.
  - Wizard entry seam: `provider-subcommands.ts` `handleAdd` (grammar word
    `add` → `beginProviderWizard('add')` + `enterWizardMode(session.step)`).
  - Free-build gate: `modes.ts:125` — `MODEL_PROVIDER_COMMANDS` (and
    therefore `/provider`) is not registered when `IS_SAVANT_FREE`, so a
    picker entry cannot leak into the free build via this path.

## Detailed Description

### Problem

1. **Discoverability (primary):** a user scanning `/provider` sees eleven
   built-ins and their customs — nothing signals that creating one is
   possible. The feature's only entry is a typed subcommand.
2. **Mode fall-through on unknown selections (latent, found in RED):**
   `handleProviderPickerSelect` calls `beginProviderSetup(provider)` and only
   touches input mode inside `if (info)`. For any name with no setup info the
   picker closes and the input bar is left in whatever mode it was in —
   a silent no-op. The `add-new` selection must not ride this path.

### Expected Behavior

- The `/provider` dropdown shows a final row: **"Add a custom provider…"**
  (separator-styled, no ✓/✗ badge).
- Selecting it closes the picker and opens the **full existing wizard** at
  the `id` step in `providerAdd` mode — identical to typing `/provider add`,
  including the instructions message and Escape-discard semantics.
- The entry is skipped by `open()`'s "first unconfigured" seeding logic (it
  is an action, not a provider).
- A custom id may never collide with the action key: the wizard already
  rejects grammar words (`add|edit|list|remove`) at the id step
  (provider-wizard.ts, Step 8), so the sentinel cannot be shadowed.

## Root Cause

The picker's data model is a flat list of providers
(`{name, label, configured}`) with a single selection semantic
(setup/activate). There is no representation for an action row, so the UI
cannot express "create new" and the selection handler cannot branch to the
wizard.

## Evidence

- `provider-picker.tsx:146` — `const status = provider.configured ? '✓' : '✗'`
  (badge-only row model).
- `provider-picker-store.ts:40-45` — `findIndex((p) => !p.configured)`
  (any appended entry participates in seed selection).
- `use-chat-pickers.ts:174-176` — `beginProviderSetup(provider)` runs
  unconditionally; `provider-setup.ts:42-49` returns `undefined` for unknown
  ids AFTER setting nothing but BEFORE any message — the silent fall-through.
- Registry id set (`registry.ts`): `add` collides with no built-in id —
  a `'add'` sentinel is collision-free at the type level and runtime.

## Impact Assessment

### Affected Components

- `cli/src/commands/defs/model-provider-commands.ts` — append the action row
  to the picker list.
- `cli/src/state/provider-picker-store.ts` — skip the action row when seeding
  selection.
- `cli/src/components/provider-picker.tsx` — render the action row distinctly.
- `cli/src/chat/use-chat-pickers.ts` — branch on the sentinel BEFORE
  `beginProviderSetup` to open the wizard.

### Risk Level

- [ ] Critical
- [ ] High
- [ ] Medium
- [x] Low: additive UI affordance over an existing, fully pinned wizard; the
      only hazard (sentinel collision / fall-through) is closed by the Step 8
      grammar-word reservation and the branch ordering in GREEN.

## Proposed Solution

### Approach

A **sentinel action row** — the minimal representation that reuses every
existing seam (Law 13):

- Sentinel key `'add'` (the grammar word; already reserved at the wizard id
  step, so no custom provider can ever shadow it — verified against the
  registry id set and `PROVIDER_GRAMMAR_WORDS`).
- The four touch points above; zero changes to the wizard machine, the route
  handler, the store shape beyond the seed predicate, or any common code.
- The selection branch reuses `handleAdd`'s exact behavior by going through
  the SAME seam the grammar uses (`beginProviderWizard` + step instructions +
  `enterWizardMode`) — implemented as one shared helper so grammar and picker
  cannot drift (single wizard-entry truth).

### Design Decisions

- **D1 — Sentinel in the list vs. a new picker field:** sentinel row keeps
  the store/component prop types untouched (a new discriminated union would
  ripple through `ProviderPickerProps` and both open callers for zero
  behavioral gain at this size). The `configured: false` + reserved-id
  invariants make false positives impossible.
- **D2 — Branch before `beginProviderSetup`:** the picker selection handler
  checks the sentinel first; the latent silent fall-through for unknown
  providers is separately hardened with an explicit guidance message
  (fail-loud, Law 14) instead of a silent return.
- **D3 — Wizard entry through the grammar's seam:** one `startAddWizard`
  helper in `provider-subcommands.ts` used by both `/provider add` and the
  picker selection — the entry path stays single-truth.
- **D4 — No free-build surface change:** the entry lives inside the
  `/provider` command already absent from free builds (`modes.ts:125`), so
  no additional gating is needed (verified, not assumed).

### Steps

1. **RED:** pin suite `provider-picker-add-new.test.ts` — (a) `/provider`
   no-args list ends with the sentinel entry; (b) store `open()` seeds
   selection on the first unconfigured PROVIDER, never the sentinel; (c)
   selecting the sentinel closes the picker, opens the wizard at `id`, sets
   `providerAdd`, renders the id-step instructions, and echoes nothing into
   history; (d) a custom id `add` remains rejected at the wizard id step
   (collision pin); (e) unknown-provider selection surfaces explicit
   guidance (no silent fall-through). Capture failing.
2. **GREEN:** implement D1-D4 across the four files.
3. **AUDIT:** gates (typecheck ×4, suites, eslint, prettier) + grep call-graph
   for the new helper's production callers.
4. **ADVERSARIAL + COMPLETE:** re-audit evidence; converge status.

### Verification

- New pin suite green post-GREEN with all RED legs demonstrated failing
  pre-fix; provider-commands + provider-add-wizard suites regression-green.
- Typecheck ×4 (repo hard gate), eslint `--max-warnings 0`, prettier,
  `lint:md` on touched files.
- Law 4: `startAddWizard` production callers grep-verified (grammar dispatch
  + picker branch).

## Perfection Loop

### Loop 1 — RED (2026-09-11)

- **Findings cataloged (this document):** primary discoverability gap
  (`provider-picker.tsx:146` badge-only row model; no action-row concept in
  the store or selection handler) + latent silent fall-through on unknown
  selections (`use-chat-pickers.ts:174-176` unconditional
  `beginProviderSetup`; `provider-setup.ts:42-49` returns `undefined`
  after mutating nothing, input mode untouched, picker already closed).
- **Call-graph (grep):** the wizard's only production entries are the
  `/provider add|edit` grammar (Step 8) — the picker contributes nothing;
  the free build registers no `/provider` command at all (`modes.ts:125`),
  so the new surface inherits that gate.
- **Grep call-graph for wizard entry seams:** `beginProviderWizard` callers =
  `provider-subcommands.ts` (add/edit handlers) + tests. No picker path.

### Loop 2 — GREEN (2026-09-11)

- **Implement D1-D4:** sentinel row appended in the `/provider` no-args
  branch; store seed predicate skips the sentinel; component renders the
  action row without a ✓/✗ badge (muted, prefixed); selection handler
  branches to the shared `startAddWizard` seam before any
  `beginProviderSetup` call; unknown-provider selection renders explicit
  guidance instead of a silent return. Pins (a)-(e) from Loop 1 written
  first and captured failing (sentinel absent → list-shape and selection
  legs fail; fall-through leg fails on the empty guidance).
- **Verification:** gates per the Verification section; results recorded
  below at implementation.

### Missed Questions

- **MQ1 — Should the sentinel also appear in the free build?** No — the free
  build has no `/provider` command (`modes.ts:125`) and no wizard; adding
  one would invent a surface the free product deliberately lacks (YAGNI).
- **MQ2 — Edit entry in the picker too?** Out of scope: edit is
  id-targeted (`/provider edit <id>`), and the picker rows already imply the
  selection semantics; an edit affordance per row is a separate UX question
  for a future FID if the operator wants it.

## Code Verification Evidence

- [x] Typecheck ×4 planned (hard gate)
- [x] New pin suite with RED legs planned
- [x] Regression suites named (provider-commands, provider-add-wizard)
- [x] Law 4 grep for new wiring planned
- [x] Results recorded at implementation (Loop 2 AUDIT)

## Lessons Learned

- Picker-style overlays that grow command-adjacent features need an
  action-row concept BEFORE the second feature arrives; the flat
  provider-list model made "create new" inexpressible without a sentinel.
- An unconditional state-mutation call followed by a conditional branch
  (`beginProviderSetup` then `if (info)`) is a silent-fall-through pattern —
  the same fail-loud principle the wizard's route handler already applies.

### Loop 3 — AUDIT + ADVERSARIAL (2026-09-11)

- **Implementation evidence (file:line):**
  - Sentinel constant + grammar reservation: `provider-wizard.ts`
    (`PROVIDER_PICKER_ADD_ENTRY = 'add'` — reuses the existing
    `PROVIDER_GRAMMAR_WORDS` reservation; the id-step rejects it, so a
    custom provider named `add` can never shadow the action row).
  - List assembly appends the action entry: `model-provider-commands.ts`
    (`/provider` no-args branch).
  - Store seed skips the sentinel: `provider-picker-store.ts`.
  - Component renders the muted action row (no ✓/✗ badge):
    `provider-picker.tsx`.
  - Selection seam `handleProviderPickerSelection` (exported from
    `provider-subcommands.ts`, delegated to by `use-chat-pickers.ts`):
    closes the overlay first, then branches — sentinel → `startAddWizard`
    (wizard at the id step, input mode continuity preserved); unknown id →
    explicit guidance reply (no-echo, picker-sourced); known → the existing
    setup/activation path.
- **Double audit — Method 1 (static):** `bun x tsc --noEmit -p .` in cli,
  common, sdk, packages/agent-runtime — all exit 0. eslint
  `--max-warnings 0` on all 7 touched files — 0 problems (import/order
  auto-fixed, re-verified). Prettier clean on all touched files.
- **Double audit — Method 2 (runtime):** new pin suite
  `provider-picker-add-new.test.ts` — 6 pass / 0 fail / 22 expect()
  (RED-first: captured failing at the export level before GREEN). Full
  regression battery across the 9 provider-surface files — 80 pass / 0
  fail / 239 expect() calls.
- **Law 4 call-graph proof (grep, fresh):** the selection seam is called
  from `use-chat-pickers.ts` (the live React path); the sentinel row is
  appended in `model-provider-commands.ts` (the `/provider` no-args
  branch); the wizard it opens is the Step 7 machine entered via
  `startAddWizard` → `beginProviderWizard` (grep-verified callers). The
  free build exposes none of this (`modes.ts:125` gates `/provider`) —
  MQ1 honored.
- **ADVERSARIAL re-audit:** citations resolved against the tree; no
  unevidenced PASS remains; the pin-corrected overlay-close ordering
  (close, then delegate — D2, matching the hook's existing contract) is
  the recorded GREEN self-catch. Verdict: clean → converge.
- **Circuit breaker:** 3 loops, all convergent; no oscillation.

**Status: converged — `fixed`.** CLOSED 2026-09-12 (operator directive:
"complete all open fids … automation level 3"). Resolution recorded
below; archived in the closing commit.

## Resolution

**CLOSED 2026-09-12.** The add-new picker entry ships exactly as
converged in Loop 3: sentinel action row (grammar-word-reserved in the
leaf module, shadow-proof), selection seam with the three-way branch
(sentinel → wizard; unknown → explicit guidance; known → setup path),
free build untouched. Gates at convergence: typecheck ×4, 6/0 pins,
80/0 regression, eslint/prettier/lint:md clean. Committed as
`d2656eb4` (feature) + `df5e743a` (governance).

**Operator due diligence (2026-09-12) folded in:** the four pre-closure
questions surfaced two feature gaps (no live test; no anthropic
protocol) and one latent routing bug (`resolveProtocol` no-map branch).
All are OUT OF SCOPE for this presentation-layer FID and are owned by
FID-2026-0911-003 (expanded scope: wizard live test, `/provider test`,
`/health` live line, protocol field, routing-bug fix). No open items
remain on this FID.
