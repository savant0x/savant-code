# Worktree junction recovery

Single-agent ECHO, strict mode, autonomy 3. User reports the project is broken.
At intake HEAD is `3d24daf9`, two documentation-only commits beyond the last
push. Preserve those commits, the acceptance report and the untracked blueprint.

Startup reproduction: missing `@ai-sdk/openai`. Frozen-lockfile install restored
35 packages and CLI help exits 0. A disposable real-git Windows fixture proves
`git worktree remove --force` traverses a junction and deletes main dependency
sentinel contents. FID-2026-1017-009 converges on detaching links before recursive
removal, refusing cleanup on detachment error, with real target-survival tests.
No dependency versions, credentials or operator files are changed.

Four real/failure-injection regressions failed against the original code and
pass after detachment was added. Combined provision/disposal suites: 19 pass,
0 fail. All six FID gates pass, including real-git/SQLite probe and quality.
Root typecheck (14 workspaces and scripts), SDK build and targeted ESLint pass.
Manual caller audit confirms disposal, pre-record rollback and crash debris
all detach actual links before git removal or the fallback. Missing records
do not weaken protection; detachment failure retains the lane and record.

Repository Markdown lint exposed the pre-existing lane-proof paragraph's
354-character line. Wrapped without changing words and committed separately
as `01763f17` (FID-008). The acceptance report's graph-refresh and transient
unsafe-root findings remain recorded under FID-008; this repair claims neither.

Implementation committed at `ab021ebf`; FID-2026-1017-009 is closed and archived
with its stamped six-gate receipt and CHANGELOG entry. Its scope targets are
released. Mandatory full push gates run before delivery; evidence is retained
in `2026-10-17-junction-recovery-push.log` beside this record. No live TUI or
paid model call was used; CLI help verifies startup, not interactive behavior.
