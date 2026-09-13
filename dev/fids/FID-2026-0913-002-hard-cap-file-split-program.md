# FID: Hard-cap file-split program — 9 files exceed the 300-line absolute maximum

**Filename:** `FID-2026-0913-002-hard-cap-file-split-program.md`
**ID:** FID-2026-0913-002
**Severity:** medium
**Status:** created
**Created:** 2026-09-13
**YAGNI-Compliance:** Verified — nine splits along seams that already exist
(describe boundaries, cluster boundaries, one pure classifier); zero new
machinery, zero behavior change, zero consumer churn (facades re-export the
current import paths). No "wait for more debt" deferral: the ceiling is the
repo's own hard rule and the validator gate fails the release.
**Related:** FID-2026-0819-005 (the 300-line policy + data-constant
exemptions); FID-2026-0910-004 (author of the custom-providers family now
over cap); FID-2026-0912-005 (author of the stream.ts growth; archived —
erratum required when its pinned line numbers shift); operator ruling
2026-09-13 (quality rule is ceiling-only: under-cap growth is free, >300 is
a violation).

---

## Summary

`bun run quality:report` / `validate:repository` FAIL on 2026-09-13 with
nine project-owned TypeScript files above the 300-line absolute maximum
(release-blocking gate). Eight are pre-existing debt from the
custom-providers program (flagged "separate refactor FID" since 2026-09-11,
never authorized); one is new this cycle (`sdk/src/impl/llm/stream.ts`,
331, grown by the FID-2026-0912-005 fix whose gates did not include the
repo validator). The operator approved the full split program 2026-09-13.
All nine split along existing seams with re-export facades so no importing
file changes.

## Environment

- **OS:** Windows 11 (win32, Git Bash); Bun 1.3.14
- **Commit/State:** `a527b91` (ceiling-only quality rule) on main; VERSION
  0.0.31 bumped, release cut paused on this program.
- **RED evidence (quality:report, 2026-09-13):**

```text
- cli/src/commands/__tests__/provider-add-wizard.test.ts: 580 lines exceeds absolute maximum 300
- cli/src/commands/__tests__/provider-commands.test.ts: 355 lines exceeds absolute maximum 300
- cli/src/commands/provider-subcommands.ts: 402 lines exceeds absolute maximum 300
- cli/src/commands/router/route-user-prompt.ts: 312 lines exceeds absolute maximum 300
- cli/src/utils/openrouter-models/lookup.ts: 310 lines exceeds absolute maximum 300
- cli/src/utils/provider-wizard.ts: 467 lines exceeds absolute maximum 300
- common/src/providers/custom-providers.ts: 431 lines exceeds absolute maximum 300
- packages/agent-runtime/src/__tests__/process-str-replace.test.ts: 403 lines exceeds absolute maximum 300
- sdk/src/impl/llm/stream.ts: 331 lines exceeds absolute maximum 300
quality: FAIL (9 quality violation(s))
```

## Detailed Description

### Problem

Nine files exceed `maxFileLines: 300`. The 2026-09-13 operator ruling made
the rule explicit: under-cap files may grow freely; exceeding 300 is a hard
violation. The release cut (0.0.31) is blocked on the gate.

### Expected Behavior

`quality:report` → `quality: PASS`; every authored file ≤ 300 lines; all
existing suites green with identical or higher assertion counts; no import
site anywhere changes (facades); documented FID evidence that pins line
numbers gets an erratum note, never a silent move.

### Root Cause

Feature growth concentrated in the custom-providers family (8 files) and a
vendor-path fix (+38 into an already-293-line stream.ts) without the
split-step that the 300-line policy intends; the growth ratchet masked the
drift by negotiating baselines instead of enforcing the ceiling.

### Evidence

Seams verified by full reads this session (all nine files read 0-EOF):

- `provider-wizard.ts` (467): replay-guard cluster (~55) + step-submit
  handlers cluster + instructions/types cluster — three clean extractions;
  ~30 import sites stay on the facade.
- `custom-providers.ts` (431): parse cluster (`parseCustomProviders`,
  `parseCustomCatalog`, `describe`, result type, ~210) is self-contained;
  ~15 consumers import from the facade path.
- `provider-subcommands.ts` (402): picker-selection cluster (~90) +
  edit/list/remove/test handlers cluster — reply/echo helpers + param types
  hoist to a shared module to keep the import DAG acyclic (core dispatch →
  handlers, both → shared; picker standalone).
- `route-user-prompt.ts` (312): the two `routeKeySetup` mode branches
  (providerSetup + researchKeySetup) extract to one keyed module (~85).
- `lookup.ts` (310): `formatModelInfo` + `getProviderFromModelId` (~80) —
  pure formatting, no catalog dependency.
- `provider-add-wizard.test.ts` (580): three describe boundaries — machine
  pins, router e2e, replay guard.
- `provider-commands.test.ts` (355): grammar/picker pins vs wizard-walk pins.
- `process-str-replace.test.ts` (403): the `indentation rescue
  (FID-2026-0910-003)` describe (~150) is already an isolated block.
- `stream.ts` (331): the `type === 'error'` branch (~125) becomes a pure
  classifier (`classifyAiSdkStreamError`) returning a union action; the
  generator keeps the `yield`/`yield*` authority.

## Impact Assessment

### Affected Components

- 9 over-cap files (above) + 13 new modules (7 source, 6 test) + 2 facades
  gaining re-exports
- `dev/quality-baseline.json` — refresh the 9 `trackedFiles` entries to
  post-split sizes (informational under the ceiling-only rule) and add the
  new modules at measured sizes
- Archived FID-2026-0912-005 — erratum note (pinned `stream.ts:255-292`
  line numbers shift; the tool-call branch code itself does not change)
- CHANGELOG 0.0.31 section — program entry

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: broad but mechanical; every split is move-only + re-export;
      the risk is assembly error, caught by typecheck ×4 + suites +
      assertion-count parity per split test file.
- [ ] Low

## Proposed Solution

### Approach

Facade splits along the seams above. Every original module keeps its export
surface (re-exporting moved pieces), so zero importing files change. Test
splits keep every `test()` block verbatim; each new file re-declares its own
imports/helpers (house style — no shared test utils introduced). Each
split family is one atomic commit with its own gates.

### Steps

1. [ ] **RED (done):** quality:report FAIL with the 9 violations pasted
       above; re-run after GREEN must be `quality: PASS (N baselined files)`.
2. [ ] **GREEN-A sdk:** `stream-error-chunk.ts` classifier + stream.ts
       slim-down (~210). Gates: typecheck sdk, sdk llm suites
       (llm-invalid-vendor-tool-call + llm-native-tool-call), assert the
       tool-call branch bytes unchanged. Append erratum to archived
       FID-2026-0912-005.
3. [ ] **GREEN-B common:** `custom-providers-parse.ts` + facade. Gates:
       typecheck common + sdk (consumers), common provider suites
       (custom-providers, custom-provider-protocol, provider-registry).
4. [ ] **GREEN-C cli wizard:** `provider-wizard-replay.ts` +
       `provider-wizard-steps.ts` + `provider-wizard-instructions.ts` +
       facade. Gates: typecheck cli, provider-add-wizard + provider-commands
       + provider-picker-add-new suites.
5. [ ] **GREEN-D cli subcommands:** `provider-subcommands-shared.ts` +
       `-handlers.ts` + `-picker.ts` + facade. Gates: provider-commands +
       provider-picker-add-new suites.
6. [ ] **GREEN-E cli router:** `route-key-setup-modes.ts` +
       slim route-user-prompt. Gates: router-provider-setup +
       router-provider-update + provider-add-wizard router-e2e pins.
7. [ ] **GREEN-F cli lookup:** `model-info.ts` + facade re-exports. Gates:
       openrouter-models* suites (lookup/context-window/max-output).
8. [ ] **GREEN-G/H test splits:** wizard test 3-way, commands test 2-way,
       str-replace rescue describe out. Gates: bun test on every touched
       file; assertion-count parity recorded in the FID (total expect()
       before vs after per family).
9. [ ] **VERIFY:** typecheck ×4 exit 0; eslint `--max-warnings 0`;
       prettier; lint:md; `quality:report` PASS; `validate:repository` PASS;
       `version:check` PASS; baseline refresh; CHANGELOG entry.
10. [ ] **GOVERNANCE:** FID evidence + status; ledger row; commits landed
        per family (G3/G4).

### Verification

Dual-method per the protocol: Method 1 static (typecheck ×4, eslint,
prettier, quality PASS, validator PASS); Method 2 runtime (every touched
suite green; per-family expect() parity proves no pin was lost in a test
split; Law 4 grep on each new module's facade re-export chain proving
production consumers still resolve).

## Verification Gates

- gate: typecheck sdk
- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: typecheck cli
- gate: test scripts/quality-report.test.ts
- gate: test sdk/src/impl/__tests__/llm-invalid-vendor-tool-call.test.ts
- gate: test common/src/providers/__tests__/custom-providers.test.ts
- gate: test cli/src/commands/__tests__/provider-add-wizard.test.ts
- gate: test cli/src/commands/__tests__/provider-commands.test.ts
- gate: test packages/agent-runtime/src/__tests__/process-str-replace.test.ts

### Verification Receipt

- fingerprint: sha256:PENDING-STAMP-AT-IMPLEMENTATION
- verified: PENDING

## Perfection Loop

### Loop 1 — Authoring (2026-09-13)

- **RED:** the 9 violations above (quality:report FAIL, validator FAIL —
  both run this session). Release 0.0.31 blocked on this gate.
- **GREEN:** facade splits per the seam map; no behavior change; baseline
  refresh; erratum on the archived FID.
- **AUDIT (planned):** gates in Steps 2-9; assertion-count parity per test
  family; grep proof every facade export resolves for existing importers.
- **ADVERSARIAL (planned):** (a) "Is this splitting for the metric's sake?"
  — the ceiling is the repo's declared hard rule and a live release gate;
  the ruling settled the philosophy. (b) "Does the stream.ts classifier
  change fallback semantics?" — the classifier returns a descriptor; the
  generator alone yields/delegates, so `yield*` recursion stays in
  stream.ts. (c) "Test splits can silently drop pins" — count parity gate.
- **CHANGE DELTA:** initial authoring.

### Missed Questions

1. *Why facades instead of updating import sites?* — 45+ import sites
   across 3 workspaces vs 2 re-export lines; facades also keep git blame
   coherent and the diff reviewable (move-only).
2. *Do the new test files share helpers?* — No: each re-declares imports
   and its own `makeParams` (the duplication already house-accepted in
   provider-commands vs provider-add-wizard). No new shared test util
   module (would itself need maintenance + cap tracking).
3. *Does the baseline refresh reintroduce the ratchet?* — No: under the
   ceiling-only rule under-cap values are informational; recorded for
   history and for the exemption freeze only.
4. *Why is provider-subcommands split 4-way with a shared module?* — The
   dispatch (core) calls handlers; handlers need the reply helpers; a
   2-file split would make core→handlers→core cycle. Shared hoists the
   helpers; DAG stays acyclic.
5. *What protects the archived FID-2026-0912-005 evidence?* — Erratum note
   in that record stating the split moved the pinned region; the code
   semantics and the still-green pin suite are the real ground truth.
6. *Order of families?* — sdk first (newest debt, archived-FID erratum
   freshest), then common (upstream of cli consumers), then cli families,
   then tests, then governance — each family's gates run before the next
   starts (one problem at a time).

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** pending
- [ ] **File:line ranges:** pending
- [ ] **Gate output:** pending
- [ ] **Reproducibility:** pending
- [ ] **Step statuses:** Step 1 `implemented` (RED captured above); Steps
      2-10 pending.

### Code Verification Evidence

- [ ] Files referenced in Affected Components exist
- [ ] Implementation matches the Proposed Solution
- [ ] Typecheck/tests/lint pass with pasted tool output
- [ ] Production call-graph evidence is present
- [ ] FID status reflects the actual implementation state

### Loop 2 — Independent audit and self-correction

- pending implementation

## Resolution

- pending

## Lessons Learned

Feature work that grows a file past the ceiling must budget its split in
the same FID — the ceiling-only rule (correct) removes the baseline
negotiation escape hatch, so the debt now surfaces as a hard gate exactly
when it is created. The 2026-09-11 "needs a separate refactor FID" pattern
deferred nine splits into one release-blocking lump; split-at-the-source
would have made each a 30-minute step.
