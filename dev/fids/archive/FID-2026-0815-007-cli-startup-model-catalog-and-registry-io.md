<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: CLI startup — model catalog cache + registry I/O

**Filename:** `FID-2026-0815-007-cli-startup-model-catalog-and-registry-io.md`
**ID:** FID-2026-0815-007
**Severity:** medium
**Status:** closed
**Created:** 2026-08-15
**YAGNI-Compliance:** Verified — adds a disk cache for the gateway catalog and
converts sync registry scans to async; no new authority, no new public API
(Law 13).

**Parent:** FID-2026-0815-002 (findings F-09, F-10)

---

## Summary

Two startup-path costs:

1. The gateway model catalog is fetched over the network on every cold boot and
   kept only in memory (F-09). Warm starts re-pay the RTT + parse before the
   `/model` picker and model-info blocks have metadata.
2. Skill and agent registry discovery uses synchronous directory scans and file
   reads (`readdirSync`/`statSync`/`readFileSync`) on the boot path (F-10),
   stalling the event loop while `.agents/` and `.claude/` trees are walked.

## RED — Issue catalog

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| E-01 | med | `fetchGatewayModels` fetches the live OpenRouter + NVIDIA NIM + Nous catalogs at boot and caches only in-process (`gatewayCache`), so every cold start re-pays network RTT + JSON parse before the model picker is populated. | `cli/src/utils/openrouter-models/gateway.ts:66-118` (`fetchGatewayModels` → `Promise.allSettled([fetchOpenRouterModels, fetchNvidiaModels, fetchNousModels])`, in-memory `gatewayCache` only); boot call `cli/src/index.tsx` (`fetchGatewayModels().catch(() => {})`) |
| E-02 | low | Skill discovery walks each skills dir with `readdirSync` + per-entry `statSync` + `readFileSync` on the boot path. | `sdk/src/skills/load-skills.ts` — `discoverSkillsFromDirectory`: `fs.readdirSync(skillsDir)`, `fs.statSync(skillDir)`, `fs.statSync(skillFilePath)`, `fs.readFileSync(skillFilePath)`; awaited from `cli/src/utils/skill-registry.ts` (`initializeSkillRegistry`) |
| E-03 | low | Agent discovery recursively walks `.agents` with `readdirSync(..., { withFileTypes: true })` on the boot path. | `sdk/src/agents/load-agents.ts` — `getAllAgentFiles`: `fs.readdirSync(dir, { withFileTypes: true })` recursive walk; awaited from `cli/src/index.tsx` (`initializeAgentRegistry`) |

## GREEN — Proposed fix (converged)

1. **E-01:** persist the combined gateway catalog to a disk cache (JSON under
   the existing chat/config dir) with the same `CATALOG_TTL_MS` used in memory.
   On boot: load the cached catalog synchronously if fresh (instant picker), then
   refresh in the background; if stale/absent, fetch and write-through the cache.
   The in-memory `gatewayCache` remains the single source of truth; the disk
   cache is a cold-start warm layer. Cache write failures are swallowed (model
   metadata is best-effort).
2. **E-02:** convert `discoverSkillsFromDirectory` to
   `fs.promises.readdir`/`stat`/`readFile` (the public `loadSkills` already
   returns a Promise; `loadSkillsSync` retains its name but delegates to the
   async read and, if truly needed, is kept only for its few sync callers —
   confirmed via Law-4 grep before deciding whether to drop it).
3. **E-03:** convert `getAllAgentFiles` to async `fs.promises.readdir` recursive
   walk; `loadLocalAgents` is already `async`, so the read becomes
   non-blocking. Dynamic `import()` per agent module is already async and
   serialized — optional bounded-parallel import is a stretch goal, noted not
   silently dropped.

**Net:** warm starts skip the network RTT for model metadata; registry walks
stop blocking the event loop. No observable behavior change (same catalogs,
same skill/agent sets).

## Perfection Loop

### Loop 1 — RED

E-01…E-03 cataloged with `file:line` evidence. **Exit: all issues cataloged.**

### Loop 1 — GREEN

Three-part fix documented, with a disk-cache TTL matching the in-memory TTL and
best-effort write failure semantics. **Exit: fixes documented.**

### Loop 1 — AUDIT (planning)

- **Law 4:** `getCachedGatewayModels` / `subscribeGatewayCatalog` consumers are
  the model picker + agent model-info block — they keep reading the in-memory
  cache, so adding a disk warm layer changes nothing for them (grep to confirm
  no consumer reads `gatewayCache` directly). `loadSkillsSync` callers are
  grepped before dropping/renaming; `loadSkills` (async) remains the public
  entry the CLI uses.
- **TTL consistency:** the disk cache reuses `CATALOG_TTL_MS` (single source of
  truth, Law 13); a stale disk cache is indistinguishable from a cold start and
  triggers the same background refresh.
- **Verification plan:** `bun run --cwd=cli typecheck`, `bun run --cwd=sdk
  typecheck`; skill/agent loader test suites (`sdk/src/skills`,
  `sdk/src/agents`, `cli` registry tests); gateway catalog test suite
  (`openrouter-models`); ESLint `--max-warnings 0`; Prettier.
- **AUDIT passes (planning) → SELF-CORRECT (none) → COMPLETE (pending operator
  approval to implement).**

### Missed Questions

1. **Does the disk cache risk serving stale paid/free classification?** The TTL
   matches the in-memory TTL today; staleness is bounded identically to the
   current live fetch. No regression.
2. **Is `loadSkillsSync` still needed?** Law-4 grep verified: `loadSkillsSync`
   has no production sync caller — it is re-exported from `sdk/src/index.ts:88`
   (public API) and called only by the async `loadSkills` (`load-skills.ts:252`);
   production calls the async `loadSkills` (`sdk/src/run-state/initial-state.ts:138`).
   It becomes an async-internals wrapper or is removed; the public re-export
   decision is presented, not silently dropped.
3. **Are parallel agent imports safe?** Bun module import is async and may be
   parallelized, but serialization is the conservative default; parallel import
   is a stretch goal, flagged not dropped.

## Resolution

Implemented 2026-08-15 (operator approved).

- **E-01:** gateway disk cache (`gateway-catalog.json` under `getConfigDir()`)
  with the same `CATALOG_TTL_MS`; `fetchGatewayModels` loads a fresh disk
  catalog synchronously when the in-memory cache is cold (instant picker, no
  network RTT) and write-throughs after a fetch. `__resetOpenRouterModelsCacheForTest`
  clears the disk cache; the openrouter-models tests isolate it to a temp
  `SAVANT_CODE_CONFIG_DIR`.
- **E-02:** `discoverSkillsFromDirectory` + `loadSkillFromFile` converted to
  `fs.promises`; `loadSkills` awaits them. **API surface change (presented):**
  `loadSkillsSync` was removed — Law-4 grep confirmed zero callers (only the
  async `loadSkills` wrapper called it, plus the `sdk/src/index.ts:88`
  re-export). Re-export and `docs/sdk-overview.md` updated. Restore on request.
- **E-03:** `getAllAgentFiles` converted to async `fs.promises.readdir` recursive
  walk; `loadLocalAgents` collects via `Promise.all(...).flat()`.

Verification: sdk + cli typecheck exit 0; SDK suite 475 pass / 1 skip / 0 fail
(incl. `load-skills.test.ts` 7/0); cli `openrouter-models.test.ts` 22/0 and
`registry-gating.test.ts` 5/0; ESLint `--max-warnings 0` on all changed files.
