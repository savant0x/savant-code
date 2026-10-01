# FID: Register packages/connectors in root manifests and validation chains

**Filename:** `FID-2026-0930-002-register-connectors-workspace.md`
**ID:** FID-2026-0930-002
**Severity:** low
**Status:** converged
> (`converged` is the correct pre-implementation status per
> FID-2026-0915-004; `fixed` is deprecated-but-accepted legacy language —
> do not use it for new FIDs. The receipt contract still keys to
> `fixed | verified` so archived records remain valid.)
**Created:** 2026-09-30 11:23
**Automation level:** 3
> (Authority this FID needs to be actioned **without asking**: `1` approval-gated,
> `2` within approved scope, `3` fully automatable. The session ceiling is
> `protocol.config.yaml` → `session.autonomy_level`; an item is actioned without
> approval only when its level is ≤ the session level. No level lifts the G-laws,
> credential handling, Law 3, or the project-directory boundary — see
> "Automation Levels" in the governing protocol.)
**YAGNI-Compliance:** Pending

---

## Summary

The new `packages/connectors` workspace (FID-2026-0930-001) will not be
covered by any repo gate until it is registered in the root manifest and the
validation chains: root `package.json` `workspaces` + `typecheck`/`test`
chains, `scripts/validation-gates.ts` `VALIDATION_WORKSPACE_POLICY`,
`scripts/validation-manifest.ts` expectations, and the protocol.config.yaml
gate commands that mirror the root scripts. This FID owns exactly those
registration edits and their parity evidence — it is deliberately separate
from the port so each change set stays logical-atomic (G3/G4) and the port
FID stays single-concern.

## Environment

- **OS:** Windows (win32, bash shell)
- **Language/Runtime:** TypeScript 5.5.4, Bun 1.3.14 (root `engines.bun`)
- **Tool Versions:** bun 1.3.11 types, markdownlint-cli 0.49.1
- **Commit/State:** working tree 2026-09-30, root `package.json` version
  0.0.34

## Detailed Description

### Problem

`VALIDATION_WORKSPACE_POLICY` (`scripts/validation-gates.ts:22-55`) is a
closed list of 14 entries; `packages/connectors` is absent. Consequences if
unregistered: (a) FID verification gates cannot declare
`- gate: typecheck packages/connectors` — `scripts/fid-verify.ts:94` rejects
any workspace not in the policy ("unsafe typecheck workspace"); (b) the root
`typecheck`/`test` chains skip the workspace, so the full-gate promise
("chains all 12 workspaces") silently does not cover it; (c)
`protocol.config.yaml` `commands.type_check`/`commands.test`, which mirror
the root scripts, drift from them.

### Expected Behavior

After registration: root chains and protocol config name
`packages/connectors` in the same style as sibling `packages/*` entries; the
policy list carries a `requiredTypecheck: true, requiredTest: true` entry;
`fid:verify` accepts gate declarations naming the new workspace; the
validator's gate-parity checks (workspacePolicy, command parity) pass with
the new entry consistent everywhere.

### Root Cause

Not a defect — a required integration step for any new workspace. Precedent:
`packages/knowledge-graph` and `packages/database` were added to all four
surfaces when created (their entries are present at
`scripts/validation-gates.ts:22-55` and in both chains).

### Evidence

```text
scripts/validation-gates.ts:22 — VALIDATION_WORKSPACE_POLICY opens; entries:
  agents, cli, common, desktop(requiredTypecheck:true/requiredTest:false),
  evals, savant-free(false/false), packages/agent-runtime,
  packages/design-systems, packages/code-map, packages/database,
  packages/knowledge-graph, packages/llm-providers, scripts/tmux(false/false),
  sdk. No packages/connectors entry exists (read 2026-09-30, 0-EOF).

package.json (root) typecheck chain: 12 `--cwd` legs + `typecheck:scripts`;
test chain: 12 `--cwd` legs. Neither names packages/connectors.

protocol.config.yaml commands.type_check mirrors the root typecheck script
verbatim (same 13 segments); commands.test mirrors the root test chain.

scripts/fid-verify.ts:94 — "unsafe typecheck workspace" rejection for
workspaces not in VALIDATION_WORKSPACE_POLICY.
```

## Impact Assessment

### Affected Components

- `package.json` (root: `workspaces` array + `typecheck` + `test` scripts)
- `protocol.config.yaml` (`commands.type_check`, `commands.test`)
- `scripts/validation-gates.ts` (`VALIDATION_WORKSPACE_POLICY`)
- `scripts/validation-manifest.ts` (only if it re-lists workspaces — checked
  at implementation; it imports from `validation-gates.ts`, so likely no edit)
- Downstream consumers of the root chains: `.githooks/pre-push` (lint +
  scan only — no chain edits needed), CI workflows that call `bun run
  typecheck` (inherit the new leg automatically).

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Low: Minor issue, cosmetic, or edge case
- [x] Medium: Feature degraded, workaround exists

(Medium only in the sequencing sense: registered before the workspace
exists, the chains go red — so the edit lands as step 7 of the port FID,
after the package typechecks. The workaround is ordering, which this FID
pins.)

## Proposed Solution

### Approach

Four edits, each mirroring an existing sibling entry byte-for-byte in style:

1. **Root `package.json` → `workspaces`:** insert
   `"packages/connectors",` after `"packages/code-map",` (mirroring the
   existing insertion style of the packages group).
2. **Root `package.json` → `typecheck` chain:** insert
   `&& bun run --cwd=packages/connectors typecheck` immediately after the
   `packages/knowledge-graph` leg and before the `packages/llm-providers`
   leg (verified anchor — the packages group in the live chain ends
   `...knowledge-graph && ...llm-providers && ...desktop && bun run
   typecheck:scripts`; appending at the chain end would strand the new leg
   after `desktop`, breaking sibling grouping).
3. **Root `package.json` → `test` chain:** insert
   `&& bun run --cwd=packages/connectors test` at the same anchor — after
   the `packages/knowledge-graph` leg, before `packages/llm-providers`.
4. **`scripts/validation-gates.ts`:** insert
   `{ workspace: 'packages/connectors', requiredTypecheck: true,
   requiredTest: true },` following the `packages/knowledge-graph` entry.
5. **`protocol.config.yaml`:** mirror edits 2–3 into `commands.type_check`
   and `commands.test`, keeping the mirror-verbatim property documented in
   that file's comments.

### Steps

1. Verify `packages/connectors/package.json` has `typecheck` and `test`
   scripts (port FID step 1) — this FID's precondition.
2. Apply edits 1–5 above.
3. Run `bun install` so the workspace links, then
   `bun run --cwd=packages/connectors typecheck` standalone.
4. Run root `bun run typecheck` (now 13 legs) and `bun run test` — full
   chains green.
5. Run `bun scripts/validate-repository.ts` — command-parity and
   workspace-policy checks green with the new entry.

### Verification

- `- gate: typecheck packages/connectors` — now a legal declaration;
  exit 0.
- Root chains green (pasted output at implementation).
- `validate:repository` parity green — proves the four surfaces agree.
- Law 4 (reachability) is satisfied by construction for manifest entries:
  the consumers are Bun itself (`workspaces` install graph) and the gate
  runners; grep evidence = the chain lines themselves.

Gate-declaration note: declared now as a forward contract while status is
`converged` (pre-implementation — outside the receipt contract by design,
`ENFORCED_VERIFICATION_STATUSES`); stamped via `fid:verify --write` at
implementation. `quality` is mandatory per the template's own rule (repo
history: `Task 58`). Probe-gate note: if no parity probe exists at
implementation time, it is authored as part of this FID — a small
standalone script asserting `packages/connectors` appears in all four
surfaces (root workspaces, both chains, the policy array; exit 0/1),
following `scripts/audit-gate-env-parity.ts` as the worked example. It
must NOT re-enter FID verification (no `validate:repository` invocation).

## Verification Gates

- gate: typecheck packages/connectors
- gate: probe scripts/__tests__/validation-manifest.parity-probe.ts
- gate: quality

## Perfection Loop

### Loop 1 — RED

- **RED:** Issues identified at authoring: (1) registering the workspace in
  any surface before the package typechecks would red the root chains —
  mitigated by explicit sequencing dependency on the port FID step 7; (2)
  `validation-manifest.ts` re-exports from `validation-gates.ts` — assumed
  no direct edit needed, verified at implementation (cheap check, wrong
  guess fails typecheck loudly); (3) `desktop` precedent shows policy
  entries may set `requiredTest: false` — rejected here: a TypeScript
  package with a test script must gate both ways (sibling packages/* all
  do).
- **GREEN:** Not applicable yet — plan converged; edits happen with the
  port's step 7.
- **AUDIT:** Document-level audit 2026-09-30: all five edit sites read
  0-EOF (root package.json, protocol.config.yaml commands block,
  validation-gates.ts policy array); the fid-verify rejection path cited
  from `scripts/fid-verify.ts:94`. Declared probe gate follows the
  allowlisted shape and the no-recursion rule (template, Verification
  Gates section).
- **ADVERSARIAL:** Strongest refutation attempt: "this could be folded into
  the port FID as one more step." Rebuttal: the port's gates cannot legally
  declare `typecheck packages/connectors` until THIS FID's policy edit
  lands — a cross-FID ordering edge; keeping the gate-infrastructure edit
  in its own record makes the ordering auditable and each commit
  independently revertible (G3/G4). Second attempt: "root chain churn
  breaks other agents' cached instructions" — the AGENTS.md text says
  "chains all 12 workspaces," which becomes stale; this FID's closure
  includes updating that count in AGENTS.md Validation notes if present
  (checked at implementation; documentation-only).
- **CHANGE DELTA:** 0% (initial authoring pass).

### Loop 2 — Independent audit and self-correction

- **RED:** Self-audit against the captured root-script text found two
  defects: (1) the typecheck-chain edit said "append before
  `typecheck:scripts`", which would place the new leg AFTER the `desktop`
  leg — outside the packages group; the verified anchor is immediately
  after the `packages/knowledge-graph` leg; (2) the workspaces-array note
  claimed the packages group is alphabetical — it is not
  (`design-systems` precedes `code-map`); the anchor
  ("after `packages/code-map`") is correct, the rationale word was wrong.
  This document also originally omitted the Loop 2/Loop 3 sections the
  template requires — added here.
- **GREEN:** Chain-insert wording re-anchored to the knowledge-graph leg
  with the live chain suffix quoted; rationale corrected; loops added.
- **AUDIT:** Root `package.json` typecheck/test chain order re-read from
  the file captured this session (legs: common, agents, sdk, cli, evals,
  agent-runtime, design-systems, code-map, database, knowledge-graph,
  llm-providers, desktop, typecheck:scripts); workspaces order verified
  from the same capture; `scripts/fid-verify.ts:94` policy rejection and
  `scripts/validation-gates.ts:22` policy list confirmed from captured
  reads.
- **ADVERSARIAL:** "Anchor churn — the chains may change before
  implementation." Rebuttal: the edit instruction names the SURROUNDING
  legs, so the anchor is re-verifiable at edit time from the file itself,
  not from this document; if the neighbors moved, the operator-visible
  rule is "inside the packages group," which no plausible chain edit
  removes.
- **CHANGE DELTA:** ~0.6% (under the 2% convergence threshold).

### Loop 3 — Final convergence

- **RED:** Full re-read found no further issues. Termination criterion
  met: deep audit yields ZERO actionable improvements → proceed to
  COMPLETE.
- **GREEN:** None required.
- **AUDIT:** All five edit sites identified with verifiable anchors; gates
  declared in allowlisted shapes; the probe gate carries the no-recursion
  rule (never invokes `validate:repository`).
- **ADVERSARIAL:** No residual challenge; the sequencing dependency on the
  port FID is recorded in three places (Risk Level, Steps precondition,
  Implementation Evidence) so it cannot be silently dropped.
- **CHANGE DELTA:** 0% — converged.

### Missed Questions

1. **Does `bun install` need to run before the chains?** Yes — a workspace
   dir not in the install graph fails `--cwd` resolution. Sequenced in step
   3.
2. **Do CI workflows pin the workspace count?** Checked at implementation
   via glob over `.github/workflows/*.yml` for the chain strings; any
   hard-coded count is updated in the same commit (none expected — the
   chains are invoked, not copied).
3. **Does the pre-push hook need the new workspace?** No —
   `.githooks/pre-push` runs the credential scan + eslint + lint:md over the
   repo, not the typecheck chain; eslint picks up new files automatically.
4. **What if `validate:repository` C3 re-runs this FID's own gates while
   the parity probe invokes it?** It must not — the probe reads the four
   files directly (string/AST assertion), never calls the validator. Stated
   in the gate note above.
5. **Which number does AGENTS.md's "12 workspaces" become?** 13 workspaces
   + `typecheck:scripts` leg; the doc update is part of this FID's edit set
   so the count never lies.

### Implementation Evidence (REQUIRED for `closed`)

- [ ] **Commit SHA:** pending implementation
- [ ] **File:line ranges:** pending implementation
- [ ] **Gate output:** pending implementation
- [ ] **Reproducibility:** pending implementation
- [ ] **Step statuses:** Steps 1–5 `blocked pending port-FID step 7` —
      none started; nothing deferred, nothing dropped.

### Code Verification Evidence

> Pre-implementation state verified 2026-09-30: policy array read 0-EOF at
> `scripts/validation-gates.ts:22-55` (no connectors entry); root chains
> read 0-EOF in `package.json` (no connectors leg); `protocol.config.yaml`
> commands mirror confirmed. Status `converged` reflects reality: no edits
> applied yet.

## Resolution

- **Closed Date:** — (open)
- **Fix Description:** —
- **Tests Added:** —
- **Verification Evidence:** —
- **Archived:** —

## Lessons Learned

(Provisional:) Gate infrastructure and feature code want separate FIDs — the
ordering edge between them (a feature gate that is illegal to declare until
the infrastructure lands) is exactly the kind of dependency that gets lost
inside a multi-concern record.
