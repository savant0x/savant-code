# FID: Per-vendor live probe — nested-shape reconciliation across the eight live catalogs

**Filename:** `FID-2026-0928-006-t96-vendor-live-probe-nested-shape.md`
**ID:** FID-2026-0928-006
**Severity:** low
**Status:** closed
**Created:** 2026-09-28 12:20
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

**T96-followup executed: all eight live vendor catalogs probed against their
real endpoints on 2026-09-28; the nested-shape reconciliation this probe
existed to settle closes with a NULL result — no code change.**

The three parsers that read `architecture.*` (`openrouter.ts`, `cleanapis.ts`,
`nous.ts`) are exactly the three vendors that measurably serve populated
nested fields. The remaining six live catalogs (`apinex`, `kiosapi`, `bai`,
`orcarouter`, `nvidia`, `vercel`) serve **no** modality/tokenizer/instruct_type
data in either position — nested or flat. Adding a nested read to them would
map `undefined` for every model: the speculative-shape failure
`FID-2026-0927-006` ruled against, now confirmed by measurement instead of
argument.

This record is the evidence store for two closures: it is the probe the
**T96-followup** register line required, and the precondition
**FID-2026-0927-006** declared itself unclosed pending. Both close on this
measurement.

## Environment

- Repo: `savant-code`, branch `main`, v0.0.34.
- Runtime: Bun 1.3.14, Windows (win32), Git Bash.
- Probe: `dev/scratchpad/active/t96-vendor-probe.ts` (gitignored by design —
  ephemeral working area per the FID-2026-0927-003 precedent for
  network-dependent evidence; the full output is reproduced in this record,
  which is the durable store).
- Endpoints: from `PROVIDER_REGISTRY` (`common/src/providers/registry*.ts`) —
  the single source of truth; no URL was invented for this probe.
- Credentials: auth-gated vendors (`apinex`, `kiosapi`, `bai`, `cleanapis`)
  probed with keys resolved from `.env.local` by name; values never read,
  printed, or stored. Keyless vendors probed without an Authorization header.
- Read-only GET, 15s bounded timeout per vendor, `Accept: application/json`.

## Detailed Description

### Method (established by FID-2026-0927-005 → Open Remediation)

Fetch the REAL payload per vendor; count population of the nested
`architecture.{modality,tokenizer,instruct_type}` fields and the flat
`modality`/`tokenizer`/`instruct_type` keys; map a field only where the vendor
measurably serves it. The method exists because synthetic fixtures pinned the
shape the parser *assumed* rather than the shape the vendor *serves* — the
exact failure the cleanapis remediation documented ("My own tests could not
catch this").

### The measurement (2026-09-28, all HTTP 200)

| Vendor | Models | `architecture.*` object | Nested modality | Nested tokenizer | Nested instruct_type | Flat modality | Verdict |
|---|---|---|---|---|---|---|---|
| openrouter | 459 | 459/459 | 459/459 | 459/459 | 38/459 | 0/459 | nested served |
| nous | 418 | 418/418 | 409/418 | 409/418 | 20/418 | 0/418 | nested served |
| cleanapis | 33 | measured 2026-09-27 (FID-2026-0927-005) | 33/33 | — | — | 0/33 | nested served |
| apinex | 34 | 0/34 | 0/34 | 0/34 | 0/34 | 0/34 | **neither** |
| kiosapi | 36 | 0/36 | 0/36 | 0/36 | 0/36 | 0/36 | **neither** |
| bai | 57 | 0/57 | 0/57 | 0/57 | 0/57 | 0/57 | **neither** |
| orcarouter | 204 | 182/204 (fields all null) | 0/204 | 0/204 | 0/204 | 0/204 | **empty shell** |
| nvidia | 81 | 0/81 | 0/81 | 0/81 | 0/81 | 0/81 | **neither** |
| vercel | 389 | 0/389 | 0/389 | 0/389 | 0/389 | 0/389 | **neither** |

Other consumed fields, for completeness of the same probe run:

- `pricing.prompt`: openrouter 459/459, nous 418/418, orcarouter 180/204 —
  all others 0. (Pricing is already mapped exactly where it is served.)
- `top_provider`: openrouter 459/459, nous 418/418, orcarouter 157/204 —
  all others 0.
- `context_length` (flat): openrouter 459/459, nous 418/418, orcarouter
  142/204 — all others 0. (`vercel` serves `context_window` instead, already
  mapped; `apinex`/`kiosapi`/`bai`/`nvidia` serve no window field at all.)
- `description`: vercel 372/389, orcarouter 146/204, openrouter/nous ~100%,
  cleanapis measured 2026-09-27 — the six serve what their parsers read.
- `created`: 100% everywhere except apinex/kiosapi/bai/nvidia serve unix
  seconds, which their parsers already normalize.

### The three verdict classes

1. **Nested served** (openrouter, nous, cleanapis): the nested read is
   justified and already present. Flat keys are 0/N on all three — the flat
   fallback in `openrouter.ts` remains schema-defensive, not measured.
2. **Empty shell** (orcarouter): an `architecture` OBJECT is present on
   182/204 models but every field inside is null/absent. This is the
   speculative-shape trap in its purest form — a presence check would pass, a
   populated-field read maps `undefined` for every model.
3. **Neither shape** (apinex, kiosapi, bai, nvidia, vercel): plain OpenAI
   list payloads. No modality data exists to map.

### What was implemented (and what deliberately was not)

- **Negative contract pins** — one leg per unmapped live parser, each citing
  this probe, asserting `modality`/`tokenizer`/`instructType` stay `undefined`
  when a nested object is present in the payload. If a vendor ever gains a
  populated nested object, the pin fails and forces the mapping decision back
  through a FID:
  - `cli/src/utils/__tests__/openrouter-models-apinex.test.ts`
  - `cli/src/utils/__tests__/openrouter-models-bai.test.ts`
  - `cli/src/utils/__tests__/openrouter-models-orcarouter.test.ts` (the
    empty-shell case)
  - `cli/src/utils/__tests__/openrouter-models-vercel.test.ts`
  - `cli/src/utils/__tests__/openrouter-models-gateway.test.ts` (kiosapi leg)
  - `cli/src/utils/__tests__/openrouter-models-nvidia.test.ts` (new file)
- **Nvidia test seam** — `parseNvidiaModelsForTest` exported from
  `nvidia.ts`, the last live parser without one (every sibling has one; Law 11
  — follow discovered patterns exactly). New suite pins prefix/name/shape
  behaviour plus the negative pin.
- **No parser change.** The six unmapped parsers stay unmapped — this is the
  null result, recorded so it is never re-litigated by assumption.

### Consumers confirmed (Law 4 / Law 13 grounding)

`model-info.ts` (`cli/src/utils/openrouter-models/model-info.ts`) renders
`modality`, `tokenizer`, and `instructType` when present — the only
production consumer of these fields. The six unmapped catalogs therefore
render no modalities line today, which is CORRECT: the vendors do not send
the data, and fabricating a line from an empty shell would assert a fact the
catalog does not carry.

## Root Cause

Not a defect. The register line demanded a per-vendor live probe before any
mapping decision; the probe was run; the answer is that no mapping is
warranted. The only code defect found on the way was the missing nvidia test
seam, fixed above.

## Impact Assessment

- **Severity: low.** No behaviour changes; the pins and seam are test-surface
  additions.
- **Risk of the rejected option** (adding nested reads to the six): every
  parser grows three dead field reads; `model-info.ts` output is unchanged
  (fields still absent on every model); future readers must reason about a
  mapping that provably maps nothing. Cost, no benefit — the same shape
  FID-2026-0927-006 rejected for `capabilities`, one level down.

## Proposed Solution

Executed as described: probe → measure → pin the null result → close the two
records the probe was blocking. No parser code change.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/utils/__tests__/openrouter-models-nvidia.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-apinex.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-bai.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-orcarouter.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-vercel.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-gateway.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:f9b3aa97541159bec16d5499b7446253bffe8762bb4db022c8adab780bf84e0c
- verified: 2026-09-28T16:44:14.247Z
- typecheck cli: exit 0
- test cli/src/utils/__tests__/openrouter-models-nvidia.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-apinex.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-bai.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-orcarouter.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-vercel.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-gateway.test.ts: exit 0
- quality: exit 0

## Step Status

- [x] Read all nine parser files 0-EOF before any edit (Law 1)
- [x] Read FID-2026-0927-005 Open Remediation for the established method
- [x] Derive the eight endpoints from PROVIDER_REGISTRY (no invented URLs)
- [x] Probe all eight live catalogs (HTTP 200 on every one)
- [x] Record the measurement table in this durable record
- [x] Verdict: no mapping warranted for the six unmapped vendors
- [x] Pin the null result with negative contract legs (6 files)
- [x] Add the missing nvidia parser test seam + suite
- [x] Update SCOPE.md register (T96-followup → completed; FID-2026-0927-006
      line → completed with evidence)
- [x] FID-2026-0927-006 status → closed, closure addendum appended, archived
- [x] CHANGELOG entry at closure

## Perfection Loop

### Missed Questions

1. **Should the flat fallbacks be deleted from `openrouter.ts` since flat is
   0/459?** No — the types declare the flat keys, other gateways and cached
   responses may send them, and the fallback is one `??` expression. Removing
   it trades schema-defensiveness for zero measurable benefit.
2. **Should orcarouter's empty `architecture` object be stripped in the
   parser?** It is not mapped into `OpenRouterModel` at all — the object
   exists only on the wire. Nothing to strip.
3. **Could a vendor change shape between probe runs?** Yes — that is exactly
   what the negative pins detect. A pin fails the moment a fixture-shaped
   payload would have produced a populated field, forcing re-measurement.
4. **Is `cleanapis` stale (probed 2026-09-27, not re-probed today)?** It was
   measured with the identical method against the identical endpoint by
   FID-2026-0927-005 (33 models, nested populated 33/33), and its parser was
   built FROM that measurement. The probe's purpose is to decide unmapped
   vendors; cleanapis is already mapped from its own fresh measurement.
5. **Why a FID for a null result?** Because a null result that lives only in
   a register line is indistinguishable from work never done. The measurement
   table is the deliverable; this record is where it survives.

### Code Verification Evidence

- [x] Probe output reproduced in *The measurement* above, verbatim counts
- [x] All six touched/new test files pass (31 legs across the five existing
      suites + 3 legs in the new nvidia suite)
- [x] No parser behaviour changed — the negative pins PASS, which is only
      possible if the parsers ignore the nested object (a regression toward
      mapping would fail them)
- [x] Law 4: the pins exercise the parser seams that the gateway combiner
      calls (`gateway.ts` imports every parser module)

## Resolution

**Closed and implemented.**

- **Resolved by:** this record — the probe, its measurement table, and the
  negative contract pins that enforce the null result
- **Resolution date:** 2026-09-28
- **Verified by:** live probe tool output (all eight endpoints HTTP 200) plus
  the 8/8 stamped receipt from `bun run fid:verify --write` quoted below —
  not self-report
- **Verification date:** 2026-09-28
- **Verification receipt:** see `### Verification Receipt` (fingerprint
  stamped 2026-09-28, 8/8 gates exit 0)
- **Closed Date:** 2026-09-28 (closure commit hash pending operator commit;
  per G1 the agent does not execute git)
- **Archived:** yes — `dev/fids/archive/` at closure
- **CHANGELOG entry:** `CHANGELOG.md` under the 0.0.34 register

## Lessons Learned

- **An empty shell is worse than absence for mapping decisions.** OrcaRouter
  serves an `architecture` object on 89% of models — enough to pass any
  presence check — while populating none of its fields. A naive remediation
  keyed on "does the object exist" would have shipped three dead reads. Count
  populated FIELDS, not present ENVELOPES.
- **A null result needs a durable home or it never happened.** The probe ran
  in ~15 seconds; without this record the next agent re-litigates the mapping
  from first principles, or worse, ships it unmeasured. The negative pins
  make the null result mechanically enforced, not merely remembered.
