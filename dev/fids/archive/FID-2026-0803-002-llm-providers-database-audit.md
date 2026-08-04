# FID: LLM-Providers + Database Package Audit (Quality Track)

**Filename:** `FID-2026-0803-002-llm-providers-database-audit.md`
**ID:** FID-2026-0803-002
**Severity:** high
**Status:** verified
**Created:** 2026-08-03
**Author:** Savant

**Summary:**
Audit `packages/llm-providers` (OpenAI-compatible chat/completion/embedding/image provider shims + Ollama detection) and
`packages/database` (`bun:sqlite` schema + service layer) for correctness, error handling, and type safety. The audit
found one crash-class bug in the primary chat hot path (an FID-006 fix that was applied to the completion model but
missed the chat model), four medium correctness/robustness/coverage issues, and eleven low hygiene/type-safety
items. Audit-only: no source files were modified.

---

## Environment

- **OS:** Windows (bash-on-Windows)
- **Language/Runtime:** TypeScript (strict), Bun ≥ 1.3.11
- **Packages:** `@savant-code/llm-providers` 0.0.1, `@savant-code/database` 0.0.1
- **Key deps:** `@ai-sdk/provider` 2.0.1, `@ai-sdk/provider-utils` ^3.0.17, `zod` ^4.2.1, `bun:sqlite`
- **Baseline gates (RED):** llm-providers typecheck ✓, 55 tests / 0 fail; database typecheck ✓, 8 tests / 0 fail

## Detailed Description

### Evidence and Findings

#### LLM-1 — CRITICAL — Chat `doGenerate` dereferences `choices[0]` without a guard

**File:** `packages/llm-providers/src/openai-compatible/chat/openai-compatible-chat-language-model.ts:242-263`

```ts
const choice = responseBody.choices[0]
...
const text = choice.message.content          // line 246 — crash when choices is []
const reasoning =
  choice.message.reasoning_content ?? choice.message.reasoning   // line 253
if (choice.message.tool_calls != null) {    // line 262
```

The response schema (`OpenAICompatibleChatResponseSchema`) declares `choices: z.array(...)` with **no minimum length**,
so `choices: []` is a valid provider response (commonly returned for content-filtered or degenerate completions).
`choice` is `undefined` → `choice.message` throws `TypeError: Cannot read properties of undefined`.

**Why CRITICAL:** the schema permits the empty array, the crash takes out the primary chat hot path with no
workaround, and FID-006 rated the identical completion-model bug CRITICAL (LLM1) — this is the same defect class
left unfixed in the more-traveled path.

FID-006 LLM1 fixed the **completion** model (`openai-compatible-completion-language-model.ts:193-196` uses
`choice?.text`, with a regression test at `completion-language-model.test.ts:56`), but the **chat** model — the primary
hot path used by every chat provider — was missed. There is **no** empty-`choices` test for the chat model (grep for
`empty choices` in `openai-compatible-chat-language-model.test.ts`: none).

**Fix:** guard with `choice?.` (`const text = choice?.message.content`) or early-return an empty-content result, and add
a regression test mirroring the completion one.

#### LLM-2 — MEDIUM — Completion `getArgs` spreads raw provider options onto the wire unfiltered

**File:** `packages/llm-providers/src/openai-compatible/completion/openai-compatible-completion-language-model.ts:137-157`

```ts
args: {
  echo: completionOptions.echo,          // mapped snake_case
  logit_bias: completionOptions.logitBias,
  ...
  ...providerOptions?.[this.providerOptionsName],   // line 152 — raw camelCase spread
```

The chat model filters known schema keys out of the raw spread
(`chat-language-model.ts:193-200` — `filter(([key]) => !Object.keys(openaiCompatibleProviderOptions.shape).includes(key))`).
The completion model does **not** — a caller passing `{ logitBias: {...} }` produces BOTH `logit_bias` (mapped) and
`logitBias` (raw) on the wire. Inconsistent with the chat model; can trigger strict-provider 400s and leaks internal
option names. **Fix:** apply the same schema-key filter as the chat model, or stop mapping and rely on the raw spread.

#### LLM-3 — LOW — `z.any()` in the shared error schema

**File:** `packages/llm-providers/src/openai-compatible/openai-compatible-error.ts:13`

```ts
param: z.any().nullish(),
```

Law 6 surface. The looseness is intentional (provider error-shape variance), but `z.unknown()` or a narrower union
(`z.string().nullish()`) preserves the intent without `any`. **Fix:** replace `z.any()` with `z.unknown()`.

#### LLM-4 — LOW — Completion prompt error message never interpolates `${content}`

**File:** `packages/llm-providers/src/openai-compatible/completion/convert-to-openai-compatible-completion-prompt.ts:32-35`

```ts
throw new InvalidPromptError({
  message: 'Unexpected system message in prompt: ${content}',  // single-quoted — literal
```

Single-quoted string: `${content}` is printed literally, not interpolated. **Fix:** use a template literal.

#### LLM-5 — LOW — Completion `doStream` emits `raw` before the success check

**File:** `.../completion/openai-compatible-completion-language-model.ts` (doStream transform)

The chat model deliberately emits `raw` **after** the success check (`// Emit raw chunk if requested (after success
check so rawValue is guaranteed)`); the completion model emits `raw` **before** `if (!chunk.success)`, so a failed
parse can enqueue `raw` with `rawValue === undefined`. **Fix:** reorder to match the chat model. Low risk —
`includeRawChunks` is an opt-in debugging flag.

#### LLM-6 — LOW — Stream error-chunk payload shape differs between chat and completion

Chat (`chat-language-model.ts`): `controller.enqueue({ type: 'error', error: value.error.message })` (string).
Completion (`completion-language-model.ts`): `controller.enqueue({ type: 'error', error: value.error })` (object).
Consumers of `LanguageModelV2StreamPart['error']` get a string in one path and an object in the other. **Fix:** unify
the payload (and type it).

#### LLM-7 — LOW — `parseToolCallArguments` has a no-op conditional

**File:** `packages/llm-providers/src/openai-compatible/chat/openai-compatible-chat-language-model.ts:832-838`

```ts
export function parseToolCallArguments(args: string): ParsedToolArguments {
  const parsed = parseJsonObjectArguments(args)
  if (!parsed.ok || Object.keys(parsed.value).length === 0) {
    return parsed
  }
  return parsed
}
```

Both branches return `parsed`; the condition is dead and misleading (the length check has no effect). **Fix:** return
`parsed` directly and drop the conditional, or make the empty-object case explicit.

#### LLM-8 — LOW — Test-only `any` usage in `stream-transform.test.ts`

`stream-transform.test.ts` declares `transform(chunk: any, controller: any)` and `const emitted: any[] = []`. Test-only,
so Law 6 impact is limited, but typed helpers would keep the tests honest as the stream API evolves. **Fix:** type the
test doubles with the real `TransformStream` generics.

#### DB-1 — MEDIUM — Unguarded import-time DB open + schema DDL

**File:** `packages/database/src/index.ts:23-57`

```ts
const db = new Database(DB_PATH)          // no try/catch
db.exec('PRAGMA journal_mode = WAL')
createSchema()                            // runs at import
db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (1)').run()
```

All of this runs at module import. If `echo.db` is corrupt, unwritable, or `SAVANT_DB_PATH` points into a
non-existent directory, the **entire CLI crashes at startup** with no graceful degradation path (the CLI's
`db-storage.ts` wraps reads in try/catch, but the module-level open is unguarded). **Fix:** guard the open + schema
init (try/catch → fail-open with a logged fallback, or a dedicated `initDatabase()` the CLI calls deliberately).

#### DB-2 — MEDIUM — Message/session ordering relies on second-granularity `created_at` ties

`getMessagesBySessionId` (`service.ts:311`) orders by `created_at ASC` only; `getSessionsByChatId` (:115),
`getLatestModel` (:161/:164), and `saveModel`'s latest-session path (:153) all order by `created_at` alone.
`created_at` is `DEFAULT CURRENT_TIMESTAMP` — second granularity. Messages persisted within the same second (common
during streaming saves) have **no guaranteed order**; message replay order feeds LLM context. **Fix:** add a
deterministic tiebreaker (`ORDER BY created_at, rowid`) to the ordering queries.

#### DB-3 — MEDIUM — Three overlapping model-attribution APIs with divergent semantics

- `updateSessionModel(sessionId, model)` — targets one session (`service.ts:124`).
- `saveModel(model, chatId?)` — with `chatId` updates **all** sessions for that chat; without, updates the latest
  session by `created_at` (`:143-155`).
- `getLatestModelForChat(chatId)` (`:133`) duplicates `getLatestModel(chatId)` (`:158-162`) exactly — and has **zero
  callers** (dead code).

The `saveModel` non-chatId fallback is also non-deterministic under the DB-2 tie issue. **Fix:** collapse to one
read + one write path; remove `getLatestModelForChat` (Law 13).

#### DB-4 — LOW — Dead exports

`hasSessions` (`service.ts:172`), `createAgentConfig`/`getAgentConfig` (`:218/:232`), `getCostRecord` (`:336`),
`getDatabase` (`index.ts:129`), `closeDatabase` (`index.ts:133`) have zero callers outside the package (verified by
repo-wide grep; `local-agent-registry.ts` imports only template CRUD). `closeDatabase` being uncalled is benign for a
CLI process, but the exports are dead surface. **Fix:** remove or wire them (Law 10/13).

#### DB-5 — LOW — Non-null assertions on get-after-create round trips

`createSession` returns `getSession(id)!`, `createCostRecord` returns `getCostRecord(id)!`, `createFidDocument`
returns `getFidDocument(fidId)!`, etc. If the INSERT silently failed (e.g. FK violation), `get*` returns `null` and the
`!` produces a confusing runtime TypeError instead of a clean error. **Fix:** propagate an explicit error on
null-after-create.

#### DB-6 — LOW — UPDATEs return void with no affected-rows check

`updateSession`, `updateSessionModel`, `updateAgentTemplate`, `updateFidDocument` silently no-op on a missing id.
**Fix:** return `changes` from `stmt.run()` (`result.changes > 0`) so callers can detect misses (the CLI already
round-trips FID existence, so impact is low).

#### DB-7 — LOW — Image model does not enforce `maxImagesPerCall`

`OpenAICompatibleImageModel` exposes `readonly maxImagesPerCall = 10` but `doGenerate` passes `n` through with no
clamp/validation. The embedding model throws `TooManyEmbeddingValuesForCallError` for the same class of issue;
the image model should too. **Fix:** validate `n <= maxImagesPerCall`.

#### DB-8 — LOW — `VERSION` falls back to `'0.0.0-test'`

`openai-compatible/version.ts` uses the Bun compile-time define `__PACKAGE_VERSION__` with a `'0.0.0-test'` fallback.
Verify the build pipeline injects the real version into the User-Agent suffix; otherwise every request advertises
`0.0.0-test`. **Fix/verify:** confirm injection in the CLI/agent-runtime build, or drop the suffix.

### Root Cause

The llm-providers package is a fork/adaptation of the AI SDK's openai-compatible provider, and FID-006's hardening
(LLM1 empty-choices guard, LLM2 model re-assertion, LLM3/LLM4 option parsing) was applied incrementally and
incompletely — the chat model, being the most-copied original, kept the unguarded dereference and unfiltered-spread
patterns. The database package evolved from a minimal prototype with import-time side effects, second-granularity
timestamps, and no cleanup pass over exported surface. (16 findings: 1 critical / 4 medium / 11 low.)

## Impact Assessment

### Affected Components

- `packages/llm-providers/src/openai-compatible/chat/openai-compatible-chat-language-model.ts` (+ test)
- `packages/llm-providers/src/openai-compatible/completion/openai-compatible-completion-language-model.ts`
- `packages/llm-providers/src/openai-compatible/completion/convert-to-openai-compatible-completion-prompt.ts`
- `packages/llm-providers/src/openai-compatible/openai-compatible-error.ts`
- `packages/llm-providers/src/openai-compatible/image/openai-compatible-image-model.ts`
- `packages/llm-providers/src/openai-compatible/version.ts`
- `packages/llm-providers/src/openai-compatible/chat/stream-transform.test.ts`
- `packages/database/src/index.ts`
- `packages/database/src/service.ts`
- `packages/database/src/__tests__/service.test.ts`
- CLI consumers: `cli/src/utils/db-storage.ts`, `cli/src/utils/local-agent-registry.ts`

### Risk Level

- [x] Critical: System crash, data loss, or security vulnerability — **LLM-1** (crash on valid provider response)
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists — **LLM-2, DB-1, DB-2, DB-3, test coverage**
- [x] Low: Minor issue, cosmetic, or edge case — **LLM-3..8, DB-4..8**

## Proposed Solution

### Approach

Stage 1 — **llm-providers correctness (LLM-1/2/4/5/6):** guard `choice?.message` in chat `doGenerate`; apply the
schema-key filter to the completion raw spread; fix the completion-prompt template literal; reorder completion
`raw` emission after the success check; unify stream error-chunk payloads. Add regression tests: chat empty-`choices`
(mirror completion's), completion spread filtering, completion prompt error message.

Stage 2 — **type safety + hygiene (LLM-3/7/8):** `z.any()` → `z.unknown()`; simplify `parseToolCallArguments`; type the
stream-transform test doubles; verify `VERSION` injection.

Stage 3 — **database robustness (DB-1/2/3):** guard import-time DB open with a fail-open path (or move init behind a
deliberate call); add `rowid` tiebreakers to ordering queries; collapse model-attribution to one read + one write,
remove `getLatestModelForChat`. Tests: corrupt-DB import, same-second ordering, saveModel chat scoping, dead-export
removal compile check.

Stage 4 — **database hygiene (DB-4/5/6/7):** remove or wire dead exports; explicit error on null-after-create;
affected-rows checks on UPDATEs; `maxImagesPerCall` validation in the image model.

### Files To Be Changed (implementation stage)

- `packages/llm-providers/src/openai-compatible/chat/openai-compatible-chat-language-model.ts` + test
- `packages/llm-providers/src/openai-compatible/completion/openai-compatible-completion-language-model.ts` + test
- `packages/llm-providers/src/openai-compatible/completion/convert-to-openai-compatible-completion-prompt.ts`
- `packages/llm-providers/src/openai-compatible/openai-compatible-error.ts`
- `packages/llm-providers/src/openai-compatible/image/openai-compatible-image-model.ts`
- `packages/llm-providers/src/openai-compatible/chat/stream-transform.test.ts`
- `packages/database/src/index.ts`
- `packages/database/src/service.ts`
- `packages/database/src/__tests__/service.test.ts`
- `packages/llm-providers/package.json` (VERSION injection verify — no change expected)

## Verification

- [x] llm-providers typecheck + 55 tests pass at RED baseline
- [x] database typecheck + 8 tests pass at RED baseline
- [x] Findings cited with file:line from direct reads/grep
- [x] No implementation files modified during this audit (llm-providers/database `src/` untouched);
      signing-policy doc corrections (ECHO spec, marker, archived FID attributions, CHANGELOG phrasing) applied
      as a separate attribution pass, per operator directive
- [x] Implementation: 4-way typecheck (common/agents/agent-runtime/cli) + llm-providers/database typechecks
- [x] Implementation: llm-providers (57 pass) + database (11 pass) suites green, plus new regression tests
      (chat empty-choices LLM-1, completion stream error-payload LLM-6, DB rowid tiebreaker, DB affected-rows)
- [x] Implementation: zero-warning ESLint, `bun run lint:md` exit 0, Prettier clean on changed files
- [x] Implementation: independent AUDIT via code-reviewer (clean pass, no blockers); CHANGELOG entry; FID archived

## Perfection Loop

### Loop 1

- **RED:** Complete — 16 findings (1 critical, 4 medium, 11 low) grounded in direct reads, grep, and baseline gates.
- **AUDIT:** Complete — independent review verified all citations; one blocker found (finding-count arithmetic:
  16 = 1/4/11, not 14 = 1/5/8) and one calibration note (LLM-1 CRITICAL justification added).
- **SELF-CORRECT:** Applied — count corrected in Summary/Root Cause/Perfection Loop; CRITICAL justification added.
- **GREEN:** Not started — awaiting operator approval (audit-only FID).
- **COMPLETE:** Not started.

### Loop 2 (rerun per FreeBuff ECHO)

- **RED re-verify:** All 16 findings re-confirmed against the live tree on 2026-08-03 (chat guard still missing at
  `chat-language-model.ts:246`; completion guard present; 0 chat empty-choices tests; `z.any()` at
  `openai-compatible-error.ts:13`; `getLatestModelForChat` has 0 external callers). Baseline gates re-run green
  (llm-providers 55/0, database 8/0).
- **AUDIT:** Complete — independent re-review (Loop 2) verified all citations and the signing-policy pass;
  minor notes closed (checkbox reword, lint sweep below).
- **Signing policy:** FID authored as **Savant**; zero `Buffy`/`FreeBuff` attributions (per FreeBuff ECHO "Document
  Signing & Attribution").

### Missed Questions

- Whether `SAVANT_DB_PATH` is ever set in production (only tests per grep) — the DB-1 fix should preserve the test
  escape hatch while adding a production fail-open path.
- Whether the completion endpoint is actually exercised by any configured provider (completion spread filtering is
  lower priority if unused) — will verify callers during GREEN.

## Lessons Learned

1. FID-006's LLM1 (empty-`choices` guard) was applied to the completion model but missed the chat model — the
   primary hot path. Incomplete application of a hardening pass leaves the same bug class live in the more-traveled
   code.
2. Dead exported surface (`getLatestModelForChat`, `hasSessions`, `getDatabase`, `closeDatabase`, agent-config and
   cost-record accessors) accumulates when no cleanup pass runs over a package; Law 10/13 require an explicit sweep.
3. The FreeBuff ECHO governs agent attribution: sign as **Savant** only. Archived artifacts from prior sessions were
   corrected in this pass (FID-2026-0802-008, FID-2026-0803-001).

## Resolution

- **Fixed By:** Savant — approved via "resume"
- **Fixed Date:** 2026-08-03
- **Fix Description:** All 16 findings implemented across 4 stages. Stage 1 (correctness): chat `doGenerate`
  empty-`choices` guard + regression test (LLM-1, the CRITICAL); completion provider-options spread filtered against
  the schema so `logit_bias`/`logitBias` can no longer double-send (LLM-2); completion prompt template-literal
  interpolation restored (LLM-4); completion raw-chunk emission reordered after parse success, matching chat (LLM-5);
  completion stream error payload unified to a string message, matching chat (LLM-6). Stage 2 (type safety):
  `z.any()` → `z.unknown()` in the error schema (LLM-3); `parseToolCallArguments` dead dual-return branch removed
  (LLM-7); stream-transform test doubles fully typed (LLM-8); `__PACKAGE_VERSION__` build-time define injected so the
  User-Agent stops advertising `0.0.0-test` (DB-8). Stage 3 (DB robustness): guarded `initDatabase` with fail-open
  `:memory:` fallback (DB-1); `rowid` tiebreakers on second-granularity `created_at` ordering (DB-2); model-attribution
  APIs collapsed to `updateSessionModel`/`getLatestModel` with the dead `getLatestModelForChat`/`saveModel` removed
  (DB-3). Stage 4 (DB hygiene): dead exports `getDatabase`/`closeDatabase`/`hasSessions`/`createAgentConfig`/
  `getAgentConfig` removed, `getCostRecord` un-exported to internal (DB-4); explicit `requireRow` error instead of
  `!` assertions on all get-after-create round trips (DB-5); affected-rows checks on UPDATEs (DB-6);
  `maxImagesPerCall` validated with `InvalidArgumentError` in the image model (DB-7).
- **Tests Added:** chat `doGenerate` empty-choices (LLM-1); completion stream error-payload (LLM-6); DB rowid
  tiebreaker ordering (DB-2); DB affected-rows reporting for updateSession/updateAgentTemplate/updateFidDocument and
  updateSessionModel (DB-6).
- **Verified By:** code-reviewer-deepseek-flash — independent implementation AUDIT, clean pass (no CRITICAL/HIGH;
  4 LOW follow-ups: getCostRecord export scope, requireRow coverage, DB-1/DB-5/DB-7 test gaps, LLM-6 stream assertion
  — all closed with code evidence this session).
- **Commit/PR:** None (working tree)
- **Archived:** dev/fids/archive/
