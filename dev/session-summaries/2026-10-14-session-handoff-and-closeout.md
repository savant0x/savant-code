# Session handoff and closeout — 2026-10-14 (guard authority · attribution · archival blocker)

**Status:** closed clean at the operator's instruction. **Authority:** `dev/echo-v0.1.2-single-agent.md`
(read 0–EOF at intake), `SCOPE.md`, `protocol.config.yaml`, the active FIDs. **Nothing pushed, no release,
no credentials touched.** Local path-scoped commits only.

This is the handoff of record for the session that ran the read-only-guard audit, the attribution-guard
enforcement, the closure attempt and the two `FID-2026-1014-*` closures. It supersedes
`2026-10-14-session-handoff.md` (the earlier pass today) for the next intake; that file still describes
the state at `4cb1f28b` and stays as the history of its own segment.

## What landed this session

Range `e29e6ddf..152fe04a` (6 commits; every one is inside the write surface its FID registered in `SCOPE.md`):

- `1fd828b9` — **read-only guard, both directions.** A 56-command corpus of legitimate read-only
  commands (49 declared read-only, 7 true negatives) measured the guard for the first time:
  `allowed=44 rejected=12` — **5 false positives** (`2>/dev/null` in three spellings, `< file` in two)
  while EHEL already treats `/dev/null` as a non-mutation target (`echo/enforcement/helpers.ts:144`).
  After the fix: `allowed=49 rejected=7`, **0 false positives**. Same commit found that archived
  `FID-2026-0919-010` (SEC-3) claims `DONE` steps and a 4/4 receipt for a suite the tree never had —
  `cat .env > /tmp/exfil.txt 2>&1` and friends were accepted at HEAD — and restored the span-scoped
  redirect scan, with the record's acceptance matrix as `run-readonly-redirect-waiver.test.ts`.
- `2aa5bab4` — widened the finding to what was measured: the guard is a **denylist, not a boundary**
  (`bun -e "…"`, `bun x <pkg>`, `deno eval`, `find . -delete`, `kill -9 1` all allowed).
- `346ecaff`, `77d3be67` — **no agent may be attributed** (`FID-2026-1014-003`): one rule
  (`scripts/attribution-guard.ts`), three layers (commit-msg hook, pre-push range scan, CI workflow),
  fail-closed `2` on any unusable input. Running it found and fixed two real defects: it flagged *prose*
  that quotes the watermark, and the emoji branch was inert without the `u` flag
  (`🤖 Generated with Codebuff` passed silently). Whole-history `--all` scan: exit 0.
- `9a73cce3` — closed and archived `FID-2026-1014-001` and `FID-2026-1014-003` with their registry,
  index, archive-index and CHANGELOG coverage, after re-running their declared gates.
- `152fe04a` — **Q25** recorded in `dev/operator-decisions.md` with the refusing gate's verbatim output.

Detail: `2026-10-14-refusal-authority-and-guard-audit.md` (same directory) carries the per-task evidence.

## What did NOT land — the archival blocker (read this first)

Directed to properly archive the implemented lanes, I closed `-017`, `-018`, `-019`, `-020` (all four
implemented, declared gates green, receipts stamped), moved them into `dev/fids/archive/`, and updated the
master board, the index, the register and the CHANGELOG. **The repository refused the closure:**

```text
$ bun scripts/experiences-recurrence.ts          # a declared gate of FID-2026-1012-021
closed owner has unproved class: v1:read_url:http-404:undetermined
closed owner has unproved class: v1:code_search:search-incomplete:undetermined
… 25 lines, every class owned by the four records
PROBE_EXIT:1   →  validate:repository FAIL: 021 gate "probe …" failed (exit 1)
```

The invariant is already mechanised: **a `closed` lane may not own an unproved class.** I reverted my own
attempt rather than weaken the probe to make it pass, and re-verified the reverted tree
(`validate:repository` PASS · `experiences-recurrence.ts` exit 0 · `lint:md` 0 · queue back to 11).
What is left is a governance decision, not missing work: **Q25** offers (a) keep the invariant,
(b) *recommended* — add `dev/experiences/closure-waivers.json` so a lane may close with its unproved
classes **named and dated**, silent closure still failing, or (c) close them and drop the probe from
`-021`'s gates (retires the check that just caught this — not recommended).

## Active queue at close — 11 records, each with its real closure condition

| FID | Status | What actually blocks closure |
|---|---|---|
| `-2026-1012-017` | fixed | implementation + green gates + receipt; class observation unmet (4 of 19 classes measured still recurring) |
| `-2026-1012-018` | fixed | same — recurrence window not started, so no class claim |
| `-2026-1012-019` | fixed | same; plus the original host-resolver cause |
| `-2026-1012-020` | fixed | same; plus lost historical production causes |
| `-2026-1012-021` | verified | **its own text conflicts with itself** — limitations say step 3 unimplemented, Loop 4 says it landed |
| `-2026-1012-022` | converged | master; closes last, after every child and a clean allocation re-run |
| `-2026-1012-023` | fixed | "the abort path is not yet located in this pass" — a concrete open item |
| `-2026-1012-024` | converged | class repairs remain open, not just observation |
| `-2026-1012-026` | converged | all eleven provider-parity implementation steps pending; not started |
| `-2026-1013-005` | analyzed | blocked on the operator's Cloudflare account ID + API token |
| `-2026-1014-002` | analyzed | blocked on the Q24 triage ruling (33-record artifact census, untriaged) |

Per-record next actions are also indexed in `dev/fids/README.md`; the master's status board is the
authoritative allocation (`### Status board` in `FID-2026-1012-022`).

## Live traps a fresh session would otherwise re-discover

1. **A `closed` lane may not own an unproved class** (`scripts/experiences-recurrence.ts`, enforced via
   `-021`'s gate and `validate:repository`). Closing a lane is a *measured* act, not an edit.
2. **A closed FID is a claim, not an artifact.** `FID-2026-0919-010` shipped `DONE` steps and a 4/4
   receipt for a suite that did not exist; the census now watches for it (`-1014-002`). Trust `file:line`
   and a re-run, never a receipt alone.
3. **No agent may be attributed.** The commit-msg hook rejects `Generated with …` / `Co-Authored-By:`
   coding-agent watermarks and advertises no bypass; the pre-push range scan and CI reject them again.
   Commits this session carry no trailer and `--no-verify` was never used.
4. **Two files sit one line from the 300-line ceiling** — `scripts/validate-repository.ts` and
   `scripts/fid-verify.ts`. Further wiring in either needs a split first.
5. **The coverage mapping is a lower bound.** `FID-2026-1012-027` joins declared gates to the record's
   `SCOPE.md` surface, but it never proves a declaration is the *strongest* gate.
6. **Another lane's work is live in the tree and must not be staged wholesale:** modified idea-shelf
   notes, `dev/wiki/index.md` + `dev/wiki/patterns/*`, the SDK Windows process fixture and
   `run-terminal-command.test.ts`; untracked `art/profile-pic.jpg`, `docs/design/provider-parity-review-2026-10-12.md`,
   `scripts/providers/audit-probes/parity-*.ts`, `docs/trash/`, and the two untracked session notes.
   `dev/experiences/raw-traces.jsonl` is live capture and stays unstaged by design.
7. **The guard's false-positive corpus is operator-visible, not automated.** Rebuild it if you change the
   read-only predicate; the class of failure it catches (legitimate command refused) is invisible to tests
   that only assert refusals.

## What stops for the operator

- **Q25** (this session's blocker), **Q23** (harness refusal authority — the seven-site inventory and the
  under-breadth holes), **Q24** (census disposition/gate). All three are blank in
  `dev/operator-decisions.md` §H and its appendix.
- Release cut of `0.0.36`; `T122` (savant-free removal); `T186` (blocked on `T122`); `T175`'s six external
  inputs; `T171`'s verdict/consent ruling; `T173`'s vendor window values; `T187`'s `/skills trust` grant;
  `T62-followups` credits.
- **Branch protection remains unset, so the CI attribution layer has never executed** — no push has
  happened, so the workflow is written but unproven on a runner. That limitation is honest and open.
- Session-end review's standing queues: quarantined skill drafts (`/skills list --quarantined`) and the
  telemetry proposal. No skill was authored, trusted or released this session.

## Verification at close

Re-run **after** the reverted closure and **after** this record was written, each with its exit status
captured directly (no pipe masking):

| Check | Result | Log |
|---|---|---|
| `bun run lint:md` | **exit 0** | `dev/scratchpad/active/2026-10-14-closeout-lint-md.log` |
| `bun run validate:repository` | **PASS** | `dev/scratchpad/active/2026-10-14-closeout-validate-repo.log` |
| `bun scripts/experiences-recurrence.ts` | **exit 0** (25 unproved classes owned by four still-active lanes — expected, not an error) | `…-closeout-probe.log` |
| `bun run fid:verify --check` | **PASS** | `…-closeout-fid-verify.log` |
| `bun run session-end:review` | **exit 0** — 3 agenda items, no tracked agenda delta, 4 quarantined skill drafts reported | `…-guard-authority-session-end-review.log` |

Earlier in the session: `bun run typecheck` (scripts + touched workspaces), the agent-runtime tool suites
(644/0 across `handlers`, `tool-executor`, `echo`), `scripts/__tests__/attribution-guard.test.ts` 7/0,
`run-readonly-redirect-waiver.test.ts` 4/0, the whole-history `--all` attribution scan (exit 0), eslint and
prettier. Conservatively stated limitations: the **full root `bun run test` chain and root typecheck chain
were not re-run** this session (only the affected workspace legs); no live TUI or WebView smoke; the CI
attribution workflow has never executed on a runner; and nothing was pushed or released.
