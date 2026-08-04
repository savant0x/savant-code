# FID: Code-Map Package Audit — Guard Fix, Loader Resilience, Hygiene (CM-1…CM-9)

**Filename:** `FID-2026-0803-006-code-map-audit-hygiene.md`
**ID:** FID-2026-0803-006
**Severity:** medium
**Status:** verified
**Created:** 2026-08-03
**Author:** Savant

**Summary:**
Audit of `packages/code-map` (tree-sitter indexing + language detection; ~900 lines read 0-EOF). Two
MEDIUM findings — (CM-1) a dead `call in {}` prototype-key guard in `buildTokenCallers` that lets a
real-world `toString`/`valueOf`/`hasOwnProperty` token collision crash the whole code map (SDK
degrades to empty scores with only a warning), and (CM-2) the module-level `UnifiedLanguageLoader`
caches a `Parser.init` rejection forever, silently disabling tree-sitter for the process lifetime with
no surfaced diagnostic — plus seven LOW hygiene/robustness findings (CM-3 dead wasm-path fallback loop,
CM-4 pointless rethrow, CM-5 lazy-init race, CM-6 language-table gaps, CM-7 TOCTOU + misclassified read
errors, CM-8 unnecessary cast, CM-9 eval-style `new Function` shim). Baseline: 50/50 tests, typecheck
clean, reachable via `sdk/src/run-state.ts` (Law 4 verified).

---

## Environment (RED — findings with evidence)

All in `packages/code-map/src/`; baseline verified: `bun test` 50 pass / 0 fail, `bun run typecheck`
exit 0, reachability `getFileTokenScores` → `sdk/src/run-state.ts:167` (dynamic import, wrapped in
try/catch at `:171-174`) + SDK index re-export + `sdk/smoke-test-dist.ts:126`.

### CM-1 — MEDIUM — dead `call in {}` guard can crash the code map

`parse.ts:311` — `if (!definingFile || callingFile === definingFile || call in {}) continue`. The guard
was meant to skip Object.prototype-colliding tokens, but `'toString' in {}` is **false** (only
inherited `__proto__` is caught). Trigger path: a project where `toString`/`valueOf`/`hasOwnProperty`
appears as both a defined identifier (a class overriding `toString` — common) and a call
(`obj.toString()`). Then `callersByToken[call]` returns the *truthy* `Object.prototype.toString`
function → `callerFiles.length (1) < 25` passes → `callerFiles.includes(...)` → **TypeError:
callerFiles.includes is not a function** → `getFileTokenScores` rejects → SDK catches
(`run-state.ts:171-174`) → entire code map silently empty with a warning. `constructor` is only
shielded incidentally because `IGNORE_TOKENS` excludes it from scoring.

### CM-2 — MEDIUM — loader caches a rejection; tree-sitter silently disabled forever

`languages.ts:209-216,294` — `unifiedLoader.parserReady` is created eagerly at module scope
(`this.parserReady = initTreeSitterForNode()`). If `Parser.init` rejects (wasm missing/unreadable —
including the self-heal download failing once), every subsequent `getLanguageConfig` rejects forever,
even if the wasm becomes available, and `getLanguageConfig`'s catch (`:301-308`) returns `undefined`
logging only under `DEBUG_PARSING`. Net: symbol scoring silently disabled for the process lifetime with
no surfaced cause; plus a possible unhandled-rejection race at module scope.

### CM-3 — LOW — dead fallback loop in `resolveWasmPath`

`languages.ts:174-181` — `for (const wasmPath of possiblePaths) { try { return wasmPath } catch {
continue } }`: `return` can never throw, so the loop always returns `possiblePaths[0]` and the
"try each path" intent never runs (the `catch` is dead scaffolding).

### CM-4 — LOW — pointless rethrow

`languages.ts:227` — `catch (err) { throw err }` around the entire `createLanguageConfig` init body is
a no-op; remove the wrapper.

### CM-5 — LOW — lazy-init race in `createLanguageConfig`

`languages.ts:243-258` — concurrent calls both observe `!cfg.parser` and double-run
`Language.load` + `new Parser()` + `new Query()`. Currently serial inside `getFileTokenScores`'s loop,
but `getLanguageConfig` is public API (hosts could `Promise.all` files). Dedupe with a per-config
in-flight promise.

### CM-6 — LOW — language-table gaps

`languages.ts` `languageTable` — `.mjs`/`.cjs` (ESM/CJS modules — ubiquitous in modern TS/JS projects)
and `.mts`/`.cts` are unmapped, so those files are silently unindexed. `.c`/`.cc`/`.cxx`/`.h`, Kotlin,
Swift, PHP, Scala, CSS etc. are absent — but `@vscode/tree-sitter-wasm/wasm/` (verified) ships only
cpp/c-sharp/css/javascript/typescript, and the repo has no C/CSS queries, so those are correctly
documented as out of scope rather than half-added.

### CM-7 — LOW — TOCTOU + misclassified read errors

`parse.ts:255-262` — `fs.statSync(filePath).size` then `fs.readFileSync(filePath, 'utf8')`: the file can
change or vanish between the two calls (uncaught ENOENT lands in `parseTokensWithLimits`'s catch →
`emptyParsedTokens(false)` at `:243`). The readFile-provider rejection path returns
`emptyParsedTokens(false)` at `:183` too — a failed read is classified as *parsed*, consuming a
`MAX_PARSE_FILES` slot with zero tokens. Should be `skipped: true`.

### CM-8 — LOW — unnecessary cast

`parse.ts:387` — `(tree as { delete?: () => void }).delete?.()`. `Tree.delete(): void` exists in
web-tree-sitter 0.25.10 types (verified `node_modules/web-tree-sitter/tree-sitter.d.ts:338`). Use
`tree.delete()` directly; keep the `finally` (memory hygiene is correct).

### CM-9 — LOW — eval-style `__dirname` shim

`utils.ts:2` — `new Function('try { return __dirname; } ...')`. Works in the private runtime but is
CSP/sandbox-hostile and unwrapped at the call site (`resolveWasmPath` calls it outside any try).
Add an outer try/catch and keep the documented eslint-disable.

---

## Root Cause

Two classes: (1) a broken guard expression (`call in {}` — always-false except `__proto__`) that was
never exercised by the test corpus (no test uses Object.prototype-colliding tokens), and (2) a
module-level singleton that treats an init failure as terminal state without surfacing it. The rest are
accumulated small dead-code/robustness warts in a package that predates the current quality program.

## Proposed Solution (after approval — audit-only now)

1. **CM-1** — `parse.ts:311`: `call in {}` → `call in Object.prototype` (one token; covers
   `constructor`/`toString`/`valueOf`/`hasOwnProperty`/`isPrototypeOf`/`propertyIsEnumerable`/
   `toLocaleString`/`__proto__`).
2. **CM-2** — `languages.ts`: rework `UnifiedLanguageLoader` — lazy `initParser` that stores the
   in-flight promise (concurrent callers share it) but clears it on rejection so a later call retries;
   no eager module-scope promise (removes the unhandled-rejection risk). Add a one-time `console.warn`
   in `getLanguageConfig`'s catch (with eslint-disable) so a silently-degrading subsystem surfaces
   its cause once per process.
3. **CM-3** — `languages.ts:174-181`: collapse the dead loop to `return possiblePaths[0]` with a
   comment (behavior-identical — the loop always returned the first path).
4. **CM-4** — `languages.ts`: remove the `try { … } catch (err) { throw err }` wrapper in
   `createLanguageConfig`.
5. **CM-5** — `languages.ts`: add optional `initPromise?: Promise<void>` to `LanguageConfig`; in
   `createLanguageConfig`, `cfg.initPromise ??= (async () => { …init… })()` then `await` it, clearing
   it in a catch so a failed init can retry.
6. **CM-6** — `languages.ts` `languageTable`: add `.mjs`/`.cjs` → javascript wasm/query and
   `.mts`/`.cts` → typescript wasm/query. Document the out-of-scope boundary (C-family, Kotlin, Swift,
   PHP, CSS) in a table comment.
7. **CM-7** — `parse.ts`: readFile-provider rejection → `emptyParsedTokens(true)`; wrap the stat-path
   `readFileSync` in try/catch → `null` (skipped) on failure, closing the TOCTOU window.
8. **CM-8** — `parse.ts:387`: `tree.delete()` directly.
9. **CM-9** — `utils.ts`: wrap the `new Function` invocation in try/catch returning `undefined` on
   failure (callers already fall back to `process.cwd()`).

**Non-goals:** adding C/Kotlin/Swift/PHP/CSS grammars (wasm/query authoring is a separate feature
track); worker-thread parallel parsing (design note, larger change); changing the SDK's degraded-mode
handling of empty scores.

## Files To Be Changed (implementation stage)

- `packages/code-map/src/parse.ts` (CM-1, CM-7, CM-8)
- `packages/code-map/src/languages.ts` (CM-2, CM-3, CM-4, CM-5, CM-6)
- `packages/code-map/src/utils.ts` (CM-9)
- Tests: `packages/code-map/__tests__/parse.test.ts` or `integration.test.ts` (CM-1 regression —
  `toString`-collision corpus must not throw), `__tests__/languages.test.ts` (CM-6 — new extensions
  resolve), optional concurrent-init identity test (CM-5)

## Verification

- [x] Recon: 5 source files read 0-EOF; tests 50/50; typecheck clean; reachability verified
      (`run-state.ts:167`, SDK index export, smoke-test asserts `getFileTokenScores`)
- [x] `call in {}` semantics confirmed (`'toString' in {}` === false); `Tree.delete(): void` confirmed
      in web-tree-sitter types (d.ts:338); wasm manifest confirmed (`@vscode/tree-sitter-wasm/wasm/`)
- [x] No implementation files modified during this audit (audit-only)
- [x] Implementation: code-map 51 pass / 0 fail (incl. 1 new CM-1 regression), `bun run typecheck` clean,
      zero-warning ESLint (full-repo `--max-warnings 0` exit 0), Prettier clean on changed files,
      `bun run lint:md` exit 0
- [x] Implementation: SDK smoke caveat noted (smoke-test-dist requires a built dist absent from the
      tree; CJS tree-sitter harness failure pre-existing/environmental — `getFileTokenScores` export
      verified at source level via typecheck); independent AUDIT via code-reviewer (clean); CHANGELOG
      entry added; FID archived

## Perfection Loop

### Loop 1

- **RED:** Completed 2026-08-03 — findings CM-1…CM-9 catalogued with file:line evidence and runtime
  verification (50/50 tests, clean typecheck, `Tree.delete` exists, wasm manifest inspected, SDK
  caller + degradation path confirmed at `run-state.ts:171-174`).
- **GREEN:** Sequential thinking over each finding (see Summary). Missed-question check ("What
  questions should I have asked when this FID was created, but failed to?"):
  1. *Is the `call in {}` crash actually reachable with real tokens?* — Yes: `toString`/`valueOf`/
     `hasOwnProperty` are both ordinary identifiers and Object.prototype keys; `constructor` is only
     shielded by `IGNORE_TOKENS` scoring exclusion. The `callersByToken[call]` truthy-function path is
     confirmed (`length 1 < 25` then missing `.includes` → TypeError).
  2. *Does the crash surface loudly?* — No: the SDK catches it and continues with empty scores
     (warning only). So CM-1 is feature-loss, not a hard crash — severity MEDIUM, not CRITICAL.
  3. *Is the CM-2 retry safe against double-init?* — Yes: concurrent callers share one in-flight
     promise (stored before await); only a rejection clears it for retry.
  4. *Does collapsing `resolveWasmPath` change behavior?* — No: the loop always returned
     `possiblePaths[0]` (its try/catch could never throw); collapse is behavior-identical.
- **AUDIT:** Document-audit before implementation: CM-1 fix is a one-token expression change
  verified against `Object.prototype` member semantics; CM-2/CM-5 fixes follow the loader's existing
  promise-dedup pattern (`parserReady`) and are race-checked (single in-flight promise, clear-on-
  rejection); CM-6 additions reuse existing wasm/query pairs (no new grammars); CM-7's `skipped: true`
  classification is consistent with `getFileTokenScores`'s `if (parsed.skipped) continue` guard;
  CM-8 verified against the shipped type declarations. Call-graph evidence in Verification. Zero new
  public exports beyond the optional `LanguageConfig.initPromise` field (backward-compatible).
- **SELF-CORRECT:** Initial scan flagged CM-6 as "language coverage gaps" broadly; corrected during
  GREEN: the wasm manifest inspection bounded the fix to the four free JS/TS-family extensions and
  moved C-family/Kotlin/Swift/etc. to documented non-goals (writing new grammars is a feature track,
  not hygiene). CM-1 severity held at MEDIUM after confirming the SDK's catch-and-degrade path.
- **SELF-CORRECT (implementation):** CM-8 deviated from the FID's literal "use `tree.delete()`
  directly" — the optional call was retained (`tree.delete?.()`): web-tree-sitter's Tree declares
  `delete()`, but structurally-compatible test mocks omit it (8 mock tests failed on the direct call),
  and the cast (the actual Law-6 violation) is gone. An editing slip during CM-8 briefly dropped the
  call entirely (leaving only a comment — a production memory-leak regression); caught and restored in
  the immediate follow-up edit. CM-7 was completed in response to the independent AUDIT: the TOCTOU
  try/catch now wraps `statSync` as well as `readFileSync`, so a file that vanishes before the stat
  also classifies as skipped rather than parsed. SDK `smoke-test-dist` was found to require a built
  dist absent from the working tree — its CJS tree-sitter failure (`import_code_map is not defined`)
  is pre-existing/environmental, not caused by this FID.

## Lessons Learned

1. A guard expression that is always-false (`call in {}`) is indistinguishable from no guard at all —
   prototype-key collisions (`toString`, `valueOf`) are a real, common-input crash class. When
   writing "skip Object.prototype keys" logic, verify with `Object.prototype` explicitly.
2. Module-level singletons that cache a rejected init promise turn a transient failure into permanent
   silent disablement; clear-on-rejection + a one-time warn turns it into a retryable, diagnosable
   condition.

## Resolution

- **Fixed By:** Savant (operator-approved implementation — FID presented for approval, approved, then
  implemented)
- **Fixed Date:** 2026-08-03
- **Fix Description:** CM-1 — `parse.ts` `buildTokenCallers` guard `call in {}` → `call in
  Object.prototype` (covers constructor/toString/valueOf/hasOwnProperty/etc.; the old guard only
  caught `__proto__` and let a real `toString` collision crash the code map). CM-2 —
  `UnifiedLanguageLoader` rewritten: lazy `initParser` sharing one in-flight promise across concurrent
  callers, clearing it on rejection so a later call retries (no more permanent silent disablement),
  plus a one-time `console.warn` in `getLanguageConfig` surfacing the cause; no eager module-scope
  promise (removes the unhandled-rejection risk). CM-3 — dead wasm-path fallback loop collapsed to
  `return possiblePaths[0]` (behavior-identical). CM-4 — no-op `catch (err) { throw err }` removed.
  CM-5 — `LanguageConfig.initPromise` dedupes concurrent `createLanguageConfig` inits, cleared on
  failure for retry. CM-6 — `.mjs`/`.cjs` → javascript and `.mts`/`.cts` → typescript rows added to
  `languageTable` (same grammars; C-family/Kotlin/Swift/CSS documented out-of-scope). CM-7 — read
  failures (provider-reject and fs paths) classify as `skipped: true` instead of consuming a parse
  slot; the fs path now does stat+read in one try/catch window (TOCTOU closed, including a vanished-
  before-stat file). CM-8 — the `as { delete?: … }` cast removed; `tree.delete?.()` retained (the
  declared type has `delete()`, the optional call guards structurally-compatible mocks). CM-9 —
  `getDirnameDynamically` wrapped in an outer try/catch (CSP/sandbox-safe, callers already fall back
  to `process.cwd()`).
- **Tests Added:** `integration.test.ts` +1 — CM-1 regression: a `toString`-defined + `toString`-
  called corpus must resolve without throwing and produce no `toString` caller entry (fails on the old
  code). `languages.test.ts` — `languageTable.length` 10→12 and the `expectedLanguages` list extended
  for `.mjs`/`.cjs`/`.mts`/`.cts`. Existing 8 mock parse tests exercised the CM-8 guard (they fail on
  a direct `tree.delete()`), confirming the retained `?.`.
- **Verified By:** Savant — independent AUDIT via code-reviewer (clean — no CRITICAL/HIGH/MEDIUM;
  CM-7 statSync window completed in response; CM-8 `?.` deviation documented). Gate suite: code-map
  51 pass / 0 fail, code-map typecheck clean, full-repo `bun x eslint . --max-warnings 0` exit 0,
  `bun run lint:md` exit 0, Prettier clean. SDK smoke caveat: `smoke-test-dist` requires a built dist
  (absent in the tree); the CJS tree-sitter failure is pre-existing/environmental; the
  `getFileTokenScores` export assertion holds at source level (typecheck).
- **Commit/PR:** None (working tree)
- **Archived:** Yes
