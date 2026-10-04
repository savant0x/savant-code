# FID: Gateway context-window coverage sweep — every chat-surface silent-200k id sourced or registered

**Filename:** `FID-2026-1004-002-gateway-window-coverage-sweep.md`
**ID:** FID-2026-1004-002
**Severity:** high
**Status:** verified
> (`converged` is the correct pre-implementation status per
> FID-2026-0915-004; `fixed` is deprecated-but-accepted legacy language —
> do not use it for new FIDs. The receipt contract still keys to
> `fixed | verified` so archived records remain valid.)
**Created:** 2026-10-04
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

264 of 1,843 ids in the runtime gateway catalog
(`~/.savant-code/gateway-catalog.json`) resolve to the silent 200k context-window
default: the catalog row carries no `contextLength` AND the vendor fallback table
has no row. The operator-ruled fix (2026-10-04, structured ruling): source every
chat-surface gap from existing cross-gateway consensus rows (no fresh live
probe), register every remaining silent id with a documented reason, and close
the defect class permanently with per-section coverage pins, a registry-wide
coverage register + lint, a LIVE roster census for the no-publish gateways, and
censuses of the 66 gateway-advertised-exactly-200000 rows and the 5 zero-row
registry providers. 88 new rows (apinex 32, bai 41, orcarouter 6, nvidia 9);
~150 remaining silent ids documented in no-row registers.

## Environment

- **OS:** Windows (win32, Git Bash)
- **Language/Runtime:** TypeScript, Bun ≥ 1.3.11
- **Tool Versions:** bun (repo-pinned), eslint zero-tolerance, prettier check gate
- **Commit/State:** working tree `main` @ 2026-10-04; audit probe and output in
  gitignored `dev/scratchpad/active/` (re-runnable)

## Detailed Description

### Problem

A model id whose runtime catalog row has no `contextLength` and whose id has no
fallback-table row resolves through `getContextWindowFallback`
(`common/src/constants/context-windows.ts`) to `CONTEXT_WINDOW_DEFAULT = 200_000`
with source `'default'`. The UI shows 200k, the compactor prunes against a 200k
denominator, and the SDK request budget guards at 200k — while the real window
may be 1M+ (under-windowing: artificial restriction, the operator's standing
bar) or far smaller for legacy/small models (over-claim: request rejection
risk). This is the exact failure mode that killed a live run on
`kiosapi/qwen3.8-flash-free` (FID-2026-1003-008: `RequestInputBudgetError`,
input estimate 1,347,990 vs true 1M window).

Measured distribution of the 264 silent ids (probe re-run 2026-10-04, exit 0;
`dev/scratchpad/active/window-coverage-audit-output.txt`):

| provider | silent | classification |
| --- | --- | --- |
| apinex | 36 | all chat (32 sourced this FID; 4 no-source) |
| bai | 59 | 41 chat sourced; 18 no-source/non-chat |
| kiosapi | 3 | already the documented no-row register of FID-2026-1003-008 — no new work |
| nvidia | 81 | 9 chat sourced; 72 non-chat (embed/guard/reward/translate/parse/vision) + legacy chat without cross rows |
| orcarouter | 62 | 6 chat sourced (incl. `openai/gpt-5.5`, `gpt-5.5-pro`); 56 non-chat (tts/embed/image/video) + no-source chat |
| vercel | 23 | all non-chat (tts/transcribe/voice/whisper/stt) |

The audit's "166 non-chat" figure for nvidia/orcarouter/vercel undercounted
chat surfaces (the keyword classification missed flagships like
`orcarouter/openai/gpt-5.5` — its own catalog description says "features a
1M+ token…" while it resolves 200k). The per-id classification above supersedes
it. Separately, 66 catalog rows advertise exactly 200000 (indistinguishable
from a default leak) and 5 registry providers have zero runtime rows — both
censused under this FID.

### Expected Behavior

Every chat-surface id resolves a sourced window (source `'fallback-table'`) with
per-row provenance; every remaining silent id is a documented no-row (flagged
`'default'` with the reason in a register); the gap class cannot reopen silently
(coverage pins + registry lint + LIVE census).

### Root Cause (three independent causes)

1. **apinex and bai publish no window fields at all** — 0 of 36 and 0 of 59
   catalog rows carry `contextLength` (row shape observed: `{id, name,
   provider}`). Their fallback-table coverage was never authored.
2. **No-publish gateways can never self-correct at runtime** (kiosapi lesson,
   FID-2026-1003-008): when the API publishes nothing, only the fallback table
   can carry the truth, and nothing required that table to exist.
3. **The closed-world invariant was pinned per-touched-catalog only**
   (`window-truth.test.ts` covers tokenrouter/tokenharbor/commandcode;
   `window-truth-kiosapi.test.ts` covers kiosapi). Providers added later
   (apinex, bai) shipped with no coverage requirement, and no structural rule
   forces a window-coverage disposition for NEW registry providers.

### Evidence

```text
$ bun run dev/scratchpad/active/window-coverage-audit.ts   (exit 0)
LAYER A — runtime gateway catalog: 1843 rows (saved 2.6d ago)
SILENT-200k ids in the runtime catalog: 264 of 1843
rows advertising exactly 200000 (could be a real window or a default leak): 66
probe apinex/free/qwen-3.8-max: present in catalog, catalogWindow=NONE, tableWindow=NONE
  fallback resolution: {"contextWindow":200000,"source":"default"}
registry providers with ZERO rows in the runtime catalog: 5
  cloudflare, ollama, codecraft, xkiro, cleanapis
fallback table rows: 203 · default: 200000
table rows with a non-registry prefix: 0
```

Registry census (2026-10-04, 23 entries): 10 static catalogs, 12 live, 1 local
(ollama). Silent-row shapes: apinex/nvidia `{id,name,provider}`;
orcarouter adds `maxCompletionTokens` + description; vercel rows DO carry
`contextLength` (its 23 silent ids are all non-chat voice/tts/transcribe ids).

## Impact Assessment

### Affected Components

- `common/src/constants/context-window-table.ts` (orcarouter + nvidia rows, apinex/bai spreads)
- `common/src/constants/context-window-table-apinex.ts` (new section file)
- `common/src/constants/context-window-table-bai.ts` (new section file)
- `common/src/constants/window-coverage-register.ts` (new — registry-wide coverage dispositions + no-row register wiring)
- `cli/src/utils/openrouter-models/__tests__/window-truth-apinex.test.ts` (new)
- `cli/src/utils/openrouter-models/__tests__/window-truth-bai.test.ts` (new)
- `cli/src/utils/openrouter-models/__tests__/window-truth-router-gaps.test.ts` (new)
- `cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts` (new)
- `scripts/providers/verify-window-truth.ts` (LIVE census extension)
- Downstream consumers of `getContextWindowFallback` / `resolveServingLimits`:
  model picker readout, compactor thresholds, SDK request budget

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

Operator-facing: any of the ~155 chat-surface silent ids over-compacts (context
loss) or runs under a 5×-too-small budget denominator (run loss). Data-only fix;
no runtime code path changes.

## Proposed Solution

### Approach

Data-only fix following the established seam-split pattern
(FID-2026-1003-008). Line-budget math: the parent table is 193 lines; the
orcarouter (6) + nvidia (9) additions with provenance comments fit inline
(~250 projected, ceiling 300); apinex (32) and bai (41) get their own section
files spread into the single `CONTEXT_WINDOW_FALLBACKS` map.

**Row-value rule (operator-ruled sourcing: cross-gateway rows only — no fresh
live probe):**

- **Consensus (tier A):** ≥2 existing table rows for the same upstream model id
  agree → pin that value, cite the rows inline.
- **Single source (tier B):** exactly 1 existing table row → pin its value,
  inline `// NEEDS-REVIEW:` flag naming the source.
- **Conflict:** rows disagree → conservative minimum, both values cited
  (kiosapi FID precedent: the chosen direction can only over-compact, never
  over-send).
- **Dated/serving variants** (`-0813`, `-2026-04-23`, `-instant`, `-free` of a
  rowed id): inherit the parent row's value, flagged inline.
- **No cross-gateway row** (tier C): NO row — the id lands in a documented
  no-row register (grouped reasons: non-chat modality, stealth/no-source,
  rolling alias, legacy without cross rows) and keeps the flagged 200k default.
  Family/vendor-knowledge guesses are forbidden (FID-2026-0914-002 deprecation).

### Derivation table (GREEN — every value below is read off existing rows)

Cross-reference sources: `context-window-table.ts` (135 rows) +
`context-window-table-kiosapi.ts` (69 rows). Shorthand: BR=bazaarlink,
TR=tokenrouter, TH=tokenharbor, CC=commandcode, KIO=kiosapi section, INF=infron,
UNO=unorouter, HC=hcnsec, TB=tokenbom.

**Claude family → 1,000,000** (BR claude-fable-5/opus-4.6–5 + TR + TH + CC +
KIO rows agree):
apinex: claude-fable-5.1, claude-opus-5, claude-opus-5.5†(KIO), claude-sonnet-5,
claude-sonnet-5.5†(KIO), free/claude-opus-4.6, free/claude-sonnet-4.6.
bai: claude-fable-5, claude-fable-5.1, claude-opus-4.6, claude-opus-4.7,
claude-opus-4.8, claude-opus-5, claude-opus-5.5†(KIO), claude-sonnet-4.6,
claude-sonnet-5, claude-sonnet-5.5†(KIO).
bai/claude-haiku-4.5 → **200,000** (CC/claude-haiku-4-5-20251001, single†).

**DeepSeek → 1,048,576** (TH + CC + KIO (+TR pro, UNO pro) agree; HC's
1,310,720 is route-keyed, excluded as route-specific):
apinex: deepseek-v4-flash, deepseek-v4-pro, deepseek-v4.1-flash,
free/deepseek-v4.1-flash; free/deepseek-v4-pro-0813† (dated inherit);
bai: deepseek-v4-pro, deepseek-v4.1-flash.
apinex/free/deepseek-v4-flash-0731 → **1,310,720**† (INF row; serving caveat
inline: capability value, providers serve 1,048,576 — serving-limits handles).

**Gemini → 1,048,576** (TR/INF/KIO gemini-3.1-pro-preview + UNO 3.6-flash + KIO):
apinex: gemini-3.1-pro, free/gemini-3.1-pro, gemini-3.8-flash†, free/gemini-3.8-flash†.
bai: gemini-3.1-pro, gemini-3.5-flash†, gemini-3.6-flash, gemini-3-flash†,
gemini-3.8-flash† (the † gemini-3/3.8 rows inherit KIO rows that are themselves
flagged NEEDS-REVIEW family inferences — flag carried, not laundered).

**GLM:**
glm-5.1 → **204,800** (TR 2-of-3 recorded; bai only).
glm-5.2 → **1,048,576** (TR 2-of-3 + TH + KIO; bai only).
glm-5.3 → **1,000,000** (CC gateway-advertised 1,000,000 vs KIO 1,048,576 →
conservative min; apinex + bai).
glm-5.3-flash → **1,048,575** (KIO OR-live 2026-10-03 vs INF/UNO 1,310,720 →
conservative min; apinex, apinex/free, bai; orcarouter/z-ai/glm-5.3-flash-free
→ 1,048,575 via KIO/-free row).

**GPT → 1,050,000:**
gpt-5.5 → TH + CC + KIO agree (bai, orcarouter/openai/gpt-5.5);
gpt-5.5-pro → TR single† (orcarouter/openai/gpt-5.5-pro);
dated `-2026-04-23` variants inherit (orcarouter ×2);
bai/gpt-5.5-instant† inherits 5.5;
gpt-5.6-luna/sol/terra → BR + TH + CC + KIO agree (bai ×3);
gpt-6-astra → TH + UNO + KIO (apinex, bai);
gpt-6-luna, gpt-6-sol, gpt-6.1-sol → KIO single† (apinex incl. free/, bai ×3).

**Grok:** grok-4.7 → **500,000** (KIO grok-4.7 + KIO grok-4.7-free; apinex,
apinex/free... apinex carries bare grok-4.7 only).

**Kimi:** kimi-k3 → **1,048,576** (HC + TB + TR + TH + CC + KIO — 6 rows;
apinex, apinex/free/kimi-k3, bai). kimi-k2.6 → **262,144**† (CC/Kimi-K2.6
single; bai, nvidia/moonshotai/kimi-k2.6).

**Mimo:** mimo-v2.5 → **1,048,576** (TH 1,050,000 ×2 vs KIO conservative-min
row → min; bai). mimo-v2.5-pro → **1,050,000** (TH + TR/xiaomi agree; bai).
mimo-v2.6-flash → **1,048,576**† (KIO single; apinex/free, bai).

**MiniMax:** minimax-m3 → **1,048,576** (TB + TR + CC; apinex/free, bai).
minimax-m2.7 → **204,800**† (CC single; bai).

**Qwen:** qwen3.8-max → **1,000,000** (TH + BR + CC/Qwen3.8-Max; apinex,
apinex/free/qwen-3.8-max, bai). qwen3.8-flash → **1,000,000**† (KIO
operator-bug row, OR-live 2026-10-03; bai). qwen3.8-27b → **1,000,000** (INF +
UNO + CC agree; serving caveat inline: providers serve 262,144; bai).

**Other:** muse-spark-1.3 → **1,048,576**† (KIO/-contributor row, access-tier
suffix noted; apinex/free). poolside/laguna-xs-2.1 → **262,144**† (KIO single;
nvidia). nemotron-3-super-120b-a12b → **262,144** (TR + KIO; nvidia).
nemotron-3-ultra-550b-a55b → **262,144**† (KIO single; nvidia).
nemotron-3.5-lightning-30b-a3b → **262,144** (INF 1,048,576 vs KIO
lightning 262,144 → conservative min; nvidia).
orcarouter/deepseek/deepseek-v4-flash-free → **1,048,576** (KIO/-free + family
consensus).

**Row count: apinex 32 + bai 41 + orcarouter 6 + nvidia 9 = 88 new rows.**

**No-row registers (documented, id keeps the flagged default):**

- apinex (4): free/hy4, free/kimi-k2.8, free/mimo-v2.6-pro, free/minimax-m3.1 —
  no cross-gateway row (kimi-k2.8 ≠ k2.7-code; hy4 has no row anywhere).
- bai (18): claude-opus-4.5, claude-sonnet-4.5, gemini-3.5-flash-lite,
  glm-5.3-flashx, gpt-5-mini, gpt-5-nano, gpt-5.2, gpt-5.4, gpt-5.4-mini,
  gpt-5.4-nano, gpt-5.4-pro, kimi-k2.8-preview, mimo-v2.6-pro (no cross rows);
  gpt-image-2 (image modality); hy3, hy4-preview (no cross rows);
  jev-1.13.0, jev-latest (stealth, no vendor spec).
- orcarouter (56, grouped in parent-table comments): non-chat (tts ×8,
  embeddings ×5, image/video ×12 incl. kling/imagen/gpt-image, orca/dub,
  orcaverify ×2, search-api ×2, robotics-er); rolling `-latest` aliases ×4
  (window changes with target — pinning would go stale); legacy chat without
  cross rows (gpt-3.5-turbo ×2, gpt-4-0613, gpt-5/5.1/5.2-chat-latest aliases,
  gpt-5.4-mini/nano dated, gemma-4-31b-it, minimax-h3, qwen3-vl, hy3-free,
  hy4-preview-free, orcarouter/free stealth, codex-auto-review).
- nvidia (72, grouped in parent-table comments): embedqa/embed ×8, guard/safety
  ×4, reward ×1, riva-translate ×3, nemotron-parse ×2, nvclip, deplot,
  video-detector, vision/vila/kosmos/neva/muse ×7, diffusiongemma, plus legacy
  chat without cross rows (yi-large, jamba, dbrx, sea-lion, starcoder2,
  codellama, granite ×4, gemma ×4, phi ×2, mistral-7b/large ×4, mixtral,
  nemotron-4-340b-instruct, nemotron-nano-3-30b, nemotron-3-nano-omni,
  llama3-chatqa, llama-guard, gpt-oss-20b, gpt-oss-120b absent here, palmyra
  ×4, zamba2, recurrentgemma, codegemma ×2, muse-glimmer, arctic-embed,
  ising-calibration).
- vercel (23): all non-chat voice/tts/transcribe — register documented in
  parent-table comments (no vercel rows added).

### Steps

1. Create `common/src/constants/context-window-table-apinex.ts` — 32 rows +
   machine-readable no-row register export (`APINEX_NO_ROW_IDS` with reasons) +
   provenance header. — **implemented**
2. Create `common/src/constants/context-window-table-bai.ts` — 41 rows +
   `BAI_NO_ROW_IDS` + provenance header. — **implemented**
3. Add orcarouter (6) + nvidia (9) rows inline in `context-window-table.ts`
   with grouped no-row register comments; spread the two new section files;
   add imports (parent stays ≤ 300 lines). — **implemented**
4. Create `common/src/constants/window-coverage-register.ts` — a disposition
   entry for each of the 23 registry providers (`table-section` |
   `runtime-published` | `runtime-partial` | `no-runtime-rows` | `local`, with
   census-dated notes) + the apinex/bai/kiosapi no-publish contract. —
   **implemented**
5. Create the four test suites (census + seam-wiring + spot windows + no-row
   defaults + register lint). — **implemented**
6. Extend `scripts/providers/verify-window-truth.ts` with the LIVE apinex/bai
   roster census (keyless apinex; bai via `BAI_API_KEY` when present, explicit
   CENSUS-UNAVAILABLE line otherwise; every roster id must be a table row or a
   register no-row). — **implemented**
7. Run all gates; stamp the receipt; flip status to `verified`. — **implemented**

### Verification

The new suites prove: every section-file row is wired into the Map (seam
census, Law 4), spot windows match the derivation table, no-row ids resolve
`{contextWindow: 200000, source: 'default'}`, and every registry provider has a
coverage disposition (the lint fails closed on a new unregistered provider).
The LIVE probe censuses the apinex/bai rosters so roster growth fails loudly at
audit time. Ladder suites re-run to catch stale "lands on the default" pins
(FID-2026-1003-008 loop-3 lesson).

> Contract rule (FID-2026-0918-006): every promised test artifact MUST name
> its repo-relative `*.test.ts(x)` path, and that path MUST also appear as a
> declared `- gate: test <path>` below. `fid:verify` enforces this for
> fixed/verified — a promise with no covering gate fails the stamp.

## Verification Gates

- gate: typecheck common
- gate: typecheck cli
- gate: test cli/src/utils/openrouter-models/__tests__/window-truth.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-truth-kiosapi.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-truth-apinex.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-truth-bai.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-truth-router-gaps.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts
- gate: test cli/src/utils/__tests__/context-window-fallbacks.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-context-window.test.ts
- gate: probe scripts/providers/verify-window-truth.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:8167375b58fefe08a97a448e867c36f072c6465c8315f4911557257ff0f14537
- verified: 2026-10-04T21:06:55.697Z
- typecheck common: exit 0
- typecheck cli: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-truth.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-truth-kiosapi.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-truth-apinex.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-truth-bai.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-truth-router-gaps.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-coverage-register.test.ts: exit 0
- test cli/src/utils/__tests__/context-window-fallbacks.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-context-window.test.ts: exit 0
- probe scripts/providers/verify-window-truth.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Coverage census (probe output above): 264/1,843 silent; apinex 36/36
  and bai 59/59 with zero-sourced rosters; kiosapi's 3 already registered; the
  audit's "166 non-chat" classification undercounted chat surfaces (gpt-5.5 /
  gpt-5.5-pro / gemini-pro-latest / kimi-k3 among the silent); 66 rows advertise
  exactly the default; 5 registry providers have zero runtime rows; the
  closed-world invariant covers only the catalogs FID-2026-0916-002 and
  FID-2026-1003-008 touched.
- **GREEN:** The derivation table above (operator-ruled sourcing); four new
  data/test files; register + lint; LIVE census extension; two censuses.
- **AUDIT:** Every derived value re-checked against the two table files read
  0-EOF; conservative direction chosen on all three conflicts (glm-5.3,
  glm-5.3-flash, nemotron-3.5-lightning, mimo-v2.5); NEEDS-REVIEW carried onto
  every single-source/inheritance row; no family/vendor-knowledge guesses.
- **ADVERSARIAL:** The weak-provenance trade is real: single-source rows inherit
  one vendor's claim. Mitigations: NEEDS-REVIEW flags are mechanical (suite
  counts them), the LIVE census makes roster drift loud, and the register
  records the re-derivation path (a future operator-authorized live probe).
  Non-chat classification is name-based for nvidia's tail — accepted for a
  register (documentation, not window claims), re-openable per id.
- **CHANGE DELTA:** ~new-document (loop 1 authored the record).

### Missed Questions

1. *Why no fresh OpenRouter cross-vote probe?* Operator-ruled sourcing:
   cross-gateway rows only. The LIVE probe extension + register keep the
   re-derivation path one ruling away.
2. *Why not fetch windows at runtime for apinex/bai?* Their `/v1/models` rows
   carry no window fields (shape observed in the catalog snapshot) — nothing to
   fetch; the fallback table is the only possible source.
3. *Do the 66 exactly-200000 rows need rows too?* No — those rows HAVE catalog
   values (the gateway advertises 200000); the census (step in scope item f)
   classifies real-vs-leak and flags the ambiguous; only a confirmed
   over-allocation would be corrected (FID-2026-0919-020 precedent).
4. *Why are orcarouter/nvidia rows inline but apinex/bai seam-split?* Line
   budget: 15 rows fit the parent under the 300-line ceiling; 73 do not.
5. *Do new rows risk stale ladder-suite pins?* Yes — FID-2026-0919-018's
   "unmatched id lands on the default" class expectations. The ladder suites
   are declared gates; any stale pin is superseded with the no-bleed proof
   preserved (9b549205 precedent).
6. *What about `ollama` in the register?* `kind: 'local'` — its model list
   comes from the local daemon, not a gateway catalog; disposition `local` with
   a note; the zero-row census documents it rather than "fixing" it.

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** pending (G2: closure requires a commit — prepared,
      not executed; the operator grants commit authority)
- [ ] **File:line ranges:** common/src/constants/context-window-table-apinex.ts
      (whole file, 32 rows + register); common/src/constants/context-window-table-bai.ts
      (whole file, 41 rows + register); common/src/constants/context-window-table.ts
      (imports, orcarouter 6 + nvidia 9 rows, grouped no-row registers, two
      spreads); common/src/constants/window-coverage-register.ts (23
      dispositions); scripts/providers/verify-window-truth.ts (census);
      four new suites in cli/src/utils/openrouter-models/__tests__/
- [ ] **Gate output:** see Verification Receipt (all exit 0)
- [ ] **Reproducibility:** grep "apinex/\|bai/" in common/src/constants/;
      run the window-truth suites; re-run the audit probe
- [ ] **Step statuses:** all seven Proposed Solution steps `implemented`

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence is present for new or repaired wiring
      (seam-wiring census tests prove every new row reaches the Map; the
      LIVE census proves the rosters resolve through it)
- [x] FID status reflects the actual implementation state

### Loop 2 — Independent audit and self-correction

- **RED:** Prettier reformatted the four new test files after the first
  green run — the census regexes read the DATA files, so the risk was a
  reformat breaking a regex's assumptions; re-ran all seven suites after
  formatting.
- **GREEN:** Prettier left every data file byte-identical
  (`context-window-table.ts`, both section files, the register:
  "unchanged"); the suites re-ran 60 pass / 0 fail / 1,501 expect() calls
  across the 7 affected files. One syntax slip caught by inspection in both
  new section-pins files before any run (a `.(` for `.toBe(`), fixed
  immediately.
- **AUDIT:** All declared gates exit 0 — full typecheck (13 workspaces +
  scripts); window-truth battery 45/45; register lint + fallbacks 15/15;
  ladder suites 25/25; `quality:report` PASS (1,498 baselined files); LIVE
  probe exit 0.
- **ADVERSARIAL:** The LIVE census result independently validates the
  derivation: the live bai roster (59 ids) is EXACTLY the 41 sourced rows +
  18 no-row register ids, and the live apinex roster (34 ids — two fewer
  than the 2.6-day-old catalog snapshot) is fully registered too. Two
  bazaarlink WARNs (glm-5.2/glm-5.1 no longer listed by that vendor) are the
  designed WARN path (vendor roster drift, not table drift) and pre-date
  this FID.
- **CHANGE DELTA:** ~6% (status, loop records, receipt)

### Loop 3 — Final convergence

- **RED:** Blast-radius re-derivation (FID-2026-1003-008 loop-3 lesson): the
  new rows feed tier 3 of the shared resolution ladder, so neighboring
  suites beyond the declared gates must re-prove; sdk consumes the same
  table through `request-budget.ts`.
- **GREEN:** Ran the full four-suite ladder battery
  (`openrouter-models-context-window`, `-fid-0919-016`, `-fid-0919-018`,
  `-max-output`): 25 pass / 0 fail — no stale "lands on the default" pins,
  and the fid-0919-018 no-bleed proofs hold with the new rows present. The
  change is strictly additive (no existing row's value changed), so
  default→table promotions are the only behavioral delta.
- **AUDIT:** All gates exit 0; probe census proves the LIVE rosters are
  fully registered; register lint fails closed for future providers.
- **ADVERSARIAL:** The weak-provenance trade stands as ruled: ~20
  NEEDS-REVIEW rows rest on single sources and are mechanically flagged;
  the LIVE census + register make re-derivation one operator ruling away.
  The 66 exactly-200000 rows and 5 zero-row providers remain open census
  items in T128(f) — documented, not silently absorbed.
- **CHANGE DELTA:** ~4% (loop 3, receipt)

## Resolution

- **Closed Date:** pending (G2 — implementation is verified; closure and
  archive await operator commit authority, T127 precedent)
- **Fix Description:** 88 sourced rows (apinex 32, bai 41, orcarouter 6,
  nvidia 9) via two seam-split section files + parent-table additions;
  ~150 remaining silent ids documented in grouped no-row registers;
  WINDOW_COVERAGE_REGISTER + fail-closed lint over all 23 registry
  providers; LIVE apinex/bai roster census in verify-window-truth.ts.
- **Tests Added:** Yes — window-truth-apinex.test.ts, window-truth-bai.test.ts,
  window-truth-router-gaps.test.ts, window-coverage-register.test.ts.
- **Verification Evidence:** Verification Receipt below; LIVE census
  apinex 34/34 + bai 59/59 registered (2026-10-04).
- **Archived:** pending

> When status is set to **closed**, move this file to `dev/fids/archive/` and append an entry to `CHANGELOG.md`.

## Lessons Learned

(pending closure)
