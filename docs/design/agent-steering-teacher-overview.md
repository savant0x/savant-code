<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Agent-Steering Teacher — Overview

The Agent-Steering Teacher is Savant-Code's local-first mode for practicing how
to **direct and review an AI coding agent**. It does not teach syntax, and it
never asks a model to grade itself. You supply steering constraints, watch a
real Forge agent produce a solution, run that solution through a sandbox, and
then critique a deliberately injected flaw. The system records your progress as
a versioned, ZTAP-signed competency record — locally, with an honest claim
boundary.

This is the **canonical overview** of the implemented feature. It ties together
the product surface, the command reference, the module map, the trust model, the
progression model, and the verification status. Companion documents:

- [`agent-steering-teacher-guide.md`](agent-steering-teacher-guide.md) — how to use and author exercises
- [`Agent-Steering Teacher Homegrown Architecture.md`](../archive/design/Agent-Steering Teacher Homegrown Architecture.md) — authoritative design (archived)
- `dev/build-orders/2026-08-13-agent-steering-teacher-build-order.md` — build order and phase gates
- `dev/fids/archive/FID-2026-0813-011`…`020` — the FID set (closed and archived)

## 1. What it is

- **A local exercise loop**, not a course platform. One challenge at a time, in
  the CLI, in your project — but never executing code in your project.
- **Agent-output literacy** — the curriculum measures behavioral invariants,
  edge-case reasoning, evidence requests, and flaw detection, not prompt length
  or model eloquence.
- **Bounded claims** — a completed exercise means "this attempt met this
  versioned rubric." It does not prove universal programming mastery, learner
  identity, or independent LLM judgment.

### Target learner

V1 targets developers, technical leads, reviewers, and operators who can read
basic JavaScript and understand tests, errors, and edge cases. A beginner track
is a later curriculum decision, not an implicit promise.

## 2. The exercise loop

One exercise runs this loop headlessly (the engine owns the lifecycle); the CLI surfaces it as chat events plus a live, read-only sidebar panel:

```text
learner steering (constraints)
  → live Forge implementation (read-only, tool-less agent)
  → deterministic sandbox result (restricted node:vm subprocess)
  → equivalence review (behavior-first, hidden tests)
  → detection review (one seeded mutation from a versioned catalog)
  → learner critique (identify the flaw + evidence)
  → adjudication (bounded by the mutation contract)
  → versioned local competency record (ZTAP-signed)
```

You are graded on two things: whether your steering produced a correct solution
and whether your critique identified a real injected flaw.

## 3. Command reference

| Command | Purpose |
| --- | --- |
| `/learn` | Overview, lifecycle, and command help |
| `/learn start <steering>` | Run a live exercise: steering → Forge → sandbox → graders |
| `/learn critique "<statement>" [--location <t>] [--witness <t>] [--impact <t>]` | Submit your review of the seeded defect |
| `/learn progress` | Show the local, versioned competency record |
| `/learn cancel` | Abort the attempt (cleanup, no credit) |
| `/learn exit` | Leave the teacher and restore prior chat unchanged |

Lifecycle events stream into the chat (`steering_submitted → forge_running →
sandbox_running → equivalence_review → detection_review → learner_critique →
adjudication → result`). The result prints equivalence, detection, the ZTAP
receipt line, and the progression status. `/learn progress` prints per-skill
state, attempt/evidence counts, the latest attempt's outcome and receipt status,
and the corpus/sandbox/grader/mutation version metadata.

While an exercise is active, a read-only **Teacher** panel appears in the right
sidebar (below `Session`, above the Perfection Loop) showing the public
challenge fields, the color-coded phase, the bounded event log, the completion
state, the ZTAP receipt line, and the progression/competency status. The panel
is observational only — no focusable or selectable elements and no write/spawn/
filesystem/tool authority — and it never renders private-pack material. It
appears only while an exercise is active: `/learn exit` clears it, `/learn
cancel` keeps it visible with a `CANCELLED` state.

## 4. Module map

| Module | Location | Responsibility |
| --- | --- | --- |
| Contracts | `common/src/teacher/` | Shared types, zod schemas, trust-boundary parsers, privacy policy |
| Sandbox | `packages/agent-runtime/src/teacher/sandbox/` | Isolated execution boundary with an honest capability report |
| Exercise engine | `packages/agent-runtime/src/teacher/exercise/` | Headless lifecycle FSM, cancellation/retry/timeout/cleanup, evidence hashing |
| Corpus | `packages/agent-runtime/src/teacher/corpus/` | Build-time authoring, pack builder, validation pipeline |
| Mutation | `packages/agent-runtime/src/teacher/mutation.ts` | Deterministic mutation catalog + injector |
| Graders | `packages/agent-runtime/src/teacher/grading/` | Equivalence (behavior-first) + detection (mutation contracts) |
| Progression | `packages/agent-runtime/src/teacher/progression/` | Versioned SQLite store + honest ZTAP adapter |
| Seed corpus | `cli/src/teacher/seed.ts` | Bundled, validated `ChallengeSource` |
| Live Forge | `cli/src/teacher/forge.ts` | Read-only, tool-less `teacher-forge` agent + `ForgeFn` + output extractor |
| Session manager | `cli/src/teacher/runtime.ts` | Start/critique/cancel/exit + ephemeral key + persistence |
| Progress read | `cli/src/teacher/progress.ts` | Pure read of the versioned competency record |
| Command | `cli/src/commands/learn.ts` | `/learn` routing |
| Render helpers | `cli/src/commands/learn-progress.ts`, `learn-result.ts` | Pure line rendering (progress + result) |
| Shared render | `cli/src/teacher/render.ts` | `completionLabel`/`receiptLine`/`progressionLine` (shared by result + overlay) |
| Overlay | `cli/src/components/savant-ui/teacher/` | Read-only OpenTUI surface |
| Store slice | `cli/src/state/chat-store/` | `teacherState` passive mirror of the runtime singleton |
| Sidebar mount | `cli/src/components/right-sidebar.tsx` | Conditional read-only `Teacher` section |

## 5. Trust model

The feature uses explicit trust domains, not one shared corpus database:

- **Public pack** — objective, prompt, guidance, public limits. Reachable by the
  learner and Forge through a narrow API.
- **Private pack** — known-good source, hidden tests, mutation contracts. Never
  reaches the learner, Forge, UI, or ordinary chat.
- **Sandbox** — untrusted code runs in a restricted `node:vm` context inside a
  stripped subprocess. A worker thread is never treated as a security boundary.
  OS-boundary dimensions the backend cannot prove are honestly marked
  `not_enforced`, and any policy requiring an unproven dimension fails closed to
  `unavailable` (no execution, no credit).
- **Progression store** — append-only result API storing hashes and version
  metadata, never source, prompts, or raw critique text.

The live `teacher-forge` agent is read-only (`toolNames: []`, no spawn), so an
exercise can never write to your project. If no authenticated SDK client is
available, the exercise surfaces `unavailable` rather than producing a partial
result.

## 6. Grading

- **Equivalence** is behavior-first: hidden behavioral tests are the oracle.
  Source inspection is a diagnostic signal only — a valid alternate algorithm
  passes, while test-specific hardcoding is flagged.
- **Detection** injects one deterministic mutation per attempt. Your critique
  must identify the flaw's behavior plus location/witness/impact evidence.
  Adjudication is bounded by the mutation contract, never a free-text LLM
  verdict.

## 7. Progression and ZTAP

A terminal attempt (`passed`/`failed`) is persisted to a project-scoped local
SQLite store (`<config>/projects/<project>/teacher-progression.sqlite`). The
skill's competency edge advances (`completed` on a pass, `attempted` otherwise,
never downgraded); `cancelled` and `unavailable` award no progression.

Every completed attempt emits a self-contained ZTAP receipt
(`savant.teacher.attempt-receipt.v1`) that signs the four redacted evidence
hashes (submission, sandbox result, equivalence, detection) with an ephemeral,
memory-only teacher session key. The receipt carries the public key, the `over`
hash, the signature, and the signed evidence, so a third party can re-verify it
without the session seed. If no key is available the record is honestly marked
`local-unverified`.

**Claim boundary:** the receipt proves mechanical process integrity, not LLM
independence or learner identity. A single attempt is an attempt record, not a
mastery claim.

## 8. Authoring challenges

Authoring is a build-time, approval-gated pipeline — generated content is never
self-authorizing:

1. Write a `ChallengeSource` manifest (public fields + private known-good source,
   hidden tests, mutation contracts, critique rubric).
2. Validate: known-good repeatability (20 runs), each mutation's witness, and a
   private-answer isolation scan.
3. `buildPack` splits it into a content-addressed `PublicChallenge` and
   `PrivateChallengePack`.

A challenge ships only after operator approval and independent validation. See
the guide for the full workflow.

## 9. Honest boundaries and non-goals

- ZTAP receipts evidence process integrity, not independence or identity.
- No teacher content, code, critique, test, or progression event is sent to
  telemetry or any network service.
- An unavailable sandbox or failed calibration disables progression rather than
  hiding it.

V1 excludes freeCodeCamp extraction, Python/DOM/browser challenges, arbitrary
repository execution, cloud sync, accounts, teacher-content telemetry, ensemble
grading, and adaptive profiling. Each is a separate decision gate.

## 10. Verification status

- **Focused teacher tests:** 100 pass / 0 fail (common 5, agent-runtime 65,
  cli 30), including the sandbox escape suite, engine lifecycle, corpus
  isolation, grader calibration, overlay zero-authority, progression, and the
  cross-cutting integration/security audit.
- **Full suites:** common 612 pass / 0 fail; agent-runtime 891 pass / 0 fail.
- **Gates:** typecheck ×4, `validate:repository`, ESLint zero warnings,
  Prettier, and `lint:md` all green; fid-ledger 5/5.
- **Independent audit:** Nova returned **PASS** on the initial scope
  (`dev/nova/inbox/2026-08-13-fid-2026-0813-011-teacher-implementation-audit-response.md`);
  a final-approval request over the complete scope (live wiring, ZTAP receipt,
  progression persistence, `/learn progress`) is staged in
  `dev/nova/outbox/`.
- **FID status:** `FID-2026-0813-011`–`021` are closed and archived. The live
  sidebar surface (`FID-2026-0813-022`) is also closed and archived after Nova
  planning + implementation audits both returned **PASS** and the operator
  approved closure (2026-08-13). Focused sidebar-surface evidence: 38 CLI
  teacher tests pass / 0 fail across 5 files; typecheck ×4, ESLint,
  `validate:repository`, `lint:md`, and Prettier all green.
