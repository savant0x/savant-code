# FID: The CLI test suite reads the operator's real gateway cache — one red gate, and a user-data leak into assertions

**Filename:** `FID-2026-1007-006-gateway-cache-user-dir-isolation.md`
**ID:** FID-2026-1007-006
**Severity:** medium
**Status:** fixed
**Created:** 2026-10-07 16:20
**Automation level:** 3
**YAGNI-Compliance:** Verified

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

**Step 1 named the file, and it corrected this record's own first draft.** No test reads
the operator's cache: the suite's default config directory resolves to
`~/.savant-code-dev`, which holds no catalog at all (measured: `~/.savant-code/` has
one, `~/.savant-code-test/` has one, `~/.savant-code-dev/` has none). What the suite
does instead is **fetch**. `startGateway()` fires `void fetchGatewayModels()` as a boot
warm (`cli/src/server/gateway.ts:114`), the server test harness raises it **36 times per
run**, and each of those builds goes to the LIVE upstream because no server test mocks
the catalog leg. The value the assertion received is OpenRouter's own naming for
`openai/gpt-5` — which is exactly why the operator's cache also contains it: the same
upstream wrote both, and no fixture in the repository contains it.

**Status: fixed and gated (2026-10-07).** `d396d091` gives every publishing path a build
token, so a superseded build writes neither the cache, nor the listeners, nor the disk,
and clears the in-flight slot on settle (which also repaired `CATALOG_TTL_MS`, dead code
until now). `8c92d087` moves the config-dir override into the workspace preload, where
every file inherits it instead of the files that remembered. Three pins, all RED-first:
the two cache-ownership pins and the config-dir pin each fail on the pre-fix tree and
pass on it. The root `bun run test` chain's cli leg is green again.

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

**(2) A test's verdict depends on the network, and on which file ran first.** The value
the assertion received is a LIVE OpenRouter row: the suite performs real upstream fetches
from the gateway boot warm, so it is not hermetic with respect to the machine's
connectivity or to the account's keys (the keyed `openai` leg is live on this machine,
where `OPENAI_API_KEY` is set). Which catalog the assertion sees is decided by whichever
build published last, and the failure message prints provider data the test never
declared.

### Expected Behavior

- The CLI test process never reads or writes the user's config directory: a test that
  needs a config dir gets one that the suite owns, whether or not it asked.
- A build whose caller has moved on cannot publish at all — not to the cache, not to the
  listeners, not to disk — so no file can carry its catalog into another file's assertion.
- No file's verdict depends on a live fetch it did not make.
- `bun run test` reaches every workspace in the chain.

### Root Cause

**Two causes, and the second one is the one that produced the red.**

**(a) The in-flight slot was never released.** `gatewayInflight = (async () => { … })()`
was assigned and never cleared (HEAD, `gateway.ts:175`). The reset nulled it, so a later
call could rebuild — but nothing cleared it on settle, which meant the promise of the
FIRST build in the process survived every path that did not reset. Consequence: after the
first catalog was built, the post-TTL path returned the completed promise instead of
rebuilding, so `CATALOG_TTL_MS` was dead code in production. This defect is a product
bug, not a test bug, and it was found while tracing the red rather than reported.

**(b) Nothing told an in-flight build it had been superseded.** Publication was
unconditional: the async body wrote `gatewayCache`, notified listeners and wrote the disk
cache the moment it settled, with no check that its caller was still the current one. The
reset nulls state; it cannot recall a promise. So a build started before a reset published
after it, and the last build to settle won regardless of who asked for it last.

**The file that does it, named.** `cli/src/server/gateway.ts:114` —
`void fetchGatewayModels().catch(() => {})`, the fire-and-forget boot warm, added by the
P19 sidecar window fix. It is un-awaited BY DESIGN ("never derails startup on failure"),
which is fine in production and fatal in a suite: the build outlives the test that
started it, and the next test's `beforeEach` reset runs before it settles. The server test
harness (`cli/src/server/__tests__/gateway-test-harness.ts:210`, `startTestGateway`)
calls `startGateway()` in every server suite, and those suites do not mock the catalog
fetch, so each call is a real request to openrouter.ai whose result is published into the
process-wide cache. Instrumenting the new guard for one `bun test src/` run counted
**82 claims and 37 suppressed publishes**, 36 of them claimed from `startGateway`.

- The catalog cache path resolves through the user config dir:
  `gateway-disk-cache.ts:23-25` → `path.join(getConfigDir(), 'gateway-catalog.json')`,
  and the isolation of that path is opt-in: only files that call
  `registerGatewayCatalogLifecycle()` (`openrouter-models-test-harness.ts:32-38`) set
  `SAVANT_CODE_CONFIG_DIR`, and only while that var is set.
- The in-memory catalog is module scope in `gateway.ts` (`let gatewayCache:
  OpenRouterModel[] | null`), read by `findGatewayModel` via
  `getCachedGatewayModels()` (`gateway-lookup.ts:22`).
- `__resetOpenRouterModelsCacheForTest` nulls `gatewayCache`/`gatewayInflight`, but it is
  called from `beforeEach` — it is a state reset, and the defect is a missing authority
  rule. Only the built build may publish.

**Correction against this record's own draft.** The first draft said the suite read the
operator's real cache because the received string is in it. The string is in it because
the same live upstream wrote both; the suite's own config dir holds no catalog. The draft
was one observation short of the mechanism, and step 1 is what closed the gap.

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

**(3) Step 1 — the leaking file, measured by instrumenting the new guard** (one
`bun test src/` run, `FID006_DIAG=1`, diagnostics removed afterwards):

```text
[fid006 claim] 1488 Error
    at fetchGatewayModels (…\cli\src\utils\openrouter-models\gateway.ts:134:53)
    at startGateway (…\cli\src\server\gateway.ts:114:8)
    at startTestGateway (…\cli\src\server\__tests__\gateway-test-harness.ts:210:10)
    at <anonymous> (…\cli\src\server\__tests__\gateway-approvals.test.ts:24:27)
[fid006 SUPERSEDED] 1488 Error
    at <anonymous> (…\cli\src\utils\openrouter-models\gateway.ts:190:62)
    at async fetchGatewayModels (…\cli\src\utils\openrouter-models\gateway.ts:210:18)
    at processTicksAndRejections (native:7:39)

claims: 82   superseded publishes: 37
claims by caller: server/gateway.ts 36, gateway tests 46
suite: 3968 pass / 18 skip / 0 fail
```

**(4) The config dirs, measured** (the draft's premise, checked):

```text
.savant-code:      cache=1014379 bytes
.savant-code-dev:  no gateway-catalog.json     ← the suite's default config dir
.savant-code-test: cache=649156 bytes
```

**(5) RED-first, both legs.** Reverting only `gateway.ts` to HEAD makes the two new pins
fail (0 pass / 2 fail) and the full suite red at exactly the recorded assertion:

```text
$ git stash push -- cli/src/utils/openrouter-models/gateway.ts && cd cli && bun test src/
(fail) openrouter-models gateway cache ownership > a superseded build publishes nothing…
(fail) openrouter-models gateway cache ownership > the in-flight slot clears on settle…
(fail) openrouter-models > findGatewayModel resolves exact, prefix, and family matches
Expected: "GPT-5"
Received: "OpenAI: GPT-5"
      at <anonymous> (…\cli\src\utils\__tests__\openrouter-models-lookup.test.ts:34:52)
 3964 pass / 18 skip / 4 fail   ← exit 1
```

Reverting only `test-setup.ts` makes the config-dir pin fail (`Expected: false` /
`Received: true`), and restoring it makes it pass.

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

1. **DONE (2026-10-07, commit `d396d091`).** The leaking file is named and the mechanism
   is proved rather than bisected: instrumenting the new publish guard for one
   `bun test src/` run produced **82 claims and 37 suppressed publishes**, 36 of the
   claims from `startGateway` (`server/gateway.ts:114`). The stack of a suppressed
   publish resumes at `processTicksAndRejections`, which is the signature of a build that
   outlived its caller. **The step's premise was corrected by its own result:** the suite
   does not read the operator's cache (`~/.savant-code-dev` holds no catalog); it fetches
   live, and the draft's "real cache" observation was a coincidence of the same upstream.
2. **DONE (2026-10-07, commit `8c92d087`).** The config-dir override moved from the
   opt-in harness into the `cli` workspace preload (`cli/src/test-setup.ts`), which
   `bunfig.toml` loads for every file. `registerGatewayCatalogLifecycle()` is kept for the
   per-case temp dir it already provides and now restores the preload's directory.
3. **DONE (2026-10-07, commit `d396d091`) — and the fix is an authority rule, not a
   bigger reset.** A reset cannot recall a promise, so widening it would not have closed
   this. Every path that PUBLISHES (the warm-start snapshot and the full rebuild) claims
   `gatewayBuildToken` first, and a build whose token is no longer current returns its own
   catalog to its own caller while writing neither `gatewayCache`, nor the listeners, nor
   the disk. The same commit clears `gatewayInflight` on settle.
4. **DONE (2026-10-07) — three pins, each red on the pre-fix tree.**
   `openrouter-models-gateway-cache.test.ts` holds the two ownership pins ("a superseded
   build publishes nothing into the shared cache"; "the in-flight slot clears on settle,
   so a later call rebuilds") and `config-dir-isolation.test.ts` asserts the config-dir
   property from a file that sets nothing at all. Reverting `gateway.ts` alone: 0 pass /
   2 fail plus the recorded red. Reverting `test-setup.ts` alone: 0 pass / 1 fail.
5. **DONE (2026-10-07) — swept by construction rather than by enumeration.** Every
   `cli` path that touches user-directory state resolves through `getConfigDir()`
   (`auth.ts` credentials, `message-history.ts`, `settings/io.ts`, `project-files.ts`,
   `recent-projects.ts`, `provider-offers.ts`, `provider-notice-storage.ts`,
   `research-key-store.ts`, `free-options-paths.ts`, `anonymous-id.ts`,
   `savant-free-instance-owner.ts`, `server/triggers/server-wiring.ts`,
   `provider-key-persistence.ts`, `gateway-disk-cache.ts`), so the preload override
   covers all of them at once — which is the property the pin asserts. A hand-enumerated
   sweep would have gone stale the first time a new file reached the config dir.

### Verification

- The ownership contract is pinned in
  `cli/src/utils/__tests__/openrouter-models-gateway-cache.test.ts` — two pins that fail
  on the pre-fix tree and pass now (they were split out of
  `openrouter-models-gateway.test.ts` for the 300-line ceiling, taking the
  combined-catalog membership pins to `openrouter-models-gateway-providers.test.ts` with
  them).
- The isolation property is pinned in
  `cli/src/utils/__tests__/config-dir-isolation.test.ts`, asserted from a file that sets
  no override, so it is evidence about the preload rather than about the file.
- `cli/src/utils/__tests__/openrouter-models-lookup.test.ts` is the recorded red's own
  suite: it is the declared gate because it is the assertion that was wrong, and it stays
  in the gate block precisely so that a regression here is caught by the file that failed.
- `bun run test` from the repo root must reach the end of the chain with 0 fail — the
  gate this record exists to restore.
- `typecheck cli` and `quality` gate the change.
- The workspace chain itself cannot be a declared gate: the vocabulary admits a single
  `test <path>`, and `validate:repository` can never be one (C3 recursion), so
  `bun run test` is proven by hand and quoted in the Resolution.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/utils/__tests__/openrouter-models-gateway-cache.test.ts
- gate: test cli/src/utils/__tests__/config-dir-isolation.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-lookup.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:5724e698149b29b83e4714c3e0e0731c017fde7bafc5ec2be8d7c492e195c6a1
- verified: 2026-10-07T20:35:13.625Z
- typecheck cli: exit 0
- test cli/src/utils/__tests__/openrouter-models-gateway-cache.test.ts: exit 0
- test cli/src/utils/__tests__/config-dir-isolation.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-lookup.test.ts: exit 0
- quality: exit 0

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

> COMPLETE. All five steps are implemented and gated; the two SHAs below are the
> authority rule and the isolation seam.

- [x] **Commit SHA:** `d396d091` (the publish authority + the in-flight release + the
      300-line splits the quality gate required), `8c92d087` (the preload-owned config
      dir). The pre-fix tree is the parent of `d396d091`.
- [x] **File:line ranges:** `cli/src/utils/openrouter-models/gateway.ts`
      (`gatewayBuildToken`, the two guarded warm-start publishes, `fetchGatewayLiveCatalogs`
      + `assembleGatewayCatalog` call sites, the guarded publish, the `finally` that
      clears `gatewayInflight`, the reset that bumps the token),
      `cli/src/utils/openrouter-models/gateway-live-results.ts` (the fan-out and its
      positional contract), `cli/src/utils/openrouter-models/gateway-catalog-merge.ts`
      (the merge order), `cli/src/test-setup.ts` (the config-dir override),
      `cli/src/utils/__tests__/openrouter-models-gateway-cache.test.ts` (the two pins),
      `cli/src/utils/__tests__/config-dir-isolation.test.ts` (the isolation pin)
- [x] **Gate output:** all five declared gates exit 0 at the stamped receipt.
      Also green: `bun scripts/module-state-check.ts` PASS (the new module-scope
      `gatewayBuildToken` is enumerated and wired through the reset the preload calls)
- [x] **Reproducibility:** `git stash push -- cli/src/utils/openrouter-models/gateway.ts`
      restores the red (`3964 pass / 18 skip / 4 fail`, exit 1, including the recorded
      `openrouter-models-lookup.test.ts:34` assertion) and `git stash pop` restores green;
      `git stash push -- cli/src/test-setup.ts` restores the config-dir pin's failure
      (`Expected: false` / `Received: true`)
- [x] **Step statuses:** steps 1-5 `implemented`/verified (`d396d091`, `8c92d087`)

### Code Verification Evidence

- [x] Files referenced exist, verified by read: `gateway.ts`,
      `gateway-disk-cache.ts`, `gateway-lookup.ts`,
      `cli/src/utils/__tests__/openrouter-models-test-harness.ts`,
      `cli/src/utils/__tests__/openrouter-models-lookup.test.ts`
- [x] The failure output is pasted from the actual command, with its exit status
- [x] The received value is traced — and the trace CORRECTED the record: the string is in
      `~/.savant-code/gateway-catalog.json` (quoted) because the same LIVE upstream wrote
      both, not because the suite read that file. The suite's default config dir
      (`~/.savant-code-dev`) holds no catalog, measured.
- [x] The leaking file is named from an instrumented run rather than inferred:
      `cli/src/server/gateway.ts:114` ← `startGateway` ←
      `cli/src/server/__tests__/gateway-test-harness.ts:210` ← every server suite
- [x] Production call-graph evidence: the fire-and-forget warm is reached from
      `startGateway` only (`grep -rn fetchGatewayModels cli/src` → `index.tsx:188`,
      `model-provider-commands.ts:66`, `server/gateway.ts:114`), which is why no gateway
      test file had to change for the red to disappear
- [x] FID status reflects reality (`fixed`: both causes are cured and gated, and the
      record states the draft correction rather than quietly editing it away)

## Resolution

- **Closed Date:** 2026-10-07 16:33
- **Fix Description:** Both causes are cured at the level they were found. **Publication
  is now an authority, not a race:** every path that publishes the combined catalog
  claims `gatewayBuildToken` first, and a build whose token is no longer current returns
  its own catalog to its own caller while writing neither `gatewayCache`, nor the
  listeners, nor the disk (`d396d091`). **The in-flight slot is released on settle**, in a
  `finally`, so `CATALOG_TTL_MS` finally applies — that was a live product bug found
  while tracing this red, not a test artifact. **The config directory is owned by the
  workspace preload** (`8c92d087`), so no `cli` test can resolve the operator's
  `~/.savant-code-dev` for settings, credentials, history, project data or the gateway
  disk cache, whether or not it remembered to ask. The root `bun run test` chain's cli leg
  is green, which is the gate this record exists to restore.
- **Tests Added:** Yes — four pins, each red on the pre-fix tree.
  `cli/src/utils/__tests__/openrouter-models-gateway-cache.test.ts` (2): a superseded
  build leaves the shared cache empty while its own caller still gets its catalog, and a
  second `fetchGatewayModels(true)` re-fetches instead of returning the settled promise.
  `cli/src/utils/__tests__/config-dir-isolation.test.ts` (1): a file that sets nothing
  gets a suite-owned temp config dir, not a path under the home directory.
  `cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts` gained the two
  combined-catalog membership pins moved out of the file that was over the ceiling (they
  are moves, not new coverage, and are counted as such).
- **Verification Evidence:** RED is recorded from the unmodified tree before any
  production edit — the full cli suite `3964 pass / 18 skip / 4 fail`, exit 1, including
  `openrouter-models-lookup.test.ts:34` receiving `"OpenAI: GPT-5"` for a mocked
  `"GPT-5"` — and is reproducible by reverting `gateway.ts` alone. GREEN: the same suite
  is `3969 pass / 18 skip / 0 fail` across 482 files, exit 0. The instrumented run that
  named the leaking file counted 82 claims against 37 suppressed publishes. All five
  declared gates exit 0 at the stamped receipt.
- **Archived:** 2026-10-07 16:33 (moved to `dev/fids/archive/`)

## Lessons Learned

1. **Isolation that is opt-in is not isolation, and the same is true of authority.** A
   per-file override protects the files that remember; a reset protects the state it can
   reach. Neither could recall a promise, which is why the fix had to be a rule about WHO
   may publish rather than a wider reset of WHAT was published.
2. **A test that passes in isolation and fails in the suite is telling you where the state
   lives, not that the test is flaky.** The `&&`-chained root gate turned that signal into
   a one-line red and eleven silent workspaces, so the cheapest defect in the repository
   was hiding the most expensive blind spot.
3. **"This value exists in the user's directory" is a correlation, not a provenance.** The
   first draft of this record named the operator's cache as the source because the string
   was in it. The string was there for the same reason it appeared in the suite — one live
   upstream wrote both — and the correlation cost a step's worth of wrong root cause. The
   measurement that settled it was checking the directory the suite actually resolves.
4. **The most-watched file is not always the culprit.** Every gateway suite mocks its
   fetches and resets diligently; the publish came from a *server* test that only wanted a
   sidecar to boot. Fire-and-forget is correct for startup latency and wrong for shared
   state, and the author of neither file could see the other.
5. **Tracing a test failure found a production bug.** `gatewayInflight` was never
   released, so the catalog TTL had been dead code since the warm-start cache landed.
   A red gate is a cheap place to find that.

### Loop 2 — fixed (2026-10-07)

- **RED:** three pins were written against the contract before any production edit, and
  the unmodified tree failed them — `0 pass / 2 fail` in the cache-ownership suite and
  `0 pass / 1 fail` for the config-dir pin. Reverting `gateway.ts` alone also restores the
  ORIGINAL red in full: `3964 pass / 18 skip / 4 fail`, exit 1, with
  `openrouter-models-lookup.test.ts:34` receiving `"OpenAI: GPT-5"`. The red is therefore
  the defect, not a rewritten expectation.
- **GREEN:** `d396d091` makes publication an authority (build token) and releases the
  in-flight slot on settle; `8c92d087` moves the config-dir override into the workspace
  preload. Every publishing path — warm-start snapshot and full rebuild — is guarded, and
  a superseded build still returns its own catalog to its own caller, so no caller
  observes a behaviour change beyond not clobbering the shared cache.
- **AUDIT (mechanical, and it named the file):** instrumenting the new guard and running
  the suite once produced 82 claims against 37 suppressed publishes, with the claim stack
  pointing at `startGateway` ← `gateway-test-harness.ts:210` ← every server suite. The
  suppressed publish's stack resumes at `processTicksAndRejections`, which is the
  signature of a build outliving its caller. The audit also separated "the new thing
  works" from "nothing else moved": the cli suite is `3969 pass / 18 skip / 0 fail`
  across 482 files, `typecheck cli` exit 0, `quality:report` PASS, eslint
  `--max-warnings 0` exit 0 (one `import/order` warning fixed at the cause, not
  suppressed), prettier clean, and `module-state-check` PASS with the new module-scope
  `gatewayBuildToken` wired through the reset the preload calls. The quality gate did its
  job twice: `gateway-catalog-merge.ts` and the test-file split exist because three files
  were over the 300-line ceiling, and each was split at a real seam with the origin
  re-exporting what moved, so no caller changed.
- **ADVERSARIAL (the objection that changed the fix):** the tempting reading of this
  record was "the suite reads the user's data, so sandbox the config dir". Done alone,
  that would have left the red in place, because the leak is not the disk path at all —
  the config dir the suite resolves holds no catalog. Two further objections are answered
  rather than deflected: (a) "just await the boot warm" would serialise sidecar startup
  behind a network RTT in production, which is exactly what the fire-and-forget comment
  says must not happen — the fix belongs at the publisher, not the caller; and (b) "just
  reset harder in the preload" cannot work, because a reset can only null state and the
  defect is a promise that settles later. The chosen shape (authority + isolation) is the
  one where neither half depends on the other being perfect.
- **CHANGE DELTA:** the status line, the Summary's correction paragraph, Problem (2),
  Expected Behavior, Root Cause (rewritten against the named file), the step-1..5 statuses,
  the Verification scope, the gate block, the Implementation Evidence, the Code
  Verification Evidence, the Resolution and this loop.
