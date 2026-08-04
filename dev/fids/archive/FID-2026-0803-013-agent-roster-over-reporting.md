# FID: Agent Roster Over-Reporting (13 spawnable agents reported as "the roster")

**Filename:** `FID-2026-0803-013-agent-roster-over-reporting.md`
**ID:** FID-2026-0803-013
**Severity:** low (UX/consistency — no data loss, no correctness failure)
**Status:** verified
**Created:** 2026-08-03
**Author:** Savant

**Summary:**
When a user asks the Savant orchestrator "what's the agent roster?", the model
reports **13 agents** instead of the canonical **9 ECHO roles**. Root cause:
the main-agent instructions prompt auto-appends a "You can spawn the following
agents:" addendum built from the full `spawnableAgents` allowlist (13 entries
including infrastructure helpers `basher`, `tmux-cli`, `browser-use`,
`context-pruner` and the two Researcher tool libraries listed separately). The
model treats that functional spawn list as the roster definition. The fix adds
an explicit canonical **Agent Roster** section to the Savant system prompt that
defines exactly the 9 ECHO roles and instructs the model to report only those
when asked.

---

## RED — Evidence

| # | Location | Issue |
|---|----------|-------|
| R-1 | `agents/savant/savant.ts:120-136` | `spawnableAgents` allowlist = 13 entries: `detective`, `scout`, `researcher-web`, `researcher-docs`, `basher`, `thinker`, `forge`, `verifier`, `tmux-cli`, `browser-use`, `context-pruner`, `recorder`, `scribe` |
| R-2 | `packages/agent-runtime/src/templates/strings.ts:236-253` | For the main agent (non-inherited tools branch), the instructions prompt gets `addendum += "\n\nYou can spawn the following agents:\n\n" + agentDescriptions.join('\n')` where `agentDescriptions` maps **every** `spawnableAgents` entry to `- ${agentType}: ${template.spawnerPrompt}` |
| R-3 | `ARCHITECTURE.md:22-33` | Canonical roster table = **9 roles**: Orchestrator, Detective, Forge, Verifier, Recorder, Thinker, Scout, Researcher, Scribe |
| R-4 | `ARCHITECTURE.md:210-236` | "Helper Tool Libraries" section: `basher`/`tmux-cli`/`browser-use`/`context-pruner` are infrastructure helpers consumed BY the 9 roles — "do NOT constitute independent conversational agents". `researcher-web` + `researcher-docs` are the two tool libraries of the single Researcher role |
| R-5 | Live behavior | User asked "the roster" → model listed multiple agents beyond the core 9 (parroting the 13-entry addendum) |

### Finding details

**R-1/R-2 (the mechanism):** The orchestrator legitimately needs all 13 in its
spawn allowlist — `basher` runs typechecks, `browser-use` verifies UI,
`tmux-cli` tests interactive CLIs, `context-pruner` auto-spawns via
handleSteps. The bug is not the allowlist; it's that the runtime renders that
functional list into the prompt verbatim as "You can spawn the following
agents:", and the model conflates it with the roster definition when asked.
The system prompt currently contains **no canonical roster section** — grep for
`Agent Roster` / `The Agent Roster` across `agents/`, `common/src/`,
`packages/agent-runtime/src/` returns zero hits in non-test code. The model
only ever sees the 13-entry spawn list, so that's what it reports.

**R-5 (expected answer):** The 9 canonical ECHO roles with their
responsibilities (as stated by the user and consistent with ARCHITECTURE.md):

| Role | Responsibility |
|------|----------------|
| Savant (Orchestrator) | Routes work, enforces protocol, spawns agents |
| Detective | Discovers bugs and issues with evidence before any code is written |
| Forge | Implements code changes from a converged plan |
| Verifier | Independent double-audit after implementation |
| Thinker | Deep sequential reasoning for complex problems |
| Scout | Explores codebases to gather context |
| Researcher | Web search and documentation lookup |
| Recorder | FID lifecycle management and tracking |
| Scribe | Session summaries and knowledge capture |

---

## GREEN — Solution

1. **R-1..R-5 fix:** Add an explicit `# Agent Roster` section to the Savant
   default system prompt (`buildDefaultSystemPrompt` in
   `agents/savant/savant.ts`, after the identity/date lines and before
   `# General guidelines`). Content:

   - A table of the **9 canonical ECHO roles** with one-line responsibilities
     (matching ARCHITECTURE.md + the user's expected answer).
   - A clarifying note: `researcher-web` and `researcher-docs` are the two tool
     libraries of the single **Researcher** role; `basher`, `tmux-cli`,
     `browser-use`, and `context-pruner` are **infrastructure helpers** — NOT
     roster members.
   - An explicit instruction: "When asked about the agent roster, report only
     the 9 roles listed above."

2. **No change to `spawnableAgents`** (R-1): the allowlist stays at 13 — it is
   functionally correct. Removing infrastructure entries would break spawning.

3. **No change to `strings.ts` addendum** (R-2): it remains the functional
   "what can I spawn" list. The roster definition in the system prompt resolves
   the conflation at the source.

4. **Docs alignment:** `AGENTS.md` already carries the correct 9-role table —
   no doc change needed. `ARCHITECTURE.md` already documents the
   helper-libraries distinction — no change needed.

---

## AUDIT — Verification

1. **Static (grep):** After the fix, `agents/savant/savant.ts` contains an
   `# Agent Roster` heading; grep for `Agent Roster` in non-test TS now hits
   exactly one source site.
2. **Runtime (rendered prompt):** Typecheck the `agents` workspace, then run
   the existing strings/template test suite in `packages/agent-runtime` — the
   addendum tests (`strings.test.ts:158/200/277/445`) assert the *generic*
   "You can spawn the following agents:" text, which we do NOT modify, so they
   must stay green unchanged.
3. **Model behavior:** A follow-up prompt asking "what's the roster?" should
   now yield the 9 canonical roles (Savant signs this FID; verification of
   model output is by the user at approval).
4. **Call-graph:** `buildDefaultSystemPrompt` is invoked from
   `buildSystemPrompt` (single caller) — template string change only, no
   exported symbol changes, no callers to update.

---

## Resolution — COMPLETE (operator-approved)

Operator approved the GREEN solution ("re-read the ECHO spec, run the
perfection loop on the FID, then code"). AUDIT on the FID document passed: insertion point
verified (`buildDefaultSystemPrompt` at `agents/savant/savant.ts:504`;
identity and date lines 512-514; `# General guidelines` at 516); single
caller (`buildSystemPrompt:478`) — zero callers to update (Law 4); zero
existing roster text in non-test TS; zero tests reference the system prompt
content.

Implemented: added `# Agent Roster` section (9 canonical ECHO roles table +
Researcher tool-libraries + infrastructure-helpers clarification + "report
only the 9" instruction) between the date line and `# General guidelines` in
`buildDefaultSystemPrompt`.

**Verification evidence (Double Audit):**

- Method 1 (static): grep confirms `# Agent Roster` at
  `agents/savant/savant.ts:516` with the 9-role table and helper-libraries
  note; `spawnableAgents` unchanged at 13 entries (lines 120-136);
  `buildDefaultSystemPrompt` has a single caller (`buildSystemPrompt:478`).
- Method 2 (runtime): `agents` workspace typecheck → exit 0; CLI typecheck
  (bundle regenerated via `prebuild:agents`) → exit 0; eslint
  `agents/savant/savant.ts --max-warnings 0` → clean; `lint:md` → clean;
  `packages/agent-runtime` strings template suite 11/11 pass (addendum
  untouched). Independent review: clean.

**Amendment (2026-08-03):** Operator provided the exact canonical roster
content — the section now uses the ARCHITECTURE.md table format with # / Agent /
Phase / Responsibility columns (numbered 1-9) and a dedicated "Important
distinction" subsection listing the infrastructure helpers
(`researcher-web`/`researcher-docs`, `basher`, `tmux-cli`, `browser-use`,
`context-pruner`) as spawnable-but-not-roster-members. Re-verified after the
content replacement: `prebuild:agents` bundle regenerated (12 refs),
`agents` typecheck exit 0, eslint clean.
