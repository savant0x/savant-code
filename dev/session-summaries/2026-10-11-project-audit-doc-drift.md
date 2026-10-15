# Project audit — typecheck-coverage and staleness (2026-10-11)

## Intent and authority

Operator: "Lets do a project audit to ensure everything is properly updated."
The release and push mechanics belong to the operator's automation, so this pass
audited content and staleness only — it did not touch git. Single-agent ECHO
v0.1.2, strict mode, session ceiling 3. Work ran under register item **T185**
(public-release content audit, automation level 3); the two findings that cannot
be repaired inside that surface were registered as **T186** and **T187** before
the pass ended.

## Method (two independent passes)

1. **Mechanical sweep** for stale claims across Markdown and TypeScript: old
   version strings, the removed `/login` surface, deleted paths, workspace and
   agent counts, provider counts, TODO markers, and CHANGELOG section shape.
2. **The project's own content-consistency check scripts**, run with their exit
   codes captured: `icon-palette:check`, `generate:provider-docs:check`,
   `providers:parity:check`, `window-coverage:check`, `design-systems:check`,
   `learnings:check`, `skills:check`, `audit:evidence`.
3. **Authoritative re-measurement of every candidate claim** — module imports and
   git queries rather than text counting, because a text count is not evidence.

Verdict per candidate: historical records (CHANGELOG history, archived FIDs,
dated session summaries, `docs/release-notes-v0.0.x`, `docs/archive/**`) carry
old version numbers legitimately and were not rewritten.

## Findings

**F-1 — the typecheck-coverage claim was wrong on three surfaces (fixed).**
`package.json` registers **15** workspaces; the root `typecheck` and `test`
chains each carry **13** `--cwd` legs. `savant-free` (17 tracked TS/TSX files,
including `savant-free/cli/build.ts` and its e2e suites) and `scripts/tmux`
(11 tracked TS/TSX files under `tmux-viewer/`) have no leg, and neither declares
a `typecheck` script. `CONTRIBUTING.md` said "All 11 workspaces" (stale), while
`AGENTS.md` and `knowledge.md` said the chain covers "all 13 workspaces"
(imprecise — 13 is the leg count, not the workspace total).

**F-2 — the two uncovered workspaces (registered as T186, blocked).** 28 tracked
TS/TSX files are outside every typecheck gate. Adding a leg changes the
fail-closed release gate battery (`protocol.config.yaml` `type_check`/`test` plus
the root scripts) and `savant-free`'s disposition is operator-owned under T122,
so this needs a ruling and was not actioned.

**F-3 — five skills carry no `version` frontmatter (registered as T187,
blocked).** `skills:check` reports 0 errors / 35 warnings. Five are
`missing 'version' frontmatter (legacy default 0.1.0; add it on the next edit)`
for `release-workflow`, `savant-design`, `savant-design-systems`, `savant-motion`
and `startup-playbook`. `.agents/skills/**` is the operator-only release surface,
so the frontmatter belongs to the operator's next edit.

**F-4 — the audit's own first reading was wrong (recorded, no product defect).**
A crude `sed`/`grep` count of `common/src/tools/constants.ts` suggested
`toolNames` 51 / `publishedTools` 39, which would have "corrected"
`docs/agents-and-tools.md`. The authoritative module import returned
`toolNames` 59 (4 Composio, 4 connector) / `publishedTools` 38 — the document was
right and its "Last verified: 2026-10-10" claim holds. No edit was made. The same
pass found that this shell resolves `find` to Windows' `find.exe`, which had
produced a false "0 sources" count for `savant-free`; the count was redone with
`git ls-files`.

**F-5 — checked and cleared, not drift.** `docs/sdk-overview.md`'s
"Published to npm | Never" row is a historical fact whose own strategic-context
section states the publish decision is deferred, not blocked — self-consistent.
`dev/quality-baseline.json` still lists `cli/src/constants/fontawesome.ts`, which
is deleted in the working tree but present in the committed tree; the entry
becomes stale when that uncommitted deletion lands, and `quality:report` passes
today. The five FIDs archived operator-declined today carry their
`Archived-Declined` markers in the archive index, which is what the archiving
contract requires; CHANGELOG entries are required for closed records, not for
declined ones.

## Fixes applied

`CONTRIBUTING.md` (`bun run typecheck` comment: 11 → 13 typechecked
workspaces), `AGENTS.md` (both the Conventions bullet and the Validation
comment), `knowledge.md` (the typecheck-gate bullet), plus `SCOPE.md` (T185 write
target extended with `CONTRIBUTING.md`; T186 and T187 registered with their
blockers and automation levels) and `CHANGELOG.md` (this pass under a dated
section). Four files changed, 43 insertions, 9 deletions; working-copy line
endings unchanged.

## Gates run after the edits

| Gate | Result |
| --- | --- |
| `bunx prettier --check` on every edited/added Markdown file | exit 0 |
| `bun run lint:md` | exit 0 |
| `bun run scripts/scope-register-check.ts` | PASS (0 issues) |
| `bun run validate:repository` | `validation: PASS` |
| `bun run version:check` | PASS (enforced surfaces synchronized) |
| `bun test scripts/__tests__/changelog-coverage.test.ts` (from the repo root) | 31 pass / 0 fail, exit 0 |
| `bun test scripts/version-docs-drift.test.ts` | 8 pass / 0 fail, exit 0 |
| `bun run typecheck:scripts` | exit 0 |

**Invocation observation:** the changelog-coverage suite resolves the repository
root from the process cwd, so launching it from `scripts/` fails two live tests
with `ENOENT` on `scripts/CHANGELOG.md`. It must be invoked from the repository
root, which is what the row above records. The suite sits outside the root `test`
chain, so this is documented rather than repaired here; the `scripts/` tree
itself is typechecked by the chain's trailing `typecheck:scripts` leg.

## Limits and boundaries

The full `bun run typecheck` (exit 0) and `bun run test` (exit 0) runs from the
preceding pre-push audit describe the tree **before** these four documentation
edits; they are not a claim about the edited content, and the edited content is
Markdown outside every test assertion except the CHANGELOG short-form coverage
suite, which is green on the final content (31 pass / 0 fail from the repo
root) and is listed with the other post-edit gates above. No native platform, npm-publish, TUI-smoke
or live-provider acceptance is claimed, and the pushed-range credential scan was
not repeated. No git operation was performed by this pass: nothing staged,
committed, tagged or pushed.
