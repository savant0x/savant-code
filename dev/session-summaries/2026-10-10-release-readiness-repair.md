# Release-readiness repair — 2026-10-10

## Intent and authority

Operator: "proceed w the work" — execute
`dev/fids/FID-2026-1010-004-release-readiness-repair.md`. Single-agent ECHO
v0.1.2, strict mode, session ceiling 3. No commit, tag, push, publish, deploy,
credential access or provider spend was performed or claimed.

## What was implemented

All eight audit findings were worked. R1–R6, A1 and A3 are implemented and
gate-verified; R7 (authorized commit), R8 (cancellation flake) and A2 (native
artifacts) stay blocked with named blockers.

**R1 — the audit's own reading was wrong, and measurement corrected it.** The
README release callout was *not* content drift: its prose already matched the
CHANGELOG. The working copy carried 1094 CRLF pairs while the committed blob
carried 0, and `.gitattributes` declares `*.md text eol=lf`, so the
byte-for-byte block comparison in `findReleaseCalloutBlock` failed text that was
already correct. The comparison now runs on the carriage-stripped form
(`withoutCarriageReturns`, `scripts/version-callouts.ts:47`), and a CRLF pin
proves both halves — identical prose under CRLF reports no drift, and the same
tree with changed prose still reports body drift. `version:check` exits 0.

Fixing it pushed `scripts/version-docs.ts` to 308 lines, over the 300-line
ceiling. The callout helpers moved to a new `scripts/version-callouts.ts`
(83 lines); grep confirmed zero external importers of the moved helpers.

**R2** — protocol bundle regenerated; `:check` exits 0.
**R3** — `cli/scripts/hud-preview-components.tsx` 339→224 lines; `PreviewSection`
and its mark table moved verbatim to
`cli/scripts/hud-preview-section.tsx`. The public types are re-exported, so
`hud-preview.tsx` and `hud-preview-marks.tsx` needed no edit and the preview
suite passes unchanged.
**R4** — the stale `cli/src/constants/savant-logo.ts` exemption and its
historical tracked-files entry were removed from `dev/quality-baseline.json`
(the file genuinely does not exist). `quality:report` exits 0.
**R5** — the failure had a producer, not just a file: `draftFor` in
`scripts/telemetry-feedback.ts` concatenated the review paragraph into one
232-column line, so a document-only fix would have regressed on the next run.
The renderer now emits the paragraph pre-wrapped and a new pin asserts every
generated line stays within 120 columns. `lint:md` exits 0 repo-wide.
**R6** — FID-2026-1010-003 could not be stamped at all: its gate block and
receipt sat inside a fenced `markdown` example, so `parseVerificationGates` saw
zero declarations and the `sha256:<machine-generated>` receipt was a placeholder
that was never written. Un-fenced, an evidence section added, and the receipt
stamped against live output (8/8). A probe gate pointing at gitignored
`dev/scratchpad` was dropped rather than faked.
**A1** — the SDK consumer projects are green: CJS and ESM import suites, both
`test:types` declaration checks, tree-sitter query and ripgrep bundling all
exit 0.
**A3** — `bun run typecheck` exit 0 across all 13 workspaces plus scripts;
`bun run validate:repository` = `validation: PASS`; `quality:report` exit 0;
`lint:md`, eslint and prettier exit 0.

## Defects discovered while repairing (all fixed this pass)

1. **Two verified FID gates were red on stale pins.** The sidebar label is
   `Phase · …` (`cli/src/components/savant-ui/echo/agent-status.tsx:93,165`,
   renamed by committed FID-2026-1008-006), but
   `right-sidebar-single-home.test.tsx` and `right-sidebar-phase-color.test.tsx`
   still asserted `ECHO · …`. The invariants (single home; per-phase color) were
   untouched — only the literal was stale. A render probe confirmed the shipped
   frame before the pins were updated; the activity-model assertion now tracks
   the fact that actually renders. FID-2026-1009-007 restamped 8/8.
2. **The shipped SDK consumer fixtures failed against their own published
   types** — both passed `apiKey`, removed from `SavantCodeClientOptions` when
   the backend surface was retired (FID-2026-0929-005, commit `06220bc6`).
   `test:types` failed `TS2353` in both; now exit 0.
3. **FID-2026-1010-005 was tracked only in the queue** (`scope.unregistered-item`)
   and lacked the required evidence heading. Registered in SCOPE.md and given an
   honest, entirely unchecked evidence section (that record is still `created`).

## R8 — measured, diagnosed, deliberately NOT fixed

The Windows terminal-tree cancellation failure is a real intermittent, not a
one-off:

```text
isolated cancellation suite, loop 1:  19 pass / 1 fail  (failure at run 14, 12481ms)
isolated cancellation suite, loop 2:   0 fail / 25 runs
full SDK suite, 5 consecutive runs:    5 pass / 0 fail
```

The failing run exceeded the suite's own 5s post-kill deadline. `killProcessGroup`
issues `taskkill /pid <shell> /t /f` with a 5s synchronous timeout and falls back
to a direct child kill on failure; Windows liveness checks inspect only the shell.
Those are **investigation leads, not a diagnosis**. Changing process-kill
behaviour on a guess is exactly what this record forbids, so no source change was
made. R8 stays blocked pending a converged, measured design.

## The tree moved during verification (open blocker)

`bun x prettier --check .` passed at audit time (retained log: "All matched
files use Prettier code style!") and fails now on four sidebar files this pass
never touched:

```text
cli/src/components/right-sidebar.tsx                        22:21:09
cli/src/components/savant-ui/echo/agent-status.tsx          22:27:03
cli/src/components/right-sidebar-format.ts                  22:43:51
cli/src/components/right-sidebar-sections.tsx               22:44:24
```

The last two landed while this repair was running, and the files now contain a
concurrent workstream's in-progress feature code (`toolDisplayName`,
`formatToolHistoryEvent`, `resolveActiveAgentDisplay`) — the FID-2026-1010-005
sidebar naming work, whose own record is still `created`. Their prettier diffs
were inspected on copies and are whitespace/indentation only.

They were deliberately **not** formatted: they are outside this record's
registered write surface and are another session's live work-in-progress, so
normalizing them would be an unapproved write into someone else's active
surface. `bun x prettier --write` on exactly those four files clears the gate.

The consequence for this record's claims is stated plainly: the green results
below describe the tree as measured, and because it was still being written
during the run they are not a frozen-candidate proof. A releasable tree must be
quiescent and attributable to one candidate.

## Remaining blockers

- **R8** — cancellation flake, cause unestablished (above).
- **R7** — the working tree is correct; closure requires an authorized commit
  (G2), then a `verify:clean` run against the committed tree.
- **A2** — native CLI build/interactive acceptance needs native runners and
  release-artifact authority; not attempted.
- **A3 remainder** — `prettier --check .` red on the four concurrent-session
  sidebar files above (whitespace-only, not repaired here by choice).
- **Tree quiescence** — another session is editing this working tree; the
  candidate must be frozen before any release verdict is meaningful.
- Remote pre-audit, live-provider budget/credentials, and the operator-owned
  Savant-free disposition (T122) remain out of agent authority.

Native release acceptance is unproven. No release-readiness claim is made; the
FID intentionally stays `analyzed` so it cannot be stamped `verified` while a
declared gate (R8) is knowingly flaky.

## Governance

FID-2026-1010-004 remains active and unarchived. T184 in SCOPE.md carries the
same evidence and blockers. Three records were restamped only after their live
gates passed. REA was not touched.
