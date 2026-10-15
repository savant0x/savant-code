# Savant-Code Eval System Rebuild — Gemini Deep Research Prompt

> **What this is:** the finalized prompt for a Gemini Deep Research run (2026-08-24).
> Copy everything below the horizontal rule into Gemini Deep Research as-is.
>
> **Attachments to include with the run** (working-tree state that may be thin or
> absent on GitHub; attachments win over crawled files where they conflict):
>
> 1. `evals/README.md` + `evals/v2/README.md` (current benchmark v2: task schema,
>    runner interfaces, sandbox model)
> 2. `ECHO.md` (the 15 Laws, Perfection Loop FSM, FID lifecycle)
> 3. `ARCHITECTURE.md` (10-agent roster, tool gating, permission matrix)
> 4. `protocol.config.yaml` (build commands, quality bar, hooks)
> 5. One representative task folder: `evals/v2/tasks/pure_coding/` (task YAML shape)
>    — note `evals/v2/golden/` also exists (golden patches for baseline-mode
>    validation via `harness:v2`)
> 6. `dev/fids/FID-2026-0824-012-self-improving-harness-and-agent-created-skills.md`
>    (agent-created skills now exist — evals must be able to grade them)
>
> **Post-run plan:** fold the report into a master FID + child FIDs, then run the
> full Perfection Loop (RED → GREEN → AUDIT → ADVERSARIAL) on the plan before any
> implementation.

---

# Deep Research Request: Savant-Code Eval System Rebuild — Harness Testing & Grading Landscape Report

## Role

You are a senior evaluation-infrastructure researcher. Produce a single comprehensive
report that becomes the architectural basis for REBUILDING the evaluation system of
Savant-Code — an open-source (Apache-2.0) multi-agent coding assistant built on the
ECHO Protocol. The goal is not a survey; it is an engineering blueprint with verdicts.

## The Target System (context you must design for)

Savant-Code facts that constrain every recommendation:

- **Runtime:** TypeScript strict monorepo, Bun ≥1.3.11 (pinned), Tauri v2 desktop shell
- **Governance:** ECHO Protocol v0.2.0 — 10-agent roster (Orchestrator, Detective, Forge,
  Verifier, Adversary, Recorder, Thinker, Scout, Researcher, Scribe); deterministic FID
  lifecycle; Perfection Loop FSM (RED → GREEN → AUDIT → ADVERSARIAL); EHEL pre-write
  gates; ZTAP provenance receipts; no silent mutations; no secondary in-process LLM
- **Existing eval system (`@savant-code/evals`, "benchmark v2"):** deterministic-first
  task runner — curated YAML tasks feed a SavantCode run in a sandbox (temp-dir on
  Windows, Docker stub on Linux/CI), verifies check commands (tests/typechecks/lints),
  and scores ECHO FSM phase compliance, subagent utilization, and custom-tool usage from
  the captured trace. Task categories today: pure_coding, error_recovery,
  multi_agent_orchestration. Unified `AgentRunner` interface (Savant SDK + external CLI
  agents). This system WORKS but predates two major changes:
  1. **Agent-created skills** just shipped: agents author SKILL.md artifacts through a
     governed pipeline (quarantine → operator trust), with versioned ledgers. Evals
     currently cannot measure whether a skill improves agent performance.
  2. **The desktop app + holographic command deck** exist; runtime-level behavior is
     unchanged but new surfaces may warrant smoke-grade verification later.
- **Operator constraints:** single configured LLM provider per run; budget-conscious;
  Windows-first development; release-only commits (no per-change git history).

## Research Mandate

Survey the current (2025–2026) landscape of open-source harness testing / grading /
evaluation systems for AI coding agents, then produce concrete architectural verdicts
for rebuilding Savant's eval stack. For EVERY system below: fetch the repository,
read the source (not just READMEs), record its license, its grading mechanism
(deterministic vs LLM-judge vs end-state), its sandbox/isolation model, its cost
profile, and what Savant should adopt or reject from it.

### Repositories to analyze (primary prior art)

1. **Caliper** — https://github.com/edonadei/caliper — pass@k reliability harness for
   AGENT SKILLS: runs a skill k times against Claude Code/Codex-class agents, grades
   each attempt via deterministic `assert:` and/or LLM-autorater `expect:`, then a
   `--baseline` re-run WITHOUT the skill reports the delta. Git-diffable `.eval.yaml`
   specs; isolated per-attempt sandboxes. Analyze deeply — skill-efficacy grading is
   Savant's biggest gap.
2. **Terminal-Bench** — https://github.com/harbor-framework/terminal-bench — Stanford ×
   Laude; Docker-sandboxed terminal tasks graded by FINAL MACHINE STATE ("inspects what
   the agent did, not what it said"). Study task format, verifier design, agent adapters.
3. **Harbor** — https://github.com/harbor-framework/harbor — the framework powering
   Terminal-Bench 2.0; agent evals as RL environments.
4. **Inspect AI** — https://github.com/UKGovernmentBEIS/inspect_ai — Apache-2.0; the
   reference eval framework (`@task` = dataset+solver+scorer; custom scorers; sandboxed
   tools). Also its companion catalog https://github.com/UKGovernmentBEIS/inspect_evals
5. **OpenBench** — https://github.com/groq/openbench — Groq's provider-agnostic bench
   CLI, 95+ benchmarks built on Inspect primitives.
6. **promptfoo** — https://github.com/promptfoo/promptfoo — MIT; git-diffable YAML eval
   configs + red-teaming CLI.
7. **SkillsBench** — https://github.com/benchflow-ai/skillsbench — benchmarks how well
   agent skills work and how effectively agents use them.
8. **Coder Eval** — https://github.com/UiPath/coder_eval — treats skill ACTIVATION as a
   measurable variable (skill_triggered precision/recall/F1 gates).
9. **SWE-bench** — https://github.com/swe-bench/SWE-bench — the standard: Dockerized
   harness, FAIL_TO_PASS/PASS_TO_PASS grading. Include the known-integrity findings
   (~59% broken tests per OpenAI's audit) and successor approaches
   (SWE-rebench contamination-resistant refresh, SWE-bench Pro long-horizon tasks).
10. **SlopCodeBench** — https://github.com/SprocketLab/slop-code-bench — measures
    structural erosion when agents repeatedly extend their OWN previous solutions
    under iterative refinement. Directly relevant to self-improving systems.
11. **OpenAI simple-evals** — https://github.com/openai/simple-evals — minimal grading
    scripts pattern.
12. **LangChain openevals/agentevals** — https://github.com/langchain-ai/openevals +
    https://github.com/langchain-ai/agentevals — trajectory-match grading for agents.
13. **CodeScaleBench** (Sourcegraph, blog + repo if public) — large-repo (>400k LOC)
    agent testing; MCP-augmented vs local-tools agents.

For each: license (MIT/Apache-2.0 preferred — flag anything copyleft or proprietary),
maintenance status, and one-line adopt/adapt/reject verdict for Savant.

## Required Deliverables (report structure)

### A. Landscape matrix

One table: every system × {license, grading mechanism, isolation model, cost profile,
maintenance status, adopt/adapt/reject}.

### B. Architectural Decision Records (ADR-style, like our prior research docs)

Answer AT MINIMUM these questions with verdict + evidence + confidence:

1. **Grading philosophy** — deterministic checks vs LLM-judge vs end-state inspection.
   Savant's invariant: prefer deterministic-first (existing v2 principle). When is an
   autorater justified, and how do we prevent agreeableness bias?
2. **Skill-efficacy grading** — how should Savant prove an agent-authored skill improves
   performance? Evaluate Caliper's k-trials + baseline-delta methodology as the core of
   a new `skills prove <name>` capability. How many trials are statistically meaningful
   at minimum cost? Distinguish pass@k (any attempt succeeds) from pass^k (all attempts
   succeed — reliability) per Anthropic's evals engineering guidance; which belongs in
   a skill-provenance receipt? How should deltas be recorded (we have ZTAP provenance
   receipts)?
3. **End-state verification** — should Terminal-Bench-style final-state grading replace
   or complement patch-based grading (FAIL_TO_PASS)? What would a Bun-native sandbox
   need to support it on Windows (no Docker dependency)?
4. **Task corpus strategy** — v2 has ~3 categories with limited tasks. How do we grow a
   contamination-resistant task corpus (time-windowed collection à la LiveCodeBench,
   auto-generated tasks from real repo issues à la SWE-rebench)? What task categories
   are MISSING for a multi-agent governed system (e.g., governance-compliance tasks:
   does the agent correctly REFUSE out-of-role actions?)
5. **FSM-compliance scoring** — v2 scores FSM phase compliance from traces. Is this the
   right metric set? What behavioral metrics distinguish a governed agent from a raw
   loop (tool-permission respect, Law adherence, honest-boundary reporting)?
6. **Self-improvement regression guard** — SlopCodeBench-style erosion measurement: when
   the self-improving harness patches its own skills over time, how do we detect
   quality decay? Propose a concrete regression protocol.
7. **Cost & CI integration** — eval runs must fit operator budget and the existing
   pre-push/release gate structure. What subset runs per-commit vs nightly vs weekly?
8. **License compliance** — anything we adapt must be MIT/Apache-2.0 compatible with
   attribution; flag every rejection caused by licensing.

### C. Phased rebuild plan

A staged migration from current v2 to the rebuilt system. Each phase independently
shippable, preserving backward compatibility with existing YAML tasks where sensible.
Identify which v2 components survive (schema? registry? AgentRunner?) and which get
replaced. Explicitly state Windows-without-Docker viability per phase (our dev reality).

### D. Honest boundaries

Every claim that depends on live execution must be flagged as requiring operator
verification. No invented benchmark numbers; cite only published results with sources.

## Constraints (non-negotiable)

- Deterministic-first grading remains the primary signal; LLM-judge only where justified.
- No second in-process LLM anywhere in the eval pipeline.
- Windows-first (temp-dir sandboxes viable without Docker).
- Apache-2.0 project — adopted code/licenses must be compatible.
- Budget-conscious: report per-run token/compute estimates where knowable.
- The eval system evaluates BOTH: raw coding capability AND governance compliance
  (did the agent stay in role, respect permissions, report honestly).

## Output format

Single markdown report: Executive summary → landscape matrix → ADRs → phased plan →
risk register → honest boundaries → full source list with URLs. Depth over breadth;
verdicts over surveys.
