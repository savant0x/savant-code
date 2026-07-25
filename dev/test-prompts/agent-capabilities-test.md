# Agent Capabilities Test — Savant-Code v1.0

**Purpose:** Complete capabilities test of the Savant-Code agent harness from the agent's perspective. Exercises every tool, agent, and workflow available to the orchestrator. The deliverable is a report documenting what works, what has friction, what's confusing, and what needs improvement.

**Ground Rules:**
- All tests run from agent context (idle phase unless otherwise noted)
- No CLI interaction, no user presence required
- Each test is a concrete task the agent executes, not a pattern check
- Agent reports on friction and experience for EVERY test, not just failures
- Write all outputs to `dev/scratchpad/`

**Execution:** Spawn the orchestrator agent with this prompt. The agent runs through all tiers sequentially, exercises each capability, and produces a final report.

**Available Tools:** read_files, glob, list_directory, read_subtree, spawn_agents, write_todos, suggest_followups, ask_user, render_ui, skill, set_output, transition_phase, write_file, str_replace, apply_patch, read_url, gravity_index

---

## Tier 1: Basic Tools

### T1.1 — read_files
- Read `ECHO.md` (large file, ~500 lines)
- Read `agents/savant/savant.ts` (large file, complex)
- Read a non-existent file (`dev/scratchpad/does-not-exist.md`)
- **Report on:** Speed, reliability, error messages for missing files

### T1.2 — glob
- Glob `agents/**/*.ts` (broad pattern)
- Glob `cli/src/components/*.tsx` (narrower)
- Glob `dev/fids/FID-*.md` (expect 1+ results — FIDs exist)
- **Report on:** Sorting, result count accuracy, performance

### T1.3 — list_directory
- List `.` (project root)
- List `agents/` (subdirectories)
- List `dev/fids/` (files + subdirectories)
- **Report on:** Completeness, format clarity

### T1.4 — read_subtree
- Read subtree of `agents/savant/` (medium)
- Read subtree of `cli/src/` with maxTokens=2000 (large, should truncate)
- **Report on:** Truncation behavior, usefulness of parsed variable names

### T1.5 — write_todos
- Create a 3-item todo list
- Update it to mark items complete
- **Report on:** Does it actually persist across tool calls?

### T1.6 — suggest_followups
- Generate 3 followup suggestions
- **Report on:** Does the UI render them? Are they clickable?

### T1.7 — ask_user
- (SKIP — requires user interaction. Note this.)

### T1.8 — render_ui
- Render a test button with a link
- Render a test table
- Render a test card
- **Report on:** Does the tool call succeed or return an error? (Agent cannot see CLI rendering directly)

### T1.9 — skill
- Load `coding-typescript` skill
- Load `release-workflow` skill
- **Report on:** Does the skill content load? Is it useful?

### T1.10 — transition_phase
- Transition idle → red → green → audit → complete
- Attempt green → idle (should SUCCEED — valid shortcut)
- Attempt idle → green (should FAIL)
- **Report on:** Which transitions work? Are error messages clear?

---

## Tier 2: Agent Spawning

### T2.1 — Single detective
- Spawn detective with 1 search query: `{"pattern": "toolNames:", "flags": "agents/savant/savant.ts -n"}`
- **Report on:** Response time, output quality, structured vs text output

### T2.2 — Single scout
- Spawn scout with prompt "Find auth-related files"
- **Report on:** File discovery quality, summary usefulness

### T2.3 — Single thinker
- Spawn thinker with prompt "What are the tradeoffs of the current FSM design?"
- **Report on:** Response quality, sequentialthinking usage

### T2.4 — Single researcher-web
- Spawn researcher-web with "What is the latest TypeScript release?"
- **Report on:** Search quality, source citations

### T2.5 — Single researcher-docs
- Spawn researcher-docs with "How does React useEffect work?"
- **Report on:** Documentation quality

### T2.6 — Parallel batch (3 independent agents)
- Spawn detective + scout + thinker in one call
- **Report on:** Do all 3 return results? Any conflicts?

### T2.7 — Parallel batch (5 agents)
- Spawn 5 detectives with different queries
- **Report on:** Performance, any timeout issues?

### T2.8 — Dependent chain
- First: spawn scout to find files about "authentication"
- Then: spawn detective to analyze one of the found files
- **Report on:** Can I chain agent outputs?

### T2.9 — Forge
- Spawn forge to implement a trivial change (write a comment to a scratch file)
- **Report on:** Does it respect the "no read" constraint? Does it write correctly?

### T2.10 — Verifier
- (SKIP — needs a real code change to review. Note this.)

### T2.11 — Recorder
- Spawn recorder with complete FID content and "use write_file to create this file"
- **Report on:** Does it write the FID? Does it follow the "do NOT read first" instruction?

### T2.12 — Scribe
- (SKIP — session end only. Note this.)

### T2.13 — Basher
- Spawn basher with `echo "hello world"`
- Spawn basher with `bun --version`
- **Report on:** Note: basher requires GREEN/AUDIT phase (uses run_terminal_command). Transition to GREEN before spawning basher.

### T2.14 — tmux-cli
- (SKIP — requires tmux setup. Note this.)

### T2.15 — browser-use
- (SKIP — requires Chrome. Note this.)

### T2.16 — context-pruner
- (SKIP — auto-spawned. Note this.)

---

## Tier 3: Write Operations

*Note: These require GREEN phase. Transition to green first.*

### T3.1 — write_file
- Write a test file to `dev/scratchpad/capabilities-test.txt`
- Read it back to verify
- **Report on:** Does it work in GREEN? Error messages?

### T3.2 — str_replace
- Edit the test file using str_replace
- Read it back to verify
- **Report on:** Precision of replacements, error handling

### T3.3 — apply_patch
- (SKIP — complex. Note this.)

### T3.4 — write_file in wrong phase
- Attempt write_file from idle (should FAIL)
- **Report on:** Error message clarity

### T3.5 — Clean up
- Spawn basher with `rm dev/scratchpad/capabilities-test.txt` (basher needs AUDIT phase to run `rm` via `run_terminal_command`)
- **Report on:** Can I clean up after myself? Does basher work from AUDIT?

---

## Tier 4: FSM & ECHO Protocol

### T4.1 — Full phase cycle
- idle → red → green → audit → complete
- **Report on:** Each transition, any friction

### T4.2 — Illegal transitions
- Attempt idle → green (should FAIL)
- Attempt green → complete (should FAIL)
- Attempt complete → audit (should FAIL)
- **Report on:** Are rejections clear?

### T4.3 — Self-correct shortcut
- (SKIP — needs audit findings. Note this.)

### T4.4 — Smart phase transitions
- Note that RED can be skipped for new files
- Note that GREEN deliberation can be skipped for obvious fixes
- **Report on:** Does the system prompt guide me correctly?

### T4.5 — FID lifecycle
- Read the FID template at `templates/FID-TEMPLATE.md`
- Read existing FIDs in `dev/fids/`
- Note that only Recorder should create FIDs
- **Report on:** Is the FID workflow clear?

### T4.6 — Separation of duties
- Verify that Detective has no write tools
- Verify that Verifier has no tools at all
- Verify that Forge has no bash
- **Report on:** Are restrictions enforced or just documented?

---

## Tier 5: Heavy Workflows

### T5.1 — Multi-file read + synthesis
- Read 5 files across the codebase
- Synthesize findings into a summary
- **Report on:** Context window pressure, readability

### T5.2 — Detective deep audit
- Spawn detective with 10 search queries across different areas
- Read and synthesize the results
- **Report on:** Output volume, structured vs text quality

### T5.3 — Parallel + sequential hybrid
- Phase 1: Spawn 3 detectives in parallel
- Phase 2: Read their outputs
- Phase 3: Spawn thinker to synthesize
- **Report on:** Does the workflow feel natural?

### T5.4 — Code change simulation
- Read `agents/savant/savant.ts`
- Identify a comment to fix
- Transition to GREEN
- Write the fix
- Transition to AUDIT
- Spawn verifier
- **Report on:** Full workflow friction

### T5.5 — Skill loading + application
- Load `coding-typescript` skill
- Read a TypeScript file
- Apply the skill's conventions to identify issues
- **Report on:** Do skills actually influence my behavior?

### T5.6 — Gravity index
- Call `gravity_index` with action "search" and query "serverless database for a TypeScript project"
- **Report on:** Does the tool return useful results?

---

## Tier 6: Edge Cases & Stress

### T6.1 — Large file read
- Read `cli/src/chat.tsx` (likely 500+ lines)
- **Report on:** Performance, truncation, usability

### T6.2 — Many parallel agents
- Spawn 8+ agents in one call
- **Report on:** Any failures? Timeout? Resource pressure?

### T6.3 — Tool failure recovery
- Attempt to read a non-existent file
- Attempt to glob with invalid pattern
- **Report on:** Graceful degradation? Clear errors?

### T6.4 — Context window pressure
- Read many files in sequence
- Note when context feels full
- **Report on:** Does context-pruning kick in? When?

### T6.5 — Phase gating enforcement
- From idle, attempt every phase-gated tool
- Document which ones are blocked and which aren't
- **Report on:** Is enforcement consistent?

### T6.6 — Cross-phase tool availability
- From RED: attempt write_file (should FAIL)
- From GREEN: attempt spawn_agents (should FAIL)
- From AUDIT: attempt write_file (should FAIL)
- **Report on:** Are restrictions consistent across phases?

---

## Tier 7: SDK Testing

### T7.1 — SDK source exploration
- Read `sdk/src/index.ts` (main exports)
- Read `sdk/src/client.ts` (SavantClient)
- Read `sdk/src/impl/model-provider.ts` (model routing)
- **Report on:** Is the SDK source readable? Can I understand the export surface?

### T7.2 — SDK type verification
- Glob `sdk/src/**/*.ts` to count files
- Read `sdk/src/env.ts` (environment getters)
- Read `sdk/src/run.ts` (run state)
- **Report on:** Can I navigate the SDK structure efficiently?

### T7.3 — SDK tool exports
- Read `sdk/src/tools/change-file.ts`
- Read `sdk/src/tools/apply-patch.ts`
- Read `sdk/src/tools/code-search.ts`
- **Report on:** Can I verify SDK tool implementations match the agent tool definitions?

### T7.4 — SDK build artifacts
- Glob `sdk/dist/**` to check if build output exists
- Read `sdk/tsconfig.build.json`
- **Report on:** Can I verify the SDK is buildable?

### T7.5 — SDK + common boundary
- Read `common/src/types/json.ts` (JSONValue type)
- Read `common/src/util/paths.ts` (resolveAndContain)
- Verify that `sdk/src/tools/change-file.ts` imports from `@savant-code/common/util/paths`
- **Report on:** Can I trace cross-package dependencies?

### T7.6 — SDK provider catalog
- Read `common/src/constants/model-config.ts` (model catalogs)
- Verify cloudflare, openrouter, anthropic entries exist
- **Report on:** Can I verify the provider catalog is complete?

---

## Tier 8: Gravity Index

### T8.1 — Basic search
- Call `gravity_index` with action "search", query "serverless database for a TypeScript project"
- **Report on:** Does it return results? Quality of recommendations?

### T8.2 — Category browse
- Call `gravity_index` with action "browse", category "Database"
- **Report on:** Does it list services? Are they relevant?

### T8.3 — Get service detail
- Call `gravity_index` with action "get_service", slug "supabase"
- **Report on:** Does it return full detail (env vars, setup URL, docs)?

### T8.4 — List categories
- Call `gravity_index` with action "list_categories"
- **Report on:** Does it show all categories with counts?

### T8.5 — Search with context
- Call `gravity_index` with action "search", query "email API", context `{"stack": "Next.js", "constraints": "free tier required"}`
- **Report on:** Does context influence the recommendation?

### T8.6 — Integration report
- Call `gravity_index` with action "report_integration", search_id from T8.1, integrated_slug "supabase"
- **Report on:** Does the integration report work?

### T8.7 — Edge cases
- Search with empty query (should fail gracefully)
- Get service with invalid slug (should fail gracefully)
- Browse with nonexistent category (should fail gracefully)
- **Report on:** Error handling quality

---

## Tier 9: Knowledge & Documentation

### T9.1 — LEARNINGS access
- Read `dev/LEARNINGS.md`
- **Report on:** Does it exist? Is it useful? Is it current?

### T9.2 — CHANGELOG access
- Read `CHANGELOG.md`
- **Report on:** Can I understand the release history? Is it well-maintained?

### T9.3 — ARCHITECTURE access
- Read `ARCHITECTURE.md`
- **Report on:** Does it explain the agent roster clearly?

### T9.4 — CONTRIBUTING access
- Read `CONTRIBUTING.md`
- **Report on:** Does it explain how to contribute?

### T9.5 — Session summaries
- List `dev/session-summaries/`
- Read the most recent one
- **Report on:** Are session summaries useful? Are they current?

### T9.6 — FID archive
- List `dev/fids/archive/`
- Read one archived FID
- **Report on:** Can I learn from past FIDs?

---

## Tier 10: Session Lifecycle

### T10.1 — Create session summary
- Transition to GREEN
- Write a test session summary to `dev/session-summaries/2026-07-24-capabilities-test.md`
- **Report on:** Can I document my work?

### T10.2 — Update LEARNINGS
- Append a test lesson to `dev/LEARNINGS.md`
- **Report on:** Can I capture knowledge?

### T10.3 — Spawn scribe
- Spawn scribe with instructions to write a session summary
- **Report on:** Does the scribe follow instructions?

### T10.4 — Clean up
- Remove the test session summary and lesson
- **Report on:** Can I undo documentation changes?

---

## Tier 11: Skill Loading

### T11.1 — Load each coding skill
- Load `coding-typescript`
- Load `coding-python`
- Load `coding-rust`
- Load `coding-java`
- Load `coding-go`
- Load `coding-csharp`
- Load `release-workflow`
- **Report on:** Does each load successfully? Content quality?

### T11.2 — Apply a skill
- Load `coding-typescript`
- Read a TypeScript file
- Identify issues based on the skill's conventions
- **Report on:** Do skills actually influence my behavior?

### T11.3 — Skill edge cases
- Load a non-existent skill
- Load the same skill twice
- **Report on:** Error handling?

---

## Tier 12: Multi-Provider Model Awareness

### T12.1 — Model provider routing
- Read `sdk/src/impl/model-provider.ts`
- Verify routing logic for openrouter, anthropic, cloudflare
- **Report on:** Can I understand the routing logic?

### T12.2 — Environment getters
- Read `sdk/src/env.ts`
- Verify API key getters for each provider
- **Report on:** Are env vars documented clearly?

### T12.3 — Model catalog
- Read `common/src/constants/model-config.ts`
- Verify model lists for each provider
- **Report on:** Is the catalog complete?

### T12.4 — Provider-specific logic
- Search for `isCloudflareModel`, `isOpenRouterModel`, etc.
- **Report on:** Can I verify provider detection works?

---

## Report Format

After all tiers, write `dev/scratchpad/agent-capabilities-report.md` with:

1. **Executive Summary** — 3-5 sentences on overall harness health
2. **Tier-by-Tier Results** — For each test: Status, Friction Level (none/low/medium/high), Experience Notes, Suggestion if any
3. **Top 5 Friction Points** — The worst experiences, ranked
4. **Top 5 Improvements** — Concrete changes that would help most
5. **Agent Experience Score** — 1-10, with justification

---

## Summary

| Tier | Name | Tests | Purpose |
|------|------|-------|---------|
| 1 | Basic Tools | 10 | Can I use my tools? |
| 2 | Agent Spawning | 16 | Can I orchestrate sub-agents? |
| 3 | Write Operations | 5 | Can I modify files? |
| 4 | FSM & ECHO | 6 | Does the protocol work? |
| 5 | Heavy Workflows | 6 | Can I do real work? |
| 6 | Edge Cases & Stress | 6 | Where does it break? |
| 7 | SDK Testing | 6 | Can I work with the SDK? |
| 8 | Gravity Index | 7 | Does service discovery work? |
| 9 | Knowledge & Documentation | 6 | Can I access project knowledge? |
| 10 | Session Lifecycle | 4 | Can I document my work? |
| 11 | Skill Loading | 3 | Do skills work end-to-end? |
| 12 | Multi-Provider Models | 4 | Can I verify provider routing? |
| **Total** | | **79** | |
