# Active FID Perfection Loop — 2026-10-12

## Review contract

Operator instruction: "re-run the perfection loop on it and all fids in the fids folder then we're going to begin work".
The review covers all 15 active FIDs, `FID-2026-1012-010` through `FID-2026-1012-024`.
Source baseline: `8a063bd97a7f9e980db0cdfa2f23a3b3e6f253b8`; initially clean worktree.
This is a single-agent planning audit. Adversarial challenges are a separate review pass within
this session, not an independent agent's certification. No implementation or closure is claimed.
This is a review in progress. Corrections are folded into each FID before convergence is reported.
Operator correction: "none of this is dormant without a deep invistigation, so double check everything".
Every recorded class remains unresolved until its mechanism and claimed repair are investigated.

## RED — reproduced measurements

The census groups `toolName + '|' + errorFirstLine.slice(0, 70)` over the immutable capture.
The census is historical inventory; it is not the live promotion population.

```text
records=559 classes=68 sessions=195
slice=40 classes=64 lifetime_session_bar=28
slice=60 classes=66 lifetime_session_bar=28
slice=70 classes=68 lifetime_session_bar=27
slice=500 classes=82 lifetime_session_bar=26
017: 18 classes / 193 records
018: 11 classes / 181 records
019:  6 classes /  50 records
020: 13 classes /  72 records
023: 13 classes /  27 records
024:  7 classes /  36 records
TOTAL: 68 classes / 559 records; zero unassigned; zero double ownership
incomplete_2026_10_12=16
as_of=2026-10-12T23:32:51.6395358+00:00
eligible_14d_three_sessions=18
ledger_utf16_chars=76775 ledger_utf8_bytes=77195 ledger_newlines=1174
```

The 18 eligible patterns use full normalized lines, the existing expected-failure filter,
three occurrences in three distinct sessions, and timestamps within `[now - 14d, now]`.
The shipped dedup CLI prints 23 frequency-qualified recurrences; five lack three distinct
sessions. Its report is not itself the promotion decision (`scripts/experiences-dedup.ts:158`).
The original 77,195 figure measures UTF-8 bytes, not JavaScript characters. The read limit
uses characters; the retirement tool uses `split(/\r?\n/).length`, which includes the terminal
empty line: 1,175 logical segments, 25 below 1,200. Keep both units visible and named.

Reproduction, read-only PowerShell (the date option prevents automatic DateTime coercion):

```powershell
$records = @(Get-Content -LiteralPath dev/experiences/raw-traces.jsonl |
  Where-Object { $_.Trim() } |
  ForEach-Object { $_ | ConvertFrom-Json -DateKind String })
$groups = @($records | Group-Object {
  $_.toolName + '|' + $_.errorFirstLine.Substring(0, [Math]::Min(70, $_.errorFirstLine.Length))
})
$groups | Group-Object {
  $row = $_.Group[0]
  if ($row.errorFirstLine -like 'Incomplete arguments for tool*') { '017' }
  elseif ($row.errorFirstLine -eq 'tool result contains an error') { '024' }
  elseif ($row.toolName -eq 'read_url') { '018' }
  elseif ($row.toolName -in @('web_search', 'code_search')) { '019' }
  elseif ($row.errorFirstLine -match 'Command timed out|Tool call aborted') { '023' }
  else { '020' }
} | ForEach-Object {
  '{0}: classes={1} records={2}' -f $_.Name, $_.Count,
    (($_.Group | ForEach-Object { $_.Count } | Measure-Object -Sum).Sum)
}
```

An initial read-only measurement called `StartsWith` on PowerShell-coerced dates and failed.
The corrected `-DateKind String` measurement above returned 16; the initial zero is invalid.
Raw arguments, context hashes, credentials and ledger records are not reproduced here.

## GREEN — shared acceptance and implementation contracts

### Class identity, ownership and recurrence

`common/src/types/experience.ts:29` stores no expected flag or cause field today.
Expected failures are filtered at analysis time (`scripts/experiences-dedup.ts:96`), not capture time.
Introduce optional versioned cause metadata, preserving compatibility with all old records.
Keep tool identity, stable cause, and expected/unexpected/undetermined classification separate.
Expectedness must be grounded in the observed outcome and operation; absent evidence is
undetermined, never silently expected. Historical messages cannot recover missing causes.
Retain the original 70-character census as a reconciliation view with a mapping to new keys.
New keys must not make an old class disappear by renaming it or splitting its ownership.

Use one versioned class-owner manifest at `dev/experiences/class-owners.json`, maintained under
the master. Match stable keys explicitly; reject missing and multiple owners. Boundaries belong
in `dev/experiences/fix-boundaries.json`: full commit SHA, UTC time, affected keys, evidence,
observation start/end, and exercised-session receipts. They are claims to verify, not permission
to label historical silence a fix. Do not rewrite or purge the historical capture.

The default observation window is 14 consecutive UTC days starting after the implementation
commit, with at least three distinct real sessions exercising each repaired mechanism.
Receipts name the production path, class keys exercised and capture availability; deterministic
tests supplement these receipts and cannot substitute for live exposure. Missing capture,
malformed records, incomplete windows, absent exposure, or unavailable receipts produce
`NEEDS-REVIEW` and a failing closure probe. Later unexpected recurrence reopens the owner.
One occurrence of an owned unexpected defect fails the closure probe; the three-session bar
applies to promotion, not to deciding whether a landed fix held.

The failure-only ledger cannot prove successful exposure or capture completeness. Real run
receipts must supply that evidence; absence in the ledger alone never certifies production.
Legitimate HTTP errors, deliberate safety refusals, and user cancellation remain visible.
For these classes the repair assertion is absence of repeated, misattributed or undiagnosed
behaviour, not absence of the external outcome. Do not game the assertion by reclassifying
every failure as expected. Fixtures prove a renamed unexpected defect still fails.

FID-024 lands the shared class model and recurrence probe before any lane relies on them.
FID-021 consumes those helpers and wires coverage/drafting later; no duplicate probe per child.
Dependency readiness means a committed implementation with deterministic gates passing.
It does not require the prerequisite's 14-day production observation to have finished.
Keep the prerequisite open during observation and continue the next ready implementation.
Class lanes close after both deterministic gates and the exposure-qualified assertion pass.
Artifact children close on their own artifact gates and committed evidence. FID-024 closes
the instrument only after its seven classes have been deeply investigated and the resulting
findings remain owned; silence does not establish that any underlying cause was fixed. FID-021 closes the machinery on its
negative-control gates. The master closes last, after all children and registered program
items have evidence-backed completion or an explicit operator ruling ending their obligation.

### Decisions by record

| FID suffix | Resolved question and governing design |
|---|---|
| 010 | Boot digest budget is 24,000 JavaScript characters, below the existing 100,000 cap; fail on overflow rather than drop a boot rule. Local digest derives from classified rules; embedded digest selects only explicitly public rules. Update prompt, mechanical grounding requirements, fallback bundle aliases, generation and drift checks together. Full-file reads remain mandatory before edits; the title index is navigation, not a Law 1 exemption. Telemetry records counts only. |
| 011 | Keep the 1,200 logical-line and 100,000-character limits in one shared policy consumed by validation and retirement. UTF-8 bytes are a separate statistic. `--cap` changes a retirement invocation, not the gate's policy. A character-only breach must offer a repair that actually addresses characters. Move records append only after a verified destination write; interruption/retry cannot lose an entry or duplicate its receipt. Retirement remains operator-run. |
| 012 | Build one in-memory locator across live and retired entries. Identical duplicate titles in the archive may resolve deterministically with all locations retained; conflicting duplicate bodies fail ambiguity. Follow supersession with cycle detection and an explicit replacement notice. Historical reference resolution never makes an entry eligible for boot or skill promotion. FID-011 owns writing move receipts; this record consumes them. |
| 013 | Keep all three legacy lessons and their active status; migrate them to governed entries with `Scope: internal` after investigating their evidence. Separate structural evidence from reproduction references. Validate an `as-of` commit and its blob before warning about live drift. Never execute arbitrary prose commands. Recover both missing probes into committed reproduction artifacts. Repair guidance recommending scripts against the current no-scripted-edit law, preserving the incident account. |
| 014 | Investigate each rule's authority, invariant, guard and validation before assigning a tier; unknown applicability remains unresolved. Public promotion requires explicit public scope and privacy validation. Preserve the four existing public rules. Classify every catalogue rule and reconcile the three legacy-only rule names. Replace the self-matching skill eligibility heuristic with an evidence-backed class-to-rule link; no unrelated failure earns a candidate merely because a lesson title resembles its own rule. |
| 015 | Ownership is now this record; the empty-queue/no-owner wording describes an old snapshot. Add a standalone pipeline probe to the repository gate after the locator is green. Never declare the recursively executing repository validator as a FID probe. Render the report deterministically on red as well as green; writing a red report still exits nonzero. Report freshness covers both live and retired sources plus the manifest. Draft candidates remain drafts until separately approved. |
| 016 | Supersession preserves incident bodies and cannot promise to shrink the ledger. Measure digest reduction separately from ledger growth. Family membership is provisional: the list repeats members and cites a FID lesson outside the governed ledger. Require a unique title-to-invariant inventory; merge only identical invariants, retaining distinct caller-proof, breaker and hand-off rules. Present the concrete consolidation for the operator's level-1 ruling. Consumers use the 012 locator. |
| 017 | Eighteen tool names comprise 193 records; the nine-tool claim lists only the largest subset. Lifetime counts do not prove post-fix recurrence. Preserve schema-error recovery; known truncation already selects split advice in `sdk/src/impl/llm/errors.ts:138`. Use model output allowance plus bounded serialized arguments, rejecting partial execution. Bulk writes stage bounded chunks with revision/hash guards and commit once; failure leaves the target untouched. Existing bounded replacements/read windows remain available. |
| 018 | Cover all 11 owned shapes, including 405, 503, PDF refusal, DNS and SSRF. Keep SSRF checks at every redirect. URL cache identity removes only the fragment: preserve path trailing slashes, queries and signed/tracking parameters. Cache 404 per run, use bounded TTL/retry hints for transient outcomes, and never persist credentials. No automatic network retry or invented search result. Report unknown extraction cause when the response does not prove one. |
| 019 | Existing code-search anomaly and spawn errors already fail loudly; investigate the producer/host boundary instead of replacing them. Web search attempts keyless sources before reporting exhaustion, so missing BYOK is not proof it never ran. Preflight checks local availability without a network call, never gates unused tools, and refreshes when configuration changes. Preserve producer errors and route a typed completed-empty/unavailable/incomplete result through every consumer. All six allocated classes, including invalid flags/types, remain owned here. |
| 020 | Mismatch/no-op emissions are located at `process-str-replace.ts:254` and `:133`. CRLF and whitespace rescue already exist; preserve them. Distinguish successful identical edits from failed/partial replacements. The current handler supplies latest content, not a previous-read snapshot; stale is unknown without a revision receipt. Bound candidate scans and excerpts, enforce containment/redaction, never log file bodies. Cover all 13 path/patch/edit classes and their client/server boundaries. |
| 021 | Promotion uses the existing 14-day, three-occurrence, three-distinct-session rule, excluding proven expected outcomes. Own every eligible unexpected class, not just top N. Use the 024 manifest/probe; auto-draft idempotently but never auto-approve an item reserved to the operator. The owner gate may land once ownership exists, independently of the owners' observation windows. Test replay uses an isolated copy, never appends to production JSONL. |
| 022 | Preserve all 24 registered items and all 14 children. Class, artifact and machinery closures have different evidence. Chains share schema, prompt and validator files: use sequential implementation, not a disjoint-surface assumption. Apply the revised B dependencies below. Preserve every operator hold, including consolidation; this review does not activate implementation or authorize publication. |
| 023 | Alias delegation is real: `run-readonly-command.ts:78` calls the terminal tool; `client-tool-bridge.ts:39` names the delegate on abort. Preserve caller and executed tool. Investigate cancellation outcome and termination separately. Session init stays at 10 seconds; synchronous default stays at 30 seconds. The schema supports only SYNC and explicitly permits -1, so an assumed background fallback or unreviewed 600-second cap is not valid. Add finite-budget validation and actionable advice without silently withdrawing existing long-running calls. Never automatically replay a command. |
| 024 | Seven wrapper classes span seven tools, not six. A generic wrapper means unknown cause, not proof of a shared cause or a successful fix. Stable cause metadata is optional for compatibility; historical rows keep unknown attribution. All seven remain unresolved until deeply investigated. Implement the class registry, horizon and shared probe first; never backdate a fix boundary to justify closure. |

### Revised order and prospective artifacts

Chain A: 024 (instrument/probe) → 023 → 017 → 018 → 019 → 020 → 021 (routing/gate).
Observation windows continue while subsequent deterministic implementations proceed.
Chain B: B0 011/014 → B1 012/010 → B2 013 → B3 016 → B4 015.
013 depends on 011/012/014; 016 on 010/012/013/014; 015 on 012/014/016.
Chain C and its operator holds remain as registered. No provider probes are required for this planning pass.

These are exact planned artifacts, not existing tests or passing gate declarations:

| Owner | Tests/probes to extend or create before implementation verification |
|---|---|
| 010 | `scripts/__tests__/learnings-boot-digest.test.ts`; `common/src/util/__tests__/boot-contract.test.ts`; `scripts/learnings-boot-check.ts` |
| 011 | `scripts/learnings.test.ts`; `scripts/__tests__/learnings-retire.test.ts`; `scripts/learnings-size-check.ts` |
| 012 | `scripts/__tests__/learnings-locator.test.ts`; `scripts/__tests__/lesson-feature-pipeline.test.ts` |
| 013 | `scripts/__tests__/learnings-reproduction.test.ts`; `scripts/learnings.test.ts` |
| 014 | `scripts/__tests__/learnings-rule-tiers.test.ts`; `scripts/learnings-projection-check.ts` |
| 015 | `scripts/__tests__/lesson-feature-pipeline.test.ts`; `scripts/lesson-feature-check.ts` |
| 016 | `scripts/__tests__/learnings-consolidation.test.ts`; `scripts/learnings-consolidation-check.ts` |
| 017 | `sdk/src/__tests__/tool-argument-budget.test.ts`; `packages/agent-runtime/src/tools/handlers/tool/__tests__/chunked-write.test.ts` |
| 018 | `sdk/src/__tests__/read-url.test.ts`; `sdk/src/__tests__/read-url-ssrf.test.ts`; `sdk/src/__tests__/read-url-outcomes.test.ts` |
| 019 | `sdk/src/__tests__/code-search-fail-loud.test.ts`; `sdk/src/__tests__/ripgrep-path-fallback.test.ts`; `packages/agent-runtime/src/llm-api/__tests__/capability-outcomes.test.ts` |
| 020 | `packages/agent-runtime/src/__tests__/process-str-replace.test.ts`; `packages/agent-runtime/src/__tests__/edit-diagnostics.test.ts` |
| 021 | `scripts/__tests__/experiences-coverage.test.ts`; `scripts/experiences-coverage.ts` |
| 022 | Census/allocation reconciliation and all children's committed gate/observation evidence |
| 023 | `sdk/src/__tests__/run-terminal-command.test.ts`; `packages/agent-runtime/src/tools/tool-executor/__tests__/abort-attribution.test.ts` |
| 024 | `scripts/__tests__/experiences-class-horizon.test.ts`; `packages/agent-runtime/src/hooks/__tests__/experience-capture.test.ts`; `scripts/experiences-recurrence.ts` |

Each implemented child declares its exact test paths as bare `- gate: test` bullets, affected
workspace typechecks, independent probes and `quality`, then obtains a live receipt.
New helpers require production caller evidence. Planned artifacts are never credited as passing.
Full root typecheck, applicable workspace suites, lint, Markdown lint and format checks remain
implementation requirements. The known failing Savant-Free integration stays an active T122
blocker; no merge/release certification may disregard it.

## AUDIT — tool output

### Deep investigation after the operator correction

All 37 live lessons were read in full. The original wrapper-fix record and its normalization
follow-up were inspected against today's detector, extractor, lifecycle, producers and tests.
The generic wrapper is a capture format, not an underlying failure cause. Its replacement
cannot be credited as fixing the failures it previously concealed.

| Former wrapper tool | Old records | Later differently worded failures after 2026-09-09 | Current production finding |
|---|---|---|---|
| `code_search` | 5 | 26 | Spawn and anomaly errors still exist; classifier → close payload → executor is wired. A loud anomaly is not a repaired search. |
| `read_url` | 8 | 208 | HTTP, extraction, size and safety outcomes return flat errors. Two identical injected 404 calls make two fetch attempts. |
| `run_readonly_command` | 3 | 32 | Delegates to terminal runner. Nested result errors are invisible to the failure predicate. |
| `run_terminal_command` | 2 | 11 | Nonzero exits are detected for command verification, but not for failure-capture event selection. |
| `skill_manage` | 3 | 0 | Failed operations now return `stderr` plus `exitCode: 1`; the shape predicate does not capture them as failures. Silence here is a blind spot, not resolution. |
| `str_replace` | 14 | 84 | Mismatch and no-op still use errors; SDK patch application adds another failure boundary. Existing CRLF rescue does not prove all edit failures repaired. |
| `write_file` | 1 | 26 | Server processing and client patch/write can fail separately. Neither a renamed line nor the current wrapper helper repairs these mechanisms. |

Counts are tool-level exposure to other recorded failures, not proof that a particular old
instance recurred: the original 36 first lines lost their causes. Those 36 records span
23 sessions. Each old class remains unresolved, with current producer probes and missing
original-error evidence named in FID-024. Do not demote or close it because its old spelling stopped.

Direct probes imported the shipped helpers and used injected fetch/filesystem functions:

```text
case                         shapeFailure commandFailure captureEvent
flat error                   true         true           PostToolUseFailure
terminal exit 1               false        true           PostToolUse
batch nested errorMessage     false        false          PostToolUse
batch nested exit 1           false        true           PostToolUse

actual SDK missing-file result: returned=1 contentIsString=true hasError=false
actual SDK oversized read: returnedChars=100171 truncationMarker=true hasError=false
same URL twice: injected fetch requests=2
HTTP 401/403/405/429/503: hasError=true keys=[url,errorMessage]

isExpectedFailure('parser invariant failed at line 404') = true
isExpectedFailure('No readable text found at URL') = true
findCandidates: candidates=18 distinctLessons=1
all 18 point to library-complete-needs-a-named-consumer
live lessons=37 retired lessons=37 duplicate retired titles=0
both reproduction paths named at LEARNINGS.md:453 and :648: absent
root bun run typecheck: exit 0
additional lifecycle/extractor/skill-handler suites: 18 pass / 0 fail
```

The read failure returned by `getFiles` is a status string, and
`getFileReadingUpdates` treats every string as content. `runSuccessLifecycle` records read
completion by path/content shape. A marker can therefore be visible while the mechanical
grounding claim is still false. FID-010 must pin full-read completion, not merely rename the prompt.

Capture proof: `result-lifecycle.ts:263` selects events with `hasToolResultError`, while
`:193` uses the broader `hasCommandFailure` for command verification. The checker skips array
values (`tool-result-errors.ts:13`) and only examines three flat error fields. Skill output
uses command-shaped failure at `skill-manage.ts:64`. The old mirror test proves detector and
extractor agree; it does not prove either recognizes all real producer failure shapes.
FID-024 owns the producer-shaped capture census and its correction, including nested results,
exit-code failures, read-status failures and native stream classification transport.

Eligibility proof: `lessons-to-skills.ts:146` compares rule tokens with a string that includes
the candidate lesson's own title. The first canonical rule matches itself, and every eligible
recurrence acquires that unrelated lesson. FID-014 owns evidence-backed class/rule linking;
FID-021 consumes the same authority. Existing draft skills are not trusted or mutated here.

Catalogue reconciliation also changes the original count: 32 rules exist, but only eight
are referenced by ledger rules; 24 are unreferenced. The 11 lesson references include three
legacy-only rule names absent from the catalogue. FID-014 owns reconciling those names, not
quietly treating the three active legacy lessons as historical or unneeded guidance.

Edit probes reproduce `Attempted to assign to readonly property.` when the real
`handleStrReplace` receives a frozen successful client result. The handler appends messages
by mutating `value.message`; FID-020 must return a copied result. A valid identical replacement
returns the error `No change to the file`; a genuinely absent target returns no candidate line.
The frozen-result reproduction establishes one mechanism for the recorded class, not the
cause of every historical instance. SDK `change-file.ts` is a second patch-failure boundary
and logs attempted content on failure; FID-020 owns redacted diagnostics across both boundaries.

Truncation proof: the SDK already carries output budgets from runtime `maxOutputTokens`;
its structured-only `maxTokens` mapping is a different API. No missing streaming mapper is
claimed. The defect is the absence of per-tool payload constraints and legal recovery shapes,
plus `constants.ts` steering that assumes all rejected calls were oversized and tells spawned
agents to rely on shared history. The Recorder's explicit no-history contract contradicts that
advice. FID-017 must cover every provider family and child context policy, including malformed
JSON that is not proven to have been truncated. Native stream capture currently drops cause
metadata (`stream-parser.ts:203`), so the old error line cannot establish the truncation cause.

Timeout proof: the SDK dispatcher chooses `process_type: 'SYNC'` and its schema permits only
SYNC, while `timeout_seconds` explicitly permits -1. Nine observed budgets do not establish
that the same command was retried through nine steps: hashed inputs and first-line errors do
not expose that sequence. FID-023 treats that ladder as an unproved hypothesis, preserves
long-running calls, validates nonfinite values and negative semantics, and verifies actual
termination before recording timeout/cancellation as safely handled.

No actual original wrapper payload, real provider session, or new observation window was
recovered by these probes. Those limits remain explicit. Unit tests and read-only reproductions
support planning findings; they never authorize claiming all underlying causes fixed.

```text
bun run learnings:check
learnings: PASS (34 structured entries; 3 narrative entries below boundary — unvalidated by design)
exit 0

bun run lessons:features --check
lesson-features: FAIL (37 lessons, 6 candidates)
7 Missing lesson issues: LF-001, LF-003, LF-005, LF-006
exit 1 — reproduced; owned by 012/015

bun run validate:repository
Provider docs counts match the registry; no unevidenced fact drift.
validation: PASS
exit 0

bun run fid:verify --check
15 converged records reported outside {fixed, verified}
fid:verify --check PASS — all active fixed/verified FIDs carry valid receipts
exit 0 — does not certify any of these plans or implementations

scripts workspace: dedup, distinct sessions, retirement, feature admission
45 pass / 0 fail / 143 expect() calls / 4 files

agent-runtime workspace: string replacement, experience capture
23 pass / 0 fail / 64 expect() calls / 2 files

SDK workspace: fail-loud search, ripgrep fallback, URL extraction, SSRF
40 pass / 0 fail / 110 expect() calls / 4 files
```

These 126 tests prove existing baseline behaviour, including the code contradicting old
planning premises. They do not prove the proposed repairs. Live capture completeness,
post-fix exposure, host-provider truncation causes and the future observation windows are
`NEEDS-REVIEW` until implementation and real runs supply the evidence.

## ADVERSARIAL — self-corrections and convergence

1. Could changing the message make recurrence disappear? Yes; retain the historical-to-stable
   mapping and assert on cause/ownership, not on rendered wording alone.
2. Can an old class be called dormant or fixed from silence? No; investigate its mechanism,
   claimed fix and exercised production paths first. Missing recent records prove neither.
3. Can an upstream 404, cancellation or safety refusal prevent every child closing forever?
   Yes under the old plan; preserve legitimate outcomes and assert against the owned defect.
4. Is a green validator evidence the proposals are sound? No; converged records are outside
   live receipt enforcement. The reproduced seven pipeline failures prove this boundary.
5. Are the chains independent? No at the file level; schema, validator, hooks and prompt
   surfaces overlap. Sequencing and shared authorities replace concurrent edit assumptions.
6. Does supersession shrink an append-preserved ledger? No; only the selected digest shrinks.
   Measure the two artifacts separately and preserve all incident history.
7. Could a public digest export internal guidance? Yes; explicit public promotion and the
   existing privacy gate must precede bundle generation.
8. Is caller/delegate disagreement necessarily misattribution? No; preserve both identities,
   retaining the outer caller as owner so existing ownership and tool permissions do not drift.

Final planning review covers all 15 records, each with Loop 2 corrections and the shared contract;
the coverage probe reports 15/15 and repository validation confirms the revised dependency graph.
No source code is changed, no FID is closed, and no observation receipt is fabricated.
Implementation starts with 024 after the operator begins work. Consolidation, external
inputs, credentials, skill trust, release and pushes retain their recorded operator boundaries.
