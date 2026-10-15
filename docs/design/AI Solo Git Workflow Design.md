<!-- markdownlint-disable MD001 MD013 -->
<!-- MD013 is narrowly disabled for this evidence-heavy research report: long cited prose, wide comparison tables, and the verification appendix are intentionally preserved in source form, per repo convention. -->

# **Governance Protocol and Git Architecture Specification for High-Concurrency Autonomous Development**

## **1\. Executive Summary**

This report establishes a definitive architectural specification and governance protocol optimized for a solo-operator environment heavily augmented by up to five concurrent artificial intelligence (AI) coding agents. Extensive analysis indicates that the current practice of maintaining 40–100+ untracked files across a single shared working tree introduces critical vulnerabilities, including silent state corruption, fatal Git database lock contention, and the severe degradation of post-hoc LLM audit capabilities due to massive diff sizes. To resolve these friction points without compromising the operator's non-negotiable "release-only public main" philosophy, this specification mandates a transition to a multi-worktree, high-frequency micro-commit model. By leveraging Git's native object isolation via git worktree alongside automated local background maintenance and dual-layer private redundancy, the workflow achieves zero-contention concurrency. This protocol guarantees that all intermediate agent work is durably versioned, rigorously and accurately audited by LLMs, and fully recoverable, thereby preserving the public repository as an immutable record of highly vetted, curated releases.

## **2\. Current-State Risk Table**

The existing operational posture involves a single working directory manipulated by multiple autonomous entities concurrently, with work remaining uncommitted for extended periods. This configuration mimics the concurrency failure modes of distributed systems, but localizes them to a single volatile filesystem, creating overlapping domains of critical risk.

| Risk Identification | Likelihood | Impact | Root Cause in Current Workflow |
| :---- | :---- | :---- | :---- |
| **Silent File Overwrites and State Corruption** | High | Critical | Multiple agents reading and writing the same working directory concurrently lack filesystem isolation. Agent A may overwrite Agent B's changes mid-refactor, bypassing the IN-PROGRESS.md lock due to asynchronous read/write speeds1. |
| **Git Database Lock Contention (index.lock)** | High | Moderate | Git utilizes file-based locking (.git/index.lock and .git/config.lock) to protect internal repository integrity. If two agents execute Git commands simultaneously, the second receives a fatal error, abruptly terminating the session1. |
| **Complete Work-in-Progress (WIP) Annihilation** | Medium | Critical | Days of uncommitted, un-pushed work exist solely on one volatile disk. Drive failure, accidental git reset \--hard, or an erratic AI agent command results in unrecoverable, permanent data loss. |
| **Catastrophic Audit Agent Blindness** | High | High | Accumulating 40-100+ modified files produces massive diffs. LLM audit accuracy is inversely proportional to diff size; vulnerability detection F1 scores plummet from 0.657 on \<10-line diffs to 0.043 on \>150-line diffs3. |
| **ECHO Protocol Governance Friction** | High | Moderate | The internal ECHO Protocol requires committed planning documents (FIDs) before execution. In a shared tree saturated with unrelated dirty files, enforcing this Commit Gate requires manual staging overhead, significantly degrading solo velocity. |

The root cause of these vulnerabilities stems from attempting to map a multi-actor workflow onto a single-actor filesystem topology. When multiple AI coding agents operate simultaneously on the same repository, they reproduce concurrency problems while lacking human intuition to notice silent failures1. Git's internal architecture was never designed to arbitrate simultaneous edits to the same index file. Consequently, the reliance on an informal IN-PROGRESS.md lock file is insufficient, as it operates at the application layer rather than the filesystem or version control layer, leaving a wide race-condition window.

## **3\. Recommended Workflow Specification**

To eliminate the risks of concurrent operations while rigidly preserving the public release philosophy, the workflow must be fundamentally restructured around local-first concurrency isolation. The following rules constitute the new governance standard, engineered specifically to survive and empower a five-agent continuous development loop.

### **Rule 3.1: Zero-Contention Concurrency via Ephemeral Worktrees**

**Specification:** Agents shall never share a working directory. Every distinct Feature Implementation Document (FID) or agent session must be initialized within its own isolated Git worktree1. **Problem Eliminated:** Eradicates silent file overwrites and .git/index.lock contention. Each agent operates against its own index and working directory, migrating conflicts from silent data corruption during active work to explicit, mathematically verifiable merge conflicts during the integration phase.

### **Rule 3.2: High-Frequency Atomic Local Commits**

**Specification:** The practice of holding uncommitted WIP across sessions is strictly prohibited. Agents must commit their work locally at granular, sub-task checkpoints prior to moving to the next objective or ending a session. **Problem Eliminated:** Cures audit agent blindness. By enforcing micro-commits, diffs remain well below the 150-line threshold where LLM reviewer degradation occurs3. Furthermore, it instantly satisfies the ECHO Protocol Commit Gate without requiring complex stash operations.

### **Rule 3.3: The Local Integration Hub (local-trunk)**

**Specification:** The public main branch remains untouched except by the release pipeline. A new, permanent local branch designated local-trunk serves as the primary continuous integration point. All ephemeral agent worktrees branch from local-trunk and merge their completed features back into it.**Problem Eliminated:** Protects the "main \= releases only" aesthetic. local-trunk acts as a chaotic, high-velocity integration environment that absorbs the friction of concurrent development, shielding the public main branch from intermediate states.

### **Rule 3.4: Dual-Layer Background Redundancy**

**Specification:** Local commits must be automatically synchronized to off-disk locations without exposing unfinished work to the public. This is achieved via a dedicated private mirror remote (savant-code-wip-mirror) and hourly scheduled Git bundle backups to existing cloud storage.**Problem Eliminated:** Eliminates the risk of catastrophic WIP loss. Work is backed up continuously without requiring a public push, fully decoupling state durability from the heavily curated public release cycle.

### **Rule 3.5: Mandatory Background Database Optimization**

**Specification:** The local Windows host must utilize git maintenance start to configure the Task Scheduler for hourly background optimization tasks, specifically commit-graph updates and object prefetching6. **Problem Eliminated:** Prevents local Git performance degradation. The architectural shift to multiple worktrees and high-frequency commits will accelerate object database bloat; automated maintenance ensures near-instantaneous Git performance without manual intervention8.

## **4\. Commit Discipline Spec**

In a hybrid environment where AI agents are the primary committers, commit discipline must be optimized for machine generation and machine parsing. The objective is to produce a repository history that serves as a high-fidelity audit trail for post-hoc LLM analysis.

### **4.1. Granularity and Timing Interactions**

Research into automated code review activities utilizing large language models provides definitive constraints on commit granularity. Analysis of cross-model LLM code reviews demonstrates that diff size is the single dominant predictor of review quality3. When evaluating diffs under 10 lines, LLMs achieve an F1 score of 0.657; however, as diffs expand beyond 150 lines, performance collapses to an F1 score of 0.043, and the models exhibit near-zero recall on performance-related bugs or concealed adversarial changes3. Furthermore, adversarial changes distributed across large repository evolutions easily evade LLM detection when benign and malicious changes jointly occupy the auditor's active review context3.  
Therefore, agent commit timing must interact with the existing gate structure according to a **Per-Task Micro-Commit Strategy**, strictly targeting diffs under the 150-line degradation threshold:

> 1. **Per-FID State Changes:** Whenever an agent marks a discrete line item complete in the FID, it must immediately execute a commit.  
> 2. **Pre-Verification Checkpoints:** Prior to an agent invoking the automated test suite (bun test), the state must be committed. This isolates the exact codebase state that generated the test output, providing the audit agent with a perfectly correlated artifact.  
> 3. **Session Termination Sweeps:** Upon pausing or terminating a session, the agent must perform a final commit sweep of the worktree, ensuring zero uncommitted state remains resident on disk.

This granular timing completely resolves the ECHO Protocol's Commit Gate friction. The agent generates the FID, commits it locally to its isolated worktree, and instantly passes the gate without the noise of unrelated concurrent modifications blocking the compliance check.

### **4.2. Message Format and Convention**

Commit messages must adhere strictly to a hybrid format combining Conventional Commits with mandatory FID tracking. This schema produces a machine-readable git log that optimizes history for automated git bisect operations and cross-referencing by the audit agents.  
The mandated format is:\<type\>(\<scope\>): \<description\> (FID-\<YYYY\>-\<MMDD\>-\<ID\>)  
**Format Rules:**

* **Type:** Constrained to feat, fix, refactor, test, chore, or docs.  
* **Scope:** The specific architectural boundary modified (e.g., cli, engine, prompt, telemetry).  
* **Description:** Imperative mood, all lowercase, maximum 72 characters, omitting trailing punctuation.  
* **FID Reference:** The exact canonical ID of the Feature Implementation Document driving the authorization.

**Agent-Generated Examples:**

* feat(auth): implement cryptographic token damping (FID-2026-0822-003)  
* fix(cli): resolve race condition in stdout stream (FID-2026-0823-001)  
* test(engine): add boundary condition assertions for parser (FID-2026-0822-003)  
* docs(plan): initialize implementation document (FID-2026-0825-001)

By embedding the FID strictly at the end of the summary line, audit agents can perform deterministic git log \--grep="FID-2026-0822-003" queries to instantly aggregate every micro-commit associated with a specific feature lifecycle, bridging the gap between granular technical commits and high-level project governance.

## **5\. Backup/Redundancy Design**

The core architectural tension involves achieving continuous off-disk durability for days of unreleased work while fiercely protecting the "main \= releases only" aesthetic. Evaluating the options reveals that pushing wip/\* branches to the public repository is fundamentally flawed; on GitHub, branches inherit the repository's public visibility, meaning unfinished features would be instantly exposed and indexed, violating a primary constraint.

### **5.1. Chosen Option: Private Mirror Remote**

The optimal primary redundancy mechanism is the establishment of a dedicated, private mirror repository on GitHub. This solution leverages standard Git remote protocols, incurs zero financial cost, and provides real-time geographic redundancy.  
**Implementation Outline:**

> 1. **Provisioning:** Create a new private repository on GitHub (e.g., savant0x/savant-code-wip-mirror).  
> 2. **Remote Configuration:** Add this repository as a secondary remote to the local clone:git remote add private-mirror git@github.com:savant0x/savant-code-wip-mirror.git  
> 3. **Automation Routing:** The overnight Auto Drive scripts and agent termination hooks are configured to push the local-trunk branch and all active worktree branches exclusively to the private-mirror remote.git push private-mirror wip/fid-001git push private-mirror local-trunk

This architecture entirely severs the backup pathway from the release pathway. The origin remote (the public repository) remains completely untouched by day-to-day operations, receiving pushes exclusively through the scripts/public-release.ts pipeline.

### **5.2. Runner-Up: Scheduled Incremental Git Bundles**

To provide absolute local-first fallback and protect against remote authentication failures or internet outages, the architecture implements native Git bundle backups synchronized to the operator's existing OneDrive configuration.  
Git bundles package the entire repository history, objects, and references into a single .pack file, which behaves functionally identical to a remote repository but resides entirely on disk9.  
**Implementation Outline:** A Windows Task Scheduler script is configured to execute asynchronously on an hourly basis. The script generates an incremental backup containing only the new information since the last full backup, minimizing I/O and processor load13.

Bash  
\#\!/bin/bash  
\# scripts/bundle-backup.sh  
BACKUP\_DIR="C:\\Users\\Savant\\OneDrive\\Backups\\savant-code"  
TIMESTAMP=$(date \+"%Y%m%d%H%M")

\# Fetch to ensure local-trunk references are up to date  
git fetch local-trunk

\# Create an incremental bundle excluding objects already in the previous full backup  
git bundle create "$BACKUP\_DIR/incremental-$TIMESTAMP.bundle" local-trunk ^$BACKUP\_DIR/full-backup.bundle

This dual-layer redundancy (Private Mirror \+ OneDrive Git Bundles) ensures that a catastrophic failure of the local host results in a maximum data loss window of less than one hour, completely mitigating the current risk of losing days of effort.

## **6\. Concurrent-Sessions Design**

Supporting up to five concurrent AI agents interacting with a single physical repository requires strict filesystem, indexing, and dependency isolation. The selection of the underlying concurrency mechanism dictates the success or failure of the entire automation pipeline.

### **6.1. Verdict: Git Worktrees**

The architecture formally adopts the git worktree mechanism over shared trees, separate clones, and containerization.

| Dimension | Shared Working Tree (Current) | Separate Git Clones | Docker Containers | Git Worktrees (Recommended) |
| :---- | :---- | :---- | :---- | :---- |
| **Git Database** | Single .git database | Full duplication per clone | Shared via OverlayFS | Single .git database shared |
| **Filesystem Isolation** | None (File collisions frequent) | Full | Full (Mount namespaces) | Full (Separate working dirs) |
| **Index / HEAD Isolation** | None (index.lock contention) | Full | Full | Full (Per-worktree refs) |
| **Creation Velocity** | Instantaneous | Minutes (Network \+ Clone) | Seconds to Minutes | Milliseconds (Checkout only) |
| **Cleanup Complexity** | High (Untangling mixed state) | Low (rm \-rf) | Moderate (Image management) | Low (git worktree remove) |

Source data synthesized from multi-agent architectural analyses1.  
**Reasoning Grounded in the 5-Agent Reality:** Maintaining five simultaneous agents in a shared tree is statistically guaranteed to generate collisions. Agent A reading OrderService.ts while Agent B writes to it results in corrupted context windows and hallucinated diffs2. Furthermore, as identified previously, Git's file-based locking mechanism prevents concurrent index modifications.  
Git worktrees construct separate working directories that share the identical Git repository object store but maintain completely independent branches, indexes, and working files1. By deploying git worktree add ../savant-wt-api feature/api, the agent is granted an isolated environment. Five agents execute in five distinct paths on the filesystem. They can build, test, and commit simultaneously without encountering .git/index.lock fatals1. The overhead is near-zero because the underlying object database (.git/objects) is not duplicated, avoiding the massive disk consumption associated with maintaining five separate full clones.

### **6.2. Resolving the Dependency Boundary**

A documented operational limitation of git worktree add is that while it correctly checks out all tracked files, it explicitly ignores untracked and .gitignore state. Most critically, this means new worktrees are instantiated without environment variables (.env) and without dependencies (node\_modules)15. Without these components, agents are paralyzed; they cannot execute the bun test harness required for verification.  
To resolve this, the architecture leverages the extreme speed of the Bun runtime. Rather than attempting complex symlink strategies for node\_modules—which risk inter-worktree dependency contamination if agents install divergent packages—the workflow mandates a post-creation hook that performs a fresh dependency resolution.  
**The Worktree Provisioning Hook (scripts/spawn-agent.sh):**

Bash  
\#\!/bin/bash  
\# Automates worktree instantiation, environment seeding, and dependency linking

TASK\_ID=$1  
WORKTREE\_PATH="../savant-wt-$TASK\_ID"  
BRANCH\_NAME="wip/$TASK\_ID"

\# 1\. Instantiate the isolated Git worktree  
git worktree add \-b "$BRANCH\_NAME" "$WORKTREE\_PATH" local-trunk

\# 2\. Seed environment credentials  
cp .env "$WORKTREE\_PATH/.env"

\# 3\. Resolve dependencies utilizing Bun's global cache  
cd "$WORKTREE\_PATH"  
bun install

Because Bun maintains a centralized global cache (\~/.bun/install/cache), executing bun install in a new worktree does not require downloading packages from the internet16. The runtime simply creates hardlinks to the global cache, completing the dependency installation in milliseconds while maintaining absolute isolation between agent environments17. This combination of git worktree and bun install achieves container-like isolation without the heavy orchestration overhead of Docker1.

## **7\. Recovery Playbook**

Given the high-velocity, autonomous nature of this architecture, failure states are inevitable. The following playbook details the precise command sequences for the four most probable recovery scenarios, specifically tailored to the local-first, AI-driven environment.

### **Scenario A: Agent Corrupts its Own Worktree Data**

*Context: During an extended session, an agent executes a destructive file manipulation or spirals into hallucinated, invalid syntax inside its isolated worktree prior to committing.*

* **Resolution:** Because local atomic commits are enforced, the operator or audit agent can safely eradicate the uncommitted changes in that specific worktree without impacting the concurrent progress of the other four agents.  
* **Execution:**  
  Bash  
  \# Navigate to the compromised agent's specific worktree  
  cd ../savant-wt-fid-001

  \# Force the index and working tree to match the last known good commit  
  git reset \--hard HEAD

  \# Recursively remove any untracked garbage files generated by the agent  
  git clean \-fd

### **Scenario B: Auto Drive Introduces a Regression (Automated Bisection)**

*Context: The overnight 5-agent Auto Drive pipeline completes successfully, executing merges and bringing 40 new micro-commits into local-trunk. In the morning, the human operator observes that a specific CLI integration test is failing, but the origin of the fault is buried in the night's history.*

* **Resolution:** Utilize Git's native binary search capabilities (git bisect), powered by the Bun test harness acting as the automated oracle, to rapidly isolate the exact micro-commit responsible for the regression19.  
* **Execution:**  
  Bash  
  cd main-repo

  \# Initialize the binary search  
  git bisect start  
  git bisect bad HEAD  
  git bisect good \<commit-hash-from-yesterday\>

  \# Delegate the bisection to the automated test runner  
  \# Git will automatically checkout commits and run 'bun test'.  
  \# If exit code is 0, commit is marked good; if \>0, marked bad.  
  git bisect run bun test

  Upon isolating the offending micro-commit, the operator evaluates the logic. If it is unsalvageable, the specific commit is cleanly reverted: git revert \<bad-commit-hash\>19.

### **Scenario C: Speculative Feature Rejection (Total Discard)**

*Context: An agent spends three hours in a worktree attempting a complex architectural refactor. The AI audit agent reviews the final implementation and flags the approach as fundamentally flawed and unsalvageable.*

* **Resolution:** Absolute deletion of the experiment. The isolation properties of the worktree mean no complex git rebase or git reset operations are required in the main codebase, leaving zero residual artifacts4.  
* **Execution:**  
  Bash  
  \# From the main repository directory (not the worktree)  
  git worktree remove \--force ../savant-wt-experiment

  \# Delete the underlying branch associated with the failed experiment  
  git branch \-D wip/experiment

### **Scenario D: Total Host Disk Failure**

*Context: The primary Windows 11 workstation suffers a catastrophic drive failure, or the operator accidentally executes a recursive deletion of the parent project directory.*

* **Resolution:** Reconstruct the repository and the latest local-trunk state directly from the automated Git bundle residing in the OneDrive synchronization folder9.  
* **Execution:**  
  Bash  
  cd \~/Projects

  \# Clone the repository directly from the local bundle file as if it were a remote URL  
  git clone "C:\\Users\\Savant\\OneDrive\\Backups\\savant-code\\full-backup.bundle" savant-code  
  cd savant-code

  \# Re-establish the public and private network remotes  
  git remote set-url origin git@github.com:savant0x/savant-code.git  
  git remote add private-mirror git@github.com:savant0x/savant-code-wip-mirror.git

  \# Fetch latest to confirm sync status  
  git fetch \--all

## **8\. Adopted vs. Rejected Practices Table**

This architecture decisively filters mainstream enterprise Git methodologies through the stringent lens of a highly governed, solo-operator-plus-agents workflow. Overhead that does not purchase verifiable safety or directly enable AI capability is strictly rejected.

| Practice | Source Flow | Verdict | Rationale for Solo+Agents Context |
| :---- | :---- | :---- | :---- |
| **Git Worktrees** | Advanced Git | **ADOPT** | The solitary mechanism that mathematically prevents concurrent file overwrites and .git/index.lock contention across 5 independent AI sessions operating on a single host1. |
| **Atomic Micro-Commits** | Conventional | **ADOPT** | A strict requirement for AI operational capability. Post-hoc LLM reviewers fail completely on large diffs. Small diffs (\<150 lines) restore high-precision vulnerability detection3. |
| **git maintenance start** | Advanced Git | **ADOPT** | Crucial for Windows hosts. Configures schtasks (Task Scheduler) to perform hourly prefetching and commit-graph rebuilding in the background, preventing catastrophic slowdowns caused by high-frequency agent commits6. |
| **Squash / Rebase Integration** | GitHub Flow | **ADOPT** | Keeps local-trunk linear. When a worktree completes its FID, its micro-commits are squashed into a cohesive feature commit before merging. This ensures the history remains pristine for git bisect automated runs. |
| **Private Mirror Synchronization** | Custom | **ADOPT** | Delivers durable, off-machine state backup for days of WIP without pushing incomplete code to the public main branch. Solves the primary data loss vulnerability. |
| **Pull Requests (PRs)** | GitHub Flow | **REJECT** | Bureaucratic ceremony. PRs are engineered for human-to-human asynchronous communication and UI-based review. AI audit agents review local diffs programmatically with greater speed and efficiency. |
| **Branch-per-session (Shared Tree)** | Gitflow | **REJECT** | Extreme friction. Forcing five concurrent agents to constantly stash changes and switch branches within a single physical directory guarantees context loss and entirely defeats the objective of simultaneous parallel execution. |
| **Merge Commits** | Gitflow | **REJECT** | Generates non-linear graph complexity ("spaghetti history"). The AI audit model relies on direct file-to-line attribution; a linear, rebased history provides the clearest, most deterministic audit trail for LLM parsers. |
| **Heavy Pre-commit Hooks** | General | **REJECT** | Complex validation (e.g., full ESLint passes, markdown linting) must remain deferred to pre-push or integration gates. Running slow static analysis on every sub-task agent micro-commit unnecessarily chokes the high-speed autonomous feedback loop. |

## **9\. Migration Plan**

Transitioning from the current high-risk, untracked-file state to the heavily optimized multi-worktree architecture requires a sequential, independently reversible process to ensure zero data loss during the shift.  
**Phase 1: Secure the Vulnerable Current State**

> 1. Halt all AI agent execution across the host.  
> 2. Within the current uncommitted working tree, generate an emergency, pre-migration Git bundle encapsulating all state: git bundle create C:\\Users\\Savant\\OneDrive\\Backups\\pre-migration-safety.bundle \--all.  
> 3. Commit all existing 40-100+ work-in-progress files locally to a temporary quarantine branch to clean the index: git checkout \-b legacy-wip && git add . && git commit \-m "chore: secure untracked legacy state".

**Phase 2: Establish the Hub and Optimization Infrastructure**

> 1. Check out the primary release branch and construct the new local integration hub: git checkout main && git checkout \-b local-trunk.  
> 2. Initialize the background optimization subsystem for the Windows host to manage future object bloat: git maintenance register followed by git maintenance start8.  
> 3. Provision the private redundancy mirror on GitHub (savant-code-wip-mirror) and bind it to the local configuration: git remote add private-mirror \<url\>.

**Phase 3: Deploy Worktree Provisioning Automation**

> 1. Implement the scripts/spawn-agent.sh bash script (detailed in Section 6.2) to programmatically handle worktree instantiation, branch checkout, .env file replication, and bun install cache linking.  
> 2. Validate the provisioning script by generating a single test worktree and executing the test suite to confirm dependency resolution success.

**Phase 4: Agent Directive Modification**

> 1. Update the system prompt, CLAUDE.md, .cursorrules, or equivalent core agent instruction manifest.  
> 2. Inject the overriding directive: *"You operate within a dedicated, isolated Git worktree. You are mandated to commit your work utilizing Conventional Commits tagged with FID identifiers for every logical sub-task. To pass the LLM audit gate, diffs must strictly remain under 150 lines."*

**Phase 5: Dismantle and Re-integrate Legacy Work**

> 1. Spawn a dedicated worktree specifically assigned to dismantle the legacy-wip quarantine branch.  
> 2. Instruct an agent (or the operator manually) to systematically cherry-pick or copy the changes from the old untracked state into the new architecture, utilizing the newly mandated granular micro-commit discipline.

## **10\. What Stays Exactly the Same**

To unequivocally assure the operator that this architectural metamorphosis serves their core principles rather than dismantling them, the following properties remain strictly preserved and enforced:

> 1. **Public main Remains Release-Only:** The origin/main branch will continue to advance exclusively via the custom scripts/public-release.ts automation pipeline. No work-in-progress, un-audited states, or fractured builds will ever be visible to the public or indexed by search engines. The public face of the repository remains pristine.  
> 2. **Uncontested Solo Ownership Integrity:** The architecture introduces no human teammates, no forced Pull Request reviews, and no required external approvals. The single operator (savant0x) retains absolute, cryptographically verified sovereignty over the codebase.  
> 3. **Strict Local-First Philosophy:** All core computational work remains localized to the Windows 11 host. The AI agents interact strictly with the local filesystem, the bun test validations execute locally, and no paid third-party CI/CD platforms or cloud-hosted agent environments are inserted into the core development loop.  
> 4. **Zero-Warning Quality Gates:** The fail-closed credential scans, ESLint validations, and strict markdown lint hooks executed by the release script remain fully intact. The new workflow merely ensures the codebase is infinitely cleaner and highly audited *before* it interfaces with these final, unforgiving validation gates.  
> 5. **Immutability of Public History:** The deliberate history rewrite executed previously to defend authorship is fully respected and preserved. By utilizing an entirely distinct private remote for WIP backups, the public history remains mathematically unaffected, ensuring no future force-pushes or rewrites of the public main branch are necessitated by daily operations.

This specification does not alter the operator's final destination; it systematically replaces a fragile, collision-prone trail with a high-velocity, mathematically verifiable transit architecture engineered explicitly for the realities of autonomous machine development.

#### **Works cited**

> 1. How to Use Git Worktrees for Parallel AI Agent Execution | Augment Code, [https://www.augmentcode.com/guides/git-worktrees-parallel-ai-agent-execution](https://www.augmentcode.com/guides/git-worktrees-parallel-ai-agent-execution)  
> 2. Git Worktrees for AI Coding: Run Multiple Agents in Parallel \- DEV Community, [https://dev.to/mashrulhaque/git-worktrees-for-ai-coding-run-multiple-agents-in-parallel-3pgb](https://dev.to/mashrulhaque/git-worktrees-for-ai-coding-run-multiple-agents-in-parallel-3pgb)  
> 3. Automating code review activities by large-scale pre-training | Request PDF \- ResearchGate, [https://www.researchgate.net/publication/365269378\_Automating\_code\_review\_activities\_by\_large-scale\_pre-training](https://www.researchgate.net/publication/365269378_Automating_code_review_activities_by_large-scale_pre-training)  
> 4. Git Worktrees for Parallel Development: 3x Throughput with AI Agents \- James Phoenix, [https://understandingdata.com/posts/git-worktrees-parallel-dev/](https://understandingdata.com/posts/git-worktrees-parallel-dev/)  
> 5. Working with Git Worktrees in Superset, [https://superset.sh/blog/working-with-worktrees-in-superset](https://superset.sh/blog/working-with-worktrees-in-superset)  
> 6. git-maintenance(1) \- Arch manual pages, [https://man.archlinux.org/man/git-maintenance.1.en](https://man.archlinux.org/man/git-maintenance.1.en)  
> 7. git-maintenance Documentation \- Git, [https://git-scm.com/docs/git-maintenance](https://git-scm.com/docs/git-maintenance)  
> 8. What Nobody Tells You About Git Maintenance: Automating the Cleanup Your Repo Actually Needs | GitDash, [https://gitdash.dev/blog/git-maintenance-automatic-performance](https://gitdash.dev/blog/git-maintenance-automatic-performance)  
> 9. git-bundle(1) \- The Linux Kernel Archives, [https://www.kernel.org/pub/software/scm/git/docs/git-bundle.html](https://www.kernel.org/pub/software/scm/git/docs/git-bundle.html)  
> 10. git-bundle Documentation \- Git, [https://git-scm.com/docs/git-bundle](https://git-scm.com/docs/git-bundle)  
> 11. Git Backup Best Practices \- Scimus, [https://thescimus.com/blog/git-backup-best-practices/](https://thescimus.com/blog/git-backup-best-practices/)  
> 12. Using Git for Incremental Backups, [https://www.worthe-it.co.za/blog/2017-12-21-using-git-for-incremental-backups.html](https://www.worthe-it.co.za/blog/2017-12-21-using-git-for-incremental-backups.html)  
> 13. How to use a jagged chunk of a git repository \- Sketch.dev, [https://sketch.dev/blog/jagged-git-repo](https://sketch.dev/blog/jagged-git-repo)  
> 14. Incremental backups with git bundle, for all branches \- Stack Overflow, [https://stackoverflow.com/questions/12129148/incremental-backups-with-git-bundle-for-all-branches](https://stackoverflow.com/questions/12129148/incremental-backups-with-git-bundle-for-all-branches)  
> 15. \[FEATURE\] Add PostWorktreeCreate hook (or setup command) for environment initialization in worktrees · Issue \#27744 · anthropics/claude-code \- GitHub, [https://github.com/anthropics/claude-code/issues/27744](https://github.com/anthropics/claude-code/issues/27744)  
> 16. Claude Code Worktrees: Parallel Sessions Without Conflicts | Morph, [https://www.morphllm.com/claude-code-worktrees](https://www.morphllm.com/claude-code-worktrees)  
> 17. Plugins \- OpenCode, [https://opencode.ai/docs/plugins/](https://opencode.ai/docs/plugins/)  
> 18. Mastering Git Worktrees with Claude Code for Parallel Development Workflow \- Medium, [https://medium.com/@dtunai/mastering-git-worktrees-with-claude-code-for-parallel-development-workflow-41dc91e645fe](https://medium.com/@dtunai/mastering-git-worktrees-with-claude-code-for-parallel-development-workflow-41dc91e645fe)  
> 19. regression-hunt \- Online Tools, [https://tool.lu/en\_US/skill/s/dvk](https://tool.lu/en_US/skill/s/dvk)  
> 20. dotfiles/claude/settings.json at main \- GitHub, [https://github.com/ku5ic/dotfiles/blob/main/claude/settings.json](https://github.com/ku5ic/dotfiles/blob/main/claude/settings.json)  
> 21. Aliases · GitHub, [https://gist.github.com/jamerrq/e3682823995f2799c239912d35c2ed3b](https://gist.github.com/jamerrq/e3682823995f2799c239912d35c2ed3b)  
> 22. Why git bash installed in windows runs scripts in background? \- Stack Overflow, [https://stackoverflow.com/questions/46512056/why-git-bash-installed-in-windows-runs-scripts-in-background](https://stackoverflow.com/questions/46512056/why-git-bash-installed-in-windows-runs-scripts-in-background)  
> 23. Git Performance Optimization for Large Repositories \- Library \- Grizzly Peak Software, [https://www.grizzlypeaksoftware.com/library/git-performance-optimization-for-large-repositories-nxxd5xrq](https://www.grizzlypeaksoftware.com/library/git-performance-optimization-for-large-repositories-nxxd5xrq)