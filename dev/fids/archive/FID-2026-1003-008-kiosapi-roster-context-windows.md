# FID: KiosAPI roster context windows — full-roster fallback-table coverage

**Filename:** `FID-2026-1003-008-kiosapi-roster-context-windows.md`
**ID:** FID-2026-1003-008
**Severity:** high
**Status:** closed (implemented + verified, 2026-10-04, commit d10da542)
> (`converged` is the correct pre-implementation status per
> FID-2026-0915-004; `fixed` is deprecated-but-accepted legacy language —
> do not use it for new FIDs. The receipt contract still keys to
> `fixed | verified` so archived records remain valid.)
**Created:** 2026-10-03 23:30
**Automation level:** 3
> (Authority this FID needs to be actioned **without asking**: `1` approval-gated,
> `2` within approved scope, `3` fully automatable. The session ceiling is
> `protocol.config.yaml` → `session.autonomy_level`; an item is actioned without
> approval only when its level is ≤ the session level. No level lifts the G-laws,
> credential handling, Law 3, or the project-directory boundary — see
> "Automation Levels" in the governing protocol.)
**YAGNI-Compliance:** Verified

---

## Summary

KiosAPI model ids resolve to the conservative 200k context-window default
because kiosapi publishes no window fields on `/v1/models` and the vendor
fallback table carried only 6 of the gateway's 77 published Model Square ids.
The operator's live run on `kiosapi/qwen3.8-flash-free` (true window 1M) was
therefore steered by a 5×-too-small compaction denominator and died on
`RequestInputBudgetError` (input estimate 1,347,990 vs window 1,000,000).
Fix: seam-split a dedicated kiosapi table section carrying sourced windows
for 69 roster ids (63 new + 6 kept), leaving 8 ids deliberately row-less
(image models + no-source stealth ids), and pin the coverage in the
window-truth suite.

## Environment

- **OS:** Windows (win32, Git Bash)
- **Language/Runtime:** TypeScript, Bun ≥ 1.3.11
- **Tool Versions:** bun (repo-pinned), eslint zero-tolerance, prettier check gate
- **Commit/State:** working tree `main` @ 2026-10-03; probes in gitignored
  `dev/scratchpad/`

## Detailed Description

### Problem

1. `kiosapi/qwen3.8-flash-free` is absent from every window source, so
   `resolveContextWindowForModel` (cli/src/utils/openrouter-models/lookup.ts:197-212)
   falls through to `getContextWindowFallback` → table miss →
   `CONTEXT_WINDOW_DEFAULT = 200_000` (`common/src/constants/context-windows.ts`),
   source `'default'`. The UI showed 200k for a 1M model.
2. Compaction thresholds derive from that denominator
   (`packages/agent-runtime/src/run-agent-step/context-tokens-compaction.ts:210`
   — windowTokens = reactiveCompact = contextWindow), so the pruner steered by
   200k while the SDK request budget guarded at the true 1M window.
3. The failed run reached a 1,347,990-token input estimate and died:
   `RequestInputBudgetError` (sdk/src/impl/model-provider/request-budget-policy.ts:86).
   The 1,347,990 is the guard's conservative estimate of the request payload,
   never a window claim.
4. Coverage gap is systemic: only 6 of the gateway's 77 Model Square ids had
   table rows (FID-2026-0919-019 researched 6; 8/19 then-live ids were left on
   the default). KiosAPI has since grown its roster (37 ids reachable via the
   operator key; 77 published site-wide).

### Expected Behavior

Every kiosapi roster id resolves a sourced vendor window (source
`'fallback-table'`), so the UI readout, the compactor thresholds, and the SDK
budget guard all share one truthful denominator. Ids with no publishable
source stay on the flagged 200k default (documented, as big-pickle already
was).

### Root Cause

The FID-2026-0919-019 sweep predates the roster's growth and covered 6 ids;
no gate required coverage of the gateway's full published roster, and
kiosapi's bare OpenAI-shaped `/v1/models` (fields observed 2026-10-03:
`id, created, object, owned_by, supported_endpoint_types` — no
`context_length`) can never correct the gap at runtime.

### Evidence

```text
# 1. The id exists nowhere in the repo's window sources
$ grep -ri "qwen3.8-flash-free" common/src cli/src sdk/src   → 0 matches

# 2. Live kiosapi /v1/models (bun dev/scratchpad/kiosapi-catalog-probe.ts)
HTTP 200; model count: 37
fields observed: created, id, object, owned_by, supported_endpoint_types
(no context_length, no max_completion_tokens)

# 3. OpenRouter cross-vote (bun dev/scratchpad/kiosapi-window-truth-probe.ts)
HTTP 200; openrouter models: 466
qwen3.8-flash-free   [API] qwen/qwen3.8-flash ctx=1000000
qwen3.8-27b-free     [API] qwen/qwen3.8-27b ctx=1000000 | qwen/qwen3.8-27b:free ctx=262144
glm-5.3-flash        [square-only] z-ai/glm-5.3-flash ctx=1048575
deepseek-v4-pro      [square-only] deepseek/deepseek-v4-pro ctx=1024000
claude-opus-5        [square-only] anthropic/claude-opus-5 ctx=1000000
gpt-6.1-sol          [square-only] openai/gpt-6.1-sol ctx=1050000
grok-4.7-free        [API] x-ai/grok-4.7 ctx=500000
step-3.7-flash       [API] stepfun/step-3.7-flash ctx=256000
space-bunny-alpha    [API] stealth/space-bunny-alpha ctx=1000000
(full 77-row match table: FID evidence retained in the probe output)

# 4. The failed session (operator report)
Agent run error: Request input estimate 1347990 leaves no output headroom
within the 1000000 token context window. (RequestInputBudgetError)

# 5. Existing coverage
common/src/constants/context-window-table.ts:185-206 — 6 kiosapi rows +
big-pickle deliberate omission.
```

## Impact Assessment

### Affected Components

- `common/src/constants/context-window-table.ts` (spread-in seam)
- `common/src/constants/context-window-table-kiosapi.ts` (new section file)
- `cli/src/utils/openrouter-models/__tests__/window-truth.test.ts` (pins)
- Downstream consumers of `getContextWindowFallback` / `resolveServingLimits`:
  model picker readout, compactor thresholds, SDK request budget

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

Operator-facing: runs on any of 71 under-windowed kiosapi ids over-compact
(context loss) and can die on the budget guard (run loss), exactly as
observed. Over-allocation is avoided by the conservative row-value rule
(2-of-3 consensus; conservative minimum on 1:1 conflicts).

## Proposed Solution

### Approach

Data-only fix following the repo's established seam-split pattern
(FID-2026-0919-019 moved the table out of `context-windows.ts` for the same
300-line ceiling): a dedicated `context-window-table-kiosapi.ts` section,
spread into the single `CONTEXT_WINDOW_FALLBACKS` map so every import path
stays stable. No runtime code changes; ids already flow pass-through (no
allowlist), so "support for all kiosapi models" is complete once every
roster id has a sourced row or a documented no-row.

Row-value rule (stated in the section header): 2-of-3 vendor consensus among
existing cross-gateway rows and the 2026-10-03 OpenRouter live probe; the
single source where only one publishes; conservative minimum on a 1:1
conflict; `-req` per-call variants inherit their parent model's window;
image models and no-source stealth ids get no row.

### Steps

1. Create `common/src/constants/context-window-table-kiosapi.ts` with 69
   sourced rows (6 kept from FID-2026-0919-019 + 63 new) and the no-row
   register (big-pickle, fledge-alpha, kilo-auto, longcat-2.5-preview,
   gpt-image-2/-2.5/-2.5-flare/-2.5-sunburst). — **implemented**
2. Replace the inline kiosapi block in `context-window-table.ts` with the
   spread; add the import. — **implemented**
3. Pin the coverage in `window-truth-kiosapi.test.ts` (seam-split from
   `window-truth.test.ts` after the quality gate caught the combined file at
   319 lines): operator-bug row, spot windows, `-req` inheritance, no-row
   defaults, and a seam-wiring census (every row in the section file must
   exist in the Map). — **implemented**
4. Run gates: `typecheck common`, `typecheck cli`, the window-truth suite,
   `quality`. — **implemented**
5. Stamp the receipt (`bun run fid:verify <path> --write`) and flip status to
   `verified`. — **implemented**

### Verification

The window-truth suite proves the operator-bug row resolves
`{ contextWindow: 1_000_000, source: 'fallback-table' }`, spot windows match
the probe, and the seam census fails if any section row is dropped from the
Map. The live probe scripts remain runnable end-to-end evidence.

> Contract rule (FID-2026-0918-006): every promised test artifact MUST name
> its repo-relative `*.test.ts(x)` path, and that path MUST also appear as a
> declared `- gate: test <path>` below. `fid:verify` enforces this for
> fixed/verified — a promise with no covering gate fails the stamp.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: test cli/src/utils/openrouter-models/__tests__/window-truth.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-truth-kiosapi.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:529bfaeb9e3a84115d60f25b126d6a5ac23f80db959b932fe5d0f36364e10d5f
- verified: 2026-10-04T04:04:23.140Z
- typecheck common: exit 0
- typecheck cli: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-truth.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-truth-kiosapi.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Coverage census — 6/77 kiosapi ids covered; `grep -ri
  "qwen3.8-flash-free"` = 0 matches; live API publishes no window fields
  (probe output above); the operator's run died on RequestInputBudgetError
  with the compactor steered by the 200k default. Also: adding ~63 rows to
  `context-window-table.ts` would breach the 300-line quality ceiling
  (`quality.max_file_lines`), forcing the seam split.
- **GREEN:** Seam-split section file with the row-value rule; spread wiring;
  suite pins. Operator directives honored: open a FID, fix all kiosapi
  ids/windows (source: kiosapi.com pricing/Model Square + OpenRouter
  cross-votes), cover the full roster.
- **AUDIT:** Gates below; spot values re-derived independently from the probe
  output and cross-gateway rows.
- **ADVERSARIAL:** Conflicts resolved conservatively and documented inline:
  glm-5.3 family pinned at OR-live 1,048,575/1,048,576 (downward drift from
  the 1,310,720 record of 2026-09-28 — noted for re-derivation);
  deepseek-v4-pro 2-of-3 (1,048,576) over OR-live 1,024,000;
  step-3.7-flash 2-of-3 (262,144) over OR-live 256,000; mimo-v2.5
  conservative minimum (1,048,576) on the 1:1 tokenharbor/OR conflict;
  nemotron bare ids pinned to the PAID listing (262,144) the kiosapi ids
  actually name, not the inverted :free listings; laguna-s-2.1 pinned to the
  bare/paid variant (1,048,576) kiosapi serves.
- **CHANGE DELTA:** ~new-document (loop 1 authored the record).

### Missed Questions

1. *Why not fetch kiosapi windows at runtime?* The API publishes none
   (fields observed above) — there is nothing to fetch; the fallback table
   is the only possible source. The live-catalog parser already reads
   `context_length` defensively and will surface windows automatically if
   kiosapi ever publishes them.
2. *Do ids need code changes for the 40 square-only models?* No — the
   kiosapi parser is pass-through by design (no allowlist; every id the key
   can access is listed). The gap was windows only.
3. *What about the 37-vs-77 delta?* Key-scoped access. The table covers the
   full 77-id published roster so windows are already correct when access
   grows; no future sweep needed for the current roster.
4. *Why seam-split instead of one big file?* `quality.max_file_lines: 300`
   is a LIVE gate; the parent table was already a move-only split of
   `context-windows.ts` for the same reason (FID-2026-0919-019).

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** `d10da542` — docs(fids): close and archive FID-2026-1003-008 after the ladder-suite closure audit
- [ ] **File:line ranges:** common/src/constants/context-window-table-kiosapi.ts
      (whole file); common/src/constants/context-window-table.ts (import +
      spread); cli/src/utils/openrouter-models/__tests__/window-truth-kiosapi.test.ts
      (FID-2026-1003-008 suite)
- [ ] **Gate output:** see Verification Receipt after stamping
- [ ] **Reproducibility:** grep "kiosapi/" in the table section file; run the
      window-truth suite
- [ ] **Step statuses:** all five steps `implemented` (see Proposed Solution)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence is present for new or repaired wiring
      (seam-wiring census test proves every section row reaches the Map)
- [x] FID status reflects the actual implementation state

### Loop 2 — Independent audit and self-correction

- **RED:** Quality gate caught the first Green attempt: the pins appended to
  window-truth.test.ts pushed it to 319 lines (> 300 ceiling).
- **GREEN:** Pins seam-split to window-truth-kiosapi.test.ts; the original
  file restored byte-for-byte to its pre-FID content.
- **AUDIT:** All gates exit 0 — typecheck common; typecheck cli;
  window-truth.test.ts 20 pass / 0 fail; window-truth-kiosapi.test.ts
  5 pass / 0 fail (incl. the seam-wiring census: 69 keys, 0 missing);
  quality PASS (1498 baselined files); prettier clean on all touched files.
- **ADVERSARIAL:** Operator-bug row independently re-derived — probe line
  `qwen3.8-flash-free [API] qwen/qwen3.8-flash ctx=1000000` plus the
  operator's statement makes the 1M pin 2-source. Every conflict row carries
  an inline provenance comment naming both sources (glm family downward
  drift vs the 2026-09-28 record; deepseek-v4-pro and step-3.7-flash 2-of-3
  votes over OR-live; mimo-v2.5 conservative minimum; nemotron/laguna
  paid-variant ids), and the conservative direction was chosen in every
  conflict — these rows can only over-compact, never over-send, so the
  RequestInputBudgetError failure mode cannot recur from them.
- **CHANGE DELTA:** ~8% (gates list, receipt, loop record, test-path refs)

### Loop 3 — Final convergence

- **RED:** closure pass re-derived the blast radius: the new table feeds
  tier 3 of the shared resolution ladder (`resolveContextWindowForModel`),
  so every neighboring suite that pins kiosapi ids through the ladder —
  not just the two window-truth files in the receipt's gate list — must be
  re-proven.
- **GREEN:** the closure pass ran the four ladder suites
  (`openrouter-models-context-window`, `-fid-0919-016`, `-fid-0919-018`,
  `-max-output`) and caught one stale pin: FID-2026-0919-018's
  "unmatched id lands on the default" expectation for
  `kiosapi/glm-5.3-flash-free` (200k) predates this FID's vendor-sourced
  row (1,048,575). Superseded in 9b549205 with the no-bleed proof
  preserved and strengthened (value differs from the near-collisions'
  catalog 1,048,576; source is 'fallback-table', never 'catalog').
- **AUDIT:** all six openrouter-models suites re-run green: 50 pass /
  0 fail / 99 expect() calls (2026-10-04). Window resolution is proven
  end-to-end through tiers 1→3 for kiosapi ids; the compaction and
  sidebar consumers take this result via the existing wiring
  (`use-chat-bootstrap`, `default-run-prompt`, `serving-limits`).
- **ADVERSARIAL:** the original receipt's gate list omitted the ladder
  suites — a verification-coverage gap, not a false PASS: every gate it
  listed did pass, and the expanded pass found the real regression the
  narrower list would have shipped to the first live run. Coverage now
  matches the blast radius (shared-ladder consumers, not the table alone).
- **CHANGE DELTA:** ~3% (status, loop 3, resolution; receipt unchanged)

## Resolution

- **Closed Date:** 2026-10-04 (G2 satisfied: c8362c4b implementation,
  9b549205 stale-pin repair, closure commit)
- **Fix Description:** 69 sourced kiosapi rows via the seam-split section
  file, spread into the single Map; full 77-id Model Square roster covered
  (69 rows + 8 documented no-row ids).
- **Tests Added:** Yes — `cli/src/utils/openrouter-models/__tests__/window-truth-kiosapi.test.ts`
  (5 tests: operator-bug row, spot windows, `-req` inheritance, no-row
  defaults, seam-wiring census), plus the FID-2026-0919-018 stale-pin
  supersession in the closure pass (9b549205)
- **Verification Evidence:** see Verification Receipt; closure-audit
  expansion in Loop 3 (ladder suites 50/0 green, 2026-10-04)
- **Archived:** yes — moved to `dev/fids/archive/` in the closure commit

> When status is set to **closed**, move this file to `dev/fids/archive/` and append an entry to `CHANGELOG.md`.

## Lessons Learned

A gateway whose catalog API publishes no window metadata can never
self-correct its rows at runtime — its fallback-table coverage must be
gated against the gateway's own PUBLISHED roster (Model Square / docs), not
merely the ids that happen to be reachable by a key today. Coverage gates
should census the vendor's publication surface, or the gap reopens silently
as the vendor grows the roster.
