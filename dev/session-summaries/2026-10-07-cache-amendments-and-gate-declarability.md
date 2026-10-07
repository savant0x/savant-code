# Cache amendments landed, the gate workstream registered, three records closed

**Date:** 2026-10-07
**Automation level:** 3 (operator ruling, verbatim: "approve, grant automation level 3")
**Register items touched:** T155 (steps 3 and 9 landed; steps 8, 10 and 11 open),
T156 and T157 (closed and archived), T158 (registered — it was found unregistered)

This pass began from the operator's ruling, which cleared the two approval points
the register was waiting on — the mode-to-TTL spend policy (Hybrid `5m` /
FID-bound `1h`) and the report's two proposed ECHO amendments — and supplied the G2
commit authority the three `fixed` records needed. From that point the work was
execution rather than permission: land what is landable, register what is unowned,
close what is closable, and state plainly what is not.

## What was done

**Local commits (no push, no release):**

1. `0620e143` — `feat(scripts): make every repository gate declarable and
   independently runnable (FID-2026-1007-003)`. 27 files: the shared probe body,
   sixteen thin gate probes, the declarability guard and its audited table, the
   injected-budget guard and its own probe, both wired into
   `scripts/validate-repository.ts`, the new FID, and the register update.
2. `70cec07c` — `feat(protocol): land the two operator-approved ECHO cache
   amendments (FID-2026-1006-005)`. `ECHO.md`, the regenerated embedded bundle, and
   the record's step-3 audit and step-9 landing.
3. The closure commit that carries this summary (see Closure below).

**T155 step 9 — the amendments are law.** Both proposals in the research report now
exist as subsections of `ECHO.md`, each dated and FID-stamped:
`#### Law 1 Amendment — Spill-File Authorization` (in the Laws 1-4 section) and
`#### Tool-Array Serialization is Deterministic` (in Separation of Duties). The
first authorizes offloading a bulk system output to a local spill file behind an
explicit marker and bounds the authorization to the reading it names — the marker
substitutes for the payload only, the spill file is itself read 0-EOF once it is
acted on rather than cited, and every other file still requires Law 1 — and it
names the append-only fail-open mechanism that already ships rather than inventing
one. The second writes down what Phase 1 actually built: one canonical form at one
seam behind `CANONICAL_TOOL_PAYLOAD`, which is why mid-session tool restriction must
happen by activation/deactivation rather than by rebuilding the registry array.

`ECHO.md` is one of the five grounding files, so the amendment only reaches a
harness session if the bundle is regenerated — which is why the commit carries
`common/src/constants/protocol-bundle.generated.ts` rather than the document alone.
The generator's own assertions ran and passed: `validateCondensedCopies` still
anchors every condensed line to its `ECHO.md` source, and the harness-boundary sweep
still finds zero references to the single-agent document.

**T155 step 3 — the Phase-2 coverage audit, measured rather than read.** Every
destructive-truncation path was enumerated and each was probed with the shipped
functions (`dev/scratchpad/active/step3-truncation-audit.ts`, gitignored). The
outcome is a finding, not the parity the report assumed:

| path | what the model receives | locator? |
| --- | --- | --- |
| string over the byte cap (60,000 chars) | a 500-char quoted preview | none — `fullOutput` is a fixed placeholder naming two *possibilities* |
| array over the byte cap (3,000 items) | 2,000 `keptItems`, 27,000 chars omitted | none |
| `simplifyReadFileResults` | `{ path, contentOmittedForLength: true }` | none — no count, no pointer |
| `simplifyTerminalCommandResults` | `stdoutOmittedForLength: true`, 5 most recent kept whole | none |
| Layer 4 reactive compact | middle band beyond the first 10% dropped | none — first message, last 20%, images, preserved-state and refresh preserved |

Every model-facing destructive path drops the payload and names no location, in
three different marker vocabularies. The one place the raw bytes actually survive —
the per-run evidence spill at `.savant/evidence/<runId>.jsonl`, bounded at 512 KiB
per record and 8 MiB per file, fail-open, spliced back only for
`requiresRawEvidence` agents — is unreachable from all of them. That gap is recorded
as the record's new **step 11** with its invariants ("a marker must never claim a
location the caller cannot compute"; "a record above either spill cap must say so
rather than silently returning `false`") and explicitly forbids a second spill
mechanism. The record was then re-stamped: **7/7 declared gates green**.

**T158 — an unregistered workstream, registered.** The working tree held a complete,
green, unowned workstream: `scripts/probe-runner.ts`, sixteen `*-check.ts` gate
probes, `scripts/gate-declarability.ts` + its audited table, the injected-budget
guard and its probe, and the `validate-repository.ts` wiring. The defect was not in
the code — it was that nothing owned it. It is now `SCOPE.md` item T158 and
`FID-2026-1007-003`, committed path-scoped with its record as `0620e143`, and
**closed and archived** in this pass. No code changed to accommodate the record.

## Defects found and fixed during verification

1. **The two ECHO amendments were not merely absent — the document that proposes
   them is the only place they existed.** Landing them required the bundle
   regeneration, and the bundle is what a harness session actually reads: a
   document-only "fix" would have been invisible where it mattered.
2. **`validate:repository` was red for three unrelated reasons at intake**, and
   each was a real closure gap rather than noise: the T155 record declared a gate
   its stale receipt did not carry, and both newly archived records had no CHANGELOG
   entry (the `changelog.coverage` rule, which is the mechanical form of "an archived
   record needs a release note").
3. **A stale documentation reference in shipped code.**
   `scripts/probe-runner.ts`'s header says "`scripts/probe-runner.test.ts` pins the
   contract" — that file does not exist. The contract is pinned by
   `scripts/__tests__/gate-declarability.test.ts` (which runs a declaration through
   the real executor). Recorded here rather than silently corrected: the header text
   is inside the committed file and a one-line doc fix would have to ride a commit
   whose subject is something else.
4. **A measured inconsistency left as pinned.** For object-shaped payloads the
   truncation marker reports `reason: 'output exceeded 50000 bytes'` alongside
   `omittedChars: 0`, because that branch keeps every field by design — pinned by
   `simplify-tool-results-truncation.test.ts` ("The original object keys are
   preserved alongside the marker"). It reads as a contradiction but is truthful
   about the input; it was recorded, not rewritten inside an audit step, and a
   reviewer who disagrees with the pin has the test to argue with.
5. **The learnings validator caught this pass's own drift twice.** Two
   `dev/LEARNINGS.md` evidence targets were written against re-export sites
   (`scripts/validation-manifest.ts` re-exports what `scripts/validation-gates.ts`
   declares) and one used a `function:` kind that does not exist; `learnings:check`
   failed both and named them. The lesson about verifying evidence was itself
   verified by the gate that consumes it.

## Verification evidence

Run on the final tree, each as a plain command with its exit status read:

```text
bun run validate:repository                      PASS
bun run learnings:check                          PASS (38 structured entries)
bun run scripts/lint-md-check.ts                 PASS
bun run generate:protocol-bundle:check           exit 0
bun run scripts/protocol-bundle-check.ts         PASS
bun run scripts/scripts-typecheck-check.ts       PASS
bun x prettier --check ECHO.md                   exit 0
bun test scripts/__tests__/gate-declarability.test.ts \
         scripts/__tests__/audit-test-budget-injection.test.ts
                                                 19 pass / 0 fail
bun run fid:verify ...FID-2026-1006-005 --write  7/7 gates green
bun run fid:verify ...FID-2026-1007-003 --write  5/5 gates green
```

## Recorded deviations and forks

1. **T155 is NOT closed, and the plan to close it was wrong.** Three of its ten
   steps cannot be completed in this environment: step 8 (evaluate the Anthropic
   `tool_addition`/`tool_removal` beta) needs a captured wire body from a live
   endpoint, step 10 (the `>75%` hit-ratio measurement) needs live traffic and
   provider billing, and step 11 is the locator gap step 3 opened. Closing the
   record would have laundered three open steps into an archive. It stays `fixed`
   and active with all three blockers named, and the register line says so.
2. **`T158` was registered after its code was written.** The honest statement of
   that is the record itself: its Missed Questions ask "was this workstream
   registered before it was written?" and answer no. The alternative — pretending a
   retro-record followed the loop — would have been the more expensive lie.
3. **Two commits, not one.** `0620e143` (scripts + record + register) and `70cec07c`
   (protocol document + bundle + record) are separate coherent changes, per G3;
   sweeping the ECHO amendments into the scripts commit would have hidden a
   protocol change inside a tooling change.
4. **Nothing was pushed.** G1 permits granular local commits to `main`; push,
   release and tag mutations remain outside this session's authority, and the
   pre-push credential scan and hook battery have not been exercised against these
   two commits.
5. **The full root `bun test` chain and the sdk/desktop/evals/database/
   knowledge-graph/connectors/code-map suites were NOT re-run in this pass.**
   Stated as limits, not as passes. What WAS run on the final tree: the root
   `typecheck` chain across 13 workspaces plus the scripts leg (exit 0), `eslint .
   --max-warnings 0` (exit 0 — see the post-summary note), `lint:md`,
   `quality:report`, `generate:protocol-bundle:check`, `fid:verify --check`, and the
   `common` (813 / 0), `cli` (3962 / 0) and `packages/agent-runtime` (1873 / 0)
   suites.
6. **Post-summary note (commits landed after this summary was written).** The two
   items this summary listed as unowned were committed in the same pass:
   `1f9084a5` injects the reconcile budget in
   `packages/agent-runtime/src/echo/__tests__/worktree-reconcile.test.ts` — the
   first application of the injected-budget guard, which is why it carries
   FID-2026-1007-003 — and `0838799e` lands the idea-shelf note as housekeeping.
   `5689b523` then cleared the four `import/order` warnings the repo-wide eslint
   gate rejected in files this session touched (three files, `eslint --fix`, no
   suppressions); the gate is exit 0 after it, and `common` / `cli` were re-run
   green rather than assumed unchanged. Still untracked and left that way on
   purpose: `docs/design/Savant_ECHO Cache Optimization Research.md` (the record's
   Missed Question 7 states the position), `docs/archive/reports/echo-astra-review-2026-10-06.md`
   and `website/index-2.html` — parked third-party inputs this pass did not author
   and whose disposition is an operator call rather than a housekeeping commit.

## Closure

All four records for this pass are accounted for in `dev/fids/archive/`:

| record | status | commit |
| --- | --- | --- |
| `FID-2026-1007-001` (breaker leak + three behaviour corrections) | closed + archived | `228156da` |
| `FID-2026-1007-002` (module-state isolation) | closed + archived | `5299af25` |
| `FID-2026-1007-003` (gate declarability + probe runner) | closed + archived | `0620e143` |
| `FID-2026-1006-005` (prompt-cache program) | **`fixed`, still active** | steps 3/4/7/9 landed; 8/10/11 open |

`CHANGELOG.md` carries one entry per closed record under `Unreleased — 2026-10-04`;
`dev/LEARNINGS.md` gained a lesson for the gate-declarability class and one for the
marker-versus-locator defect; `dev/fids/README.md` now reads **One** active FID and
lists the three closed records; `dev/fids/archive/README.md` gained a
`## 2026-10-07 closure` section covering all three.

## Continuation note

Three untracked inputs are left in the tree, none of them ours to dispose of:

- `docs/archive/reports/echo-astra-review-2026-10-06.md` — a parked third-party
  review of `ECHO.md`, sitting in the archive-report location that already carries
  a markdownlint exemption.
- `website/index-2.html` — a 92 KB stray copy of the public site page with no
  inbound reference found.
- `docs/design/Savant_ECHO Cache Optimization Research.md` — deliberately
  untracked; the record's Missed Question 7 states the position and the
  `.markdownlintignore` entry says how to re-evaluate it if that changes.

**Next:** T155 step 11 (the locator gap, whose invariants are already specified),
then step 8 and step 10 once a live endpoint and provider billing exist. T119, the
T62 follow-ups and T122 remain blocked on operator keys or an operator decision.
