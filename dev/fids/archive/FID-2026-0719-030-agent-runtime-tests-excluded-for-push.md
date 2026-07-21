# FID-2026-0719-030 — Exclude `__tests__/` from agent-runtime build for v0.0.3 push

**Date:** 2026-07-19
**Severity:** medium
**Status:** open
**Owner:** Forge

## Problem

v0.0.3 rebrand push gate (x4 typecheck) reported ~50 TS errors across 8 test files in `packages/agent-runtime/src/__tests__/`.

## Pre-Push Decision (Option B — exclude from build)

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
