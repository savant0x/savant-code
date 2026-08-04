# FID: Database + LLM-Providers LOW Fixes

**Filename:** `FID-2026-0803-010-database-llm-providers-low-fixes.md`
**ID:** FID-2026-0803-010
**Severity:** low
**Status:** verified (archived)
**Created:** 2026-08-03
**Author:** Savant

**Summary:**
Implement the 6 LOW findings from the database + llm-providers audit track
(DB-A..C, LLM-A..C), plus one bonus dead-file removal (LLM-D) surfaced by the
same evidence pass. All findings are correctness-consistency and cleanup items
on code that already carries the FID-0803-002 hardening — no behavioral change
is expected, and both packages' test suites (db 11/11, llm 57/57) must stay
green.

---

## RED — Evidence

| # | Location | Issue (summary) |
|---|---|---|
| DB-A | `database/src/service.ts:252` | `getMessage(messageId)!` — sole `!` assertion, bypasses `requireRow` read-back pattern |
| DB-B | `database/src/index.ts:46-51` | `agent_configs` table dead — zero service functions, zero consumers |
| DB-C | `database/src/service.ts` (20 sites) | fresh `db.prepare()` per call, hot-loop functions included |
| LLM-A | `chat/openai-compatible-chat-language-model.ts:395-665` + `chat/stream-transform.test.ts` | test simulates its own copy of the inline transform — cannot catch regressions |
| LLM-B | `chat/openai-compatible-chat-language-model.ts:120-134` | `parseProviderOptions` awaited twice on the same key (default path) |
| LLM-C | `chat/` vs `completion/` helpers ×2 | byte-identical duplicate files (`diff` exit 0 on both pairs) |
| LLM-D (bonus) | `openai-compatible/internal/index.ts` | dead barrel file — zero importers (Law 4) |

### Finding details

**DB-A** — `createMessage` returns `getMessage(messageId)!` (`service.ts:252`),
the only non-null assertion in the file. FID-0803-002 DB-5 established the
`requireRow` read-back pattern (`service.ts:65-72`) precisely for this
"get-after-create" purpose, and it is used at `:87`, `:169-172`, `:211`. The
`!` bypasses it, so a write that silently fails surfaces a confusing TypeError
instead of the labeled error. Safe today (INSERT OR IGNORE + FK enforcement),
inconsistent with stated hardening intent.

**DB-B** — `agent_configs` (`index.ts:46-51`) has FK refs to `sessions` and
`agent_templates` but zero consumers repo-wide: `rg` over `packages/database`,
`cli/src`, `sdk/src` and a full-tree `-g '*.ts'` sweep both return nothing; the
CREATE TABLE is the only occurrence. Pre-rebrand legacy.

**DB-C** — every service function prepares its statement per invocation (20
`db.prepare(...)` sites, e.g. `:82`, `:91`, `:118`, `:247`, `:256`).
`bun:sqlite` `Statement`s are reusable; `createMessage`/`getMessage`/
`getSession` run per-message/per-turn in the hot loop.

**LLM-A** — the real streaming transform (parse-failure handling, raw-chunk
emit, usage/tool-call accumulation, stale-fragment checks, flush close-out) is
inline in the model's `TransformStream`. `stream-transform.test.ts`
re-implements its own simulated copy ("Simulate the transform logic from
openai-compatible-chat-language-model.ts") with zero imports from the
implementation — it cannot catch regressions in the most-FID'd code in the
repo (0801-007/008/010/011).

**LLM-B** — `getArgs` awaits `parseProviderOptions` twice with the same schema.
`providerOptionsName` = `config.provider.split('.')[0]` (`:95-97`) —
`'openai-compatible'` in the default case — so the second call re-parses the
identical key: duplicate zod validation plus a redundant await per request.

**LLM-C** — `chat/get-response-metadata.ts` = `completion/get-response-
metadata.ts` and `chat/map-openai-compatible-finish-reason.ts` =
`completion/map-openai-compatible-finish-reason.ts` (`diff` exit 0 on each
pair). Same drift class as LLM-A: a fix to one copy silently bypasses the
other.

**LLM-D** — `openai-compatible/internal/index.ts` re-exports chat helpers but
has zero importers (the only `internal` hits repo-wide are the image model's
`_internal?:` config, unrelated). Law 4 dead code.

---

## GREEN — Fixes

| # | Fix (minimal) |
|---|---|
| DB-A | `return requireRow(getMessage(messageId), 'read back message ' + messageId + ' after insert')` |
| DB-B | Delete the `agent_configs` CREATE TABLE block (`index.ts:46-51`) and its comment |
| DB-C | Module-level lazy statement cache + `prepare(sql)` helper; replace all 20 `db.prepare(`X`)` sites |
| LLM-A | Extract inline transform to shared `chat/stream-transform.ts`; model + test both import it |
| LLM-B | Reuse the base parse when `providerOptionsName === 'openai-compatible'`, else parse the custom key |
| LLM-C | Keep `chat/` copies; delete `completion/` duplicates; retarget the 2 completion imports to `../chat/` |
| LLM-D | Delete `openai-compatible/internal/index.ts` |

### Fix details and rejected alternatives

**DB-A** — one-line change matching the pattern at `:87`/`:169`/`:211`.
Rejected: keep the `!` (inconsistent with DB-5); throw inline (duplicates
`requireRow`).

**DB-B** — fresh DBs stop creating the table; existing DBs keep an unused table
(harmless). Rejected: keep + document as reserved (the pre-rebrand caution was
about live agent definitions — this is dead schema with zero consumers and no
migration path ever observed); add service functions for it (wiring, not
removal — out of scope).

**DB-C** — helper is lazy (not import-time), so it avoids any coupling with the
fail-open `initDatabase` (`index.ts:79-105`) and the `:memory:` test escape
hatch: `const statementCache = new Map<string, ReturnType<typeof db.prepare>>()`
plus `function prepare(sql: string)` that memoizes per SQL string. Rejected:
one module constant per statement (20 named constants, larger diff, import-time
coupling); leave as-is.

**LLM-A** — the factory closes over per-request state (`isFirstChunk`, text/
reasoning activity, `toolCalls`, `usage`, `requiredToolKeys`,
`metadataExtractor`, `finishReason`). Preserve behavior exactly: stale-fragment
handling, tool-input close-out, flush. Rejected: delete the simulation and rely
on the 549-line model test (loses targeted unit coverage on the riskiest code);
keep the simulation (known drift).

**LLM-B** — `const providerOptionsResult = this.providerOptionsName ===
'openai-compatible' ? baseOptionsResult : await parseProviderOptions({...})` —
the non-default path (custom provider name) still parses its own key, behavior
preserved. Rejected: always single-parse (drops the custom-provider key);
module-level cache (wrong — options are per-request).

**LLM-C** — two small edits in the completion model's import block; no behavior
change. Rejected: keep duplicates (drift); move both to a third shared dir
(larger diff, same result).

**LLM-D** — 5-line delete, zero dangling imports. Rejected: keep the dead
barrel (Law 4 violation).

---

## AUDIT — Verification Plan

1. **Typecheck (HARD GATE ×2):** `cd packages/database && bun run typecheck`
   and `cd packages/llm-providers && bun run typecheck` — both exit 0.
2. **Tests (HARD GATE):** `bun test` in both packages — db 11/11, llm 57/57
   must hold. No test edits expected; `stream-transform.test.ts` continues to
   pass against the extracted module.
3. **Static greps (double audit):**
   - No `getMessage(messageId)!` remains in `service.ts`; `requireRow` used.
   - No `agent_configs` in `packages/database/src` or any consumer.
   - No `db.prepare(` remains in `service.ts` (only `prepare(`).
   - `stream-transform.test.ts` imports the extracted module (no simulation).
   - `parseProviderOptions` appears once in `getArgs` (plus conditional reuse).
   - `completion/` duplicates deleted; completion imports resolve via `../chat/`.
   - `internal/index.ts` gone; zero dangling imports.
4. **Lint:** `bun x eslint` on changed files in both packages,
   `--max-warnings 0`.
5. **Repo hygiene:** full-tree grep for `agent_configs` and `internal/index` —
   zero hits.

**Runtime risk:** minimal — no behavior change; LLM-A is the only structural
move and its test suite validates it directly.

---

## Rejected Alternatives (recorded)

- **DB-B:** wiring `agent_configs` into the service layer — pre-rebrand legacy
  with zero consumers; wiring is explicitly out of scope.
- **LLM-A:** deleting `stream-transform.test.ts` — the simulation is flawed but
  the real transform deserves targeted coverage once extracted.
- **DB-C:** module-level constants per statement — import-time coupling with the
  fail-open DB init makes the lazy cache strictly safer.

---

## Perfection Loop Status

- **RED:** evidence cataloged above (all line numbers verified against the
  working tree).
- **GREEN:** minimal fixes defined, rejected alternatives recorded.
- **AUDIT:** verification plan complete (gates + static double-audit).
- **COMPLETE → IMPLEMENT:** approved by user, implemented, verified.
- **Status:** `verified` — archived.

---

## Resolution

**Approved:** 2026-08-03 (user). **Implemented + verified:** 2026-08-03.

### Changes landed

| # | Change | Files |
|---|---|---|
| DB-A | `requireRow` read-back replaces the `!` assertion in `createMessage` | `database/src/service.ts` |
| DB-B | `agent_configs` CREATE TABLE removed | `database/src/index.ts` |
| DB-C | lazy statement cache + `prepare()` helper, 20 sites converted | `database/src/service.ts` |
| LLM-A | inline transform extracted to shared `chat/stream-transform.ts`; model + test both use the real factory | `llm-providers/.../stream-transform.ts` (new), `openai-compatible-chat-language-model.ts`, `stream-transform.test.ts` |
| LLM-B | single parse when `providerOptionsName === 'openai-compatible'` | `openai-compatible-chat-language-model.ts` |
| LLM-C | completion/ duplicates deleted, imports retargeted to `../chat/` | completion model + 2 deleted files |
| LLM-D | dead `internal/index.ts` deleted (+ empty dir removed) | deleted file |

### Scope corrections (documented per review)

1. **DB-B test teardown** — the RED-phase "zero consumers" evidence was
   partially wrong: the table had ONE consumer — `service.test.ts`'s
   `beforeEach` teardown (`DELETE FROM agent_configs;`). Production consumers
   are zero (verified with `grep`, not the missing `rg` binary that silently
   returned nothing during the RED pass). Corrected consumer count
   (pre-removal): **0 production consumers + 1 test-teardown consumer**. The
   teardown line was removed with the table — the AUDIT plan's "no test edits
   expected" was therefore amended to exactly one teardown line.
2. **LLM-A test backpressure** — the rewritten test initially hung: a
   `TransformStream` readable side has high-water mark 1, so writing before
   reading stalls on backpressure. The helper now drains concurrently (mirror
   of the real `pipeThrough` consumer).

### Audit results

- Typecheck ×2: `packages/database` and `packages/llm-providers` — both exit 0.
- Tests: database **11/11 pass** (32 expect); llm-providers **58 pass / 0 fail**
  (112 expect) — baseline 57, minus 2 simulated transform tests, plus 3 tests
  driving the real transform.
- ESLint on both packages: `--max-warnings 0` — clean (import/order auto-fixed).
- Static double-audit: no `getMessage(messageId)!` (requireRow in place); no
  `db.prepare(` outside the cache helper; `agent_configs` and `internal/index`
  zero hits repo-wide; completion imports resolve via `../chat/`;
  `parseProviderOptions` = 1 call + conditional reuse.
- Independent review: no correctness issues. One nit applied —
  `OpenAICompatibleChatTokenUsage` no longer exported (internal to
  `stream-transform.ts`).

**Runtime risk realized:** the LLM-A test hang (backpressure) was caught during
verification and fixed before merge — the shared-module test is now strictly
stronger than the old simulation.

---

## Evidence Amendment (post-archive re-verification, 2026-08-03)

DB-B's removal was re-verified repo-wide with `grep` (the RED pass's `rg`
usage is what silently reported zero hits — `rg` is not on PATH in this repo's
bash). Commands and results:

| Command | Result |
|---|---|
| `grep -rn 'agent_configs' packages cli sdk common agents evals scripts --include='*.ts'` | exit 1 — **zero source hits** |
| `grep -rn 'agent_configs' packages cli sdk common agents evals scripts` (all files) | hits ONLY in stale build artifacts: `cli/bin/index.js.map` + `cli/bin/savant-code.exe`, `cli/bin/savant-free.exe` — compiled bundles embedding the PRE-removal source (they also embed pre-0803-002 code like `createAgentConfig`); not consumers |
| `grep -rn 'agentConfig|agent-config|AgentConfig' ... --include='*.ts'` | hits are local variable names in `sdk/src/impl/database.ts:280-308` (published-agent path) — unrelated to the `agent_configs` table |
| `grep -rln 'agent_configs' dev/fids/archive dev/session-summaries CHANGELOG.md dev/LEARNINGS.md` | only docs describing the removal |

**Corrected consumer count (DB-B):**

- Pre-removal: **0 production consumers** (no service functions — the old
  `createAgentConfig`/`getAgentConfig` were already removed in FID-0803-002;
  no CLI/SDK/agent-runtime/agents references) + **1 test-teardown consumer**
  (`service.test.ts` `beforeEach`).
- Post-removal: **zero `agent_configs` references in any source file**.

**Follow-up note (corrected 2026-08-03 by FID-2026-0803-011):** the earlier
wording "committed .exe binaries" was wrong — `cli/bin/` is gitignored (root
`.gitignore:42-43` + `cli/.gitignore` `bin`) and `git ls-files cli/bin/` is
empty, so nothing was ever tracked. The real issue is ~360 MB of stale LOCAL
build artifacts (Jul 28-31) that consumers existence-check only. Handled by
FID-2026-0803-011: stale artifacts purged + a `clean` script added.
