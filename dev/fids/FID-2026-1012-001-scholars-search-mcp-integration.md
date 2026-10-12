# FID: Scholars-search MCP integration into the Researcher persona

**Filename:** `FID-2026-1012-001-scholars-search-mcp-integration.md`
**ID:** FID-2026-1012-001
**Severity:** medium
**Status:** verified
**Created:** 2026-10-12 01:10
**Automation level:** 2
**YAGNI-Compliance:** Existing `mcpServers` contract reused (github-helper precedent); no new
dependency, no new agent role, no type widening

---

## Summary

`researcher-web` — the Researcher role's web tool library — can search the live web
(Serper `web_search`), fetch and read source pages (`read_url`), and run multi-source
deep research (`deep_research`), but has no scholarly-literature capability: no semantic
search over paper abstracts, no DOI/OpenAlex-id/PMCID record lookup, no similar-paper or
citation traversal. The public Scholars Reading List search service exposes exactly that
surface as a standard MCP server: four read-only tools, no key, no sign-up, 30 tool calls
per minute per address, verified live on 2026-10-12. This FID wires that server into
`researcher-web` through the existing `mcpServers` agent-definition contract (the same
remote-HTTP pattern the `github` helper uses), adds the usage discipline to the persona
prompt, pins the contract with a definition-shape test following
`agents/github/github.test.ts`, and regenerates the bundled agent artifact. The operator
selected MCP wiring as the integration path on 2026-10-12; implementation of the code
itself is blocked on approval of this record. The Perfection Loop below certifies the
document, not the code.

## Environment

- **OS:** Windows, Git Bash terminal.
- **Language/Runtime:** TypeScript, Bun 1.3.14 (pinned).
- **Branch/State:** `main`; the worktree carries pre-existing uncommitted changes,
  preserved and untouched by this FID.
- **Target service:** `https://api.sciencemadereadable.com/mcp` (public, no key; verified
  live 2026-10-12: HTTP 200, tools `search_papers`, `get_papers`, `find_similar_papers`,
  `citation_walk`; prompts `literature_review`, `check_claim`).
- **Governance:** `ECHO.md` v0.2.0 read 0-EOF this session; `protocol.config.yaml`
  strict_mode true; `docs/agents-and-tools.md`, `agents/github/github.ts` + test read as
  pattern sources.

## Detailed Description

### Problem

Research questions — what studies exist on a topic, whether the evidence supports a
claim, a literature review, a paper's record, or what cites what — fall outside every
tool `researcher-web` has. `web_search` returns SEO-ranked web pages, not peer-reviewed
evidence; there is no DOI resolution, no citation traversal, and no abstract-level
semantic search anywhere in the toolchain. The operator asked whether the downloaded
`resources/srl-search-master` repo would be a good addition to the research persona; the
assessment is yes — but as a consumed service, not vendored code (the service needs
~28 GB RAM and ~400 GB of data on its operator's machine; it exists to be called, not
embedded).

### Expected Behavior

When spawned with a research question, `researcher-web` can: search ~125M embedded papers
by meaning or all 203M by exact words; fetch a paper's full record by DOI/OpenAlex
id/PMCID; find similar papers; and walk citations — while keeping its existing web tools
for everything the literature index does not cover (news, pricing, releases, non-paper
sources).

### Root Cause

Capability gap, not a defect: the Researcher persona predates any domain-specific search
integration, and no MCP server had ever been wired into a conversational roster agent
(the only MCP wiring precedent is the `github` infrastructure helper).

### Evidence

RED catalog — every citation below was read or grepped this session:

1. **Target definition.** `agents/researcher/researcher-web.ts` — `SecretAgentDefinition`,
   id `researcher-web`, model `google/gemini-3.1-flash-lite`,
   `toolNames: ['web_search', 'read_url', 'deep_research']`, `includeMessageHistory: false`,
   no `mcpServers` field.
2. **Wiring contract.** `common/src/templates/initial-agents-dir/types/agent-definition.ts`
   → symbol `AgentDefinition.mcpServers` ("MCP servers by name. Names cannot contain
   `/`"); `common/src/types/mcp.ts` → `mcpConfigRemoteSchema` accepts
   `{ type: 'http', url, params?, headers?, timeout? }`.
3. **Precedent.** `agents/github/github.ts` →
   `mcpServers.github = { type: 'http', url: 'https://api.githubcopilot.com/mcp/',
   headers: { Authorization: 'Bearer $SAVANT_CODE_GITHUB_TOKEN' } }`; pinned by
   `agents/github/github.test.ts` (definition-shape test: type, url, header, prompt tool
   coverage).
4. **Tool exposure.** `packages/agent-runtime/src/mcp.ts` → symbol `getMCPToolData`: tool
   names containing `/` select specific MCP tools; a server with no `/`-form entries in
   `toolNames` exposes ALL its tools (`requestedToolsByMcp[mcpName] ?? null`). Tool
   identity internally is `<server>__<tool>`
   (`packages/agent-runtime/src/mcp-constants.ts` → `MCP_TOOL_SEPARATOR = '__'`).
5. **Type constraint.** `agents/types/secret-agent-definition.ts` →
   `toolNames?: AllToolNames[]` — a closed union (`ToolName | add_subgoal | browser_logs |
   create_plan | sequentialthinking | spawn_agent_inline | update_subgoal |
   ComposioMetaToolName`). Enumerating `'scholars-search/search_papers'` would fail
   typecheck; widening the shared union for one server is out of scope and the cast
   workaround is forbidden (Law 6). Default exposure is therefore the only type-clean
   path — and the documented contract for servers without enumerated tools.
6. **Runtime path.** `packages/agent-runtime/src/run-agent-step/tool-definitions.ts` →
   symbol `additionalToolDefinitions` passes `agentTemplate.toolNames` +
   `agentTemplate.mcpServers` into `getMCPToolData`;
   `sdk/src/run/agent-runtime-impl.ts` → symbol `requestMcpToolData` resolves through
   `getMCPClient` (`common/src/mcp/client.ts` → `StreamableHTTPClientTransport` for http;
   30 s connect / 60 s tool-call timeouts).
7. **Failure posture.** `getMCPToolData` catches per-server failures: `logger.warn` +
   that server's tools unavailable for the step — the agent keeps every other tool.
   Fail-soft by design.
8. **Serialization.** `cli/scripts/prebuild-agents.ts` serializes every `agents/**/*.ts`
   definition into `cli/src/agents/bundled-agents.generated-data/NN-<id>.ts` +
   `bundled-agents.generated.ts`; researcher-web is chunk `19-researcher-web.ts`.
   Generated files must never be hand-edited (`knowledge.md`); regenerate via
   `bun run --cwd=cli prebuild:agents`.
9. **Gate policy.** `scripts/validation-gates.ts` → `VALIDATION_WORKSPACE_POLICY` includes
   `agents` and `cli`; `scripts/fid-verify.ts` → gate shapes `typecheck <workspace>`,
   `test <*.test.ts path>`, `probe`, `quality`.
10. **Live service checks (2026-10-12).** `GET https://api.sciencemadereadable.com/mcp` →
    200: "Tools: search_papers, get_papers, find_similar_papers, citation_walk. Prompts:
    literature_review, check_claim. 30 tool calls a minute per address."
    `GET /api/data/llms.txt` → 200: semantic coverage 124,950,164 papers (all years —
    the repo README's "2024+" note is stale), keyword 203,543,614, `smr` collection
    3,901,819, data release 20261011T145433Z.
    `GET /api/data/search/does%20intermittent%20fasting%20help%20weight%20loss?k=5` → 200
    with real ranked results.
11. **Thinker unavailability.** Three `thinker` spawns failed with a harness defect
    ("Native tool-call recovery failed repeatedly" on `read_files`/`run_readonly_command`
    — tools the Thinker does not have). The GREEN synthesis below was performed by the
    Orchestrator with documented reasoning; no Thinker certification is claimed.

## Impact Assessment

### Affected Components

- `agents/researcher/researcher-web.ts` (definition + persona prompt)
- `cli/src/agents/bundled-agents.generated-data/19-researcher-web.ts`,
  `cli/src/agents/bundled-agents.generated.ts` (regenerated artifacts)
- `agents/researcher/researcher-web.test.ts` (new pin)
- `docs/agents-and-tools.md` (Researcher row), `CHANGELOG.md`, `SCOPE.md` (register)

### Risk Level

- [ ] Critical
- [x] Medium: new external dependency on a production persona; read-only, no credentials,
  fail-soft
- [ ] Low
- Risk notes: the service is a single operator's hosted machine — uptime and the
  30 req/min public limit are real constraints; both are handled by prompt discipline
  (retry once, then fall back to `web_search`) and by the fail-soft MCP load path. No
  headless or paid-path automation depends on it in this FID.

## Proposed Solution

### Approach

Reuse the existing `mcpServers` contract exactly as the `github` helper does — remote
HTTP, no key, no new dependency, no new agent role, no type widening. Expose all four
server tools by default (the documented behavior for servers without `/`-form
`toolNames` entries, and the only type-clean option). Add a "Scholarly Literature"
discipline section to the system prompt. Pin the shape with a test. Regenerate the
bundle. Document.

### Steps

1. **`agents/researcher/researcher-web.ts`** — add between `spawnableAgents` and
   `systemPrompt`:

```ts
  // FID-2026-1012-001: public Scholars Reading List search (read-only, no
  // key). Same remote-HTTP MCP pattern as the github helper; the server's
  // four tools are exposed by default (see AgentDefinition.mcpServers docs).
  mcpServers: {
    'scholars-search': {
      type: 'http',
      url: 'https://api.sciencemadereadable.com/mcp',
    },
  },
```

2. **`agents/researcher/researcher-web.ts`** — append to `systemPrompt`:

```text
## Scholarly Literature (MCP: scholars-search)

For research questions — what studies exist on a topic, evidence for or against a claim,
a literature review, looking up a paper by DOI / OpenAlex id / PMCID,or finding papers similar to a known one — use the scholars-search MCP tools (`scholars-search__search_papers`, `scholars-search__get_papers`, `scholars-search__find_similar_papers`, `scholars-search__citation_walk`) instead of web_search. Everything else — news, pricing, releases, how-to, product or software questions — stays on web_search; this index is papers only.

- `search_papers`: ~125M papers by meaning (default), or all 203M by exact words
  ("quoted phrases", AND/OR/NOT). Rewrite casual questions into research language first
  ("how to lose weight" → "effectiveness of dietary interventions for weight loss in
  adults") — the single biggest quality gain. Screen with abstracts=false, then read
  abstracts of the papers you keep.
- `get_papers`: full records by DOI, OpenAlex id, or PMCID. Use it to verify a citation
  before writing it.
- `find_similar_papers`: from one strong seed paper, its semantic neighborhood (k=10-20 is plenty). Use it to widen a search once you have a paper worth expanding.
- `citation_walk`: from a seed paper, the papers that cite most of the same references — its literature neighborhood rather than its descendants (k=20-30, then filter by year and topic before reading). Use it to find the prior work a seed sits among.

Rules: cite a DOI only from a record you fetched in this conversation, never from memory.
These are titles and abstracts, not full texts — say so when that limits an answer. The
public endpoint allows 30 tool calls per minute per address: batch, and never retry in a
loop.If a call fails with a rate-limit error (the tool result says how long to wait), stop calling this service for the rest of the turn and finish the answer with web_search. A 502 or 503 means the nightly data update is running — retry once, then fall back to web_search and say the literature service was unavailable. By-meaning search covers
the embedded subset; exact-word search and paper lookup cover everything — the
endpoint's /llms.txt states current coverage.
```

`instructionsPrompt` stays unchanged (minimal diff; the system-prompt section carries the
discipline).

3. **`agents/researcher/researcher-web.test.ts`** (new) — definition-shape pin following
   `agents/github/github.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'

import definition from './researcher-web'

/**
 * FID-2026-1012-001: the researcher persona must carry the converged
 * remote-HTTP MCP contract for the public Scholars Reading List search
 * service — no key, read-only tools, and the usage discipline named in
 * the system prompt. The MCP server itself is exercised over the wire in
 * live integration; here we lock the definition shape (the part Savant
 * owns), the same contract agents/github/github.test.ts pins.
 */
describe('researcher-web agent definition', () => {
  test('keeps its native research tools and adds no write surface', () => {
    expect(definition.id).toBe('researcher-web')
    expect(definition.includeMessageHistory).toBe(false)
    expect(definition.spawnableAgents ?? []).toEqual([])
    expect(definition.toolNames).toEqual(
      expect.arrayContaining(['web_search', 'read_url', 'deep_research']),
    )
    for (const tool of definition.toolNames ?? []) {
      expect(tool).not.toMatch(/write|create|delete|edit/)
    }
  })

  test('wires the public scholars-search MCP server over remote HTTP', () => {
    const mcp = definition.mcpServers?.['scholars-search']
    expect(mcp).toBeDefined()
    expect(mcp?.type).toBe('http')
    if (!mcp || mcp.type !== 'http') {
      throw new Error('expected a remote http MCP config')
    }
    expect(mcp.url).toBe('https://api.sciencemadereadable.com/mcp')
    // No key: the public endpoint requires no auth, so no secret surface.
    expect(mcp.headers ?? {}).toEqual({})
  })

  test('names the four MCP tools and the usage discipline in the system prompt', () => {
    const prompt = definition.systemPrompt ?? ''
    for (const tool of [
      'scholars-search__search_papers',
      'scholars-search__get_papers',
      'scholars-search__find_similar_papers',
      'scholars-search__citation_walk',
    ]) {
      expect(prompt).toContain(tool)
    }
    expect(prompt).toContain('30 tool calls per minute')
    expect(prompt).toContain('never from memory')
  })
})
```

4. **Regenerate the bundle:** `bun run --cwd=cli prebuild:agents`. The agent set is
   unchanged, so only `bundled-agents.generated-data/19-researcher-web.ts` differs;
   `bundled-agents.generated.ts` is expected byte-identical (the import list is unchanged).
5. **Docs:** `docs/agents-and-tools.md` — Researcher row tools column gains the four MCP
   tools; the "Last verified" line moves to 2026-10-12. Advisory (Loop 2 omission): prose
   capability summaries at `docs/agents.md:130`, `docs/index.md:52`, `AGENTS.md:32`,
   `docs/features.md:327` stay technically true but stale — accept the drift knowingly or
   extend the same edit pass; none becomes false. `CHANGELOG.md` entry at closure.
6. **Law 4 reachability grep** (post-implementation, pasted into this record):
   `grep -rn "scholars-search" cli/src/agents/bundled-agents.generated-data/19-researcher-web.ts`
   must match; the runtime consumer chain (`additionalToolDefinitions` → `getMCPToolData`
   → `requestMcpToolData` → `getMCPClient`) is pre-existing and was verified by symbol
   grep in RED (evidence item 6).

### Verification

Typecheck (`agents`, `cli`), the new test (`agents/researcher/researcher-web.test.ts`), and the
repo quality gate. Live smoke of the MCP endpoint was already performed in RED (200 + tool list). A full runtime smoke
(spawning `researcher-web` against the live service) is deferred to the implementation
audit and marked NEEDS-REVIEW here — it costs credits and is not required to prove the
wiring contract.

## Verification Gates

- gate: typecheck agents
- gate: typecheck cli
- gate: test agents/researcher/researcher-web.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:86408d432e6aac9b11b81bc6694b9ca5c44a868000b9aac9635c0d4bdf2cfa4b
- verified: 2026-10-12T06:12:23.035Z
- typecheck agents: exit 0
- typecheck cli: exit 0
- test agents/researcher/researcher-web.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** capability gap cataloged (evidence items 1-11): wiring contract, type
  constraint, runtime path, failure posture, serialization path, gate policy, live
  service behavior, Thinker unavailability.
- **GREEN:** reuse `mcpServers` remote-HTTP pattern; default tool exposure; prompt
  discipline section; definition-shape test; regenerate bundle. Exact content specified
  in Steps 1-3.
- **AUDIT:** Verifier agent pass on the document; results recorded in Loop 2.
- **ADVERSARIAL:** Adversary meta-verification of the Verifier's findings; results
  recorded in Loop 2.
- **CHANGE DELTA:** initial document; no convergence or closure claim.

### Missed Questions

1. *Enumerate the four tools in `toolNames`?* No — `SecretAgentDefinition.toolNames` is
   the closed `AllToolNames` union; `'scholars-search/search_papers'` fails typecheck and
   the cast is forbidden (Law 6). Default exposure is the documented contract for servers
   without `/`-form entries, and all four tools are read-only.
2. *Local stdio server instead of remote HTTP?* No — the service needs ~28 GB RAM,
   ~400 GB of data, and nightly rebuilds on its operator's machine; it exists to be
   called. Remote HTTP also matches the `github` precedent and adds no key surface.
3. *Is the one-time prompt-cache re-warm acceptable?* Yes — the tool array changes once
   at deploy; every tool addition pays the same cost, and the deterministic serialization
   seam (FID-2026-1006-005) re-warms on the first spawn.
4. *Is fail-soft the right failure contract?* Yes — a dead third-party server must not
   take down the Researcher. `getMCPToolData` disables just that server; the persona
   keeps `web_search`/`read_url`/`deep_research`, and the prompt tells the model to fall
   back.
5. *Does the README's "semantic covers 2024+" note matter?* No — live `/llms.txt`
   (2026-10-12) reports 124,950,164 semantic papers from year 1007; the repo README is
   stale. The prompt cites the endpoint's own guide for current coverage rather than a
   hardcoded number.
6. *What about `researcher-docs`?* Unchanged — it serves library-documentation lookup
   (`read_docs`); scholarly literature belongs to the web researcher.
7. *Does the spawn registry need edits?* No — `researcher-web` is already spawnable
   (`agents/savant/savant.ts`, `cli/src/utils/constants.ts`, free-agent catalog); the MCP
   wiring rides the existing definition.
8. *Headless/paid-path dependency?* None in this FID — the service is used interactively
   by the persona only; no automated or billable path calls it.

### Implementation Evidence (REQUIRED for `closed`)

Implementation exists and every declared gate passes live on the final bytes (2026-10-12):

- `agents/researcher/researcher-web.ts` —
  `mcpServers: { 'scholars-search': { type: 'http', url: 'https://api.sciencemadereadable.com/mcp' } }` inserted between
  `spawnableAgents` and `systemPrompt`; the "Scholarly Literature (MCP: scholars-search)" section appended to
  `systemPrompt` (tool-use boundary, query rewriting, screen-then-read, citation depth guidance, rate-limit and 502/503
  fallback). `instructionsPrompt` unchanged.
- `agents/researcher/researcher-web.test.ts` — new definition-shape pin (3 tests): native tools preserved with no write
  surface; remote-HTTP server type/URL with no auth headers; the four `scholars-search__*` tool names plus
  `30 tool calls per minute` and `never from memory` in the system prompt.
- `cli/src/agents/bundled-agents.generated-data/19-researcher-web.ts` — regenerated via
  `bun run --cwd=cli prebuild:agents` (exit 0); Law 4 grep:
  `grep -c "scholars-search" cli/src/agents/bundled-agents.generated-data/19-researcher-web.ts` → 2.
  `bundled-agents.generated.ts` unchanged (the generated bundle is a build artifact, not tracked).
- `docs/agents-and-tools.md` — Researcher row tools column gains the four MCP tools; "Last verified" → 2026-10-12.
- Gate runs on the final bytes: `typecheck agents` exit 0; `typecheck cli` exit 0;
  `test agents/researcher/researcher-web.test.ts` 3 pass / 0 fail; `quality` PASS (1502 baselined files); eslint (both
  changed TS files, --max-warnings 0) exit 0; prettier formatted both TS files. No commit exists yet at verified — the
  receipt below documents the verification that earned the status; the closing commit SHA is recorded at closure.

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (target file read 0-EOF before every edit; generated artifact read;
      contract files read by symbol)
- [x] Implementation matches the Proposed Solution — Steps 1-5 implemented verbatim, with the three operator-relayed
      prompt refinements (Nova review) folded into Step 2's text: tool-use boundary (non-research questions stay on
      web_search), rate-limit error handling (stop and fall back rather than retry), citation-tool depth/direction
      guidance (find_similar_papers k=10-20; citation_walk k=20-30 with year/topic filtering)
- [x] Typecheck/tests/lint — typecheck agents exit 0, typecheck cli exit 0, test 3/3 pass, quality PASS, eslint exit 0
- [x] Production call-graph evidence — the bundled production artifact contains the wiring (grep -c → 2); the runtime
      consumer chain (`additionalToolDefinitions` → `getMCPToolData` → `requestMcpToolData` → `getMCPClient`) is
      pre-existing and was verified by symbol grep in RED (evidence item 6)
- [x] FID status reflects the actual implementation state (`verified` — implementation exists and gates pass)

## Resolution

Implemented and verified 2026-10-12. Fix description: `researcher-web` carries the public Scholars Reading List MCP
server through the existing `mcpServers` contract; the persona prompt gains the Scholarly Literature discipline section;
the definition shape is pinned by a new test; the bundled agent was regenerated. Tests added: yes —
`agents/researcher/researcher-web.test.ts` (3 tests). Verification evidence: the four declared gates plus
eslint/prettier all exit 0 on the final bytes (see Implementation Evidence). Closure (commit SHA, archive, CHANGELOG,
register eviction) completes in the pass that follows the implementation audit.

### Loop 2 — Independent audit and adversarial meta-verification

- **AUDIT (Verifier agent, 2026-10-12):** 16 PASS, 1 FAIL, 4 NEEDS-REVIEW. Verifier's
  FAIL: Step 1 anchor "add between `spawnableAgents` and `systemPrompt`" was claimed to
  cite a field absent from the file. NEEDS-REVIEW items: (a) `cli/package.json`
  `prebuild:agents` script name; (b) test-file exclusion in
  `cli/scripts/prebuild-agents.ts` `getAllTsFiles`; (c) `VALIDATION_WORKSPACE_POLICY`
  membership of `agents`/`cli`; (d) `common/src/templates/initial-agents-dir/`
  roster-agent mirror.
- **SELF-CORRECT (Orchestrator, 2026-10-12):** re-read
  `agents/researcher/researcher-web.ts` 0-EOF — `spawnableAgents: [],` exists at line 21,
  immediately before `systemPrompt`. The anchor is accurate; the Verifier's FAIL rested
  on incomplete recall from its compacted message history. The other four were resolved
  by direct re-reads: (a) `cli/package.json` scripts contains
  `"prebuild:agents": "bun run scripts/prebuild-agents.ts"`; (b) the prebuild script's
  own `getAllTsFiles` filters `!entry.name.endsWith('.test.ts')` (the Verifier attributed
  the exclusion to `sdk/src/validate-agents.ts` — wrong file; the exclusion lives in the
  prebuild script itself); (c) `scripts/validation-gates.ts:23-24` —
  `{ workspace: 'agents', requiredTypecheck: true, requiredTest: true }` and
  `{ workspace: 'cli', ... }` both in `VALIDATION_WORKSPACE_POLICY`; (d)
  `common/src/templates/initial-agents-dir/` contains only the template scaffold
  (LICENSE, my-custom-agent.ts, package.json, README.md, examples/, skills/, types/) —
  no roster-agent copy, no mirror needed.
- **ADVERSARIAL (Adversary agent, 2026-10-12):** verdicts override the Verifier's —
  **FAIL REFUTED** (read the file 0-EOF directly: field sequence `outputMode` →
  `includeMessageHistory: false` → `toolNames` → `spawnableAgents: []` → `systemPrompt`;
  the anchor stands). All four NEEDS-REVIEW resolutions **CONFIRMED** with independent
  reads. Additional adversarial verifications: `agent-definition.ts:93`
  `mcpServers?: Record<string, MCPConfig>` and `mcp-constants.ts`
  `MCP_TOOL_SEPARATOR = '__'` confirmed — the test's narrowing compiles (every
  `MCPConfig` union member carries `type`; the http branch exposes `url`/`headers`);
  Step 4's byte-identical claim confirmed (`generateBundledAgentsFile` derives content
  from the agentId list only; `15-github-2.ts` does not exist in the tree — the RED
  Detective's citation of it was corrupted recall, not fact); character-level test/spec
  convergence confirmed (Step 2's prompt text contains, verbatim, all four
  `scholars-search__*` tool names, `30 tool calls per minute`, and `never from memory`);
  serialization safe (JSON data + prettier).
- **Adversarial OMISSION (advisory, non-blocking):** prose capability
  summaries at `docs/agents.md:130`, `docs/index.md:52`, `AGENTS.md:32`, `docs/features.md:327` go stale after
  implementation but remain technically true; folded into Step 5 as an accepted-drift note. No other omission found; no
  NEEDS-REVIEW remains.
- **Operator-relayed external review (Nova, 2026-10-12):** verdict approve, with three post-deploy watch items, all
  folded into Step 2's implemented prompt text before coding: (1) tool over-use — the prompt now draws the
  research/non-research boundary explicitly ("Everything else — news, pricing, releases, how-to, product or software
  questions — stays on web_search; this index is papers only"); (2) rate limit under load — the prompt now names the
  rate-limit error shape ("the tool result says how long to wait") and directs stop-and-fallback rather than
  retry-looping; (3) citation guidance — `find_similar_papers` and `citation_walk` now carry direction (semantic
  neighborhood / co-cited prior work) and depth (k=10-20 / k=20-30 with year-topic filtering) instead of "snowball
  outward". Nova also noted the Thinker spawn failures meant fewer independent design passes; recorded honestly in
  evidence item 11.
- **CHANGE DELTA:** status flip, Step 5 advisory, Loop 2 record — well under the 10% circuit-breaker bound.

### Loop 3 — Final convergence

The document's full specification was audited and meta-verified: one FAIL refuted with
direct 0-EOF file evidence, four NEEDS-REVIEW resolutions independently confirmed, one
advisory prose-staleness omission folded in. No blocking findings. Status is
**converged**: the document loop is complete — this is NOT implementation approval, and
no code exists. Implementation, gates, Law 4 grep, and closure remain gated on operator
approval per Resolution. On approval: implement Steps 1-5, run the four declared gates
via `bun run fid:verify dev/fids/FID-2026-1012-001-scholars-search-mcp-integration.md
--write`, paste the Law 4 grep, flip to `verified`, commit path-scoped (G1/G3/G4), then
close and archive with the CHANGELOG entry.

## Lessons Learned

A "would this repo help our agent?" question is answered by separating the service from
the code: the repository's value here is its hosted API and MCP endpoint, not its
Python. Vendoring would import a 28 GB-RAM, 400 GB-data, nightly-rebuilt service into a
TypeScript monorepo — the contract to consume is `mcpServers`, the same seam the
`github` helper already proves.

Second: a capability wired through `toolNames` enumeration is bounded by that field's
type. `SecretAgentDefinition.toolNames` is the closed `AllToolNames` union, so MCP
servers on roster agents are consumed through default exposure (the documented behavior
of `getMCPToolData` for servers without `/`-form entries) — never through a widened
union or a cast. Any future MCP integration on a roster agent inherits the same
constraint and the same resolution.

Third: when a sub-agent spawn fails on a harness defect rather than on content (here,
three `thinker` spawns misfiring tools it does not have, and a Recorder
read-without-write stall), the honest record states the failure and the substitute
reasoning — it does not claim a certification that never ran.

Fourth: an active FID in `dev/fids/` is governed by `lint:md` (only the archive is in
`.markdownlintignore`), so a converged record authored in compact single-line paragraphs
fails the pre-push markdown gate with MD013 violations. Wrap prose at ≤120 chars when
authoring FIDs, and run `bun x markdownlint <path>` on the record before declaring the
document done.