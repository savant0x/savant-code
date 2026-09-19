# FID: Capability Gate Trusts The Agent Template's Own `toolNames` — Including Database-Sourced Templates

**Filename:** `FID-2026-0919-013-sec6-template-self-declared-capabilities.md`
**ID:** FID-2026-0919-013
**Severity:** medium
**Status:** verified
**Created:** 2026-09-19
**YAGNI-Compliance:** Confirmed (Loop 3 — code-level allowlist clamp at the
single load point; per-deployment config surface deferred until an operator
asks)

---

## Summary

The capability gate checks the tool call against
`agentTemplate.toolNames` — the template's *own declaration*
(`pre-dispatch-gates.ts:50-56`; `native.ts:88` wires it from the template).
Templates can come from the agent database
(`templates/agent-registry.ts:21-85`: local → DB-cache →
`fetchAgentFromDatabase` fallback), so a remote/published agent definition
that declares `toolNames: ['write_file', 'run_terminal_command', …]` is
granted exactly those capabilities. `spawnableAgents` constrains *who may
spawn*; nothing clamps *what the spawned agent may touch* to a
operator-policy subset. "Declared" and "granted" are the same variable.

## Environment

- **OS:** all
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `packages/agent-runtime/src/tools/tool-executor/`
  (gate chain), `src/templates/agent-registry.ts`, `spawn-agent-resolution.ts`
- **Commit/State:** verified against live source 2026-09-19 (Task 66 audit)

## Detailed Description

### Problem

`pre-dispatch-gates.ts:50-56` (`createCapabilityGate`):

```typescript
!deps.declaredToolNames().includes(ctx.toolCall.toolName)
```

`tool-executor/native.ts:88`:

```typescript
declaredToolNames: () => agentTemplate.toolNames,
```

`agent-registry.ts` resolves templates with a database fallback for
publisher/agent-id formatted ids; the resulting template flows —
unclamped — into `spawn-agent-resolution.ts` → `createAgentState` → the
gate chain.

### Expected Behavior

Granted capabilities = declared tools ∩ operator policy. Database-sourced
templates are clamped at load time; the clamp is invisible to honest
templates.

### Evidence

```text
pre-dispatch-gates.ts:50-56    capability gate reads declaredToolNames
tool-executor/native.ts:88     deps wire = agentTemplate.toolNames
templates/agent-registry.ts:21-85  DB fallback template resolution
docs/security-audit-orchestrator-agent-flow.md  SEC-6 (verified 2026-09-19)
```

## Impact Assessment

### Affected Components

- `pre-dispatch-gates.ts` (gate), `native.ts` (wiring),
  `agent-registry.ts` (load path), `spawn-agent-resolution.ts`
- Any deployment where users can publish/install agent definitions

### Risk Level

- [x] Medium: requires a malicious or defective published template to be
  installed; then the template's own declaration is the only capability
  boundary (write/terminal tools ride on it)

## Proposed Solution

### Approach

1. Introduce `grantedToolNames(template)` in the load path:
   `declared ∩ POLICY_ALLOWLIST` where the policy allowlist defaults to
   "everything declared for bundled templates" but clamps database-sourced
   templates to a safe subset (read tools + explicitly operator-granted
   tools), configurable in `protocol.config.yaml`.
2. Gate reads granted names (deps unchanged — the wiring point feeds
   granted instead of declared).
3. Bundle regeneration for the config schema if required (template/config
   surfaces are grounding-embedded).
4. Tests: database template with write tools clamped; bundled templates
   unchanged; explicit operator grant restores full set.

Alternatives considered and rejected:

- *Ban database templates* — breaks the product feature; clamping
  preserves it with a boundary.
- *Per-spawn approval prompts* — bigger UX change; policy clamp is
  mechanical and testable now.

### Steps

1. [x] DONE — `templates/database-template-clamp.ts`: grantable-tool
   allowlist (read/search/output), always-stripped set (mutation,
   execution, network state-change, spawn), fail-closed on unknown names,
   `clampDatabaseTemplateCapabilities` wrapper (warns with stripped
   list).
2. [x] DONE — clamp applied at the single database load point
   (`agent-registry.ts` DB fallback, BOTH versioned and unversioned
   returns + cache); the gate's `declaredToolNames` now reads clamped
   values for DB templates with zero gate-code change (deps wiring
   unchanged — the value source is clamped upstream).
3. [x] DONE — `templates/__tests__/database-template-clamp.test.ts`
   (4 tests incl. end-to-end registry wiring: DB template clamped, local
   template untouched). Config schema deliberately NOT added (YAGNI —
   noted in the docblock); docblocks cite this FID.

### Verification

- Clamp unit tests green; gate-order characterization suite stays green;
  typecheck agent-runtime + cli; eslint; quality gate.

## Verification Gates

- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/templates/__tests__/database-template-clamp.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:fddc7f07981a4c1356a286b1ccac061b4c2a54683e13921da95148752be9fc54
- verified: 2026-09-19T04:04:02.264Z
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/templates/__tests__/database-template-clamp.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Declaration-equals-grant verified at the lines above; DB
  fallback path confirmed. Report SEC-6.
- **GREEN:** Policy clamp proposed. Not implemented; awaiting operator
  approval.
- **AUDIT:** Document-level double audit; evidence re-verified 2026-09-19.
- **ADVERSARIAL:** Does the clamp break legitimate published agents that
  need broad tools? They can be granted explicitly by the operator
  (config), which is the correct trust anchor. Is the default allowlist a
  denial-of-service on the marketplace feature? No — clamp is
  config-expandable; the default errs safe.
- **CHANGE DELTA:** n/a (document creation).

### Missed Questions

1. Clamp at registry load or gate time? → Load time: one clamp point, gate
   stays fast and dumb.
2. Versioned published ids (agent@1.0.0)? → Clamp applies identically;
   version does not change trust class.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** pending G2 (operator commit withheld; no silent
  deferral — presented at turn end)
- [x] **File:line ranges:** `templates/database-template-clamp.ts` (new),
  `templates/agent-registry.ts` (clamp at DB fallback),
  `templates/__tests__/database-template-clamp.test.ts` (new)
- [x] **Gate output:** receipt below — typecheck/test/quality all exit 0
- [x] **Reproducibility:** `bun test ./packages/agent-runtime/src/templates/__tests__/database-template-clamp.test.ts`
  → 4 pass / 0 fail
- [x] **Step statuses:** all 3 steps `implemented` (operator-approved
  2026-09-19; config surface deferred by YAGNI, not dropped)

### Code Verification Evidence

- [x] Files referenced in this FID exist and contain the quoted code
  (verified by read 2026-09-19)
- [x] Implementation matches Proposed Solution (clamp; Loop 2 audit)
- [x] Typecheck/tests/lint pass with pasted output (receipt below)
- [x] No production call-graph change proposed (clamp at existing load
  path; gate deps value source swapped)

### Loop 2 — Independent audit and self-correction

- **RED:** Declaration-equals-grant confirmed through the registry →
  resolution → gate chain; no clamp existed anywhere.
- **GREEN:** Implemented with one scope correction discovered during
  implementation: the clamp must ALSO cover the unversioned DB return
  path (the initial edit clamped only the versioned-cache branch), and
  the cache must store the clamped template (otherwise a cached unclamped
  copy could re-enter). Both fixed before audit.
- **AUDIT:** Static: typecheck agent-runtime exit 0; eslint 0; quality
  PASS; receipt gates exit 0. Manual re-read of the registry confirmed
  both DB returns and the cache write carry the clamped value; local
  template path has no clamp (by design, tested).
- **ADVERSARIAL:** (1) Legitimate published agents needing broad tools —
  operator grant path is the config extension noted as deferred; bundled
  templates unaffected. (2) MCP servers on DB templates — out of scope
  here (separate capability surface, honest candidate finding if the
  operator wants it FID'd). (3) Wildcard `browser_*` strip entry is
  prefix-shaped in a set membership check — ineffective for the wildcard
  itself; concrete names are individually listed, and unknown names fail
  closed anyway, so the gap is cosmetic (noted for cleanup).
- **CHANGE DELTA:** 1 new module (~110 lines); registry DB path clamps +
  caches clamped; 1 new test file (4 tests); no gate-code change.

### Loop 3 — Final convergence

- **RED:** Converged — grant/declare separation live at the load point.
- **GREEN:** Converged — clamp live for both DB paths (uncommitted,
  G2-pending).
- **AUDIT:** Converged — receipt gates exit 0; eslint 0; lint:md clean.
- **ADVERSARIAL:** Converged — three challenges resolved (one cosmetic
  wildcard entry honestly flagged).
- **CHANGE DELTA:** Final: see Loop 2; none after receipt stamp.

## Resolution

- **Closed Date:** pending G2 commit (operator authorization)
- **Fix Description:** Database-sourced templates are capability-clamped
  at the single load point (fail-closed on unknown tools; mutation/exec/
  network/spawn stripped; local templates untouched)
- **Tests Added:** `templates/__tests__/database-template-clamp.test.ts`
  (4 pass / 0 fail, incl. end-to-end registry wiring)
- **Verification Evidence:** receipt below
- **Archived:** pending G2 (moves to `dev/fids/archive/` with the commit)

## Lessons Learned

Self-declaration is not authorization. Where a capability check reads the
same field an untrusted source supplies, the check is a formality — grant
and declare must be different variables with a policy between them.
