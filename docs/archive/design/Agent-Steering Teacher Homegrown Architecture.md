<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Agent-Steering Teacher — Homegrown Architecture

**Status:** Authoritative design — implemented, Nova-audited **PASS**, and operator-closed (FID-2026-0813-011..020 archived 2026-08-13). See [`agent-steering-teacher-overview.md`](agent-steering-teacher-overview.md) for the complete overview.
**Date:** 2026-08-13
**Supersedes:** `Agent-Steering Teacher Architecture.md` and the fCC-centered
research prompt
**Build order:** `dev/build-orders/2026-08-13-agent-steering-teacher-build-order.md`
**Scope:** Local-first Savant-Code teacher for agent-output literacy

## 1. Product definition

The Agent-Steering Teacher teaches a developer how to direct and evaluate an
AI coding agent. It does not primarily teach syntax and it does not ask an AI to
judge itself. The learner supplies constraints, observes Forge output, checks
mechanical evidence, and reviews deliberately flawed output.

The core lesson loop is:

```text
learner constraint
  → Forge implementation in an exercise workspace
  → deterministic sandbox result
  → learner evidence-based judgment
  → Adversary semantic adjudication where needed
  → versioned local competency event
```

The product's claim is deliberately bounded: it trains and records completion of
agent-steering exercises. It does not prove general programming mastery, learner
identity, or independent LLM judgment.

### Target learner

V1 targets developers, technical leads, reviewers, and operators who can read
basic JavaScript and understand tests, errors, edge cases, and simple
complexity language. A beginner track would be a later curriculum decision, not
an implicit promise of the first release.

### Learning outcomes

The curriculum measures these skills rather than prompt length or model fluency:

- stating behavioral invariants and acceptance criteria;
- requiring edge-case and error-path behavior;
- expressing scope, API, and dependency constraints;
- requesting evidence instead of trusting assertions;
- identifying correctness, security, and complexity defects;
- producing a critique with location, behavior, witness, and impact; and
- transferring those behaviors to a new challenge with different wording.

## 2. Non-negotiable boundaries

- Homegrown curriculum is the source of truth. freeCodeCamp is inspiration only.
- V1 language is JavaScript algorithmic code executed under the pinned Bun
  runtime. Python, DOM, browser, native modules, and arbitrary repository code
  are out of scope until separately approved.
- The teacher never executes code in the user's project workspace.
- Private known-good solutions, hidden tests, and mutation contracts never enter
  Forge, the learner prompt, the normal chat history, or the UI event payload.
- The UI is a display/input surface. It has no write, terminal, corpus, grading,
  or progression authority.
- No teacher prompt, code, critique, test output, or progression event is sent
  to telemetry or a network service.
- ECHO laws and the agent roster do not change. The teacher is a consumer of
  the runtime with a dedicated exercise context.
- ZTAP receipts record process evidence only. They are not proof of learner
  identity or universal skill.

## 3. Trust domains

The feature uses explicit trust domains instead of one shared corpus database.

| Domain | Contents | Reachable by Forge? |
| --- | --- | --- |
| Public challenge pack | Skill objective, prompt, learner guidance, public limits | Yes, through a narrow API |
| Exercise workspace | Generated submission and test-run inputs | Yes, only through sandbox API |
| Private answer pack | Known-good, hidden tests, mutations, flaw contracts | No |
| Sandbox supervisor | Process policy, result protocol, resource limits | No direct file access |
| Grader | Hidden tests, anti-cheat checks, mutation contracts | No learner write access |
| Progress store | Attempt result, version hashes, competency edges | Append-only result API only |
| UI overlay | Rendered events and learner input | No authority |

A tool deny rule is one defense, not the trust model. Private data must be
unreachable through filesystem paths, imports, environment variables, errors,
stdout, shared memory, or inherited process state.

## 4. Challenge contract

The authoring source is versioned, reviewable text or JSON. SQLite is a built
runtime artifact, not the authoring authority.

A challenge has two linked manifests:

```text
PublicChallenge {
  id, version, skill, objective, prompt, visibleGuidance,
  inputContract, outputContract, limits, prerequisites
}

PrivateChallengePack {
  challengeHash, knownGoodHash, hiddenTests,
  mutationContracts, critiqueRubric, gradingVersion
}
```

The public manifest never contains the known-good implementation or hidden test
source. The private pack is content-addressed and loaded only by the trusted
grader process.

### Authoring workflow

The operator owns the skill objective and acceptance contract. Agents may propose
challenge prose, solutions, tests, and mutations. An independent validation pass
must then:

1. run the known-good solution repeatedly;
2. prove expected broken variants fail;
3. run mutation testing to detect weak tests;
4. check that the challenge tests behavior rather than source shape;
5. check private-data isolation; and
6. produce a content manifest for operator approval.

No generated challenge becomes curriculum merely because an agent generated it.

## 5. Sandbox contract

The sandbox is a dedicated execution boundary, not an EHEL side effect. EHEL
may authorize the exercise run and inject the structured result into the
Verifier context, but arbitrary code execution belongs to a sandbox module with
an explicit backend interface.

```text
SandboxBackend.run({ source, tests, policy, signal })
  → SandboxResult
```

`SandboxResult` is structured IPC data, not parsed free-form stdout:

```text
SandboxResult {
  status: passed | failed | timed_out | policy_denied | unavailable,
  exitCode, testSummary, stdoutHash, stderrSummary,
  durationMs, policyVersion, runnerVersion
}
```

### Required policy

Every backend must enforce or explicitly report inability to enforce:

- execution in a fresh temporary workspace;
- no access to the project, corpus, credentials, or home directory;
- no network;
- stripped environment;
- no child-process or native-module access;
- bounded stdout/stderr and generated file size;
- timeout and resource limits;
- deterministic runtime and locale settings;
- containment against path traversal and symlink escape; and
- cancellation and cleanup on every exit path.

A worker thread alone is not accepted as a security boundary. A constrained
subprocess may be an implementation component, but its actual guarantees must
be verified on every supported platform. If the backend cannot pass its escape
suite, the teacher reports `unavailable` and does not execute the challenge.
There is no silent fallback to the user's project process.

### Security test corpus

The sandbox audit includes filesystem reads/writes, network requests, child
process attempts, environment reads, dynamic imports, native module loads,
symlink traversal, infinite loops, memory pressure, output flooding, malformed
IPC, cancellation, and repeated-run cleanup. The tests run on the supported
Windows/Bun target before any curriculum grader is trusted.

## 6. Exercise state machine

The headless exercise engine owns state; `/learn` only renders it.

```text
ready
  → steering_submitted
  → forge_running
  → sandbox_running
  → equivalence_review
  → detection_review
  → learner_critique
  → adjudication
  → passed | failed | unavailable | cancelled
```

Each attempt has an immutable `attemptId`, challenge/version hash, sandbox
policy version, grader version, and event sequence. Retries create new attempts;
results are never silently overwritten.

The exercise context is separate from ordinary chat state. It has a bounded
input, cancellation, timeout, and cleanup contract. Exiting `/learn` returns to
the prior chat without mutating the repository.

## 7. Equivalence grading

Equivalence is onboarding and correctness practice, not the whole moat.

A pass requires:

1. hidden behavioral tests pass;
2. challenge invariants and error behavior pass;
3. complexity/resource limits pass where applicable; and
4. anti-cheat checks find no prohibited test-specific shortcut.

AST inspection is a signal, not a correctness oracle. Valid alternate
implementations must pass. Anti-cheat checks combine hidden tests, mutation and
exploit fixtures, source inspection, and explicit challenge constraints.

The learner may also be required to explain the expected behavior and evidence
before receiving credit. This reduces the chance that a powerful Forge model
solved the task despite poor steering.

## 8. Detection grading

Detection uses deterministic, versioned mutation contracts. V1 injects one
known mutation per attempt from a catalog rather than asking a model to invent
random defects.

A mutation contract contains:

- mutation id and skill target;
- exact changed behavior;
- location or observable surface;
- counterexample/witness;
- expected impact;
- tests proving the mutation is real; and
- acceptable critique concepts and synonyms.

A learner critique must identify the flaw's behavior and provide a location,
witness, or impact. Deterministic extraction handles obvious evidence. The
Adversary may adjudicate natural-language equivalence, but its decision is
bounded by the mutation contract and returns structured evidence:

```text
CritiqueGrade {
  mutationId, identified, evidenceCoverage,
  locationMatch, witnessMatch, impactMatch,
  confidence, reasonCode, graderVersion
}
```Calibration uses separate development and held-out challenge sets. The V1
planning defaults are at least 100 labeled critique cases across the mutation
catalog, at least 95% acceptance of fully correct critiques, and at most 5%
acceptance of vague or unrelated critiques. The gate also measures false
rejection and transfer performance. A binary learner-facing pass/fail can remain
the V1 presentation while internal evidence retains these dimensions. These are
acceptance thresholds, not current results; failure disables progression rather
than being hidden.


## 9. `/learn` integration

`/learn` is a command-level entry point that starts or resumes an exercise. It
must not duplicate the agent runtime or grading logic.

The overlay contains:

- challenge objective and public guidance;
- steering/critique input;
- structured execution and test results;
- learner evidence and grade; and
- cancellation/retry controls.

The overlay imports only the exercise event/state API and presentation types.
Static tests must reject tool, terminal, write, corpus, grader, and dynamic
control imports. The overlay subscribes before execution begins and remains
usable when execution is unavailable or cancelled.

## 10. Progression and ZTAP

The progression store is local SQLite with versioned migrations. It stores
attempts, challenge hashes, grader/sandbox versions, result evidence hashes,
and competency edges. It does not store source content, prompts, private tests,
or raw critique text unless explicitly redacted and approved by policy.

A successful event means “this exercise attempt met this versioned rubric.” It
does not mean “the learner possesses the skill.” Transfer and repetition are
separate evidence.

When ZTAP is available, the teacher emits a process receipt containing the
attempt and policy hashes. The receipt's claim boundary remains ZTAP's existing
one: mechanical process integrity, not identity or universal competence. A
fallback local marker is labeled `local-unverified`, not cryptographic proof.

## 11. Existing repository integration

- `packages/agent-runtime/src/teacher/` owns the headless exercise state
  machine, challenge API, grader orchestration, and sandbox interface.
- A dedicated sandbox package or isolated runtime module owns execution; it does
  not modify the native repository write path.
- `common/` owns shared serializable contracts and validation types.
- `cli/src/commands/learn/` owns command routing and overlay composition.
- `cli/src/components/savant-ui/` receives presentation-only teacher components.
- `.savant/teacher/` stores generated runtime artifacts and is gitignored.
- Existing SQLite conventions and database utilities are reused where their
  trust and lifecycle contracts fit; no second general database abstraction is
  created.
- `protocol.config.yaml` receives a namespaced `teacher:` block only after the
  parser, defaults, and invalid-config behavior are specified and tested.
- ZTAP is already implemented and independently audited in this repository; the
  build order must not describe it as an active parallel run.

## 12. Honest non-goals

V1 does not include fCC extraction, Python, DOM/browser challenges, arbitrary
repository execution, cloud sync, accounts, teacher-content telemetry, public
credentials, learner identity, ensemble grading, adaptive psychological
profiling, or Savant-Free packaging. Each is a separate decision gate.

## 13. Acceptance summary

The feature is implementation-ready only when:

- known-good and broken sandbox fixtures reproduce their status/test summary for
  20 repeated runs each;
- the sandbox escape suite observes zero escapes across all fixtures and three
  repeated runs per fixture on the supported deployment target;
- a hand-authored vertical slice passes end to end;
- public/private corpus isolation is mechanically verified;
- known-good and mutation contracts are independently validated;
- equivalence fixtures include approved alternate implementations and exploit
  controls;
- detection calibration meets the declared thresholds and held-out transfer is
  reported;
- the headless exercise engine passes cancellation/retry/timeout tests;
- `/learn` is proven display-only;
- progression migrations and ZTAP evidence are honest and local-only; and
- the full repository validation and independent Nova review pass.
