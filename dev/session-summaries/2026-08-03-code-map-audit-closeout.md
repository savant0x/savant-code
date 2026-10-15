# 2026-08-03 — Code-Map Package Audit Closeout (FID-2026-0803-006)

## Scope

Continuation of the 2026-08-03 quality session. Audited `packages/code-map` (tree-sitter indexing +
language detection; ~900 lines read 0-EOF) for correctness, performance, and type safety. Produced 9
findings (2 medium / 7 low). Opened FID-2026-0803-006, ran the Perfection Loop (RED → GREEN → AUDIT →
SELF-CORRECT → COMPLETE), presented for operator approval, implemented, verified, and archived.
No git commit, push, tag, or publish operation was performed.

## Findings and fixes (all implemented)

- **CM-1 (MEDIUM):** dead `call in {}` guard in `buildTokenCallers` (parse.ts) — a `toString`/`valueOf`
  token collision crashed the code map. Fixed to `call in Object.prototype` + regression test.
- **CM-2 (MEDIUM):** `UnifiedLanguageLoader` cached a `Parser.init` rejection forever (silent permanent
  disablement). Fixed: lazy init, shared in-flight promise, clear-on-rejection retry, one-time warn.
- **CM-3 (LOW):** dead wasm-path fallback loop → collapsed to explicit first-path return.
- **CM-4 (LOW):** no-op `catch (err) { throw err }` removed.
- **CM-5 (LOW):** `LanguageConfig.initPromise` dedupes concurrent lazy inits.
- **CM-6 (LOW):** `.mjs`/`.cjs`/`.mts`/`.cts` added to the language table (same grammars).
- **CM-7 (LOW):** read failures classify as `skipped`; stat+read single-window try/catch (TOCTOU).
- **CM-8 (LOW):** `as { delete?: … }` cast dropped; `tree.delete?.()` retained (mock/runtime compat).
- **CM-9 (LOW):** `getDirnameDynamically` hardened with an outer try/catch.

## Verification (all green)

- code-map suite: 51 pass / 0 fail (incl. 1 new CM-1 regression test)
- code-map typecheck: clean · full-repo ESLint `--max-warnings 0`: exit 0 · `bun run lint:md`: exit 0
- Prettier clean on all changed files
- Independent AUDIT via code-reviewer: clean (no CRITICAL/HIGH/MEDIUM; CM-7 statSync window completed
  in response, CM-8 `?.` deviation documented)
- SDK smoke caveat: `smoke-test-dist` requires a built dist absent from the tree; the CJS tree-sitter
  harness failure is pre-existing/environmental — `getFileTokenScores` export verified at source level
  via typecheck

## Files changed

`packages/code-map/src/{parse,languages,utils}.ts` ·
`packages/code-map/__tests__/{integration,languages,parse}.test.ts` (parse.test.ts unchanged — 8 mock
tests were the CM-8 guard evidence) · `CHANGELOG.md` · `dev/LEARNINGS.md` · this summary.

## Status

Open: none (all FIDs archived). Working tree contains the v0.0.16 in-flight release work.
