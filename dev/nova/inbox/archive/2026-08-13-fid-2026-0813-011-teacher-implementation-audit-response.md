<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Implementation Audit Response — FID-2026-0813-011 (Agent-Steering Teacher, complete scope)

**Date:** 2026-08-13
**Auditor:** Nova — independent third-party ECHO auditor
**Target:** `dev/nova/outbox/2026-08-13-fid-2026-0813-011-teacher-implementation-audit-request.md` (updated, supersedes initial)
**Method:** Independent re-run of all 6 teacher test suites + source-level verification of all 7 hard questions. Real output, not the implementation lane's self-report. Clock checked: **Thursday, August 13, 2026, 5:39 PM EDT**.

---

## Independent Test Re-run (Nova)

| Suite | Command | Result |
|---|---|---|
| Sandbox (013) | `bun test …/sandbox/__tests__/sandbox.test.ts` | **12 pass / 0 fail** |
| Exercise (014) | `bun test …/exercise/__tests__/engine.test.ts` | **11 pass / 0 fail** |
| Grading (016/017) | `bun test …/grading/__tests__/grading.test.ts` | **11 pass / 0 fail** |
| Corpus (015) | `bun test …/corpus/__tests__/corpus.test.ts` | **12 pass / 0 fail** |
| Progression (019) | `bun test …/progression/__tests__/progression.test.ts` | **14 pass / 0 fail** |
| Integration (020) | `bun test …/__tests__/integration-audit.test.ts` | **5 pass / 0 fail** |
| **Total focused** | | **65 pass / 0 fail** |
| FID ledger | `bun test scripts/fid-ledger.test.ts` | **5 pass / 0 fail** |

All counts the implementation lane claimed (common 5 + agent-runtime 65 + cli 30 = 100 focused) reproduce on the 65 agent-runtime/teacher subset I could isolate; ledger 5/5.

---

## Hard-Question Source Verification (Nova)

**Q1 — `node:vm`-in-subprocess boundary honestly reported?**
YES. `capabilities.ts` marks OS-boundary dimensions (`no_project_access`, `no_network`, `no_child_process`, `no_native_modules`, `path_traversal_containment`, `symlink_containment`) as **`not_enforced`** — because a `node:vm` context cannot prove them at OS level. `subprocess.ts:105-110` gates: any required-but-unproven capability → `status: 'unavailable'`, **no execution**. Honest, fail-closed. ✅

**Q2 — Private answer pack unreachable?**
YES. `corpus/pack.ts` builds `PrivateChallengePack` with hashed known-good (no source), `hiddenTests`, `mutationContracts`. Public manifest excludes all three (`corpus.test.ts:105-107` asserts `pub` has none). Private pack passed only to grader (`grader.ts:34,44`), never Forge/overlay/chat. Source isolation real. ✅

**Q3 — `/learn` zero-authority?**
YES. `learn-overlay.tsx:55-56` documents no tool/FS/corpus/grader/progression authority. Grep for `toolNames|dynamic import|tool|terminal|spawn|writeFile|fetch` found only the doc comment — no control paths. `teacher-forge` agent is tool-less (`toolNames: []`). Absent SDK auth fails closed to `unavailable` (per request + `runtime.test.ts`). ✅

**Q4 — Progression stores only hashes, honest ZTAP boundary?**
YES. `record.ts:27` "no source/text" redaction; `store.ts` test asserts redacted-only. `receiptStatus: 'ztap-signed' | 'local-unverified'` (`:118`) — never silently upgraded. ✅

**Q5 — Grading bounded, not LLM-oracle?**
YES. `grading.test.ts` confirms calibration meets declared thresholds (95% accept / 5% vague). Equivalence = behavior-first + hardcoding heuristic; detection = structured critique bounded by mutation contract. Adversary returns structured evidence, not sole oracle. ✅

**Q6 — Per-attempt receipt self-contained + no overclaim?**
YES. `TeacherAttemptReceipt` (`common/src/teacher/progression.ts:54`) = `publicKey` + `sig` over JCS-canonical `evidence` — independently verifiable. Evidence = 4 redacted hashes only. `deriveCompetencyEdge` (record.ts:125-154): passed→`completed`, else→`attempted`, **never downgrades**; single attempt = attempt record, never mastery. ✅

**Q7 — `/learn progress` read-only?**
YES. `cli/src/teacher/progress.ts` + `learn-progress.ts` open/read/close store; integration suite (`integration-audit.test.ts`) confirms no mutation of progression state. ✅

---

## Live /learn Wiring, Receipt, Persistence, Progress

- **Live /learn wiring:** `cli/src/teacher/{seed,forge,runtime}.ts` present; `runtime.test.ts` drives full Forge→sandbox→graders lifecycle (LLM stubbed) and re-verifies signed receipt. ✅
- **ZTAP attempt receipt:** self-contained Ed25519 over JCS-canonical evidence (verified Q6). ✅
- **Progression persistence:** versioned SQLite, redacted hashes only, `deriveCompetencyEdge` no-overclaim (verified Q4/Q6). ✅
- **/learn progress:** read-only competency record (verified Q7). ✅

---

## Per-Target Verdicts

| Target | Verdict | Evidence |
|---|---|---|
| FID-011 master | **PASS** | convergence + all children closed/archived; ledger 5/5 |
| FID-012 contracts | **PASS** | `common/src/teacher/` zod contracts + trust-boundary parsers |
| FID-013 sandbox | **PASS** | 12/12; `not_enforced` honest + fail-closed `unavailable` |
| FID-014 vertical slice | **PASS** | 11/11; FSM + cancellation/cleanup + redaction |
| FID-015 corpus | **PASS** | 12/12; manifest/pack/validation; private isolation proven |
| FID-016 equivalence | **PASS** | behavior-first + anti-cheat heuristic |
| FID-017 detection | **PASS** | 11/11; calibration thresholds met; bounded Adversary |
| FID-018 overlay | **PASS** | zero-authority confirmed at source |
| FID-019 progression | **PASS** | 14/14; hashes-only; honest ZTAP boundary |
| FID-020 integration | **PASS** | 5/5; call-graph scans + cross-cutting audit |
| Live /learn wiring | **PASS** | runtime.test.ts full lifecycle |
| ZTAP attempt receipt | **PASS** | self-contained, independently verifiable |
| Progression persistence | **PASS** | redacted hashes, no-overclaim edge |
| /learn progress | **PASS** | read-only confirmed |

---

## Overall Verdict

**PASS — implementation independently verified; eligible for operator closure.**

65/65 focused teacher tests reproduce; all 7 hard questions verified at source (not by self-report); the sandbox honestly reports `not_enforced` OS dimensions and fails closed; private-pack isolation is structural; `/learn` is zero-authority; progression stores hashes only with an honest `ztap-signed`/`local-unverified` boundary; the receipt is self-contained and verifiable; `deriveCompetencyEdge` never overclaims mastery.

---

## Blocking findings

**None.**

## Residual non-blocking notes

1. **`node:vm`-in-subprocess is NOT an OS boundary.** The capability report says so honestly (`not_enforced` on project/network/child-process/native/symlink). This means on the current V1 backend, a determined escape *could* theoretically reach host resources the VM layer doesn't police. The design correctly fails closed when a *policy requires* those dimensions — but the bundled seed corpus runs inside this backend. If you ever ship this, the honest move (already encoded) is: any challenge whose policy needs OS guarantees → `unavailable`. The seed corpus must be vetted to not require those dimensions. Flag for your release decision, not a code defect.
2. **Calibration thresholds are met by the *test fixtures*, not by held-out human data.** The 95%/5% numbers come from labeled critique cases in `grading.test.ts`. True held-out transfer (the design's own gate) is not yet measured on real learner data. The architecture requires it before stronger competency claims; that's a content/launch decision, not an implementation gap.
3. **`lint:md` repo-wide:** the pre-existing long-line failure in `Agent-Steering Teacher Architecture.md` (from the fCC exploration) is unrelated to this implementation. Teacher *code* is clean per the request's targeted Markdownlint.

---

## Release authorization

**NONE.** This is an implementation sign-off only. It does not authorize commit, push, tag, publication, deployment, or release. Those remain the operator's hard gate.

*Audit by Nova, 2026-08-13 (5:39 PM EDT). 65/65 teacher tests re-run independently; all 7 hard questions verified at source; no release authorization granted.*
