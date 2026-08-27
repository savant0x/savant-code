<!-- markdownlint-disable MD013 -->

# Savant-Code v0.0.28 — Release Notes

> **Status: in preparation (draft release body for the next version).** This
> document is the v0.0.28 release body; the full changelog is assembled from
> closed FIDs at release time (Keep a Changelog convention via `CHANGELOG.md`).

**v0.0.28 is the self-improvement release.** Savant stops waiting to be told
how to be useful: it captures its own failures mechanically, promotes what
repeats into durable rules and skills, and authors new capabilities itself —
under strict operator governance. This release lands the full
**Self-Improving Harness & Agent-Created Skills** feature
(FID-2026-0824-012, status `fixed`) and activates the skill system that was
previously wired but passive.

## What's new

### Self-improving harness (FID-2026-0824-012 — headline)

A closed loop turns the agent's own usage into capability — no human authors
every skill, and no agent mutates its own rules silently:

- **Mechanical capture** — a `PostToolUseFailure` hook with a builtin
  in-process `experience-capture` action appends one immutable record per
  failure to `dev/experiences/raw-traces.jsonl`. No per-event process spawn,
  no prompt compliance required, fail-open (capture can never break
  execution). Raw tool arguments are never persisted — only context hashes.
- **Dedup + cross-session recurrence** — `bun run experiences:dedup` groups
  failures by `sha256(tool + normalized error)` with a persistent counter;
  promotion needs **≥ 3 occurrences within a rolling 14-day window**.
  Expected-failure noise (search 404s) never counts; `--purge` compacts
  expired traces.
- **Versioned agent-created skills** — the new `skill_manage` tool
  (`create | patch | edit | delete | write_file | remove_file | rollback`),
  restricted to the **Scribe + Orchestrator**. Every mutation snapshots the
  prior state to `.agents/skills/<name>/versions/v<N>/` and appends to a
  `VERSIONS.jsonl` ledger (git is not the ledger). Patches are capped at a
  10% Levenshtein change ratio; semver rules (patch→patch, edit→minor).
- **Operator-only trust boundary** — everything an agent authors lands in
  `.agents/skills/.quarantine/` and is **invisible to the runtime** until a
  human runs `/skills trust <name>`. `/skills list|show|trust|untrust|
  rollback` is the full operator surface. `immutable: true` skills reject
  every mutation (engine + EHEL pre-write gate).
- **Proactive evolution** — SessionEnd mechanical review refreshes
  `dev/agenda.md` (≤ 50 lines, 1-3 active capabilities); the Scribe's
  full-fidelity review routes recurrences to FIDs and drafts eligible lessons
  into quarantine skills (`bun run lessons:to-skills`); `learnings:retire`
  is a move-only retirement tier for the ~1,200-line LEARNINGS cap;
  `skills:evolve` emits usage-evidence proposals without ever mutating.

### Skill system activated (was wired but passive)

- **`skills:check` validator** — frontmatter, description policy (60-char
  agent-authored), section order, command allowlist, line ceiling, version
  presence; project-scoped hermetic (home-dir skills advisory).
- **`version` + `immutable` frontmatter** with EHEL pre-write enforcement.
- **`references/` progressive disclosure** — the `skill` tool loads
  sub-files on demand (`path: "details/checklist.md"`); listings stay
  name + description so context cost is proportional to the answer.

## Verification (at FID-2026-0824-012 `fixed`)

| Gate | Result |
|---|---|
| Typecheck × 5 workspaces (sdk, common, agent-runtime, cli, agents) | ✅ |
| `fid:verify` receipt (9/9 declared gates) | ✅ stamped |
| common suite | ✅ 652 / 0 fail |
| sdk suite | ✅ 493 / 0 fail |
| agent-runtime hooks + echo + tools suites | ✅ 187 / 0 + 195 / 0 |
| scripts suite | ✅ 193 / 0 fail |
| ESLint `--max-warnings 0` (all touched files) | ✅ |
| Prettier (touched files) | ✅ |
| `skills:check` | ✅ exit 0 (hermetic) |
| `learnings:check` · `fid:verify --check` | ✅ PASS |

## Notes

- **No breaking changes.** Existing skills keep working (legacy skills
  without `version` default to `0.1.0` with a warning); the hook engine stays
  fail-open; the `/skills` commands are additive.
- **Governance:** the harness is designed to be self-governing — capture is
  mechanical, promotion runs through the ECHO Perfection Loop (Law 2 present-
  before-act on every new capability), and no agent path can release a skill.
- **Honest boundaries (NEEDS-REVIEW):** fail-open hooks in a live HYBRID
  session, the `/skills trust` release path in the real TUI, and a real
  session-end Scribe review producing an agenda + a lesson-derived draft
  skill require operator live smoke before the FID closes.

Full documentation: [docs/self-improving-harness.md](self-improving-harness.md) ·
FID record: [dev/fids/FID-2026-0824-012-self-improving-harness-and-agent-created-skills.md](../dev/fids/FID-2026-0824-012-self-improving-harness-and-agent-created-skills.md).
