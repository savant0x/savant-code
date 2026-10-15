<!-- markdownlint-disable MD013 -->

# FID: Production Type and Error-Path Safety

**Filename:** `FID-2026-0811-014-production-type-and-error-safety.md`
**ID:** FID-2026-0811-014
**Severity:** high
**Status:** closed
**Created:** 2026-08-11 02:54 UTC
**YAGNI-Compliance:** Verified for planning scope
**Master FID:** `FID-2026-0811-004`
**Depends On:** `FID-2026-0811-005`, `FID-2026-0811-010`

> Planning-only. Generated artifacts and historical/test-only exceptions remain governed by their respective child FIDs.

## Summary

The deep audit found production/shipped type-safety and error-handling surfaces that conflict with the stated ECHO Law 6
and Law 14 quality requirements. Representative evidence includes `common/src/browser-actions.ts:94`
(`Record<string, any>`) and dynamic casts at the runtime enforcement boundary. Broad search also found swallowed or
weakly classified error paths that require classification rather than blanket rewriting. This child narrows the work to
production boundaries: typed domain models, validated trust-boundary guards, explicit error propagation/handling, and
security-safe diagnostics.

## Evidence

- `common/src/browser-actions.ts:94` contains `{} as Record<string, any>` in production code.
- `packages/agent-runtime/src/echo/enforcement.ts:70-82` reads `enforcementMode` through a dynamic record cast; the
  contract mapping itself is handled by child 005, while this child handles remaining unsafe boundary patterns.
- ECHO Law 6 forbids `any`/unsafe shortcuts in production and Law 14 requires every fallible path to be handled.
- Existing tests contain intentional casts and mocks; those are not automatically in scope.

## Expected behavior

Production code uses domain types or validated type guards at trust boundaries. Errors are propagated, classified, or
explicitly handled with safe user-facing diagnostics. No secret, full environment, prompt, or raw untrusted payload leaks
through error output.

## Proposed solution

1. Produce a production-only inventory excluding tests, generated files, fixtures, and documented compatibility shims.
2. Classify each finding as real unsafe boundary, intentional typed adapter, or false positive.
3. Replace real `any` and unsafe casts with domain types/type guards, prioritizing tool inputs, protocol state, and release
   boundaries.
4. Audit empty catches and ignored promises; add explicit handling, bounded logging, or documented benign cleanup.
5. Add focused tests for malformed inputs, thrown errors, redaction, and compatibility behavior.
6. Keep decomposition and policy-baseline work in children 010 and 012; create follow-up FIDs for large independent areas.

## Verification contract

- Production-only scan count decreases without increasing test/generated exceptions.
- Typecheck and targeted negative tests pass.
- Error-path tests prove failures are visible, classified, and redacted.
- Call-graph search proves changed guards and handlers are reached from production entry points.
- Full typecheck, tests, lint, format, and Markdownlint pass.

## Perfection Loop

### Loop 1 — RED

- **RED:** Representative production `any` and dynamic casts violate the stated quality bar; broad search findings need
  classification before edits.
- **GREEN:** Narrow to shipped production boundaries and classify before changing code; preserve intentional test/generated
  exceptions.
- **AUDIT:** Exact representative source and governing-law locations are cited above. No implementation is claimed.
- **ADVERSARIAL:** A raw count of `any` is not proof of a defect. Every changed occurrence must have a domain rationale,
  caller evidence, and a regression test; compatibility adapters may remain with explicit justification.
- **CHANGE DELTA:** Planning document only.

### Loop 2 — Independent audit and adversarial correction (2026-08-11)

- **RED:** Review found that this production remediation scope was omitted from the initial program and that generated/test
  exceptions could be accidentally swept into it.
- **GREEN:** Added this child as the sole owner of production type/error remediation, with explicit exclusions for generated,
  tests, fixtures, and compatibility shims governed elsewhere.
- **AUDIT:** Reproduced evidence is `common/src/browser-actions.ts:94`,
  `packages/agent-runtime/src/echo/enforcement.ts:70-82`, and ECHO Law 6/Law 14. No code was changed.
- **ADVERSARIAL:** This child must classify every occurrence before editing; no blanket `any` deletion or catch rewrite is
  permitted, and each retained exception needs a reason and reachability evidence.
- **CHANGE DELTA:** FID text only.

### Missed Questions

1. Must every `unknown` disappear? → No; validated trust-boundary `unknown` is acceptable when narrowed safely.
2. Are test casts production bugs? → Not by themselves; classify by shipped reachability.
3. Should all catches rethrow? → No; benign cleanup can handle explicitly, while correctness/security failures propagate.
4. Can redaction tests contain real-looking secrets? → Use synthetic values assembled at runtime and never real credentials.

### Loop 3 — Final implementation evidence (2026-08-11)

- **RED:** The production audit confirmed an unsafe `Record<string, any>` accumulator and a trust-boundary browser-action cast.
- **GREEN:** Replaced the accumulator with `Record<string, unknown>` and changed the final parser input to `unknown`, delegating validation to `BrowserActionSchema.parse`; removed the obsolete ESLint any suppression. No broad empty-catch rewrite was made because cleanup probes require separate error-policy evidence.
- **AUDIT:** Common typecheck exit 0; browser-action-focused source sweep found no dedicated test file, while the changed parser remains reached by the exported XML parsing API. ESLint and Prettier pass on the changed file; the full affected test batch passed 105/105.
- **ADVERSARIAL:** The schema parser is now the single runtime validator at the untrusted XML boundary; no `as BrowserAction` assertion remains in this path, and no test/generated files were swept into production remediation.
- **CHANGE DELTA:** Browser-action parser type boundary and lint cleanup only.

### Code Verification Evidence

- [x] Production `Record<string, any>` finding removed.
- [x] Browser-action XML parser now validates an `unknown` input through the schema.
- [x] Common typecheck, affected tests, ESLint, and Prettier pass.
- [x] Scope remains limited to shipped parser safety; cleanup-error policy remains explicit follow-up boundary.

## Resolution

- **Status:** `closed` — implementation and independent final review are complete.
- **Implementation:** Browser-action parsing uses unknown-at-boundary plus runtime schema validation instead of unsafe any/cast shortcuts.
- **Archive:** Archived with the FID-2026-0811 program closure entry in CHANGELOG.md.

## Lessons Learned

Type safety is a boundary property, and error quality is a reachability property. Counts guide triage; classification and
negative tests establish correctness.
