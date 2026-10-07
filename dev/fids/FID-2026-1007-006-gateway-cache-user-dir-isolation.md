# FID: The CLI test suite reads the operator's real gateway cache — one red gate, and a user-data leak into assertions

**Filename:** `FID-2026-1007-006-gateway-cache-user-dir-isolation.md`
**ID:** FID-2026-1007-006
**Severity:** medium
**Status:** analyzed
**Created:** 2026-10-07 16:20
**Automation level:** 3
**YAGNI-Compliance:** Pending

---

## Summary

`bun run test` is RED on the first workspace after `sdk`: the `cli` leg reports
**3961 pass / 18 skip / 1 fail**, so the chain stops there and eleven workspaces are
never reached. The single failure is
`cli/src/utils/__tests__/openrouter-models-lookup.test.ts:34`, which mocks
`globalThis.fetch` with `{ id: 'openai/gpt-5', name: 'GPT-5' }` and asserts
`findGatewayModel('openai/gpt-5')?.name === 'GPT-5'` — and receives `'OpenAI: GPT-5'`.
The test passes in isolation (3 pass / 0 fail), and no fixture anywhere in the repository
contains the string it receives. The operator's **real** gateway cache at
`~/.savant-code/gateway-catalog.json` does, byte for byte:

```json
"id":"openai/gpt-5","name":"OpenAI: GPT-5","description":"GPT-5 is OpenAI's most …",
"contextLength":400000, … "created":1754587413
```

So a test is asserting against the operator's own cached provider data. This is a new
instance of the isolation class FID-2026-1007-001 and FID-2026-1007-002 closed for the
agent-runtime workspace: the seam is `gatewayCache` (module scope, shared by every test
file in the `bun test` process) and the isolation that exists is opt-in per file.

## Environment

- **OS:** win32 (Git Bash)
- **Language/Runtime:** TypeScript (strict), Bun 1.3.14
- **Tool Versions:** git, bun test
- **Commit/State:** base `0fd258dd` (docs-only commits precede this record; no source
  file in this path was touched by them). The failure is therefore pre-existing.
- **Measured with:** `bun run test` from the repo root, `bun test
  src/utils/__tests__/openrouter-models-lookup.test.ts` from `cli/`, and a read of the
  real cache file

## Detailed Description

### Problem

Two harms, one cause.

**(1) A repository gate is red and hides eleven workspaces.** The root test script is a
`&&` chain (`bun run --cwd=sdk test && bun run --cwd=cli test && …`), so the `cli`
failure means `common`, `agents`, `evals`, `packages/agent-runtime`,
`packages/design-systems`, `packages/code-map`, `packages/database`,
`packages/knowledge-graph`, `packages/llm-providers`, `packages/connectors` and
`desktop` were not exercised by that command in this session.

**(2) Test assertions read the user's real data.** The value the assertion received is
the operator's own cached OpenRouter row, which means the CLI suite is not hermetic with
respect to `~/.savant-code/`: a test's verdict depends on what the machine's owner last
fetched, and the failure message prints that data.

### Expected Behavior

- The CLI test process never reads or writes the user's config directory: a test that
  needs a config dir gets one that the suite owns.
- `gatewayCache` cannot carry one file's catalog into another file's assertion.
- `bun run test` reaches every workspace in the chain.

### Root Cause

- The catalog cache path resolves through the user config dir:
  `gateway-disk-cache.ts:23-25` → `path.join(getConfigDir(), 'gateway-catalog.json')`.
- The shared harness isolates this by setting `SAVANT_CODE_CONFIG_DIR` to a fresh temp
  dir per case (`openrouter-models-test-harness.ts:32-38`, `registerGatewayCatalogLifecycle`),
  which is opt-in: only the files that call `registerGatewayCatalogLifecycle()` are
  isolated, and the temp dir only affects the cache path while that env var is set.
- The in-memory catalog is module scope in `gateway.ts` (`let gatewayCache:
  OpenRouterModel[] | null`), written by the async body of `fetchGatewayModels`
  (`gateway.ts:246-249`) and read by `findGatewayModel` via
  `getCachedGatewayModels()` (`gateway-lookup.ts:22`). `__resetOpenRouterModelsCacheForTest`
  nulls both it and `gatewayInflight` (`gateway.ts:266-289`) — but it is called from the
  harness's `beforeEach`, so a file that does not use the harness neither resets nor is
  reset by it, and an in-flight promise started under the real config dir can resolve
  after another file's reset and repopulate the cache.

The exact leaking file has NOT been identified yet; that is step 1 below. What is proven
is the signature: the received string exists in the real cache and in no fixture.

### Evidence

```text
$ bun run test
$ bun run --cwd=sdk test && bun run --cwd=cli test && …
…
 3961 pass
 18 skip
 1 fail
Ran 3980 tests across 480 files. [127.86s]
error: script "test" exited with code 1
root_test_exit=1

(fail) openrouter-models > findGatewayModel resolves exact, prefix, and family matches

src\utils\__tests__\openrouter-models-lookup.test.ts:34
    expect(findGatewayModel('openai/gpt-5')?.name).toBe('GPT-5')
error: expect(received).toBe(expected)
Expected: "GPT-5"
Received: "OpenAI: GPT-5"

$ cd cli && bun test src/utils/__tests__/openrouter-models-lookup.test.ts
 3 pass
 0 fail
 7 expect() calls
Ran 3 tests across 1 file. [1.51s]
isolated_exit=0
```

```text
$ code_search "OpenAI: "            # every literal in the repository
.env.example:69:  # OpenAI: https://api.openai.com/v1
cli/src/utils/__tests__/openrouter-models.test.ts:41:  { id: 'openai/gpt-4o', name: 'OpenAI: GPT-4o' }
docs/design/Free LLM API Aggregator Research.md:351:  > 78. Stop Paying OpenAI: …

$ grep -o '"id":"openai/gpt-5"[^}]*' ~/.savant-code/gateway-catalog.json
"id":"openai/gpt-5","name":"OpenAI: GPT-5","description":"GPT-5 is OpenAI’s most advanced model,
offering major improvements …","contextLength":400000,…,"created":1754587413

$ ls ~/.savant-code/ | filter
gateway-catalog.json        # 1,014,379 bytes, "savedAt":1790917551761
```

## Impact Assessment

### Affected Components

- `cli/src/utils/openrouter-models/gateway.ts` (`gatewayCache`, `gatewayInflight`, the
  reset seam)
- `cli/src/utils/openrouter-models/gateway-disk-cache.ts` (the user-dir path)
- `cli/src/utils/__tests__/openrouter-models-test-harness.ts` (opt-in isolation)
- every `cli` test file that calls `fetchGatewayModels` without the harness
- `bun run test` (the repository's own test gate)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

Medium: the product is unaffected (the failure is test-only), but a hard repository gate
is red, the red hides eleven workspaces, and the failure mode prints the operator's own
provider data. The workaround — running each workspace from its own root — is what
masked it.

## Proposed Solution

### Approach

Make the isolation unconditional instead of opt-in: the CLI test process must not be
able to resolve the user's config dir at all, and the shared catalog state must be reset
by something every file inherits rather than by a harness a file must remember to call.
Per this repository's convention, that means a workspace-level preload (the
`bunfig.toml` `[test] preload` pattern FID-2026-1007-002 established for `cli`), with the
existing per-file harness kept as the finer-grained seam.

### Steps

1. Identify the leaking file and prove the mechanism: run the failing file with the real
   cache present, then with `SAVANT_CODE_CONFIG_DIR` pointed at an empty temp dir, then
   bisect the file that first populates `gatewayCache` from the real path.
2. Move the config-dir isolation from the harness into the `cli` workspace preload so
   every test file inherits it; keep `registerGatewayCatalogLifecycle` for the per-case
   temp dir it already provides.
3. Make `findGatewayModel`'s state reachable only through paths a reset owns, or extend
   the preload reset to `gatewayCache`/`gatewayInflight`/`gatewayCatalogListeners` so no
   file can observe another file's catalog.
4. Pin the property: a test that fails when the user config dir is readable by the suite
   (the pin must fail on the pre-fix tree, which is what makes it evidence).
5. Sweep the class in the same pass: any other `cli` test that reaches user-directory
   state (`message-history.json`, `settings.json`, `credentials.json`, project data
   dirs) without an env override.

### Verification

- The reproduction is pinned in `cli/src/utils/__tests__/openrouter-models-lookup.test.ts`
  itself (it already fails on the full-process run) and the isolation property is pinned
  in `cli/src/utils/__tests__/openrouter-models-gateway.test.ts`.
- `bun run test` from the repo root must reach the end of the chain with 0 fail — the
  gate this record exists to restore.
- `typecheck cli` and `quality` gate the change.
- The workspace chain itself cannot be a declared gate: the vocabulary admits a single
  `test <path>`, and `validate:repository` can never be one (C3 recursion), so
  `bun run test` is proven by hand and quoted in the Resolution.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/utils/__tests__/openrouter-models-lookup.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-gateway.test.ts
- gate: quality

## Perfection Loop

### Loop 1 — RED

- **RED (measured):** the failure is reproduced from the shipped command, with the exact
  received value, and reproduced as *absent* when the file runs alone — so the red is
  cross-file state, not a wrong expectation.
- **GREEN:** the plan above (preload-owned isolation → reset ownership → pin → sweep).
- **AUDIT:** the signature was traced rather than guessed: the received string exists in
  the operator's real cache and in no fixture, and the cache path resolves through
  `getConfigDir()` while the harness's isolation is opt-in.
- **ADVERSARIAL:** the strongest objection is that the failure could be a stale in-flight
  promise rather than a file reading the real dir; both are the same defect (module-scope
  state + user-dir reachability) and step 1 distinguishes them before any edit, which is
  why this record stays `analyzed` instead of claiming a converged plan.
- **CHANGE DELTA:** new document (n/a).

### Missed Questions

1. **Is this FID-2026-1007-001/002 again?** Same class, different workspace and different
  seam: those cured `providerBreakers` and 144 module-scope bindings in
  `packages/agent-runtime`; this is `gatewayCache` in `cli`. Worth recording separately
  because the fix shape (a preload that owns the config dir) is new.
2. **Was this red before this session's commits?** Yes, by construction: the whole diff
  of this session ahead of the record is documentation plus one blank line in
  `packages/agent-runtime/src/util/trimming.ts`; the failing file and the gateway module
  are untouched.
3. **Does it matter that the test mocks `globalThis.fetch`?** It narrows the paths: a
  mocked build cannot be overwritten by a *later* real fetch of the same file, so the
  clobbering catalog was built by another file (or by the warm-start disk read, which
  `forceRefresh` does not take — the harness sets `forceRefresh = true`, whose disk
  branch is skipped, which is why the leaking file is not the harness's own).
4. **Is the operator's data at risk?** Only its display in test output; the suite does not
  write to the real dir from these paths (the harness uses a temp dir). The issue is
  hermeticity, not exfiltration.
5. **Why is only one test red?** Because only one assertion compares a mocked name
  against a catalog that a leak can replace; the rest of the family asserts shapes that
  both catalogs satisfy.

### Implementation Evidence (REQUIRED for `closed`)

> NOT STARTED. Analysis is complete; the leaking file is not yet identified (step 1).

- [ ] **Commit SHA:** —
- [ ] **File:line ranges:** —
- [ ] **Gate output:** —
- [ ] **Reproducibility:** `bun run test` (red, quoted above) and
      `cd cli && bun test src/utils/__tests__/openrouter-models-lookup.test.ts` (green)
- [ ] **Step statuses:** step 1 is the next action; steps 2-5 planned

### Code Verification Evidence

- [x] Files referenced exist, verified by read: `gateway.ts`,
      `gateway-disk-cache.ts`, `gateway-lookup.ts`,
      `cli/src/utils/__tests__/openrouter-models-test-harness.ts`,
      `cli/src/utils/__tests__/openrouter-models-lookup.test.ts`
- [x] The failure output is pasted from the actual command, with its exit status
- [x] The received value is traced to `~/.savant-code/gateway-catalog.json` (evidence quoted)
- [x] FID status reflects reality (`analyzed`: root cause evidenced, leaking file not yet
      named, no code written)

## Resolution

- **Closed Date:** —
- **Fix Description:** —
- **Tests Added:** —
- **Verification Evidence:** —
- **Archived:** —

## Lessons Learned

1. Opt-in isolation is not isolation. Per-file environment overrides leave every other
   file sharing the process — and the leak is only visible when a file's assertion is
   sensitive to data the machine happens to hold.
2. A test that passes in isolation and fails in the suite is telling you where the state
   lives, not that the test is flaky. The `&&`-chained root gate turned that signal into
   a one-line red and eleven silent workspaces.
3. When a failure names a value no fixture contains, search the machine, not the
   repository — the answer was in the operator's own cache directory.
