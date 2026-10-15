# Learnings store: boot-loading and lifecycle review

**Date:** 2026-10-12
**Subject:** `dev/LEARNINGS.md` — why the boot read is at its limit, what is wrong with the
store as a store, and the features that would fix it.
**Status:** review complete, findings unowned by any record before this pass; seven FIDs
authorised (`FID-2026-1012-010` … `-016`).

> Non-FID design document (ECHO: design documents live in `docs/design/`, never at the repo
> root and never with a `FID-` prefix). The records that carry the work are the FIDs mapped in
> the last section.

## 1. The boot contract as it exists today

`dev/LEARNINGS.md` is not a personal notes file; it is a **boot-read artifact**, read 0-EOF
into context before the agent is allowed to do anything else:

- `agents/savant/system-prompt.ts:117` — "your first actions on a fresh (or resumed) session
  are the boot reads, **in every mode** — read `ECHO.md` 0-EOF, plus `ARCHITECTURE.md`,
  `protocol.config.yaml`, and `dev/LEARNINGS.md`, before any non-read tool call. The harness
  blocks other tools and ungrounded final answers until the protocol read completes."
- `protocol.config.yaml:49` — `learnings: 'dev/LEARNINGS.md'` (knowledge-pipeline surface).
- `common/src/constants/read-files.ts:18` — `READ_FILES_MAX_CHARS = 100_000`: the boundary
  that silently truncates any read past it.
- `common/src/util/embedded-protocol.ts:37` + `scripts/generate-protocol-bundle.ts:86` — in
  embedded (npm-install) mode, a request for `dev/learnings.md` is served the curated
  `docs/embedded-learnings.md` instead. The internal ledger never ships.

Two hard limits therefore apply to one file:

| Limit | Value | Enforced by |
|---|---|---|
| Boot read cap (chars) | 100,000 | `read-files.ts` boundary — truncates, does not fail |
| Retirement cap (lines) | 1,200 | `scripts/learnings-retire.ts:29` — read only when retirement runs |

The truncation is not hypothetical. `CHANGELOG.md:3464` records the earlier pass that found
the file **at 1,610 lines / 102,520 chars and truncating at boot**, and the "Safe Core"
restructure (FID-2026-0916-007) that brought it back under. The 1,200-line cap in the design
plan is the same constraint stated as a number: the ledger is boot-read into every session,
so at ~1,200 lines it approaches the recent-tail token threshold and starts to drive
compaction (`docs/design/Savant Self-Improving Architecture Plan.md:23,42,154`).

## 2. Measured state (2026-10-12, at `HEAD`)

| Measure | Value | Headroom |
|---|---|---|
| Chars | 77,195 | 22,805 to the boot read cap (23%) |
| Lines | 1,174 | **26 to the retirement cap (2%)** |
| `## Lesson:` headings | 37 = 34 governed + 3 legacy narrative | — |
| Governed entries with all 9 required fields | 34/34 | — |
| Governed entries with a `Canonical rule` | 8 | 26 without |
| Canonical rules defined in `dev/LEARNING-RULES.md` | 32 | 21 referenced by no lesson |
| Entries with `Scope: internal` | 34/34 | `embedded`/`release` unused in the ledger |
| Format of `docs/embedded-learnings.md` (the shipped subset) | 4 lessons, all 2026-08-11 | unchanged for 2 months |
| Retirement volume in `ac4bad20` (today) | 972 lines moved out | 74 headings → 37 live + 37 retired |
| `learnings:check` | PASS (34 structured, 3 narrative below boundary) | — |
| `lessons:features --check` | **FAIL — 7 admission issues, exit 1** | unowned |

The retirement cap is the binding one: the next lesson written into the ledger breaches
1,200 lines, and nothing would say so.

## 3. Issue matrix

Severity is boot-impact first: **critical** = breaks or threatens the boot read; **high** =
silently loses correctness or strands work; **medium** = cost, drift or unowned debt.

### A. Boot-load infeasibility and unbounded growth

| id | Issue | Evidence | Sev | Feature |
|---|---|---|---|---|
| A1 | The boot read loads the **whole** ledger 0-EOF in every mode, with no size contract, no budget and no measurement. It has already truncated silently once. | `agents/savant/system-prompt.ts:117`; `read-files.ts:18`; `CHANGELOG.md:3464` | critical | F1, F5 |
| A2 | Every consumer pays the whole file: boot, Scribe write surface, skills bridge, feature pipeline, human reading. Nothing can load "the rules relevant to this task". | `protocol.config.yaml:49`; `lessons-to-skills.ts:loadLessons`; `lesson-feature-pipeline.ts:51` | critical | F1, F2 |
| A3 | The 1,200-line ceiling is enforced by **nothing**; only `learnings:retire` knows it, and retirement is operator-run and manual. | `learnings-retire.ts:29` (only reference); grep `DEFAULT_LINE_CAP` | high | F3 |
| A4 | Growth is one-way and unbounded by construction: 34 governed lessons accumulated in 16 days (2026-09-27 → 2026-10-12); nothing removes or merges an entry except whole-entry retirement. | ledger date field census | high | F3, F4 |

### B. No loading contract: one flat file serves every consumer

| id | Issue | Evidence | Sev | Feature |
|---|---|---|---|---|
| B1 | There is no tier distinction a loader can act on: all 34 governed entries are `Status: active` and all are boot-read. "Always apply this" and "here is what happened once" are the same shape. | `learnings-schema.ts` status enum; entries such as `call-graph-proof-asserts-the-caller` vs the 76-failure breaker post-mortem | critical | F2 |
| B2 | The shipped subset is a **frozen hand-curated file**, not a promotion target: `docs/embedded-learnings.md` holds 4 lessons dated 2026-08-11, and no internal lesson carries `Scope: embedded`, so nothing can be promoted and nothing verifies the subset is current. | `docs/embedded-learnings.md`; scope census (34 × internal) | high | F2 |
| B3 | Vocabulary and ledger disagree: 32 canonical rules are defined, 11 are referenced, 21 are named by no lesson — while 26 of 34 lessons name no rule. A rules-first loader has no authoritative set to load. | `dev/LEARNING-RULES.md` (32 `## Rule:`); ledger `Canonical rule` census | high | F2 |

### C. What a lesson carries is not what a loader needs

| id | Issue | Evidence | Sev | Feature |
|---|---|---|---|---|
| C1 | Per-entry cost is audit-shaped, not load-shaped: ~31 lines / ~2 KB each, dominated by narrative `Failure` prose (up to 30 lines quoting the operator) that no consumer reads at boot. | ledger line census; e.g. FID-2026-1007-007 entries | high | F2, F4 |
| C2 | No boot-relevance field exists. Nothing separates a durable invariant from an incident report, so the boot read is forced to include all of both. | `learnings-schema.ts` required-field list | critical | F2 |
| C3 | Five families restate one invariant across several incidents — 18 of the 34 governed entries: shared-state/test isolation (5: 1007-001/-002/-006), register-and-contract shape parsing (4: all 1009-001), consumer/wiring proof (4: 1006-003, 1007-007), three-state verdicts / absence ≠ zero (4: 1007-008/-009, 1012-002/-009), provider-collection reporting (2: 1007-008). | ledger titles, listed by owning FID | medium | F4 |

### D. Reference and evidence rot

| id | Issue | Evidence | Sev | Feature |
|---|---|---|---|---|
| D1 | Retirement strands references: 7 admission issues in `lessons:features` name lesson titles that now exist **only** in `dev/LEARNINGS-RETIRED.md` (each verified `live=0, retired≥1`). Nothing resolves a title across the live+retired pair. | `lessons:features --check` (FAIL, LF-001/003/005/006) | high | F3 |
| D2 | `**Verification:**` is unvalidated prose (only `**Evidence:**` is resolved, for existence and exactly-once) and two lessons pin their reproduction to `dev/scratchpad/active/*.ts` — a surface that now expires idle files after 24 hours by design. | `dev/LEARNINGS.md:453,648`; `learnings-references.ts:validateStableReferences`; FID-2026-1012-006 | high | F4 |
| D3 | Historical entries are coupled to the live tree: a structural reference must resolve exactly once **today**, so a module split or extraction reds a lesson that described last month's code. | `learnings-references.ts:resolves` | medium | F4 |
| D4 | The 3 entries below the legacy boundary are permanently unvalidated and un-promotable — they carry non-schema scopes (`cli, performance`, `cli, TUI`, `harness, skills`) and `lessons:features` reads them as `historical`. | `learnings-schema.ts:structuredBlocks`; `lessons:features` report | medium | F4 |

### E. Downstream health

| id | Issue | Evidence | Sev | Feature |
|---|---|---|---|---|
| E1 | `lessons:features` is red (7 issues, exit 1) with **no owner**: no active FID, no `SCOPE.md` item, absent from `validate:repository` and the pre-push battery; it surfaces only as a fail-open advisory line in the session-end review. | `lesson-feature-pipeline.ts`; `session-end-review.ts:246` | high | F5 |
| E2 | The skills bridge reaches 4 drafts out of 34 lessons because eligibility requires a `Canonical rule` (26 lessons have none) matched to a ≥3-distinct-session recurrence. | `lessons-to-skills.ts:findCandidates`; `.agents/skills/.quarantine/` (4) | medium | F2 |
| E3 | Retirement is auditable only through git: no machine-readable record of what moved, when, or why. | `learnings-retire.ts` (archive append only) | medium | F3 |

## 4. Features that fix them properly

Each feature states the mechanism, not the intention, and names the acceptance evidence that
would prove it.

**F1 — A generated, bounded boot digest.** The boot ritual keeps reading exactly one lessons
file, but that file becomes a **generated** artifact holding rules and guards only, with its
own size assertion (`chars ≤ budget`, asserted in a test, not by convention). `dev/LEARNINGS.md`
stays the append-only source of truth and is read **on demand** by an index (title → line
range), never at boot. Acceptance: the boot digest is byte-reproducible from the ledger; a
digest over budget fails a declared gate; the ledger can grow past 100,000 chars without
truncating anything the agent boots with.

**F2 — Rule-first schema with an explicit tier.** Promote the durable invariant of each lesson
into `dev/LEARNING-RULES.md` (already the named vocabulary) and give a rule the tier the boot
loader needs (`boot` | `reference` | `historical`). Boot loads `boot` rules; the ledger holds
the incidents as evidence for them. `Scope: embedded` becomes a real promotion path (rule →
curated shipped subset) instead of an unused enum value. Acceptance: every governed lesson
either names an existing rule or is explicitly `historical`; the boot tier has a declared
size; `docs/embedded-learnings.md` becomes generated from it and drift-checked.

**F3 — A gated, logged lifecycle.** Move the size ceiling into `learnings:check` (and therefore
`validate:repository`), and make retirement emit a machine-readable move record
(`title`, `date`, `reason`, `destination`) so a title's location is resolvable across
live + retired. Acceptance: a ledger over either ceiling fails the repo gate; a by-title
reference to a retired lesson resolves; `lessons:features --check` passes over the state.

**F4 — Reference integrity by tier.** Split the two kinds of reference the schema already has
in spirit: **structural** (`path → symbol|heading|test`) resolved live and pinned, and
**reproduction** (how a claim was measured) resolved only for durability — an ephemeral path
(scratchpad, `/tmp`, gitignored) is rejected outright and must be replaced by a committed
probe or a command. Historical entries may pin an `as-of` commit so a moved symbol stops
reding history. Consolidation of the five redundant families happens under the existing
supersession machinery, operator-approved. Acceptance: no entry pins an ephemeral path; a
moved symbol degrades a historical entry to a warning, not a red; consolidated families keep
one canonical rule each with the incidents as evidence.

**F5 — The boot budget is measured, and the pipeline has an owner.** Emit the boot payload's
size per session as telemetry and gate the ceiling, so a re-breach is announced instead of
rediscovered; and wire `lessons:features --check` into `validate:repository` so a ledger/consumer
divergence cannot sit red and unowned. Acceptance: a synthetic ledger over budget fails the
gate; the pipeline check is a repo gate with an owner FID.

**F6 — Adoption path stays the pipeline.** The lesson→feature pipeline (candidate store
`dev/feature-pipeline/candidates.json`) is the vehicle for turning consolidated rules into
product work; its title resolution must follow retirement (a prerequisite of F3) before new
candidates are admitted. Acceptance: `LF-001/-003/-005/-006` re-admit cleanly and the store
carries candidates for F1/F2/F4 as products rather than as ledger repairs.

## 5. FID mapping

| FID | Title | Matrix rows | Features |
|---|---|---|---|
| `FID-2026-1012-010` | The boot read has no size contract | A1, A2 | F1, F5 |
| `FID-2026-1012-011` | The ledger's size ceiling is enforced by nothing | A3, A4 | F3 |
| `FID-2026-1012-012` | Retirement strands by-title references | D1, E3 | F3, F6 |
| `FID-2026-1012-013` | Lesson evidence rots silently | D2, D3, D4 | F4 |
| `FID-2026-1012-014` | The rule catalogue and the ledger disagree | B2, B3, C1, C2, E2 | F2 |
| `FID-2026-1012-015` | The lesson→feature pipeline is red and unowned | E1, F5 | F5, F6 |
| `FID-2026-1012-016` | Redundant lesson families inflate the boot read | C3 | F4, F1 |

**Suggested order:** 011 and 012 first (they unblock the red pipeline and stop silent
re-breach), then 014 (rule tiering, which F1 depends on), then 010 (the digest needs a tier to
select from), then 013 and 016 (evidence and consolidation), 015 last.

## 6. Boundaries of this review

- Size, counts, scope distribution, rule catalogue and the pipeline failure are measured at
  `HEAD` on 2026-10-12 and are reproducible from the commands in each FID's evidence.
- The "five redundant families" clustering is a reading of the entries, with the titles and
  owning FIDs listed; the line-share it could recover is an estimate, not a measurement.
- No boot read was executed under a live harness in this pass; the mechanism is cited from the
  prompt contract and the read boundary, not observed in a running session.
- Nothing in this review repairs the ledger. The FIDs above own the repairs; the register
  carries their write authority.
