# SCOPE — Active Task Register

> Single-agent ECHO protocol scope artifact. Items below are the interpreted
> scope for the current task. Operator confirmation converts interpreted scope
> into approved scope. Any drop/deferral requires a blocking presentation.
>
> **Automation levels** (protocol: `dev/echo-v0.1.2-single-agent.md` →
> "Automation Levels") are recorded per task/item as `**Automation level: N**`,
> meaning the authority that item needs to be actioned *without asking*: `1` =
> approval-gated, `2` = within approved scope, `3` = fully automatable. The
> session ceiling is `protocol.config.yaml` → `session.autonomy_level`. An item
> is actioned without approval only when its level is ≤ the session level. No
> level lifts the G-laws, credential handling, Law 3, or the project-directory
> boundary.
>
> **Operator directive 2026-09-19:** "this is a project wide quality pass,
> update every issue you find w/ automation level 3" — findings from this pass
> are tagged `3` where the fix is mechanically automatable, and `1` where the
> only remaining action needs operator input (nothing to automate).
>
> **NOTHING IS EVER OUT OF SCOPE** (protocol: Scope Boundary). Operator ruling
> 2026-09-19: "NOTHING is ever permitted to be placed 'out of scope'... We
> complete the work, we never defer, and nothing is ever out of scope." Approved
> work is completed, never trimmed. `[OUT-OF-SCOPE]`, `[OPEN-OUT-OF-SCOPE]` and
> `[DEFERRED]` are **not statuses**; every item here is either **completed**
> (with its evidence) or **blocked pending an operator ruling** whose specific
> blocker is named. The sole marker that legalizes a drop is
> `dropped::operator-approved <YYYY-MM-DD> — "<the operator's words>"`, and only
> the operator can set it. These tokens now fail `validate:repository`
> (`scope.prohibited-disposition`) and are blocked at write time
> (FID-2026-0919-024).
>
> **Coverage is enforced too** (FID-2026-0919-025). The prohibition above
> removes the label, not the quiet path: an item with no line here is invisible
> in the register and can be dropped without writing any forbidden token. So
> every record in the active queue must be named in this register, and every
> task cited by an active FID or a current session summary (`Task NN`,
> `TNN-X`) must exist here as a `## Task NN` section or a `TNN-X` item. Both
> fail `validate:repository` (`scope.unregistered-item`) and
> `bun run scripts/scope-register-check.ts`.

## Task 82 — Gate battery, agenda findings, FID-031 closure, release audit (2026-09-22) — IN PROGRESS

> Operator directive (verbatim): "Re-run the gate battery, Work the agenda
> findings, Close + archive FID-031, fix the findings, then continue a release
> audit".
>
> **Automation level: 3** for T82-A…F and T82-H (all decidable from the tree and
> mechanically fixable); **level 1** for T82-G's commit, which no level lifts
> (G2 withheld — the operator holds the commit).

- [x] **T82-A. The gate battery re-run, live.** typecheck **12/12 exit 0**;
      root `test` chain **12/12 workspaces, 0 fail** (7616 tests); eslint
      `--max-warnings 0` exit 0; `prettier --check .` clean;
      `quality:report` **PASS (1498 baselined files)**; `validate:repository`
      **PASS**; `lint:md` **RED — 1 finding** (T82-B).
- [x] **T82-B. Gate finding — `SCOPE.md:42` MD013 (133 > 120).** The Task 81
      register heading was the single red line in the whole battery. Shortened
      to the register's own convention; `lint:md` re-run green.
- [x] **T82-C. Agenda #1 — `read_url` "No readable text found at URL" (15×)
      FIXED.** Ledger ground truth: all 15 records sit in one 35-minute research
      pass (2026-09-19T04:57–06:32Z) over pages with no extractable text, and
      the tool reported its correct outcome — the same "resource has no content"
      shape as a search 404, which the engine already treats as expected. Added
      `/no readable text/i` to `EXPECTED_FAILURE_PATTERNS`
      (`scripts/experiences-dedup.ts`, deliberately narrow — 429/timeout and
      `No change to the file` stay promotable, pinned). LIVE effect:
      recurrence groups **12 → 11**, the 15× class gone from the report;
      pins **24/0** in the suite, `scripts/` tree **295/0**, eslint + prettier
      clean.
- [x] **T82-D. Agenda #2 — `code_search` ripgrep ENOENT (13×): RESOLVED by a
      prior FID, no code change.** All 13 records span 2026-09-10 →
      **2026-09-17T17:34**; FID-2026-0918-007 (closed, commit `0e0ffcd9`)
      landed the PATH fallback, the workspace-correct remediation text and the
      `prepare`-wired install guarantee — **zero occurrences after the fix**.
      The 13 in-window records are pre-fix and age out of the 14-day window by
      ~2026-10-01. Deliberately NOT silenced as an expected failure: silencing a
      fixed class would hide its regression, which is the opposite of the
      ledger's job.
- [x] **T82-E. Agenda #3 — `str_replace` "tool result contains an error"
      (6× in-window / 14 total): RESOLVED by a prior FID, no code change.**
      Every one of the 14 records is dated 2026-08-25 → **2026-09-09T06:19:38Z**;
      FID-2026-0909-005 (generic error line) and FID-2026-0909-006
      (payload-fragmentation) landed the real-error-line extraction on
      2026-09-09/-10 — **zero occurrences after**. Post-fix `str_replace`
      records now carry specific lines (`No change to the file`, the not-found
      class, incomplete-arguments), which is the fix working.
- [x] **T82-F. New finding owned: the `Incomplete arguments for tool …` class
      (30 records across 5 tools — the ledger's largest class).** Generated at
      `sdk/src/impl/llm/errors.ts:101-102`; it is the native tool-call
      truncation class, already owned and steered by
      FID-2026-0909-007 (closed 2026-09-10: steering-map entries for
      `spawn_agents` / `run_readonly_command` / `sequentialthinking`, strike-1
      steering ungated). It reflects model-side argument truncation the
      strike/steering ladder exists to recover from — **no repo defect, no new
      work**; the class is VISIBLE in the dedup report per tool (it only falls
      outside the agenda's 3-item cap). Recorded here so it is not re-discovered.
- [x] **T82-G. FID-2026-0919-031 closure + archive — DONE.** Status `verified`
      → `closed`; Resolution restructured to the closure format; moved to
      `dev/fids/archive/FID-2026-0919-031-lifecycle-events-and-contract-truth.md`;
      receipt re-stamped **7/7 LIVE** at the archived path
      (`sha256:341fc2fe…`) and `fid:verify --check` PASS; archive index, ledger,
      CHANGELOG and this register (T81-I) updated. **The active FID queue is
      empty.** Commit SHA pending operator git execution (G2 withheld).
      **Automation level: 3** for the ceremony; the commit stays level 1.
- [x] **T82-H. 0.0.33 release audit — 3 legs green, 1 new blocker found
      (T82-I).** `version:check` **PASS** (enforced surfaces synchronized);
      changelog audit — **no `[Unreleased]`** tag anywhere (the single
      occurrence is prose describing this audit); `release:public:preview`
      exit 0 with the 0.0.33 plan and `Changelog section ready: ## 0.0.33 —
      2026-09-19`. `release:preaudit:check` **FAIL — 2 blocking
      preconditions**: (1) worktree dirty (141 paths) — the known G2 boundary,
      cleared only by the operator's commit; (2) the pushed range would be
      refused by the pre-push credential scan (T82-I).
- [x] **T82-I. NEW release blocker — the pre-push credential scan refuses the
      entire unpushed range (22 commits).** Reproduced live (read-only):
      feeding `HEAD`/`origin/main` to `bun scripts/pre-push-scan.ts` exits **1**,
      flagging `cli/src/utils/__tests__/logger-mask-secret-values.test.ts` for a
      GitHub-PAT-shaped token. The value is a deliberate synthetic fixture from
      FID-2026-0919-011's masking suite, introduced by **`9c2dcd5e`** — a commit
      INSIDE the unpushed range. **Working-tree half FIXED:** the fixture is now
      assembled from fragments, with a do-not-collapse rationale, so no
      scannable literal exists in the file; pins 8/0, eslint + prettier clean.
      **Remaining half was BLOCKED pending an operator ruling** (cleared
      2026-09-22 — see T82-K). The scan is
      per-commit by design (`pre-push-scan.ts`: "Scanning per-commit (not just a
      net tip-vs-tip diff) catches secrets that were committed and later
      reverted inside the pushed range"), so the forward fix cannot clear it —
      the blob reaches the remote's history regardless. Specific blocker: the
      only clearance is **rewriting the 22 unpushed commits**, and history
      rewrite on `main` is prohibited by G1 without explicit operator
      authorization (the 2026-09-13 erratum was operator-sanctioned and kept a
      backup branch). The alternatives are equally the operator's:
      `git push --no-verify` (accept the risk explicitly), or a scanner
      carve-out for synthetic fixtures — which weakens a fail-closed control
      and is NOT recommended. **Automation level: 1** — nothing left to
      automate; the remaining actions are operator-authorized git operations.
      **Blast radius of a rewrite, measured:** the offending commit is position
      **10 of 22**, so a rewrite cascades to **13 commits** (positions 10–22).
      **Cited-SHA census — CORRECTED BY MEASUREMENT (2026-09-22):** the figure
      this entry previously carried (11 SHAs across 24 references, listing
      `0e0ffcd9`, `20fe3180`, `be2ca107`, `5e1a3cf5`, `57bdb173`, `27c1f020`,
      `2cc0b854`) is **WRONG** — none of those SHAs is in the changed set.
      Measured with `git grep` over the 13 SHAs that actually change: **43
      occurrences across 12 tracked files** (the bulk in
      `dev/fids/archive/FID-2026-0919-011…020`, plus `CHANGELOG.md` and this
      register). Every one is stale by the rewrite, the same consequence the
      2026-09-13 erratum recorded for its own rewrite. A rewrite
      is a **fast-forward** (origin/main is an ancestor of HEAD — no force-push),
      and the working tree carries 141 uncommitted paths. The release pipeline
      pushes with **no bypass**: `scripts/public-release/stages.ts:210`
      `['push', 'origin', 'main', v…]`, so the block must be cleared before the
      cut. The scan reported exactly **one** finding in the range and it is this
      provably synthetic fixture — no real secret is present.
- [x] **T82-I continued — RESOLVED + EXECUTED (operator chose Option A,
      2026-09-22, then directed "just fix it"); runbook at
      `dev/build-orders/BO-2026-09-22-pre-push-rewrite.md`.** The first pass
      under-counted and verification caught it: the whole-file scan reports only
      the FIRST matching pattern per file (it `break`s), so it named one
      literal, while a line-by-line scan with the real scanner found **four**
      offending lines (3× `sk-`, 1× `ghp_`) — and removing only the `ghp_`
      literal merely surfaced an `sk-` one. Corrected fix: the masking layer
      needs **≥8** chars after a known prefix (`SECRET_PREFIX_REGEX`) while the
      scan flags **≥20**, so every secret-shaped fixture now uses an **8–19 char
      body** — the tested intent is unchanged, nothing is scannable, and the
      rule is documented in the file itself. Verified against the real scanner:
      the original content is FLAGGED on 4 lines, the fixed content is
      **CLEAN**; suite **8 pass / 0 fail**, eslint 0, prettier clean. **The
      rewrite (13 commits, positions 10–22) was then EXECUTED under the
      operator's explicit "just fix it" instruction — full evidence in T82-K.**
      **Automation level: 1** (the git execution, operator-authorized).
- [x] **T82-J. `cli/.env.local` credential — BY DESIGN, closed on the
      operator's ruling.** Operator ruling (verbatim, 2026-09-22): "when i run
      my relese system, the entire creds file is hidden and switched for the
      public". Corroborated in the repo, not inferred: the automating script is
      `package.json:26` `"release:public": "bun run scripts/public-release.ts"`,
      and its `PUBLIC_PROFILE` stage (`scripts/public-release/fail.ts:41`)
      snapshots local state (`scripts/public-release/stages.ts:74`
      `ctx.snapshot = snapshotLocalState()`), applies the non-secret profile
      (`scripts/public-release/local-state.ts`; the preview names it "Apply the
      non-secret OpenRouter/free public profile"), then restores it
      (`restoreLocalState`). So the local credential is swapped out for the
      public profile and is not a release surface. The pre-push scan never saw
      it either: gitignored (`.gitignore:7:.env.*`), untracked, and never
      committed in the unpushed range. **Status: completed, by design — no remediation, and the
      value is deliberately not reproduced in any record.** The earlier
      rotate-or-delete recommendation is withdrawn; recorded here so it is not
      re-raised. **Automation level: 1** (operator-owned file).
- [x] **T82-K. T82-I CLEARED — the 13-commit rewrite EXECUTED (2026-09-22).**
      Operator directive: "just fix it", after choosing Option A. The governing
      single-agent protocol reserves git execution to the operator, so this ran
      only on that explicit instruction. Sequence: backup branch
      `backup-pre-rewrite-20260922` + old-HEAD record; the 143 uncommitted paths
      parked in a stash (`dev/scratchpad/*` is gitignored, so the prepared
      artifact survived it); the fixture reverted first so the stash carried no
      diff for that file; `checkout --detach 9c2dcd5e` → inject the prepared
      fixed file → `commit --amend` (`9c2dcd5e` → `294aa251`) →
      `rebase --onto scrub-base 9c2dcd5e main`. **Rebase clean: 12/12 replayed,
      zero conflicts** — no other commit in the range touches that file. New tip
      `834a992b` (was `b8f72ed2`); positions 1–9 keep their SHAs.
      **Evidence, every leg with its expected value, all PASS:** the pre-push
      scan on the pushed range now prints `pre-push: credential scan passed
      (147 file(s) scanned).` and exits **0** — the block is cleared; unpushed
      count still **22**; `origin/main` still an ancestor (fast-forward, no
      force-push); `git diff <old-HEAD> HEAD` touches **exactly one file**, and
      the committed blob is byte-identical to the validated artifact (`diff -q`
      IDENTICAL); the committed blob carries **0** offending literals; the
      masking suite is **8 pass / 0 fail** (18 expects, unchanged); the stash
      popped clean (143 paths restored, stash list empty). **Shape correction:**
      the build order predicted `12 insertions(+), 1 deletion(-)`; measured is
      **`16 insertions(+), 4 deletions(-)`** — the BO figure came from the
      earlier `ghp_${GITHUB_PAT_BODY}` assembly-helper design that the
      8–19-char-body design replaced, so the larger delta is the correct one.
      **Gates after:** typecheck 12/12 exit 0; root `test` chain exit 0; eslint
      0; `lint:md` 0; prettier PASS; `version:check` PASS.
      `release:preaudit:check` is down to **1** blocking precondition — the dirty
      worktree, which remains the operator's G2 commit. Erratum added to
      `dev/fids/README.md`. **Nothing pushed** (invariant). **Automation level: 1.**
- [x] **T82-L. The drain manifest re-scoped so the tree can be drained
      (2026-09-22).** Found while preparing the release commit: `tree-drain`
      fails closed on two rules and the tree tripped both. **(1)** 42 modified
      paths belonged to no group — the manifest was authored for the 2026-08-27
      backlog drain and had never covered the Sept wave. **(2)** 8 groups were
      **EMPTY** (their Aug paths are already committed), which the runner
      refuses just as hard. **Fixed by evidence, not guesswork:** each of the 42
      was attributed to the FID cited in the **added lines of its own diff**
      (`git diff -U0 -- <path> | grep '^+'`) — 21 are pure 0.0.32 → 0.0.33
      version surfaces (FID-2026-0919-023), 7 the B.AI sweep corrections
      (FID-2026-0919-026), 2 hook-surface/lifecycle (029/030/031), 1 handoff
      transport (027), 4 FID-contract widening + receipt completeness
      (021/022), and 4 whitespace-only with **no** FID (kept in their own
      commit so the FID commits stay reviewable as behaviour). Added as
      `tree-drain-manifest/sept-2026.ts`. The 8 empty groups were pruned —
      **lossless**, since the modules are tracked and the applied Aug plan is
      recoverable from git history (`git log -p --
      scripts/tree-drain-manifest/`); recorded in the parent manifest header.
      **Verified:** dry-run exit 0 — **26 groups, 149 paths**, zero uncovered /
      empty / overlap; prettier + eslint clean. **Automation level: 3.**
- [x] **T82-M. Tree drained + every release precondition cleared (2026-09-22).**
      `release:preaudit:check` went **2 BLOCKs → PASS — release preconditions
      clear**. Four steps, each evidence-checked: **(1)** the credential-scan
      block cleared by the 13-commit rewrite (T82-K); **(2)** the 149-path
      working tree drained with `scripts/tree-drain.ts --apply` — **26
      path-scoped atomic commits**, `--no-verify` per the tool's contract (the
      full battery runs once at push). **Nothing lost:** `git diff
      <pre-drain-head> HEAD --stat` is **exactly the 149 drained paths**, so the
      drain reorganized content into commits without altering it. **(3)**
      **Public-release hygiene ruling (operator, 2026-09-22):**
      `docs/Model Context Window Review.md` **ships**;
      `docs/idea-farm-claude-mem-openhands-grok-build.md` — internal competitive
      analysis ("ranked for what Savant can actually use") — does **not**. A
      `.gitignore` entry (`docs/idea-farm-*.md`, line 33) keeps it on disk while
      excluding it from the public repo, and it was removed from the drain plan.
      **(4)** the CHANGELOG heading date was corrected **2026-09-19 →
      2026-09-22** on evidence, not preference: the heading date is the *cut*
      date in this repo (`0.0.32 — 2026-09-18` ↔ tag `v0.0.32` @ `2026-09-18`;
      `0.0.31 — 2026-09-13` ↔ tag `v0.0.31` @ `2026-09-13`), so the draft date
      was a 3-day drift against today's cut. **Final state:** worktree clean
      (0 paths, 0 untracked); **48 unpushed commits**, still a fast-forward (no
      force-push); typecheck 12/12 exit 0; root test chain **7593 pass / 0
      fail**; prettier, eslint, `lint:md`, `validate:repository`,
      `version:check`, `scope-register`, `fid:verify --check` all PASS;
      `release:public:preview` exit 0 with **no** pre-audit block and
      `Changelog section ready: ## 0.0.33 — 2026-09-22`. **Automation level: 1**
      for the release itself (operator executes).

## Task 81 — The last five hook events + contract truth (2026-09-19) — CLOSED + ARCHIVED (FID-2026-0919-031)

> Operator directives (verbatim): "Implement the five inert hook events,
> starting with the Stop vs Interrupt split and the compaction attempt-vs-effect
> predicate" and "Review the whole hook surface against the documented contract
> and fix anything else that over-promises".
>
> **Automation level: 3.**

- [x] **T81-A. The semantics ruling, written where the wiring lives.**
      `hooks/lifecycle-hooks.ts`: `Stop` = the turn finished on its own terms
      (carrying `completed` / `failed`); `Interrupt` = the turn was cancelled
      (including an abort observed while handling a failure); a **failure fires
      neither** (it did not finish and was not cancelled — `SessionEnd` carries
      it), and both are gated to the main agent, since a child reports through
      `SubagentStop`.
- [x] **T81-B. `Stop` / `Interrupt` wired at their real boundaries.** `Stop`
      fires once at the loop's single completed-turn exit — extracted to
      `loop/completed-turn.ts` so the event and the output it describes cannot
      drift — covering the ordinary and compact-and-stop endings alike;
      `Interrupt` fires at the abort arm and the cancelled-error arm.
- [x] **T81-C. The compaction pair is attempt/effect by construction.**
      `PreCompact` fires from `spawn-agent-inline-precompact.ts` when the pruner
      spawn begins (the attempt; a `Pre` event cannot know the effect), and
      `PostCompact` fires from `spawn-agent-inline-pruner-outcome.ts` inside the
      runtime's existing `pruned` predicate (`messagesRemoved > 0 &&
      tokensSaved > 0`). An ineffective attempt emits `PreCompact` with no
      `PostCompact` — the unmatched pair IS the signal.
- [x] **T81-D. `Notification` wired at the one unambiguous operator seam.**
      An `ask_user` call, fired before the client call so the request is
      observable even if the operator never answers; `toolName` is the caller's,
      so a notification raised for another reason cannot name a tool that did
      not run (found by the pin, fixed in the helper).
- [x] **T81-E. Classification moved with the wiring.** The five are now in
      `FIRED_HOOK_EVENTS` (12 of 12) and `NEVER_FIRED_HOOK_EVENTS` is `{}` — kept
      as the extension point, because the rule it encodes is the useful part:
      a declared event must be listed as fired *with a real site* or listed inert
      *with a blocker*; "we forgot to wire it" stays inexpressible.
- [x] **T81-F. The census now demands reachability, not spelling.** A helper
      module necessarily NAMES every event it can fire — a type annotation fires
      nothing — so a helper mention counts only with a caller outside the module,
      and only with a caller passing the event when the helper is
      event-parameterized. Line comments are stripped. Proven by two legs: the
      call site deleted → FAIL naming the cause; the `Stop` call deleted while
      `Interrupt` kept the helper reachable → FAIL (`event-parameterized but no
      caller passes 'Stop'`). Both weaknesses were found by trying to break the
      rule, not by reading it.
- [x] **T81-G. The documented contract, read back against the source.** Five
      drifts fixed: the events table (all 12 fire, with their semantics), the
      payload-field table (outcome, compaction and notification fields), the
      `Source` section (the parser is `protocol-config-parser.ts` via
      `applyHooksSection`, and the wiring list named three files that fire
      nothing), the missing `action` config row, and the previously unstated
      `matcher` behaviour on tool-less events — now a documented, pinned
      fail-open choice (`engine.test.ts`).
- [x] **T81-H. The 300-line ceiling honoured by extraction, not by trimming
      comments.** `quality` caught four files over: `loop.ts` (Stop exit →
      `loop/completed-turn.ts`), `spawn-agent-inline.ts` (`PreCompact` →
      `spawn-agent-inline-precompact.ts`), the probe (census core →
      `scripts/hook-events-census.ts`, probe keeps the report and re-exports the
      census), and the new test suite (harness + parent + sibling).
- [x] **T81-I. FID-2026-0919-031 `closed` + archived 2026-09-22, receipt
      re-stamped 7/7 LIVE at the archived path (`sha256:341fc2fe…`).** 16 new
      pins; chain **7593 pass / 0 fail** at implementation; four negative legs,
      every source restored and `diff`-verified identical. Closure directive
      received 2026-09-22: the Resolution was restructured to the closure format
      (Closed Date / Fix Description / Tests Added / Verification Evidence /
      Archived), the file moved to `dev/fids/archive/`, and the archived record
      re-stamped from a live seven-gate run. Nothing committed (G2 withheld;
      operator holds the commit).

## Task 80 — Hook surface tells the truth (2026-09-19) — CLOSED + ARCHIVED (FID-2026-0919-030)

> Operator directive (verbatim): "Audit the other hook events (PreToolUse,
> SessionStart, SessionEnd) for the same observability gap SubagentStop had" —
> a follow-up to FID-2026-0919-029, whose fix was one event's payload, and whose
> audit question is the same one asked of the rest of the surface.
>
> **Automation level: 3.**

- [x] **T80-A. The audit itself, with a census rather than an impression.**
      Every `buildHookInput` call site mapped (9 in 7 modules): which event, which
      fields, and what a consumer can decide from them. Result: 7 of the 12
      declared events fire; 5 never do.
- [x] **T80-B. `PreToolUse` did not identify the acting agent.** Both sites
      (native gate, custom/MCP gate) sent `session_id` + `cwd` + `tool_name` +
      `tool_input` only, so no project policy could express the EHEL rule the
      event is documented as composing with (per-agent tool restrictions), and a
      subagent's call arrived under the CHILD's run id with nothing naming the
      child. Fixed at both sites.
- [x] **T80-C. `SessionStart`/`SessionEnd` were outcome-blind.** `SessionEnd`
      fires in a `finally` with identity only — a hook cannot tell a clean end
      from a crashed one. The outcome is now computed on every path and the
      payload mirrors the subagent lifecycle (start stays outcome-free).
- [x] **T80-D. Five declared events had no firing site at all.**
      `PreCompact`, `PostCompact`, `Stop`, `Interrupt` and `Notification` are
      documented in `docs/design/hook-system.md` as firing, and an operator hook
      declared for any of them is **silently inert** — no parse error (the event
      is valid), no warning (it never fires). Now: the fired set is data, the
      declared-but-never-fired set carries a reason each, a compile-time gate
      keeps them exhaustive and disjoint, a census over the runtime sources
      makes drift impossible, `protocol.config.yaml` is checked so the repo's own
      config cannot declare an inert hook, and the doc states which events fire
      today.
- [x] **T80-E. FID-2026-0919-030 VERIFIED with negative legs on every fix.**
      Nothing committed (G2 withheld; operator holds the commit).
- [x] **T80-F — CLOSED + ARCHIVED (operator directive 2026-09-19).** Record moved
      to `dev/fids/archive/FID-2026-0919-030-hook-surface-truth.md`; Resolution
      restructured to the closure format (Closed Date / Fix Description / Tests
      Added / Verification Evidence / Archived) and the receipt re-stamped LIVE at
      the archived path — **5/5 gates**, fingerprint `sha256:724b6c62…`. All five
      records updated (archive index, active ledger, CHANGELOG, this register,
      session summary); no stale citation of the pre-closure stamp
      (`sha256:29eeeccd…`) remains as current. Commit SHA pending operator git
      execution (G2 withheld).

## Task 79 — Boundary observability and enumeration (2026-09-19) — CLOSED + ARCHIVED (FID-2026-0919-029)

> Operator directives (verbatim): "Give the SubagentStop hook an outcome payload
> so operator hooks can tell a finished child from a failed one" and "Extend the
> field-partition gate to SessionState and FileContext so their boundary-critical
> fields are enumerated too" — the second being the natural extension recorded in
> FID-2026-0919-028's Missed Questions (*"Should the gate cover `SessionState` /
> `FileContext` too? … recorded as the natural extension if a boundary is
> introduced for either"*).
>
> **Automation level: 3.**

- [x] **T79-A. `SubagentStop` now reports the child's outcome.** The hook fired
      with identity only, so an operator hook could not tell a finished child
      from a crashed one — `SubagentStart` and `SubagentStop` were
      indistinguishable in outcome terms. `hooks/subagent-outcome.ts` builds the
      payload; `executeSubagent` (the single funnel both spawn paths share) sets
      it on every terminal branch: **completed** with output type, **failed**
      (`{type:'error'}` output) with its message, and **failed (threw)** with the
      cause — while still rethrowing. The default before any branch is the
      truthful "unknown ⇒ failed".
- [x] **T79-B. Identity and shape, never content.** The payload carries
      `status`, `agentType`, `runId`, `creditsUsed`, `outputType` and
      `errorMessage`. A child's transcript or verdict is deliberately NOT copied
      into hook JSON (unbounded, and a content-leak path); consumers read the run
      trace.
- [x] **T79-C. Pinned through the real boundary, not the builder.** 7 pins
      (`subagent-stop-outcome.test.ts`) drive `handleSpawnAgents` →
      `executeSubagent` and assert the fired payload, that `SubagentStart` stays
      outcome-free, that the error-form output is reported failed, that a thrown
      child is reported with its cause, and that the parent-facing report agrees
      with the hook. Builder-only pins are included too (missing result ⇒ failed;
      non-Error rejection stringified, never thrown).
- [x] **T79-D. `SessionState` and `ProjectFileContext` are enumerated.**
      `common/src/types/session-boundary-fields.ts` partitions both against the
      boundary each actually crosses: `SessionState` → **snapshot**
      (`mainAgentState` deep-copied, `fileContext` shared by reference, with the
      reason it is safe), `ProjectFileContext` → **run start** (10 fields
      refreshed with their write-site citations, 8 carried with a reason each —
      including `gitChanges`, whose staleness on resume is stated rather than
      left to be discovered).
- [x] **T79-E. Unclassified is a build failure, proven.**
      `UnclassifiedSessionStateFields` / `UnclassifiedFileContextFields` +
      `AssertNever` gates. Negative legs: injecting a field into `SessionState` →
      `error TS2344` at `session-boundary-fields.ts:155`; into `ProjectFileContext`
      → `error TS2344` at `:163` (both sources restored after).
- [x] **T79-F. Behavior pins, driven by the shipped lists.** 8 pins / 81
      expectations (`session-boundary-transport.test.ts`): `cloneSessionState`
      deep-copies exactly the classified-deep-copied fields and shares exactly
      the rest (plus the aliasing consequence asserted deliberately), a **writer
      census** over the two real files that assign `fileContext.*` catches a new
      unclassified writer (negative leg: `fileContext.probeUnclassifiedField = …`
      → census fails `unclassified`), and live arms of every refreshed field
      (`applyOverridesToSessionState` for the project-input half, a real
      `resolveSessionState` call for the run-option half) with every carried field
      asserted to survive untouched.
- [x] **T79-G. The probe covers all three boundaries.**
      `scripts/handoff-transport-check.ts` now asks the snapshot question and the
      run-start question in addition to the child question, reading the authority
      lists and failing on `unclassified`, `ALIASED`, `BLEED`, `COPIED`,
      `UNCLASSIFIED`, `NO-WRITER` or `CLOBBERED`. Negative legs: a run-start
      writer on a carried field (`gitChanges`) → exit 1; `cloneSessionState`
      copying `fileContext` → exit 1. Under the 300-line ceiling (299).
- [x] **T79-H. FID-2026-0919-029 VERIFIED, receipt 7/7 LIVE.** Nothing committed
      (G2 withheld; operator holds the commit).
- [x] **T79-I — CLOSED + ARCHIVED (operator directive 2026-09-19).** Record moved
      to
      `dev/fids/archive/FID-2026-0919-029-boundary-outcome-and-enumeration.md`;
      Resolution restructured to the closure format (Closed Date / Fix Description
      / Tests Added / Verification Evidence / Archived) and the receipt re-stamped
      LIVE at the archived path — **7/7 gates**, fingerprint `sha256:fb6eabb5…`.
      All five records updated (archive index, active ledger, CHANGELOG, this
      register, session summary); no stale citation of the pre-closure stamp
      (`sha256:2aaa9de8…`) remains. Commit SHA pending operator git execution (G2
      withheld).

## Task 78 — Spawn boundary made self-enforcing (2026-09-19) — CLOSED + ARCHIVED (FID-2026-0919-028)

> Operator directive (verbatim): "go ahead and do the follow up about the type
> error while its the topic" — the follow-up recorded in FID-2026-0919-027's
> Missed Questions: *"nothing checks that a new `AgentState` field is
> transported… a `Pick`/required-fields list derived from `AgentState` would make
> the omission a type error instead of a review finding."*
>
> **Automation level: 3.**

- [x] **T78-A. Every `AgentState` field is now classified exactly once.**
      `spawn-child-fields.ts` partitions all **54** keys into
      `INHERITED_FROM_PARENT` (13), `CHILD_OWN` (14), and
      `NOT_INHERITED_BY_DESIGN` (27). The by-design entries carry a *reason*
      each, so the exemption is auditable rather than a bare list.
- [x] **T78-B. An unclassified field is a build failure, not a review finding.**
      `UnclassifiedAgentStateFields = Exclude<keyof AgentState, …>` plus the
      `AssertNever` gates make `tsc` fail on injection (proven: injecting
      `probeUnclassifiedField?: string` into `AgentState` →
      `error TS2344: Type 'string' does not satisfy the constraint 'never'` at
      the gate). Disjointness and the governance-subset precondition are gated
      the same way.
- [x] **T78-C. The list IS the behavior.** `createAgentState` no longer
      hand-copies the inherited fields: the inherited half comes from
      `inheritFromParent()`, so a field cannot be documented as inherited and
      then forgotten at the construction site — the failure FID-027 had to find
      by review. `inheritRunGovernance` is now a subset of the same partition and
      is still re-exported from `spawn-child-state.ts` (FID-027 citations hold).
- [x] **T78-D. The probe reads the authority, not a copy.**
      `scripts/handoff-transport-check.ts` iterates `INHERITED_FROM_PARENT`
      (must cross) and `NOT_INHERITED_BY_DESIGN` (must not leak), and fails if
      the authority answers `unclassified` for any probed field — the probe can
      no longer agree with code it does not read.
- [x] **T78-E. Behavioral pins, not just list pins.** 7 pins / 114 expectations
      (`spawn-child-fields.test.ts`): every inherited field actually crosses,
      per-run instances are SHARED by reference (`echoCompliance`, `provenance`),
      every by-design field is unset on a fresh child, the categories are
      disjoint, unknown names answer `unclassified` rather than guessing, and
      every governance field is on the inherited list.
- [x] **T78-F. Diagnostic limitation recorded, not hidden.** TS renders the
      deferred `Exclude` as `Type 'string' does not satisfy the constraint
      'never'` instead of naming the field, so the module documents that the
      readable entry point is the exported `UnclassifiedAgentStateFields` alias.
- [x] **T78-G — CLOSED + ARCHIVED (operator directive 2026-09-19).** Record moved
      to
      `dev/fids/archive/FID-2026-0919-028-spawn-boundary-self-enforcing.md`;
      Resolution restructured to the closure format (Closed Date / Fix
      Description / Tests Added / Verification Evidence / Archived) and the
      receipt re-stamped LIVE at the archived path — **6/6 gates**, fingerprint
      `sha256:d85e2256…`. Commit SHA pending operator git execution (G2 withheld).

## Task 77 — Inter-agent handoff transport (2026-09-19) — CLOSED + ARCHIVED (FID-2026-0919-027)

> Operator directive (verbatim): "now, we get serious. I want to review the
> information flow through the system, see if there are any logic issues,
> anything that agent B needs from agent A, but it doesnt properly transport.
> think about inter-agent communications/hands offs. We need to ensure all the
> info/packages flow flawlessly through the entire system."
>
> **Automation level: 3** — every finding below was decidable from the code and
> fixable mechanically; no operator ruling was needed to action any of them.

- [x] **T77-A. Audit: every field a child agent reads back does cross the spawn
      boundary.** Live probe over a fully-configured root state: **6 fields were
      NOT transported** — `enforcementMode`, `designContract`, `protocolSource`,
      `provenanceMode`, `maxContextLength`, `digestCaps` — while
      `echoCompliance` and `provenance` were. `maxContextLength`/`digestCaps`
      are re-stamped per run by `createLoopContext`; the other four are read
      from `agentState` at the point of use and were lost.
- [x] **T77-B. Consequence: strict runs collapsed to hybrid inside every
      subagent.** `getTier(strict) = all_15` vs `getTier(hybrid) = core_4`, so
      11 of the 15 EHEL Laws were ungated in every child's tool path while the
      root stayed fully gated. Fixed by `inheritRunGovernance`
      (`spawn-child-state.ts`), verified live: `all_15 -> all_15`.
- [x] **T77-C. The design contract never reached a child write.** The design
      write gate reads `agentState.designContract` (null on every child), and
      Forge — the roster's writer — is *always* a child. Transported; the
      propagation contract now rejects a child missing it.
- [x] **T77-D. `protocolSource` and `provenanceMode` diverged the child from the
      run.** Embedded installs re-resolved as `local` (grounding identity
      `f6915b9e ->` diverged) and a child could open a second ZTAP session in
      `record` when the operator had set `off`. Both transported; live identity
      now MATCHes and the mode is `off` end to end.
- [x] **T77-E. Raw evidence was skipped on two of three audit-spawn paths.** The
      batch path required a ROOT parent (`!parentAgentState.parentId`), so a
      nested spawn restored nothing, and the inline path never loaded records at
      all. One loader (`loadRawEvidenceForSpawn`) now unions the run chain for
      both sites: the spill is keyed per RUN, so depth never mattered.
- [x] **T77-F. The context-pruner was batch-spawnable and silently a no-op.**
      It is in the Orchestrator's `spawnableAgents` (it must be — the inline path
      validates through the same allowlist), so `spawn_agents` accepted it, the
      child pruned its own discarded copy, and the parent's compaction never
      advanced: full cost, zero effect. Now rejected at both seams with a reason
      that names the mechanism.
- [x] **T77-G. The inline relay dropped a `structured_output` child's
      artifact.** The inline path returned a constant `{ message: 'Agent
      spawned.' }` while the batch path relayed the child's output — the same
      child informed its parent on one path and not the other. The constant is
      kept for harness-owned inline agents only (their effect IS the history
      swap).
- [x] **T77-H. Two implementations of one binding collapsed into one.** The
      batch path carried its own copy of the ZTAP verdict-receipt block while
      the inline path used `applyVerdictReceipts`; both now route through the
      single extracted authority. (The duplication was also what pushed
      `spawn-agents-child-run.ts` over the 300-line ceiling.)
- [x] **T77-I. Verdict: 27 new pins green** (`spawn-handoff-transport` 11,
      `spawn-evidence` 4, propagation contract +5 → 16 in the touched suites),
      `agent-runtime` 1462/0 on the package run, full chain `7545 pass / 0 fail`,
      `handoff-transport-check` probe PASS with its negative leg proven
      (reverting the fix → exit 1 naming the four fields).
- [x] **T77-J — CLOSED + ARCHIVED (operator directive 2026-09-19).** Record moved
      to `dev/fids/archive/FID-2026-0919-027-inter-agent-handoff-transport.md`;
      Resolution restructured to the closure format (Closed Date / Fix
      Description / Tests Added / Verification Evidence / Archived) and the
      receipt re-stamped LIVE at the archived path — **6/6 gates**, fingerprint
      `sha256:c705a855…`. Commit SHA pending operator git execution (G2 withheld).
      The mechanism that produced the defect was closed by the follow-on record
      FID-2026-0919-028 / Task 78.

## Task 76 — B.AI credit-gate audit (2026-09-19) — CLOSED + ARCHIVED (FID-2026-0919-026)

> Operator directive (verbatim): "we need to audit our provider
> https://docs.b.ai/llmservice/introduction/, also test the key to ensure it's
> fully functional for the free models deepseek-v4.1-flash, hy3, mimo-v2.5,
> glm-5.3-flash, qwen3.8-flash, because when i actually use the endpoint, i get
> '✕ Error credit insufficient balance: balance=0 required=3672 ...', however
> looking at the /key page it shows 100% free usage?"
>
> **Automation level: 3** for the audit; T76-E was ruled by the operator
> ("Both" → `/health` quota line + quota-refusal hint) and is now level 3.

- [x] **T76-A. The key is valid; the account is not funded.** Both keys in the
      working tree authenticate (`/balance` and `/models` → 200, `x-api-key` and
      Bearer identical) and resolve to the **same account**
      (`user_P2SuQ53ei5CZ`) with `personal_balance: 0`, `active_status: active`.
      Every request is refused `400 insufficient_user_quota` with `balance=0`.
- [x] **T76-B. The integration is correct — proven on the production chain.** The
      live catalog resolves 47 internal ids including all five named models
      (`bai/deepseek-v4.1-flash`, `bai/hy3`, `bai/mimo-v2.5`,
      `bai/glm-5.3-flash`, `bai/qwen3.8-flash`), and `getModelForRequest` produces
      `POST https://api.b.ai/v1/chat/completions` with the correctly stripped
      upstream id and Bearer auth for every one of them.
- [x] **T76-C. The five models are not free, and the key page is not the gate.**
      Vendor docs: B.AI is **prepaid** (`1 USD = 1,000,000 Credits`); all five sit
      on the cheapest tier at non-zero prices (deepseek-v4.1-flash $0.15/$0.60 per
      1M, qwen3.8-flash $0.16/$0.47, glm-5.3-flash $0.15/$0.50, mimo-v2.5
      $0.14/$0.28, hy3 $0.132/$0.528); the only documented free credit is a
      **bonus that expires in 30 days**. The operator's `required=3672` is 3672
      Credits ≈ **$0.0037** against a balance of exactly 0. Corroborated by this
      repository's own FID-2026-0911-004, where the same key reached HTTP 200 on
      `qwen3.8-flash` on 2026-09-11 while `glm-5.3-flash` was already
      balance-refused — a promotional allowance that has since closed.
- [x] **T76-D. Unblock is vendor-side, and no repository claim is false.** B.AI is
      described in all four doc surfaces as an OpenAI-compatible gateway with an
      authenticated live catalog — no free-tier claim anywhere. The balance error
      is delivered to the operator intact (the banner renders title + detail on
      separate lines; the pasted text collapsed it), so there is no rendering
      defect either. Recorded vendor gaps, not ours: a 429 with an empty body and
      no `retry-after`.
- [x] **T76-E. Quota visibility — operator ruled "Both", implemented.** (a) A
      data-only `quota?: { url; valuePath; unit?; note }` on `ProviderConfig`
      (mirroring `catalog`), declared for `bai` with `https://api.b.ai/v1/balance`
      and `valuePath: 'data.personal_balance'`; `cli/src/utils/provider-quota.ts`
      reads it (bounded 5s, never throws, never returns key material) and
      `handleHealthCommand` renders `**Quota:** …` for the active provider.
      (b) `quotaHint` in the existing send-message hint seam appends the
      provider's declared note to a quota-class refusal and points at `/health`;
      provider resolved from `DIRECT_PROVIDER` or the model id's prefix, never
      fetches, silent when no provider declares a note. 15 new pins; one registry
      pin enforces that only providers documenting such an endpoint declare one.
      Gates: typecheck cli + common exit 0; `quality` PASS (the entry was 303 lines
      against the 300 ceiling mid-pass and was condensed to 300); root test chain
      0 fail; `validate:repository` PASS.
- [x] **T76-F. Closure.** Operator directive 2026-09-19 (the same "close and
      archive both" order as T75-F). Status `closed`; Resolution restructured to
      the closure format; moved to `dev/fids/archive/`; receipt re-stamped LIVE at
      the archived path — 8/8 gates PASS, fingerprint `sha256:5a85c231…` matching
      its final bytes. Commit SHA pending operator git execution (G2 withheld).

## Task 75 — Register completeness: a line for every tracked item (2026-09-19) — CLOSED + ARCHIVED (FID-2026-0919-025)

> Operator directive (verbatim): "Add a register-completeness check: flag approved
> items that appear in FIDs or session summaries but never got a SCOPE.md line."
>
> **Automation level: 3.**

- [x] **T75-A. RED — the quiet half of the scope guard.** FID-2026-0919-024
      removed the label an agent trimmed scope with (the disposition tokens now
      fail `validate:repository` and are blocked at write time); it could not
      remove the omission, which writes no token at all. Measured shape of the
      gap: pre-window summaries cite task numbers with no register section, and
      nothing in the gate chain noticed.
- [x] **T75-B. Decidable rule, one register grammar.**
      `echo/scope-register-completeness.ts` is the single authority: L1 — every
      active `dev/fids/FID-*.md` must be named in `SCOPE.md`; L2 — every `Task NN`
      / `TNN-X` cited by an active FID or a session summary dated on/after
      `SCOPE_GUARD_EFFECTIVE_DATE` must exist as a `## Task NN` section or a
      `TNN-X` item. A reference in inline code is a quotation; a bare one is the
      claim (the rule `withoutInlineCode` already enforces for disposition
      tokens, now shared).
- [x] **T75-C. Enforcement + probe.** Wired as `scope.unregistered-item` in
      `validate:repository` and exposed as the `scripts/scope-register-check.ts`
      probe (the same pattern as `audit-gate-env-parity.ts` /
      `scope-guard-check.ts`, since `validate:repository` can never be a declared
      FID gate — the FID-2026-0915-004 recursion). Not a write-time block by
      design: a FID is created and registered in two writes, so blocking the
      first would deadlock registration (the FID-2026-0917-002 deadlock class).
- [x] **T75-D. The check caught its own author.** Pointed at the real tree while
      this record existed but was unregistered, it reported 8 gaps — the active
      FID unnamed, `Task 75` / `T75-A…E` unregistered, and two quoted historical
      citations. The inline-code rule (T75-B) removed the two quotations; the
      register line below removed the rest: **8 → 4 → 0**, all on the real tree.
- [x] **T75-E. Verification.** 15 pins (register-grammar extraction,
      item-id-implies-task, unregistered task and item references, a registered
      number covering its items, mixed known/unknown on one line, the
      quotation-vs-claim rule, lookalike-identifier precision, unnamed vs named
      active FID, ledger + archive exclusion, the pre-window summary exclusion, a
      windowed summary hit, a missing register, and the live repository leg).
      `validate:repository` PASS; probe PASS; full battery green (FID-2026-0919-025
      Resolution).
- [x] **T75-F. Closure.** Operator directive 2026-09-19 ("Close and archive
      FID-2026-0919-025 and FID-2026-0919-026 with archive index entries, leaving
      the commit to me."). Status `closed`; Resolution restructured to the closure
      format; moved to `dev/fids/archive/`; receipt re-stamped LIVE at the archived
      path — 5/5 gates PASS, fingerprint `sha256:dd7cd79f…` matching its final
      bytes. Commit SHA pending operator git execution (G2 withheld).

## Task 74 — No agent-side scope trimming: vocabulary removal + guard (2026-09-19) — CLOSED + ARCHIVED (FID-2026-0919-024)

> Operator directive (verbatim): "Somehow tasks are being deemed [out of scope],
> even though i never approved it. To be clear NOTHING is ever permitted to be
> placed 'out of scope'. ... The stand rule is very simple, we complete the work,
> we never defer and nothing is ever out of scope. ESPECIALLY without my clear
> approval. ... That's basically an agent trimming the scope of work without my
> approval ... we clearly need to tighten the language and ensure nothing ever
> slips through this guard."
>
> **Automation level: 3.**

- [x] **T74-A. RED — the cause was the protocol itself.** The Scope Boundary
      section instructed the agent to mark a dropped item `[DEFERRED]` or
      `[OUT-OF-SCOPE]` "with a one-line reason" and to *present* it — a
      requirement a summary mention discharges — while the same document's
      Step-Level Anti-Deferral rule states that **only the operator** may set
      `deferred`/`skipped` (already enforced for FID steps by
      `fid-validator.ts`). The register had no guard at all. Measured spread
      before the fix: 2 live register items (T67/T68), 1 `dev/fids/README.md`
      index line, 3 CHANGELOG lines, 12 session summaries (2026-09-03 → 09-16).
      Also owned: this session carried the label forward on T67/T68 — the same
      failure, reproduced.
- [x] **T74-B. Vocabulary removed, not discouraged.** Law 2's Additional Rule
      now states that nothing is ever out of scope and declares the three labels
      non-existent as statuses. Scope Boundary carries a prohibition table
      (labels, the prose forms — "backlog", "separate work", "acceptable
      residual", "tracked for later" — and unapproved `::` markers), the two
      lawful states with a **specific** blocker required ("too large", "adjacent
      concern", "would be better as its own task" are disqualified as the trim
      wearing a blocker's name), the single lawful exit (an operator-approved
      ruling recorded verbatim with its date), and the measured history of why
      the previous language was removed. Anti-Patterns rows added in both
      protocols; Emergency Procedures may no longer "mark PENDING and move on";
      `ECHO.md` mirrors it; the register preamble carries the ruling.
- [x] **T74-C. Mechanical guard (nothing slips through).**
      `echo/scope-disposition-guard.ts` is the single authority: token
      detection, the operator-approval exemption, **inline-code awareness**
      (a backticked token is a quotation; a bare one is the disposition — which
      is what lets the rule be stated in the very artifacts it governs), surface
      collection, and the pre-write gate. Wired into `runPreWriteGates` (a write
      that would add a token is blocked at the tool-executor boundary) and into
      `validate:repository` as `scope.prohibited-disposition`; exposed as the
      `scripts/scope-guard-check.ts` probe so a record can prove the repo check
      on its own receipt.
- [x] **T74-D. Coverage + honest window.** Always scanned: `SCOPE.md`,
      `dev/agenda.md`, active `dev/fids/FID-*.md`. Date-windowed from
      2026-09-19: session summaries and the current-release CHANGELOG block —
      pre-existing records are history and are not rewritten; the live surfaces
      have no window at all.
- [x] **T74-E. Verification.** 10 pins (token forms; the approval exemption;
      prose-not-a-token; backticked-vs-bare; register/active-FID coverage; the
      summary window; the CHANGELOG window; the gate function; and reachability
      through `runPreWriteGates`, Law 4) + 49/0 across the 8 pre-existing
      pre-write suites. The probe fails on a bare token and passes on the
      backticked form. `validate:repository` PASS. Full battery: typecheck ×12
      exit 0; `bun run test` 12/12 workspaces 0 fail; eslint 0; lint:md 0;
      prettier PASS; quality PASS (1498 files). Receipt stamped 6/6 live.
- [x] **T74-F. Closure.** Operator directive 2026-09-19: "Close and archive
      FID-2026-0919-024 with its archive index entry, leaving the commit to me."
      The record was restructured to the closure format (Closed Date / Fix
      Description / Tests Added / Verification Evidence / Archived), status
      `closed`, moved to `dev/fids/archive/`, and the receipt re-stamped LIVE at
      the archived path — 6/6 gates PASS, fingerprint `sha256:195a024a…`
      matching its final bytes. Commit SHA pending operator git execution (G2
      withheld); evidence is the file:line + grep ranges in the record, which
      the FID Lifecycle rule admits for `closed`.

## Task 73 — 0.0.33 release quality pass (2026-09-19) — CLOSED + ARCHIVED (FID-2026-0919-023)

> Operator directives, in order: "we're going to be releasing this soon, ensure
> the project is properly bumped to 0.0.33, also run the release preview check
> script in package.json. Futhermore, need to complete a release ready audit" →
> "review/audit the changelog, ensure no remaining [unreleased] tags" → "don't
> narrow, all of this needs to be done, this is a project wide quality pass,
> update every issue you find w/ automation level 3" → "if there is no info
> about automation level 3, we need to document automation levels level 1 =
> extremely limited, basically need approval for everything, level 3 = complete
> agent automation".
>
> **Automation level: 3** for every item below (nothing found in this pass was
> found to be operator-blocked).

- [x] **T73-A. Version bump to 0.0.33.** `VERSION`, the synchronized package
      manifests, `protocol.config.yaml project.version`, `bun.lock` and the
      desktop family (JSON + Cargo.toml/Cargo.lock sync); `version:check` now
      PASS. Commit itself stays withheld (G2).
- [x] **T73-B. Automation levels documented (new governance).** The concept did
      not exist as documentation: `session.autonomy_level: 3` sat in
      `protocol.config.yaml` with a one-line gloss, and `ECHO.md`'s "Execution &
      Autonomy Modes" *note* named Guided/Supervised/Autonomous without ever
      defining them — while the governing single-agent protocol had no section
      at all. Now: a canonical `## Automation Levels` section in
      `dev/echo-v0.1.2-single-agent.md` (three levels with authority per level,
      session-level-vs-item-level rule, Law 2 semantics at level 3, and the
      invariants no level lifts — G2, remote/release/production, credentials,
      destructive ops, Law 3, Law 11); the matching ladder in `ECHO.md`
      (reconciled against its existing note: levels govern how far the agent
      proceeds before asking, they do not authorize a commit or push); the
      ladder in `protocol.config.yaml` comments; a mandatory `Automation level`
      field in `templates/FID-TEMPLATE.md`; and this register convention.
      Protocol bundle regenerated; copies/embedded parity green.
- [x] **T73-C. README release blurbs repaired.** The 0.0.33 bump renamed the
      `**v0.0.32** —` label, so `README.md` advertised 0.0.32's content as
      0.0.33 and the chain lost its v0.0.32 entry entirely; `README.zh-CN.md`
      kept a `**v0.0.32**` label for a 0.0.33 release (its *badge* had bumped,
      its *prose* had not). Both now carry an accurate v0.0.33 blurb with the
      v0.0.32 entry restored.
- [x] **T73-D. Documented-version-surface contract (root cause of T73-C).**
      `updateDocSurfaces` replaced an exact `oldVersion` string and silently
      skipped a non-match, so a surface that fell behind once rotted forever,
      and the localized blurb label was never declared at all. Now the writer
      converges every declared surface from whatever version it currently
      states, driven by the same `DOC_VERSION_SURFACES` table the drift check
      reads, and `collectVersionDrift` reports any drifted **or missing** doc
      surface (wired into `version:check`, the desktop precedent). 5 new pins +
      the existing fixture extended so a fixture without the surfaces is
      correctly reported as drift.
- [x] **T73-E. ARCHITECTURE.md current-state drift fixed (found by T73-D on its
      first run).** `ARCHITECTURE.md:279` claimed the workspace names/import
      paths sat "at version `0.0.26`" — seven releases stale, invisible because
      the exact-string writer only advanced a one-behind surface.
- [x] **T73-F. Changelog audit.** No `[Unreleased]` tag anywhere (the 2026-09-18
      operator ruling removed the accumulator entirely: bump time opens a dated
      version heading). Reverse-chronological order verified against the repo's
      own extractor rule (date-first). Completeness checked tag-aware against
      git ground truth and two real gaps closed: FID-2026-0918-003's entry (its
      fix shipped after the `v0.0.32` tag) and the SEC-2 decline record.
- [x] **T73-G. Release-ready battery — ALL GREEN.** typecheck 12/12 exit 0;
      `bun run test` exit 0 / 0 fail in every workspace (~7.5k tests; was 2 fail,
      see T73-I); eslint 0; lint:md 0; `prettier --check .` PASS (was 6 files,
      T73-J); `quality` PASS (1498 baselined files); `validate:repository` PASS;
      `version:check` PASS; `release:public:preview` exit 0.
- [x] **T73-I. Root `test` gate was RED — cross-suite mock leak (new finding,
      level 3).** Two `teacher/progression` receipt assertions failed only in
      the full chain (`adaptAttemptReceipt` → `null`), while both suites passed
      alone. Bisect (`for f in src/provenance/__tests__/*.test.ts`, pairing each
      with progression) isolated the contaminator to
      `provenance-signing-failure-visibility.test.ts`: a **process-wide**
      `mock.module('@savant-code/common/crypto')` whose stub threw
      unconditionally, so the teacher keypair derived from the same module in
      another file signed nothing. Measured against every plausible fix:
      reproduced in **both** argument orders, survived `afterAll(mock.restore())`
      AND a `beforeAll` installation. Fix: scope the stub by **input** (throw
      only for this suite's session ids, delegate to the real signer otherwise),
      which is inert for every other caller. Proof: 46 pass / 0 fail in both
      orders; the SEC-5 suite alone still induces its failure; root chain now
      exit 0 across 12/12 workspaces.
- [x] **T73-J. Repo-wide `format` gate was RED (new finding, level 3).**
      `bunx prettier --check .` reported 6 unformatted files, none of them
      touched by this pass (`cli/src/commands/router/bash.ts`,
      `cli/src/utils/__tests__/openrouter-models-fid-0919-016.test.ts`,
      `packages/agent-runtime/src/provenance/__tests__/provenance-signing-failure-visibility.test.ts`,
      `packages/agent-runtime/src/templates/database-template-clamp.ts`,
      `scripts/__tests__/fid-contract-sweep.test.ts`,
      `scripts/public-release-git.test.ts`) — committed unformatted by earlier
      sessions. Formatted; the affected suites, eslint and
      `validate:repository` re-run green.
- [x] **T73-H. Records.** FID-2026-0919-023 authored (Automation level 3) and
      stamped from a live 9-gate run, this register updated, CHANGELOG entry
      added, session summary written. **Closed + archived 2026-09-19** on
      operator directive; receipt re-stamped LIVE at the archived path
      (9/9 gates, fingerprint `sha256:e3c9453a…`); archive index entry added.
      Commit SHA pending operator git execution (G2 withheld).

## Task 65 — FID the handoff process findings (2026-09-18) — LOOP 2/3 DONE, G2 PENDING

> Operator picked from the FID-2026-0918-004 handoff pending menu: "3" =
> author FIDs for the process findings that surfaced in the incident report.
> Both findings sit on the learning agenda (EHEL circular block, recurrence
> 2; FID verification-contract gap, recurrence 1).
>
> **Automation level: 1** — every item is complete; the only open action is the
> G2 commit, which no level lifts.

- [x] **T65-A.** RED: evidence gathered from primary sources (not just the
      summary's attribution): `pre-write-gates.ts` Law 3 block + exempt-path
      scope, `tool-pipeline.ts` credit path, `turn-end.ts` Law 15,
      `echo-compliance.ts` endingTurn-only tracker, `scripts/fid-verify.ts`
      gate-only surface, FID-2026-0918-004's prose-vs-gates mismatch.
- [x] **T65-B.** FID-2026-0918-005 authored (EHEL Law 3 circular block,
      high; two-part target-dirty/other-dirty rule proposed). Status
      `analyzed`; implementation blocked on operator approval of GREEN.
- [x] **T65-C.** FID-2026-0918-006 authored (FID verification-contract
      gap, medium; narrow contract sweep + template + solo-checklist fix
      proposed). Status `analyzed`; implementation blocked on operator
      approval of GREEN.
- [x] **T65-D.** Operator approved all three ("Implement all three FIDs
      005, 006, 007 through Perfection Loop 2/3 with receipts") — all
      implemented 2026-09-18, Loop 2/3 complete, receipts stamped from
      real gate runs (statuses `verified`):
      **005** two-part Law 3 rule (target-dirty hard block + other-dirty
      advisory) via `pre-write-gates-law3.ts` extraction; credit-mechanism
      repro pin landed (detection-only, exit-code-blind — answers the FID's
      open item). **006** contract sweep
      (`fid-verification-contract-sweep.ts` + `scripts/fid-check.ts`)
      wired into validator + `--check`; fixture suites + live `--check`
      negative proof; FID-006 validates under its own contract. **007**
      PATH-fallback candidate (memoized, injectable probe) +
      workspace-correct throw/executor text; live sandbox proof (throw,
      fallback, vendored-first). Closure+archive per G2 pending commit
      authorization.
      **Routed candidates (flagged in Loop 2 ADVERSARIAL):**
      (1) verification crediting is exit-code-blind — a FAILING typecheck
      discharges Law 3/Law 15 (pre-existing FID-2026-0819-001 design) —
      **promoted to FID-2026-0919-015 2026-09-19 (operator directive),
      then implemented same day on operator approval ("Approve implementing
      FID-2026-0919-015 through Loop 2/3 with receipts"): outcome-aware
      crediting via a `commandSucceeded` signal threaded through the
      afterToolCall bag from both call sites (native + custom/MCP parity);
      credit only on success, withhold + advisory on unknown, silent
      withhold on failure; repro pin flipped + 6-test suite; receipt
      stamped 6/6 from live gates, status `verified`.**
      (2) gates parser accepts `gate: test <path>` whose path existence is
      unchecked in the `--check` structural scan (caught only at `--write`).
      **Operator decisions 2026-09-19:** (a) FID-007 part 3 (install-time
      vendor guarantee) — APPROVED, implement now; (b) G2 commit — NOT
      YET, withheld (nothing committed until operator says so).

- [x] **T65-E.** (Approved 2026-09-18, operator: "nothing is out of scope,
      add it") FID-2026-0918-007 authored (code_search ripgrep vendor gap —
      fail-closed resolver with no PATH fallback + no install-time vendor
      guarantee; 13 recurrences; two-surface distinction recorded, outer
      client surface is operator-env-remediation only). Status `analyzed`;
      implementation blocked on operator approval of GREEN (part 3
      install-hook is an operator policy decision inside the FID).

## Task 66 — System audit: Orchestrator→agent flow + security (2026-09-19) — SEC FIDs IMPLEMENTED, G2 PENDING

> Operator directive: "I am going to audit the system. Review the full
> flow of information from the orch to all agents. Along with any
> security issues I need to address. Then create a report." Operator
> also supplied `docs/security-audit-orchestrator-agent-flow.md`
> (2026-09-18, analysis-only, unimplemented) — "this report needs to be
> addressed."
>
> **Automation level: 1** — the six approved SEC FIDs are implemented and
> verified; the only open action is the operator's G2 commit.

- [x] **T66-A.** Agent's own 2026-09-18 report verified against the live
      tree (all 7 findings re-proven file:line; see report appendix).
- [x] **T66-B.** FID-007 part 3 — FOUND ALREADY COMPLETE (this SCOPE line was
      stale). Ground-truth re-verified 2026-09-19 against the codebase, not
      the metadata: `sdk/scripts/ensure-ripgrep-vendor.ts` +
      `sdk/src/__tests__/ensure-ripgrep-vendor.test.ts` exist;
      `package.json:60` `prepare` chains the script (Law 4: the hook is the
      only production caller, grep-verified); commit `0e0ffcd9` carries it.
      Declared gates re-run LIVE, all green: typecheck sdk exit 0; the three
      ripgrep suites 23 pass / 0 fail (57 expects); quality PASS (1498
      baselined files). Archived receipt is intact in substance. No code
      change was required or made.
- [x] **T66-C.** All 7 SEC findings FID'd (0919-008…014). Operator
      approved implementing six ("Approve implementing the six SEC FIDs
      in the recommended order") — ALL IMPLEMENTED 2026-09-19, receipts
      stamped from real gate runs, statuses `verified`:
      **010** span-scoped redirect waiver (worked example rejected);
      **008** `buildChildEnv` allowlist at both spawn sites (sentinel
      credential proven absent from the child via real spawn);
      **011** value-shape secret masking (prefixes + KEY=value + entropy,
      output fields, pre-fan-out); **014** destructive-command floor in
      every mode incl. dev override; **012** `signing_failed` event +
      unaudited-write counter + loud binding catches; **013** capability
      clamp for database templates (fail-closed, local templates
      untouched). 0919-009 (SEC-2): layer 3 (sanitization boundary)
      **DECLINED** by the operator 2026-09-19 — residual
      indirect-injection risk through inherited history is accepted and
      recorded in the FID (mitigating context: the channel's two
      weaponizable downstream payloads are closed by 008 and 010);
      layers 1-2 remain available on request, not approved.
- [x] **T66-D.** Report updated with §6 verification appendix + FID
      mapping; session summaries recorded.
- [x] **T66-E.** FID-2026-0919-015 (exit-code-blind crediting) implemented
      + verified 2026-09-19; see its session summary.
- [x] **T66-F.** FID-2026-0919-016 authored + implemented (operator
      reported `kiosapi/grok-4.6-free` showing 2000.0k vs OpenRouter's
      500k, then directed "fid+perfection loop"). Root cause live-proven:
      (a) `toCanonicalModelId` stripped only the legacy trio prefix —
      kiosapi/ ids missed every exact branch; (b) the version-blind
      family fallback (first id-sorted hit) resolved grok-4.6 to
      x-ai/grok-4.20's 2M window. Fix: registry-driven prefix stripping
      + exact-version preference in both family branches of
      `lookup.ts`. LIVE e2e (real module, real 447-model catalog):
      kiosapi/grok-4.6-free → 500000 / source 'catalog' / max-output
      450000. Gates: FID suite 7/0, sibling suites 61/0 (11 files),
      typecheck ×2, eslint 0, lint:md 0, quality PASS (after compressing
      lookup.ts back under the 300 ceiling), receipt 3/3 via `--write`,
      `--check` PASS.
- [x] **T66-G.** FID-2026-0919-017 authored + implemented (2026-09-19
      resumed session; operator approved the amended GREEN). The
      compaction panel pinned above the input because CompactionSignal —
      the last child of the sticky-bottom scrollbox — painted terminal/
      advisory phases as a fake last message, and the retirement drop
      keyed on the drifting `percentUsed`. Fix: in-flight-only slot
      (compacting only), outcome-identity drop (percent-blind epoch,
      null-guarded), no-orphaned-outcome sidebar labels (blocked /
      ineffective added to formatCompactionStatus), in-flight-only slot
      comment in panels.tsx. Gates: typecheck cli 0, signal 9/0,
      retirement 10/0, format 6/0 (new suite), quality PASS, eslint 0,
      lint:md 0, prettier clean; receipt 5/5 via `--write`, `--check`
      PASS (fingerprint sha256:b1ec125e…). Grounding found two defects
      in the FID itself (A1 gate-path .ts/.tsx mismatch, A2 orphaned
      blocked/ineffective outcomes) — both folded into the converged
      doc before implementation. G2 commit withheld.

## Task 64 — Free-routing scanner optimization (2026-09-18) — RELEASE-DAY

> Operator directive: "today we're going to release, however we need to
> optimize the free routing scanner process." Operator picked option C:
> bounded-concurrency probe pool today + cadence FID for approval.
>
> **Automation level: 3** — both FIDs were fully automatable and are closed +
> archived; only the operator's G2 commit remains (level 1).

- [x] **T64-A.** FID-2026-0918-001 authored + implemented (RED-first):
      bounded-concurrency pool (6) for both harvester probe sites
      (probe-merge phase + Stage-E health). Stage-E split to
      `lib/health-probe.ts` (300-line ceiling). Gates: probe-pool 9/0,
      providers tree 110/0, eslint 0, quality PASS, LIVE `--probe` run
      exit 0 (13.7s, 214 records, ~43 probes), receipt stamped 5/5.
      Closed + archived (the record now sits in `dev/fids/archive/`; this
      register line was stale against the archive — verified 2026-09-19).
      Commit SHA pending operator G2.
- [x] **T64-B.** FID-2026-0918-002 authored + IMPLEMENTED on operator
      approval (RED-first, 9/0 pins): 3-day re-probe cadence for
      `boundary-unverifiable` hosts — `shouldReprobeUnverifiable` gate +
      `lastProbeAttemptUtc` (type/parse/diff carry-forward/write-back).
      LIVE double-run proof: run 1 stamped 40 hosts, run 2 probed none
      (zero timestamp diffs; wall clock 14.0s → 1.13s). Receipt 5/5
      (typecheck common, probe-cadence, harvest-core, probe, quality).
      Closed + archived (the record now sits in `dev/fids/archive/`; this
      register line was stale against the archive — verified 2026-09-19).
      Commit SHA pending operator G2.

## Task 62 — Provider identity re-gauntlet (2026-09-16) — IN PROGRESS

> Operator directive (pick from the post-Task-58 suggestion menu): re-run the
> identity-audit gauntlet on the surviving gateway channels that were never
> identity-audited since integration (tokenrouter, tokenharbor, commandcode,
> opencode-go). Operator amendment: "i dont usually save the keys in
> .env.local, so i need you to add the placeholders and i'll fill out the
> keys; however you can self drive it using tmux too" — placeholders appended
> to .env.local (append-only, values never echoed, Law 12); tokenrouter runs
> NOW via its existing credentials.json key; the other three wait on the
> operator filling the placeholders. Key-name inventory done by grep on
> key NAMES only. Scripts gitignored in dev/scratchpad/active/.

- [x] **T62-A.** Key inventory (names only): TOKENROUTER_API_KEY present in
      ~/.savant-code/credentials.json → keyed cells LIVE. TOKENHARBOR/
      COMMAND_CODE/OPENCODE keys absent everywhere → placeholders appended
      to .env.local (operator fills). GOROUTER/TABITOKEN/VYCEAI/APINEX keys
      exist in .env.local but those providers are NOT in the built-in
      registry (legacy/removed per FID-2026-0906-008 lineage) — out of
      gauntlet scope.
- [x] **T62-B.** Tokenrouter keyed cells (17 of 26 catalog ids reached LIVE
      before the account's credit pool ran dry — 403
      insufficient_user_quota): served-name + tokenizer fingerprint per
      cell; 1 chat cell per Responses-only id to confirm the FID-002
      routing claim; self-ID pass blocked by credit exhaustion (round-2
      all 403).
- [x] **T62-C.** Tokenrouter verdict (2026-09-18): COMPLETE. Round-3
      confirmed terminal exhaustion — every remaining cell (incl. gift-
      eligible gpt-oss-120b and the temperature:1 kimi-k3 param retry)
      403s with `remaining eligible quota: ＄-0.000004`; gift balance is
      itself drained, so no more cells can run. Verdict: **NO DISGUISED
      THIRD-PARTY IDENTITY FOUND, catalog ids CLEAN** (all 17 round-1
      LIVE cells served names matching the routed vendor; two round-1
      anomalies explained — kimi-k3 400 = temperature param bug, fixed by
      temperature:1 but now credit-blocked; deepseek-v4.1 503 = channel
      genuinely unavailable). Open items routed: self-ID pass incomplete
      (operator may top-up and re-run `t62-round3.ts`); FID-2026-0916-002
      Responses-routing claim confirmed for gpt-5.4 + gpt-5.3-codex
      (200, served-name passthrough).
- [x] **T62-D.** Gauntlet run 2026-09-18 (all three keys were filled by
      operator): **tokenharbor** — boundary fail-closed (keyless 401 ✓);
      roster 37 ids; static catalog 17 ids → ZERO dead (full roster
      consistency); all 3 :free identity cells 429 (kimi-k3 launch event
      ended; rolling allowance used) + NEW channel
      `deepseek-v4.1-flash:free` discovered (absent from static catalog;
      same account-level 429; reset 2026-09-19T04:32). **commandcode** —
      keyless /models HTTP 200 (fail-open boundary, security finding);
      roster 70 ids; 2 static ids case-drifted (zai-org/glm-5.2,
      zai-org/glm-5.3 — roster publishes zai-org/GLM-5.2/5.3); paid
      identity cells blocked by zero account credits. **opencode-go** —
      OUT OF GAUNTLET SCOPE: removed from Savant entirely by
      FID-2026-0916-004 (closed 2026-09-16, after this task was
      directive'd); probe of its endpoint found chat cells require a
      non-standard `x-opencode-*` session header (MissingSessionID) —
      moot for the product. **Findings routed to T61+** (below).
- [ ] **T62-followups (routed, not blocking Task 62 closure):**
      **Automation level: 3** for (1) — catalog case-drift + fail-open
      boundary are mechanical fixes; **level 1** for (2) and (3) — both are
      blocked on operator credits/keys, so there is nothing to automate.
      (1) commandcode catalog case-drift fix (zai-org/GLM-5.2/5.3) +
      boundary fail-open — candidate FID, operator call;
      (2) tokenharbor `deepseek-v4.1-flash:free` catalog add + free-cell
      identity re-run after 2026-09-19T04:32 allowance reset;
      (3) tokenrouter self-ID completion on operator top-up
      (`bun dev/scratchpad/active/t62-round3.ts`).
- [ ] **T61.** Cloudflare surfacing FID (grounding + Perfection Loop;
      present only). **Automation level: 3** — grounding and FID authoring are
      agent work; only the surfacing decision itself is the operator's.
- [ ] **T63.** Pipeline candidates → curated shortlist + proposal scaffolds.
      **Automation level: 3.**
- [ ] **T67.** (discovered 2026-09-19 during the
      FID-queue review): `bun test` path arguments are SUBSTRING filters
      — passing `packages/agent-runtime/src/__tests__/spawn-agents-
      message-history.test.ts` from the repo root also swept a stale
      vendored copy under gitignored `resources/freebuff-main/`, which
      failed with a module-resolution error unrelated to the working
      tree. Workaround: run suites from their workspace root. Candidate
      FID if this bites CI or other agents; operator decides whether to
      promote. **Automation level: 3** — the durable fix (a path-scoped test
      runner resolution, or the guard documented where agents will hit it) is
      fully automatable.
- [ ] **T68.** (discovered 2026-09-19, live kiosapi
      roster sweep `dev/scratchpad/sweep-kiosapi-defaults.ts` after
      FID-2026-0919-018): 8 of 19 kiosapi ids land on the 200k default.
      Classification: (1) case-sensitivity miss — `kiosapi/Qwen/Qwen3-8B`
      vs catalog `qwen/qwen3-8b` (131,072); (2) vendor-known window with no
      fallback row — `kiosapi/atria-dawn-preview` (upstream 262,144 per
      FID-2026-0916-005, and `kiosapi/` is a second gateway selling the
      same upstream); (3) six genuinely OpenRouter-absent ids with silent
      rosters (agnes-2.0/2.5/3.0-flash, big-pickle, sensenova-6.8-flash-
      lite, diffusiongemma-26b-a4b-it) — honest default per
      FID-2026-0914-002; web research for vendor windows is optional.
      Operator decides: promote (1)+(2) to a FID, research (3), or accept.
      **Automation level: 3** for (1)+(2) — both are mechanical fallback-table
      fixes; **level 2** for (3), where the research is automatable but the
      disposition (accept the honest default vs. research vendor windows) is a
      recorded policy call.

## Task 69/70 — discovered during the T66-B audit (2026-09-19) — RULED + IMPLEMENTED

> Both surfaced while ground-truthing FID-2026-0918-007 and were presented
> as blocking decisions (Law 2). Operator rulings 2026-09-19: T69 =
> "Accept as by-design + document"; T70 = "Both" (amend FID-007 + widen the
> sweep). Implementation FID: FID-2026-0919-021 — **closed + archived
> 2026-09-19** on operator directive, receipt re-stamped LIVE at the archived
> path (10/10 gates, fingerprint `sha256:4a6dadaa…` matching). Commit SHA
> pending operator git execution (G2 withheld); evidence = file:line + grep.
>
> **Automation level: 3** — the implementing work was fully automatable and is
> closed + archived; the only pending action is the operator's G2 commit
> (level 1).

- [x] **T69 — DONE (accepted by design + documented).** [corrected 2026-09-19] Archived-FID receipt staleness is a
      systemic, mechanically invisible class. Scan of all 405 FID files on
      disk (`dev/scratchpad/active/fid-receipt-staleness-audit.ts`):
      **284 of 315 `closed` records** carry a receipt fingerprint that no
      longer matches their content (31 match — the records re-stamped at the
      archived path during the 2026-09-16/17 ceremonies). Causally proven on
      FID-2026-0918-007, not inferred: the stored fingerprint `sha256:3817c5e2…`
      MATCHES its content at `6e816902` (status `verified`), and no longer
      matches after `3a0fe8dd` — the closure batch commit that flipped
      `Status: verified` → `closed` and appended the `- **Archived:**` line
      without re-stamping. Two structural reasons it stays invisible: the
      `--check` scan reads only `dev/fids/` (`checkAll` → `activeFidFiles`),
      and `validateFidVerification` returns clean for any status outside
      `{fixed, verified}` — `closed` included. **RULING: accepted as
      by-design; document it and stop skipping silently.** Implemented:
      (1) `dev/echo-v0.1.2-single-agent.md` (FID Auto-Archive) now states
      that a closed record carries no live fingerprint guarantee and that
      re-stamping is optional; (2) the skip decision is single-sourced in the
      new `echo/fid-verification-enforcement` module, and `fid:verify
      --check` prints a non-fatal information tier naming each unenforced
      active record with its reason. `validateFidVerification` still returns
      `[]` for those statuses, so the pre-write tripwire and the scan are
      unchanged in behavior (pinned). ACCEPTED BOUNDARY: the 284 archived
      records are NOT repaired and archived records remain outside the scan
      — that is the ruling, not a deferral. Harness-side surfaces
      (`ECHO.md`, `templates/FID-TEMPLATE.md`) were left untouched because
      the template is an embedded grounding file whose edit obliges a
      protocol-bundle regeneration — presented as a separate decision.
- [x] **T70 — DONE (both halves).** [corrected 2026-09-19] FID-2026-0918-007's two NEW suites
      (`sdk/src/__tests__/ripgrep-path-fallback.test.ts`,
      `sdk/src/__tests__/ensure-ripgrep-vendor.test.ts`) are named in its
      Steps + Implementation Evidence but no declared `- gate: test` covers
      them — only `ripgrep.test.ts` is gated. Mechanically CLEAN: the
      FID-2026-0918-006 sweep's narrow promise pattern
      (`/\bnew\s+(?:runtime\s+)?test\b/i`) does not match the FID's wording
      ("New/updated …"), so it reports 0 errors / 0 warnings. Reported
      honestly as an advisory gap by purpose, not a violation by the letter:
      nothing in the declared gate battery would catch either suite being
      deleted. **RULING: "Both".** Implemented: (a) the sweep's promise rule
      now matches the NEW/updated wording and reads the WHOLE document
      (path-requiring branch), with the pathless branch scoped to
      `### Verification` + `### Implementation Evidence` after the rule
      rejected this FID's own narrative prose (audit finding, pinned);
      (b) FID-2026-0918-007 amended with both gates + a Loop 4 record and
      re-stamped from a live five-gate run — fingerprint now matches, sweep
      reports 0. LIVE PROOF on the real record: 0 violations before the
      widening, 3 after it (both artifacts), 0 after the amendment.

## Task 71/72 — discovered while running the T69/T70 battery (2026-09-19) — RULED + DONE

> `bun run validate:repository` was RED (13 issues). **None of the 13 came
> from the T69/T70 change** — verified by file: every issue sat in files this
> session did not touch. Both classes were presented as blocking decisions
> (Law 2). Operator ruling (free-text): "nothing is out of scope, address all
> issues found with fid+perfection loop" (T71), and T72 = move to archive/.
> Implementation FID: FID-2026-0919-022 — **closed + archived 2026-09-19** on
> operator directive, receipt re-stamped LIVE at the archived path (8/8 gates
> incl. the new probe gate; fingerprint `sha256:55b5c4fc…` matching). Commit
> SHA pending operator git execution (G2 withheld); evidence = file:line +
> grep. **`validate:repository` is now PASS (13 → 0).**

- [x] **T71 — DONE (both halves).** [corrected 2026-09-19] `validate:repository` failed on TWO
      `audit.gate-env-parity` violations introduced by FID-2026-0918-007's
      own part-3 code (commit `0e0ffcd9`, files unmodified since):
      `sdk/scripts/ensure-ripgrep-vendor.ts:114` and
      `sdk/src/__tests__/ensure-ripgrep-vendor.test.ts:39` both spawn a bare
      `'bun'`, which is PATH-resolvable only in a dev shell — the exact class
      fixed in `scripts/bump-version.ts` by FID-2026-0909-002 (spawn
      `process.execPath`). Root cause of the escape: that FID's declared gate
      battery was `typecheck sdk` + `ripgrep.test.ts` + `quality`, and the
      receipt vocabulary has NO kind for a repo gate like
      `validate:repository` — so a repo-gate break can ship on a `verified`
      receipt. Fix is two one-line edits; the vocabulary limitation is the
      interesting half. **DONE:** both sites now spawn `process.execPath`
      (the FID-2026-0909-002 preview fix), and the vocabulary gap is CLOSED
      by the existing `probe` kind rather than a new gate kind: the audit
      check gained an `import.meta.main` entry point (exit 0 clean / 1 with
      issues), so FID-2026-0919-022 proves it on its own receipt with
      `- gate: probe scripts/audit-gate-env-parity.ts` (8/8, gate PASS).
      `validate:repository` remains permanently NON-declarable by design —
      it re-enters FID gate execution (C3) and would recurse (Lesson,
      FID-2026-0915-004); that boundary is now documented in
      `templates/FID-TEMPLATE.md` (+ protocol-bundle regen, parity green).
      The T69 residual on the template surface (closed-record semantics) was
      closed in the same regen.
- [x] **T72 — DONE.** [corrected 2026-09-19] 11 `hygiene.scratchpad-clutter` violations:
      scratch scripts from the FID-2026-0919-018/-019/-020 sessions sit at the
      `dev/scratchpad/` ROOT instead of `active/` or `archive/`. The gate
      wants      `dev/scratchpad/` to hold only its README plus those two dirs (this
      session's tooling was written to `dev/scratchpad/active/` and is
      compliant). **DONE** (operator: "Move them into archive/"): all 11 moved
      to `dev/scratchpad/archive/`; the root now holds README + active/ +
      archive/. No-op for history (the scratchpad is gitignored);
      harmless because the scratchpad is gitignored. Operator decides: move
      now, or leave.

## Task 60 — stampReceipt EOF fingerprint edge (2026-09-16) — CLOSED

> FID-2026-0916-003 authored, implemented RED-first, closed + archived with
> a 9/9 receipt incl. LIVE e2e both legs (commit `4aa30ab6`). Full record in
> the FID + session summary `2026-09-16-1945`.
>
> **Automation level: 3** (historical) — completed and closed.

## Task 58 — quality:report in the FID closure gate battery (2026-09-16) — CLOSED

> Closed 2026-09-16 — no action pending. **Automation level: 3** (historical).