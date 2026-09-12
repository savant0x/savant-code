# FID: Skill evolution knowledge — durable pattern wiki (WikiSkill adaptation, part 3)

**Filename:** `FID-2026-0912-003-skill-evolution-pattern-wiki.md`
**ID:** FID-2026-0912-003
**Severity:** medium
**Status:** closed (implemented + verified 2026-09-12; archived)
**Created:** 2026-09-12 (operator directive: scope the SkillOpt blueprint
and WikiSkill arXiv:2608.27454 into FIDs)
**YAGNI-Compliance:** Verified — one bounded directory (`dev/wiki/`), one
writer (the session-end review script, deterministic), markdown files +
one index. No agent turn added, no new tool, no model calls. The
Proposer-consumption seam ships later (2026-0912-004); this FID only
makes the knowledge EXIST durably.
**Related:** WikiSkill arXiv:2608.27454 (three-layer architecture:
Raw / Wiki / Skills; ablation finding: "persistent knowledge accumulation
in the wiki is critical for effective skill evolution");
`docs/design/SkillOpt Integration into Savant.md` (Epoch-wise meta-update
→ dev/agenda.md, Adapt verdict); FID-2026-0824-012 (self-improving
harness master, closed)

---

## Summary

Savant's self-improving harness captures raw experience (`dev/experiences/
raw-traces.jsonl`) and distills the NEXT session's agenda (`dev/agenda.md`,
≤50 lines, refreshed every session end) — but distilled knowledge that
survives the agenda's rolling window has nowhere durable to live. Lessons
retire from LEARNINGS.md; agenda rows promote or vanish; the reasoning
behind a skill draft dies with the session. WikiSkill's central result is
that a persistent, compounding knowledge layer between raw traces and
skills is the load-bearing component of skill evolution (their ablation:
removing it collapses the gains). This FID adds Savant's Wiki Layer:
`dev/wiki/` — deterministic pattern pages written by the session-end
review script from deduped experience data, indexed, never auto-deleted.

## Environment

- **OS:** Windows 11, Git Bash; Bun 1.3.14-pinned
- **Commit/State:** main @ `7db3fcaf`
- **RED evidence (file:line, this session):**
  - `scripts/session-end-review.ts` exists and runs deterministically at
    SessionEnd (FID-2026-0824-012 contract; refreshes `dev/agenda.md` ≤50
    lines + FID-routing candidates) — it is the natural writer.
  - Raw layer exists: `dev/experiences/raw-traces.jsonl` (immutable capture,
    PostToolUseFailure hook, context-hashed).
  - Meta layer exists but is EPHEMERAL by design: `dev/agenda.md` is a
    ≤50-line rolling buffer (grep agenda.md header: "Auto-refreshed at
    session end… 1-3 active high-leverage capabilities" — rows leave when
    resolved; promotion context is not retained).
  - LEARNINGS.md retention is operator-run (`learnings:retire`) and
    lesson-grained, not failure-pattern-grained.
  - No wiki layer: `ls dev/` shows no wiki/knowledge directory; `knowledge.md`
    is a static project-knowledge doc (goals/commands/conventions), not a
    failure-pattern store.

## Detailed Description

### Problem

The harness has a raw layer and a meta buffer but no compounding knowledge
layer. When `dev/agenda.md` rows rotate out (resolved, or displaced), the
distilled understanding of that failure class evaporates. If the same
pattern resurfaces months later, the Scribe re-derives it from raw traces
with no accumulated context. WikiSkill's data says this layer is the
difference between skill evolution working and not working.

### Expected Behavior

1. `dev/wiki/` with `index.md` + `patterns/<slug>.md` pages.
2. The session-end review script (deterministic, zero model calls) appends
   or updates a pattern page when the dedup engine reports a pattern at
   ≥3 recurrences in-window (the existing promotion threshold): each page
   records the topological error shape, tool name, first-seen/last-seen
   dates, recurrence count, the owning FID if one was routed, and the raw
   example line (unstripped, for context — per the blueprint §5 split
   between hash-input and presentation).
3. Pages are append-amend only: updated with new evidence (dates, counts,
   FID links), never deleted. `index.md` lists pages with counts.
4. Hard bounds: pattern page count unbounded is acceptable (markdown,
   KB-scale); per-page size capped (reuse the agenda ≤50-line discipline;
   cap at ~60 lines) to protect future Proposer context budgets
   (FID-2026-0912-005).
5. The wiki is NEVER read at boot into agent context (invisible to the
   live loop — same discipline as the quarantine) until the Proposer FID
   wires consumption deliberately.

### Root Cause

Not a defect — a missing layer. The harness architecture (capture → dedup →
agenda) stops one step short of durable distillation.

### Evidence

(see Environment — all file:line/ls, this session)

## Impact Assessment

### Affected Components

- `scripts/session-end-review.ts` (writer: pattern promotion → wiki page)
- NEW `common/src/util/skill-wiki.ts` (pure page-build/update helpers,
  suite-covered; Law 13: script consumes helpers, logic is testable)
- `dev/wiki/` (created on first write; git-tracked like agenda/LEARNINGS)
- Suites: wiki helpers (page create, evidence-append, index refresh, cap)

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: new persistent artifact in the repo; mitigated — deterministic
      writer, bounded pages, invisible at boot, never auto-deleted
- [ ] Low

## Proposed Solution

### Approach

WikiSkill's three layers map onto Savant as: Raw = `dev/experiences/
raw-traces.jsonl` (exists, immutable); Wiki = `dev/wiki/` (this FID);
Skills = `.agents/skills/` (exists, operator-governed). Only the middle
layer is missing. The writer is the EXISTING mechanical session-end script
— SkillOpt's "Epoch-wise Slow/Meta Update" Adapt verdict (blueprint matrix)
already picked this seam; WikiSkill confirms the layer is the critical one.

Deliberately NOT adopted (aligned with both sources' rejection tables and
the 09-10 adversarial pass): benchmark/dream rollouts to feed the wiki
(synthetic experience), any model call in the write path, wiki access
during live sessions (inference-agent restriction per WikiSkill §3.2.1 —
training-time wiki access measurably hurt their skill development).

### Steps

1. [ ] **RED:** wiki-helpers suite — page create from a dedup pattern;
       evidence append on recurrence (count/date update, no dup rows);
       index refresh; page-size cap enforcement; `.archive`-style
       non-deletion invariant (update only).
2. [ ] **GREEN:** `common/src/util/skill-wiki.ts` + the session-end writer
       hook (after agenda refresh, before FID routing, consuming the same
       dedup output the agenda consumes).
3. [ ] **VERIFY:** typecheck common + cli; suites; eslint; prettier;
       lint:md.
4. [ ] **LAW 4:** grep wiki helpers' production caller
       (session-end-review.ts) + confirm zero boot-path readers.

### Live Unknowns

- The natural ≥3-recurrence promotion event is live-observable only —
  first real wiki page lands on the next qualifying pattern (same boundary
  class as FID-2026-0824-012's experience capture; recorded, not claimed).
- Page slug collisions across similar patterns → suffix rule pinned in the
  helpers suite.

## Verification Gates

- gate: typecheck common / cli
- gate: test common/src/util/__tests__/skill-wiki.test.ts + scripts/__tests__/session-end-review.test.ts
- gate: eslint --max-warnings 0 · prettier · lint:md

## Perfection Loop

### Loop 2 — AUDIT (2026-09-12)

- **Threshold citation precision:** the contract text said "≥3
  recurrences in-window"; ground truth is "≥3 within the rolling 14-day
  window" (session-end-review.ts:9) and the promote path is
  `bun run experiences:dedup` → session-end routing. GREEN pins the
  writer to consume the SAME dedup output object, not a re-derived
  threshold (Law 13).
- **Writer seam re-verified:** session-end-review.ts is deterministic,
  zero-LLM, runs via the SessionEnd hook (FID-2026-0824-012); the wiki
  write joins the agenda-refresh step. No new hook, no config.
- **Missed surface found:** the wiki dir must appear in `.gitignore`
  NEGOTIATION — it is tracked (governance artifact) but
  `validate:repository`'s quality baselines and scratchpad scanners must
  not flag `dev/wiki/` as unclassified content. Declared GREEN gate:
  validator parity before/after.
- **CHANGE DELTA:** precision corrections + one added gate.

### Loop 3 — ADVERSARIAL self-check (2026-09-12)

- Refutation attempt ("agenda already covers this"): agenda is a ≤50-line
  rolling buffer by its own header; resolved/displaced rows vanish; the
  wiki's append-amend pages are the complement. CONFIRMED distinct.
- Refutation attempt ("write pages from raw traces directly"): rejected —
  the dedup engine owns recurrence truth; bypassing it re-creates the
  over-fragmentation the redaction FID fixed. Stands.
- Half-claim split: "never auto-deleted" holds for the harness; the
  operator may of course delete tracked files — that's governance, not
  harness behavior. Recorded as such.
- **Verdict:** loop converges; document eligible for implementation.

### Missed Questions

1. *Why not reuse `dev/agenda.md` as the wiki?* — The agenda is a ≤50-line
   rolling buffer BY DESIGN (context budget); durable knowledge needs
   append-amend semantics the buffer cannot carry. Complementary layers,
   not one file.
2. *Who delimits a "pattern"?* — The existing dedup engine's ≥3-recurrence
   promotion threshold (FID-2026-0824-012 contract). No new threshold,
   no new tuning surface.
3. *Model-distilled pages instead of mechanical?* — Rejected for this
   FID: a model call in the write path would need a new governance
   ruling under FID-2026-0824-012's operator-only contracts. The
   mechanical page records the data; FID-2026-0912-004's isolated
   Scribe turn is where LLM reasoning enters, governed.
4. *Git-tracked?* — Yes: `dev/wiki/` joins agenda/LEARNINGS as tracked
   governance artifacts (audit trail, operator-visible diffs).

### Code Verification Evidence

Planning-stage FID: implementation evidence lands here at GREEN. RED
evidence (this session): `ls dev/` = no wiki directory; agenda header
(≤50 lines, auto-refreshed) read; raw-traces.jsonl capture contract
verified; knowledge.md confirmed a static project doc, not a pattern
store.

## Resolution

Implemented 2026-09-12 (operator pre-approval: "complete ALL open fids in
logical order w/ automation level 3"). RED-first: 7 pins written against
`common/src/util/skill-wiki.ts` (module-absent → RED), then GREEN.

### Implementation evidence (Loop 4 — Verifier)

- `common/src/util/skill-wiki.ts` — the wiki engine: `WIKI_MAX_EVIDENCE_ROWS =
  12`, slug = kebab tool + 12-hex key prefix, `buildPatternPage` /
  `appendPatternEvidence` (data-signature idempotence — an identical
  observation appends nothing even on a later date; cap keeps the newest
  rows), `updateWikiPattern`, `rebuildWikiIndex` (recurrences desc).
- `scripts/session-end-review.ts` — the writer seam consumes
  `computeRecurrences` output directly (threshold not re-derived) and calls
  `updateWikiPattern` per promoted pattern; `SessionEndReview.wikiPages`
  added (creations only).
- `common/src/util/__tests__/skill-wiki.test.ts` (9) +
  `scripts/__tests__/session-end-review.test.ts` (+2: integration incl.
  idempotent re-review; structural never-boot-read pin). No import of
  `skill-wiki` in any boot surface (pinned).
- Gates: common 718 tests 0 fail · scripts 345/0 · typecheck ×3 (common,
  sdk, agent-runtime) · eslint 0 · prettier clean · `lint:md` PASS.

### Loop 1 — Authoring (2026-09-12)

- Grounding: paper §3.1/§3.2.2 read from the arXiv HTML; blueprint matrix
  row "Epoch-wise Slow/Meta Update — Adapt — dev/agenda.md" reconciled (the
  agenda remains the ephemeral buffer; the wiki is the durable store —
  complementary, not competing).
- GREEN: deterministic-only writer is the load-bearing decision (zero model
  calls keeps this inside FID-2026-0824-012's operator-governance contract;
  the LLM-distillation version would need a new governance ruling).
- CHANGE DELTA: initial authoring.

## Lessons Learned

(none yet)
