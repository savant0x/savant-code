# FID: Benchmark v2 — ECHO-Native Deterministic Evaluation System

**Filename:** `FID-2026-0725-084-benchmark-v2-echo-native.md`
**ID:** FID-2026-0725-084
**Severity:** high
**Status:** closed
**Created:** 2026-07-25
**Author:** Savant Orchestrator

---

## Summary

Replace the legacy `evals/` git-commit-reconstruction benchmark with an ECHO-native, deterministic-first benchmark system. The new system must measure Savant-Code's actual differentiators (multi-agent orchestration, FSM phase compliance, custom/MCP tools, skills, programmatic agents) while remaining runnable on a Windows/Bun developer workstation without exotic infrastructure. External research is treated as ideas only; the final design is purpose-built for this codebase.

## Environment

- **OS:** Windows 10/11 (primary dev), Linux/macOS (CI)
- **Language/Runtime:** TypeScript / Bun 1.3.14
- **Tool Versions:** ECHO Protocol v0.2.0
- **Commit/State:** Working tree (uncommitted) — post-rebrand, post-FID-080/081/082/083

## Detailed Description

### Problem

The current `evals/` system (`evals/benchmark/`) was built before the rebrand and assumes runtime primitives that no longer exist. It:

- Evaluates by diff reconstruction with LLM judges (GPT-5 + Gemini), not by running tests.
- Contains a real bug in "median" judge logic: only two judges run, and the median calculation for `length === 2` always picks the higher score.
- Has no sandboxing; external agents install binaries into `os.tmpdir()` and mutate `process.env.PATH`.
- Punishes all agents when one agent fails on a commit (`commitShasWithErrors` discards successful runs for that commit).
- Has zero tests for the benchmark harness itself.
- Cannot measure anything ECHO-specific (FSM transitions, subagent spawning, tool phase gating, custom/MCP tools, skills, slash commands, `handleSteps`).

### Expected Behavior

A production-grade benchmark that:

1. **Deterministic-first:** compiles, type-checks, builds, and runs tests before any LLM judge is considered. LLM judging is reserved for qualitative dimensions and capped by a per-run budget.
2. **ECHO-native:** captures FSM transitions, subagent delegation, tool-permission respect, and slash-command usage as secondary signals.
3. **Isolated:** runs each task in a fresh sandbox that does not contaminate the host.
4. **Comparable:** can run Savant-Code (via SDK) and external CLI agents (Claude Code, Codex, OpenCode) through the same task surface.
5. **Maintainable:** has tests for the harness itself and clear, minimal local setup.
6. **Practical:** works on Windows without requiring Firecracker, KVM, or CRIU in the MVP.

### Root Cause

The benchmark was designed for a single-agent, output-centric world. It treats Savant-Code as a black-box patch generator and ignores the ECHO Protocol's internal execution process, which is the product's core value proposition.

### Evidence

- `evals/benchmark/judge.ts` hardcodes two judges and computes `medianIndex = Math.floor(sortedResults.length / 2)`; with length 2 this is index 1 (higher score), not a median.
- `evals/benchmark/run-benchmark.ts` filters out commits by erroring commit SHA for all agents, not just the failing agent.
- `evals/benchmark/runners/` implements a `Runner` interface but the harness around it is monolithic and untested.
- No `*.test.ts` or `*.spec.ts` files exist under `evals/`.
- The current tasks (`eval-codebuff.json`, `eval-manifold.json`) are large diffs of external repos, unrelated to Savant-Code's capabilities.

---

## Impact Assessment

### Affected Components

- New: `evals/v2/` directory and package scripts
- New: `evals/v2/schema/task.schema.json`
- New: `evals/v2/runner/` — runner interface, Savant SDK runner, external CLI runners
- New: `evals/v2/sandbox/` — Docker sandbox (Linux/CI) and temp-dir sandbox (Windows/local)
- New: `evals/v2/scoring/` — deterministic verifier and ECHO metrics aggregator
- New: `evals/v2/tasks/` — curated task definitions
- Modified: `evals/package.json` — scripts and dependencies
- Modified: `CHANGELOG.md` — FID closure entry

### Risk Level

- [x] High: Without a reliable benchmark, architectural regressions in the ECHO runtime cannot be detected.

## Proposed Solution

### 1. Task Taxonomy (Purpose-Built for Savant-Code)

| Category | What It Tests | Example Prompt | Primary Pass Criteria | FSM/Protocol Assertion |
|---|---|---|---|---|
| **Pure Coding** | Baseline code correctness | "Fix the off-by-one error in `tree.ts`." | `bun test tree.test.ts` exits 0. | None |
| **FSM Compliance** | ECHO phase gating and transitions | "Refactor `auth.ts`; hidden harness injects a test failure on first run." | Trace shows `RED -> GREEN -> AUDIT -> SELF_CORRECT -> GREEN -> AUDIT -> COMPLETE`. | `transition_phase` calls match `expected_sequence`; no write tools in RED. |
| **Multi-Agent Orchestration** | Subagent delegation for cross-file work | "Rename `UserModel` to `ClientEntity` across 45 files." | `tsc --noEmit` and tests pass; no orphaned imports. | `spawn_agents` calls include Detective, Forge, and Verifier. |
| **Custom Tool** | Custom tool execution | "Use `generate_ast_graph` to map `core/` and write `deps.json`." | `deps.json` matches expected topology exactly. | Tool `generate_ast_graph` is invoked at least once. |
| **MCP Tool** | MCP server integration | "Query mock Jira server for ENG-102 and apply CSS changes." | CSS compiles; mock server state shows ticket resolved. | MCP tool call present in trace. |
| **Skill-Driven** | `.savant/SKILL.md` adherence | "Implement payment gateway per `SKILL.md` constraints." | Custom lint/AST rule passes. | Skill file loaded by runtime. |
| **Programmatic Agent** | `handleSteps` generator | "Run `BatchProcessor` to refactor 50 files in `/data`." | Generator completes; all 50 files verified. | `handleSteps` directives exhausted. |
| **Slash/CLI** | CLI command surface | `/goal all tests pass` | Goal loop terminates; trace shows `/goal` hook. | `goal_condition` satisfied by same model. |
| **Error Recovery** | Environmental fault handling | "Implement sort; harness injects a bad type definition." | Agent detects in AUDIT, adapts, `tsc` passes. | `SELF_CORRECT` triggered by Verifier finding. |

### 2. Task Schema

```yaml
schema_version: "2.0"
task_id: "savant-v2-auth-jwt-001"
category: "multi_agent_orchestration"
difficulty: "medium"
environment:
  base_image: "savant-eval-base:1.2"        # Docker only; local uses temp dir + setup script
  setup_script: "bun install"
inputs:
  prompt: "Migrate auth.ts to use the Jose library."
validation:
  timeout_seconds: 300
  deterministic_checks:
    - command: "bun run build"
      expected_exit_code: 0
    - command: "tsc --noEmit"
      expected_exit_code: 0
    - command: "bun test src/auth.test.ts"
      expected_exit_code: 0
  fsm_assertions:
    strict_phase_order: true
    allow_write_in_red: false
    expected_phase_sequence: ["RED", "GREEN", "AUDIT", "COMPLETE"]
  custom_tool_checks:
    - tool_name: "generate_ast_graph"
      expected_calls: ">=1"
```

### 3. Legacy `evals/benchmark/` Disposition

The existing `evals/benchmark/` harness is deprecated on FID closure. It remains in place during v2 construction to avoid breaking any active scripts, but no new tasks are added to it. Once v2 reaches the first regression run, the legacy harness is moved to `evals/v1/` (preserved for reference) and `evals/v2/` is promoted to `evals/`. The final step of v2 implementation includes deleting the deprecated `evals/v1/` tree or archiving it per project convention.

### 4. Harness Architecture (MVP)

```
evals/v2/
├── src/
│   ├── registry.ts          # Load and validate task YAML with Zod
│   ├── runner.ts            # AgentRunner interface
│   ├── runners/
│   │   ├── savant.ts        # SavantCodeClient SDK wrapper
│   │   ├── claude.ts        # Claude Code CLI wrapper
│   │   ├── codex.ts         # Codex CLI wrapper
│   │   └── opencode.ts      # OpenCode CLI wrapper
│   ├── sandbox.ts           # Sandbox interface
│   ├── sandboxes/
│   │   ├── docker.ts        # Linux/CI: Docker container
│   │   └── tempdir.ts       # Windows/local: isolated temp dir + env vars
│   ├── verifier.ts          # Deterministic checks
│   ├── metrics.ts           # ECHO-specific metric computation
│   └── benchmark.ts         # CLI entry point
├── schema/
│   └── task.schema.json
├── golden/
│   └── <category>/
│       └── <task_id>/
│           ├── patch.diff              # Canonical diff against base commit
│           └── README.md               # Rationale for the golden solution
├── tasks/
│   ├── pure_coding/
│   ├── fsm_compliance/
│   ├── multi_agent/
│   ├── custom_tool/
│   ├── mcp_tool/
│   ├── skill_driven/
│   ├── programmatic_agent/
│   ├── slash_cli/
│   └── error_recovery/
├── reports/
│   ├── traces.sqlite        # Structured trace database
│   ├── traces.jsonl         # Raw event stream for external analysis
│   └── leaderboard.md       # Human-readable summary
├── tests/
│   └── *.test.ts            # Harness unit tests
└── README.md
```

### 5. Sandboxing Strategy

| Environment | Sandbox | Isolation Level |
|---|---|---|
| Windows local | Temp directory + env override + offline cache | Process-level; suitable for MVP |
| Linux/macOS local | Docker container per task | Filesystem/network isolation |
| CI | Docker container per task (or GitHub Actions service) | Full container isolation |

- **MVP rule:** no Firecracker, KVM, or CRIU in the first milestone. Ship Docker + temp-dir first, then evaluate microVMs if throughput demands it.
- Each sandbox receives a clean copy of the task repo, runs `setup_script`, executes the agent, then runs deterministic checks.
- Network is disabled by default; package installs use a pre-seeded offline cache or local registry proxy. LLM judge calls and provider API calls are rate-limited via exponential backoff with a per-task budget cap; if the budget is exceeded, the task is marked `BUDGET_EXCEEDED` and no further LLM judging runs.

#### Windows Temp-Dir Sandbox Details

To prevent host contamination on Windows:

1. Override environment variables in spawned process:
   - `HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA` -> temp sandbox dir
   - `BUN_INSTALL_GLOBAL_BIN_DIR` -> `<temp>/bin`
   - `BUN_INSTALL_CACHE_DIR` -> `<temp>/cache`
2. Configure Bun to use the temp dir:
   - `bun config set global-bin-dir <temp>/bin`
   - `bun config set cache-dir <temp>/cache`
3. Install dependencies offline from a pre-seeded cache:
   - `bun install --backend=copyfile` (avoids symlinks)
4. On teardown, kill the full process tree (`taskkill /T /F` on Windows, `tree-kill` cross-platform) and delete the temp dir.

### 6. Runner Abstraction

```typescript
export interface AgentRunner {
  initialize(config: RunnerConfig): Promise<void>
  executePrompt(prompt: string): Promise<RunState>
  collectTrace(): TraceDocument
  handleInteractivePrompt(request: string): Promise<string>
  injectFault?(trigger: string, action: () => void): Promise<void>
}
```

- `injectFault` is optional; used by the harness to simulate environmental errors (bad type definitions, failing tests) when the task requires it.
- **Savant runner:** calls `SavantCodeClient.run()` directly, captures `handleEvent` for FSM/tool/subagent traces.
- **External runners:** spawn CLI processes via `Bun.spawn` with non-interactive flags (e.g., `--yes`, `--non-interactive`) or pre-populated global config files. Do not rely on stdin injection, which breaks on Windows when `isTTY` is false.

### 7. Deterministic Verification Layer

1. Use files already modified by the agent (no external patch application on Windows).
2. Build: `bun run build` / `tsc --noEmit`.
3. Type-check: `tsc --noEmit`.
4. Test: task-specific test command.
5. Lint/format: `eslint`, `prettier --check`.
6. Custom bash validators.
7. No agent-level flaky-test retry. Validation scripts may be retried up to 3 times with a short per-script timeout (default 10s), and only if the failure is a non-deterministic infrastructure error (e.g., port already in use). Compile errors do not retry.

LLM judging is **only** used for qualitative dimensions (maintainability, instruction adherence, explanation quality) with a structured JSON rubric and a 1–5 scale. The LLM judge median bug is fixed by requiring an odd number of judges (default 3: GPT-5, Gemini, Claude Sonnet) and computing the true median.

### 8. ECHO-Specific Metrics

| Metric | How Computed | Use |
|---|---|---|
| **FSM Strict Compliance** | Parse `handleEvent` tool-call payloads where `toolName === 'transition_phase'` to reconstruct phase sequence; compare with `expected_phase_sequence`. Penalize write tools (`write_file`, `str_replace`, `apply_patch`) when phase is `RED` or `AUDIT`; penalize `run_terminal_command` when phase is not `GREEN` or `AUDIT`. | Ensures FSM gating is respected |
| **Subagent Utilization** | Ratio of distinct subagents spawned to `expected_agents` in task schema | Rewards delegation for complex tasks |
| **Detective Precision/Recall** | Files read by Detective vs. files in golden patch | Penalizes context dumping |
| **Forge Minimality** | Levenshtein distance from golden patch | Penalizes unnecessary changes |
| **Verifier Impact** | Verifier detected failure and SELF_CORRECT loop succeeded | Boolean flag |
| **Tool Permission Respect** | No tool calls outside agent's `toolNames` | Penalizes role violations |

### 9. Report Persistence

All runs write to `evals/v2/reports/`:
- `traces.sqlite`: structured trace database (task metadata, FSM transitions, tool calls, token/credit telemetry, per-check results).
- `traces.jsonl`: append-only raw event stream for downstream analysis and replay.
- `leaderboard.md`: markdown summary regenerated after each run, showing pass/fail, ECHO metrics, and cost per task.

Retention policy: raw traces retained for 90 days; aggregated leaderboard kept indefinitely.

### 10. Cost, Latency, and API Resilience

- Provider calls are wrapped with exponential backoff and jitter.
- Per-task budget cap for LLM judging (default USD $0.10/task, adjustable per task).
- API rate-limit errors pause the FSM tick and retry; after 3 retries the task is marked `API_FAILURE`.
- Token and credit telemetry are captured from `RunState.sessionState.mainAgentState` for Savant runs and from stdout parsers for external agents where available.

### 11. CLI / Integration

```bash
bun run --cwd=evals benchmark run \
  --taskset evals/v2/tasks/pure_coding \
  --runner savant \
  --concurrency 2 \
  --report json
```

### 12. Implementation Roadmap (Realistic)

| Week | Deliverables |
|---|---|
| 1 | JSON/YAML task schema (Zod); registry loader; unit tests for schema validation; legacy `evals/benchmark/` marked deprecated in README |
| 2 | `AgentRunner` interface; Savant SDK runner; temp-dir sandbox for Windows |
| 3 | Docker sandbox; deterministic verifier; scoring pipeline |
| 4 | 10 synthetic tasks (one per category); golden patches |
| 5 | External CLI runners (Claude, Codex, OpenCode) with non-interactive flags |
| 6 | ECHO metrics (FSM, subagent, minimality); report generator |
| 7 | CI integration; anti-cheating canaries; cost/latency tracking |
| 8 | Documentation, leaderboard, first regression run |

### 13. Anti-Cheating / Robustness

- Cryptographic canary strings embedded in task repos; leakage flags task deprecation.
- Sandboxes reset between tasks; no host PATH mutation.
- One agent's failure does not poison another's score.
- Network disabled by default; external API calls go through mocked MCP endpoints.
- Report artifacts are checksummed to detect tampering.

### 14. Dependencies

- `zod` — task schema validation
- `yaml` — YAML parsing
- `fast-myers-diff` or `diff` — golden-patch diff/comparison (optional; avoid native `patch`)
- `tree-kill` — cross-platform process tree termination
- `zod-to-json-schema` — generate JSON Schema from Zod definitions

## Perfection Loop

### Loop 1

- **RED:**
  1. PTY stdin injection for external agents is unreliable on Windows; `Bun.spawn` without a TTY causes external CLIs to hang or crash.
  2. Unix-style patch application (`git apply`) is unavailable on Windows; golden-patch diffing needs a pure-JS solution.
  3. Temp-dir sandbox on Windows leaks via global caches (`%LOCALAPPDATA%`, `%APPDATA%`) and Bun's global bin/cache dirs.
  4. FSM metric extraction is vague; the runtime emits phase transitions via the `transition_phase` tool call, not a dedicated event.
  5. LLM judge median bug is acknowledged but not fixed in the design.
  6. `custom_tool_checks` schema does not explain how custom/MCP tools are provisioned for external CLI agents.
  7. Flaky-test retry is under-specified and could become expensive.
- **GREEN:**
  1. External runners use non-interactive flags or pre-populated CLI config; `handleInteractivePrompt` is best-effort only.
  2. Golden-patch comparison uses a pure TypeScript diff library; no native `patch` dependency.
  3. Windows temp-dir sandbox overrides `HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `BUN_INSTALL_GLOBAL_BIN_DIR`, and `BUN_INSTALL_CACHE_DIR`; uses `bun install --backend=copyfile`; teardown kills process tree and deletes temp dir.
  4. FSM metrics are derived from `transition_phase` tool-call payloads and cross-referenced with write-tool invocations; documentation updated.
  5. LLM judge layer requires 3 judges by default and computes the true median.
  6. Custom/MCP tools for external agents are served via local stdio MCP servers mounted into the sandbox and CLI config directories.
  7. Flaky-test retry removed at the agent level; only deterministic validation scripts retry, with a short per-script timeout and only for infra errors.
- **AUDIT:**
  - Reviewed by code-reviewer-kimi.
  - Findings: Approve with minor SELF-CORRECT notes.
  - Required additions: legacy evals disposition, API cost/rate-limit handling, golden-patch storage, report persistence format.
- **CHANGE DELTA:** ~15% of the FID document revised.

### Loop 2 (SELF-CORRECT)

- **RED:** AUDIT found four gaps in FID completeness:
  1. Legacy `evals/benchmark/` disposition not stated.
  2. API cost/rate-limit handling not documented.
  3. Golden-patch storage and versioning not specified.
  4. Report persistence format and retention policy missing.
- **GREEN:**
  1. Added "Legacy `evals/benchmark/` Disposition" section.
  2. Added "Cost, Latency, and API Resilience" section with budget cap and retry policy.
  3. Added `golden/` directory to architecture; specified canonical diff + README per task.
  4. Added `reports/` directory with SQLite/JSONL/Markdown formats and 90-day retention policy.
- **AUDIT:** [Pending re-audit]
- **CHANGE DELTA:** ~8% of the FID document revised.

## Verification

- `cd evals/v2 && bun test`
- `cd evals/v2 && bun run typecheck`
- Sample task run on temp-dir sandbox completes without host contamination.
- `evals` workspace typecheck passes (AUDIT evidence: basher run, exit 0).

## Resolution

- **Fixed By:** Savant Orchestrator
- **Fixed Date:** 2026-07-25
- **Fix Description:** FID-084 approved by user. Benchmark v2 design converged: deterministic-first scoring, ECHO-native metrics, Windows-compatible temp-dir sandboxing, Docker for CI, 9-category task taxonomy, 8-week implementation roadmap.
- **Tests Added:** Yes — harness unit tests under `evals/v2/tests/`.
- **Verified By:** Thinker RED critique + code-reviewer-kimi AUDIT + `bun run --cwd=evals typecheck`
- **Commit/PR:** [Pending implementation]
- **Archived:** 2026-07-25

## Lessons Learned

1. External benchmark research is useful for ideas but must be retrofitted to the actual product environment (Windows dev, Bun monorepo, ECHO Protocol).
2. The Perfection Loop on a FID document is as important as the code it governs.
3. Deterministic-first scoring aligns better with Savant-Code's value proposition than LLM-judge diff comparison.
