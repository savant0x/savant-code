# Sidebar command console design — 2026-10-08

## Authorization and intent

Operator accepted the visual sidebar review and requested: "i agree, make the
full fid, run the perfection loop on it then present it".
Single-agent ECHO v0.1.2, strict mode. This pass creates and audits the design
document. The operator subsequently authorized implementation: "proceed w/ code."

`FID-2026-1008-006` registers T174: distinct sidebar surface, current-activity
hierarchy, session/context presentation, quieter section headers, descriptive
FID rows, informative rail, consistent keyboard/mouse states and bounded motion.
The plan includes height-aware composition, preserved cache/compaction meaning,
light-theme support, a motion opt-out and native visual verification.

## Grounding

Inspected sidebar composition, section/header/rail primitives, session formatters,
theme tokens/palette, focus controller, FID loader/list/card, phase/activity
mappings, token/progress meters, fold timeline and animation budget.
Existing tmux pane `fid-sidebar-review-20261005` was captured read-only: it is
an older running session and supplies historical layout evidence only.

New findings folded into the design: generic bar thresholds disagree with
current sidebar thresholds; mounted animation-budget hooks hold a live
renderer reference; the explicit ASCII glyph override resolves Unicode.
The FID owns their relevant corrective work and verification contracts.

## Review and verification

The FID is `converged`, with five document passes. Loop 2 corrected rail
overflow, native text nesting and unsupported attention inference. Loop 3
named the canonical session lifecycle producer and corrected the goal/drive
domain distinction. Loop 4 corrected invalid usage and a source citation.
Loop 5 re-audited scope, producers, viewport budgets, focus and motion cleanup.

Exact Levenshtein deltas over the preceding document bytes:

| Pass | Distance | Prior characters | Delta |
| --- | --- | --- | --- |
| Loop 2 | 1,365 | 23,170 | 5.89% |
| Loop 3 | 1,364 | 24,505 | 5.57% |
| Loop 4 | 415 | 25,726 | 1.61% |
| Loop 5 | 447 | 26,132 | 1.71% |

All corrective passes stayed below 10%; the last two stayed below 2%.
There were no unresolved actionable design findings at presentation.
Implementation was subsequently authorized and is recorded below.

Document evidence:

```text
scope-register PASS (0 issues)
markdownlint .: exit 0
All matched files use Prettier code style!
gate parser: 10 gates, 0 parser errors
test promise contract: 0 errors, 0 warnings
fid:verify --check: exit 0; converged documents are not receipt-enforced
```

The four new suite paths are correctly absent before implementation. Eight
suite declarations plus CLI typecheck and quality are future implementation
gates; no test execution or runtime verification is claimed for this design.

Repository validation returned exit 1:

```text
validation: FAIL (1 issue)
- [quality.ratchet] scripts/__tests__/public-release-preflight-g2-g5.test.ts:
  342 lines exceeds absolute maximum 300
```

This newer release-preflight implementation's quality finding is recorded on
its existing T164-E register item. The document-only directive does not
authorize editing that implementation. Validation also printed a sandbox
permission warning for `C:/Users/spenc/.config/git/ignore`; neither output is
reported as a clean repository gate.

Approved step accounting: full FID creation, SCOPE registration, independent
audit/self-correction, two convergence passes and presentation are completed.
That initial document pass changed the FID, SCOPE and this session summary.
The authorized implementation follows.

## Implementation — 2026-10-09

The command-console redesign is written: distinct surface/divider, height-aware
persistent summary, prominent activity/lifecycle and separate ECHO phase,
dedicated model line, truthful context/provenance, quieter headings, meaningful
counts, title/status/severity FIDs and informative keyboard-accessible rail.
Conditional Teacher/Trust/Loop/Drive information is retained.

Supporting seams extend the existing loader, focus controller, fold timeline,
glyph resolver and semantic palette. A 50-column rail peek narrows to 30 columns
to retain 20 chat columns; normal full mode is still 40. New modules are small
composition/control/display helpers. Operator documentation is
`docs/design/sidebar-command-console.md`.

### Corrections found by verification

1. Native inverse styling could make focused labels invisible. Underline plus
   readable accent/surface feedback now carries focus.
2. The sidebar's first layout needed a measurement retry; native rail expansion
   otherwise had no detail viewport until another resize.
3. The chat sidebar lacked a resize subscription. The 99/100 native pin failed
   before subscribing through `useTerminalDimensions`, then passed.
4. Permanent fold blur hooks added listeners to static sections and required a
   renderer in isolated static rendering. Optional AppContext and temporary
   listeners during active tweens fixed both. Blur settles the target state.
5. Long Trust paths and agent names now wrap; sidebar readers use readable
   existing tokens. Native full FID prose preserves paragraph spacing.
6. The responsive test was split into its own declared suite at the 300-line
   ceiling. Its mode fixture uses the actual HYBRID domain value.

### Evidence

Nine declared suites: 55 pass, zero fail. Including three existing Teacher/Trust
regression suites: 82 pass, zero fail, 352 assertions, 12 files. Native pins
exercise keyboard/mouse, input guards, responsive/manual folds, theme/height
changes, offscreen reveal and animation live-reference/listener cleanup.

`dev/scratchpad/active/sidebar-command-console-2026-10-08/` holds 36 native cell
captures with plain text, ANSI, cell metadata and raster previews. All captured
ordinary sidebar text passes 4.5:1; observed minimum is 5.38:1. Large wordmark,
dividers and meter graphics are excluded from ordinary-text measurement.
Selected raster previews and the long summary's final paragraph were inspected.
PNG previews reconstruct native cells using local fonts; operator host-font
visual acceptance is still NEEDS-REVIEW.

An isolated real tmux preview, `sidebar-console-20261009`, supplies 18 ANSI
captures: dark/light at 50x19, 60x24, 80x24, 99x28, 100x28, 120x12, 120x19,
120x24 and 160x40. All fixtures are labeled synthetic and make no LLM calls.
The preview Trust signature is presentation data, not cryptographic evidence.

Sidebar changed-file ESLint passes with zero warnings. Markdownlint, scope
registration/disposition and diff whitespace checks pass. The FID now has
11 declared gates (CLI typecheck, nine suites and quality).

### Repository gate blockers

The current shared tree has concurrent telemetry/eval/transition-phase work.
Those changes were preserved. Most recent full checks:

- CLI/root typecheck fails gateway-dispatch-containment:33,
  gateway-flush-lifecycle:20, gateway-provider-notifications:12 and
  gateway-replay:36: test fixtures omit required `loadTelemetryAggregates`.
- Quality fails `cli/src/server/gateway/handshake-rpc.ts`: 310 lines.
  The sidebar test-ceiling finding was corrected by a cohesive suite split.
- Root ESLint: zero errors, 13 warnings in telemetry-rpc,
  session-state-agent-state, eval runner/tests and transition-phase files.
  No sidebar warning remains.
- Repository validation reports that quality failure, scratchpad-root
  `passover.txt` and database-shaped foreign roots. The shared tree continued
  changing during the pass; these are recorded observations, not a clean gate.
- `fid:verify --check` passes the structural scan, but `converged` FIDs are not
  receipt-enforced. It is not a successful implementation receipt.

Implementation Steps 1-8 are present. Two final code reviews made zero production
changes after self-correction. Full FID closure remains open on repository gates,
operator terminal-font acceptance and committed evidence. No commit, merge,
push or archive was performed. CHANGELOG archival accounting follows closure.

## Operator correction — 2026-10-09

Authorized corrections: move context to the bottom, separate the top groups,
replace the Cursor-conflicting Ctrl+G shortcut, restore the centered S rail
logo and raised fold buttons, and restore centered folded navigation.
The correction brief was reviewed twice before its production edits. F6 is
the default replacement pending the optional preference response. Native
verification follows; prior results above are historical.

Final refinements center the version above context, remove the duplicate
folded status row and add a blank row below the S mark. F6 was chosen as the
replacement; no host-wide key availability is claimed.

Layout events exposed a genuine stale-measurement defect: native layout emits
`resize`, not the `resized` enum event subscribed previously. Both surfaces
now observe the actual event, retry settled measurement and clean up. Context
recovery passes through real ChatSidebar mouse fold/unfold at 20/24/40 rows,
keyboard manual folds and responsive peek. The 20-row footer budget is now
9 top + 5 bottom, leaving the tested six-row detail viewport.

Final battery: **84 pass, zero fail, 394 assertions, 12 files** (57 declared
suite tests + 27 regressions). Sidebar ESLint and Prettier pass. Gate parser:
11 gates, zero errors/warnings. `revision-bottom-context/` contains 38 fresh
native states; contrast minimum 5.38:1, zero ordinary-text failures. Final
full/folded raster previews were inspected. Fresh isolated tmux full/folded
captures and re-expanded context were inspected; fixtures make no LLM calls.

The same root blockers remain: four gateway typecheck fixtures missing
`loadTelemetryAggregates`, the 310-line handshake module, 13 concurrent root
lint warnings, scratchpad-root `passover.txt` and foreign `database.db/`.
Two final code/contract reviews made no production changes and found no new
sidebar defect. Host-font acceptance and committed closure remain open.
