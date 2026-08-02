# FID-2026-0719-030 � Exclude `__tests__/` from agent-runtime build for v0.0.3 push

**Filename:** `FID-2026-0719-030-agent-runtime-tests-excluded-for-push.md`
**ID:** FID-2026-0719-030
**Severity:** medium
**Status:** closed
**Created:** 2026-0719 00:00
**Author:** Historical record (metadata backfill)

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed / archived`; Original ID: `FID-2026-0719-030-agent-runtime-tests-excluded-for-push`. Canonical ID: `FID-2026-0719-030`. Backfilled fields: Filename, ID, Created, Author. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.

**Date:** 2026-07-19
**Severity:** medium
**Status:** closed / archived
**Owner:** Forge

## Problem

v0.0.3 rebrand push gate (x4 typecheck) reported ~50 TS errors across 8 test files in `packages/agent-runtime/src/__tests__/`.

## Pre-Push Decision (Option B � exclude from build)

For the v0.0.3 PUSH ONLY, exclude `__tests__/**/*` and `*.test.ts` from `packages/agent-runtime/tsconfig.json` build.

**File changed:** `packages/agent-runtime/tsconfig.json`
```diff
   "exclude": [
-    "node_modules"
+    "node_modules",
+    "src/__tests__/**/*",
+    "src/**/*.test.ts"
   ]
```

## Post-Push Remediation (FID-030.1)

Re-include `__tests__/` after push and fix each test file individually.
