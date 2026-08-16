# Harness Engineering for Coding Agents — Research & Savant-Code Opportunity Map

**Date:** 2026-08-03
**Status:** research — no FIDs opened yet
**Primary source:** HumanLayer — "Skill Issue: Harness Engineering for Coding Agents"
[Read the post](https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents)
**Scope:** blog review + expanded research into the discipline, mapped to the
Savant-Code runtime (verified against source, not assumed).

---

## 1. The Thesis

The industry consensus across HumanLayer, OpenAI, Anthropic, Augment Code, OpenDev, and the
terminal-agent literature is captured in one equation:

```text
coding agent = AI model(s) + harness
```

The harness is everything outside the model: agentfiles, tools/MCP servers, skills, sub-agents,
hooks, permission gates, context compaction, and verification loops. Harness engineering is the
practice of using these configuration points to improve output quality and reliability.

> A decent model with a great harness dramatically outperforms a frontier model with a bad
> harness. Most agent failures are configuration problems, not model problems.

Two strong corollaries from the sources:

1. **Post-training coupling cuts both ways.** Models are post-trained on their harness (e.g.
   Codex + `apply_patch`; OpenCode had to add an `apply_patch` tool to mimic it). But models can
   also be *over*-fitted: Terminal Bench 2.0 shows Opus 4.6 at #33 in Claude Code but ~#5 in an
   unfamiliar harness. Harness choice matters, and mismatches are measurable.
2. **Harness engineering is a subset of context engineering.** The goal of nearly every lever is
   managing the context window: keeping it small, relevant, and un-polluted (the "smart zone"),
   and adding deterministic verification the model cannot talk its way out of.

---

## 2. Core Mechanisms (the expanded field guide)

### 2.1 Context rot / the "dumb zone"

Chroma's context-rot research and LongCLI-Bench both show model performance degrades as context
length grows, even on simple tasks, and degradation is steeper when the question has low semantic
similarity to the filler in context. Every irrelevant tool log, grep dump, or file read is a
distractor. Long-context models don't fix this — a bigger window just makes a bigger haystack.

**Tips:**

- Compact: summarize older history in place when a token threshold is crossed.
- Reset: tear down the session and pass state forward via structured artifacts (git log, JSON
  checklists, progress files) when compaction is not enough.
- Isolate: push context-heavy work (searches, large reads, log dumps) into sub-agents whose
  intermediate messages never enter the parent window.
- Progressive disclosure: don't inject everything up front; load instructions/tools on demand.

### 2.2 Back-pressure (the highest-leverage lever)

Task success correlates strongly with the agent's ability to verify its own work. Verification
mechanisms — typechecks, unit tests, coverage, UI/browser checks — act as back-pressure that
forces the agent to keep working until the environment agrees it is done.

**Tips:**

- Success must be **silent**; only failures produce output. (HumanLayer's 4,000-line passing-test
  flood lesson: verbosity corrupts the parent context and induces hallucination.)
- Typecheck/build on every agent stop; if errors exist, re-engage the agent to fix them before it
  finishes.
- Prefer a subset of tests over the full suite for the fast loop.
- Never rely on agent self-grading — use an independent evaluator (the Generator-Evaluator split).

### 2.3 Progressive disclosure

Stuffing every instruction and tool into the system prompt blows the instruction budget before the
agent starts. The ETH Zürich agentfile study (138 agentfiles): LLM-generated ones *hurt* performance
while costing 20%+ more tokens; human-written ones helped only ~4%; agents spent 14-22% more
reasoning tokens processing context-file instructions. Codebase overviews and directory listings
didn't help — agents discover structure on their own.

**Tips:**

- Agentfiles: concise (< 60 lines), universally applicable, no conditional rule soup. Never
  auto-generate them.
- Skills: one SKILL.md per capability, loaded as a user message only when activated; the skill may
  point at further bundled files (progressive disclosure *within* a skill).
- Tools: too many tool schemas push you into the dumb zone. Disable servers you aren't actively
  using. Prefer CLIs well-represented in training data (GitHub, Docker, databases) over MCP
  servers — the model already knows them, and output is more composable (grep/jq) and
  context-efficient.

### 2.4 Error-as-prompt and failure taxonomy

- **Transient failures** (429, 502/504, drops) → exponential backoff with jitter; retry at the
  transport layer.
- **Semantic failures** (linter errors, missing files, failed tests) → never blind-retry; feed the
  exact failure back into the reasoning loop as an actionable prompt (e.g. "field 'path' is
  required. Fix and retry.").
- **Double execution** → guard with idempotency keys / an execution ledger (a registry of
  in-flight and completed tool calls; short-circuit duplicates and return cached results).
- **Doom loops** → detect repeated identical failed tool calls and surface a warning or plan
  change instead of looping silently.

### 2.5 The ratchet rule

Every agent mistake becomes a permanent constraint: encode the negative rule in AGENTS.md, and/or
write a deterministic lint rule / pre-commit hook that blocks that exact mistake forever.

### 2.6 Permission tiers (HITL)

Tier actions: read-only (autonomous), destructive/irreversible (gated). Policy modes:
`always_allow` / `always_deny` / `ask_each_time` with a structured approval prompt and one-shot
grant. Defense in depth, not prompt-only "please be careful".

### 2.7 Hooks

User-defined scripts run on lifecycle events (like git hooks): run a tool call and inject context,
auto-approve/deny based on input values (e.g. deny `bash` calls running migrations), verify on
stop, notify on finish. Exit code 2 = "re-engage the agent"; success = silent.

---

## 3. Savant-Code Scorecard (verified against the runtime)

| Lever | Status | Evidence |
|---|---|---|
| Skills — progressive disclosure | Already have | `skill` tool with `AVAILABLE_SKILLS_PLACEHOLDER` swapped for descriptions only; content loaded on activation (`packages/agent-runtime/src/tools/prompts.ts`, `tools/handlers/tool/skill.ts`) |
| Sub-agents — context firewall | Already have | spawn-agents / spawn-agent-utils with tool-set filtering (FID-007) |
| Context compaction | Already have | `context-compactor.ts` + reactive Layer-4 compact (`run-agent-step.ts`), file-tree token budgeting, `format-value.ts` truncation |
| Permission modes | Partial | `/permissions safe\|prompt\|unsafe` + danger-regex in `run-readonly-command.ts` — but `prompt` mode currently **downgrades to deny** (interactive approvals not implemented) |
| Verification gates | Already have | pre-push eslint + lint:md hook, `protocol.config.yaml` build commands, Forge/Verifier split |
| Stop-hook verification | Gap | no automatic typecheck/build-on-stop that re-engages the agent |
| Checkpoint / undo | Already have | checkpoint-store + `/rewind` (FID-2026-0803-004) |
| Double-execution guard | Already have | `hasYieldedContent` re-stream guard (FID-2026-0803-003, SDK-2) |
| Ratchet rule | Already have | FID lifecycle → LEARNINGS.md → custom eslint rules |
| Sub-agent cost tiering | Gap | child agents inherit model selection; no explicit cheaper-tier default |
| Sub-agent output contract | Partial | agents return summaries with citations, but no enforced condensed-result contract |
| Doom-loop detection | Gap | live runtime guard not present (evals trace-analyzer exists) |
| Tool budget audit | Gap | no metric for tokens spent on injected tool definitions |
| AGENTS.md hygiene | Partial | comprehensive but table-heavy; ETH study suggests slimming |
| Eval trace promotion | Gap | no "promote a real trace into an eval case" command |
| MCP + skill security guidance | Partial | install warnings exist; no repo doc |

---

## 4. Ranked FID Candidates

### HIGH value / medium effort

1. **Interactive approval prompts** — complete `/permissions prompt`: structured yes/no approval
   UI for risky tool calls with one-shot grant, reusing the picker pattern (RewindPicker /
   ModelPicker). Closes the one real gap in our defense-in-depth.
2. **Stop-hook verification** — on run settle, run `protocol.config.yaml` build commands;
   silent on success, surface only errors, re-engage the agent on failure. Reuses the existing
   file-write hook seam (`cli/src/utils/create-run-config.ts`).

### MEDIUM value / low-medium effort

3. **Sub-agent cost tiering** — default child agents (Scout/Researcher/Detective) to a cheaper
   model tier; reserve the expensive model for orchestrator/Thinker.
4. **Sub-agent condensed-result contract** — enforce "answer + filepath:line citations only, no
   raw tool spam" for sub-agent outputs (HumanLayer cite-sources pattern).
5. **Doom-loop detection** — runtime guard: same tool + same args failing N consecutive times →
   warn / suggest plan change.

### LOW effort

6. **Instruction-budget audit** — measure tokens spent on injected tool definitions
   (`common/src/tools/compile-tool-definitions.ts`); trim rarely-used tools.
7. **AGENTS.md slimming** — trim toward ~60 lines + progressive disclosure pointers (dogfood the
   ETH findings on our own repo).
8. **Eval trace promotion** — CLI command to promote a real failing session trace into an eval
   case (trace-utils already exist in `evals/`).
9. **MCP hygiene + skill-registry security note** — docs-level: prefer CLIs over MCP for
   well-trained tools; treat skill installs like `npm i` (malware in registries is documented).

---

## 5. What NOT to change (validated as already-correct)

- Progressive skills, sub-agent context firewall, compaction + truncation, checkpoint/rewind,
  Forge/Verifier split, ratchet-rule loop, phase-gated tool access (schema-level gating).

---

## 6. Sources

- HumanLayer — "Skill Issue: Harness Engineering for Coding Agents" (Mar 2026)
- Anthropic Engineering — harness design for long-running agents
- OpenAI Engineering — "Harness engineering: leveraging Codex in an agent-first world"
- Augment Code — "Harness Engineering for AI Coding Agents: Constraints That Ship Reliable Code"
- ETH Zürich — agentfile study (138 agentfiles)
- Chroma — context rot research; LongCLI-Bench
- OpenDev — "Building AI Coding Agents for the Terminal" (arXiv)
- Agent libOS — capability-controlled runtime for long-running agents (arXiv)
