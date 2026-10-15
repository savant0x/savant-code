<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Build Order — Agent-Steering Teacher (Homegrown Agent-Output Literacy)

**Date:** 2026-08-13
**Status:** IMPLEMENTED — FID SET 011..020 complete and locally verified; Nova audit pending
**Implementation boundary:** Production teacher code exists under `common/src/teacher/`, `packages/agent-runtime/src/teacher/`, and the CLI `/learn` surface.
**Authoring lane:** Nova planning lane; the target harness authors and executes the FIDs.
**Authoritative architecture:** `docs/design/Agent-Steering Teacher Homegrown Architecture.md`
**Superseded research:** The earlier fCC extraction documents remain historical context only.

## 1. Decision summary

Savant-Code will provide a local-first teacher for developers who need to direct
and review AI coding agents. It will teach constraints, evidence requests,
edge-case reasoning, and flaw detection—not syntax memorization.

The category-defining exercise is:

```text
learner steering → Forge output → mechanical evidence → learner critique
→ bounded Adversary adjudication → local competency event
```

The learner is not graded on prompt length, model eloquence, or whether the
agent happened to solve a task. Correctness and detection are measured through
versioned challenge contracts, hidden behavioral tests, controlled mutations,
and explicit critique evidence.

## 2. Resolved design decisions

| Decision | Resolution |
| --- | --- |
| Curriculum ownership | Homegrown. Agents propose artifacts; the operator owns skill objectives and acceptance contracts. |
| V1 language | JavaScript algorithmic challenges under the pinned Bun runtime. No Python, DOM, browser, native modules, or arbitrary repository code. |
| First product gate | One complete vertical-slice challenge before corpus-scale generation. This is a validation gate, not the final product scope. |
| Corpus authority | Versioned public/private source manifests. SQLite is a generated runtime artifact, never the authoring source. |
| Known-good isolation | Private answer packs are unreachable by Forge, learner, UI, and ordinary chat. |
| Sandbox boundary | Capability-based backend interface with a separate process or stronger platform isolation. Worker-only execution is rejected as a security claim. Unsupported backends fail closed. |
| Equivalence grading | Hidden behavioral tests + contract checks + resource limits + anti-cheat evidence. AST comparison is only one signal. |
| Detection grading | One deterministic mutation per attempt from a versioned catalog, with a flaw contract and witness. |
| Critique grading | Structured evidence first; Adversary resolves bounded natural-language equivalence. No unconstrained LLM-only pass. |
| UI | Headless exercise engine first; `/learn` is a display/input consumer with zero authority. |
| Progression | Local versioned SQLite DAG. It records exercise evidence, not learner identity or universal mastery. |
| ZTAP | Existing ZTAP is consumed through an adapter. Receipts prove exercise process integrity, not skill or identity. |
| Telemetry | Teacher content, code, critiques, tests, and progression never leave the machine. This is a teacher policy, not a reinterpretation of ECHO Law 12. |
| Savant-Free | Deferred compatibility gate after core security, grading, and UX evidence. |

## 3. Scope boundary

### In scope

- A versioned homegrown challenge and mutation contract;
- a secure-capability sandbox interface and supported backend;
- a headless exercise state machine;
- equivalence and detection grading;
- build-time corpus authoring and validation;
- `/learn` OpenTUI presentation;
- local competency progression and optional ZTAP process receipts;
- security, calibration, privacy, and integration audits.

### Out of scope for V1

- freeCodeCamp extraction or runtime dependency;
- Python, browser, DOM, native-module, or arbitrary repository execution;
- cloud sync, accounts, SaaS dashboards, teacher-content telemetry, or public credentials;
- psychological profiling, dark patterns, ensemble grading, or adaptive monetization;
- ECHO law changes;
- proof of learner identity, general programming mastery, or independent LLM judgment;
- Savant-Free packaging until its separate compatibility gate passes.

## 4. Phase sequence and hard gates

### P0 — Pedagogy, contracts, and threat model

**FID-2026-0813-012** defines the target learner, skill taxonomy, challenge
schema, public/private split, mutation contract, critique rubric, result schema,
privacy policy, and sandbox threat model.

**Exit gate:** every later FID can consume a typed contract without inventing
pedagogy, security claims, or grading semantics.

### P1 — Sandbox capability runner

**FID-2026-0813-013** implements the sandbox backend contract and the empirical
escape suite. The runner uses structured IPC, temporary-workspace containment,
resource limits, cleanup, cancellation, and explicit capability status.

**Exit gate:** known-good and broken fixtures are deterministic; filesystem,
network, environment, process, native-module, path-traversal, infinite-loop,
output-flood, malformed-IPC, and cancellation attacks are handled. An
unsupported platform reports `unavailable` and executes nothing.

### P2 — Vertical-slice exercise engine

**FID-2026-0813-014** builds one human-authored JavaScript challenge through the
headless learner-steering and sandbox lifecycle. It proves the product loop
before content-scale automation.

**Exit gate:** one constraint attempt, one correct result, one broken result,
one controlled mutation, one learner critique, cancellation, timeout, retry, and
cleanup all work without touching the user's project or ordinary chat state.

### P3 — Corpus authoring and validation

**FID-2026-0813-015** builds the build-time agent-assisted authoring pipeline.
The operator supplies skill objectives; agents propose artifacts; independent
validation executes known-good solutions, mutation tests, validates manifests,
and emits a content-addressed public/private pack.

**Exit gate:** no challenge ships without operator approval, stable hashes,
known-good repeatability, mutation detectability, schema validation, and private
answer isolation.

### P4 — Equivalence grader

**FID-2026-0813-016** adds hidden behavior tests, challenge invariants, error
contracts, resource limits, and anti-cheat fixtures. It retains AST analysis only
as a diagnostic signal.

**Exit gate:** valid alternate implementations pass; test-specific hardcoding,
weak tests, contract violations, and resource abuse fail; deterministic results
are reproduced across repeated runs.

### P5 — Detection grader

**FID-2026-0813-017** adds the mutation catalog, flaw contracts, learner critique
schema, deterministic evidence extraction, and bounded Adversary adjudication.

**Exit gate:** calibration and held-out suites measure false acceptance, false
rejection, vague-critique acceptance, correct-critique rejection, and transfer.
Thresholds are declared in the FID before implementation and cannot be replaced
by a single anecdotal pass.

### P6 — `/learn` overlay

**FID-2026-0813-018** presents the headless exercise engine in an OpenTUI split
pane. It subscribes to state/events before execution, exposes learner input and
cancellation, and has no tool, filesystem, corpus, grader, or progression
authority.

**Exit gate:** static import scan and runtime tests prove display-only behavior,
chat restoration, resize/short-terminal behavior, cancellation, and unavailable
sandbox handling.

### P7 — Progression and ZTAP adapter

**FID-2026-0813-019** implements versioned local SQLite migrations, competency DAG
edges, attempt history, result evidence hashes, and the ZTAP process-receipt
adapter. Fallback markers are explicitly `local-unverified`.

**Exit gate:** replay, migration, duplicate-attempt, corruption, privacy, and
no-network tests pass; records identify challenge, corpus, grader, mutation, and
sandbox policy versions.

### P8 — Integration and adversarial audit

**FID-2026-0813-020** audits the complete feature across ECHO boundaries, trust
domains, call-graph reachability, sandbox policy, corpus secrecy, grading
calibration, UI authority, progression honesty, and packaging boundaries.

**Exit gate:** all child gates pass, full repository validation passes, Nova
independently audits the implementation, and no release authorization is implied.

## 5. Default quantitative gates

These are planning defaults, not claimed implementation results. A child FID may
raise them, but may not lower them without a master-FID amendment.

- Sandbox known-good and broken fixtures: 20 repeated runs each with identical
  status/test summaries; cleanup succeeds on every run.
- Sandbox escape corpus: zero observed escapes across all fixtures and three
  repeated runs per fixture; any escape blocks the feature.
- Corpus validation: every approved challenge passes known-good repeatability and
  every registered mutation has a tested witness.
- Equivalence: all known-good and approved alternate implementations pass; all
  exploit fixtures fail; no progression on incomplete evidence.
- Detection calibration: at least 100 labeled critique cases across the mutation
  catalog; at least 95% of fully correct critiques accepted and at most 5% of
  vague/unrelated critiques accepted. Held-out transfer is reported separately.
- Progression: stronger competency claims require three held-out successful
  exercises; a single attempt remains an attempt record only.

## 6. Integration map

| Surface | Integration rule |
| --- | --- |
| `common/` | Shared serializable teacher contracts and runtime validation only. |
| `packages/agent-runtime/src/teacher/` | Headless exercise FSM, sandbox API, grading orchestration, and bounded events. |
| `packages/agent-runtime/src/provenance/` | Existing ZTAP adapter only; no duplicate signing implementation. |
| `cli/src/commands/learn/` | Command routing and lifecycle control; no grading logic. |
| `cli/src/components/savant-ui/` | Read-only teacher rendering; no tool/control imports. |
| `.savant/teacher/` | Gitignored generated runtime artifacts and public/private pack material with enforced permissions. |
| `protocol.config.yaml` | Namespaced `teacher:` settings only after parser/default/error tests exist. |
| `packages/database` / `bun:sqlite` conventions | Reuse existing SQLite lifecycle patterns; do not create a second general DB abstraction. |
| ZTAP | Record process evidence through a narrow adapter; do not claim skill credentials. |
| Ordinary chat | Exercise state is isolated and restored; no silent chat mutation or repository writes. |

## 7. Required schemas

### Public challenge

```text
id, version, skill, objective, prompt, visibleGuidance,
inputContract, outputContract, limits, prerequisites, challengeHash
```

### Private challenge pack

```text
challengeHash, knownGoodHash, hiddenTests, mutationContracts,
critiqueRubric, gradingVersion
```

### Sandbox result

```text
status, exitCode, testSummary, stdoutHash, stderrSummary,
durationMs, policyVersion, runnerVersion
```

### Attempt result

```text
attemptId, challengeHash, corpusVersion, sandboxPolicyVersion,
graderVersion, equivalenceResult, detectionResult,
evidenceHashes, completionState, timestamp
```

## 8. Verification matrix

| Area | Hard evidence |
| --- | --- |
| Sandbox | Escape corpus, deterministic repeats, resource/cancellation tests, platform capability report |
| Corpus | Manifest validation, known-good repeatability, mutation survival, private-data reachability scan |
| Equivalence | Hidden behavior/property tests, alternate implementation, hardcoding and resource-abuse fixtures |
| Detection | Mutation witness tests, structured critique cases, calibration and held-out results |
| Exercise engine | FSM transition, timeout, cancellation, retry, cleanup, and chat-isolation tests |
| Overlay | Static zero-authority scan, event-subscription ordering, resize/restore tests |
| Progression | Migration, replay, corruption, duplicate, privacy, and no-network tests |
| Governance | ECHO law compatibility, FID-bound writes, no telemetry, ZTAP claim boundary |
| Repository | `bun run typecheck`, root tests, ESLint zero warnings, targeted Markdownlint, Prettier |

## 9. FID registry

| FID | Scope | Depends on |
| --- | --- | --- |
| `FID-2026-0813-012` | Pedagogy, contracts, threat model | — |
| `FID-2026-0813-013` | Capability-based sandbox runner | 012 |
| `FID-2026-0813-014` | Headless vertical-slice exercise | 012, 013 |
| `FID-2026-0813-015` | Homegrown corpus authoring and validation | 012, 014 |
| `FID-2026-0813-016` | Equivalence grader | 014, 015 |
| `FID-2026-0813-017` | Mutation and detection grader | 014, 015 |
| `FID-2026-0813-018` | `/learn` OpenTUI overlay | 016, 017 |
| `FID-2026-0813-019` | Progression store and ZTAP adapter | 018 |
| `FID-2026-0813-020` | Integration/security/adversarial audit | 013, 016, 017, 018, 019 |

Master: `FID-2026-0813-011-agent-steering-teacher-master.md`.

## 10. Governance and release boundary

The teacher is a consumer of ECHO and does not modify the 15 laws. Learner
input is exercise data, not permission to bypass FID-bound repository writes.
The Adversary remains read-only. The sandbox is not allowed to write the user
project or corpus. All teacher code changes remain subject to the normal FID
Perfection Loop and independent implementation audit.

This plan authorizes no code, commit, push, release, publication, deployment,
Savant-Free packaging, or external distribution. Those require separate operator
approval after implementation evidence and Nova sign-off.

## 11. Open questions converted to implementation gates

No architecture-blocking questions remain. These items are resolved by tests,
not by silent assumptions:

1. **Platform sandbox support:** each supported platform must publish a capability
   result; unsupported environments fail closed.
2. **Grading thresholds:** FIDs must declare calibration/held-out thresholds
   before running the grader.
3. **Corpus approval:** every generated challenge requires operator approval and
   independent validation before packaging.
4. **Free variant:** compatibility is a later gate, not a V1 assumption.
5. **Telemetry:** teacher data is local-only and excluded from product analytics.

*This build order is the converged planning source for the homegrown teacher.
The FID set is planning-only until its own Perfection Loop completes. ZTAP is
already implemented and independently audited in this repository.*
