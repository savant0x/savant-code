# A–Z Parallel-Worktrees Harness Live Test — Report

**Run date:** 2026-10-17 (executed 22:10–22:21 EDT)
**Provider/model actually used:** `chatanywhere` / `deepseek-v4.1-flash` (session reports this; the
record's authorized pairing was provider `kiosapi`, model `step-5-preview` — divergence noted in §7)
**Start HEAD:** `26bbc5771576bc1d0047bf59dacd164240b62c29`
**End HEAD:** `26bbc5771576bc1d0047bf59dacd164240b62c29` (unchanged — no mutation occurred)
**`bun --version`:** `1.3.14` (matches the record's declared runtime)
**Baseline `git status --short`:** empty (clean; preconditions satisfied)
**Acceptance vehicle:** FID-2026-1017-008 (`converged`, run 1 = DEFECTS FOUND, BLOCKER-1 open)

---

## 1. Verdict Summary

| Verdict | Count |
| --- | --- |
| PASS | 13 |
| FAIL | 0 |
| OPERATOR-CONFIRMED | 0 |
| SKIP | 0 |
| NEEDS-REVIEW | 0 |
| **BLOCKED (unreachable)** | **1 (§5.1 onward — 19 rows + §6.1)** |

**No row FAILED.** The run stopped because the `fid_worktree` tool could not be invoked from this
session (see §5 below). Rows §5.1–§5.19 and §6.1 were never attempted, so they carry no verdict and
must not be read as passes or skips.

**Overall call: DEFECTS FOUND** — one instrument-level defect that makes the declared §5 execution
path unreachable from inside the harness session the instrument targets.

---

## 2. Phase 0 — Exposure and Identity (§3)

| Row | Verdict | Evidence |
| --- | --- | --- |
| 0.1 | PASS | `git grep -n "fid_worktree" -- agents` → exactly 3 matches: `agents/savant/savant.ts:140`, `agents/types/tool-name.ts:13`, `agents/types/tool-params-map.ts:19`. No other agent role file lists it. |
| 0.2 | PASS | `bun --version` = `1.3.14`; start HEAD = `26bbc5771576bc1d0047bf59dacd164240b62c29`; `git status --short` empty; provider/model = chatanywhere/deepseek-v4.1-flash. |

**Divergence found in 0.1 (WATCH).** The tool's exposure is *conditional*, not unconditional:

```text
agents/savant/savant.ts:140:      !analyzeOnly && !planOnly && 'fid_worktree',
```

`fid_worktree` is present only when the session is NOT in ANALYZE and NOT in PLAN mode. The
instrument's §2 precondition says merely "The `fid_worktree` tool is present in your tool set (it
will be exercised in §5)". In an ANALYZE or PLAN session every §5 row would be unrunnable and the
precondition would still read as satisfied. This is a precondition-completeness gap.

---

## 3. Phase 1 — Automated Gate Matrix (§4)

All 11 rows run exactly as specified, each from the workspace directory shown (never the repo root,
per the substring-filter rule). Durations measured against the 22:16–22:18 EDT window.

| Row | Verdict | Evidence | Duration |
| --- | --- | --- | --- |
| 4.1 | PASS | repo root `bun run typecheck` → exit 0; chained all 14 workspaces + `typecheck:scripts` (15 `tsc` invocations observed) | ~55s |
| 4.2 | PASS | `packages/agent-runtime` `bun test src/__tests__/fid-worktree-provision.test.ts` → **10 pass / 0 fail**, 29 expect() calls | 0.56s |
| 4.3 | PASS | `bun test src/__tests__/fid-worktree-dispose.test.ts` → **5 pass / 0 fail**, 20 expect() | 0.57s |
| 4.4 | PASS | `bun test src/__tests__/fid-worktree-merge.test.ts` → **5 pass / 0 fail**, 16 expect() | 11.78s |
| 4.5 | PASS | `bun test src/__tests__/fid-worktree-environment.test.ts` → **3 pass / 0 fail**, 20 expect() | 5.15s |
| 4.6 | PASS | `bun test src/__tests__/fid-worktree-tool.test.ts` → **7 pass / 0 fail**, 47 expect() | 7.69s |
| 4.7 | PASS | `bun test src/echo/__tests__/law2-worktree-jurisdiction.test.ts` → **5 pass / 0 fail**, 13 expect() | 5.57s |
| 4.8 | PASS | `common` `bun test src/tools/__tests__/fid-worktree-params.test.ts` → **1 pass / 0 fail**, 14 expect() | 0.26s |
| 4.9 | PASS | `sdk` `bun test src/__tests__/ripgrep.test.ts` → **15 pass / 0 fail**, 40 expect() | 0.42s |
| 4.10 | PASS | repo root `bun scripts/probes/fid-worktrees.ts` → `PASS — two isolated lanes, lane scope, WAL snapshot, CLI fast-forward, graph refresh, divergence refusal, dispose and self-heal held` | ~2s |
| 4.11 | PASS | repo root `bun run validate:repository` → `Provider docs counts match the registry; no unevidenced fact drift.` / `validation: PASS` | ~3s |

**Rows carrying signal for the re-run beyond a bare green:**

- **§4.4** contains `wrong branch refuses; post-merge graph failure reports success with warning` —
  the §5.15 failure class from run 1 — and it passes. FID-2026-1017-011's repair (`774eb705`) is
  reflected at unit level.
- **§4.10** independently exercises `graph refresh` and `divergence refusal` in a real-git probe and
  reports them held.
- **§4.6** contains `root guard retries only a git process that could not run`, the guard implicated
  in BLOCKER-1.

No gate felt near a timeout. §4.1 is the longest single row by an order of magnitude; §4.4 is the
slowest lane suite at 11.78s.

---

## 4. Phase 2 — Live Lane Lifecycle (§5): BLOCKED

**Row at which the run stopped: §5.1 (`list` on the clean slate).**

### What was attempted

The instrument directs the agent to drive the tool with JSON arguments — §5's preamble: *"All
`fid_worktree` calls are JSON arguments to the harness tool, e.g. `{ "action": "list" }`"*. Two
attempts were made:

```text
Attempt 1: fid_worktree { "action": "list" }
Attempt 2: fid_worktree { "action": "list" }   (re-emitted after schema correction instruction)
```

Both were refused before dispatch, identically:

```text
the arguments failed the tool schema at: action — invalid_union
```

The harness stated explicitly that no truncation was observed and that a different payload size
would not help.

### Root cause

Read from the authoritative source, `common/src/tools/params/tool/fid-worktree.ts`:

```ts
export const fidWorktreeInputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('list') }).strict(),
  z.object({ action: z.literal('create'), fid_id: fidId }).strict(),
  z.object({ action: z.literal('merge'), fid_id: fidId }).strict(),
  z
    .object({
      action: z.literal('dispose'),
      fid_id: fidId,
      discard_changes: z.boolean().optional(),
    })
    .strict(),
])
```

`{ "action": "list" }` **is** a valid branch of this union — it satisfies the first `.strict()`
object exactly. The refusal therefore originates upstream of the zod validation: the `fid_worktree`
tool is surfaced to this session **without a parameter schema** (its presented signature is
parameter-less), so the call arrives with no `action` key at all, which fails every branch of the
discriminated union and yields `invalid_union`.

**Evidentiary boundary (honest statement):** the observable facts are the two identical refusals and
the harness's explicit denial of truncation. The *mechanism* above is an inference from the
intersection of that error string with the zod definition — the agent cannot introspect its own
tool-schema wiring. It is a diagnosis, not a directly-observed fact.

### Consequence

The entire §5 lifecycle (19 rows) and §6.1 (busy-lock, which also requires a lifecycle mutation)
are unreachable from this session via the documented trigger path. The instrument's own §1.5
fallback covers a *terminal-command* refusal with an operator fallback; it provides **no fallback
for a tool-schema refusal**, and §1.7's STOP rule applies to failing preconditions, which this row
is not. The instrument does not define this state.

---

## 5. Agent View (§7)

### 5.1 Divergences between expected and observed values

| # | Instrument expectation | Observed | Class |
| --- | --- | --- | --- |
| D1 | §5 preamble: `fid_worktree` is driven by JSON args, e.g. `{ "action": "list" }` | `arguments failed the tool schema at: action — invalid_union`; tool is surfaced parameter-less in this session | **BLOCKER** (instrument unreachable) |
| D2 | §2: "The `fid_worktree` tool is present in your tool set" (unconditional) | Present only when `!analyzeOnly && !planOnly` (`agents/savant/savant.ts:140`) | **NICE-TO-HAVE** (precondition is incomplete) |
| D3 | §5.6: duplicate create → refusal `fid-in-use` attributed to "the service" | `runFidWorktreeAction` returns **no `fid-in-use` reason** — its reasons are `invalid-input`, `unsafe-root`, `not-converged`, `not-ignored`, `wrong-branch`, `environment-failed`, `not-managed`, `dirty`, `busy`, `io-failed`. Duplicate refusal originates in `provisionFidWorktree` (suite row: `refuses a second lane for the same FID`) | **NICE-TO-HAVE** (citation drift) |
| D4 | FID-2026-1017-008: run 1 "disposed the lane and **retained** the branch"; §5.18 expects the branch retained | `git branch --list savant/FID-2026-1017-008` → **empty**. The branch does not exist at run start | **WATCH** |
| D5 | Record: authorized inference = provider `kiosapi`, model `step-5-preview` | Actual session = `chatanywhere` / `deepseek-v4.1-flash` | **WATCH** (recorded per the instrument's own instruction) |
| D6 | Record/§2: "the prep step stashes the untracked blueprint; restore it after the run with `git stash pop`" | `stash@{0}` exists and is labelled for exactly this, but `git stash show --stat` returns **empty** — the stash holds no tracked content. The blueprint is already on disk as a tracked file (force-added in `5768aff6`) | **WATCH** (the stash appears inert; the labelled prep step had no content to restore) |

### 5.2 Refusal / failure strings encountered, verbatim

```text
the arguments failed the tool schema at: action — invalid_union
```

(Only one distinct refusal string was produced in this run. No lifecycle refusal string was reached,
because no lifecycle call dispatched.)

### 5.3 Hook / gate refusals of terminal commands

**None observed.** Every terminal command in this run was read-only and dispatched through the
read-only execution path. No `deny-mutating-terminal` interception fired, no Law 1/2/3 interception
fired, and no steering rule blocked a command. §5.8b/§5.8c (the `exec` rows most likely to trip the
mutating-terminal guard) were never reached.

### 5.4 Rows that ran but were inconclusive

**None.** All 13 executed rows produced a determinate verdict.

### 5.5 Paths deliberately NOT covered, and why

| Path | Reason |
| --- | --- |
| §5.1–§5.19 (whole lane lifecycle) | Unreachable: `fid_worktree` refuses dispatch (D1) |
| §6.1 busy-lock refusal | Requires a lifecycle mutation, hence also unreachable |
| §5.17a stray-file planting | OPERATOR row; never reached |
| child-role-forbidden leg of `fid_worktree` | Only a spawn attempt could prove it; not attempted |
| active-lane cap refusal | Not reachable via §5 as written |
| merge CONFLICT path | No conflict was constructed |
| branch-diverged-from-base create refusal | Not reached |
| re-create-after-dispose branch reuse | Not reached |

### 5.6 Timing observations

No row approached a timeout. Slowest single row: §4.1 (full root typecheck, ~55s). Slowest lane
suite: §4.4 at 11.78s. The probe (§4.10) and repository validation (§4.11) each completed in
seconds.

### 5.7 Anything surprising in the tool JSON versus expectations

No tool JSON was produced — the refusal occurred **before dispatch**, so nothing was mutated and no
result payload exists. This is itself notable: the schema gate is the first boundary, which is what
§5.2 *expects* for the invalid-id row and is why §5.2's stated expectation remains correct.

### 5.8 BLOCKER-1 (run 1's `unsafe-root` flake) — analysis contributed by this session

Run 1 recorded BLOCKER-1 as "intermittent `unsafe-root` refused 3 of the 18 live lifecycle calls
that reached the service; not reproducible out-of-process and still unexplained." Reading
`packages/agent-runtime/src/echo/parallel/fid-worktree-service.ts` end-to-end narrows it:

`safeHostRoot()` runs **before the lock is taken** and therefore gates *every* non-`list` action:

```ts
const gitRoot = path.join(repoRoot, '.git')
if (!existsSync(gitRoot) || !statSync(gitRoot).isDirectory()) return false
for (const suffix of ['', '.savant', '.savant/worktrees']) {
  const target = path.resolve(repoRoot, suffix)
  if (existsSync(target) &&
      pathCompareKey(realpathSync(target)) !== pathCompareKey(target)) return false
}
const root = resolveGitTopLevel(repoRoot, run)
return root !== null && pathCompareKey(root) === pathCompareKey(repoRoot)
```

and `resolveGitTopLevel` retries **only** when git could not run (`status === null`); a non-null
refusal is a real answer and is never retried:

```ts
if (root.status === 0) return root.stdout.trim()
if (root.status !== null) return null
```

A transient filesystem identity mismatch in the `realpathSync` loop (or a spawn failure/timeout on
`rev-parse --show-toplevel`) under concurrent load fits the observed 3-of-18 rate exactly. This does
**not** clear the flake — it remains unreproduced — but it localises it to the environment/FS layer
rather than to lifecycle logic, and it explains why the unit-level contract cannot reproduce it.
Recorded as analysis, not as a resolution.

---

## 6. Cleanup Checklist (§9)

| Item | Observed state |
| --- | --- |
| Lane disposed | N/A — no lane was created |
| Branch `savant/FID-2026-1017-008` retained | Absent at run start AND at run end (D4) — nothing to delete |
| `.savant/fid-worktree.lock` absent | ✅ absent (`No such file or directory`) |
| No probe files landed | ✅ `az-out-of-scope-probe.txt` absent; nothing under `.savant/worktrees/AZ-NOT-A-LANE` |
| `git status --short` matches §5.19 | ✅ empty, identical to baseline |
| Report written to `dev/scratchpad/az-parallel-worktrees-live-test-report.md` | ✅ this file |
| Start HEAD / merge SHA / end HEAD recorded | ✅ start = end = `26bbc577`; no merge SHA (no merge occurred) |

**Working tree left exactly as found. No mutation of any kind was performed.**

---

## 7. Records updated by this run

None. `CHANGELOG.md`, `SCOPE.md`, and FID-2026-1017-008 were not modified, per §1.3. No new FID was
opened, per §8's closing instruction ("do not open one yourself").

---

## 8. Closing recommendation

FID-2026-1017-008's acceptance remains **unclaimed**. The repaired merge path (§5.15) is green at
unit level (§4.4, §4.10) but has **not** been exercised live, and BLOCKER-1 is narrowed but open.

The next step toward acceptance is not another re-run of this instrument as written: §5 is
unreachable through the documented trigger path in a session where `fid_worktree` is surfaced
without a parameter schema. Either the tool's parameter schema must be exposed to the session, or
the instrument must be revised to drive the lane lifecycle through the operator CLI
(`bun scripts/worktree.ts`) with an explicit fallback for a tool-schema refusal — the class §1.5
does not currently cover.

**Overall call: DEFECTS FOUND.**

**BLOCKER list:**

1. `fid_worktree` cannot be invoked from the harness session the instrument targets
   (`arguments failed the tool schema at: action — invalid_union`); §5.1 onward is unreachable.