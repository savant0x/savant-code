# Self-Improving Harness & Agent-Created Skills

> **Feature module — FID-2026-0824-012.** Savant learns from real usage: it
> captures tool failures mechanically (no prompt compliance required),
> promotes recurring patterns into canonical rules and versioned skills, and
> lets the operator trust — or reject — everything it authors. This document
> is the full guide: how it works, how to use it, and how to explain it.

---

## 1. Overview

Savant-Code ships a **self-improving harness**: a closed loop that turns the
agent's own failures into durable capability — without a human authoring
every skill, and without letting the agent mutate its own rules silently.

The design answers a demand that the wider agent ecosystem (the
`self-improving-agent` skill, Hermes' `/learn`, RangeKing's capability
ladder, AceForge's observation pipeline) only partially solves:

| Prior-art pain point | Savant's answer |
|---|---|
| Logging depends on the LLM *remembering* to log (fails under context exhaustion) | **Mechanical capture** at the hooks engine — the harness cannot forget |
| Raw logs bloat the context window | **Hybrid store** — raw traces live unloaded in `dev/experiences/`; only promoted rules reach the boot-read `dev/LEARNINGS.md` |
| Agents silently rewrite their own skills (negative transfer, prompt injection) | **Quarantine + operator-only trust** — nothing the agent authors is loadable until a human runs `/skills trust` |
| Skill history is lost or entangled with git history | **On-disk versioning** — per-skill snapshots + `VERSIONS.jsonl` ledger that survives the release-only-commits convention |
| Self-improvement pipelines need a second LLM (DSPy/GEPA) | **Usage-evidence evolution** — the loop runs on real traces through the ECHO Perfection Loop; no secondary model, no per-run token cost |

## 2. The improvement loop

```text
tool failure ──► experience-capture hook ──► dev/experiences/raw-traces.jsonl
        ▲                                            │ (unloaded, append-only)
        │                                            ▼
  operator /skills trust ◄── quarantine draft ◄── dedup: sha256(tool+error)
        │                         ▲                     │
        │   .agents/skills/       │  scripts/lessons-to-skills.ts
        ▼   (live, versioned)     │                     ▼
   skill_manage tool ─────────────┘   recurrence ≥3 in 14 days
   (Scribe + Orchestrator)                                │
        ▲                                                  ▼
        │                                     dev/agenda.md (≤50 lines)
        └──── LEARNINGS.md canonical rule ◄── Scribe session-end review
```

### 2.1 Capture (mechanical, Phase 1)

Every `PostToolUseFailure` is captured **in-process** by the
`experience-capture` hook action (declared in `protocol.config.yaml`). One
immutable event per record:

```json
{"ts":"…","triggerType":"tool_failure","toolName":"run_command",
 "errorFirstLine":"tsc: command not found","contextHash":"sha256…","sessionId":"…"}
```

- **No per-event process spawn** — the sink runs inside the hooks engine.
- **Context-hashed inputs** — raw tool arguments (which may contain
  credentials) are never persisted; only a `sha256` of the canonical JSON.
- **Path-normalized keys** — `C:\a\b` and `C:/a/b` hash identically
  (Windows/POSIX lesson).
- **Fail-open** — a capture failure can never affect execution.

### 2.2 Dedup + recurrence (Phase 1)

`bun run experiences:dedup` groups records by
`sha256(toolName + normalizedErrorFirstLine)` and computes the **persistent
cross-session frequency counter**: a pattern must appear **≥ 3 times within
a rolling 14-day window** to be a promotion candidate. Expected-failure
noise (e.g. broad-search 404s) never counts. `--purge` compacts traces older
than 14 days.

### 2.3 Promotion (Phase 3)

At session end, the **Scribe session-end review** runs:

1. **Mechanical half** (SessionEnd hook, no LLM): `scripts/session-end-review.ts`
   refreshes `dev/agenda.md` — hard-capped at 50 lines with 1-3 active
   high-leverage capabilities — and prints FID-routing candidates.
2. **Full-fidelity half** (Orchestrator end-of-turn directive): the Scribe
   cross-checks the agenda against the conversation, routes ≥3-recurrence
   patterns into RED-phase FIDs (Orchestrator direct write < 100 lines;
   Recorder above), and drafts eligible lessons into skills.

**Auto-parse lessons → skills** (`bun run lessons:to-skills`): a lesson with
an active status, ≥ 2 evidence refs, and a non-trivial guard becomes a
candidate `SKILL.md` **draft in quarantine** — via the same validation path
as the `skill_manage` tool, with `provenanceRef: lesson:<rule>` in the
ledger. Rejected drafts (never trusted within 30 days) are purged; nothing
auto-promotes.

**LEARNINGS retirement** (`bun run learnings:retire --dry-run`): at the
~1,200-line cap, superseded/historical/oldest entries move to
`dev/LEARNINGS-RETIRED.md` — **move-only, never delete** (append-only
archive).

### 2.4 Evolution (Phase 4)

`bun run skills:evolve` is an **operator-run ritual**: it aggregates ledger
evidence into candidate `SKILL.md` + FID proposals under
`dev/scratchpad/evolve-output/`, applies the semantic-preservation diff gate
(> 10% rewrite of an existing skill = HIGH risk), and **never commits or
mutates** — human review is the hard boundary.

## 3. The skill system (activated + governed)

The `skill` tool (load by name) was already wired but passive.
FID-2026-0824-012 activates it:

### 3.1 Agent authoring — `skill_manage` (Scribe + Orchestrator only)

| Action | Semver | Notes |
|---|---|---|
| `create` | `0.1.0` | New skill → quarantine draft |
| `patch` | patch bump | Anchor `oldString → newString`; **10% Levenshtein cap** per patch |
| `edit` | minor bump | Full-content replace |
| `write_file` / `remove_file` | — | `references/` sub-files (progressive disclosure) |
| `delete` | — | Quarantine drafts only |
| `rollback` | — | Agent: quarantine-scope only; operator: live via CLI |

Every mutation **snapshots the prior state first**
(`.agents/skills/<name>/versions/v<N>/SKILL.md`) and appends a
`VERSIONS.jsonl` entry:
`{seq, version, action, ts, sessionId, reason, prevSha, nextSha,
provenanceRef, semanticPreservation}`. Git is **not** the ledger
(release-only-commits convention) — the on-disk ledger is authoritative.

### 3.2 The trust boundary

- All agent-authored/patched content lands in `.agents/skills/.quarantine/`.
- Quarantined skills are **invisible** to the loader and the `skill` tool
  (explicit exclusion, not regex reliance).
- **Only a human can release**: `/skills trust <name>` moves the draft to
  live. `/skills untrust` demotes back. `/skills rollback <name> <seq>`
  restores a snapshot into the live copy.
- **`immutable: true` skills** reject every mutation — at both the engine
  and the EHEL pre-write boundary (a raw `write_file` to an immutable skill
  hard-blocks).

### 3.3 Progressive disclosure

`/skills` and the XML skill listing expose only **name + description**
(Level 0/1). Loading a skill's `SKILL.md` is Level 1; bulk procedural data
lives in `references/` and is fetched on demand with
`skill(name, path: "details/checklist.md")` — context cost is proportional
to the answer.

## 4. Operator command reference

| Command | What it does |
|---|---|
| `/skills` | Status: trusted / quarantined counts |
| `/skills list` · `/skills list --quarantined` | Table of trusted skills / untrusted drafts |
| `/skills show <name>` | Frontmatter + version history + snapshots |
| `/skills trust <name>` | **Release a draft** (operator-only) |
| `/skills untrust <name>` | Demote a trusted skill back to quarantine |
| `/skills rollback <name> <seq>` | Restore a versioned snapshot into live |

| Script (operator) | What it does |
|---|---|
| `bun run skills:check` | Validates all skills (repo gate; home skills advisory) |
| `bun run experiences:dedup` | Dedup report / `--purge` compaction |
| `bun run session-end:review` | Refresh `dev/agenda.md` + routing candidates |
| `bun run lessons:to-skills` | Draft eligible lessons into quarantine |
| `bun run learnings:retire` | Move over-cap lessons to the append-only archive |
| `bun run skills:evolve` | Emit evolution proposals (never mutates) |

## 5. Showing the user how it works (agent script)

When a user asks *"how does the self-improving system work?"* or *"show me"*,
walk the live loop — every step below is a real command with real output:

1. **Status first**: `/skills` and `cat dev/agenda.md` — shows the current
   trusted/quarantined counts and the active learning agenda.
2. **The capture seam**: open `protocol.config.yaml` → `hooks:` and point at
   the `experience-capture` action; run `bun run experiences:dedup` to show
   the ledger + recurrence counters.
3. **Author a demo skill**: use `skill_manage` (or `/skills trust` on an
   existing draft) to demonstrate the quarantine → trust lifecycle. Show
   `VERSIONS.jsonl` + `versions/` so versioning is visible, then
   `/skills show <name>`.
4. **The trust boundary**: try loading the quarantined skill with the
   `skill` tool — it fails with "not found"; then `/skills trust` and load
   it again — it resolves. This is the security story in one interaction.
5. **Immutable guard**: point at an `immutable: true` skill and show that
   both `skill_manage` and a raw `write_file` reject it.
6. **The full loop**: from a `dev/experiences/` failure, follow
   recurrence → `dev/agenda.md` → lesson → draft skill → trust.

Keep it honest: the **live boundaries** are marked NEEDS-REVIEW — the
fail-open hooks in a live HYBRID session, the `/skills trust` release path
in the real TUI, and a real session-end Scribe review producing an agenda +
a lesson-derived draft skill have not yet been operator-confirmed.

## 6. Design constraints (non-negotiable)

- **No second LLM.** DSPy/GEPA-style genetic evolution is rejected; evolution
  runs on real usage evidence through the ECHO Perfection Loop.
- **Context economy.** `dev/experiences/` and the quarantine are never
  boot-read; only curated, promoted content enters context.
- **No silent mutations.** Every change is versioned, provenance-stamped, and
  operator-gated (Law 2: Present Before Act).
- **Cost is not a constraint** (operator decision) — the Scribe's
  full-fidelity review has no token ceiling; bounds exist only for
  determinism (one review per session, tail-bounded reads, single-writer).

## 7. Files map

| Path | Role |
|---|---|
| `common/src/types/experience.ts` | `ExperienceRecordSchema` (S1-A) |
| `common/src/util/experiences.ts` | Shared normalization + dedup keys |
| `common/src/util/skill-management.ts` | `skill_manage` engine: versioning, quarantine, trust, rollback |
| `common/src/tools/params/tool/skill-manage.ts` | Tool schema |
| `common/src/constants/skills.ts` | `QUARANTINE_DIR_NAME`, version rules |
| `packages/agent-runtime/src/hooks/experience-capture.ts` | In-process capture sink |
| `packages/agent-runtime/src/hooks/engine.ts` | Builtin-action dispatch |
| `packages/agent-runtime/src/tools/handlers/tool/skill-manage.ts` | Tool handler (Scribe + Orchestrator) |
| `packages/agent-runtime/src/echo/pre-write-gates.ts` | Immutable-skill EHEL gate |
| `sdk/src/skills/load-skills.ts` | Quarantine-excluded loader |
| `cli/src/commands/skills.ts` | `/skills` operator CLI |
| `scripts/skills-check.ts` | `skills:check` validator |
| `scripts/experiences-dedup.ts` | Dedup/recurrence/purge |
| `scripts/session-end-review.ts` | Mechanical SessionEnd review (S3-A) |
| `scripts/lessons-to-skills.ts` | Auto-draft pipeline (S3-B) |
| `scripts/learnings-retire.ts` | Move-only retirement (S3-C) |
| `scripts/evolve-skills.ts` | Operator evolution ritual (S4-A) |
| `agents/scribe/scribe.ts` | Session-end review contract |
| `agents/savant/prompts.ts` | Orchestrator end-of-turn directive |
| `protocol.config.yaml` | Hook declarations (capture + session-end) |

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `/skills trust` fails with "no quarantined draft" | The draft was never created, or was purged after 30 days unreviewed. |
| A skill the agent just wrote isn't loadable | Correct — it is quarantined. Run `/skills trust <name>`. |
| `skills:check` prints errors | Only project-scoped errors fail the gate; home-dir skills are advisory (`(home)`). |
| `raw-traces.jsonl` grows | Expected — it is unloaded and deduped; `bun run experiences:dedup --purge` compacts. |
| A mutation to a governance skill is rejected | It declares `immutable: true` — operator file edits only. |
| `skills rollback` says "operator rollback required" | Agent rollback is quarantine-scoped; live restore is `/skills rollback <name> <seq>`. |

---

*Architecture decisions and the full Perfection Loop record:
[`dev/fids/FID-2026-0824-012-self-improving-harness-and-agent-created-skills.md`](../dev/fids/FID-2026-0824-012-self-improving-harness-and-agent-created-skills.md).*
