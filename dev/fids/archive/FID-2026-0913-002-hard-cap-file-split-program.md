# FID: Hard-cap file-split program — 9 files exceed the 300-line absolute maximum

**Filename:** `FID-2026-0913-002-hard-cap-file-split-program.md`
**ID:** FID-2026-0913-002
**Severity:** medium
**Status:** closed + archived 2026-09-13
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

1. [x] **RED (done):** quality:report FAIL with the 9 violations pasted
       above; re-run after GREEN: `quality: PASS (1498 baselined files)`.
2. [x] **GREEN-A sdk:** `stream-error-chunk.ts` (110) + stream.ts 288.
       Commit `39d00fbf`. Gates: typecheck sdk, full sdk suite 534/0
       (1,271 expect() — exact parity), archived FID-2026-0912-005 erratum
       appended.
3. [x] **GREEN-B common:** `custom-providers-parse.ts` (245) +
       `custom-providers-catalog.ts` (82) + facade (153). Commit `067bbf44`.
       Gates: typecheck common + sdk, provider suites 59/0/420 (parity).
4. [x] **GREEN-C cli wizard:** instructions (117) + steps (279) + replay
       (63) + facade (74). Commit `68f22950`. Gates: typecheck cli,
       consumer suites 42/0/176. Also repaired a pre-existing stale test
       walk + CFG fixture (protocol step from FID-2026-0911-003 missed this
       file; proven failing at HEAD pre-split by stash test).
5. [x] **GREEN-D cli subcommands:** parse (36) + replies (63) + picker (72)
       + handlers (248) + facade (40). Commit `07bc255b`. Gates: 42/0/176.
6. [x] **GREEN-E cli router:** `route-masked-key-setup.ts` (94) + slim
       route-user-prompt (281). Commit `0508257e`. Gates: full commands
       suite 382/0.
7. [x] **GREEN-F cli lookup:** `model-info.ts` (84) + facade re-exports
       (lookup 236). Commit `20efd545`. Gates: openrouter-models* suites
       20/0.
8. [x] **GREEN-G/H test splits:** wizard 579→299/261/46 (24/0, parity),
       commands 363→278 + harness 142 (12/0, parity), str-replace
       402→267/155 (17/0, parity). Commits `042f4d32`, `014b9c50`.
9. [x] **VERIFY:** typecheck ×4 exit 0; eslint `--max-warnings 0` exit 0
       (20 warnings fixed: 18 import-order via --fix, 2 split-orphaned
       unused imports removed + 1 pre-existing in lessons-to-skills.ts);
       prettier clean; lint:md PASS; `quality:report` PASS (1498 files);
       `version:check` PASS; baseline refreshed alphabetically (drift-block
       at the JSON tail removed); CHANGELOG entry added. Lint cleanup
       commit `3325feee`.
10. [x] **GOVERNANCE:** FID evidence + status; ledger row; commits landed
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

- fingerprint: sha256:covered-by per-family commits listed in Steps 2-9
  (G3 chain `cb6e0416` → `3325feee`)
- verified: 2026-09-13 — all gates pasted in the session log; suites at
  exact parity (sdk 534/0/1271, common providers 59/0/420, agent-runtime
  1379/0, cli commands+utils 1811/0, scripts 23/0)

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

- [x] **Commit SHA:** implementation chain `39d00fbf` (GREEN-A) →
      `067bbf44` (B) → `68f22950` (C) → `07bc255b` (D) → `0508257e` (E) →
      `20efd545` (F) → `042f4d32` (G) → `014b9c50` (H) → `3325feee`
      (lint cleanup); FID authored at `cb6e0416`
- [x] **File:line ranges:** all 25 final files measured by `wc -l` and
      recorded in `dev/quality-baseline.json` (alphabetical body entries;
      stale `stream.ts: 399` corrected to 288; drift-appended tail block
      removed)
- [x] **Gate output:** typecheck ×4 exit 0 · eslint --max-warnings 0
      exit 0 · prettier clean · lint:md PASS · quality: PASS (1498
      baselined files) · version:check PASS
- [x] **Reproducibility:** `bun run quality:report` exits 0; every touched
      suite re-runnable via the commits above
- [x] **Step statuses:** Steps 1-10 all `implemented` (see Steps)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution (facade splits; the
      planned module names evolved: `-shared.ts` became `-replies.ts`,
      `route-key-setup-modes.ts` became `route-masked-key-setup.ts` —
      concern boundaries identical)
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence is present (facades re-export every
      moved symbol; verified by unchanged consumer suites)
- [x] FID status reflects the actual implementation state (`fixed`)

### Loop 2 — Independent audit and self-correction

- Adversarial check run during implementation: two relocated violations
  were caught by the split's own size gate (steps module landed 303,
  parse module 316) and re-split rather than absorbed; one false-suspicion
  test failure was root-caused to pre-existing drift (stash-proven at
  HEAD) and repaired honestly rather than pinned around; the baseline
  refresh removed a stale value (stream.ts recorded 399 — never its real
  size) and a duplicate drift-block instead of papering over them.

## Resolution

Implemented + closed 2026-09-13. All nine files under the 300-line cap;
16 new modules created; zero consumer churn (facades); every suite at
exact test-count parity. Implementation chain `39d00fbf`→`3325feee` +
evidence commit `954bd6b`. Status `closed` — archived same day under the
Auto-Archive rule.

## Lessons Learned

Feature work that grows a file past the ceiling must budget its split in
the same FID — the ceiling-only rule (correct) removes the baseline
negotiation escape hatch, so the debt now surfaces as a hard gate exactly
when it is created. The 2026-09-11 "needs a separate refactor FID" pattern
deferred nine splits into one release-blocking lump; split-at-the-source
would have made each a 30-minute step.
