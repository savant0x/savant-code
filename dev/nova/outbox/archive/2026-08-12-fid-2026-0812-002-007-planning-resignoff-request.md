<!-- markdownlint-disable MD013 -->

# Nova Planning Re-sign-off Request — FID-2026-0812-006 and Children 002–005, 007

**Date:** 2026-08-12
**Scope:** v0.0.23 active implementation and closure queue
**Status:** REQUESTED
**Priority:** High — fresh RED → GREEN → AUDIT → ADVERSARIAL re-audit complete; implementation remains governed by separate approval and audit gates

## Request

Please independently re-audit the converged master FID and each current child record listed below. Return one of:

- `PASS — planning approved for operator decision`
- `FAIL — planning requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This request is a **planning re-sign-off only**. It does not authorize production implementation, closure, archive movement, changelog closure entries, commit, push, tag, publication, deployment, or release activity. It does not waive any `NEEDS-REVIEW` boundary. Operator approval, implementation verification, implementation audit, and lifecycle closure remain separate gates.

The earlier archived request `dev/nova/outbox/archive/2026-08-12-fid-2026-0812-002-006-planning-signoff-request.md` covered the prior four-child queue. This request is the current five-child reconciliation and adds FID-2026-0812-007; the archived exchange is preserved unchanged.

## Records under review

| Record | Role | Current status | Current remaining boundary |
|---|---|---|---|
| `dev/fids/FID-2026-0812-006-v0-0-23-active-queue-implementation-closure-master.md` | Coordination master | `verified` | Five-child dependency order, shared gates, child reconciliation, and closure sequencing |
| `dev/fids/FID-2026-0812-002-savant-cyberpunk-terminal-surface-consistency.md` | Child | `verified` | Direct `bun dev` visual confirmation of sidebar and existing chat scrollbar across required dark/light and wide/narrow layouts |
| `dev/fids/FID-2026-0812-003-nous-research-provider-integration.md` | Child | `verified` | Authoritative remote Nous inference endpoint/credential contract or explicit operator disposition |
| `dev/fids/FID-2026-0812-004-command-and-model-picker-visibility-navigation.md` | Child | `fixed` | Direct residual provider/model picker evidence: short terminal, scrolling, resize, focus, keyboard/mouse navigation, and persistence |
| `dev/fids/FID-2026-0812-005-adaptive-session-grounding-refresh.md` | Child | `fixed` | Independent implementation audit, mutation-boundary/lifecycle evidence, and direct cadence/transcript/resume/compaction evidence |
| `dev/fids/FID-2026-0812-007-top-row-click-selection.md` | Child | `verified` | Classify terminal-host versus OpenTUI/application selection and geometry ownership; then verify only a proven minimal remediation and child-control preservation |

Savant-Free is explicitly excluded. No provider, palette, picker, grounding, or terminal-interaction boundary may be silently widened beyond the child records above.

## Required Nova review

### Master 006

1. Confirm that the master coordinates exactly five children: 002, 003, 004, 005, and 007.
2. Confirm that the dependency graph, shared gates, child-owned closure, and reconciliation sequence are explicit.
3. Confirm that planning sign-off, operator approval, implementation audit, closure, and archive movement remain distinct.
4. Confirm that the master authorizes no code, release, commit, push, publication, deployment, credential handling, or Savant-Free work.
5. Confirm that no child is treated as closed merely because its implementation or planning loop is complete.

### FID-0812-002 — sidebar surface

1. Confirm that resolved chat/app-shell alignment and palette work are not reopened.
2. Confirm that only the sidebar/scrollbar visual closure boundary remains.
3. Confirm that source parity and focused tests are not treated as direct visual proof.
4. Confirm preservation of width, hide threshold, light-mode behavior, and existing theme seams.

### FID-0812-003 — Nous provider

1. Confirm that registry, `/provider`, credential setup/persistence, `/model`, catalog, routing, health, audit, and documentation surfaces are treated as landed.
2. Confirm that authenticated `/v1/models` success is not inference acceptance.
3. Confirm that sampled inference HTTP 404 evidence remains a remote-contract boundary rather than an excuse for an assumed second transport.
4. Confirm that any closure requires authoritative Nous evidence or an explicit operator disposition, with no credential material recorded and no Portal OAuth implied.

### FID-0812-004 — picker

1. Confirm that operator-confirmed `/model` exact selection is not reopened.
2. Confirm that only residual live viewport and interaction behavior remains.
3. Confirm preservation of the complete catalog, provider ordering, persistence, routing, and Savant-Free exclusion.
4. Confirm that source/unit evidence does not substitute for short-terminal, resize, focus, keyboard, mouse, Enter, Escape, and persistence checks.

### FID-0812-005 — adaptive grounding

1. Confirm that the checkpoint, adaptive logical-turn cadence, complete grounding-set tracking, buffering, deduplication, and resume implementation are treated as landed.
2. Confirm that the supplied operator transcript is evidence of initial boot reads only and is not inflated into proof of cadence, compaction, resume, or transcript suppression.
3. Confirm that remaining implementation-audit and mutation-boundary evidence is explicit.
4. Confirm preservation of mandatory first-session grounding, SDK no-boot-contract legacy behavior, subagent boundaries, and first-response safety.

### FID-0812-007 — top-row highlight forensics

1. Confirm that the one-row-to-two-row mutation is recorded as evidence, not proof of OpenTUI bubbling.
2. Confirm that native terminal-host selection, OpenTUI/application selection, focus/hover/repaint, geometry/hit testing, coordinate translation, and mouse lifecycle remain separate hypotheses.
3. Confirm that direct Windows `bun dev` experiments are required to classify the selection layer and actual renderable owner.
4. Confirm that no broad `selectable={false}` ancestor guard, global mouse disable, or terminal reset rewrite is authorized without proof.
5. Confirm preservation of top-banner buttons/links, pickers, input, and other legitimate descendants.

## Evidence and adversarial checks

For every PASS or FAIL, cite the exact record and current source/evidence path. Re-audit all `NEEDS-REVIEW` boundaries rather than converting them to PASS. Specifically challenge:

- current reconciliation versus historical loop language;
- master/child count and relationship consistency;
- statuses that describe implementation state versus closure state;
- source parity being mistaken for live UI proof;
- Nous catalog success being mistaken for inference acceptance;
- `/model` operator confirmation being mistaken for all picker behavior being proven;
- grounding boot-read evidence being mistaken for adaptive cadence/transcript proof;
- OpenTUI bubbling being asserted without installed-source/runtime evidence;
- accidental credential, Savant-Free, release, push, or unrelated-scope authorization.

Every out-of-reach runtime or visual result must remain `NEEDS-REVIEW`.

## Current re-audit statement

Each active record now contains a fresh current-scope loop after its prior convergence history. The fresh loops preserve the implementation state already recorded, reconcile the five-child master relationship, and identify the remaining child-specific evidence boundary without changing production code or authorizing implementation. The master contains a corresponding all-child re-audit loop.

## Expected response

Please return:

1. Overall verdict.
2. Verdict per master and child record.
3. Any stale citation, scope contradiction, dependency flaw, status error, or unsupported claim.
4. Exact conditions required for operator implementation approval and later closure.
5. Explicit confirmation that this is planning review only and authorizes no production change or release action.
