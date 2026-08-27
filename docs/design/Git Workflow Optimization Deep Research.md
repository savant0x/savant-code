# Git Workflow Optimization for a Solo Operator, Single-Committer, Agent-Coordinated Codebase — Deep Research Prompt (v2)

> **HOW TO USE THIS PROMPT (for Gemini Deep Research):**
> 1. This is version 2. A prior pass produced `docs/design/AI Solo Git Workflow Design.md` — its output is ATTACHED as a baseline and contains a **critical factual error about the operator's workflow** that invalidated several of its recommendations. Read the CORRECTED OPERATOR PROFILE below first; where the baseline contradicts it, the baseline is wrong.
> 2. The target repository is PUBLIC and Google-indexed: https://github.com/savant0x/savant-code — crawl the ENTIRE repo tree: README.md, AGENTS.md, CONTRIBUTING.md, CHANGELOG.md, the git tag history (v0.0.1 → v0.0.27+ release cadence), `protocol.config.yaml`, `templates/FID-TEMPLATE.md`, and the release automation (`scripts/public-release.ts`, `scripts/pre-push-scan.ts`).
> 3. Produce the output defined in OUTPUT FORMAT. The deliverable is an optimized workflow specification the operator will fold into his ECHO Protocol governance as checkable amendments.

---

## CONTEXT — The Corrected Operator Profile

Every fact below is observed behavior over months of daily operation. This section SUPERSEDES any assumption in the attached v1 document.

**Environment & role**
- Solo developer (single contributor: savant0x org). No teammates, no PRs, no human reviewers.
- Windows 11 host, Git Bash shell, Bun runtime.
- Repository: public, MIT, npm-published, Google-indexed.

**THE COMMIT MODEL — read carefully, v1 got this wrong**
- **AI agents NEVER execute git commands. No exceptions.** Agents edit files in the working tree; they do not stage, commit, push, branch, or merge.
- **The operator commits via exactly one agent session** (his primary interactive session), which executes git on his explicit instruction. There is exactly one committer at all times: the operator, through one designated channel.
- Therefore: there are ZERO concurrent git writers. `index.lock` contention between agents cannot occur. Commit races do not exist in this workflow.

**Concurrency model — coordinated partitioning, not free-for-all**
- The operator sometimes runs multiple AI agent sessions simultaneously (typically 2–3; he has run as many as 5 during heavy pushes). This is variable, not constant.
- Concurrent sessions are ALWAYS given clearly separated areas of the codebase (different FIDs, different directories). Agents work in parallel on disjoint scopes; they do not edit the same files.
- Cross-session file collisions have occasionally occurred and are handled by an explicit rule: implementers diff against the working tree (not HEAD) before editing and never revert another session's hunks.
- Coordination machinery that already exists: release-script worktree fingerprinting, IN-PROGRESS.md lock markers, FID ownership boundaries.

**Release pattern ("release-only public main") — NON-NEGOTIABLE, PRESERVED**
- Public `main` receives commits ONLY at curated release checkpoints (~v0.0.x annotated tags, 23+ releases), cut via custom automation (`scripts/public-release.ts`: automation commit → quality gates → tag → push) with fail-closed pre-push credential scan + ESLint + markdown lint.
- npm publish syncs with GitHub releases.
- Between releases: NO pushes to the public repo at all.
- Consequence to solve: days of work exist uncommitted on ONE disk with NO off-site backup until release day.

**Between-release reality (the actual gap being optimized)**
- Working tree routinely carries 40–100+ modified/untracked files spanning days.
- FIDs are marked closed while explicitly uncommitted ("working-tree closure").
- Overnight autonomous runs generate large change batches while the operator sleeps.
- The internal ECHO Protocol has a "Commit Gate" (planning docs must be committed to main before implementation begins) that creates friction when the tree is noisy.
- Atomic, independently revertible commits are stated as a value but NOT practiced — because commits were conflated with publishing.

**History & safety posture**
- One deliberate history rewrite (`filter-branch`, 14 commits + tag re-point) to defend authorship against ghost AI attribution. Authorship integrity is non-negotiable. Force-pushing main is otherwise banned.
- Values: local-first, zero paid services in core path, evidence-based verification, solo speed matters, ceremony without verifiable safety benefit is rejected.

---

## WHAT CHANGED FROM v1 (and why the recommendations shift)

Because there is exactly ONE committer (the operator via one session):

1. **All concurrency problems are FILE-COLLISION problems, not GIT-WRITER problems.** Worktrees-per-agent, branch-per-session, and index.lock arbitration are solutions to a problem that doesn't exist. Research should instead address: how a single committer can safely integrate changes from multiple concurrently-modified working areas, and whether lightweight patterns (path-scoped staging, per-area commits) capture the separation that already exists informally.
2. **Commit cadence is an OPERATOR HABIT question**, not an agent-directive question. The research should optimize: what checkpoints should the single committer snapshot at (per-FID closure? per-session end? daily?), given his real rhythm of multi-day WIP waves.
3. **The audit-diff-size evidence still applies** — smaller diffs remain better for LLM review — but the mechanism is "commit more often when YOU choose," never "agents commit."
4. **Backup remains the highest-value fix**: off-site durability of between-release work via private mirror remote and/or scheduled git bundles to existing OneDrive storage. Preserve clean-public-main.

---

## RESEARCH QUESTIONS

### A. Local commit discipline for a single committer
1. For a solo dev whose working tree spans multi-day WIP waves: what commit checkpoint strategy maximizes recoverability and auditability with minimal ceremony? Evaluate concrete policies: commit-at-FID-closure, commit-at-session-end, end-of-day checkpoint, or pre-release staging sweeps. Which fits an operator who works in bursts across many small features?
2. Should commits be fine-grained (per-file-group within one logical change) or coarse (one commit per logical feature/FID)? Consider the stated value "atomic, independently revertible commits" vs. the reality of 100-file trees.
3. Commit message convention for this context: evaluate conventional-commits + FID-reference hybrid (e.g., `fix(cli): token damping (FID-2026-0822-003)`) against plain descriptive messages. Which yields better later outcomes for `git log --grep`, `git bisect`, and LLM-based audit agents reviewing history?

### B. Off-disk redundancy without violating release-only public main
4. Compare concretely: (a) free PRIVATE GitHub mirror repo receiving frequent pushes of local branches, (b) scheduled incremental `git bundle` files to existing OneDrive storage, (c) both combined (dual-layer). Setup cost, failure modes, restore procedure complexity, and which preserves clean-public-main.
5. What do established solo maintainers actually do for WIP durability? Cite real practices/examples.
6. For the chosen design: exact restore-from-zero procedure if the host disk dies tonight (commands included).

### C. Coordinating multiple concurrent agent sessions (single committer)
7. Given agents NEVER touch git and always get separated areas: what residual risks remain? (e.g., two sessions editing adjacent lines of shared config files, one session's edits complicating another's verification.) What lightweight practices mitigate them WITHOUT introducing git mechanics into agent behavior?
8. Is path-scoped staging useful here (`git add <specific paths>` per area when committing), so each area lands as its own atomic commit even though sessions share one tree? Specify the practical pattern for a committer integrating 3–5 areas of completed work in one sitting.
9. When does upgrading from one-shared-tree to actual `git worktree` isolation become worth it? Define the concrete threshold (e.g., only when two sessions MUST touch the same directory simultaneously) so the operator has a trigger condition rather than standing overhead.

### D. Audit-friendly history
10. For post-hoc LLM audit passes (the operator's AI Verifier/Adversary agents review changes): how should history be structured so audits get precise file:line attribution? Linear-vs-merge preference, squash-before-release vs. preserve-granularity, and ideal diff sizes — cite published evidence where available.
11. Should the release pipeline squash the week's local commits into one release commit on main, or push them granularly at release time? Tradeoffs for changelog generation, bisectability, and public-history cleanliness.

### E. Recovery playbook
12. With regular local commits in place, specify recovery procedures for the most likely scenarios: bad change discovered hours later (revert vs. re-edit), overnight Auto Drive produces a regression (bisect with test-suite oracle), accidental destructive command (reflog/stash recovery), full disk loss (restore from mirror/bundle). Exact command sequences.

### F. Adopt / reject / defer
13. From mainstream flows (trunk-based, GitHub-flow, gitflow, stacked diffs): which specific PRACTICES earn adoption for a governed single-committer context? Be decisive — reject ceremony that doesn't buy verifiable safety or durability.
14. Local tooling worth enabling: `git maintenance start` (Windows Task Scheduler background optimization), commit templates, staged-upload aliases, stash workflows? All must be free/local/low-maintenance.

## OUTPUT FORMAT

Produce exactly these sections:

1. **Executive summary** (5–7 sentences)
2. **Corrected risk table** — risk | likelihood | impact | root cause (scoped to the TRUE workflow: single committer, partitioned concurrent agents)
3. **Recommended workflow specification** — numbered rules, concrete enough to paste into governance, each tagged with the problem it eliminates
4. **Commit checkpoint policy** — when the single committer snapshots, granularity guidance, message format spec with examples
5. **Backup/redundancy design** — chosen option(s) with runner-up, setup outline, restore-from-zero procedure
6. **Concurrent-sessions guidance** — mitigations for the true residual risks; explicit worktree trigger threshold; path-scoped staging pattern
7. **Recovery playbook** — scenario → exact commands
8. **Adopted / rejected / deferred table** — practice | source flow | verdict | reason
9. **Migration plan** — ordered, independently reversible steps from today's state; each step must respect that the tree may hold active WIP from running sessions
10. **What stays exactly the same** — explicit preservation list (release-only public main, single ownership, local-first, zero-warning gates, no agent git access)

## WHAT WE ARE NOT ASKING

- Do NOT recommend team-scale processes: PR reviews, CODEOWNERS, required approvals, merge queues.
- Do NOT give agents git access in any form — all git execution flows through the operator's single committing session.
- Do NOT recommend worktrees-per-agent or branch-per-agent as DEFAULT infrastructure; at most define the trigger threshold where temporary worktree isolation earns its cost.
- Do NOT propose changing the release philosophy: public main stays release-gated and curated.
- Do NOT propose paid tooling beyond GitHub free tier and OneDrive storage the operator already has.
- Do NOT propose rewriting public history again except in defense of authorship.

## NOTES

- Frame output as governance amendments; every rule will get an enforcement point or be marked advisory.
- Decisive recommendations with visible tradeoffs beat hedged option lists.
- Where Git documentation defines behavior precisely, cite the exact subcommand/reference page.
- The operator's philosophy in his own words, for calibration: "public main = releases only," "commits aren't publishes," "ownership above all."
