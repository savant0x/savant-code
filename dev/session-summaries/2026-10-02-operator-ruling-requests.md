# Operator Ruling Requests — FID-2026-1001-003 Batch 1 aftermath (2026-10-02)

Fill in your answer next to each **Answer:** line (letter, word, or prose — all fine).
Items marked **(no default — blocks)** stop work until answered. Everything else
proceeds on the stated default if left blank, and the default applied gets recorded.

---

## Q1 — `past-fail.md` disposition **(no default — blocks)**

Context: the 60,534-line failed-session transcript sits untracked at the repo root. It
breaks `validate:repository` (`[vendored.tree.foreign-root]`) and carries all 2,605
`lint:md` findings. Its content is already distilled into `FID-2026-1001-003`
(A–Z catalog) and `dev/session-summaries/2026-10-02-0009-past-fail-damage-control.md`.

- **A** — move to `resources/past-fail.md` (gitignored tree; kept locally, out of git)
- **B** — add `/past-fail.md` to `.gitignore` (stays at root, untracked)
- **C** — delete it (FID + session summary preserve what matters)
- **D** — commit it deliberately, with MD040 lint remediation first

**Answer:** c

---

## Q2 — commit execution model (G1/G4) **(no default — blocks)**

Context: the working tree holds Batch-1 code+tests, the FID/SCOPE/session-summary doc
changes, `raw-traces.jsonl` mechanical hook appends, and the modified
`agents/detective/detective.ts` companion change.

**Q2a — who runs git?**

- **A** — you execute the commits yourself (I maintain the path-scoped staging plan only)
- **B** — you approve a plan here, I run the commands

**Q2b — commit shape** (default if blank: **split, three commits**)

- **A** — one commit for everything (excluding `past-fail.md` per Q1)
- **B** — split: (1) Batch-1 code + tests, (2) governance docs
  (FID-003, SCOPE.md, session summary, nova outbox), (3) detective.ts companion change
- **C** — split, but exclude `raw-traces.jsonl` mechanical appends from git entirely

**Answer (Q2a):** a
**Answer (Q2b):** a

---

## Q3 — next Batch authorization (FID-003 steps 1, 2, 4, 5/5a)

Context: Batch 1 (steps 6, 3, 7, 8) is implemented and gated. The remaining four:
step 2 (Law 15 worktree reconciliation) → step 1 (terminal bypass closure, depends on 2)
and step 4 (Law 3 blocking + N=3 escalation, must follow 2); step 5/5a additionally
blocked on the `SCOPE.md` retrofit (Q4). Steps 1/2/4 change enforcement *behavior*
(existing advisory-behavior tests must be updated deliberately, per the FID's named list).

- **A** — authorize step 2 now; re-present 1 and 4 after it lands
- **B** — authorize 2 → 1 → 4 as one sequence now
- **C** — authorize everything incl. 5a (assumes Q4 = A)
- **D** — hold; you review Batch 1 first

Default if blank: **D (hold)** — no governance-substrate change without a ruling.

**Answer:** c

---

## Q4 — `SCOPE.md` pattern retrofit (prerequisite for step 5a only)

Context: register items are prose; 5a's gate needs per-item machine-readable target
patterns, fail-closed on "no pattern". Retrofitting the register is an operator-visible
change to a governance artifact.

- **A** — approve the retrofit; I prepare the `SCOPE.md` edit and present it before writing
- **B** — you draft the patterns yourself; I wire the gate to them
- **C** — defer 5a indefinitely (5 stays as-is)

Default if blank: **C (defer)**.

**Answer:**a

---

## Q5 — Law 15 cost-gate parameters (step 2 design default)

Context: step 2 runs `git status --porcelain` against a persisted baseline to catch
out-of-band worktree mutations. Measured baseline on this worktree: 139ms.

- **A** — every turn end, 500ms budget, over-budget = loud fail-open notice
- **B** — every turn end, 500ms budget, over-budget = skip silently
- **C** — different cadence/budget (write it in)

Default if blank: **A**.

**Answer:**
a

---

## Q6 — FID for the `code_search`/ripgrep silent-zero hazard?

Context: the vendored ripgrep binary intermittently ENOENTs and `code_search` then
returns **0 matches silently** — an evidence tool that lies by omission (this session
worked around it with real `grep`; recorded in the FID's residual notes).

- **A** — open a RED FID now (fail-loud on tool-absence; surface stderr/exitCode)
- **B** — note only, no FID (environmental, machine-specific)

Default if blank: **A** — a silently-lying evidence tool is this FID's subject matter.

**Answer:**a

---

## Q7 — step 3 verification-artifact substitution (disclosure confirm)

Context: the FID's Verification named a `dev/scratchpad/` exit-code probe for step 3.
Batch 1 shipped the stronger form instead — an in-repo declared-gate reproduction suite
(`law1-read-state-durability.test.ts`) — and the substitution is recorded in the FID's
Implementation Evidence.

- **A** — accept the substitution (probe dropped)
- **B** — also write the scratchpad probe for manual repro runs

Default if blank: **A**.

**Answer:**a

---

## Q8 — session wrap for this batch

- **A** — spawn Scribe now (session summary + end-of-turn review for Batch 1)
- **B** — skip; FID evidence + this questionnaire suffice until next session end

Default if blank: **A**.

**Answer:**
Im not currently running savant code, you're freebuff and do not have a scribe, do it yourself now
