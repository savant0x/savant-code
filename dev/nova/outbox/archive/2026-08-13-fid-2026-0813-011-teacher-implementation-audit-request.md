# Nova Implementation Audit Request — Agent-Steering Teacher (Complete Scope)

**Date:** 2026-08-13 (updated — supersedes the initial request)
**Status:** AWAITING NOVA REVIEW — COMPLETE SCOPE IMPLEMENTED, LOCAL GATES GREEN; FINAL APPROVAL REQUESTED
**Master FID:** `FID-2026-0813-011`
**Children:** `FID-2026-0813-012` through `FID-2026-0813-020` (all `closed`, archived 2026-08-13)
**Build order:** `dev/build-orders/2026-08-13-agent-steering-teacher-build-order.md`
**Architecture:** `docs/design/Agent-Steering Teacher Homegrown Architecture.md`
**Guide:** `docs/design/agent-steering-teacher-guide.md`

## Audit boundary

The complete homegrown Agent-Steering Teacher has been implemented end to end
under the converged master FID, including the follow-up work added **after** the
initial implementation audit:

1. live `/learn` wiring (Forge + sandbox + graders in the CLI),
2. a per-attempt signed ZTAP receipt,
3. persistence of completed attempts to the local progression store, and
4. the `/learn progress` read-only competency record.

This updated request supersedes the initial request and seeks a **final
independent implementation audit** over the complete scope above. It does
**not** authorize commit, push, release, publication, deployment, or closure —
those remain separate operator gates.

Please return a per-target `PASS`, `FAIL`, or `NEEDS-REVIEW` with `path:line`
evidence, and pay particular attention to the trust-domain and claim-boundary
questions below.

## Implemented modules

| FID | Module | Notes |
| --- | --- | --- |
| 012 | `common/src/teacher/` | Contracts, zod, `./teacher` export, trust-boundary parsers |
| 013 | `packages/agent-runtime/src/teacher/sandbox/` | Restricted `node:vm` in a stripped subprocess; honest capability report; fail-closed `unavailable` |
| 014 | `packages/agent-runtime/src/teacher/exercise/` | Headless FSM, cancellation/retry/timeout/cleanup, evidence hashing |
| 015 | `packages/agent-runtime/src/teacher/corpus/` | Source manifest, pack builder, validation pipeline |
| 016 | `packages/agent-runtime/src/teacher/grading/equivalence.ts` | Behavior-first + hardcoding heuristic |
| 017 | `packages/agent-runtime/src/teacher/grading/detection.ts` | Mutation injector, structured critique grading, calibration |
| 018 | `cli/src/commands/learn.ts`, `cli/src/components/savant-ui/teacher/` | Live `/learn` command + read-only overlay |
| 019 | `packages/agent-runtime/src/teacher/progression/` | Versioned SQLite store + honest ZTAP adapter |
| 020 | `packages/agent-runtime/src/teacher/__tests__/integration-audit.test.ts` | Cross-cutting integration + call-graph scans |
| live | `cli/src/teacher/{seed,forge,runtime}.ts` | Bundled validated seed corpus; read-only, tool-less `teacher-forge` agent + `ForgeFn`; DI-seamed session manager driving Forge → sandbox → graders |
| receipt | `common/src/teacher/progression.ts`, `agent-runtime/…/progression/record.ts` | Self-contained `savant.teacher.attempt-receipt.v1` over the four redacted evidence hashes |
| persistence | `agent-runtime/…/progression/record.ts` (`deriveCompetencyEdge`), `cli/src/teacher/runtime.ts` (`persistAttempt`) | Completed attempts persisted as versioned competency records |
| progress | `cli/src/teacher/progress.ts`, `cli/src/commands/learn-progress.ts`, `cli/src/commands/learn-result.ts` | Read-only `/learn progress` competency record + extracted render helpers |

## Local verification evidence

- Focused teacher tests — **100 pass / 0 fail** (common 5, agent-runtime 65,
  cli 30: overlay 8, learn 10, runtime 12) plus the integration audit suite.
- Full suites — common **612** pass / 0 fail (4 skip); agent-runtime **891**
  pass / 0 fail.
- Typecheck ×4 — PASS (`sdk`, `common`, `packages/agent-runtime`, `cli`).
- `bun run validate:repository` — PASS.
- ESLint — zero warnings. Prettier — clean. `lint:md` — clean.
  `scripts/fid-ledger.test.ts` — 5/5.
- Sandbox escape suite — zero observed escapes across containment fixtures
  (require/process/fetch/`Function`-constructor), deterministic pass/fail/
  timeout, output cap, cancellation, cleanup.
- Live runtime — the `cli/src/teacher/runtime.test.ts` suite drives the full
  Forge → sandbox → graders lifecycle through the real subprocess sandbox (only
  the LLM forge is stubbed) and re-verifies the signed receipt independently.

## Hard questions Nova should challenge

1. Is the `node:vm`-in-a-subprocess boundary honestly reported? The capability
   report marks OS-boundary dimensions `not_enforced` and fails closed to
   `unavailable`; confirm no policy can silently run code past an unproven
   dimension.
2. Does the private answer pack (known-good source, hidden tests, mutation
   contracts) remain unreachable by Forge, the learner, the overlay, and
   ordinary chat through paths, imports, errors, stdout, or shared state?
3. Is the `/learn` surface genuinely zero-authority? The overlay has no
   action handlers/tool/terminal/dynamic-import path, and the `teacher-forge`
   agent is tool-less (`toolNames: []`); confirm no callback or live-Forge path
   reintroduces write/terminal/spawn control, and that absent SDK auth fails
   closed to `unavailable` rather than running a partial exercise.
4. Does the progression store persist only hashes and version metadata — never
   raw source, prompt, or critique text — and is the ZTAP claim boundary
   (`ztap-signed` vs `local-unverified`) honest (never silently upgraded)?
5. Are the equivalence anti-cheat and detection calibration thresholds
   implemented as signals bounded by the contracts, never as a sole LLM oracle?
6. Is the per-attempt receipt self-contained and independently verifiable
   (public key + JCS-canonical evidence + signature), and does `deriveCompetencyEdge`
   never over-claim mastery (a single attempt is an attempt record, not mastery)?
7. Is `/learn progress` genuinely read-only — it opens, reads, and closes the
   store and never mutates progression state or disturbs an active exercise?

## Requested verdict format

```text
Overall: PASS | FAIL | NEEDS-REVIEW
FID-2026-0813-011: PASS | FAIL | NEEDS-REVIEW — evidence: path:line
FID-2026-0813-012: PASS | FAIL | NEEDS-REVIEW — evidence: path:line
...
FID-2026-0813-020: PASS | FAIL | NEEDS-REVIEW — evidence: path:line
Live /learn wiring: PASS | FAIL | NEEDS-REVIEW — evidence: path:line
ZTAP attempt receipt: PASS | FAIL | NEEDS-REVIEW — evidence: path:line
Progression persistence: PASS | FAIL | NEEDS-REVIEW — evidence: path:line
/learn progress (read-only): PASS | FAIL | NEEDS-REVIEW — evidence: path:line
Blocking findings: <none or numbered findings>
Residual non-blocking notes: <notes>
Implementation authorization: NONE
```
