# FID: ChatAnywhere provider + free-key star marking on the model page

**Filename:** `FID-2026-1005-010-chatanywhere-free-key-provider.md`
**ID:** FID-2026-1005-010
**Severity:** medium
**Status:** verified
**Created:** 2026-10-05 17:45
**Automation level:** 3
**YAGNI-Compliance:** Verified

> **Operator directive (verbatim):** *"Read over adding a provider. I want to
> add https://chatanywhere.tech/pricing, then in the model page, a special
> section with the 'free key', lets add a star or something for those entries.
> Add a blank key entry and we'll test gpt5.6 sol - this needs a fid though"*;
> follow-up: *"i added the key under CHATANYWHERE_API_KEY"*; design rulings
> via structured question: blank key entry = **blank placeholder row**; star
> scope = *"add the everything free related, so if it has free in the name or
> is from this provider, add the star. Make it a function so it can quickly
> apply to all free options"*. Register item: T144.

## Summary

Add `chatanywhere` (ChatAnywhere, `https://chatanywhere.tech/pricing`) as a
built-in gateway provider per `docs/adding-a-provider.md`, and add a
reusable free-key marker to the model page: a pure predicate that stars
entries with `free` in the name/id or belonging to a free-key provider
(chatanywhere), applied to the model picker (★ rows + a dedicated FREE KEY
section with a blank key placeholder row) and exported for every
free-options surface. Acceptance test: a real `gpt-5.6-sol` completion
through the provider — **passed** (HTTP 200, reply "pong").

## Environment

- **OS / shell:** Windows 11 (`win32`), Git Bash (MSYS)
- **Runtime:** Bun `1.3.14`
- **Files:** `common/src/providers/registry-partitioned-2.ts`,
  `common/src/constants/model-config/gateway-catalogs.ts`,
  `common/src/constants/window-coverage-register.ts`,
  `cli/src/components/model-picker*.tsx|ts`, `cli/src/utils/free-badge.ts`
- **Commit/State:** worktree dirty (prior sessions' changes, uncommitted)
- **Governance:** ECHO Protocol v0.1.2-single-agent
  (`dev/echo-v0.1.2-single-agent.md`), FID-bound, Laws 1/3/4

## Detailed Description

### Problem

ChatAnywhere (OpenAI-compatible gateway; free-key tier = 10,000 points/day
per `chatanywhere/gpt_api_free`) is not in the registry, and the model page
has no notion of free-key reachability: entries that cost nothing on the
free tier are indistinguishable from metered ones.

### Expected Behavior

`chatanywhere/<id>` routes through the registry chain with
`CHATANYWHERE_API_KEY`; the model page stars every free-reachable entry via
one shared predicate and groups them in a FREE KEY section; that section
carries a blank key placeholder row; `gpt-5.6-sol` completes for real.

### Root Cause

No registry entry; no free-marker concept in the picker/report surfaces.

### Evidence (live probes, 2026-10-05, operator key via env — never printed)

```text
GET https://api.chatanywhere.tech/v1/models   -> HTTP 200
  30 rows; row fields: id, object, created, owned_by (NO window fields)
  roster: gpt-5, gpt-5.2, gpt-5.4, gpt-5.4-mini, gpt-5.4-nano, gpt-5-mini,
  gpt-5-nano, gpt-5.1, gpt-5.5, gpt-5.6-sol, gpt-5.6-luna, gpt-5.6-terra,
  gpt-6-astra, gpt-6-sol, gpt-6-luna, gpt-6.1-sol, gpt-4.1, gpt-4.1-mini,
  gpt-4.1-nano, gpt-4o, gpt-4o-mini, gpt-3.5-turbo, deepseek-v3.2,
  deepseek-chat, deepseek-v4-pro, deepseek-v4-flash, deepseek-v4.1-flash,
  text-embedding-3-small, text-embedding-3-large, text-embedding-ada-002
  (no model id contains "free")

POST https://api.chatanywhere.tech/v1/chat/completions  -> HTTP 200
  model echo: gpt-5.6-sol; reply: "pong";
  usage: {prompt_tokens: 11, completion_tokens: 4, total_tokens: 15}
  — catalog reachability AND inference reachability both confirmed
  (runbook: two separate acceptance checks)

chatanywhere.tech/pricing (via search snippet, SPA not extractable):
  "gpt-5.6-sol … 默认档位 · >= 272,000 tokens" — window >= 272000
```

## Impact Assessment

### Affected Components (as-built)

- `common/src/providers/registry-partitioned-2.ts` — the entry
  (`credentials.envVar: 'CHATANYWHERE_API_KEY'`, openai/strip,
  `https://api.chatanywhere.tech/v1`, static catalog, order 4)
- `common/src/constants/model-config/gateway-catalogs.ts` +
  `common/src/providers/model-catalogs.ts` + `common/src/constants/model-config.ts`
  — static 27-model chat roster (prefix `chatanywhere/`), name map
- `common/src/constants/window-coverage-register.ts` — `table-section`
  (gateway publishes no window fields; probe above)
- `common/src/constants/context-window-table-chatanywhere.ts` — seam-split
  13 cross-gateway-consensus rows + 14 documented no-row ids (the apinex
  operator-ruled pattern)
- `cli/src/utils/openrouter-models/__tests__/window-truth-chatanywhere.test.ts`
  — roster window pins (seam census + spot windows + no-row defaults)
- **New** `cli/src/utils/free-badge.ts` — the reusable marker
  (`isFreeTierEntry` predicate + `freeBadgeFor` display prefix)
- `cli/src/components/model-picker-grouping.ts` — FREE KEY section hoist +
  `KeyItem` blank key placeholder row
- `cli/src/components/model-picker-rows.tsx` + `model-picker.tsx` — ★ rows,
  section header, key row render
- Hand-maintained provider surfaces ×6 (README.md, README.zh-CN.md,
  cli/release/README.md, docs/index.md, docs/sdk-overview.md,
  docs/installation.md, docs/features.md) + generated
  (`bun run generate:provider-docs`: docs/providers.md + tables)

### Risk Level

- [ ] Critical
- [ ] High
- [x] **Medium** — additive provider + display marking; routing is untouched
      beyond one registry entry; the placeholder row is display-only
- [ ] Low

## Proposed Solution

### Approach (as-built, with deviations)

Follow `docs/adding-a-provider.md` exactly. Static curated roster (audited
2026-10-05, 27 chat models — 3 embedding ids excluded as non-chat), because
the gateway publishes no window fields and a live wrapper would add the
positional-ladder contract for a roster the curated map already covers.
Window coverage `table-section` with **cross-gateway consensus rows** (the
apinex operator-ruled pattern) instead of the vendor's ">= 272,000" floor —
stronger evidence; the floor is recorded in the seam comment. The marker is
one pure module with a predicate + display prefix so every surface applies
one rule.

**Recorded deviations from the initial plan (audit-caught, deliberate):**

1. The marker lives at `cli/src/utils/free-badge.ts`, not
   `common/src/providers/free-marker.ts`: every consumer (picker rows,
   grouping) is in `cli`, and the widened predicate takes the entry
   structure (`id`/`name`/`provider`/`freeTier`) rather than two loose
   strings. Revisit only if a `common`/sdk consumer appears (YAGNI).
2. The blank key entry is the `KeyItem` placeholder row at the top of the
   model-page FREE KEY section (the structured-question ruling: "blank
   placeholder row"), naming `CHATANYWHERE_API_KEY` and its readiness —
   never key material — not a row in the provider key list.
3. `free-options-render.ts` is NOT starred: its lanes list free-only rows
   where a star carries no information. The function is exported so any
   free-options surface can apply it ("so it can quickly apply to all free
   options" — capability delivered, application kept where it discriminates).
4. Registry membership pins in `common/…/provider-registry.test.ts` evolved
   24→25 keys / 23→24 setup providers (designed drift, pinned exactly).

### Steps (as-built)

1. Registry entry `chatanywhere` ✓
2. Static catalog + `MODEL_CATALOGS` + name map ✓
3. `WINDOW_COVERAGE_REGISTER` `table-section` + seam rows + truth suite ✓
4. `cli/src/utils/free-badge.ts` + unit tests; ★ wired into picker rows and
   the FREE KEY section ✓
5. Blank free-key placeholder row (`KeyItem`), display-only, readiness
   never required for routing ✓
6. Generated + hand-maintained surfaces synced (13 drift items + regen) ✓
7. Runbook tests: registry derivation pins (+ chatanywhere setup pin),
   catalog agreement, derivation parity; live acceptance recorded ✓

### Verification

Runbook battery: `cd common && bun test src/providers/__tests__/` (78/78);
cli suites (free-badge, model-picker-free-section, custom-catalog,
window-truth-chatanywhere, window-coverage-register); `bun run
generate:provider-docs:check` (clean); `bun run typecheck` (13 workspaces +
scripts); eslint + lint:md + prettier on touched files; `bun run
validate:repository`; live leg re-evidenced (HTTP 200 + "pong").

> Contract rule (FID-2026-0918-006): every promised test artifact MUST name
> its repo-relative `*.test.ts(x)` path, and that path MUST also appear as a
> declared `- gate: test <path>` below.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: test common/src/providers/__tests__/provider-registry.test.ts
- gate: test cli/src/utils/__tests__/free-badge.test.ts
- gate: test cli/src/components/__tests__/model-picker-free-section.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-truth-chatanywhere.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:6938b4013dd03b9afef5dfdc09d0a53c9f29e9f3a88a2c6bf3621440d46d480f
- verified: 2026-10-06T04:02:45.880Z
- typecheck common: exit 0
- typecheck cli: exit 0
- test common/src/providers/__tests__/provider-registry.test.ts: exit 0
- test cli/src/utils/__tests__/free-badge.test.ts: exit 0
- test cli/src/components/__tests__/model-picker-free-section.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-truth-chatanywhere.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Issues cataloged (provider absent; no free-marker concept).
  Live evidence gathered (both acceptance legs green). Call-graph plan: the
  registry loop derives everything; the marker function's callers are
  grep-provable at implementation.
- **GREEN:** Implemented per the as-built plan above — 14 files touched
  (registry/catalog/windows/markers/picker/tests/docs).
- **AUDIT:** Runbook battery + re-read of entry against validator rules
  (prefix invariants, unique env var, url ownership) — `validateProviderRegistry`
  passes structurally, with derivation parity + catalog agreement green.
- **ADVERSARIAL:** See answers below.
- **CHANGE DELTA:** Initial document.

### Missed Questions

1. **Why a static roster for a 30-model gateway?** The gateway publishes no
   window fields and the roster is small and audited; a live wrapper adds
   the positional-ladder contract (runbook: silent slot-shift, no test
   fails) for no user-visible gain here. If the roster churns, live is the
   documented upgrade path.
2. **Why exclude the 3 embedding ids?** The picker selects chat models;
   embedding rows would be dead entries. The registry comment records the
   full observed roster so the exclusion is auditable.
3. **Do the ★ rules overlap?** Yes by design — a `free`-named id from any
   provider and every chatanywhere row both star; the predicate is an OR.

### Adversarial answers (Loop 2)

- **Does the blank free-key row degrade readiness for the main key lane?**
  No — readiness derives from `credentials.envVar` presence only; the row is
  a display `KeyItem` with a `ready` flag and is never a selectable/committable
  item (picker selection keys on `type === 'model'`). Pinned by
  `model-picker-free-section.test.ts` ("key row reflects env readiness
  without exposing the secret", including a no-leak assertion).
- **Does hoisting free entries break provider grouping or duplicate rows?**
  No — hoisted entries leave their provider groups (no duplicates), and with
  no free-related input the grouping output is byte-identical to before
  (compat pin in the same suite; the pre-existing `custom-catalog.test.ts`
  ordering pin passes unchanged).
- **Can the star rule leak key material or misfire?** The predicate reads
  only `id`/`name`/`provider`/`freeTier`; the key row prints the env var
  name and readiness, never values.

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** pending G2 commit authority (G1: nothing committed)
- [x] **File:line ranges:** registry `common/src/providers/registry-partitioned-2.ts`
      (chatanywhere entry); marker `cli/src/utils/free-badge.ts:1-58`;
      grouping `cli/src/components/model-picker-grouping.ts` (`buildGroupedItems`
      free hoist + `freeKeyItems`); rows `cli/src/components/model-picker-rows.tsx`
      (`ModelPickerKeyRow`, `freeBadgeFor` at the model-id text)
- [x] **Gate output:** pasted in Code Verification Evidence
- [x] **Reproducibility:** every gate is a repo script/test path (above)
- [x] **Step statuses:** all 7 steps completed (Steps section)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (grep census: chatanywhere
      in 7 common modules + 4 cli modules + 6 docs surfaces)
- [x] Implementation matches the Proposed Solution (as-built version above)
- [x] Typecheck/tests/lint pass — evidence below
- [x] Production call-graph evidence present: `isFreeTierEntry` →
      `cli/src/components/model-picker-grouping.ts:70`; `freeBadgeFor` →
      `cli/src/components/model-picker-rows.tsx:117` (grep-provable)
- [x] FID status reflects the actual implementation state (`verified`)

```text
bun run typecheck                                       → PASS (13 workspaces + scripts, exit 0)
cd common && bun test src/providers/__tests__/          → 78 pass / 0 fail
cd cli && bun test free-badge model-picker-free-section custom-catalog → 15 pass / 0 fail
cd cli && bun test window-truth-chatanywhere            → 4 pass / 0 fail (seam census + pins)
cd cli && bun test window-coverage-register             → 5 pass / 0 fail
bun run generate:provider-docs:check                    → exit 0 (0 drift, 0 stale)
bun run validate:repository                             → validation: PASS
bun run lint:md                                         → exit 0
bun x eslint <touched ts/tsx> --max-warnings 0          → exit 0
bun x prettier --check <touched files>                  → all clean
live: GET /v1/models 200 (30 rows) · POST /chat/completions 200 "pong"
```

### Loop 2 — Independent audit and self-correction

Static leg + manual re-read against this record. Three stale artifacts were
caught and corrected in-pass: (1) declared gate paths written pre-implementation
(`free-marker.test.ts`) reconciled to the as-built test paths; (2) 13
hand-maintained doc drift items + registry membership pins (24→25 / 23→24)
surfaced by the runbook battery and synced; (3) scratchpad probe artifacts
moved to `dev/scratchpad/archive/` per the hygiene gate. Post-repair, every
affected gate re-ran green (evidence above).

### Loop 3 — Final convergence

All gates green on final content; receipt stamped at the `verified` flip.
`closed` is left to the operator's archive step (G-laws: no auto-archive of
this record by the agent in this pass).

## Resolution

- **Closed Date:** not closed — record is `verified` (operator archives)
- **Fix Description:** ChatAnywhere registered + cataloged + window-covered;
  reusable free marker + FREE KEY section with blank key row on the model
  page; gpt-5.6-sol live-accepted
- **Tests Added:** `cli/src/utils/__tests__/free-badge.test.ts`,
  `cli/src/components/__tests__/model-picker-free-section.test.ts`,
  `cli/src/utils/openrouter-models/__tests__/window-truth-chatanywhere.test.ts`,
  chatanywhere pins in `common/src/providers/__tests__/provider-registry.test.ts`
- **Verification Evidence:** the Code Verification Evidence block (live legs
  + static legs, exit statuses preserved)
- **Archived:** set when moved to `dev/fids/archive/`

## Lessons Learned

The runbook's two-acceptance-checks rule earned its keep here: the catalog
listing (HTTP 200, 30 rows) and inference (HTTP 200, "pong") were probed
separately, and the roster probe answered the catalog-source question
(no window fields → static + table-section) before any code was written.
The runbook battery's membership pins caught the designed drift (24→25
providers) as red on the first run — exactly their purpose — and the docs
drift checker turned "update the docs" from a memory task into a 13-item
checklist that closes at exit 0.
