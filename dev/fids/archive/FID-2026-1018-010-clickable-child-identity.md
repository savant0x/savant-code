# FID: Preserve clickable child identity

**Filename:** `FID-2026-1018-010-clickable-child-identity.md`
**ID:** FID-2026-1018-010
**Severity:** low
**Status:** closed
**Created:** 2026-10-18 22:10
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

The shared clickable normalization turns static JSX children into a new unkeyed
array. React reports missing keys from Button in CommandPalette and FollowupLine.

## Environment

- **OS:** Windows
- **Language/Runtime:** TypeScript, Bun 1.3.14, React 19
- **Commit/State:** e26b9ab230f8ebf1df543d819bf0d48a914f0ea4

## Detailed Description

### Problem

debug/cli.jsonl records the unique-key error at 2026-10-19T01:32:51.702Z
from Button's CommandPalette children and at 01:39:35.113Z from FollowupLine.

### Expected Behavior

Normalization preserves React sibling identity, non-selectable text and flat host
children, without wrapping text/span children in unsupported fragments.

### Root Cause

cli/src/components/clickable.tsx:38 uses node.flatMap on children and
cloneElement with a dynamic child array. Static JSX siblings originally need no
keys, but the newly returned array does. Existing explicit keys are preserved
by cloneElement; implicit keys are never created.

### Evidence

`rg -n 'makeTextUnselectable' cli/src/components` reaches Button and Clickable.
Button calls the helper before rendering its box; CommandPalette passes static
box siblings and FollowupLine passes static span siblings through this seam.

## Impact Assessment

- Affects shared Button/Clickable descendants; no command or input behavior changes.
- Low risk: use React.Children.toArray to normalize identity at the existing seam.

## Proposed Solution

1. Normalize arrays with React.Children.toArray before recursively flattening;
   its scoped keys distinguish nested sibling arrays and preserve explicit keys.
2. Cover static JSX siblings and nested fragments with focused regression tests
   in cli/src/components/__tests__/clickable.test.tsx.
3. Run focused tests, CLI typecheck, quality, lint and full project gates.

### Verification

Assert non-null unique keys on formerly static element arrays and distinct keys
for repeated explicit keys scoped inside different nested arrays. Preserve the
existing host non-selectability and no-fragment assertions.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/components/__tests__/clickable.test.tsx
- gate: quality

### Verification Receipt

- fingerprint: sha256:1181eb6ad5a5098bd9b604c009c93aa38bb6a35d97ac6a9fb094fd7ffd3c689e
- verified: 2026-10-19T02:43:54.576Z
- typecheck cli: exit 0
- test cli/src/components/__tests__/clickable.test.tsx: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- RED: log evidence and helper callers inspected; no caller-specific key patch.
- GREEN: React's child normalization owns array key scoping before flattening.
- AUDIT: existing tests only check shape/non-selectability; extend with identity.
- ADVERSARIAL: fragments can contain sibling arrays, so recursion must normalize
  their child arrays too. Do not add fragments to host output.

### Missed Questions

1. Are command IDs duplicated? The warning names children passed to Button,
   whose own helper clones static children; it does not name the palette's map.
2. Can an index alone fix it? No: explicit keys in nested arrays need scoping.

### Loop 2 — convergence

- Manual design review: existing recursion retains fragment flattening and
  cloneElement; change only array iteration and add identity assertions.
- No new API or production caller is introduced. Implementation is authorized
  by AUDIT-2026-1018 and the operator's project-wide loose-end request.

## Resolution

### Code Verification Evidence

Focused child-identity suite: 5 pass, 0 fail; CLI typecheck and scoped ESLint
exit 0. Shared Button/Clickable callers remain wired to the repaired helper.

Implementation and focused verification complete; committed as `0c50fa8e`.

**Closed:** 2026-10-19
**Archived:** 2026-10-19

## Lessons Learned

Transforming static JSX child arrays makes identity normalization the shared
helper's responsibility rather than each caller's responsibility.
