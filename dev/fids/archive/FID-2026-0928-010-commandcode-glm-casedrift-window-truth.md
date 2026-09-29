# FID-2026-0928-010: CommandCode GLM case-drift + fail-open boundary + window-truth probe rot

**Filename:** `FID-2026-0928-010-commandcode-glm-casedrift-window-truth.md`
**ID:** FID-2026-0928-010
**Severity:** medium
**Status:** closed
**Created:** 2026-09-28
**Automation level:** 3
> **Status progression.** `created` at authoring; `fixed` after RED-first
> implementation (1 pass/4 fail observed pre-change; all gates green after;
> LIVE probe 14/14). The register (SCOPE.md T62-followup item 1) carries
> automation level 3 with "candidate FID, operator call" — the operator's
> session directive ("work the remaining level-3 register items") is the
> call to proceed. Case-drift remediation and probe repair are mechanical
> once grounded; the fail-open boundary is vendor-side and is documented,
> not patched.

---

## Summary

T62-followup(1) named two findings from the Task 62 gauntlet (2026-09-18):
a commandcode **catalog case-drift** and a **keyless roster fail-open
boundary**. This record re-grounds both LIVE on 2026-09-28 and adds a third
finding discovered while re-deriving the drift's blast radius.

1. **Case-drift (live, confirmed).** The static commandcode catalog pins
   `commandcode/zai-org/glm-5.2` and `commandcode/zai-org/glm-5.3`
   (lowercase). The live roster serves `zai-org/GLM-5.2` and
   `zai-org/GLM-5.3` (uppercase). The realign FID (2026-0916-004) *intended*
   the uppercase roster casing — its CHANGELOG entry says
   `zai-org/GLM-5.2` — so the lowercase spellings shipped as a realignment
   defect, not vendor drift. The wire path sends the catalog id verbatim
   (`idTransform: 'strip'` drops only the `commandcode/` prefix), so both
   rows are dead if vendor ids are case-sensitive.
2. **Fail-open boundary (vendor-side, re-confirmed).** Keyless
   `GET https://api.commandcode.ai/provider/v1/models` returns **HTTP 200
   with the full 82-id roster** on 2026-09-28 (roster count: 82). TokenRouter
   and TokenHarbor fail closed on the same probe shape (401). This is the
   vendor's design — it cannot be patched from this repo; the correct
   repository-side action is documentation so the fact travels with the
   provider metadata.
3. **Window-truth probe rot (new, found during grounding).**
   `scripts/providers/verify-window-truth.ts` samples 4 rows that can no
   longer pass: 2 stale commandcode keys (`commandcode/z-ai/glm-5.2`,
   `commandcode/openai/gpt-5.6-sol` — pre-realign spellings that no longer
   exist in the fallback table) and 2 `opencode-go/*` rows (the provider was
   removed from Savant entirely by FID-2026-0916-004). A drift alarm whose
   own sample list has rotted erodes trust in the alarm.

**Bonus grounding (new source discovered):** the commandcode roster itself
publishes `context_length` per id (roster row keys: `id, object, created,
owned_by, name, context_length, supported_endpoints`) — the gateway's own
publication for the two GLM rows is **1,000,000** for both.

## Environment

- Repo: `savant-code` v0.0.34, `main`. Live probes 2026-09-28 (Windows, Bun
  1.3.14).
- Probe artifacts (gitignored scratchpad per Task 62 operator amendment):
  `dev/scratchpad/active/t62f1-commandcode-probe.ts` (roster + casing),
  `dev/scratchpad/active/t62f1-window-sources.ts` (gateway context_lengths +
  orcarouter), `dev/scratchpad/active/t62f1-case-sensitivity.ts` (wire
  error-shape attempt).
- Surfaces read: `common/src/constants/model-config/providers.ts`,
  `common/src/constants/model-config/provider-protocols.ts`,
  `common/src/constants/context-window-table.ts`,
  `cli/src/utils/openrouter-models/static-catalogs.ts`,
  `cli/src/utils/openrouter-models/gateway.ts`,
  `sdk/src/impl/model-provider/model-factories.ts` (0-EOF),
  `sdk/src/impl/model-provider.ts` (routing predicates + `getModelForRequest`
  region), `common/src/providers/provider-exception-manifest.ts`,
  `scripts/providers/verify-window-truth.ts` (0-EOF),
  `common/src/providers/registry.ts` (commandcode entry),
  `dev/fids/archive/FID-2026-0916-004-gateway-catalog-realignment.md`.

## Detailed Description

### F1 — Case-drift (medium): catalog GLM rows vs live roster

LIVE probe 2026-09-28, keyless `GET /provider/v1/models` → HTTP 200, roster
count 82. GLM ids on the live roster:

```text
z-ai/glm-5.3-flash
z-ai/glm-5.3-flashx
zai-org/GLM-5.3        ← catalog: commandcode/zai-org/glm-5.3  (lowercase)
zai-org/GLM-5.2        ← catalog: commandcode/zai-org/glm-5.2  (lowercase)
zai-org/GLM-5.2-Fast
zai-org/GLM-5.1
zai-org/GLM-5
```

Casing cross-check (roster membership, `Array.includes`):

```text
zai-org/GLM-5.2: true        zai-org/glm-5.2: false
zai-org/GLM-5.3: true        zai-org/glm-5.3: false
moonshotai/Kimi-K3: true     moonshotai/kimi-k3: false
Qwen/Qwen3.8-Max: true       qwen/qwen3.8-max: false
deepseek/deepseek-v4-pro: true   deepseek/DeepSeek-V4-Pro: false
```

The drift is **isolated to the two GLM rows** — every other catalog casing
(Kimi, Qwen, deepseek, xai, poolside, inclusionai, meituan) matches the
roster exactly.

**Intent evidence:** the FID-2026-0916-004 CHANGELOG entry states the
realign adopted "`zai-org/GLM-5.2` + canonical Kimi casing" — uppercase —
while `common/src/constants/model-config/providers.ts:185-186` shipped
lowercase. The test pins (below) pinned the shipped defect, which is how it
survived.

**Blast radius (grep-verified, all `commandcode/zai-org` literals):**

| Surface | File:line | Status |
|---|---|---|
| Static catalog | `common/src/constants/model-config/providers.ts:185-186` | to fix |
| Protocol map keys | `common/src/constants/model-config/provider-protocols.ts:30-31` | to fix |
| Fallback table rows | `common/src/constants/context-window-table.ts:155-156` | to fix (+re-source, F1b) |
| Realign pin suite | `cli/src/utils/openrouter-models/__tests__/fid-2026-0916-004-realign.test.ts:45` | to fix (pins defect today) |
| Window coverage pin | `cli/src/utils/__tests__/context-window-fallbacks.test.ts:102` | to fix |
| Probe samples | `scripts/providers/verify-window-truth.ts` (stale pre-realign keys, see F3) | to fix |
| Historical docs | `docs/Model Context Window Review.md:247-248` (audit report of the *old* heuristic) | no change — frozen audit record |

**Wire consequence.** `createProviderModel` → `applyIdTransform`
(`idTransform: 'strip'`) sends `zai-org/glm-5.2` verbatim after the prefix
strip. If the vendor matches ids case-sensitively (canonical for OpenAI-
compatible rosters; the roster serves exactly one casing), both rows fail at
request time. Direct wire proof of case sensitivity needs a live
`COMMAND_CODE_API_KEY` (key absent locally: probes returned 401 for *every*
id incl. the control, error-shape comparison impossible) — recorded as
operator-key-blocked. The roster alignment is sufficient grounding for the
re-key; a future keyed probe can upgrade the evidence grade.

**F1b — window re-source for the re-keyed rows.** Grounding found the
commandcode roster publishes `context_length` per id; for the two GLM rows
it advertises **1,000,000** (both). Current table values are upstream votes:
`glm-5.2` = 1,048,576 (2-of-3: bazaarlink + OpenRouter vs orcarouter
1,000,000), `glm-5.3` = 1,310,720 (live upstream capability 2026-09-19;
OpenRouter 2026-09-28 = 1,310,720). Since `gateway → upstream` can only be
equal or narrower (a gateway proxies at most the upstream window), the
gateway's own publication is the binding value and the correction direction
is strictly conservative: `glm-5.2` 1,048,576 → 1,000,000; `glm-5.3`
1,310,720 → 1,000,000. Re-deriving a table row to a strictly smaller
advertised window when the authoritative roster is the serving gateway
itself is table maintenance, not silent guessing.

### F2 — Fail-open boundary (low, vendor-side): keyless roster disclosure

`GET https://api.commandcode.ai/provider/v1/models` with **no**
Authorization header → HTTP 200 with the full roster (82 ids, 2026-09-28;
consistent with the 2026-09-18 gauntlet). TokenRouter and TokenHarbor return
401 for the same probe shape. Severity is low (a model list is not
credential material) but the fact is security-relevant metadata for a
provider entry and currently exists only in a session summary. **Not
patchable from this repo** — the boundary is the vendor's. Repository-side
action: record it where provider metadata lives (registry comment +
exception manifest evidence), per the established pattern of encoding
measured vendor facts as comments on the provider entry (e.g. the
tokenrouter free-GLM 503 records).

### F3 — Window-truth probe rot (medium): the alarm's own samples are dead

`bun scripts/providers/verify-window-truth.ts` LIVE 2026-09-28 exits 1 with:

```text
FAIL opencode-go/deepseek-v4-pro: no fallback-table row (row was removed?)
FAIL opencode-go/kimi-k3: no fallback-table row (row was removed?)
FAIL commandcode/z-ai/glm-5.2: no fallback-table row (row was removed?)
FAIL commandcode/openai/gpt-5.6-sol: no fallback-table row (row was removed?)
```

All four are probe-sample defects, not table defects: the two commandcode
keys are pre-realign spellings (FID-2026-0916-004 re-keyed the table away
from them), and both opencode-go rows refer to a provider the product no
longer contains. The probe has been structurally red since that realign.

**The alarm also caught one genuine drift (working as designed):**

```text
FAIL tokenharbor/deepseek-v4-flash: table=1048576 but bazaarlink roster
says 1000000 (deepseek-v4-flash)
```

Settled LIVE 2026-09-28 by vote: orcarouter keyed roster still serves
1,048,576 for `deepseek/deepseek-v4-flash`, and OpenRouter still serves
1,048,576 for `deepseek/deepseek-v4-flash` → **2-of-3 upholds the table
row**; bazaarlink drifted. The row stays; the probe sample is re-pointed to
its surviving authoritative source (orcarouter) so the alarm samples the
row through the roster that still publishes it. The existing WARN-when-
vendor-stops-listing behavior covers the bazaarlink leg honestly (it is a
legitimate warning, not an error).

## Root Cause

- **F1:** implementation/realignment transcription defect — the realign's
  stated casing (`zai-org/GLM-5.2`) was not what the catalog map shipped;
  test pins then pinned the shipped spelling, converting the defect into a
  pinned invariant.
- **F2:** vendor-side design (open roster); no repo defect.
- **F3:** the realign and the opencode-go removal changed table keys without
  the probe gate's sample list being part of either FID's gate set, so the
  alarm rotted silently.

## Impact Assessment

| Finding | Class | Impact | Detection |
|---|---|---|---|
| F1 | Data defect (medium) | 2 catalog ids unusable on the wire if vendor ids are case-sensitive; `/model` picker offers dead entries | LIVE roster probe; only surfaces as user-visible failures on a keyed run |
| F1b | Data maintenance | Picker shows optimistic upstream windows for ids the gateway caps at 1,000,000 | LIVE roster `context_length` |
| F2 | Vendor posture (low) | Roster disclosure without credentials; zero repo impact | Keyless probe |
| F3 | Tooling (medium) | `verify-window-truth` cannot exit 0 since FID-2026-0916-004; drift alarm trust eroded | Probe run |

## Proposed Solution

1. **F1 — re-key the two GLM rows to the live roster spelling** in all three
   data surfaces (catalog map, protocol map keys, fallback table rows):
   `commandcode/zai-org/glm-5.2` → `commandcode/zai-org/GLM-5.2`, likewise
   5.3. Update the two test pins to assert the roster spelling and reject
   the lowercase spelling (the realign suite's stated job).
2. **F1b — re-source the two rows' windows to the gateway's own
   publication:** 1,048,576 → 1,000,000 and 1,310,720 → 1,000,000, with
   comment citing the roster measurement date. Upstream votes stay recorded
   in the comment trail.
3. **F2 — document the fail-open boundary** as a comment on the commandcode
   registry entry (measured 2026-09-18 + 2026-09-28, keyless 200) and add
   the probe evidence to the provider-exception-manifest commandcode entry's
   `evidence` array.
4. **F3 — repair the probe samples (IMPLEMENTED):** removed the 2 stale
   commandcode keys and 2 opencode-go rows; added re-keyed commandcode
   samples (`commandcode/zai-org/GLM-5.2`, `commandcode/zai-org/GLM-5.3`)
   sourced from orcarouter (`z-ai/glm-5.2` / `z-ai/glm-5.3` → 1,000,000,
   matching the re-sourced table values); re-pointed the
   `tokenharbor/deepseek-v4-flash` sample from bazaarlink to orcarouter
   (2-of-3 upheld the row; bazaarlink drifted and is covered by the WARN
   path). LIVE result: probe exits 0, `14 sampled rows match vendor
   rosters`.
5. **Tests (IMPLEMENTED, RED-first).** New pin suite
   `cli/src/utils/openrouter-models/__tests__/commandcode-glm-roster-casing.test.ts`
   — observed 1 pass / 4 fail against the pre-change tree, 5/5 after:
   (a) the two catalog ids use roster casing; (b) lowercase spellings are
   absent from catalog, protocol map, and fallback table; (c) every
   commandcode id keeps protocol-map + fallback-table coverage; (d) the
   re-keyed rows resolve 1,000,000 in table and fetcher; (e) the registry
   entry documents the fail-open boundary. The realign suite's GLM leg and
   the context-window-fallbacks pin moved to the new spellings/values.
   New rot-class pins in `window-truth.test.ts` (FID-2026-0928-010
   describe): every probe sample key must exist as a fallback-table row,
   and no removed-provider sample may reappear — a future re-key that
   strands a sample fails in-process instead of rotting the alarm.
6. **F2 documentation (IMPLEMENTED):** the fail-open boundary is recorded
   as a comment on the commandcode registry entry
   (`common/src/providers/registry.ts`, pinned by test leg (e)); the
   commandcode exception-manifest entry gains an evidence path to the
   catalog surface (the gitignored scratchpad probe is deliberately NOT an
   evidence path — `validateProviderAudit` fs-checks every path).

## Adversarial self-check (pre-audit)

- **Claim: the drift is isolated to two rows.** Verified by roster-membership
  cross-check over all casing variants (Kimi/Qwen/deepseek/xai all match); the
  two GLM rows are the only mismatches.
- **Claim: windows were re-sourced conservatively.** Direction check:
  1,048,576 → 1,000,000 and 1,310,720 → 1,000,000 are both reductions; a
  gateway cannot serve more than its upstream; the comment trail keeps the
  upstream votes.
- **Claim: no consumer was missed.** Grep for `commandcode/zai-org` across
  the repo returns exactly the five code surfaces (all edited) plus two
  historical doc lines (`docs/Model Context Window Review.md:247-248`, a
  frozen audit record of the *old* heuristic — deliberately untouched).
- **Claim: the probe samples now match reality.** The gate catches the rot
  class structurally (sample-keys-in-table pin) and the probe passes LIVE.
- **Attempted and blocked:** direct wire proof of case sensitivity (1-token
  chat probes) — no `COMMAND_CODE_API_KEY` locally; every id returned 401
  including the control. Operator-key-blocked; recorded in F1.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: test common/src/__tests__/model-config.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/commandcode-glm-roster-casing.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/fid-2026-0916-004-realign.test.ts
- gate: test cli/src/utils/__tests__/context-window-fallbacks.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:dfd0f7b490d7b202e285c7885c865abb1bfd49ca49a462699a064bb8de6b50d9
- verified: 2026-09-28T21:43:54.033Z
- typecheck common: exit 0
- typecheck cli: exit 0
- test common/src/__tests__/model-config.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/commandcode-glm-roster-casing.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/fid-2026-0916-004-realign.test.ts: exit 0
- test cli/src/utils/__tests__/context-window-fallbacks.test.ts: exit 0
- quality: exit 0

## Step Status

- [x] Proposed Solution step 1 — re-key the two GLM rows across the three data surfaces (`providers.ts`, `provider-protocols.ts`, `context-window-table.ts`)
- [x] Proposed Solution step 2 — re-source the two rows' windows to 1,000,000 (gateway publication, roster probe 2026-09-28)
- [x] Proposed Solution step 3 — document the fail-open boundary (registry comment + manifest evidence path to the catalog surface)
- [x] Proposed Solution step 4 — repair the window-truth probe samples (LIVE: 14/14 match, exit 0)
- [x] Proposed Solution step 5 — RED-first pin suite (1 pass/4 fail before → all green after) + updated realign/context pins + rot-class pins
- [x] Proposed Solution step 6 — F2 documentation pins (registry comment asserted by the pin suite)

## Perfection Loop

### Missed Questions

1. **Should the lowercase spellings be kept as aliases alongside the
   uppercase ids?** No. The roster serves exactly one casing; a dead alias
   doubles picker surface and the protocol map would carry unmapped keys.
   The realign precedent is replace-in-place.
2. **Is re-sourcing the windows to the gateway publication a silent guess?**
   No — it is a measured value from the serving gateway's own roster
   (`context_length` = 1,000,000 for both rows, 2026-09-28), strictly
   conservative relative to upstream votes, and the comment trail preserves
   the upstream numbers.
3. **Why not make the probe's commandcode samples hit the commandcode
   roster directly?** The probe's contract is "fallback table vs the two
   keyed rosters that publish context windows" (bazaarlink, orcarouter).
   Adding a third source is a contract change; the orcarouter leg already
   carries `z-ai/glm-5.2`/`5.3` at 1,000,000, which is exactly the
   re-keyed row value. If the gateway's publication should become an
   authoritative source later, that is its own decision record.
4. **Does the fail-open boundary warrant an operator escalation?** The
   2026-09-18 gauntlet already routed it as "FID candidate, operator call";
   this record IS that call being made with current evidence: documentation
   only, because there is no repo-side enforcement surface for a vendor's
   auth posture.
5. **What if the vendor is actually case-insensitive on the wire?** Then the
   re-key is still correct (catalog == roster spelling is the invariant
   every other provider entry follows) and the window re-source still
   reflects the binding advertisement. The operator-key-blocked wire probe
   only affects the severity wording, not the fix.

## Code Verification Evidence

- [x] Files referenced in Detailed Description exist at the cited lines — re-verified at implementation
- [x] Implementation matches Proposed Solution steps 1-6
- [x] Typecheck/tests/lint pass on touched workspaces — see Verification Receipt
- [x] LIVE probe artifacts retained under dev/scratchpad/active/ with usage headers (`t62f1-commandcode-probe.ts`, `t62f1-window-sources.ts`, `t62f1-case-sensitivity.ts`)
- [x] Status reflects reality: all six steps implemented and gated; no residual named

## Lessons Learned

1. **A test pin can convert a defect into an invariant.** The realign suite
   pinned the shipped lowercase spellings, so the defect survived two
   regression batteries. When a pin fails against a LIVE vendor roster, ask
   whether the pin is protecting the contract or embalming the mistake — the
   FID's own CHANGELOG text said uppercase.
2. **A drift alarm is only as alive as its own sample list.** The
   window-truth probe had been structurally red since FID-2026-0916-004;
   nobody re-ran it because it wasn't in any gate. The fix pins the samples
   against the table in-process, so the next re-key that strands a sample
   fails a gate instead of rotting silently.
3. **Documentation needs a home that outlives session summaries.** The
   fail-open boundary lived only in a 2026-09-18 summary; encoding measured
   vendor facts as comments on the provider entry (the tokenrouter 503
   pattern) is what makes them travel.

## Resolution

- **Resolved by:** this record — Proposed Solution steps 1-6 implemented in
  full; no residual named.
- **Resolution date:** 2026-09-28
- **Verified by:** `bun run fid:verify --write` (all 7 declared gates run
  LIVE at stamp time: typecheck common + cli, five test suites, quality),
  plus the LIVE vendor probes retained in `dev/scratchpad/active/t62f1-*`.
- **Verification date:** 2026-09-28
- **Verification receipt:** see `### Verification Receipt` below.
- **Closed by:** operator session directive ("work the remaining level-3
  register items") executing the register's "candidate FID, operator call"
  routing; closure commit pending (G2) — hash to be recorded at push.
- **Close date:** 2026-09-28
- **Archived:** yes — moved to `dev/fids/archive/` on close.
- **CHANGELOG entry:** yes — under 0.0.34.
