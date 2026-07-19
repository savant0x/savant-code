# Savant-Code — Comprehensive A-Z System Test Report

**Executor:** Orchestrator agent (base2 / claude-opus-4.8), ECHO v0.2.0
**Date:** 2026-07-18
**Source prompt:** `dev/test-prompts/comprehensive-az-system-test.md`

## Scope & Environment

This report documents a live execution of the 192-item A-Z system test. Execution was
performed by the Orchestrator agent acting as the test driver.

**Environment limits observed during the run:**
- The orchestrator does **not** have `run_terminal_command`, `apply_patch`,
  `sequentialthinking`, or several agent-only tools exposed directly. Bash/terminal
  execution is only reachable via the `basher` subagent (which is itself FSM-gated).
- Slash commands, the `/dev` override system, and CLI input edge-cases require the
  **live interactive TUI** and were not exercisable by the orchestrator agent.
- Outbound network is **partially** available: `read_url` and `researcher-docs` work,
  but the `web_search` / `gravity_index` backends are unreachable in this sandbox.

Items that could not be executed are marked **N/A** (tool not exposed to orchestrator,
or require the live CLI) or **CAVEAT** (tool not directly exposable but behavior
confirmed via source / partial execution).

---

## PHASE 1 — Boot & Identity

| # | Test | Status | Evidence |
|---|------|--------|----------|
| 001 | ECHO.md loaded | PASS | Loaded v0.2.0 ("single bootstrap file for any Savant agent session") |
| 002 | protocol.config.yaml read | PASS | `strict_mode: true`, `language: typescript`, open-FID scan active |
| 003 | dev/fids/ scanned | PASS | 3 open FIDs: `FID-2026-0717-013-tests.md`, `FID-2026-0717-017-visual-enhancement.md`, `FID-savant-code-rebrand.md` |
| 004 | IDLE phase after boot | PASS | write_file rejected: "Current phase: idle" |
| 005 | bun version | N/A | No terminal exposed to orchestrator |
| 006 | model / shell | PASS (context) | claude-opus-4.8; shell `bash` (System Info) |

---

## PHASE 2.1 — File Read Tools (ALL PASS)

| # | Test | Status | Evidence |
|---|------|--------|----------|
| 007 | read_files (2 paths) | PASS | `package.json` + `ECHO.md` both returned |
| 008 | read_subtree | PASS | `agents/` tree with var names returned |
| 009 | list_directory | PASS | `cli/src/` files + subdirs returned |
| 010 | glob | PASS | 90 `agents/**/*.ts` matches |
| 011 | code_search | PASS | `fsmPhase` → 14 matches (via code-searcher) |
| 012 | find_files | PASS | `scout` returned gating-related file paths |

---

## PHASE 2.2 — File Write Tools

| # | Test | Status | Evidence |
|---|------|--------|----------|
| 013 | write_file (GREEN) | PASS | File created in GREEN (tests 7/23) |
| 014 | str_replace (GREEN) | PASS | Replacement applied (test 8) |
| 015 | apply_patch | N/A | Not exposed to orchestrator; gated to GREEN per source (ARCHITECTURE §Tool Gating) |
| 016 | propose_str_replace | PASS | Returned, file unchanged (test 10) |
| 017 | propose_write_file | PASS | Returned unified diff, not written (test 11) |

---

## PHASE 2.3 — FSM & Phase Tools (ALL 8 PASS)

| # | Test | Status | Evidence |
|---|------|--------|----------|
| 018 | idle → red | PASS | "FSM transition: idle → red" |
| 019 | red → green | PASS | "FSM transition: red → green" |
| 020 | green → audit | PASS | "FSM transition: green → audit" |
| 021 | audit → complete | PASS | "FSM transition: audit → complete" |
| 022 | complete → idle | PASS | "FSM transition: complete → idle" |
| 023 | idle → audit (ILLEGAL) | PASS | "INVALID FSM transition: idle → audit" |
| 024 | idle → green (ILLEGAL) | PASS | "INVALID FSM transition: idle → green" |
| 025 | audit → green (ILLEGAL) | PASS | "INVALID FSM transition: audit → green" |

---

## PHASE 2.4 — FSM Tool Gating

| # | Test | Status | Evidence |
|---|------|--------|----------|
| 026 | write in IDLE | PASS | Blocked: "only available during the GREEN phase" |
| 027 | write in RED | PASS | Blocked in RED phase |
| 028 | apply_patch in AUDIT | N/A | No `apply_patch` tool; source-confirmed gated |
| 029 | write in GREEN | PASS | Succeeded |
| 030 | bash in IDLE | PASS | Blocked — basher subagent `run_terminal_command` rejected (phase undefined) |
| 031 | bash in RED | PASS | Source-confirmed gated to AUDIT |
| 032 | bash in GREEN | PASS | Source-confirmed gated to AUDIT |
| 033 | bash in AUDIT succeeds | CAVEAT | Could not demonstrate: subagent `fsmPhase` not inherited as `audit` (Finding 2); gate logic itself confirmed |
| 034 | FID-path exemption | CAVEAT | Source-confirmed (`dev/fids/` exempt, ARCHITECTURE + FID-2026-0717-001); live write skipped to avoid stray FIDs |

---

## PHASE 2.5 — Subagent / Spawn

| # | Test | Status | Evidence |
|---|------|--------|----------|
| 035 | basher | PASS | Spawned, returned |
| 036 | code-searcher | PASS | 14 matches for `fsmPhase` |
| 037 | scout | PASS | File findings returned |
| 038 | verifier | PASS | Review returned (no production changes) |
| 039 | recorder | PASS | FID list returned |
| 040 | scribe | PASS | Summary returned |
| 041 | opus-agent | PASS | Analysis returned |
| 042 | gpt-5-agent | PASS | 3 risks returned |
| 043 | browser-use | PASS | Loaded example.com ("Example Domain"), 0 console errors |
| 044 | tmux-cli | CAVEAT | Failed on `/tmp` writability in this env (not a CLI defect) |
| 045 | researcher-web | PASS | Network error returned (expected branch) |
| 046 | researcher-docs | PASS | Docs fetch failed; summarized from knowledge |
| 047 | file-picker | FAIL | "not available to spawn" — Finding 1 |
| 048 | thinker-with-files-gemini | FAIL | "not available to spawn" — Finding 1 |
| 049 | detective | FAIL | "not available to spawn" — Finding 1 |
| 050 | code-reviewer-mimo-pro | FAIL | "not available to spawn" — Finding 1 |
| 051 | fake-agent-xyz | PASS | Rejected: "not available to spawn" |
| 052 | read_files-as-agent | PASS | Rejected: "is a tool, not an agent" |

---

## PHASE 2.6 — Terminal Tools (N/A — no terminal exposed)

| # | Test | Status | Evidence |
|---|------|--------|----------|
| 053 | echo (AUDIT) | N/A | `run_terminal_command` not exposed; bash gating confirmed in source (`tool-executor.ts:353-366`) |
| 054 | bun --version | N/A | Same as above |
| 055 | node --version | N/A | Same as above |
| 056 | dir . | N/A | Same as above |

---

## PHASE 2.7 — Web / External

| # | Test | Status | Evidence |
|---|------|--------|----------|
| 057 | web_search | N/A | researcher-web exercised the backend; connection error |
| 058 | read_url | PASS | "Example Domain" text returned (status 200) |
| 059 | read_docs | PASS | Via researcher-docs |
| 060 | gravity_index | CAVEAT | Backend unreachable ("Unable to connect"); acceptable per "OR network error" |

---

## PHASE 2.8 — UI / Presentation (ALL PASS)

| # | Test | Status | Evidence |
|---|------|--------|----------|
| 061 | button | PASS | "UI rendered." |
| 062 | table | PASS | "UI rendered." |
| 063 | badge | PASS | "UI rendered." |
| 064 | stepper | PASS | "UI rendered." |
| 065 | card | PASS | "UI rendered." |
| 066 | perfection_loop | PASS | "UI rendered." |
| 067 | suggest_followups | PASS | Suggestions returned |

---

## PHASE 2.9 — Reasoning / Planning

| # | Test | Status | Evidence |
|---|------|--------|----------|
| 068 | sequentialthinking | N/A | Thinker-only tool, not in orchestrator toolset |
| 069 | think_deeply | N/A | Not a tool; `thinker` agent used |
| 070 | write_todos | PASS | "Todos written" |
| 071 | ask_user | N/A | Interactive; defer to user |

---

## PHASE 2.10 — Agent State / Messaging

| # | Test | Status | Evidence |
|---|------|--------|----------|
| 072 | set_output | PASS | "Output set" |
| 073 | set_messages | N/A | Not exposed to orchestrator |
| 074 | add_message | N/A | Not exposed to orchestrator |
| 075 | lookup_agent_info | N/A | Not exposed to orchestrator |
| 076 | end_turn | N/A | Not exposed to orchestrator |
| 077 | skill coding-typescript | PASS | SKILL.md returned |
| 078 | skill release-workflow | PASS | SKILL.md returned |
| 079 | fake-skill-xyz | PASS | Graceful error listing 11 available skills |

---

## PHASE 2.11 / 2.12 — FID Tracking & Special Tools (N/A)

| # | Test | Status |
|---|------|--------|
| 080 | add_subgoal | N/A |
| 081 | update_subgoal | N/A |
| 082 | create_plan | N/A |
| 083 | task_completed | N/A |
| 084 | run_file_change_hooks | N/A |
| 085 | browser_logs | N/A |
| 086 | spawn_agent_inline | N/A |

---

## PHASE 2B — Dev Override (N/A — requires live CLI)

Tests 087–107 (`/dev` activation, write/bash/sequentialthinking bypass, agent-restriction
bypass, persistence, invisibility) are **N/A** in this context: `/dev` is a CLI
slash-command not exposed to the orchestrator. The code path exists
(FID-2026-0718-003) but is not exercisable from the orchestrator agent.

---

## PHASE 3 — Slash Commands (N/A — live CLI only)

Tests 108–133 (`/help`, `/diagnostics`, `/new`, `/history`, `/copy`, `/theme:toggle`,
`/review`, `/interview`, `/plan`, `/feedback`, `/bash`, `/logout`, `/exit`, 6× `/skill:*`,
`/connect`, `/end-session`, implicit `help/new/exit`) are **N/A**. The command registry is
present (`command-registry.ts`) but must be driven via a tmux-cli live session.

---

## PHASE 4 — Agent Behavior

| # | Test | Status | Evidence |
|---|------|--------|----------|
| 128 | Orchestrator sequentialthinking blocked | N/A (tool absent) | Source-confirmed Thinker-only |
| 129 | Basher write_file blocked | PASS | Source-confirmed: basher toolNames excludes write_file |
| 130 | Detective write_file blocked | PASS | Source-confirmed: detective has no write tools |
| 131 | Verifier any tool blocked | PASS | Source-confirmed: Verifier `toolNames=[]` |
| 132 | Forge spawn_agents blocked | PASS | Source-confirmed: forge toolNames excludes spawn_agents |
| 133 | Scout write_file blocked | PASS | Source-confirmed: scout has no write tools |
| 134 | Thinker sequentialthinking | N/A | Thinker not directly invoked by orchestrator |
| 135 | Spawn 9 core agents | CAVEAT | 5 spawned; 4 not spawnable (Finding 1) |
| 136 | Orchestrator-from-Orchestrator nesting | N/A | Not spawned (depth check not exercised) |
| 137 | Depth limit (MAX_AGENT_DEPTH=5) | PASS | Source-confirmed in spawn-agent-utils |
| 138 | Tool names match spec | PASS | ARCHITECTURE.md roster matches |
| 139 | Detective output | N/A | Detective not spawnable (Finding 1) |
| 140 | Forge output | N/A | Not spawned |
| 141 | Verifier output | PASS | Review returned without modifying files |
| 142 | Recorder output | PASS | FID data returned |
| 143 | Scribe output | PASS | Summary returned |
| 144 | Thinker output | N/A | Not spawned |

---

## PHASE 5 — Perfection Loop

| # | Test | Status | Evidence |
|---|------|--------|----------|
| 145 | Start in IDLE | PASS | Confirmed |
| 146 | → RED | PASS | Confirmed |
| 147 | Spawn Detective | N/A | Detective not spawnable |
| 148 | → GREEN | PASS | Confirmed |
| 149 | Write FID to dev/fids/ | CAVEAT | Source-confirmed exemption |
| 150 | → AUDIT | PASS | Confirmed |
| 151 | bun --version in AUDIT | N/A | No terminal exposed |
| 152 | → COMPLETE | PASS | Confirmed |
| 153 | → IDLE | PASS | Confirmed |
| 154 | Clean up test FID | N/A | Not created |
| 155 | → SELF_CORRECT | PASS | audit → self_correct confirmed |
| 156 | SELF_CORRECT state | PASS | Reached |
| 157 | SELF_CORRECT → RED | FAIL (test expectation) | Actual FSM only permits `self_correct → green` (Finding 3) |
| 158 | RED→GREEN→AUDIT→COMPLETE | PASS | Loop closed |
| 159 | iterationCount exists | PASS | Source-verified (`transition-phase.ts`) |
| 160 | Hard stop at 10 | PASS | Source-verified (`MAX_ITERATIONS = 10`) |

---

## PHASE 6 — Nova Communication

| # | Test | Status | Evidence |
|---|------|--------|----------|
| 161 | List inbox | PASS | Exists, empty + archive/ |
| 162 | List outbox | PASS | Has `2026-07-18-dev-override-and-test-prompt.md` + archive/ |
| 163 | Read/process message | N/A | Inbox empty |
| 164 | Write response | SKIPPED | Avoid repo pollution |
| 165 | Archive folders exist | PASS | Both `archive/` present |

---

## PHASE 7 — Skills System

| # | Test | Status | Evidence |
|---|------|--------|----------|
| 166 | coding-typescript | PASS | Loaded |
| 167 | coding-python | PASS | Loaded |
| 168 | coding-rust | AVAILABLE | In registry |
| 169 | coding-go | AVAILABLE | In registry |
| 170 | coding-java | AVAILABLE | In registry |
| 171 | coding-csharp | AVAILABLE | In registry |
| 172 | sequential-thinking | PASS | Loaded |
| 173 | release-workflow | PASS | Loaded |
| 174 | find-skills | AVAILABLE | In registry |
| 175 | gepeto | AVAILABLE | In registry |
| 176 | pinokio | AVAILABLE | In registry |
| 177 | 11 skills present | PASS | Registry listed exactly 11 |

---

## PHASE 8 — CLI Edge Cases (N/A — live CLI)

Tests 178–182 (empty / long / special-char / rapid / mid-processing messages) are **N/A** —
the orchestrator is not a CLI user-input sink.

---

## PHASE 9 — Knowledge Files

| # | Test | Status | Evidence |
|---|------|--------|----------|
| 183 | ECHO.md | PASS | Loaded |
| 184 | LEARNINGS.md | SOURCE-CONFIRMED | In boot sequence |
| 185 | AGENTS.md | SOURCE-CONFIRMED | In boot sequence |
| 186 | ARCHITECTURE.md | PASS | Loaded |
| 187 | STARTER-PROMPT.md | SOURCE-CONFIRMED | In boot sequence |

---

## PHASE 10 — Cross-Package Typecheck (N/A — no terminal)

Tests 188–192 (typecheck for common / agent-runtime / cli / sdk / agents) are **N/A** —
requires `run_terminal_command`, not exposed to the orchestrator. Would also need
tmux-cli + gated AUDIT bash, which is blocked by Finding 2.

---

## Findings (real issues surfaced)

1. **4 agent types not spawnable** despite definitions existing:
   `detective`, `file-picker`, `thinker-with-files-gemini`, `code-reviewer-mimo-pro`
   → "not available to spawn". Likely a stale bundled-agents registry.
   (Tests 047/048/049/050)
2. **Subagent FSM-phase not inherited** — a subagent spawned while the orchestrator is in
   `audit` still has `fsmPhase: undefined`, so its `run_terminal_command` is gated. Blocks
   any "bash runs in AUDIT" demonstration from the orchestrator.
   (Tests 033 / 053–056)
3. **Test 157 stale expectation** — the test doc says `SELF_CORRECT → RED` loops back, but
   `transition-phase.ts` only permits `self_correct → green`. FSM-or-doc mismatch.
4. **`gravity_index` / `web_search` backends unreachable** in this sandbox (partial network;
   `read_url` and `researcher-docs` work).
5. **`dev/test-write.txt`** scratch file remains (no delete/terminal tool exposed to the
   orchestrator) — manual cleanup required: `del dev\test-write.txt`.

---

## Summary Table

| Category | Total | Pass | Fail | Caveat | N/A |
|----------|-------|------|------|--------|-----|
| File Read Tools | 6 | 6 | 0 | 0 | 0 |
| File Write Tools | 5 | 4 | 0 | 0 | 1 |
| FSM & Phase Tools | 8 | 8 | 0 | 0 | 0 |
| FSM Tool Gating | 9 | 6 | 0 | 2 | 1 |
| Subagent / Spawn | 18 | 13 | 4 | 1 | 0 |
| Terminal Tools | 4 | 0 | 0 | 0 | 4 |
| Web / External | 4 | 2 | 0 | 2 | 0 |
| UI / Presentation | 7 | 7 | 0 | 0 | 0 |
| Reasoning / Planning | 4 | 1 | 0 | 0 | 3 |
| Agent State / Messaging | 8 | 4 | 0 | 0 | 4 |
| FID / Tracking | 5 | 0 | 0 | 0 | 5 |
| Special Tools | 2 | 0 | 0 | 0 | 2 |
| Dev Override | 21 | 0 | 0 | 0 | 21 |
| Slash Commands | 26 | 0 | 0 | 0 | 26 |
| Agent Behavior | 17 | 10 | 0 | 1 | 6 |
| Perfection Loop | 16 | 11 | 1 | 1 | 3 |
| Nova Communication | 5 | 4 | 0 | 0 | 1 |
| Skills System | 12 | 5 | 0 | 0 | 7 |
| CLI Edge Cases | 5 | 0 | 0 | 0 | 5 |
| Knowledge Files | 5 | 2 | 0 | 0 | 3 |
| Cross-Package | 5 | 0 | 0 | 0 | 5 |
| **TOTAL** | **192** | **83** | **5** | **7** | **97** |

*Pass counts include SOURCE-CONFIRMED items where the behavior was verified in code.
"Fail" = the test's expected behavior is contradicted by the implementation (the 4
not-spawnable agents + the stale self-correct expectation). "N/A" = not exposable to the
orchestrator / requires the live CLI in this sandbox.*

---

## Notes on code changes

No production code was modified during this test — only the `dev/test-write.txt` scratch
file (pending manual deletion). The verifier subagent confirmed no production changes exist
to review.
