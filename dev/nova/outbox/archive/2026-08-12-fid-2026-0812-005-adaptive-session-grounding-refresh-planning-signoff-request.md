# Nova Planning Sign-off Request — FID-2026-0812-005

**Status:** AWAITING NOVA REVIEW
**Priority:** High — implementation remains blocked until independent planning review and separate operator approval are complete.
**FID:** `dev/fids/FID-2026-0812-005-adaptive-session-grounding-refresh.md`
**Scope:** Persisted session grounding state, complete grounding-set evidence, adaptive condensed refresh cadence, compaction/contract-change triggers, refresh deduplication, and first-completion visibility ordering.
**Review type:** Independent planning audit only. No implementation, closure, archive move, commit, tag, push, publication, deployment, or credential use is authorized by this request.

## Request

Please independently read the referenced FID 0-EOF and verify its planning claims against the current working tree. Review the FID under the single-agent ECHO protocol's Perfection Loop and return a verdict for every material domain as `PASS`, `FAIL`, or `NEEDS-REVIEW`, with exact `path:line` citations and quoted code/evidence.

The central question is whether the FID safely solves the operator-observed repeated grounding behavior without weakening mandatory first-session grounding, creating prompt churn, or allowing an ungrounded response to become visible.

## Required review boundaries

Nova must distinguish these states explicitly:

1. **Planning convergence** — whether the FID is internally complete and implementation-ready.
2. **Operator approval** — not supplied by this request; Nova must not infer it.
3. **Implementation** — not performed for this FID.
4. **Implementation verification** — unavailable until implementation exists.
5. **Live harness evidence** — unavailable until the operator runs the required direct `bun dev` checks.

A planning PASS does not authorize implementation or closure.

## Review domains

### Domain A — Problem and root-cause evidence

Verify that the FID accurately identifies and cites:

- `WeakMap<AgentState, EchoEnforcement>` identity lifetime;
- enforcement state initialization and protocol-read state;
- SDK resume deep cloning via `applyOverridesToSessionState`;
- internal-step rather than logical-user-turn cadence;
- single protocol-file gate clearing versus the four-file grounding set;
- streamed text emission before the completion gate;
- synthetic compliance/refresh messages and retention behavior.

Mark any stale, unsupported, or misquoted citation `FAIL` or `NEEDS-REVIEW`; do not accept an attributed claim without source evidence.

### Domain B — Safety invariants and scope

Verify that the FID preserves:

- mandatory full grounding before first final answer/non-read tool in harness sessions;
- universal gate behavior for resolved harness boot contracts;
- legacy no-gate behavior for SDK sessions without a boot contract;
- subagent pre-seeding and exemption semantics;
- harness versus single-agent protocol separation;
- no credential, release, deployment, archive, or unrelated feature scope.

Challenge whether any proposed checkpoint or refresh behavior could accidentally bypass the gate.

### Domain C — Persisted checkpoint contract

The FID's checkpoint schema is normative, not deferred. Nova must verify the exact `schemaVersion: 1` shape, deterministic fingerprint tuple, sorted path-key rules, migration behavior, and stale-field clearing/effective-gate rule. Any missing or ambiguous required field is a planning `FAIL`, not an implementation follow-up.

Review whether the proposed serializable checkpoint is sufficient and safely migratable across:

- `previousRun` resume;
- `cloneDeep` and JSON serialization;
- cancellation snapshots;
- invalid/missing/unknown checkpoint versions;
- protocol variant/source/version/path/fingerprint changes;
- older states that have no checkpoint.

Identify any fields that would be non-serializable, ambiguous, or insufficient to prevent repeated full grounding.

### Domain D — Adaptive cadence and anti-thrash

The FID's deterministic constants are normative: `CONDENSED_REFRESH_USER_TURNS = 5`, `MIN_REFRESH_TURN_GAP = 2`, `MAX_INTERNAL_STEPS_WITHOUT_REFRESH = 12`, and `MAX_ACTIVE_MS_WITHOUT_REFRESH = 600000`. Nova must reject any remaining ambiguity in logical-turn completion classification, same-epoch dedupe, compaction epoch handling, or repeated time/step triggers.

Review the policy:

- condensed refresh baseline at approximately five completed logical user turns;
- internal step/time backstops only as bounded safety limits;
- compaction and explicit governance triggers;
- contract identity changes causing invalidation/full grounding;
- minimum logical-turn window and dedupe/replacement;
- exclusion of tool steps, retries, subagent work, and internal steering from user-turn count.

Challenge whether the FID leaves any path that can refresh every user turn or repeatedly refresh during one long turn.

### Domain E — Stream and transcript visibility

The FID fixes first-response safety to a **non-rendered per-step buffer**. Nova must verify that this is an implementation requirement, not an unresolved alternative: ungrounded text is staged, never forwarded to CLI/UI, discarded on a blocked completion, and normal streaming resumes only after grounding. The hidden-renderer alternative is not an allowed substitute in this FID.

Verify that the FID does not assume a post-stream gate can retract already-emitted text. The implementation plan must require the fixed buffering contract above.

Also verify that hidden/typed compliance and refresh delivery has a renderer-level acceptance requirement and does not silently accumulate synthetic user messages.

### Domain F — Call-graph and implementation readiness

Check that each proposed seam has a reachable implementation path and that no new exported symbol/config field is proposed without caller/test updates. Specifically review common session state, agent-runtime enforcement/loop/compaction/stream seams, SDK resume paths, and CLI/headless rendering evidence.

Zero production callers for a new production function is a rejection condition.

### Domain G — Verification and evidence boundaries

Check that the FID separates:

- source-level tests from live operator evidence;
- static cadence tests from actual `bun dev` behavior;
- implementation gates from planning evidence;
- PASS from `NEEDS-REVIEW` where a screen, renderer, or operator session is out of reach.

The FID must not claim implementation tests or live behavior before implementation.

## Required Nova output

Treat any unresolved item from Domains C–E (checkpoint schema, cadence constants/turn semantics, or fixed buffering/visibility contract) as a planning `FAIL`, not as an implementation note. Return a Markdown response with:

1. A clear overall verdict: `PASS`, `FAIL`, or `NEEDS-REVIEW`.
2. A per-domain table for A–G using `PASS`, `FAIL`, or `NEEDS-REVIEW`.
3. Exact `path:line` citations for every material PASS/FAIL.
4. A list of all findings, classified by severity.
5. Explicit confirmation that no implementation or release authorization is granted.
6. A statement distinguishing planning sign-off from operator approval.
7. If the FID is planning-ready, state the exact residual implementation/live evidence required before closure.

Use `NEEDS-REVIEW` for unavailable live harness, renderer, or implementation evidence. Never convert unavailable evidence into PASS.

## Suggested read-only evidence commands

```text
cat dev/echo-v0.1.2-single-agent.md
cat dev/fids/FID-2026-0812-005-adaptive-session-grounding-refresh.md
sed -n '1,220p' packages/agent-runtime/src/echo/enforcement.ts
grep -n -A12 -B8 'WeakMap\|protocolRead\|onStepBoundary\|PROTOCOL_REFRESH_INTERVAL' packages/agent-runtime/src/echo/enforcement.ts packages/agent-runtime/src/echo/enforcement-state.ts packages/agent-runtime/src/echo/protocol-summary.ts
grep -n -A12 -B8 'applyOverridesToSessionState\|cloneDeep\|previousRun' sdk/src/run/execution/session-state.ts sdk/src/run-state/mutations.ts sdk/src/run/types.ts
grep -n -A10 -B8 'onResponseChunk\|fullResponseSoFar' packages/agent-runtime/src/tools/stream-parser.ts
grep -n -A16 -B8 'applyUngroundedCompletionGate\|ECHO_REFRESH' packages/agent-runtime/src/run-agent-step/loop-iteration.ts
bunx prettier --check dev/fids/FID-2026-0812-005-adaptive-session-grounding-refresh.md dev/nova/outbox/2026-08-12-fid-2026-0812-005-adaptive-session-grounding-refresh-planning-signoff-request.md
bun run lint:md -- dev/fids/FID-2026-0812-005-adaptive-session-grounding-refresh.md dev/nova/outbox/2026-08-12-fid-2026-0812-005-adaptive-session-grounding-refresh-planning-signoff-request.md
```

## Decision boundary

A Nova planning `PASS` means only that the FID is internally coherent, evidence-grounded, and ready for the operator's separate implementation decision. It does not authorize code changes. Implementation begins only after explicit operator approval and must receive a separate implementation audit before the FID can become `closed` and move to `dev/fids/archive/`.
