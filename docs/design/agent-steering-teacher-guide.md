<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Agent-Steering Teacher — Guide

The Agent-Steering Teacher is a local-first way to practice directing and
reviewing an AI coding agent. It does **not** teach syntax, and it never asks an
AI to judge itself. You supply constraints, observe the generated output, check
mechanical evidence, and review deliberately flawed output.

This guide explains how the system works, how to use it, and how to author new
exercises. The authoritative design lives in
[`Agent-Steering Teacher Homegrown Architecture.md`](../archive/design/Agent-Steering Teacher Homegrown Architecture.md) (archived);
the complete overview lives in
[`agent-steering-teacher-overview.md`](agent-steering-teacher-overview.md);
the build order and FID set live under `dev/build-orders/` and `dev/fids/`.

## 1. The exercise loop

One exercise runs this loop headless; the CLI surfaces it as chat events plus a live, read-only sidebar panel:

```text
learner steering (constraints)
  → Forge implementation in an isolated workspace
  → deterministic sandbox result
  → learner evidence-based judgment (critique of a controlled flaw)
  → bounded adjudication
  → versioned local competency event
```

You are graded on whether your constraints produce a correct solution and
whether your critique identifies a real injected flaw — **not** on prompt
length, model eloquence, or whether the model happened to succeed.

## 2. Modules

| Module | Location | Responsibility |
| --- | --- | --- |
| Contracts | `common/src/teacher/` | Shared types, zod schemas, trust-boundary parsers, privacy policy |
| Sandbox | `packages/agent-runtime/src/teacher/sandbox/` | Isolated execution boundary with an honest capability report |
| Exercise engine | `packages/agent-runtime/src/teacher/exercise/` | Headless lifecycle FSM, cancellation/retry/timeout/cleanup |
| Corpus | `packages/agent-runtime/src/teacher/corpus/` | Build-time authoring, pack builder, validation pipeline |
| Graders | `packages/agent-runtime/src/teacher/grading/` | Equivalence (behavior-first) + detection (mutation contracts) |
| Overlay | `cli/src/components/savant-ui/teacher/` | Read-only OpenTUI surface (`/learn`) |
| Command runtime | `cli/src/teacher/` | Live `/learn` bridge: seed corpus, teacher-forge agent + `ForgeFn`, exercise session manager |
| Progression | `packages/agent-runtime/src/teacher/progression/` | Versioned SQLite store + honest ZTAP adapter |

### Sandbox (security boundary)

Untrusted exercise code runs in a **restricted `node:vm` context inside a
stripped subprocess**. A worker thread alone is never treated as a security
boundary. The backend publishes a capability report: the dimensions it can
prove are marked `enforced`; the OS-boundary dimensions it cannot prove are
honestly marked `not_enforced`. Any challenge whose policy requires an
unproven dimension **fails closed to `unavailable`** — no execution, no credit.
The escape suite proves filesystem, network, environment, process, and
`Function`-constructor escapes are contained, that output is capped, and that
temporary workspaces are cleaned up on every exit path.

### Trust domains

- **Public pack** — objective, prompt, guidance, public limits. Reachable by the
  learner and Forge through a narrow API.
- **Private pack** — known-good source, hidden tests, mutation contracts. Never
  reaches the learner, Forge, UI, or ordinary chat.
- **Exercise workspace** — generated submission + test inputs, only through the
  sandbox API.
- **Progression store** — append-only result API; stores hashes, never source,
  prompts, or raw critique text.

### Grading

- **Equivalence** is behavior-first: hidden behavioral tests are the oracle.
  Source inspection is a diagnostic signal only — a valid alternate algorithm
  always passes, while test-specific hardcoding is flagged.
- **Detection** injects one deterministic mutation per attempt from a versioned
  catalog. Your critique must identify the flaw's behavior plus location,
  witness, or impact evidence. Adjudication is bounded by the mutation contract,
  never a free-text LLM verdict.

### Progression and ZTAP

Progression records "this attempt met this versioned rubric" — never identity or
universal mastery. A single attempt is an attempt record; stronger competency
claims require held-out transfer. Every completed attempt emits a ZTAP receipt
(`savant.teacher.attempt-receipt.v1`) that signs the four redacted evidence
hashes (submission, sandbox result, equivalence, detection) through the existing
signing primitives (no duplicate crypto). The receipt is self-contained — role,
public key, `over` hash, signature, and the signed evidence — so a third party
can re-verify it without the ephemeral session seed. If no session key is
available the record is honestly marked `local-unverified`.

A live exercise signs each attempt with an **ephemeral, memory-only teacher
session key** derived fresh per session (HKDF over a never-persisted seed). The
`/learn` result prints the receipt: `ZTAP receipt: signed by teacher over
sha256:…`, or `local-unverified` when no key is available.

On a terminal attempt (`passed`/`failed`) the record plus its signed receipt are
persisted to a project-scoped local SQLite store
(`<config>/projects/<project>/teacher-progression.sqlite`) and the skill's
competency edge advances — `completed` on a pass, `attempted` otherwise, never
downgraded. `cancelled` and `unavailable` award no progression and are not
recorded. The `/learn` result prints `Progression: recorded (competency …)` or
`Progression: not recorded`.

## 3. Using `/learn`

- `/learn` — overview, lifecycle, and commands.
- `/learn start <steering>` — run a **live** exercise: the steering constraint is
  handed to the live Forge agent (a read-only, tool-less agent that returns only
  a solution function), the solution runs in the sandbox, and the
  equivalence/detection graders review it. Lifecycle events stream to the chat.
- `/learn critique "<statement>" [--location <text>] [--witness <text>] [--impact <text>]`
  — submit your review of the seeded defect; a passing critique names an
  acceptable concept and covers the required evidence.
- `/learn progress` — show your local, versioned competency record: per-skill
  state, attempt/evidence counts, the latest attempt's outcome and receipt
  status, and the corpus/sandbox/grader/mutation version metadata.
- `/learn cancel` — abort the attempt; cleanup runs and no credit is awarded.
- `/learn exit` — leave the teacher and restore your prior chat unchanged.

The surface renders only rubric-safe events; the private pack never reaches
the learner, the Forge prompt, or the UI. The live Forge agent has no file,
terminal, or spawn tools, so an exercise can never write to your project.
Exiting never mutates your repository or chat state.

### Live sidebar panel

While an exercise is active, a read-only **Teacher** panel appears in the right
sidebar (below the `Session` section, above the Perfection Loop). It shows the
public challenge fields (objective, prompt, visible guidance), the color-coded
phase, the bounded event log (last 20 events), the completion state, the ZTAP
receipt line, and the progression/competency status.

The panel is observational only: no buttons, inputs, focusable elements, or
selectable text, and it never renders private-pack material (known-good source,
hidden tests, mutation contracts, or raw critique). All interaction stays in the
chat via `/learn`. The panel appears only while an exercise is active —
`/learn exit` clears it, while `/learn cancel` keeps it visible with a
`CANCELLED` state. The panel is a passive consumer of the session state; it has
no write, spawn, filesystem, or tool authority.

## 4. Authoring a challenge

Authoring is a **build-time, approval-gated** pipeline — generated content is
never self-authorizing.

1. Write a source manifest (`ChallengeSource`): public fields plus the private
   known-good source, hidden tests, mutation contracts, and critique rubric.
2. Run validation: known-good repeatability (20 runs), each mutation's witness
   (the mutated source must actually fail), and a private-answer isolation scan
   over the public prose.
3. `buildPack` splits the source into a content-addressed `PublicChallenge` and
   `PrivateChallengePack` with stable `sha256` hashes.

A challenge ships only after operator approval and independent validation.

## 5. Honest boundaries

- ZTAP receipts prove mechanical process integrity, not LLM independence or
  learner identity.
- Local progression records are `local-unverified` unless signed; a signed
  record remains relative to an ephemeral, memory-only teacher session key that
  is never persisted or logged.
- No teacher content, code, critique, test, or progression event is sent to
  telemetry or any network service.
- An unavailable sandbox or failed calibration disables progression rather than
  being hidden.

## 6. Non-goals (V1)

No freeCodeCamp extraction, Python/DOM/browser challenges, arbitrary repository
execution, cloud sync, accounts, teacher-content telemetry, ensemble grading,
or adaptive profiling. Each is a separate decision gate.
