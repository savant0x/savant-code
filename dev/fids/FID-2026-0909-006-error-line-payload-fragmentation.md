# FID: Payload-bearing error lines fragment the experience dedup key

**Filename:** `FID-2026-0909-006-error-line-payload-fragmentation.md`
**ID:** FID-2026-0909-006
**Severity:** medium
**Status:** analyzed
**Created:** 2026-09-09 20:30
**YAGNI-Compliance:** Verified (one redaction step inside the existing single normalization point; no new machinery)

---

## Summary

The 2026-09-09 agenda review verified all three agenda items against ledger
ground truth: `read_url` (8× claimed) is aged out of the 14-day window and its
class was fixed by FID-2026-0909-004; `code_search` (5× claimed) holds only 2
in-window records (below the ≥3 bar) with its caps/markers fixed by
FID-2026-0908-003; `str_replace` (5× claimed, actually 13× in-window) is the
one live item — and 0-EOF code reads reveal its recurrence is not a
str_replace defect at all. `process-str-replace.ts` embeds the model's payload
into its two dominant soft-failure error lines via `JSON.stringify(oldStr)`
(line 234 not-found, line 175 ambiguity), and `normalizeErrorFirstLine` redacts
no payloads, so `experienceDedupKey` (sha256 of toolName + NUL + normalized
line) assigns every distinct failed oldString a unique key. From the first
post-`abe4d6a` str_replace match failure (FID-2026-0909-005 made real error
lines flow), the ≥3 recurrence bar can never fire for the repo's dominant
failure class. This is the mirror defect of FID-2026-0909-005: that fix
corrected over-merging (every failure → one bucket); this is
over-fragmentation (every failure → its own bucket).

## Environment

- **OS:** Windows 11 (win32), Git Bash (MSYS)
- **Language/Runtime:** TypeScript 5.5.4 / Bun 1.3.14
- **Tool Versions:** savant-code v0.0.30 tree
- **Commit/State:** `ef7d4e5` (docs: close out FID-0909-005 session); clean tree; 13 commits ahead of origin

## Detailed Description

### Problem

The 2026-09-09 learning agenda (refreshed 2026-09-05) listed three recurring
soft-failure patterns keyed on the generic error line that FID-2026-0909-005
has since fixed. A ground-truth pass against the ledger and the current code
shows only one item is live, and its cause is structural:

1. **Agenda vs. ledger (tool-mediated probe, `bun scripts/experiences-dedup.ts`,
   2026-09-09):** 36 records, 7 unique patterns, 1 recurrence group ≥3 in 14d —
   `[13×] str_replace: tool result contains an error`. `read_url`'s 8 records
   are all 2026-08-26 (aged out); `code_search`'s 2 in-window records are both
   2026-09-02 (below bar).
2. **The payload classes:**
   `packages/agent-runtime/src/process-str-replace.ts:234` —
   `The old string ${JSON.stringify(oldStr)} was not found in the file,
   skipping...` and `:175` — `Found ${count} occurrences of
   ${JSON.stringify(oldStr)} in the file...`. The echoed oldString is
   legitimate for the model (multi-replacement calls need to know which
   replacement failed), but it makes the error line unique per failure.
3. **The key:** `common/src/util/experiences.ts:65` `experienceDedupKey` hashes
   `toolName + NUL + normalizeErrorFirstLine(line)`; the normalizer (`:25-33`)
   strips ANSI, flips backslashes, collapses whitespace, caps at 500 — it
   redacts no payloads.
4. **Consequence:** for payload-bearing classes the dedup key is unique per
   distinct payload → the recurrence counter, agenda promotion, and FID
   routing never fire. The self-improving loop's promotion threshold is
   structurally unreachable for str_replace's dominant class.

### Expected Behavior

Failures of the same class group under one dedup key regardless of the payload
embedded in the error line: the not-found class (`The old string "…" was not
found in the file...`) collapses to one key, enabling the ≥3 recurrence bar,
honest agenda display, and stable auto-drafted skill slugs. Numerals stay
un-redacted so the expected-failure filter (`HTTP 404`) keeps working.

### Root Cause

FID-2026-0909-005 fixed the extraction gap (real error lines now flow into the
ledger) but left the normalization contract untouched — it was designed for
environment noise (ANSI, path separators, whitespace), not for structured
payload embedding, which `process-str-replace.ts` (and by precedent any handler
that echoes input in its error text) produces. The normalizer has no
payload-redaction step, so class-defining prefixes and instance-defining
payloads hash together.

### Evidence

```text
# Tool-mediated recurrence probe (2026-09-09, this session):
$ bun scripts/experiences-dedup.ts
experiences: 36 record(s), 7 unique pattern(s), 1 recurrence(s) ≥ 3 in 14d
- [13×] str_replace: tool result contains an error

# The payload-bearing classes (0-EOF read, this session):
packages/agent-runtime/src/process-str-replace.ts:175
  error: `Found ${count} occurrences of ${JSON.stringify(oldStr)} in the file. ...`
packages/agent-runtime/src/process-str-replace.ts:234
  error: `The old string ${JSON.stringify(oldStr)} was not found in the file, skipping. ...`

# The normalizer — no payload redaction (0-EOF read, this session):
common/src/util/experiences.ts:25-33
  normalizeErrorFirstLine: first-line → ANSI strip → \\→/ → whitespace collapse → trim → slice(500)
common/src/util/experiences.ts:65-71
  experienceDedupKey = sha256(toolName + NUL + normalizeErrorFirstLine(line))

# Single shared truth — both consumers flow through the same helper:
packages/agent-runtime/src/hooks/experience-capture.ts:42 (capture path)
scripts/experiences-dedup.ts:101 (analysis path)

# Downstream identity built FROM the line (payload-fragmented today):
scripts/evolve-skills.ts:108 — slugify(`${toolName}-${errorFirstLine}`)
# (lessons-to-skills.ts builds skill identity from canonicalRule, not the
#  line — amended per adversarial audit 2026-09-09)

# Read-url soft-failure taxonomy (SDK fetch layer, payload-light classes —
# unaffected by this fix; read 0-EOF this session):
sdk/src/tools/read-url/fetch.ts:23-27 errorResult → errorMessage strings
  ('Invalid URL', 'No readable text found at URL', redirect/size/timeout classes)
```

## Impact Assessment

### Affected Components

- `common/src/util/experiences.ts` (`normalizeErrorFirstLine` gains the
  redaction step; `ERROR_FIRST_LINE_MAX` unchanged)
- `scripts/__tests__/experiences-dedup.test.ts` (pins: payload collapse,
  numeral preservation, idempotency, unterminated-quote conservatism,
  legacy-line stability)
- `packages/agent-runtime/src/hooks/__tests__/experience-capture.test.ts`
  (buildExperienceRecord pin: the stored ledger line is payload-redacted —
  Law-12 posture)
- Consumers that become class-stable via the shared helper (no direct edits):
  `scripts/experiences-dedup.ts:101` (key), `scripts/session-end-review.ts`
  (agenda display), `scripts/evolve-skills.ts:108` (auto-drafted skill slug
  built from the line) + `scripts/lessons-to-skills.ts` (line feeds
  descriptions/token-matching only)
- Not affected: `process-str-replace.ts` (the payload echo is legitimate for
  the model), the 36 legacy ledger records (constant generic line — no quoted
  spans; dedup keys are recomputed at read time), `EXPECTED_FAILURE_PATTERNS`
  (numerals preserved)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: the self-improving loop's promotion threshold is structurally
      unreachable for payload-bearing classes (str_replace's dominant class);
      agenda promotion and auto-drafted skill identity silently mis-group
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

One redaction step inside the single shared normalization point (Law 13 — the
capture path and the analysis path must agree through one truth). In
`normalizeErrorFirstLine`, AFTER the ANSI strip and BEFORE the
backslash→forward-slash path flip (the flip corrupts escaped `\"` sequences and
would break span matching), replace every double-quoted span with a placeholder:

```ts
const QUOTED_SPAN_RE = /"(?:[^"\\]|\\.)*"/g
// …
.replace(QUOTED_SPAN_RE, '"…"')
```

Regex correctness: `[^"\\]` consumes any non-quote/non-backslash character;
`\\.` consumes escaped pairs (escaped quotes, escaped backslashes).
JSON.stringify escapes control characters, so quoted spans never contain raw
newlines — they survive the first-line extraction performed earlier in the
function. The alternation is disjoint on its first character (quote vs
backslash) — linear-time matching, no backtracking blowup over the ≤500-char
input.

Numerals are deliberately NOT redacted: `isExpectedFailure`
(scripts/experiences-dedup.ts) keys on a literal `404` inside the line;
redacting digits would break the HTTP-404 noise filter. Honest residual: the
ambiguity class `Found N occurrences of …` still fragments by N — a minority
class (2 in-window records); the dominant not-found class collapses fully.
Documented, not papered over.

Idempotency: the placeholder `"…"` itself matches the pattern and maps to
itself — re-normalization is a fixed point. Unterminated quotes (odd quote
count) match nothing — conservative no-op.

Anti-merge analysis: two error lines differing only inside quoted spans are the
same error class by definition (the class is defined by the template prefix the
handler emits); no two genuinely distinct classes collapse. Payload redaction
additionally improves the Law-12 posture: the capture sink's contract says raw
tool arguments are never persisted, yet payload-bearing lines today persist up
to 500 chars of tool input through `errorFirstLine`.

Design alternatives rejected: (1) redact inside `experienceDedupKey` only —
splits the one-truth contract and leaves agenda display + auto-drafted skill
slugs payload-fragmented; (2) rewrite the str_replace error templates to not
embed the payload — the model legitimately needs the echoed oldString in
multi-replacement calls (which replacement failed), and it fixes one handler
while leaving every other payload-echoing handler fragmented.

### Steps

1. RED-first: add pins to `scripts/__tests__/experiences-dedup.test.ts` —
   (a) two not-found lines with distinct quoted payloads normalize identically
   and share a dedup key; (b) an `HTTP 404` line retains `404` post-normalization
   (numeral preservation — the expected-failure filter stays live);
   (c) idempotency — normalizing an already-redacted line is a fixed point;
   (d) an unterminated-quote line is left untouched; (e) the legacy generic
   line normalizes unchanged (no quoted spans). Add one pin to
   `packages/agent-runtime/src/hooks/__tests__/experience-capture.test.ts` —
   a failure input whose `error_message` carries a quoted payload stores the
   redacted line in the ledger record (Law 12).
2. GREEN: insert the redaction step into `normalizeErrorFirstLine` at the
   ordered position (post-ANSI, pre-path-flip); the pin suites go green.
3. Doc check: `docs/self-improving-harness.md` — update only if its
   normalization contract text enumerates the transforms (then add payload
   redaction to the list); verify at GREEN.
4. Close per ceremony once implemented: receipt (`bun run fid:verify --write`),
   status, archive move, CHANGELOG, path-scoped commit (G1–G4, G8).

### Verification

RED leg (pins fail pre-fix), then: typecheck common + agent-runtime, the two
pin suites green, eslint/prettier on touched files, and
`bun scripts/experiences-dedup.ts` still reporting 36 records / 7 patterns /
1 recurrence (legacy records unchanged). Live boundary (honest): class-stable
grouping becomes observable when the first natural payload-bearing
str_replace failure lands post-fix — an operator-observable live check, never
claimable from unit runs alone.

## Verification Gates

> Planning record — gates declared now; stamped at implementation time
> (mandatory once status flips to `fixed`/`verified`).

- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: test scripts/__tests__/experiences-dedup.test.ts
- gate: test packages/agent-runtime/src/hooks/__tests__/experience-capture.test.ts

## Perfection Loop

### Loop 1 — RED / GREEN (2026-09-09, this session)

- **RED:** Agenda items verified against ledger ground truth via the
  tool-mediated probe (`bun scripts/experiences-dedup.ts`): read_url 0
  in-window (aged out; class fixed by FID-2026-0909-004 `4b03e9b`),
  code_search 2 in-window (below the ≥3 bar; caps fixed by
  FID-2026-0908-003), str_replace 13× in-window — the only live group,
  understated by the stale agenda. 0-EOF reads of `process-str-replace.ts`,
  `common/src/util/experiences.ts`, `experience-capture.ts`,
  `session-end-review.ts`, `experiences-dedup.ts`, `str-replace.ts`,
  `write-file.ts`, `pre-dispatch-gates.ts`, and `sdk/src/tools/read-url/fetch.ts`
  cataloged the payload-fragmentation mechanism, the single shared
  normalization point, the downstream identity builders, and the read_url
  class taxonomy (payload-light — unaffected). Cross-agent-claim discipline:
  the agenda's 2026-09-05 claims were treated as hypotheses and re-derived
  from the ledger before any routing decision.
- **GREEN (design, converged):** the quoted-span redaction step in
  `normalizeErrorFirstLine` described in Proposed Solution. Thinker delegation
  was attempted and failed on the native tool-call truncation class (spawn
  payload too large — the documented `recovery-steers-not-just-retries`
  failure); the critique was resolved by the Orchestrator from complete 0-EOF
  evidence: regex correctness for JSON.stringify output, numeral preservation
  for the 404 filter, no-migration for legacy records (keys recomputed at read
  time), idempotency, anti-merge analysis, and the two rejected design
  alternatives.
- **Recorder authoring note:** the Recorder transcribed part 1 (create) then
  stalled on part 2 (the known FID-2026-0823-011 read-without-write class,
  second occurrence this session lineage after the FID-2026-0909-005 loop).
  The Orchestrator completed parts 2–3 directly under the HYBRID-mode
  exception (operator directive 2026-08-23: Orchestrator may author its own
  FID records when no sub-agent authored the content — the Recorder was
  transcribing, not authoring). The split-spawn recovery pattern (create +
  append) kept each payload under the truncation threshold for the one spawn
  that succeeded.
- **AUDIT (Verifier, 2026-09-09):** 0 FAIL / 4 NEEDS-REVIEW — design logic
  (regex mechanics, ordering, numeral preservation, idempotency), template
  compliance, internal consistency, and gates all PASS; the four
  NEEDS-REVIEWs were evidence clusters compacted out of the zero-tool
  Verifier's visible history (citations, recurrence numbers, window
  predicate, agenda refresh) — routed to the Adversary for re-derivation.
- **ADVERSARIAL (2026-09-09):** verdict ADJUSTED — record shippable
  after one citation amendment. All four clusters re-derived with read
  tools and resolved in the record's favor: every citation confirmed
  verbatim except one; recurrence math re-derived from the raw ledger
  (matches the probe exactly); window predicate confirmed EXACT-ROLLING
  (`cutoff = now − 14d`, `ts >= cutoff` — not date-floored), so the
  read_url aged-out disposition stands (the date-floored hypothetical had
  a false antecedent); agenda refresh confirmed (1 item, 13×). The one
  REFUTED citation — the `:108` slug-from-errorFirstLine site is
  `scripts/evolve-skills.ts:108`, not `lessons-to-skills.ts:108` (which
  builds skill identity from `canonicalRule`) — was amended in this
  record's Evidence and Affected Components sections (self-correct pass,
  mechanically re-verified by grep before the edit). Residual noted, no
  amendment: the read_url records exited the window at ≈02:28Z today —
  the disposition is hours-fresh but monotonic (records only age further
  out).
- **CHANGE DELTA:** n/a (initial record).

### Missed Questions

1. *Why does the agenda show 5× for str_replace when the ledger holds 13
   in-window?* The agenda was last mechanically refreshed 2026-09-05 (its
   framing note says so); the 09-07/09-08/09-09 records postdate that refresh.
   The session-end hook refreshes it at SessionEnd — this session's refresh
   reconciles it. Lesson: an agenda item is a claim with a refresh timestamp,
   not ground truth.
2. *Does redaction break the expected-failure noise filter?* No — numerals
   are preserved; only double-quoted spans are redacted. `HTTP 404: …` keeps
   its literal `404`.
3. *Do the 36 legacy records need migration?* No — all carry the constant
   generic line (no quoted spans); dedup keys are computed at read time from
   the stored line, so their grouping is unchanged.
4. *Could redaction merge two genuinely distinct classes?* Two lines differing
   only inside quoted spans share the same handler template — the same class
   by definition. The template prefix defines the class; the payload defines
   the instance.
5. *What about the ambiguity class (`Found N occurrences`)?* Honest residual:
   N survives redaction (numerals preserved for the 404 filter), so that
   minority class still fragments by count. Accepted + documented; the
   dominant not-found class collapses fully.
6. *Is the Law-12 tension real?* Yes — the capture sink's contract says raw
   tool arguments are never persisted, yet payload-bearing error lines
   persist up to 500 chars of tool input today. The redaction step restores
   the contract at the single normalization point, without weakening the
   model-facing error text (which still carries the full payload at the
   tool-result layer).
7. *Should read_url / code_search get FIDs?* No — read_url's class was fixed
   (FID-2026-0909-004) and its records aged out; code_search sits below the
   promotion bar with its caps already fixed (FID-2026-0908-003). Dispositions
   recorded here and in the session summary. Watch item: any new code_search
   soft-failure re-enters the window and re-triggers the ≥3 evaluation with
   real error lines.
8. *Is there a second payload-bearing class shipping today?* Audit-style
   sweeps: `Found N occurrences of …` (str_replace), and generically any
   handler echoing input in error text. The shared-helper fix covers them all
   at once — the deciding argument against per-handler template rewrites.

### Implementation Evidence (REQUIRED for `closed`)

> Planning record — status is `analyzed`; implementation has NOT started.
> This section is completed only at closure with commit SHA, file:line ranges,
> gate output, and reproducibility evidence. A `closed` FID with no code
> violates the Ground-Truth rule (`fid-closure-requires-implementation-evidence`).

- [ ] **Commit SHA:** pending implementation
- [ ] **File:line ranges:** pending implementation
- [ ] **Gate output:** pending implementation
- [ ] **Reproducibility:** pending implementation
- [ ] **Step statuses:** Steps 1–4 pending (not started)

### Code Verification Evidence

> Same discipline — verified at implementation time. Current state: the
> referenced files exist and were read 0-EOF this session; the Proposed
> Solution is a design, not an implementation claim.

- [x] Files referenced in Affected Components exist
- [ ] Implementation matches the Proposed Solution (pending — not implemented)
- [ ] Typecheck/tests/lint pass with pasted tool output (pending)
- [ ] Production call-graph evidence for new/repaired wiring (pending)
- [x] FID status reflects the actual implementation state (`analyzed` = planning converged, no code)

## Resolution

> Pending implementation. Set when the fix lands: Closed Date, Fix Description, Tests Added, Verification Evidence, Archived.

## Lessons Learned

> Captured at closure. Preview: the mirror-defect pattern — fixing
> over-merging (FID-2026-0909-005) without re-examining the shared
> normalization contract for the opposite failure mode (over-fragmentation)
> left the pipeline's dominant class structurally unreachable. When a
> dedup/grouping key gains a new input source, re-run the grouping-semantics
> analysis for both directions of failure.