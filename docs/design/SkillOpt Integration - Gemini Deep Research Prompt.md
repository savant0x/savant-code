# Savant-Code SkillOpt Integration — Gemini Deep Research Prompt

> **What this is:** the finalized prompt for a Gemini Deep Research run (2026-09-09).
> Copy everything below the horizontal rule into Gemini Deep Research as-is.
>
> **Links:**
>
> - SkillOpt repo: https://github.com/microsoft/SkillOpt (MIT)
> - SkillOpt docs: https://microsoft.github.io/SkillOpt/ (rendered; see
>   `docs/index.md`, `docs/sleep/README.md`, `docs/sleep/multi-skill-staging.md`,
>   `docs/sleep/RESULTS.md`, `plugins/README.md` in-repo)
> - SkillOpt paper: https://arxiv.org/abs/2605.23904
> - Savant-Code repo: https://github.com/savant0x/savant-code (Apache-2.0)
>
> **Attachments to include with the run** (core files; attachments win over
> crawled files where they conflict):
>
> 1. `README.md` — product overview, self-improving harness feature summary
> 2. `AGENTS.md` — harness governance summary (hooks, quarantine, skill
>    authoring contract)
> 3. `ECHO.md` — the 15 Laws, Perfection Loop FSM, FID lifecycle
> 4. `ARCHITECTURE.md` — 10-agent roster, tool gating, runtime enforcement
> 5. `protocol.config.yaml` — hook declarations (experience-capture,
>    session-end-review), quality bar
> 6. `docs/self-improving-harness.md` — the full FID-2026-0824-012 feature
>    guide (the system under investigation)
> 7. `docs/design/Savant Self-Improving Architecture Plan.md` — the original
>    Gemini-researched design doc this system was built from
> 8. `scripts/session-end-review.ts` + `scripts/lessons-to-skills.ts` +
>    `scripts/evolve-skills.ts` + `scripts/experiences-dedup.ts` — the
>    mechanical pipeline scripts
> 9. `agents/scribe/scribe.ts` + `agents/savant/prompts.ts` — the Scribe
>    session-end review contract + the Orchestrator end-of-turn directive
> 10. `common/src/util/skill-management/trust.ts` +
>     `common/src/util/skill-management/mutations.ts` — the quarantine/trust
>     engine
> 11. `sdk/src/skills/load-skills.ts` — the quarantine-excluded skill loader
> 12. `cli/src/commands/skills.ts` + `cli/src/commands/skills-discovery.ts` —
>     the `/skills` operator CLI surface
> 13. `evals/v2/src/stats/skill-efficacy.ts` + `evals/v2/src/prove/skill-prove.ts`
>     + `evals/v2/src/erosion/gate.ts` — the existing proof machinery
>     (pass@k / paired lift / erosion gate)
> 14. `dev/fids/FID-2026-0909-006-error-line-payload-fragmentation.md` — the
>     open FID on the recurrence dedup key
> 15. `dev/agenda.md` — the live learning agenda artifact
>
> **Post-run plan:** fold the report into a master FID + child FIDs, then run
> the full Perfection Loop (RED → GREEN → AUDIT → ADVERSARIAL) on the plan
> before any implementation.

---

# Deep Research Request: SkillOpt Integration into Savant-Code's Self-Improving Harness

## Role

You are a senior agent-architecture researcher. Produce a single comprehensive
report that decides what Savant-Code should integrate from Microsoft's
SkillOpt — and, equally important, what it should NOT. The goal is not a survey;
it is an integration blueprint with verdicts, sized as FIDs for our Perfection
Loop.

## The Two Systems

### SkillOpt (the source under evaluation)

Repo: https://github.com/microsoft/SkillOpt · Docs:
https://microsoft.github.io/SkillOpt/ · Paper: https://arxiv.org/abs/2605.23904 ·
MIT · Python ≥3.10 · v0.2.0 on PyPI.

Two entry points:

1. **Research engine** (`skillopt-train` / `skillopt-eval`) — trains a skill
   document like a neural network: rollout → reflect → aggregate → select →
   bounded add/delete/replace edit → held-out validation gate → update; epochs,
   textual learning rate (max edits), LR schedules, rejected-edit buffer,
   slow/meta updates. A SEPARATE optimizer model turns scored rollouts into
   edits; acceptance requires strict held-out validation improvement. Benchmarks:
   DocVQA, ALFWorld, OfficeQA, SearchQA, LiveMathematicianBench,
   SpreadsheetBench.
2. **SkillOpt-Sleep** (`skillopt-sleep` CLI, `skillopt_sleep/` package, zero
   dependency on the research package) — deployment-time companion: nightly
   `harvest transcripts → mine recurring tasks → replay → consolidate
   (reflect → bounded edit → GATE on held-out real tasks) → stage proposal →
   (you) adopt`. Never auto-applies; every adopt backs up first. Backends:
   mock / claude / codex / cursor / copilot / pi / opencode / handoff /
   azure_openai. Per-platform plugin shells (Claude Code, Codex, Cursor,
   Copilot, Devin, DeepSeek Harness, OpenClaw reference).

Read the actual source of `skillopt_sleep/` (gate.py, cycle.py, consolidate.py,
staging.py, handoff_backend.py, skill_resolver.py at minimum) — not just the
READMEs.

### Savant-Code (the target system)

Repo: https://github.com/savant0x/savant-code · Apache-2.0 · TypeScript strict
monorepo, Bun 1.3.14 (pinned), Windows-first.

Self-improving harness (FID-2026-0824-012, shipped):

```text
tool failure → experience-capture hook (PostToolUseFailure, in-process,
  fail-open) → dev/experiences/raw-traces.jsonl (append-only, never boot-read)
→ dedup sha256(toolName + normalizedErrorFirstLine), recurrence ≥3 in 14 days
→ dev/agenda.md (≤50 lines, SessionEnd hook, deterministic, no LLM)
→ Scribe session-end review (full-fidelity half, LLM) → routes recurrences to
  RED-phase FIDs + drafts eligible lessons into skills
→ .agents/skills/.quarantine/ (invisible to loader; VERSIONS.jsonl ledger,
  per-skill snapshots, ZTAP provenance)
→ /skills trust <name> (operator-only release) → .agents/skills/ (live)
```

Key invariants: mechanical capture (the harness cannot forget), quarantine +
operator-only trust, on-disk versioning (git is not the ledger), progressive
disclosure (Level 0/1 only in listings), context economy, no silent mutations.

## Verified Ground Truth (2026-09-09 audit — do not re-derive; build on it)

These facts were established by direct code/git inspection in the origin
repo. Where the report touches them, treat them as given:

- **Stage wiring:** capture ✅ wired and firing (36 ledger records);
  agenda refresh ✅ wired via SessionEnd hook; recurrence bar ✅ wired but
  degraded (see below); mechanical auto-draft (`lessons:to-skills`) ❌
  manual-only — zero hooks, zero automatic callers; Scribe auto-draft ✅
  prompt-directed (fired 2026-08-26, produced 2 drafts); trust ✅ exists,
  used 0 times ever; **operator notification ❌ DOES NOT EXIST** —
  `session-end-review.ts` contains zero skill/quarantine references, and
  `/skills` defaults to the trusted view (`--quarantined` is an opt-in flag).
- **Three quarantined drafts sit unseen** (committed incidentally by
  tree-drain commits, never by a trust action): two lesson-derived drafts
  from 2026-08-26, and one operator-directive EDIT of `release-workflow`
  (2026-09-08) that officializes the new release cadence — while the LIVE
  `release-workflow` skill still ships the superseded 0.1.0 cadence (active
  content drift, loaded every session).
- **The recurrence dedup key was broken in both directions:** pre-fix, every
  failure collapsed to the generic line "tool result contains an error"
  (over-merge — fixed by FID-2026-0909-005); post-fix, payload-embedded error
  lines (str_replace echoes the old string) assign every distinct failure a
  unique key (over-fragmentation — open FID-2026-0909-006). The mechanical
  promotion bar has never produced a content-bearing candidate.
- **The 30-day purge deletes never-trusted drafts** (`purgeRejectedDrafts`)
  — a destructive default that would silently destroy the pending
  operator-directive edit around 2026-10-08.
- **Proof machinery exists but is unwired into presentation:**
  `skills prove` (paired baseline/skill-active trials, pass@k capability +
  pass^k reliability, activation heuristic, erosion gate) is ADVISORY at
  trust time and never part of the moment a draft is presented to the
  operator.

## Hard Constraints (non-negotiable)

- **Single model project-wide.** The UI-selected model is the only model —
  headless, subagent, and teacher included; never a paid fallback. NO second
  LLM, no optimizer model, no judge model. This explicitly rejects SkillOpt's
  research-engine architecture (separate optimizer + replay harness) as a
  direct adoption; only contracts/UX ideas can transfer.
- **Operator-only trust.** Nothing auto-promotes. Ever.
- **Deterministic-first.** Mechanical stages live in hooks/scripts; the LLM
  appears only in the full-fidelity Scribe half. (SkillOpt's mock + handoff
  backends are philosophically aligned — study their determinism patterns.)
- **ECHO governance.** Every change routes through the FID lifecycle +
  Perfection Loop; 300-line file ceiling; ZTAP provenance receipts.
- **Context economy.** `dev/experiences/` and the quarantine are never
  boot-read.
- **TypeScript/Bun monorepo, Windows-first (Git Bash).** SkillOpt is Python —
  engine code does not transplant; ideas and contracts do.

## Research Questions (answer each with verdict + evidence + confidence)

1. **Staging/adopt UX.** Map SkillOpt-Sleep's `status → review → adopt` flow
   onto Savant's surfaces. Where exactly should the mechanical "N drafts
   pending your review" notification live — SessionEnd hook stdout, an
   agenda.md section, a startup badge, the `/skills` default view, or several?
   SkillOpt's `status` shows the latest staged proposal BY DEFAULT; Savant's
   `/skills` shows trusted BY DEFAULT. Recommend the exact default-inversion
   and every surface it touches.
2. **Gate-before-present.** SkillOpt stages a proposal only after the
   held-out gate accepts. Savant has `skills prove` machinery but presents
   unproven drafts. How should the existing pass@k / paired-lift / erosion
   system be wired so every draft presented to the operator carries either a
   proof receipt or an explicit "unproven — trusting blind" label? What
   subset can run deterministically (no model) vs needs the operator's single
   model at session end?
3. **Purge semantics.** SkillOpt: adoption backs up, nothing auto-destroys.
   Savant: 30-day purge DELETES untrusted drafts. Design the
   backup-then-expire contract (where do expired drafts go —
   `dev/scratchpad/`? a `versions/` snapshot?). What's the failure mode of
   each design at 1000 drafts?
4. **Skill-edit proposals.** SkillOpt stages per-skill proposals pinned to
   live baselines (sha256 of live bytes at consolidation time; refuses
   publication if the live file drifted). Savant's pending `release-workflow`
   edit is invisible. How should Savant present an edit-draft as a reviewable
   diff against the live skill (the `patch` action + VERSIONS.jsonl already
   hold the material)? Should drift-detection refuse trust when the live
   copy changed since drafting?
5. **Recurrence → skill identity.** Given the payload-redaction fix proposed
   in FID-2026-0909-006 (redact embedded payloads from the dedup key while
   keeping the full line for display), what should the draft-naming/trigger
   contract be so mechanically drafted skills are stable AND
   content-bearing? Compare with SkillOpt's grouping-by-hint and
   slugification.
6. **Handoff mode.** SkillOpt's `handoff` backend writes model calls as
   prompt files for a human/fresh-context agent to answer, explicitly to
   avoid contaminating the validation gate with a context that has seen the
   references. Savant's Scribe drafts skills with full message history —
   the same contamination class. Is there a Savant-native equivalent (e.g.,
   spawning the Scribe with `includeMessageHistory: false` + structured
   input) worth adopting for drafting?
7. **What should Savant explicitly NOT adopt, and why?** (Expected
   candidates: the optimizer model, benchmark replay, dream rollouts,
   per-skill fan-out cost multiplication, Python runtime — but verify each
   against the constraints and rank them.)
8. **FID-sizing.** Express the outcome as an ordered FID plan compatible
   with the ECHO Perfection Loop — each FID <300 changed lines where
   possible, with the SkillOpt precedent, the Savant seam (file:line), the
   proposed contract, and verification gates per FID.

## Output format

Single markdown report: Executive summary → integration matrix (SkillOpt
mechanism × Savant seam × adopt/adapt/reject verdict × constraint
conflicts) → ADR-style answers to the 8 questions → ordered FID plan → risk
register → honest boundaries (what requires live operator verification) →
full source list with URLs. Depth over breadth; verdicts over surveys.