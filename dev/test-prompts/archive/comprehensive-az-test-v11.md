# Savant-Code — Comprehensive A-Z System Test v11 (v0.0.6 Release)

**Purpose:** Regression suite for the v0.0.6 release. This prompt extends [v10](comprehensive-az-test-final.md) with new phases for the ECHO compliance work (FID-068/069/070/071) and the Cloudflare Workers AI provider (FID-072). Run v10 first, then run the additional tests below.

**Environment:** Savant-Code CLI with ECHO Protocol v0.2.0 active.

**Before you start:**
1. Run `bash scripts/run-az-test.sh` and confirm the v10 baseline passes.
2. Run the v0.0.6-specific phases below.
3. Save all evidence to `dev/scratchpad/`.

---

## Phase 29: ECHO Compliance — Type Safety, Lint Zero-Warnings, Utility Deduplication (v0.0.6)

### Test 149-156: Type safety / no `any`/`Record<string, unknown>` shortcuts (FID-068)
Verify the core production code no longer relies on loose `any` or `Record<string, unknown>` for tool/JSON payloads.

```bash
# JSON value domain type exists and is used across workspaces
spawn detective: { "searchQueries": [{ "pattern": "export type JSONValue", "flags": "common/src/types/json.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "safeParseJSONObject", "flags": "common/src/util/type-narrowing.ts -n" }] }

# No remaining production `any` or `Record<string, unknown>` in high-traffic files
spawn detective: { "searchQueries": [{ "pattern": "Record\\s*<\\s*string\\s*,\\s*unknown\\s*>", "flags": "cli/src -g *.ts -g *.tsx -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "Record\\s*<\\s*string\\s*,\\s*unknown\\s*>", "flags": "sdk/src -g *.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "Record\\s*<\\s*string\\s*,\\s*unknown\\s*>", "flags": "packages/agent-runtime/src -g *.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "Record\\s*<\\s*string\\s*,\\s*unknown\\s*>", "flags": "common/src -g *.ts -n" }] }
```

**Expected:**
- `common/src/types/json.ts` defines `JSONValue`, `JSONObject`, `JSONArray`.
- `common/src/util/type-narrowing.ts` exports `safeParseJSONObject` / `isJSONObject`.
- The four regex searches return no production matches (test files and `eslint-disable` comments may still contain the pattern).

### Test 157-160: ESLint zero-warnings across four core workspaces (FID-069)
Verify the four core workspaces pass `eslint --max-warnings 0`.

```bash
run_readonly_command: { "command": "bun x eslint common/src cli/src sdk/src packages/agent-runtime/src --max-warnings 0" }
```

**Expected:** Exit code 0 with no warnings.

### Test 161-165: Production TODO and console.log cleanup (FID-070)
Verify production source no longer contains TODO comments or unguarded console usage.

```bash
spawn detective: { "searchQueries": [{ "pattern": "TODO", "flags": "cli/src -g *.ts -g *.tsx -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "TODO", "flags": "sdk/src -g *.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "TODO", "flags": "packages/agent-runtime/src -g *.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "TODO", "flags": "common/src -g *.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "console\\.(log|warn|error)", "flags": "cli/src -g *.ts -g *.tsx -n" }] }
```

**Expected:**
- No `TODO` matches in production source (only in tests, comments with `NOTE`, or blacklists).
- No unguarded `console.log`/`console.warn`/`console.error` calls in production source; only `console.error` inside justified `eslint-disable-next-line no-console` blocks.

### Test 166-170: Utility-first deduplication (FID-071)
Verify the deduplicated utilities are canonical and dead files are removed.

```bash
# Dead file removed
run_readonly_command: { "command": "test ! -f common/src/util/agent-name-resolver.ts && echo DELETED" }
run_readonly_command: { "command": "test ! -f cli/src/utils/agent-id-utils.ts && echo DELETED" }
run_readonly_command: { "command": "test ! -f cli/src/utils/time-format.ts && echo DELETED" }

# Canonical functions are still exported from the right locations
spawn detective: { "searchQueries": [{ "pattern": "export function getSimpleAgentId", "flags": "common/src/util/agent-id-parsing.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "export function pluralize", "flags": "common/src/util/string.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "export function formatTimeUntil", "flags": "common/src/util/dates.ts -n" }] }
```

**Expected:**
- `common/src/util/agent-name-resolver.ts`, `cli/src/utils/agent-id-utils.ts`, and `cli/src/utils/time-format.ts` no longer exist.
- `getSimpleAgentId` is exported from `common/src/util/agent-id-parsing.ts`.
- `pluralize` is exported from `common/src/util/string.ts`.
- `formatTimeUntil` is exported from `common/src/util/dates.ts`.

---

## Phase 30: Cloudflare Workers AI Provider (v0.0.6, FID-072)

### Test 171-176: Cloudflare gateway provider wiring
Verify Cloudflare Workers AI is wired like the other gateway providers (TokenRouter, NVIDIA, OpenCode Go).

```bash
spawn detective: { "searchQueries": [{ "pattern": "cloudflare", "flags": "common/src/constants/model-config.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "isCloudflareModel", "flags": "sdk/src/impl/model-provider.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "createCloudflareModel", "flags": "sdk/src/impl/model-provider.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "getCloudflareApiTokenFromEnv", "flags": "sdk/src/env.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "getCloudflareAccountIdFromEnv", "flags": "sdk/src/env.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "isCloudflareModel", "flags": "sdk/src/index.ts -n" }] }
```

**Expected:**
- `common/src/constants/model-config.ts` contains a `cloudflareModels` catalog and adds `cloudflare` to `ALLOWED_MODEL_PREFIXES`/`providerDomains`.
- `sdk/src/impl/model-provider.ts` defines `isCloudflareModel()` and `createCloudflareModel()` and routes them in `getModelForRequest()`.
- `sdk/src/env.ts` exposes the account ID and API token getters.
- `sdk/src/index.ts` re-exports `isCloudflareModel`.

### Test 177-178: Model catalog integration
Verify the CLI recognizes the new provider prefix.

```bash
spawn detective: { "searchQueries": [{ "pattern": "cloudflare", "flags": "cli/src/utils/openrouter-models.ts -n" }] }
spawn detective: { "searchQueries": [{ "pattern": "cloudflare", "flags": "cli/src/components/model-picker.tsx -n" }] }
```

**Expected:**
- At least one reference in `cli/src/utils/openrouter-models.ts`.
- At least one reference in `cli/src/components/model-picker.tsx`.

---

## Phase 31: Release metadata (v0.0.6)

### Test 179-181: Version bump and changelog
Verify the release metadata is consistent across the repo.

```bash
run_readonly_command: { "command": "cat VERSION" }
run_readonly_command: { "command": "node -p \"require('./package.json').version\"" }
run_readonly_command: { "command": "node -p \"require('./cli/package.json').version\"" }
```

**Expected:**
- `VERSION` reads `0.0.6`.
- `package.json` version is `0.0.6`.
- `cli/package.json` version is `0.0.6`.

---

## Reporting

Save the following to `dev/scratchpad/az-test-v11-results.md`:
1. Phase-by-phase PASS/FAIL/SKIP counts.
2. Any unexpected findings from the new phases.
3. Confirmation that `scripts/run-az-test.sh` (v10) still passes.
4. Link to the evidence saved in `dev/scratchpad/`.
