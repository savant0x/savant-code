# FID: Zylo's keyless catalog is unstated in the SDK environment reference

**Filename:** `FID-2026-1018-001-zylo-sdk-env-row.md`
**ID:** FID-2026-1018-001
**Severity:** low
**Status:** closed
**Created:** 2026-10-18 00:20
**Automation level:** 3
**YAGNI-Compliance:** Verified — one documentation row in an existing table. No
code, dependency, generator or schema change.

---

## Summary

`docs/sdk-overview.md` documents the gateway key variable for every provider
that needed a note, including rows for `BLAZERAIL_API_KEY` and
`RIVER_AI_API_KEY`, but not `ZYLO_API_KEY`. Zylo's key is present in the
aggregate gateway-key row and in `.env.example`, so nothing is functionally
missing — but the one thing that distinguishes Zylo from its neighbours is
undocumented: its **catalog is public and keyless**, and the key is only for
inference. A reader with the variable in hand cannot tell that from the docs.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript strict, Bun 1.3.14
- **Commit/State:** `main` at `c3fa12b6`

## Detailed Description

### Problem

The environment-variable reference carries per-variable annotation rows for the
special cases (`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`, the two newest
gateways). Zylo is a special case of a different kind — its live catalog
requires no credential — and that fact exists only in
`common/src/providers/registry-partitioned-5.ts:177-190` (the registry comment)
and in the FID record, not in the surface a user reads when setting the
environment.

### Expected Behavior

The SDK environment reference states, next to the other gateway annotations,
that `ZYLO_API_KEY` authenticates inference while the catalog is fetched
publicly, and names the base URL. The generated artifacts stay untouched and
unchanged.

### Root Cause

The row was omitted when Zylo was added: the provider shipped with generated
documentation (README table, release README, `.env.example`, registry table)
and hand-maintained pages, but the SDK page's annotation table was updated only
for River in the same change.

### Evidence

```text
$ grep -nE "ZYLO|RIVER_AI" docs/sdk-overview.md
310:| `TOKENROUTER_API_KEY`, … `RIVER_AI_API_KEY`, `ZYLO_API_KEY`, … | Gateway provider keys; …
313:| `RIVER_AI_API_KEY` | River AI gateway; authenticated live catalog and OpenAI-compatible chat at `https://api.river.ai/v1` |
(no `ZYLO_API_KEY` annotation row)

$ grep -n zylo common/src/providers/registry-partitioned-5.ts
177:  zylo: {
181:    // Public catalog: keyless/authenticated bodies identical, 126 text rows.
```

## Impact Assessment

### Affected Components

- `docs/sdk-overview.md`

### Risk Level

- [ ] Critical
- [ ] High
- [ ] Medium
- [x] Low: documentation completeness only; no runtime behavior

## Proposed Solution

### Approach

Add one row immediately after the River annotation, stating the keyless catalog
and the base URL, matching the wording style of its neighbours.

### Steps

1. Add the `ZYLO_API_KEY` annotation row. — implemented
   (`docs/sdk-overview.md:314`)
2. Re-run the provider-doc drift check and the generated-doc check; both must
   stay green and the generator must report every artifact unchanged. —
   implemented (all four artifacts `unchanged`, `--check` reports up to date)
3. Re-run the declared gates, then close and archive. — implemented (3/3 gates,
   receipt stamped)

### Verification

`bun scripts/provider-docs-counts-drift.ts` stays green (the row is not a
generated artifact), `bun run generate:provider-docs` reports all four
artifacts unchanged, markdownlint and Prettier pass, and the row names both the
keyless catalog and the inference URL.

## Verification Gates

- gate: probe scripts/provider-docs-counts-drift.ts
- gate: test common/src/providers/__tests__/provider-registry-setup.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:2389d7dde4f18c2f32066dbfad9934dfa6851ec2eeac6671a658598bc71dd90f
- verified: 2026-10-18T04:30:07.577Z
- probe scripts/provider-docs-counts-drift.ts: exit 0
- test common/src/providers/__tests__/provider-registry-setup.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** The distinguishing property of Zylo's credential is absent from the
  page a user reads while configuring it.
- **GREEN:** One annotation row, in the established style.
- **AUDIT:** The row states a fact already true in the registry and pinned by
  `zylo-catalog.test.ts` (keyless fetch, no Authorization header).
- **ADVERSARIAL:** This cannot drift from code silently: the claim is asserted
  by the catalog test, not by prose alone.
- **CHANGE DELTA:** 100% (initial authoring).

### Missed Questions

1. **Should the generated table be changed instead?** No — it is generated from
   the registry, has no annotation column, and would need a generator change for
   one sentence.
2. **Does the row duplicate `.env.example`?** No: the example lists the variable
   with a placeholder value; it cannot explain that the catalog is keyless.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** `00fa0959`
- [x] **File:line ranges:** `docs/sdk-overview.md:314` (the row)
- [x] **Gate output:** stamped above — provider-doc drift probe, registry setup
      suite and quality all exit 0
- [x] **Reproducibility:** `grep -n ZYLO_API_KEY docs/sdk-overview.md`;
      `bun run generate:provider-docs` reports every artifact unchanged
- [x] **Step statuses:** Steps 1–3 implemented

## Resolution

- **Closed Date:** 2026-10-18 00:35
- **Fix Description:** `docs/sdk-overview.md` now carries a `ZYLO_API_KEY`
  annotation row stating that the key authenticates inference only while the
  live catalog is public and fetched without a credential, naming
  `https://api.zyloai.net/v1`.
- **Tests Added:** none — documentation only; the behavior it describes is
  already pinned by `cli/src/utils/openrouter-models/__tests__/zylo-catalog.test.ts`
- **Verification Evidence:** `fid:verify --write` ran 3/3 declared gates with
  exit 0 (provider-doc count drift probe, provider registry setup suite,
  quality). `bun run generate:provider-docs` reported all four generated
  artifacts unchanged; `generate:provider-docs:check` reports up to date;
  markdownlint and Prettier pass.
- **Archived:** 2026-10-18 00:35

## Lessons Learned

Generated documentation cannot carry a nuance it has no column for. When a
provider's credential and its catalog have different requirements, that
difference belongs in the hand-maintained surface next to the variable, and it
should point at the test that keeps it true.
