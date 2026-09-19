# FID: `unsafe` Permission Mode And Dev Override Bypass The Destructive-Command Denylist

**Filename:** `FID-2026-0919-014-sec7-unsafe-mode-skips-destructive-denylist.md`
**ID:** FID-2026-0919-014
**Severity:** low
**Status:** verified
**Created:** 2026-09-19
**YAGNI-Compliance:** Confirmed (Loop 3 — two-line ordering fix per site;
no new escape hatches)

---

## Summary

`sandbox/engine.ts:52-54` returns `{ type: 'allow' }` when
`policy.permissionMode === 'unsafe'` **before** the destructive-pattern
denylist is consulted at `:78` (`findDestructivePattern` — `rm -rf /`,
fork bombs, `dd` to a device, `curl | sh`). Separately, the sandbox gate's
dev override (`sandbox-gate.ts:40`, `isDevOverride` → skip whole
evaluation) bypasses sandbox review with only a debug-level log. Both are
operator-facing escape hatches — legitimate — but neither preserves the
destructive-command floor: an operator who opts out of *sandboxing* did not
thereby opt out of *not destroying the machine*.

## Environment

- **OS:** all
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `packages/agent-runtime/src/tools/sandbox/engine.ts`,
  `tools/tool-executor/sandbox-gate.ts`
- **Commit/State:** verified against live source 2026-09-19 (Task 66 audit)

## Detailed Description

### Problem

`engine.ts:50-54`:

```typescript
// `unsafe` mode bypasses the sandbox engine. Path containment for write
// tools is already enforced by the caller before the sandbox check runs.
if (policy.permissionMode === 'unsafe') {
  return { type: 'allow' }
}
```

`engine.ts:78` — the denylist this early return skips:

```typescript
const pattern = findDestructivePattern(command)
```

`sandbox-gate.ts:40` — the dev bypass:

```typescript
if (isDevOverride) {
  return false
}
```

### Expected Behavior

The destructive denylist is a floor evaluated unconditionally; mode and dev
override then relax everything *above* the floor.

### Evidence

```text
engine.ts:52-54      unsafe early allow (verbatim above)
engine.ts:78         findDestructivePattern consult (skipped on early allow)
sandbox-gate.ts:40   dev override skips whole sandbox evaluation
docs/security-audit-orchestrator-agent-flow.md  SEC-7 (verified 2026-09-19)
```

## Impact Assessment

### Affected Components

- `sandbox/engine.ts`, `tools/tool-executor/sandbox-gate.ts`
- Only configurations where the operator has explicitly chosen `unsafe`
  (or dev override) — the blast radius is self-inflicted-by-config, but
  prompt injection (FID-2026-0919-009) makes "the agent chose" a real
  scenario even in dev

### Risk Level

- [x] Low: requires an explicit operator-unsafe configuration; impact is
  the classic destructive-command class (data loss up to machine
  destruction); denylist exists precisely for this

## Proposed Solution

### Approach

1. In `engine.ts`, hoist the `findDestructivePattern` check above the
   `unsafe` early return (denylist result returned regardless of mode).
2. In `sandbox-gate.ts`, run the destructive check before the
   `isDevOverride` short-circuit.
3. Tests: `rm -rf /` denied in `unsafe` mode and under dev override;
   ordinary commands unaffected in both modes; the existing
   `shell-denylist` suite stays green.

Alternatives considered and rejected:

- *None material* — the change is a two-line ordering fix per site; any
  broader redesign is out of scope (YAGNI).

### Steps

1. [x] DONE — `engine.ts`: destructive-pattern check hoisted above the
   `unsafe` early return; denial is `deny` in every mode (was
   safe=deny/prompt=prompt/unsafe=allow).
2. [x] DONE — `sandbox-gate.ts`: the same floor runs BEFORE the
   `isDevOverride` short-circuit, emitting the sandbox-denial error chunk
   shape and a warn log naming the matched pattern.
3. [x] DONE — engine tests updated (deny-in-prompt-mode, deny-in-unsafe-
   mode, readonly-tool floor) + integration assertion updated to the new
   denial text; 35+2 suite green.

### Verification

- New cases green (pasted output); existing sandbox/denylist suites green;
  typecheck agent-runtime; eslint; quality gate.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/tools/sandbox/__tests__/engine.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:9b106c290b110452fd8bf0a599b4ce67a09145839be20c863d1d087888eb8e98
- verified: 2026-09-19T04:02:59.281Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/tools/sandbox/__tests__/engine.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Ordering verified at the lines above; report SEC-7.
- **GREEN:** Hoist-the-floor fix proposed. Not implemented; awaiting
  operator approval.
- **AUDIT:** Document-level double audit; evidence re-verified 2026-09-19.
- **ADVERSARIAL:** Could hoisting break legitimate dev workflows that
  genuinely need destructive commands? The denylist targets
  machine-destruction patterns, not project-level writes; an operator who
  needs `rm -rf` on a *project dir* is unaffected (`rm -rf /` root,
  `/dev/sda`, fork bombs are the matches). Override-with-notice remains
  possible as an explicit future escape hatch if ever needed.
- **CHANGE DELTA:** n/a (document creation).

### Missed Questions

1. Should the denial be advisory in unsafe mode instead? → No: the whole
  point of a floor is that it is not advisory.
2. Debug-log the denial? → Yes, warn-level with the matched pattern — one
  line, visible in dev sessions.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** pending G2 (operator commit withheld; no silent
  deferral — presented at turn end)
- [x] **File:line ranges:** `packages/agent-runtime/src/tools/sandbox/engine.ts`
  (floor above mode check), `tools/tool-executor/sandbox-gate.ts` (floor
  above dev override), `tools/sandbox/__tests__/engine.test.ts` (updated),
  `src/__tests__/tool-executor-sandbox.test.ts` (assertion updated)
- [x] **Gate output:** receipt below — typecheck/test/quality all exit 0
- [x] **Reproducibility:** `bun test ./packages/agent-runtime/src/tools/sandbox/__tests__`
  → 35 pass / 0 fail
- [x] **Step statuses:** all 3 steps `implemented` (operator-approved
  2026-09-19; no deferrals)

### Code Verification Evidence

- [x] Files referenced in this FID exist and contain the quoted code
  (verified by read 2026-09-19)
- [x] Implementation matches Proposed Solution (ordering floor; Loop 2
  audit)
- [x] Typecheck/tests/lint pass with pasted output (receipt below)
- [x] No production call-graph change proposed (predicate ordering within
  two functions)

### Loop 2 — Independent audit and self-correction

- **RED:** Ordering confirmed live (engine early-allow at :52 preceded the
  denylist at :78; gate dev-bypass preceded evaluation).
- **GREEN:** Implemented as proposed, plus one deliberate behavior
  hardening beyond pure ordering: the floor now DENIES (not prompts) in
  prompt mode too — an unauditable auto-deny downgrade in headless mode
  could previously be answered `allow` by the operator in interactive
  mode; machine destruction is not a prompt-worthy choice. Recorded here
  as the intended reading of the FID's "floor" language.
- **AUDIT:** Static: typecheck agent-runtime exit 0; eslint 0; quality
  PASS; receipt gates exit 0. Manual re-read confirmed the residual
  denylist branch is structurally dead but kept (documents intent for
  future severity classes).
- **ADVERSARIAL:** (1) Old tests pinned allow-in-unsafe — updated to pin
  the floor, with the denial-reason assertion. (2) One integration test
  asserted the old message text — updated with a comment citing this FID.
  (3) Residual risk honestly noted: an operator can still run destructive
  commands via explicit user-typed shell outside the agent; the floor
  governs agent-issued commands only — by design.
- **CHANGE DELTA:** `engine.ts` floor block + residual branch kept;
  `sandbox-gate.ts` floor block + warn; 2 test files updated (3 new
  engine cases); no public API change.

### Loop 3 — Final convergence

- **RED:** Converged — bypass closed in both engine and gate.
- **GREEN:** Converged — floor live in every mode (uncommitted,
  G2-pending).
- **AUDIT:** Converged — receipt gates exit 0; eslint 0; lint:md clean.
- **ADVERSARIAL:** Converged — three challenges resolved.
- **CHANGE DELTA:** Final: see Loop 2; none after receipt stamp.

## Resolution

- **Closed Date:** pending G2 commit (operator authorization)
- **Fix Description:** Destructive-command denylist hoisted to an
  unconditional floor in both the sandbox engine and the executor gate —
  applies in every permission mode and under the dev override
- **Tests Added:** engine floor cases (deny in prompt/unsafe modes,
  readonly-tool reach); integration denial-text updated
- **Verification Evidence:** receipt below
- **Archived:** pending G2 (moves to `dev/fids/archive/` with the commit)

## Lessons Learned

Escape hatches must have floors. "Trust the operator" and "never destroy
the machine" are different axes — an override on one axis must not silently
override the other.
