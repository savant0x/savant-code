# Session 2026-09-09 — Experience-capture error lines: FID-0909-005 closed (dead-session approval carried forward)

**Protocol:** ECHO v0.2.0 (strict) · **Operator approval:** carried from the
dead session's final directive ("Approve: implement FID-2026-0909-005 now"),
re-confirmed via ask_user this session · **Predecessor:** the dead session's
`history.md` export (2.8 MB, 28 messages) — mapped, reconciled against the
live tree, then deleted by the operator.

## Outcome

The self-improving loop's colorblind defect is fixed, audited, closed, and
archived. The active FID queue is empty; the tree is clean.

| Item | Result |
|---|---|
| FID-2026-0909-005 | `closed` + archived; receipt 4/4 PASS at the archived path |
| Code commit | `abe4d6a` — 5 files, 485 insertions |
| Governance commits | `cd3a027` (dead-session records drained) + `95f6694` (closure + archive rename, amended once for the move's delete side) |
| Full regression | agent-runtime 1358/0 across 234 files |

## What landed

- `extractToolResultError` in `tool-result-errors.ts` — mirrors the sibling
  checker exactly (same fields, same order, same non-empty semantics);
  first error part in array order, `errorMessage` > `error` > `errorCode`.
- `toolResultErrorLine` (same module) — centralizes the generic fallback
  label (Law 13 single truth); the literal no longer lives inline at the
  call site, and the fallback is pinned non-vacuously.
- `result-lifecycle.ts:247` — the soft-failure hook branch now passes the
  real first error line; the generic line survives only as shape-drift
  fallback, guarded by a detection/extraction mirror invariant over a
  22-shape corpus.

## Loop 2 record (deltas beyond the Loop-1 spec, both audited)

1. **Fallback centralizer** — the FID's literal one-line wiring pushed
   `result-lifecycle.ts` past the 300-line ceiling; the helper solved the
   ceiling and strengthened the fallback pin. Verifier: not unrequested
   abstraction — it owns the literal.
2. **Suite split** — the single declared suite reached 388 lines against
   the same ceiling; split into `tool-result-errors.test.ts` (12 tests)
   + `result-lifecycle.test.ts` (2 end-to-end pins via a real hook engine
   at a temp capture root). Split-suite gate line declared and live in
   the receipt. Baseline ratchet 23→75 (quality-report count; `wc -l`
   reads 74 — the known trailing-newline off-by-one class).

## Gates

RED leg 10/1 (the failing pin exactly the generic-line defect) → GREEN
14/0 across both suites · full agent-runtime 1358/0 · typecheck exit 0 ·
eslint `--max-warnings 0` · prettier clean · `quality:report` PASS (1467
files) · `lint:md` PASS · `validate:repository` PASS · Verifier audit
8 PASS / 1 NEEDS-REVIEW → **SHIP** (the NEEDS-REVIEW was the closure edit
itself — discharged by documenting the deltas in the FID's Loop 2).

## Boundaries carried (honest, operator-owned)

- **Live-boundary check open:** the ledger still holds exactly the 36
  legacy records — this session's own tool failures were pre-dispatch
  EHEL gate halts (`native.ts:97`), which never reach the result
  lifecycle. The next natural handler soft-failure appends the first
  real-line record; the agenda's three generic-line items are historical
  artifacts of the fixed defect and refresh naturally at the next
  session-end scan.
- The 36 legacy records stay one honest bucket (append-only contract;
  raw error text unrecoverable — `contextHash` covers tool input).

## Operational notes

- EHEL's Law-3 verify-before-write gate fired 5+ times mid-implementation
  (legitimately — reformatted-but-unverified files); each cleared by
  running the real gates through the observed channel. The gate is a
  feature, not friction.
- The archive move's **delete side** must be staged explicitly —
  explicit-path `git add` lists that name only the new archive path leave
  the original location's deletion unstaged (caught via post-commit
  status; fixed with `git add <old-path>` + `--amend` on the unpushed
  closure commit).
- The operator's `history.md` export needed a transient
  `.markdownlintignore` entry while present (machine-generated markdown,
  repo-root scan); reverted when the operator deleted the file — zero
  trace in the final tree.
- The Scribe session-end spawn stalled read-then-stop without writing
  (the documented Recorder-class stall); this summary + the agenda update
  were written directly instead.