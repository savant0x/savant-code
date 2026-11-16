# dsh-superagent Prototype Extraction Audit

**Target:** `resources/dsh-superagent-prototype-main`

**Audit date:** 2026-11-02

**Purpose:** Identify ideas worth evaluating for retrofit into Savant-Code. This
is an extraction report, not an implementation approval. Every candidate must
become a separate FID, pass the Perfection Loop, fit the current harness
architecture, and prove production call-graph reachability before code is
written.

## Executive assessment

The prototype is a substantial, coherent reference implementation for a
proactive, event-driven coding agent. Its strongest transferable ideas are
durable side-effect processing, explicit authorization provenance, ticket and
follow-up lifecycle modeling, bounded worker concurrency, and revisioned prompt
configuration. The prototype itself explicitly describes its code as research
code and not production-ready (`README.md:3-9`), so extraction should preserve
the concepts rather than copy modules or dependencies.

The prototype's central architecture is a transactional `Engine` surrounded by
adapters (`docs/007-architecture.md:5-27`). Savant already has overlapping
concepts—agent sessions, tools, ECHO phases, provenance, durable state, hooks,
goals, and worktree/FID controls—so the first step for every candidate is a
blast-radius and duplication review against the existing harness. New parallel
subsystems should not be introduced where an existing one can be extended.

## Evidence and verification boundary

- Inventory: TypeScript source, 89 test files, numbered design documents,
  prompts, skills, and a DSH bundle patch.
- Declared prototype gates are `pnpm typecheck`, `pnpm test`, and `pnpm build`
  (`package.json:47-51`; `README.md:33-35`).
- The prototype's `node_modules` directory is absent, so `pnpm check` was not
  runnable. No prototype build or test pass is claimed.
- The target README warns that the implementation is research code and may
  contain bugs (`README.md:3-5`).
- The prototype states that command wrappers and directories are defaults, not
  a security boundary, because an absolute path can bypass them
  (`docs/003-execution.md:63-80`). This must block any direct security claim.

## Candidate extraction register

### P1 — Durable effect queue with idempotent coalescing and backoff

**Prototype evidence:** `src/app/effects.ts:43-71` persists effects in SQLite,
coalesces by kind/key, preserves queue position, and resets attempts when a
newer payload replaces a waiting row. `src/app/effects.ts:103-159` adds
concurrency limits, ordered queues, retry backoff, shutdown preservation, and
health reporting. The architecture document lists assessment, launch,
delivery, relay, notice, and reply effect kinds (`docs/007-architecture.md:164-181`).

**Why it fits:** Savant already has durable commits, lifecycle hooks, tool
execution, session persistence, experience capture, and exposure capture. A
single reusable durable-work abstraction could reduce bespoke retry and
post-commit behavior without weakening existing gates.

**Retrofit required:** Compare against `packages/database` commit-journal and
mutation-line semantics, agent-runtime tool execution, hook lifecycle, and
existing retry/health paths. Define ownership, cancellation, ordering,
idempotency keys, error redaction, and crash recovery before implementation.

**Recommendation:** Extract the invariants and probe them in a FID; do not copy
the SQLite table or introduce a second queue until the current durable seams
are mapped.

### P1 — Explicit authorization provenance and mandate revalidation

**Prototype evidence:** `src/policy.ts:35-60` requires every enabled rule to
be judged exactly once, requires settled direction and intent evidence for
acceptance, and distinguishes observation from authorization. `src/policy.ts:143-165`
computes effects of policy changes on live work. `src/policy.ts:213-239`
revalidates mandates against current source scope, sender membership, mode,
and enabled rules. The authorization model records the admission basis and
strength (`docs/002-authorization.md:46-75`, `107-141`).

**Why it fits:** This is strongly aligned with ECHO's explicit scope register,
permission modes, provenance receipts, trust boundaries, and operator-only
authority. It offers a concrete model for answering “why was this allowed?”
and “does this permission still hold?”

**Retrofit required:** Reconcile it with Savant's sandbox, ProjectTrust,
provenance mode, steering rules, FID scope, and operator approval semantics.
Do not let model-produced assessment text grant permissions or override ECHO
gates.

**Recommendation:** High-value design extraction. Start with a FID for a
typed authorization-decision/provenance contract and negative tests.

### P1 — Explicit work-item lifecycle with follow-up ownership

**Prototype evidence:** `src/core/engine.ts:19-22,40-100` makes the Engine the
single transactional writer and exposes role-scoped interfaces. The architecture
maps Intake, Evals, Tickets, Assignments, and Replies with one-way dependencies
(`docs/007-architecture.md:44-64`). Follow-up ownership, hand-back, and
context-only subscriptions are specified in `docs/002-authorization.md:18-44`
and implemented through Engine operations (`src/core/engine.ts:201-239`).

**Why it fits:** Savant currently has goals, FIDs, sessions, tool calls, and
handoffs, but a durable work-item state model could make ownership,
continuations, human attention, retry, and completion more explicit than a
single conversational loop.

**Retrofit required:** Align with the current goal engine and FID lifecycle;
avoid creating a competing ticket abstraction. Define the exact boundary
between a user goal, an FID, a session run, a tool invocation, and an external
follow-up.

**Recommendation:** Extract as a domain-model proposal only. It is an
architecture-level candidate and must use a full FID before implementation.

### P2 — Bounded worker slots with human-wake priority

**Prototype evidence:** The execution model gives each Ticket a Session and
directory and reserves worker slots for launches and deliveries
(`docs/003-execution.md:23-61`). Human messages may use one extra slot and
take priority over new work. The architecture records the same behavior for
`DshExecutor` (`docs/007-architecture.md:197-207`).

**Why it fits:** This is a useful operational policy for protecting operator
responsiveness when background agent work saturates capacity.

**Retrofit required:** Compare with existing agent-runtime concurrency,
subagent fan-out, cancellation, tool budgets, and session scheduling. Define
fairness, starvation prevention, and whether priority is per user, session,
goal, or FID.

**Recommendation:** Extract the scheduling invariants and metrics, not the
Ticket implementation. Candidate for a focused concurrency FID.

### P2 — Background-job and subagent lifecycle accounting

**Prototype evidence:** `src/executor/background.ts:61-103` keeps a worker busy
while owned jobs or subagents run; `:107-164` bounds job collection, killing,
subagent draining, and shutdown behavior. The execution document specifies
30-minute background limits and restart semantics (`docs/003-execution.md:31-47`).

**Why it fits:** Savant already has subagents, shell/tool execution, session
shutdown, and cancellation. The prototype provides a concrete model for
preventing premature “complete” signals while owned work continues.

**Retrofit required:** Map to the current tool executor, process ownership,
session cancellation, background jobs, and evidence capture. Ensure a killed
job cannot silently lose output or bypass verification.

**Recommendation:** Strong retrofit candidate after a call-graph audit of
current completion and cancellation paths.

### P2 — Versioned prompt parts with optimistic concurrency and drift review

**Prototype evidence:** `src/app/prompts.ts:13-42` defines typed team sections,
skills, and override metadata. `:79-119` composes prompts from stable parts and
generated environment/policy sections. `:164-215` validates placeholders,
preserves base text, detects conflicts, and stores revisions. `:183-193`
surfaces changed or removed built-in defaults.

**Why it fits:** Savant has prompt/configuration surfaces, skills, generated
protocol artifacts, and operator governance. This model could improve safe
prompt customization and make upstream default drift visible.

**Retrofit required:** Preserve quarantine/trust rules, immutable skills,
generated-artifact checks, provider/model identity, and prompt-size limits.
Prompt overrides must never alter tool permissions or ECHO authority.

**Recommendation:** Extract the revision/base/default-drift pattern. Avoid
copying the prototype's prompt catalog until current skill and prompt stores
are inventoried.

### P2 — Ordered outbox with receipts and channel-aware delivery

**Prototype evidence:** The architecture identifies Outbox as the only writer
of receipts and queues replies after commit (`docs/007-architecture.md:37-43`).
Reply ordering, retry, withdrawal, and channel disappearance are specified in
`docs/003-execution.md:175-191`.

**Why it fits:** Savant has tool results, notifications, hooks, session events,
and external integrations where duplicate or reordered delivery can confuse
operators.

**Retrofit required:** Compare against existing event sinks, provenance,
experience/exposure capture, and connector delivery semantics. Define whether
delivery is durable product state or merely telemetry, and redact payloads
before persistence.

**Recommendation:** Extract as a delivery-contract idea, not as a generic
“send everything later” queue.

### P3 — Source plugin protocol with narrow context capability

**Prototype evidence:** `src/sources/kind.ts`, `src/sources/registry.ts`, and
`src/app/source-context.ts` are described as a registry/context boundary in
`docs/007-architecture.md:183-195`. Sources receive only a narrow `SourceHost`
and context, while the registry owns validation, health claims, scope, search,
channels, and thread context (`docs/007-architecture.md:255-274`).

**Why it fits:** This is relevant to Savant's connector catalog and tool
meta-family. It encourages capability isolation and lets integrations share
generic orchestration logic.

**Retrofit required:** Align with connector manifests, tool allowlists,
ProjectTrust, credential ownership, and the current 10-role separation of
duties. Do not make external connectors able to mutate FIDs, skills, or policy.

**Recommendation:** Extract the interface/registry constraints after mapping
existing connector call graphs.

### P3 — Management read models and operator attention views

**Prototype evidence:** The panel has dedicated views for overview, sources,
threads, tickets, settings, and records (`docs/007-architecture.md:347-353`),
with tests for panel pages and domain views (`docs/007-architecture.md:402-418`).
The overview explicitly groups work needing a person, problems, flow, and load.

**Why it fits:** Savant's durable agenda, FID state, experiences, and follow-up
tracking would benefit from a single operator surface that prioritizes action
over raw event volume.

**Retrofit required:** Define a read-only projection over current durable
records; avoid a second source of truth. Include stale-evidence labeling,
blocked-vs-complete states, and clear distinction between code verification and
live acceptance.

**Recommendation:** Good product/design candidate, but only after the current
CLI/desktop surfaces and agenda generators are inventoried.

## Do not extract directly

1. **The DSH bundle patch and presets.** `cordis.patch.yml:4-193` is tightly
   coupled to DeepSeek Harness package names, presets, and platform branches;
   it is reference material, not portable harness code.
2. **Command-blocking as security.** The prototype itself disclaims this
   boundary (`docs/003-execution.md:78-80`). Savant must retain capability,
   containment, steering, credential, and provenance gates.
3. **Source-specific GitHub/Feishu modules.** Their behavior is useful as
   connector examples, but direct copying would duplicate Savant's connector
   architecture and provider abstractions.
4. **The prototype's dependency graph or SQLite schema.** The prototype uses
   Node 22+/24, pnpm, Zod, SQLite, and DSH-specific peer packages
   (`package.json:53-85`); Savant is a Bun TypeScript monorepo with existing
   database and runtime seams.
5. **Prompt text as enforcement.** The prototype documents that prompts change
   what agents are told, while permissions remain elsewhere
   (`src/app/prompts.ts:195-200`). This separation is compatible with Savant
   only if it remains mechanically enforced.

## Proposed extraction order

1. **Authorization contract:** model decisions, evidence, basis, revalidation,
   and negative tests; compare with provenance and ProjectTrust.
2. **Durable work/effect contract:** coalescing, ordering, retries, health,
   cancellation, and crash recovery; compare with database commit seams.
3. **Completion and background accounting:** define when a goal/FID/session is
   truly complete while jobs or subagents remain active.
4. **Prompt/default drift:** add revision conflict and upstream-default review
   only where the existing skill/config store lacks equivalent behavior.
5. **Operator projection:** derive attention/read models from existing durable
   state after the lifecycle vocabulary is settled.

Each item above requires a separate FID with RED evidence, a sequential-thinking
GREEN design, static and runtime AUDIT evidence, production call-graph grep,
and adversarial review before retrofit. No item in this report authorizes source
changes by itself.

## Final disposition

The prototype is valuable as a design reference, especially for authorization
provenance, durable asynchronous work, lifecycle ownership, and operator
attention. It is not evidence that those designs are production-ready in the
Savant environment. The highest-value next investigation is a call-graph and
duplication audit of Savant's existing durable state, execution, provenance,
connector, prompt, and operator-surface implementations before opening the
first extraction FID.
