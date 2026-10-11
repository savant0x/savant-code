# ECHO Amendment Draft — Git Workflow Rules (v1)

**Date:** 2026-08-23
**Source:** `docs/design/Solo Git Workflow Optimization.md` (Gemini Deep Research v2, operator-approved with one correction: line-count thresholds removed in favor of logical atomicity)
**Status:** DRAFT — awaiting operator application to ECHO.md / LEARNINGS.md
**Scope:** Version-control workflow rules for single-committer, agent-coordinated operation

---

## The Nine Rules

### Rule G1 — Exclusive Operator Commit Authority
Git operations (stage, commit, push, branch, merge, revert) are executed exclusively by the
operator via the designated primary agent session. AI agents never execute git commands;
they perform file-system mutations only. There is exactly one committer at all times.

*Eliminates:* index.lock contention, commit races, history corruption by agents.
*Enforcement:* agents' tool manifests contain no git execution tools; pre-push gates remain
fail-closed.

### Rule G2 — FID Closure Requires a Commit
An FID is **closed only when its associated changes are committed locally.**
"Working-tree closure" is deprecated. When the implementing session finishes, the operator
commits the change set as part of the closure sequence; the commit hash is recorded in the
FID's Resolution section alongside the existing evidence.

*Eliminates:* multi-day uncommitted WIP accumulation, audit-context degradation, Commit Gate
friction.
*Enforcement:* FID template Resolution section gains a required `Commit:` field; Recorder
verifies the hash exists before archiving.
*Note:* this reverses the prior working-tree-closure directive — superseded by operator
decision 2026-08-23.

### Rule G3 — Logical Atomic Commits (no line-count threshold)
One commit per coherent change — normally one FID or one self-contained sub-change of a
larger FID. Commits must never bundle unrelated work. No numeric size cap: a coherent
3,000-line FID diff is one commit; unrelated fixes never share a commit.

*Rationale:* LLM audit quality degrades from *signal dilution* (unrelated changes bundled),
not raw size — frontier-model windows (256K–1M) make human-review line thresholds obsolete.
Logical atomicity preserves independent revertibility.

### Rule G4 — Path-Scoped Staging During Active Sessions
While any agent session is running, global staging (`git add .`, `git commit -a`) is
prohibited. The committer stages explicit paths per completed area, reviews the scoped diff,
and commits per area — sequentially, even when integrating several sessions' outputs in one
sitting.

*Eliminates:* capturing half-finished work from adjacent active sessions.

### Rule G5 — Offline Durability: Incremental Bundles to OneDrive
Between releases, repository state is backed up via incremental git bundles to the OneDrive
sync folder:

```bash
# baseline (once): full archive of all refs
git bundle create <onedrive>/savant-backups/savant-full.bundle --all
# recurring: incremental since last backup marker + verify + advance marker
git bundle create <onedrive>/savant-backups/savant-inc-$(date +%F).bundle last-backup..main
git bundle verify <onedrive>/savant-backups/savant-inc-$(date +%F).bundle
git tag -f last-backup main
```

Restore-from-zero: clone from the full bundle, fetch incrementals, re-link origin.
Cadence: at minimum end-of-day on active days; always before risky operations.
Public remote remains release-only — bundles are the ONLY between-release durability.

*Eliminates:* catastrophic WIP loss (single-disk exposure).

### Rule G6 — Granular History Preserved Through Release
The release pipeline pushes the week's local commits granularly to public main — no squash
into a single monolithic release commit. Public history retains per-FID attribution for
bisect and audit. The annotated version tag marks the release point as today.

*Preserves:* precise file:line audit trails across versions; bisectability of public bugs.
*Note:* public history will now show individual commits between tags rather than one
commit-per-release — accepted tradeoff for auditability (operator decision 2026-08-23).

### Rule G7 — Local Git Hygiene Automation
Enable native background maintenance once per clone:
`git maintenance start`
(Windows Task Scheduler handles commit-graph updates and incremental repack; the default
incremental strategy does not run disruptive gc while agents operate.)

### Rule G8 — Commit Message Convention
Format: `<type>(<scope>): <description> (<FID-ID>)`
Types: feat | fix | refactor | test | docs | chore | perf. Description imperative, lowercase,
≤72 chars. FID reference mandatory when an FID drove the change. Enforced friction-free via
`.gitmessage` template (`git config commit.template .gitmessage`).

*Enables:* `git log --grep="FID-..."` aggregation for audits; bisect targeting.

### Rule G9 — Worktree Escape Hatch (deferred infrastructure)
`git worktree` is NOT standing infrastructure. It is provisioned only when two concurrent
sessions must mutate the same cross-cutting directory simultaneously for separate FIDs and
cannot be sequenced. Provision → complete → merge → remove immediately
(`git worktree add ../savant-code-<fid> main` … `git worktree remove`).

## Recovery Playbook (reference card)

| Scenario | Procedure |
| --- | --- |
| Bad change found later | `git log --grep="<FID>" --oneline` → `git revert <hash> --no-edit`; reopen FID, fix forward |
| Overnight regression | `git bisect start && git bisect bad && git bisect good <last-tag>` then `git bisect run bun test`; wrapper must exit 125 on unbuildable commits so bisect skips them |
| Accidental destructive command | `git reflog` → `git reset --hard HEAD@{n}` to pre-mistake state |
| Full disk loss | Clone from OneDrive full bundle → fetch incrementals → re-link origin |

## Migration Checklist (one-time, safe on dirty tree)

1. `echo "# <type>(<scope>): <desc> (<FID>)" > .gitmessage && git config commit.template .gitmessage`
2. `git maintenance start`
3. Baseline bundle: `git bundle create <onedrive>/savant-baseline.bundle --all && git tag -f last-backup main`
4. Drain current tree: path-scoped staging per closed FID using Rule G8 messages (reversible, no rush)

## What Stays Exactly the Same

- Public main = releases only, cut exclusively via `scripts/public-release.ts`
- Single ownership; zero AI attribution in git metadata
- Zero-warning quality gates unchanged at push time
- Agents never touch git (G1 supersedes all prior ambiguity)
