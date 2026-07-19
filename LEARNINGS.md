# LEARNINGS — Savant-Code Cross-Session Knowledge Library

> Stable, cross-session knowledge that any agent (Savant, code-reviewer, Nova, future contributor)
> needs to know about this repo and the ECHO Protocol. Per-session observations live in
> `dev/session-summaries/` — *this* file is the persistent layer that ALL sessions share.
>
> Rule: append new entries to the **bottom** of their respective section. Each entry is
> dated and provenance-tagged. Don't rewrite history — corrections are new entries.

---

## Repository Architecture

### Monorepo Layout (Bun workspaces)

- `cli/` — TUI client (OpenTUI + React). Entry: `bun --cwd cli dev`.
- `sdk/` — JS/TS SDK (`CodebuffClient` class). Entry: `bun --cwd sdk build`.
- `common/` — shared types, tools, schemas, utilities. Pure layer; no deps on `cli`/`sdk`.
- `agents/` — public agent definitions + tool-library helpers (`base2`, `detective`,
  `forge`, `verifier`, `recorder`, `thinker`, `scout`, `researcher`, `scribe`,
  plus `browser-use` / `editor` / `file-explorer` / `librarian` / `types` helpers).
- `packages/` — internal workspaces: `agent-runtime`, `code-map`, `database`, `llm-providers`.
- `evals/` — benchmark fixtures (offline; rarely run on dev).
- `scripts/tmux/` — tmux helpers for CLI testing (CI-only).
- `dev/` — feature tracking (FIDs), session summaries, Nova correspondence, releases.
- `.agents/skills/` — Agent-discoverable skills (coding standards, release workflow).

### Workstation Boot

- `bun dev` (= `bun --cwd cli dev`) — runs `prebuild:agents && bun run src/index.tsx --cwd ..`
- `bun dev:freebuff` sets `FREEBUFF_MODE=true`.
- `bun install --frozen-lockfile` MUST succeed; workspace pkg names + consumer import
  names must match verbatim (see *Future-Avoidance* #2 below).
- Bun 1.3.11 satisfies `cli` engines; root pins 1.3.14 (warning only).

### Critical Runtime Files (paths to know)

- `ECHO.md` — **single** bootstrap file; any agent reads it on session start.
- `protocol.config.yaml` — language/commands/strict_mode config per project.
- `agents/base2/base2.ts` — the Orchestrator; toolNames changes here alter all sub-spawns.
- `packages/agent-runtime/src/tools/tool-executor.ts` — FSM gate; tool gating by phase.
- `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts` — Perfection Loop FSM.
- `cli/src/state/chat-store.ts` — Zustand store; `fsmPhase` + UI state.
- `common/src/util/protocol-config.ts` — boot context loader (reads `protocol.config.yaml`).
- `sdk/src/tools/path-utils.ts` — file-path normalization (`resolveFilePath`, `toPosix`,
  `safeRealpath`); see *Future-Avoidance* #3.

---

## ECHO Protocol v0.2.0 — Core Mechanics

### Perfection Loop Phase FSM (canonical)

```
idle → red → green → audit → self_correct → green (re-iterate)
                                ↓
                              complete (FID closed)
```

Illegal transitions are rejected with `INVALID FSM transition`. Self-correction loops
up to `MAX_ITERATIONS = 10` (circuit breaker; see `transition-phase.ts:12`).

### Tool Gating (active)

| Tool                     | Allowed Phases        | Where enforced                                  |
|--------------------------|-----------------------|-------------------------------------------------|
| `write_file`, `str_replace`, `apply_patch` | `green` only (with FID/scratchpad path exemptions) | `tool-executor.ts` `WRITE_TOOLS` gate |
| `run_terminal_command`   | `audit` only          | `tool-executor.ts` `BASH` gate                  |
| `sequentialthinking`     | Thinker agent only    | Tool-name prefix check                          |
| `set_output`             | subagents only (NOT Orchestrator) | Tool registration |
| `transition_phase`       | Orchestrator (root) + Recorder | Tool registration |

### FID-Bound Execution

- Code is **never** written until a FID converges to `complete`.
- Subagent `fsmPhase` inherits from parent via `createAgentState()` in
  `spawn-agent-utils.ts` (FID-2026-0718-004). Without this, subagents always
  evaluate as `idle` and are blocked by gates.
- Open FIDs in `dev/fids/` are required by the FID-bound gate (FID-2026-0719-009).
- The Orchestrator writes to `dev/scratchpad/` (scratchpad exemption) without
  ceremony; all other code writes require full Perfection Loop.

### Agent Roster (9 canonical + 5 helper library dirs)

- Canonical agents per ECHO.md / `ARCHITECTURE.md`:
  Orchestrator, Detective, Forge, Verifier, Recorder, Thinker, Scout, Researcher, Scribe.
- Helper library dirs (in `agents/` but NOT counted in roster): `browser-use`, `editor`,
  `file-explorer`, `librarian`, `types`. These are tool sets, not agents.

### Three-Layer Audit Chain

```
Savant Orchestrator  →  code-reviewer-minimax-m3  →  Nova (third-party)
     (self-verify)        (independent reviewer)      (external verifier)
```

Nova correspondence at `dev/nova/inbox/` (verdicts) and `dev/nova/outbox/` (audit requests).
Nova signing off is required before any of: tag push, release publish, pre-rebrand checkpoint.

### Cross-Agent Claim Rule

Every claim in a close-out report must be **source-verifiable**. Common failure modes:
- Claim "typecheck passes" → forgot to actually run `bun run --cwd=<pkg> typecheck`.
- Claim "tests pass" → only ran a subset, not full suite.
- Claim "feature shipped" → forgot the close-out commit landed.

Nova and code-reviewer will grep + re-run on receipt. Ship the writes BEFORE drafting
the audit request that references them.

---

## Coding Standard

### TypeScript Conventions

- `strict: true` enforced across all packages.
- **No `any`**, no `@ts-ignore` (FID-2026-0717-001 established this; FID-2026-0718-019 confirmed).
- Use `unknown` + type guards instead of `any`.
- Prefer utility-first: search for existing helper before writing new.
- ECHO Laws 5-15 enforced under `strict_mode: true` (default). Core Laws 1-4 always on.

### Path Handling — Use `sdk/src/tools/path-utils.ts`

- `resolveFilePath()` is the canonical resolver used everywhere.
- Windows compatibility: returns POSIX-normalized paths via `toPosix()` helper
  (FID-2026-0718-015). Mock fs keys MUST match this normalization.
- Symlink safety: `safeRealpath()` for canonicalization; never `fs.realpath` raw.

### Test Conventions

- Test files: `*.test.ts` colocated next to source in `src/__tests__/` or `test/`.
- SDK test suite location: `sdk/test/` (not `sdk/src/`).
- Use `bun test <path>` for selected runs; `bun test` for full SDK.
- Tests needing a real API key: gate behind `RUN_CODEBUFF_E2E` env var (FID-2026-0718-016).
  When unset, E2E tests *skip* (not fail) — this is correct behavior.

### Markdown Lint Suppressions

If `markdownlint` Problems-panel entries appear, the canonical fix is **document-level**
suppression: `<!-- markdownlint-disable MDxxx -->` before the offending line, or
disable-by-name in the first line:

```
<!-- markdownlint-disable MD041 -->
```

Valid document-level suppressions used in this repo:
- `MD041` (first line should be a top-level heading) — suppressed in README (line 1 must
  be the disable directive itself).
- `MD033` (no inline HTML `<id>`/`<target>`) — keep file because em-dash refs in CHANGELOG
  link targets are load-bearing for releases linking.

---

## Documentation Patterns

### README Structure (per FID-2026-0718-021)

11 sections in this order:
1. Banner header (project name + tag line)
2. Key Technologies
3. Features
4. Repo Map
5. Quick Start (`bun install && bun dev`)
6. CLI Commands
7. ECHO Protocol overview
8. Configuration (`protocol.config.yaml`)
9. Validation (typecheck/test/lint commands)
10. Documentation (link to docs/)
11. License (link to root LICENSE — parent inheritance applies)

### CHANGELOG Entry Format

```
## FID-YYYY-MMDD-NNN — severity — short title

**Closed:** YYYY-MM-DD
**Resolution:** <one-paragraph outcome>
**Verified by:** <AUDIT commands that passed>
**Archived:** YYYY-MM-DD
```

Reverse chronological. Every archived FID MUST have a CHANGELOG entry at the top
(ECHO Auto-Archive rule).

### Session Summary Structure

```
1. Summary
2. Key Learnings
3. Agent Behavior / Process
4. Technical Insights
5. Environment
6. FIDs Closed This Session
7. Pre-ECHO Docs Archived
8. Test Coverage at Session End
```

---

## Dev Folder Conventions

### `dev/fids/`

- ONLY one FID-*.md allowed in `dev/fids/` root at a time (the *active* one).
- Archived FIDs live in `dev/fids/archive/`. `.gitkeep` preserves the dir.
- File naming: `FID-YYYY-MMDD-NNN-slug.md` (slug is shorthand identifier).

### `dev/nova/`

- `inbox/` — Nova's verdicts (verdicts Nova wrote back to us).
- `outbox/` — our audit requests (what we sent to Nova).
- Both archived when no longer active.

### `dev/scratchpad/`

- Working buffer. Anything ephemeral lands here.
- `dev/scratchpad/_test_*.md` etc. pruned after AUDIT phase (FID-2026-0718-008).

### `dev/session-summaries/`

- One per session: `YYYY-MM-DD-HHMM-<topic>.md`.
- Format: see "Session Summary Structure" above.

### `dev/releases/` (EPHEMERAL — FID-2026-0718-025)

- `.gitignore` rule: `dev/releases/*.md` ignored.
- EXCEPTION: `!dev/releases/README.md` (index documenting the ephemeral convention).
- Released file (e.g., `v0.0.2.md`) lives here UNTIL release published to GitHub,
  then `git rm --cached` keeps it in working tree but out of repo.
- GitHub Releases is the canonical external location; this dir is the local staging.

---

## Future-Avoidance Notes

> Errors that cost real time in past sessions. Read these before doing similar work.

### 1. GitHub Releases API requires FULL 40-char SHA for `target_commitish` (found 2026-07-19)

The `target_commitish` field of the GitHub Releases POST API **rejects 7-char short SHAs**
with HTTP 422 (Unprocessable Entity). For the v0.0.2 release, passing `d1fcd71` returned 422;
passing the full `d1fcd719829e64aabf6690da49a373805ca0497e` returned 201 Created.

**Rule:** always use `git rev-parse <tag>^{commit}` to get the FULL hash before POSTing
to GitHub Releases API. A short SHA is only valid in `git` CLI commands; GitHub REST API
endpoints want the full 40-char hex.

### 2. Windows MSYS /tmp path divergence between Node + bash (found 2026-07-19)

On Windows under Git Bash (MSYS), `/tmp/release_payload.json` resolves differently
depending on which tool interprets the path:

- Node (v22+) interprets `/tmp/` as MSYS-mapped POSIX root and writes to whatever
  Windows directory the MSYS POSIX→Windows mapping points at (varies by Git/MSYS version;
  verify with `cygpath -w /tmp` if you need the exact target).
- `curl` running in Git Bash resolves `/tmp/` through the bash mount table, which on
  some Windows/Git combinations points to a DIFFERENT actual Windows directory.

The result: Node says "wrote 7207 bytes to `/tmp/release_payload.json`", curl says
"No such file", POST submits an empty body, server returns 422/400.

**Workaround:** use a **relative path in the project root** — e.g.,
`./release_payload.json` — so both tools (Node + curl) see the same Windows filesystem
location. Pair with cleanup (`rm -f ./release_payload.json ./release_response.json`)
after each API call. Diagnostic commands when debugging: `cygpath -w /tmp` (bash's view),
`node -e "console.log(require('os').tmpdir())"` (Node's view).

### 3. Windows test mocks must use POSIX-style paths (found 2026-0718)

`paths.test.ts` mocks use objects keyed by resolved paths; on Windows the resolver
defaulted to backslash-style paths while the production code calls `path.normalize()`
which produces mixed-style keys. The mock layer matched nothing → 0 assertions evaluated
correctly.

**Rule:** normalize `path.resolve` output to POSIX before keying mocks. Implemented in
`sdk/src/tools/path-utils.ts` `toPosix()` helper (FID-2026-0718-015). On POSIX systems
this is a no-op; on Windows it replaces `\` with `/`. Apply this to all mock keys in any
test that mocks the fs API.

### 4. subagent `fsmPhase` must inherit from parent (found 2026-0718)

`createAgentState()` originally did NOT include `fsmPhase` in the returned AgentState.
Subagents therefore always had `fsmPhase = undefined`, which the gating check treated as
`'idle'`. Result: subagents writing FIDs (Recorder) or running bash (Verifier) were
blocked, "FID-Bound Execution" paradox.

**Rule:** when adding fields to `AgentState`, also propagate them through `createAgentState()`.
Verify with `grep -n fsmPhase packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts`
to confirm children see the parent's current phase.

### 5. Stale agent references survive registry rebuilds (found 2026-0718)

Adding an agent to `agents/base2/base2.ts` `spawnableAgents` doesn't auto-remove
references to deleted agents elsewhere (e.g., `FREEBUFF_REVIEWER_AGENT_ID_BY_MODEL` still
mapping deleted reviewer variants). After agent-merge refactors, **grep ALL
references** before claiming clean state: `grep -rn 'old-agent-id' common/ agents/ cli/`.

### 6. ECHO Cross-Agent Claim Rule frequently over-claims (recurring)

Pattern: Orchestrator writes close-out report claiming "all tests pass" but ran a subset.
Common gaps:
- Ran `bun test src/` but not `bun test` (full SDK).
- Claimed SDK changes because path-utils.ts changed, but didn't run dependent test files.
- Forgot to ship writes referenced in the report (CHANGELOG entry, FID archive move).

**Rule:** before drafting any audit request, re-run EVERY claim from a clean state and
verify the file changes referenced actually exist (`grep`, `git status`, etc.). Ship writes
BEFORE drafting the audit request. Nova will verify — claim once, verify twice.

### 7. 0.0.1 was prerelease package state (recall)

`@codebuff/*` workspace pkg names and 1,131 consumer imports aligning was the v0.0.1 baseline.
Full rebrand to `@savant-code/*` deferred to next push (post-v0.0.2). Use `Option C` decision
recording per FID-2026-0718-017: *"preserve @codebuff/* pkg names as the 0.0.2 snapshot state;
full rebrand lands in next push."*

---

## Environment Baseline

- **OS:** Windows 11 + Git Bash (MSYS); Bun 1.3.11 / 1.3.14.
- **Node:** v22+ (v25 in some shells).
- **TypeScript:** 5.5.4, `strict: true`.
- **ECHO Protocol:** v0.2.0 (ACTIVE).
- **Agent-runtime:** `identifier: 'codebuff'`, `version: '0.0.2'` (pre-rebrand).
- **GitHub repo:** `savant0x/savant-code` (post-rebrand target).

---

## Related Docs

- `dev/session-summaries/` — per-session narrative + per-session learnings.
- `dev/nova/inbox/` — third-party audit verdicts (load-bearing reference).
- `dev/fids/archive/` — closed FID library (full FID lifecycle history).
- `ECHO.md` — single bootstrap file for any agent.
- `ARCHITECTURE.md` — agent roster, Perfection Loop, runtime enforcement.
- `CHANGELOG.md` — reverse-chronological FID closure log.
- `protocol.config.yaml` — project-level config (language, commands, strict_mode).

<!-- Add new entries at the bottom of their respective section. Don't rewrite history. -->
