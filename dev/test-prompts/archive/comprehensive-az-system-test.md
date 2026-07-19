# Savant-Code — Comprehensive A-Z System Test v3 (FID-008 Edition)

**Purpose:** Exhaustive functional test of every FID-008 fix, plus regression coverage for items that were FAIL/CAVEAT/N/A in v2.

**Version:** 3.0 — post-FID-008 implementation. Focus: verify the 10 fixes from FID-008 actually work in a live session, plus clear the N/A backlog from v2.

**Previous round:** `dev/test-prompts/archive/comprehensive-az-system-test-v2.md` (246 items → 83 PASS, 5 FAIL, 7 CAVEAT, 151 N/A).

**Mode:** Interactive live execution. You MUST call every tool and agent listed below. Report PASS/FAIL for each with evidence. Do not skip any item.

**Environment:** The test runs inside the Savant CLI. Assume the ECHO Protocol is active. Where tmux-cli or live CLI is required (Phases 7-8), spawn a tmux-cli subagent and drive the UI.

---

## PHASE 1: BOOT, IDENTITY & DOCUMENTATION DRIFT

### 1.1 Boot Sequence
| # | Test | Expected |
|---|------|----------|
| 1 | Verify ECHO.md loaded as system prompt | First line: "ECHO PROTOCOL v0.2.0 — Savant Agent Bootstrap" |
| 2 | Verify protocol.config.yaml read | Report `strictMode`, `language`, scan open FIDs |
| 3 | Verify dev/fids/ scanned | List open FIDs by filename |
| 4 | Verify IDLE phase after boot | Phase shows "idle" |
| 5 | Verify bun + node versions via basher | Returns version strings |

### 1.2 Documentation Drift Verification (FID-008 Fix 4)
| # | Test | Expected |
|---|------|----------|
| 6 | Read ECHO.md agent roster (lines ~53-63) | Orchestrator shows `write_file, str_replace` + `apply_patch, bash, sequentialthinking` as restricted |
| 7 | ECHO.md Verifier row | Shows `*(no tools)*` + `ALL write tools` as restricted |
| 8 | ECHO.md Scout row | Shows `glob, list_directory, read_files, read_subtree, set_output` |
| 9 | Read ARCHITECTURE.md agent table (lines ~19-29) | Matches ECHO.md exactly |
| 10 | Verify SoD table in ECHO.md | Says "Orchestrator cannot write *source code files* (delegated to Forge). Can write to scratchpad, FIDs, Nova paths." |
| 11 | Grep source for `file-picker` references | **0 matches** (FID-006 renamed) |
| 12 | Grep source for `code-reviewer-mimo-pro` references | **0 matches** (FID-006 consolidated) |

---

## PHASE 2: AGENT ROSTER & SEPARATION OF DUTIES

### 2.1 Spawnable Agents (re-test v2 FAIL items)
| # | Agent | Test | Expected |
|---|-------|------|----------|
| 13 | `detective` | Spawn with code_search task | Returns search results (NOT "not available to spawn") |
| 14 | `scout` | Spawn with file-finding task | Returns file paths (NOT crash, NOT "not available") |
| 15 | `thinker` (or `thinker-with-files-gemini`) | Spawn with reasoning task | Returns analysis |
| 16 | `verifier` | Spawn with code review | Returns review |
| 17 | `recorder` | Spawn with FID listing | Returns data |
| 18 | `scribe` | Spawn with summary | Returns summary |
| 19 | `forge` | Spawn with write task (GREEN) | Returns confirmation |
| 20 | `researcher-web` | Spawn with search | Results OR network error |
| 21 | `researcher-docs` | Spawn with doc lookup | Docs OR backend error |

### 2.2 Orchestrator Tool Set (FID-008 Fix 10)
| # | Test | Expected |
|---|------|----------|
| 22 | Orchestrator HAS `write_file` in toolNames | In base2.ts |
| 23 | Orchestrator HAS `str_replace` in toolNames | In base2.ts |
| 24 | Orchestrator does NOT have `apply_patch` in toolNames | Not present |
| 25 | Orchestrator DOES have `set_output` in toolNames | Present |
| 26 | Orchestrator DOES have `transition_phase` | Present |

### 2.3 Separation of Duties (SoD enforcement)
| # | Agent | Test | Expected |
|---|-------|------|----------|
| 27 | Detective | Try `write_file` | BLOCKED: not in toolNames |
| 28 | Verifier | Try any tool | BLOCKED: toolNames=[] |
| 29 | Forge | Try `spawn_agents` | BLOCKED: not in toolNames |
| 30 | Scout | Try `write_file` | BLOCKED: not in toolNames |
| 31 | Orchestrator | Try `apply_patch` | BLOCKED: not in toolNames |
| 32 | Detective | Try `run_terminal_command` | BLOCKED: not in toolNames |
| 33 | Verifier depth: spawn from Verifier | BLOCKED | Verifier has no spawn capability |

---

## PHASE 3: FSM INTEGRITY & ESCAPE HATCHES (FID-008 Fix 9)

### 3.1 Standard Forward Path (regression)
| # | Test | Expected |
|---|------|----------|
| 34 | `idle → red → green → audit → complete → idle` | All succeed |
| 35 | `audit → self_correct → green → audit → complete → idle` | All succeed |
| 36 | `idle → audit` (ILLEGAL) | FAIL: "INVALID FSM transition" |
| 37 | `idle → green` (ILLEGAL) | FAIL: "INVALID FSM transition" |
| 38 | `audit → green` (ILLEGAL) | FAIL: "INVALID FSM transition" |
| 39 | `complete → red` (ILLEGAL — no skip from complete) | FAIL: "INVALID FSM transition" |

### 3.2 NEW: Escape Hatches (FID-008 F9a)
| # | Test | Expected |
|---|------|----------|
| 40 | `idle → red → idle` (abort from red) | SUCCEEDS |
| 41 | `idle → red → green → idle` (abort from green) | SUCCEEDS |
| 42 | `green → audit → idle` (abort from audit) | SUCCEEDS |
| 43 | `audit → self_correct → idle` (abort from self_correct) | SUCCEEDS |
| 44 | `complete → idle` (cycle reset) | SUCCEEDS (already existed) |
| 45 | `green → idle` then `idle → green` | SUCCEEDS — full abort + re-enter works |

### 3.3 NEW: Auto-Reset on New User Message (FID-008 F9b)
| # | Test | Expected |
|---|------|----------|
| 46 | `transition_phase` to green, then send new user message | Phase shows "idle" after message send |
| 47 | Transition phase 5x in a row, then send new message | Phase resets to "idle" |
| 48 | Send 3 messages in a row without explicit reset | Phase stays "idle" between each |
| 49 | `green → idle` then send message | Phase stays "idle" (no regression) |

### 3.4 NEW: iterationCount Reset (FID-008 F9 Q16)
| # | Test | Expected |
|---|------|----------|
| 50 | Self-correct cycle 3 times, transition to `idle` | iterationCount = 0 after idle |
| 51 | Hard-stop at 10 iterations, then transition to `complete` | iterationCount resets to 0 |
| 52 | `complete → idle`, then create new FID, `idle → green` | New cycle starts fresh (iterationCount = 0) |

---

## PHASE 4: PATH GATING & SCRATCHPAD (FID-008 F2 + F8)

### 4.1 Path Exemptions
| # | Phase | Path | Expected |
|---|-------|------|----------|
| 53 | IDLE | `dev/fids/test-008-v3.md` | SUCCEEDS (FID exempt) |
| 54 | RED | `dev/fids/test-008-v3-2.md` | SUCCEEDS (no phase restriction for exempt paths) |
| 55 | AUDIT | `dev/fids/test-008-v3-3.md` | SUCCEEDS (exempt regardless of phase) |
| 56 | IDLE | `dev/nova/outbox/test-v3.md` | SUCCEEDS (Nova exempt) |
| 57 | IDLE | `dev/scratchpad/test-v3.txt` | SUCCEEDS (scratchpad exempt) |

### 4.2 Source Code Gate (must remain enforced)
| # | Phase | Path | Expected |
|---|-------|------|----------|
| 58 | IDLE | `agents/scout/scout.ts` | BLOCKED: "only available during GREEN" |
| 59 | IDLE | `src/index.ts` (any source code) | BLOCKED |
| 60 | IDLE | `packages/agent-runtime/src/tools/tool-executor.ts` | BLOCKED |
| 61 | RED | `agents/scout/scout.ts` | BLOCKED |
| 62 | AUDIT | `agents/scout/scout.ts` | BLOCKED |
| 63 | GREEN | `agents/scout/scout.ts` | SUCCEEDS (only GREEN allows source writes) |
| 64 | GREEN | `src/index.ts` | SUCCEEDS (source writes allowed in GREEN) |

### 4.3 NEW: Path Normalization Security (Q8)
| # | Path | Expected |
|---|------|----------|
| 65 | `dev/scratchpad/../agents/scout/scout.ts` | BLOCKED (normalizes to `agents/scout/scout.ts`) |
| 66 | `dev/scratchpad/foo/../../bar` | BLOCKED (escapes scratchpad) |
| 67 | `dev/fids/../packages/runtime/x.ts` | BLOCKED (escapes FID exemption) |
| 68 | `dev/scratchpad/./../../src/index.ts` | BLOCKED (double-encoded) |
| 69 | `dev\\scratchpad\\..\\src\\index.ts` (Windows backslashes) | BLOCKED (backslashes normalized) |
| 70 | Absolute path `/repo/dev/scratchpad/test.txt` | Behavior depends on implementation — verify normalized correctly |
| 71 | `dev/scratchpad/../../../etc/passwd` | BLOCKED |

### 4.4 Orchestrator Write Sources (FID-008 F9 Q-via-Q18)
| # | Agent | Phase | Path | Expected |
|---|-------|-------|------|----------|
| 72 | Orchestrator | IDLE | `dev/scratchpad/notes.md` | SUCCEEDS |
| 73 | Orchestrator | RED | `dev/scratchpad/notes.md` | SUCCEEDS (exempt path) |
| 74 | Orchestrator | IDLE | `dev/fids/FID-test-v3.md` | SUCCEEDS |
| 75 | Orchestrator | IDLE | `dev/nova/outbox/test.md` | SUCCEEDS |
| 76 | Orchestrator | GREEN | `agents/scout/scout.ts` | TECHNICALLY SUCCEEDS in tool-executor (Orchestrator has write tools + GREEN phase allows), BUT system prompt should still delegate to Forge. **Verify prompt guidance enforced.** |

---

## PHASE 5: SCOUT CLOSURE FIX (FID-008 F1)

### 5.1 Basic Scenarios (regression)
| # | Test | Expected |
|---|------|----------|
| 77 | Spawn Scout: "Find files related to tool gating" | Returns paths |
| 78 | Spawn Scout: "Find MCP files" | Returns paths |
| 79 | Spawn Scout: "Find configuration files" | Returns paths |
| 80 | Spawn Scout: empty prompt | No crash |

### 5.2 NEW: Closure Bug Regression (Q3 — F1 verification)
| # | Test | Expected |
|---|------|----------|
| 81 | Spawn Scout: "Find agent definition files" | Returns paths, NO `extractKeywords is not defined` error |
| 82 | Spawn Scout: "Find transition phase files" | Returns paths, NO closure error |
| 83 | Spawn Scout: "Find FSM enforcement files" | Returns paths, NO closure error |
| 84 | Spawn Scout with multi-keyword prompt: "find auth service files" | Extracts `auth`, `service`, globs for both |
| 85 | Spawn Scout with stop-word prompt: "show me the database schema" | Strips `show`, `me`, `the`, extracts `database`, `schema` |

### 5.3 Bundled Agent Verification
| # | Test | Expected |
|---|------|----------|
| 86 | Grep `bundled-agents.generated.ts` for `extractKeywords` | Should NOT find module-scope closure references |
| 87 | Verify `handleSteps` inlined functions are self-contained | No external identifier references |

---

## PHASE 6: CORE TOOLS REGRESSION

### 6.1 Read Tools
| # | Tool | Test | Expected |
|---|------|------|----------|
| 88 | `read_files` | Read `package.json` + `ECHO.md` | Both returned |
| 89 | `read_subtree` | Read `agents/` (limited) | Tree with names + vars |
| 90 | `list_directory` | List `cli/src/` | File array |
| 91 | `glob` | Find `*.ts` in `agents/` | Matching paths |
| 92 | `code_search` | Search `fsmPhase` in `packages/agent-runtime/` | Lines returned |

### 6.2 Bash/Write Tool Gating (regression of v2 partial coverage)
| # | Phase | Tool | Path | Expected |
|---|-------|------|------|----------|
| 93 | IDLE | `run_terminal_command` (via basher) | n/a | BLOCKED: "only AUDIT phase" |
| 94 | GREEN | `run_terminal_command` (via basher) | n/a | BLOCKED: "only AUDIT phase" |
| 95 | AUDIT | `run_terminal_command` | `echo test` | SUCCEEDS |
| 96 | AUDIT | `run_terminal_command` | `bun --version` | Returns version |

### 6.3 UI Widgets (regression)
| # | Test | Expected |
|---|------|----------|
| 97 | `render_ui` button | "UI rendered." |
| 98 | `render_ui` table | "UI rendered." |
| 99 | `render_ui` card | "UI rendered." |
| 100 | `render_ui` perfection_loop widget | "UI rendered." |
| 101 | `render_ui` stepper widget | "UI rendered." |
| 102 | `render_ui` badge widget | "UI rendered." |

### 6.4 Suggestion + Skill
| # | Test | Expected |
|---|------|----------|
| 103 | `suggest_followups` for "implement auth" | Returns suggestions |
| 104 | `skill` load `coding-typescript` | Returns SKILL.md content |
| 105 | `skill` load `release-workflow` | Returns SKILL.md content |
| 106 | `skill` load `sequential-thinking` | Returns thinking skill |
| 107 | `skill` load `fake-skill-xyz` | Graceful error |

---

## PHASE 7: LIVE ENVIRONMENT — SLASH COMMANDS (via tmux-cli)

> **Note:** Requires `tmux-cli` subagent. Spawn it, pipe inputs, read stdout buffer.

### 7.1 Universal Commands
| # | Command | Expected |
|---|---------|----------|
| 108 | `/help` | Shows shortcuts + tips |
| 109 | `/new` | Clears conversation |
| 110 | `/history` | Conversation browser visible |
| 111 | `/theme:toggle` | Toggles theme |
| 112 | `/logout` (if logged in) | Signs out |
| 113 | `/exit` | Quits CLI |
| 114 | `help` (no slash) | Same as `/help` |

### 7.2 Skill Commands
| # | Command | Expected |
|---|---------|----------|
| 115 | `/skill:coding-python` | Loads Python skill |
| 116 | `/skill:coding-rust` | Loads Rust skill |
| 117 | `/skill:coding-go` | Loads Go skill |

### 7.3 Mode-Specific
| # | Command | Mode | Expected |
|---|---------|------|----------|
| 118 | `/plan` | Codebuff | "Command not found" or "Freebuff-only note" |
| 119 | `/plan` | Freebuff | Plans mode activated |
| 120 | `/connect` | Freebuff | Connects OR "not available" |
| 121 | `/end-session` | Freebuff | Ends free session |

---

## PHASE 8: LIVE ENVIRONMENT — DEV OVERRIDE (via tmux-cli)

### 8.1 Activation
| # | Test | Expected |
|---|------|----------|
| 122 | Type `/dev wrong-passphrase` | "Command not found" |
| 123 | Type `/dev echo-alpha-7749` | "Dev override activated." |
| 124 | Verify red `[DEV MODE]` badge in sidebar | Badge visible |
| 125 | Type `/dev off` | "Dev override deactivated." |
| 126 | Verify badge disappears | No badge |

### 8.2 Bypass Verifications
| # | Phase | Tool | Path | Expected (with dev on) |
|---|-------|------|------|----------|
| 127 | IDLE | `write_file` | any non-exempt path | SUCCEEDS (bypassed) |
| 128 | IDLE | `str_replace` | any path | SUCCEEDS (bypassed) |
| 129 | IDLE | `run_terminal_command` (basher) | bash | SUCCEEDS (bypassed) |
| 130 | IDLE | `sequentialthinking` (orchestrator) | n/a | Blocked even with dev override |

### 8.3 Persistence & Reset
| # | Test | Expected |
|---|------|----------|
| 131 | Dev active, type `/new` | Dev mode resets |
| 132 | Verify badge gone after `/new` | No badge |
| 133 | `write_file` blocked again after `/new` in IDLE | BLOCKED: "only GREEN phase" |

### 8.4 Invisibility
| # | Test | Expected |
|---|------|----------|
| 134 | `/help` — verify `/dev` NOT listed | Absent |
| 135 | `/dev` with no args | "Command not found" |

---

## PHASE 9: EDGE CASES & SYSTEM STATE

### 9.1 Knowledge Files
| # | File | Expected |
|---|------|----------|
| 136 | ECHO.md loaded | Referenced in system prompt |
| 137 | ARCHITECTURE.md loaded | Referenced |
| 138 | LEARNINGS.md loaded | Referenced |

### 9.2 Skills System (regression + clarity)
| # | Test | Expected |
|---|------|----------|
| 139 | `.agents/skills/` directory count | **7 directories** (clarified in FID-008 F5) |
| 140 | `skill` tool reports total available | **11 skills** (7 dirs + 4 preloaded) |
| 141 | Skills 1-7 are in `.agents/skills/` | Confirmed |
| 142 | Skills 8-11 (sequential-thinking, find-skills, gepeto, pinokio) are preloaded | Confirmed |

### 9.3 Nova Communication
| # | Test | Expected |
|---|------|----------|
| 143 | List `dev/nova/inbox/` | Has `archive/` subdirectory |
| 144 | List `dev/nova/outbox/` | Has `archive/` subdirectory |
| 145 | Write to `dev/nova/outbox/` (via Orchestrator write_file) | SUCCEEDS (exempt path, FID-008 F8) |

---

## PHASE 10: PERFECTION LOOP & CROSS-PACKAGE VERIFICATION

### 10.1 Full Loop with FID-008 Features
| # | Step | Expected |
|---|------|----------|
| 146 | Start IDLE, transition through full loop | All succeed |
| 147 | Verify fsmPhase sidebar updates on each transition | UI shows phase in real-time |
| 148 | Test loop abort from `green → idle` then restart | Loop converges cleanly |
| 149 | Write FID via Orchestrator write_file to `dev/fids/` in IDLE | SUCCEEDS (exempt path) |
| 150 | Run full loop, land in `complete → idle` | Clean state, iterationCount = 0 |

### 10.2 Cross-Package Typecheck (via basher)
| # | Command | Expected |
|---|---------|----------|
| 151 | `bun run --cwd=agents typecheck` | Zero errors |
| 152 | `bun run --cwd=packages/agent-runtime typecheck` | Zero errors |
| 153 | `bun run --cwd=cli typecheck` | Zero errors |
| 154 | `bun run --cwd=common typecheck` | Zero errors |
| 155 | `bun run --cwd=sdk typecheck` | Zero errors |

---

## REPORTING FORMAT

```
[T] PHASE — PASS/FAIL/CAVEAT/N/A — Evidence
```

### Summary Table (populate)

| Phase | Category | Total | Pass | Fail | Caveat | N/A |
|-------|----------|-------|------|------|--------|-----|
| 1 | Boot & Doc Drift | 12 | | | | |
| 2 | Roster & SoD | 21 | | | | |
| 3 | FSM Esc Hatches & Reset | 19 | | | | |
| 4 | Path Gating & Scratchpad | 24 | | | | |
| 5 | Scout Closure Fix | 11 | | | | |
| 6 | Core Tools Regression | 20 | | | | |
| 7 | Slash Commands (tmux) | 14 | | | | |
| 8 | Dev Override (tmux) | 14 | | | | |
| 9 | Edge Cases & State | 10 | | | | |
| 10 | Loop & Typecheck | 10 | | | | |
| **TOTAL** | | **155** | | | | |

---

## CHANGES vs v2

| v2 Item | v3 Disposition |
|---------|----------------|
| PHASE 1 (7) Boot | Kept, expanded to 12 with doc drift verification |
| PHASE 2 (70) Direct Tools | Pruned from 70 to 20 (focused on regressions) |
| PHASE 3 (19) Dev Override | Kept, now exercisable via tmux-cli |
| PHASE 4 (26) Slash Commands | Kept, now exercisable via tmux-cli |
| PHASE 5 (25) Agent Roster | Pruned from 25 to 21 (removed stale name refs) |
| PHASE 6 (18) Scout | Pruned from 18 to 11 (focused on FID-008 F1) |
| PHASE 7 (16) MCP Timeout | **Removed** (already verified in v2) |
| PHASE 8 (6) FSM Inheritance | Merged into PHASE 3 (expanded to 19 with escape hatches) |
| PHASE 9 (16) Perfection Loop | Pruned to 10, merged into PHASE 10 |
| PHASE 10 (11) Integration | **Removed** (Smoke covered in other phases) |
| PHASE 11 (5) Nova | Pruned to 3, merged into PHASE 9 |
| PHASE 12 (12) Skills | Pruned to 4, merged into PHASE 9 |
| PHASE 13 (5) CLI Edge | **Removed** (edge cases covered in tmux phases) |
| PHASE 14 (5) Knowledge | Pruned to 3, merged into PHASE 9 |
| PHASE 15 (5) Typecheck | Kept, merged into PHASE 10 |

**Reduction rationale:** v2 had 246 items with massive redundancy. v3 keeps the load-bearing tests for FID-008 verification and the previously-FAIL/CAVEAT items. Total: 246 → 155 (-37%) with HIGHER signal density.

---

## CRITICAL RULES

1. **Do not skip any test.** Every item must be attempted.
2. **Capture exact errors.** Do not paraphrase error messages.
3. **Test FID-008 explicitly.** Phase 3 (hatches/reset) and Phase 4 (path/security) are the load-bearing tests.
4. **Test security vectors.** Phase 4.3 (path normalization) MUST be attempted — these are the regression tests for Q8 traversal bug.
5. **Use tmux-cli for live UI tests.** Phases 7-8 cannot be run from orchestrator alone — spawn tmux-cli subagent.
6. **Clean up after yourself.** Delete test files you create in `dev/fids/`, `dev/nova/`, `dev/scratchpad/`.
7. **Report honestly.** PASS-WITH-CAVEAT if needed.
