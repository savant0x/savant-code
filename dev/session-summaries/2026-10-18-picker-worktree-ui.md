# Model picker and worktree UI investigation

## Intent before implementation

Operator reports a blank CLI after `/model` during three active basher agents,
then missing traffic-light output for `fid_worktree`, and authorizes continuation
with "resume". Single-agent ECHO v0.1.2 governs; strict mode and autonomy level 3.

## Initial evidence

- Clean main at abe727a7, equal to locally recorded origin/main.
- Worktree handler emits structured JSON; CLI registry has no worktree entry.
- Cached dev catalog contains 4,075 rows. Isolated native picker opens.
- Earlier read-only probes measured approximately 657 MB RSS on mount and
  1,178 MB with 30 parent updates; these do not establish a native crash.
- Existing picker/open suites: 10 pass, 0 fail.
- No fatal or root render error found in the relevant debug-log interval.
- Operator has not yet distinguished process exit from an alive blank screen.

## Planned work

FID-2026-1018-002 reuses existing structured panel chrome, testing the actual
ToolBranch route. FID-2026-1018-003 investigates native geometry and rendering
load before choosing a repair. No live inference or acceptance-run mutation is
needed. Logical verified changes will be committed and normally pushed.

## Findings and implementation

- Worktree rendering reuses McpResultComponent, which already handles loading,
  folding and empty output as well as structured JSON. A result-only alias
  would hide the tool until output arrives. The native ToolBranch test passes
  for four actions, refusal, folded, empty and narrow states: 2 suites pass,
  0 fail, 37 assertions including the existing MCP fixture.
- The original model blank screen remains unreproduced. Filtering and refresh
  with the real cache, including its duplicate route rows, remain visible.
- A matched 4,075-row synthetic native probe measured 30 unchanged parent
  updates at 1,103 MB RSS / 5,809 ms without memo versus 596 MB / 934 ms with
  memo. Those are single local whole-process measurements, not a benchmark or
  crash proof. The initial mount still allocates the full catalog.
- Native regression with three independent simulated agent-status updates
  failed before repair (300 expected name reads, 500 observed), passes after
  memo, and also proves query and refreshed catalog remain live. Existing
  keyboard, mouse and resize/open suites: 11 pass, 0 fail, 185 assertions.
- Original process outcome/repair acceptance remains LIVE-003. Operator
  clarification of exit versus alive blank screen is still pending. No paid
  inference or real agent concurrency was exercised by these fixtures.
- Root typecheck and SDK build exit 0. tmux is unavailable; no live interactive
  run is claimed. Declared FID gates and pre-push checks follow.

## Implementation closure

Worktree UI is committed at `50f5877f` (4/4 declared gates), picker render-load
repair at `dd57660c` (5/5). Both records are closed and archived, changelog
entries added and their register grants released. LIVE-003 retains the
original unconfirmed incident. Native tests ran from the CLI workspace;
markdownlint passed, and a single ESLint import-order warning was corrected
and the four changed source files rechecked with zero warnings.

Mandatory push hooks will rerun full repository typecheck, tests, lint,
format, protocol drift, credential and attribution gates. No release is cut.
