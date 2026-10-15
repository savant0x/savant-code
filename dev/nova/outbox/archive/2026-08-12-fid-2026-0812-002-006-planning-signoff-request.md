<!-- markdownlint-disable MD013 -->

# Nova Planning Sign-off Request — FID-2026-0812-006 and Children 002–005

**Date:** 2026-08-12
**Scope:** v0.0.23 active implementation/closure queue
**Status:** REQUESTED
**Priority:** High — planning convergence complete; production implementation remains blocked pending operator decision

## Request

Please independently audit the converged master FID and each child FID listed below. Return one of:

- `PASS — planning approved for operator decision`
- `FAIL — planning requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is a **planning sign-off request only**. A PASS does not authorize implementation, closure, archive movement, release, commit, push, publication, or deployment. Operator approval is a separate decision. After approved implementation/evidence work, a separate Nova implementation-audit request is required before any child or master is marked closed and archived.

## Records under review

| Record | Role | Current status | Narrowed remaining boundary |
|---|---|---|---|
| `dev/fids/FID-2026-0812-006-v0-0-23-active-queue-implementation-closure-master.md` | Coordination master | `verified` | Dependency order, shared gates, child reconciliation, and closure sequencing |
| `dev/fids/FID-2026-0812-002-savant-cyberpunk-terminal-surface-consistency.md` | Child | `analyzed` | Targeted sidebar color/palette/render correction and direct UI evidence |
| `dev/fids/FID-2026-0812-003-nous-research-provider-integration.md` | Child | `verified` | Remote Nous inference endpoint/credential contract or explicit disposition |
| `dev/fids/FID-2026-0812-004-command-and-model-picker-visibility-navigation.md` | Child | `fixed` | Residual picker visibility, scrolling, resize, focus, navigation, and persistence evidence |
| `dev/fids/FID-2026-0812-005-adaptive-session-grounding-refresh.md` | Child | `fixed` | Implementation audit, mutation-boundary coverage, and direct harness cadence/transcript evidence |

Savant-Free is explicitly deferred/pending and is outside this request.

## What Nova must verify

### Master coordination

1. The master coordinates exactly children 002–005 and does not silently widen their scope.
2. Dependencies, parallel/sequential execution, shared gates, and closure order are explicit.
3. “Install” is correctly bounded to approved implementation/closure work in the current tree, not package installation or release.
4. Planning approval, operator implementation approval, implementation audit, and closure/archive are distinct lifecycle gates.
5. The master does not authorize code, waive `NEEDS-REVIEW`, or claim release readiness.

### FID-0812-002

1. Completed chat/app-shell/native-palette work is not repeated as pending.
2. The only active production boundary is the sidebar's wrong live color/palette/render seam.
3. The plan preserves sidebar width/hide behavior, light-mode safety, and unrelated surface contracts.
4. Direct `bun dev` evidence is correctly required for visual behavior.

### FID-0812-003

1. Local provider registration, setup, catalog, `/provider`, `/model`, routing, and documentation are treated as landed.
2. `/v1/models` success is not treated as inference acceptance.
3. The remote endpoint/credential contract is either confirmed with authoritative or redacted evidence, or explicitly dispositioned without an assumed second transport.
4. Portal OAuth is not implied by `NOUS_API_KEY`, and credential evidence remains redacted.

### FID-0812-004

1. The operator-confirmed `/model` exact selection defect is not reopened.
2. Only residual short-terminal, scrolling/range, resize, focus, keyboard/mouse, Enter/Escape, and persistence evidence remains.
3. Full model catalog data remains intact and Savant-Free remains excluded.

### FID-0812-005

1. Existing checkpoint/adaptive-refresh implementation is treated as present, not planning-only.
2. Remaining scope is implementation audit, mutation-boundary/harness coverage, and direct `bun dev` cadence/transcript/compaction/resume evidence.
3. Universal first-session grounding, SDK no-boot-contract legacy behavior, subagent boundaries, and first-response buffering are preserved.
4. Static evidence is not promoted to live transcript PASS without direct harness evidence.

## Evidence and adversarial checks

For every PASS or FAIL, cite the exact record and current source/evidence path. Re-audit all `NEEDS-REVIEW` boundaries rather than converting them to PASS. Specifically challenge:

- stale historical loop language versus current reconciliation sections;
- incorrect closure status or archive claims;
- missing child/master dependency edges;
- remote Nous inference being inferred from catalog success;
- terminal/UI behavior being claimed from static tests;
- grounding cadence being measured in internal steps rather than logical turns;
- hidden or synthetic compliance messages appearing in the ordinary transcript;
- any accidental release, credential, Savant-Free, or unrelated-scope authorization.

## Operator and implementation boundaries

- No production implementation has been authorized by this request.
- No release, commit, push, publication, deployment, or archive move is authorized.
- Operator approval must explicitly name the approved child scope after Nova responds.
- A later implementation sign-off request must quote focused test output, call-graph evidence, redacted remote evidence, and direct operator harness evidence for each child before closure.

## Expected response

Please return:

1. Overall verdict.
2. Verdict per master and child record.
3. Any missing citation, scope contradiction, dependency flaw, or unverified claim.
4. Exact conditions required for implementation approval, if any.
5. Explicit confirmation that this is planning review only and does not authorize production changes or release activity.
