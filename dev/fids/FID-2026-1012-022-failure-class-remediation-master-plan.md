# FID: The open-work master plan — every active record and register item sequenced into waves an operator can run

**Filename:** `FID-2026-1012-022-failure-class-remediation-master-plan.md`
**ID:** FID-2026-1012-022
**Severity:** critical
**Status:** converged
**Created:** 2026-10-12 23:10
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

The ledger's purpose is real, but capture coverage must be repaired: `dev/experiences/raw-traces.jsonl` holds **559
failures across 68 classes and 195 sessions** (2026-08-24 → 2026-10-12), recorded mechanically by the
`PostToolUseFailure` → `experience-capture` hook. What failed is the **consumption** of that record.
Classes recurred, were detected, were published to `dev/agenda.md`, and then piled up unfixed while
the ledger grew — because no artifact ever stated *which classes exist*, *who owns each one*, and
*what "fixed" means for a class*. This record is that artifact. It is the **master** of a
master/child program: it carries the complete census of all 68 classes, allocates **every one of them
to exactly one child record** (559 of 559 records, zero unassigned, no double ownership), states the
convergence rule each child must satisfy — a **recurrence assertion measured from the capture**, not a
green suite — and states the closure condition. A child closes only when its classes have stopped
recurring for a declared window. The master closes only when every child is closed. Nothing in the
capture pipeline is disabled: the hook, `experiences:dedup`, the agenda, `lessons:to-skills` and
`lessons:features` keep running. FID-024 repairs capture coverage and classification; FID-014 repairs
class-to-rule targeting. The instrument itself has defects as well as an unclosed consumption loop.

**This record is the program of record for all open work, not only the ledger.** Twenty-four register
items were open on 2026-10-12 — fifteen active FIDs (`-010` … `-024`, this record among them) and nine
register tasks that carry no FID at all (the local `0.0.36` development line, T186, T187, T119, T175,
T171, T173, T62-followups and T122). All of them are sequenced here in
three chains, with each item's prerequisites declared as machine-readable metadata, its exit gate
named, and its **blocker** called out. The point of the record is one sentence an operator can act on:
point an automation run at `FID-2026-1012-022`, activate automation, and the agent works the waves in
order — stopping only at the operator-gated items listed under "What stops for you", which no
automation level can pass.

## Environment

- **OS:** Windows 11 (win32), Git Bash
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14
- **Tool Versions:** `ai` 5.0.122
- **Commit/State:** `main` @ `6e37aa15` (working tree clean at measurement)

## Detailed Description

### Problem

Seven records (`FID-2026-1012-010` … `-016`) were written about the ledger's **artifact** — its boot
read, its size ceiling, its stranded references, its redundant families — and between them they made
no class stop recurring. The classes were never the subject. The result is measurable: the single
largest defect family in the repository (`Incomplete arguments for tool X`, **193 records, 35% of
everything ever captured**) was learned on 2026-08-16 and had its lesson **retired out of the boot
read** on 2026-10-12 while the class fired 16 more times that same day; the top class
(`read_url` 404, **114 records across 18 sessions**) has zero ledger coverage; and the census' own
top-16 mixes classes that are live today with classes last seen in August.

The intent behind keeping the file was correct and is not the thing to change: it is a dog-fooding
ledger kept so that **every failure it records gets a fix**. A record that is stored, ranked, and
never repaired fails that intent twice — once when the defect recurs, and again when the ledger's
growth is mistaken for the problem.

### Expected Behavior

Every class in the capture has an owning record; every owning record names its fix, its gates, and a
**recurrence assertion**; a class that keeps firing keeps its record open; the lesson is written
**last**, once the class stopped. The census is visible to the operator as a matter of course, not
reconstructible on request. And a class above the promotion bar with no owner fails the repository
gate, so a gap cannot sit invisible.

### Root Cause

**There is no program of record.** The repository has (a) an instrument that finds failure classes
and (b) per-incident fix records, and nothing that connects them at the level of the class. Three
consequences follow directly:

1. **Ownership is per-incident, not per-class.** A fix lands, the incident is closed, and the class
   runs on. `read_url`'s 404 (114 records) has never had a record at all.
2. **"Fixed" has no class-level definition.** Every existing verification is a test suite or a
   typecheck — both prove the code path, neither proves the class left production. Nothing re-reads
   the capture after a fix, so no fix can be falsified by the ledger that motivated it.
3. **The census is not an artifact.** It is a one-off aggregation that lives in a session, so the
   operator's knowledge of the top classes and the repository's written state drift apart — which is
   why seven records could be written about file size while the top defect went unaddressed.

### Evidence

Measured at `6e37aa15`. The instrument is one aggregation over the capture, grouped by
`toolName` + `errorFirstLine` (first 70 characters):

```text
$ bun -e '<aggregate dev/experiences/raw-traces.jsonl by toolName + errorFirstLine.slice(0,70)>'
records=559  classes=68  distinct sessions=195  window=2026-08-24 -> 2026-10-12
classes at the repo's own >=3-distinct-session promotion bar: 27

$ # every record belongs to exactly one lane — zero unassigned (verified 2026-10-12)
017 emission   : classes=18 records=193   last 2026-10-12
018 fetch      : classes=11 records=181   last 2026-10-12
019 capability : classes= 6 records= 50   last 2026-10-10
020 edit/path  : classes=13 records= 72   last 2026-10-11
023 execution  : classes=13 records= 27   last 2026-10-11
024 taxonomy   : classes= 7 records= 36   last 2026-09-09
                 ------------ --------
                 68 classes    559 records   (0 unassigned)
```

### Children (the master/child contract)

Every child names this record with a `**Master FID:**` metadata line, this record names every child by
full id (`scripts/fid-ledger.ts` → `fid.graph.master-child-missing`), and this record declares no master
of its own (`fid.graph.master-nested`).

| Child | Lane | Classes | Records |
|---|---|---|---|
| FID-2026-1012-010 | Lane V — the boot read has no size contract | artifact | — |
| FID-2026-1012-011 | Lane V — the ledger's ceiling is enforced by nothing | artifact | — |
| FID-2026-1012-012 | Lane V — retirement strands by-title references | artifact | — |
| FID-2026-1012-013 | Lane V — lesson evidence rots silently | artifact | — |
| FID-2026-1012-014 | Lane V — the rule catalogue and the ledger disagree | artifact | — |
| FID-2026-1012-015 | Lane V — the lesson→feature pipeline is red and unowned | artifact | — |
| FID-2026-1012-016 | Lane V — redundant lesson families inflate the boot read | artifact | — |
| FID-2026-1012-017 | RC1 — emission (the incomplete-arguments family) | 18 | 193 |
| FID-2026-1012-018 | RC2 — fetch (the `read_url` classes) | 11 | 181 |
| FID-2026-1012-019 | RC3 — capability integrity | 6 | 50 |
| FID-2026-1012-020 | RC4 — edit-path and path failures | 13 | 72 |
| FID-2026-1012-021 | RC5 — the recurrence-to-fix loop (machinery) | 0 | — |
| FID-2026-1012-023 | RC6 — command-execution reliability | 13 | 27 |
| FID-2026-1012-024 | RC7 — class taxonomy and horizon | 7 | 36 |
| FID-2026-1012-025 | Implementation-discovered verification harness drift | harness | — |

**Instrument sensitivity, stated because it bounds every claim below** — the slice length changes the
class count, so the number is only meaningful with its instrument:

| Classification slice | Classes | At the ≥3-session bar |
|---|---|---|
| 40 characters | 64 | 28 |
| 60 characters | 66 | 28 |
| **70 characters (this record's instrument)** | **68** | **27** |
| full first line | 82 | 26 |

The coarser the slice, the fewer classes but the more of them clear the bar; the capture stores only
each failure's first line, so no slice can separate sub-causes. `FID-2026-1012-009` recorded the
`errorClass` capture field as the fix; `FID-2026-1012-024` owns it for the census.

### Class census — all 68 classes with their owner (2026-10-12)

Every class the capture holds, ranked by volume, with the child that owns it. Nothing is omitted and
nothing is owned twice: this table is the "ALL failures" list, and it exists so the classes are
visible rather than reconstructible.

| # | Class (`toolName` — error line, first 70 chars) | Hits | Sess | Last seen | Owner |
|---|---|---|---|---|---|
| 1 | `read_url` — Failed to fetch URL: 404 Not Found | 114 | 18 | 2026-10-10 | `-018` |
| 2 | `read_files` — Incomplete arguments for tool read_files | 48 | 19 | 2026-10-12 | `-017` |
| 3 | `str_replace` — The old string "…" was not found in the file | 29 | 13 | 2026-10-11 | `-020` |
| 4 | `str_replace` — Incomplete arguments for tool str_replace | 28 | 18 | 2026-10-11 | `-017` |
| 5 | `read_url` — Incomplete arguments for tool read_url | 27 | 3 | 2026-10-10 | `-017` |
| 6 | `read_url` — No readable text found at URL | 25 | 7 | 2026-10-11 | `-018` |
| 7 | `web_search` — No web search results were returned. Add a research API key | 24 | 7 | 2026-10-10 | `-019` |
| 8 | `write_file` — Incomplete arguments for tool write_file | 23 | 20 | 2026-10-12 | `-017` |
| 9 | `str_replace` — No change to the file | 19 | 12 | 2026-10-11 | `-020` |
| 10 | `spawn_agents` — Incomplete arguments for tool spawn_agents | 17 | 15 | 2026-10-11 | `-017` |
| 11 | `run_readonly_command` — Incomplete arguments for tool run_readonly_command | 15 | 8 | 2026-10-12 | `-017` |
| 12 | `str_replace` — tool result contains an error | 14 | 11 | 2026-09-09 | `-024` |
| 13 | `code_search` — Failed to execute ripgrep: ENOENT … uv_spawn | 13 | 5 | 2026-09-17 | `-019` |
| 14 | `read_url` — Failed to fetch URL: 403 Forbidden | 10 | 7 | 2026-10-12 | `-018` |
| 15 | `read_url` — Failed to fetch URL: 401 Unauthorized | 9 | 8 | 2026-10-10 | `-018` |
| 16 | `read_url` — tool result contains an error | 8 | 2 | 2026-08-26 | `-024` |
| 17 | `apply_patch` — Failed to apply patch to …/packages/agent-* | 8 | 2 | 2026-09-27 | `-020` |
| 18 | `run_readonly_command` — Command timed out after 30 seconds | 7 | 6 | 2026-10-10 | `-023` |
| 19 | `read_url` — Response exceeded 2000000 bytes | 7 | 6 | 2026-10-09 | `-018` |
| 20 | `write_todos` — Incomplete arguments for tool write_todos | 7 | 5 | 2026-10-08 | `-017` |
| 21 | `code_search` — ripgrep exited 0 (matches existed) but 0 matches returned | 7 | 4 | 2026-10-10 | `-019` |
| 22 | `read_url` — Failed to fetch URL: 429 Too Many Requests | 7 | 3 | 2026-10-09 | `-018` |
| 23 | `suggest_followups` — Incomplete arguments for tool suggest_followups | 6 | 5 | 2026-10-04 | `-017` |
| 24 | `code_search` — tool result contains an error | 5 | 4 | 2026-09-02 | `-024` |
| 25 | `basher` — Incomplete arguments for tool basher | 5 | 3 | 2026-10-11 | `-017` |
| 26 | `run_terminal_command` — Command timed out after 30 seconds | 4 | 4 | 2026-10-09 | `-023` |
| 27 | `code_search` — Failed to execute ripgrep at "…": ENOENT | 4 | 3 | 2026-10-04 | `-019` |
| 28 | `run_terminal_command` — Incomplete arguments for tool run_terminal_command | 4 | 2 | 2026-10-10 | `-017` |
| 29 | `read_url` — Failed to fetch URL: 405 Method Not Allowed | 4 | 2 | 2026-10-05 | `-018` |
| 30 | `run_readonly_command` — Tool call aborted: run_terminal_command | 3 | 3 | 2026-10-11 | `-023` |
| 31 | `transition_parameter` — Incomplete arguments for tool transition_parameter | 3 | 3 | 2026-10-10 | `-017` |
| 32 | `run_readonly_command` — tool result contains an error | 3 | 2 | 2026-09-07 | `-024` |
| 33 | `skill_manage` — tool result contains an error | 3 | 2 | 2026-09-08 | `-024` |
| 34 | `write_file` — Failed to apply patch. | 3 | 2 | 2026-09-27 | `-020` |
| 35 | `str_replace` — Attempted to assign to readonly property. | 3 | 1 | 2026-10-01 | `-020` |
| 36 | `run_terminal_command` — tool result contains an error | 2 | 2 | 2026-09-07 | `-024` |
| 37 | `transition_phase` — Incomplete arguments for tool transition_phase | 2 | 2 | 2026-09-28 | `-017` |
| 38 | `apply_patch` — Failed to apply patch to …/dev/fids/FID-* | 2 | 2 | 2026-09-27 | `-020` |
| 39 | `grep` — Incomplete arguments for tool grep | 2 | 2 | 2026-10-06 | `-017` |
| 40 | `read_url` — Unsupported content type: application/pdf | 2 | 2 | 2026-10-12 | `-018` |
| 41 | `glob` — Tool call aborted: glob | 2 | 1 | 2026-09-19 | `-023` |
| 42 | `run_readonly_command` — Command timed out after 45 seconds | 2 | 1 | 2026-10-04 | `-023` |
| 43 | `run_readonly_command` — Command timed out after 60 seconds | 2 | 1 | 2026-10-04 | `-023` |
| 44 | `forge` — Incomplete arguments for tool forge | 2 | 1 | 2026-10-11 | `-017` |
| 45 | `str_replace` — Failed to apply patch. | 2 | 1 | 2026-10-11 | `-020` |
| 46 | `write_file` — tool result contains an error | 1 | 1 | 2026-08-25 | `-024` |
| 47 | `apply_patch` — Failed to apply patch to …/packages/llm-providers | 1 | 1 | 2026-09-10 | `-020` |
| 48 | `write_files` — Incomplete arguments for tool write_files | 1 | 1 | 2026-09-11 | `-017` |
| 49 | `run_terminal_command` — Command timed out after 10 seconds | 1 | 1 | 2026-09-17 | `-023` |
| 50 | `str_replace` — The file does not exist, skipping | 1 | 1 | 2026-09-17 | `-020` |
| 51 | `read_url` — Failed to fetch URL: 503 Service Unavailable | 1 | 1 | 2026-09-27 | `-018` |
| 52 | `run_terminal_command` — Command timed out after 600 seconds | 1 | 1 | 2026-09-27 | `-023` |
| 53 | `run_terminal_command` — Command timed out after 2400 seconds | 1 | 1 | 2026-09-27 | `-023` |
| 54 | `apply_patch` — Incomplete arguments for tool apply_patch | 1 | 1 | 2026-09-27 | `-017` |
| 55 | `apply_patch` — Failed to apply patch to …/cli/src/components | 1 | 1 | 2026-09-27 | `-020` |
| 56 | `run_readonly_command` — Command timed out after 120 seconds | 1 | 1 | 2026-10-02 | `-023` |
| 57 | `code_search` — Code search failed: ripgrep exited 2, unrecognized flag `--` | 1 | 1 | 2026-10-03 | `-019` |
| 58 | `list_directory` — Failed to list directory: ENOENT … scandir | 1 | 1 | 2026-10-04 | `-020` |
| 59 | `str_replace` — Found 2 occurrences of "…" in the file | 1 | 1 | 2026-10-04 | `-020` |
| 60 | `read_url` — Host "…" resolves to a private or reserved address | 1 | 1 | 2026-10-05 | `-018` |
| 61 | `...` — Incomplete arguments for tool ... | 1 | 1 | 2026-10-08 | `-017` |
| 62 | `list_directory` — Tool call aborted: list_directory | 1 | 1 | 2026-10-08 | `-023` |
| 63 | `run_readonly_command` — Command timed out after 180 seconds | 1 | 1 | 2026-10-08 | `-023` |
| 64 | `code_search` — Code search failed: ripgrep exited 2, unrecognized file type | 1 | 1 | 2026-10-09 | `-019` |
| 65 | `str_replace` — Found 3 occurrences of "…" in the file | 1 | 1 | 2026-10-09 | `-020` |
| 66 | `run_readonly_command` — Command timed out after 300 seconds | 1 | 1 | 2026-10-09 | `-023` |
| 67 | `read_url` — Could not resolve host "…": getaddrinfo ENOTFOUND | 1 | 1 | 2026-10-10 | `-018` |
| 68 | `savant_code_tool_call` — Incomplete arguments for tool savant_code_tool_call | 1 | 1 | 2026-10-12 | `-017` |

Class ids are the numbered rows of this table; a child may cite a row by number in its own RED.

## Impact Assessment

### Affected Components

- `dev/experiences/raw-traces.jsonl` — the capture every number here is derived from
- `packages/agent-runtime/src/hooks/experience-capture.ts`, `common/src/types/experience.ts` — the
  record schema and the writer
- `scripts/experiences-dedup.ts`, `scripts/session-end-review.ts`, `dev/agenda.md` — detection and
  publication
- `scripts/lessons-to-skills.ts`, `scripts/lesson-feature-pipeline.ts` — the two producers that
  consume recurrence without filing a repair
- `scripts/validate-repository.ts` — where the class-coverage check belongs
- The six child lanes named below, and Lane V (`FID-2026-1012-010` … `-016`)

### Risk Level

- [x] Critical: the repository's own improvement loop runs daily, produces artifacts, and closes
  nothing. Every session pays for it, and the ledger's growth is its visible symptom.

## Proposed Solution

### Approach

Loop 2 and `docs/design/perfection-loop-2026-10-12.md` govern implementation where
they correct the original plan. No age-based class disposition or repair is implied.

Treat the **class** as the unit of work, and make the program an artifact with a census, an owner per
class, a definition of "fixed" for a class, and a closure condition that cannot be satisfied by a test
suite. Concretely: one master (this record) holds the census and the allocation; each child owns a
lane of classes end to end (RED re-measure → fix → gates → recurrence assertion → lesson); the loop
record (`FID-2026-1012-021`) supplies the machinery (class coverage check, recurrence probe, lesson
ordering); the seven artifact records (`FID-2026-1012-010` … `-016`) stay as Lane V — they serve the
operator's visibility requirement ("massive value, but only if I know about it and it's not hidden")
and the pipeline-targeting refactor, and they are explicitly **not** a substitute for a class fix.

### Steps

1. **Census (done, this record).** Measure every class with the declared instrument; publish the
   counts, sessions, first/last-seen dates and the owner for all 68.
2. **Allocate (done, this record).** Six lanes own all 68 classes; verify zero unassigned and no
   double ownership at every re-measure.
3. **Converge each child** under the rule below, largest first: `023` and `024` are small and unblock
   measurement, then `017` (193 records, the largest), then `018`, then `019`/`020`.
4. **Assert per child, in the capture's terms:** the class must not appear in
   `dev/experiences/raw-traces.jsonl` for the declared window; the assertion is a probe that reads the
   capture, not a unit test.
5. **Write the lesson last**, keyed to the class id and carrying the assertion as its verification —
   so the ledger records what stopped failing.
6. **Gate the census in the repository** (owned by `FID-2026-1012-021`): a class at the bar with no
   owner is an issue named with its count and last-seen date.
7. **Keep the pipeline running while repairing it.** FID-024 owns capture/classification coverage;
   FID-014 owns rule targeting; FID-021 consumes those authorities. Their owned changes must preserve
   the hook's fail-open execution contract without treating incomplete capture as closure evidence.
8. **Draft the Chain C children as their waves begin** — the register items (T122, T186, T119, T175,
   T171, T173, T62-followups, T187) have write surfaces and no owner, so each gets its child FID from
   the same template the twelve existing children use, with its RED measured from the real tree.
9. **Keep the status column current.** This master is the index an operator reads; a wave that closes
   without updating it has not closed.

### Work order

Two chains, one program. Chain A is the class lanes (RC1–RC7); Chain B is Lane V, the ledger
artifact and the operator's line of sight to it. The chains are independent of each other; within each
chain every arrow below is a **real prerequisite**, and each is declared as `**Depends On:**` metadata
on the child so `scripts/fid-ledger.ts` validates that the dependency exists and that the chain has no
cycle (`fid.graph.dependency-missing`, `fid.graph.dependency-cycle`). This table is the schedule;
a child's own RED re-measure is what proves its row is finished.

**Chain A — the class lanes.**

| Wave | Child | Depends on | Deliverable | Exit gate |
|---|---|---|---|---|
| A0 | `-024` (7 classes / 36 records) | — | Investigate all seven unresolved classes; repair capture coverage, stable identity and the shared recurrence probe before any horizon claim | producer/lifecycle/capture pins; class-key tests; census probe |
| A0 | `-023` (13 / 27) | `-024` | One timeout policy with a bounded escalation, a timeout error that reports the budget it hit, and an abort attributed to the executed tool | recurrence probe over the 13 classes |
| A1 | `-017` (18 / 193 — 35% of the capture) | `-024` | A per-tool argument budget, a legal split shape for the bulk tools, and the re-send advice removed for every truncation cause | recurrence probe: the family does not reappear in the window |
| A1 | `-018` (11 / 181) | `-024` | One taxonomy for every fetch outcome, negative caching, and a fallback instead of a repeated try | recurrence probe over the 11 classes |
| A1 | `-019` (6 / 50) | `-024`, `-023` | Capability preflight and loud degradation — a timeout or a missing binary never reads as "found nothing" | recurrence probe over the 6 classes |
| A1 | `-020` (13 / 72) | `-024` | Diagnostic edit responses: a mismatch carries the evidence needed to repair it | recurrence probe over the 13 classes |
| A2 | `-021` | `-017`, `-018`, `-019`, `-020` | The recurrence-to-fix machinery: the class-coverage check in `validate:repository`, the recurrence-probe contract, lesson-last ordering | the check fails on a fixture whose top class has no owner |

The A1 lanes share contracts and handler surfaces, so implement them sequentially after A0's
deterministic gates pass; observation windows continue without falsely closing prerequisites.
`-017` is listed first because it is 35% of everything captured. `-021` must not be worked
before A1 has owners, or `validate:repository` reds on a known-open set (its own record says so).

**Chain B — Lane V, the artifact and its visibility.** The order is the design review's §5 suggested
order, resolved against the records' own prerequisites.

| Wave | Child | Depends on | Deliverable |
|---|---|---|---|
| B0 | `-011` (ceiling is enforced by nothing) | — | The size ceiling moves into `learnings:check` / `validate:repository`, and retirement emits a machine-readable move record |
| B0 | `-014` (rule catalogue and ledger disagree) | — | Rule-first schema with an explicit boot tier, and the promotion target consolidation needs |
| B1 | `-012` (retirement strands references) | `-011` | By-title references resolve across live + retired; the seven admission issues that make `lessons:features --check` red are fixed |
| B2 | `-013` (lesson evidence rots) | `-011`, `-012`, `-014` | Structural/reproduction integrity; durable probes; active legacy lessons reconciled without age-based demotion |
| B1 | `-010` (the boot read has no size contract) | `-011`, `-014` | A generated, bounded boot digest with its own asserted budget |
| B3 | `-016` (redundant families inflate the boot read) | `-010`, `-012`, `-013`, `-014` | Investigated unique invariants consolidated only under the recorded operator ruling |
| B4 | `-015` (the lesson→feature pipeline is red and unowned) | `-012`, `-014`, `-016` | The pipeline check becomes a repo gate after resolution/targeting/consolidation are green |

**Chain C — the register items that have no record yet.** These are open work with a write surface and
no owner, which is why they have sat unstarted. Each one's child FID is drafted, converged and executed
under this master's authority at its wave; the operator's activation of the program **is** the approval
for that draft (automation level 2, drafting automatable and approval given in advance by the
activation), and the child's id is recorded in this table when it exists.

| Wave | Item | Depends on | Deliverable | Exit gate | Automation |
|---|---|---|---|---|---|
| C0 | Local `0.0.36` development line | — | Keep post-release work landing locally on `main` under `## 0.0.36` | `version:check` PASS; the changelog section carries every landing | 3 |
| C1 | T122 — Savant-Free removal | — | Workspace registration, CLI surface, agents, common, docs, release tooling and e2e suites removed; its own child FID drafted at wave start | the removal's own FID gates; the aggregate `ci` leg stops being red by design | 1 → **operator must call it** |
| C2 | T186 — the two workspaces outside every chain | T122 | The remaining `scripts/tmux` leg added, so the chains cover every registered workspace | `bun run typecheck` and `bun run test` cover all registered workspaces | 1 until T122 lands, then 3 |
| C3 | T119 — provider live-list probes (no purchase) | — | Every registered provider's live model list probed over its free endpoint | probe output recorded against `docs/providers.md` and in a session summary | 3 |
| C4 | T173 — KiosAPI window rows for five exact feed ids | — | Live-probed window values for the five ids instead of the conservative 200k default | the five rows land with probe evidence | 3 |
| C5 | T171 — harvested-candidate auto-wire | — | Re-derive the item against the current discovery wizard, then reuse the prefill when selecting a discovery-only provider | `cli/src/utils/__tests__/provider-wizard-discovery.test.ts` green over the re-derivation | 3 for the re-derivation, **1 for the ruling** |
| C6 | T175 — sweep control manifest + control-armed re-run | — | The six external inputs (manifest content, funding, ToS, budget, verdict naming, rotation source) answered concretely | a control-armed re-run whose verdicts are named | **1 — external inputs** |
| C7 | T62-followups — TokenHarbor / TokenRouter | — | TokenHarbor's identity re-run after its allowance resets; TokenRouter's self-identification | both cells resolved in the catalog | 3 once credits allow, **1 for the top-up** |
| C8 | T187 — `version` frontmatter on the remaining skills | — | The six `coding-*` skills carry a version | `skills:check` down to zero version warnings | **1 — `.agents/skills/**` is the operator's `/skills trust` surface** |

### Status board (the agent updates this; it is what an operator reads)

| Item | Chain · wave | Record | Status (2026-10-12) |
|---|---|---|---|
| FID-2026-1012-022 — this master (the index) | — | `-022` | open — closes last, when every child is closed and the allocation re-runs clean |
| Local `0.0.36` development line | C0 | register item | open — dev-line maintenance live; the cut is operator-called |
| T122 — Savant-Free removal | C1 | *drafted at wave start* | blocked — operator must call it |
| T186 — typecheck/test legs | C2 | *drafted at wave start* | blocked — on T122 |
| T119 — provider live-list probes | C3 | *drafted at wave start* | ready — level 3, no external input |
| T173 — KiosAPI window rows | C4 | *drafted at wave start* | ready — level 3, live probe |
| T171 — harvested-candidate auto-wire | C5 | *drafted at wave start* | open — re-derivation is agent work, then an operator ruling |
| T175 — sweep control manifest | C6 | *drafted at wave start* | blocked — six external inputs |
| T62-followups — TokenHarbor / TokenRouter | C7 | *drafted at wave start* | blocked — provider credits |
| T187 — skills `version` frontmatter | C8 | *drafted at wave start* | blocked — operator `/skills trust` surface |
| FID-2026-1012-024 — class taxonomy and horizon | A0 | `-024` | converged (design); worked first |
| FID-2026-1012-023 — execution reliability | A0 | `-023` | **fixed** — implementation + 11 declared gates green (sdk 633 PASS, agent-runtime 2,048 PASS, root typecheck, quality, eslint); recurrence window not yet started, so no class claim |
| FID-2026-1012-017 — emission (193 records) | A1 | `-017` | **fixed** — emission budget, truthful recovery, pre-execution ceiling, spawn steering and bounded revision-guarded bulk staging all implemented with declared gates green and a stamped receipt; recurrence window not started, so **no class claim** |
| FID-2026-1012-018 — fetch (181) | A1 | `-018` | **fixed** — outcome taxonomy, canonical identity and bounded per-run negative cache implemented with declared gates green and a stamped receipt; recurrence window not started, so **no class claim** |
| FID-2026-1012-019 — capability integrity (50) | A1 | `-019` | **fixed** — degradation contract + research surface + `code_search` flag guard; 7 declared gates green + receipt stamped; window open (the `search-executable-missing` cause is the **host** resolver's, and the run-start preflight is still open) |
| FID-2026-1012-020 — edit-path friction (72) | A1 | `-020` | converged (design) |
| FID-2026-1012-021 — the recurrence-to-fix loop | A2 | `-021` | converged (design) |
| FID-2026-1012-011 — ceiling ungated | B0 | `-011` | converged (design) |
| FID-2026-1012-014 — rule catalogue vs ledger | B0 | `-014` | converged (design) |
| FID-2026-1012-012 — retirement strands references | B1 | `-012` | converged (design) |
| FID-2026-1012-013 — lesson evidence rot | B2 | `-013` | converged (reviewed design; active lessons preserved) |
| FID-2026-1012-010 — boot-read size contract | B1 | `-010` | converged (design) |
| FID-2026-1012-016 — redundant lesson families | B3 | `-016` | converged (reviewed design); concrete consolidation remains operator-gated |
| FID-2026-1012-015 — pipeline red and unowned | B4 | `-015` | converged (reviewed design); worked last |

**The automation contract.** Session ceiling is `protocol.config.yaml` → `session.autonomy_level`
(3). An item runs unattended when its level is ≤ the ceiling and it is not on the operator-gated list;
no level lifts the G-laws, credential handling, Law 3 or the project-directory boundary. Per item the
agent: re-runs the item's RED measurement and records it verbatim; drafts the child FID if the item has
none; converges it; implements it; runs the declared gates; records the evidence in the child; closes
and archives the child with its CHANGELOG entry; and updates the **status board** above. The master is
the index, never a gate of its own.

**What stops for you** (the automation halts here and does nothing else in that chain): the `0.0.36`
release cut; T122's removal call; T186 until T122 lands; T175's six external inputs; T62's credit
top-up; T171's ruling on the verdict gate and the consent shape; T187's `/skills trust` grant.

**Wave boundaries.** At the close of every wave, and in the master's own closing pass, re-run the census
command in §Evidence and the allocation check: a class that appeared since the census must be owned
before the wave closes, and the master cannot close while any class above the bar is unowned. Chain C
waves carry their own exit gate instead (the wave table names it), because they are artifact work
rather than class work.

### Convergence rule (each child)

- **RED** re-measures its own classes from the capture with this record's instrument and records the
  numbers verbatim, including the date.
- **GREEN** states the fix and the assertion **window**.
- **AUDIT** pastes the child's gates (workspace typecheck, its tests, `quality`) **and** the
  re-measure.
- **ADVERSARIAL** re-measures independently and answers "did the class move, or stop?" — a class that
  changed shape without leaving is still open.
- A class that does not stop recurring inside the window **cannot** be marked `fixed`; the child
  returns to RED with the new evidence rather than closing.

### Closure condition

Loop 2 and `docs/design/perfection-loop-2026-10-12.md` govern this condition: age and
missing recent records never establish dormancy or repair. Class lanes require investigated
causes, deterministic gates and exposure-qualified observation; artifact and machinery children
require their own committed gates. Dependencies may proceed after deterministic implementation
without pretending the prerequisite's observation window has completed.

- A **child** closes only when its fix landed, its classes show no new records in the declared window,
  and the lesson is written against the class.
- The **master** closes only when every child is closed, and the closing pass re-runs the allocation
  check on the then-current capture (a class that appeared since this census must be owned before the
  master can close).
- An **open master** with an unowned class above the bar is a repository-gate failure, not a backlog
  item.

### Verification

Planned, not yet run: the allocation script must reproduce `68/559`, zero unassigned, on the census
date; the coverage check must fail on a fixture whose top class has no owner and pass on the real
capture; and each child's recurrence probe must fail while its class is still being recorded. No test
artifact for this record exists yet, so no `- gate:` bullet is declared below.

## Verification Gates

This record is **pre-implementation** (`Status: converged`, FID-2026-0915-004) and declares **no
gates**: a declared gate must point at an artifact that exists, and this record's deliverable is a
census plus an allocation, both re-measurable with the command in the Evidence block. Gates are added
by whichever pass flips a child to `fixed`/`verified`, on the child's artifacts.

## Perfection Loop

### Loop 1 — RED (2026-10-12)

- **RED:** the repository owns an instrument that finds failure classes and no program that fixes them.
  68 classes / 559 records / 195 sessions; 27 above the ≥3-session bar; the top class (`read_url` 404,
  114 records / 18 sessions / last 2026-10-10) has never had a record; the largest family (193 records,
  35%) was learned, filed, and had its lesson retired while it fired 16 times on 2026-10-12; and the
  seven existing records for this area address the ledger's artifact, not one class.
- **GREEN:** make the class the unit of work — a master census with per-class ownership (this record),
  six lanes that own all 68 classes, a recurrence assertion as the definition of fixed, lesson-last
  ordering, and a repository gate that refuses an unowned class above the bar.
- **AUDIT:** the census, the per-lane counts and the zero-unassigned result are reproducible with the
  aggregation in the Evidence block at `6e37aa15`; the sensitivity table is the same command at four
  slice lengths; the `read_url`/incomplete-arguments figures match `docs/design/learnings-root-cause-matrix.md`
  §3 and `dev/agenda.md`.
- **ADVERSARIAL:** (a) *Does this duplicate `FID-2026-1012-017`…`-021`?* No — those are five of this
  program's children; without a master, each of them re-derives its own census and their coverage can
  silently overlap or leave residue. This record's allocation is the check that the five plus `023`/`024`
  cover 559 of 559 with no class owned twice. (b) *Is a census that must be re-measured worth an
  artifact?* It is the only thing that answers "which classes exist right now", and its absence is why
  the ledger's coverage is inverted. (c) *Does the class allocation encode a guess?* Yes at the class
  level: the capture stores one line per failure, so a class boundary is a heuristic — which is why the
  instrument, its slice length and its sensitivity are published here and every child re-measures.
  (d) *Could a recurrence assertion be gamed by a quiet period?* A class can be absent because it is
  fixed or because the work stopped exercising it; the assertion therefore carries the window and the
  child's ADVERSARIAL step has to distinguish the two, and a later reappearance reopens the child.
- **CHANGE DELTA:** this pass changed no source — two new records (`-022`, `-023`, `-024`), the master
  linkage and the census linkage in `SCOPE.md`; the class allocation was verified mechanically.

### Loop 2 — Deep current-tree review and self-correction (2026-10-12)

- **RED:** Census reconciles at `8a063bd9`: 68/559/195, zero unassigned or duplicated.
  The 27-class bar is lifetime inventory; 18 current patterns meet the filtered 14-day
  three-session bar. Capture misses real failures and skill targeting self-matches.
- **GREEN:** Apply `docs/design/perfection-loop-2026-10-12.md` to all 15 records.
  Investigate every old class; make 024 repair the instrument before recurrence claims;
  make 014 repair rule links; separate landing dependencies from observation closure.
  The revised B schedule resolves schema/locator/consolidation overlap sequentially.
- **AUDIT:** Root typecheck and repository validation exit 0. Real feature admission
  exits 1 with seven missing titles. Shipped-helper probes reproduce capture omissions,
  unrelated skill links and the readonly-result mutation; details are in the shared review.
- **ADVERSARIAL / missed question:** Did no wrapper records prove seven repaired causes?
  No. Six tools emit later failures; the seventh uses an uncaptured exit-code shape.
  Retain all 24 register items, all 14 children and every operator hold. No source work,
  class resolution, FID closure or implementation receipt is claimed by this review.
- **CHANGE DELTA:** Planning correction only; individual Loop 2 entries record each child.

### Missed Questions

### Implementation authorization and newly discovered work

The operator grants automation level 3 and directs completion of the entire program.
FID-024's instrument is implemented; class repairs and real observation remain open.
Its stable census preserves 559 records and 68 legacy aliases as 55 explicitly owned
classes, all unresolved. It does not replace the historical 68-row baseline above.
FID-2026-1012-025 records verified harness drift discovered by the broad implementation
battery. Repair that deterministic verification dependency before continuing the class
lanes. No production closure, push or publication is implied by this authority.

Two findings from the `-023` lane are **recorded and still unowned**, so a later wave does not have to
rediscover them — plus a third, measured 2026-10-13 during the `-019` pass:

1. `toMatchObject` with an asymmetric matcher **mutates the received value** on Bun 1.3.14
   (`expect({a:'x'}).toMatchObject({a: expect.stringContaining('x')})` leaves `typeof a === 'object'`).
   It silently corrupts a raw tool result before a schema parses it; the `-023` contract test was
   rewritten to parse first, but no other suite was audited. Needs its own harness record.
2. `bun run validate:repository` exits 1 on `quality.ratchet`:
   `scripts/providers/audit-probes/parity-tier1-catalog-probe.ts` is 312 lines against the 300
   absolute maximum, and both fresh parity probes are prettier-dirty. Those files belong to the
   provider-parity lane and were reported rather than edited; the owning lane must split and format
   them. *(2026-10-13: `quality:report` now PASSes over 1,502 baselined files and
   `validate:repository` exits 0 — the parity lane's files were baselined or split; re-check before
   relying on this item.)*
3. **A timeout record landed after the `-023` fix** — `2026-10-13T03:10:27.155Z`,
   `run_readonly_command`, carrying the new contract text with `expectedness: undetermined`. The class
   changed shape without leaving: the message is now actionable, but the capture still cannot separate a
   legitimate 600-second timeout from a defect. That separation is `-024`'s, not a new lane, and `-023`'s
   record now carries the observation.

### Original review questions

1. **Should the size records (`-010` … `-016`) be withdrawn, now that they are not class fixes?**
   No — and this is the operator's ruling of 2026-10-12: keep them, because the ledger's value is real
   **only if it is visible**, and this program must not remove the operator's line of sight to it while
   the classes are being fixed. They are Lane V (the artifact and the pipeline's targeting), the six
   lanes are the class fixes, and neither substitutes for the other.
2. **Does the master own the capture-pipeline refactor the operator asked for next?** No. This record's
   boundary is the classes; the pipeline refactor (targeting, so that a detected class reaches an owner
   without a manual census) is Lane V and is written under its own records. Folding it in would make the
   master's closure condition unmeasurable.
3. **Why is the largest class (`-017`, 193 records) not first in the working order?** Because two lanes
   (`-023` 27 records, `-024` 36 records) are small, self-contained, and each settles a measurement
   question the bigger lanes depend on (`-024` fixes what "a class" means on the capture). Ordering by
   record count alone would fix the census instrument last.
4. **What if a class is not a defect?** Investigate the outcome and its handling. Capture has no
   expectedness field today; analysis filters messages too broadly. FID-024 owns contextual
   classification, preserving unknowns and legitimate outcomes without hiding repeated defects.
5. **What happens when an old class has no recent records?** `-024` investigates its cause,
   claimed fix, producer shapes and capture coverage. The seven generic-wrapper classes remain
   unresolved. A fix boundary or elapsed window cannot replace that investigation.

### Code Verification Evidence

> Pre-implementation record: `Status: converged` (FID-2026-0915-004). Nothing here is implemented;
> what follows records what was CHECKED at the cited state.

- [x] Census re-run at `6e37aa15`: 559 records / 68 classes / 195 sessions / window 2026-08-24 →
      2026-10-12; 27 classes at the ≥3-distinct-session bar; the four-slice sensitivity table produced
      by the same command (64/66/68/82 classes).
- [x] **Allocation verified mechanically, not by hand:** 017=18/193, 018=11/181, 019=6/50, 020=13/72,
      023=13/27, 024=7/36 → 68 classes / 559 records, `UNASSIGNED records=0 classes=0`.
- [x] The existing children and their subjects exist in the active queue at
      `dev/fids/FID-2026-1012-010` … `-021` (12 records, all `Status: converged`); the two new children
      are `dev/fids/FID-2026-1012-023-command-execution-reliability.md` and
      `dev/fids/FID-2026-1012-024-failure-class-taxonomy-and-horizon.md`.
- [x] The master/child contract this record relies on is enforced by `scripts/fid-ledger.ts`
      (`fid.graph.multiple-masters`, `fid.graph.master-nested`, `fid.graph.master-child-missing`): one
      master at most across the active queue, the master declares no master, and the master must list
      every child id — which this record's child table does.
- [x] **Not yet true, and deliberately not claimed:** any class having stopped recurring, any child's
      gates, and this record's receipt. Gates arrive with each child's implementation.

## Boundaries

- The census is a measurement of **the capture**, not of production: the hook is fail-open and records
  only a failure's first line, so a drop in count is strong evidence while a rise may be undercounted.
  Every child's assertion is therefore stated as "no recurrence in the window", never as an exact count.
- This record makes no source change and declares no gates; it is a converged design plus a measured
  census and a verified allocation.
- The allocation is a classification of classes to lanes by mechanism, derived from the class strings
  listed in the census; a child may hand a class to a sibling lane at RED with the re-measure as
  evidence, but the master's closure pass owns the final check.
- The pipeline continues running; its capture and targeting defects are explicitly owned by
  FID-024/FID-014 rather than assumed correct. This planning pass makes no pipeline source changes.
- Nothing was pushed.

## Resolution

**Not implemented — `Status: converged` (pre-implementation, FID-2026-0915-004).**

This record exists so that the failure classes have a program of record: a published census, an owner
for every class, a definition of fixed that the capture can falsify, and a closure condition. It made
no source change. The implementation is the six children, each of which rewrites its own Resolution in
the closure format when it flips to `fixed`.

- **Authorised write surface:** `SCOPE.md` → machine-readable scope targets → this record's line.
- **Program census and lane allocation:** the Evidence block and the census table above;
  `docs/design/learnings-root-cause-matrix.md` for the root-cause matrix and the feature set.
- **Children (14):** `FID-2026-1012-010` … `-021` (Lane V and RCs 1–5) plus `FID-2026-1012-023`
  (RC6, execution control) and `FID-2026-1012-024` (RC7, class taxonomy and horizon).
- **Ordering:** the schedule is `### Work order` above — Chain A (`023`/`024` make the instrument
  honest, then the four independent class lanes, then `021` wires the gate once `017`–`020` have
  owners) and Chain B (Lane V, the review's §5 order). Every edge is declared as `**Depends On:**`
  metadata, so the ledger validates it.
- **Resolved this pass:** `SCOPE.md` read the `010`/`014` edge backwards ("010 blocks FID-014's tier");
  the review's §5 order is authoritative and states the direction `014` → `010` — the digest needs a
  tier to select from.

## Lessons Learned

Written when the program closes — the point of the lesson-last rule is that this section cannot
honestly exist yet. Its subject will be whichever part of the consumption path let 68 classes
accumulate while the artifact they were recorded in was being edited.
