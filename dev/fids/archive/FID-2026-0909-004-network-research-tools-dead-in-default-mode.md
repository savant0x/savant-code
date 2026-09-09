# FID: Network research tools are dead in the default permission mode

**Filename:** `FID-2026-0909-004-network-research-tools-dead-in-default-mode.md`
**ID:** FID-2026-0909-004
**Severity:** high
**Status:** closed
**Created:** 2026-09-09 13:27
**YAGNI-Compliance:** PASS (registry-honoring fix; no new machinery)

---

## Summary

In the default `prompt` permission mode, every network-classified tool —
`web_search`, `read_url`, `read_docs`, `gravity_index`, `deep_research` — is
rejected before execution. The sandbox engine's network gate returns `prompt`
for **all** network-effect tools regardless of their registry permission
class, and the executor's sandbox gate downgrades every `prompt` decision to
`deny` (the interactive approval modal is not yet implemented). The default
mode is therefore fully offline, and the only escape hatch — `unsafe` — also
disables the shell denylist, unknown-tool gating, and every other safety
surface. Research, a core documented product feature, silently degrades:
during this session a spawned researcher subagent burned its entire run
discovering the rejections one tool call at a time.

## Environment

- **OS:** Windows 11 (win32), Git Bash (MSYS)
- **Language/Runtime:** TypeScript 5.5.4 / Bun 1.3.14
- **Tool Versions:** savant-code v0.0.30 tree
- **Commit/State:** working tree at v0.0.30 post-cut, 2026-09-09

## Detailed Description

### Problem

Live incident (this session): a `researcher-web` subagent attempting
`deep_research`/`web_search` calls received, for every call:

```text
Tool `deep_research` requires approval: Tool `deep_research` requires network
access. Run with permission mode `unsafe` or re-run interactively when
supported.
```

Six consecutive rejections; the spawn produced zero research and ended with an
honest cannot-proceed report. The operator ruling: "network access should be
enabled by DEFAULT."

### Expected Behavior

The default (`prompt`) permission mode allows outbound read-only research
tools — the exact set the safety registry already classifies as
`effect: 'network', permission: 'allow'` — while continuing to gate
side-effectful tools (shell, SQL writes, external connection management) and
honoring `safe` as a fully offline mode.

### Root Cause

Three stacked defects, one per layer:

1. **Engine overrides its own registry.**
   `packages/agent-runtime/src/tools/sandbox/engine.ts:84-96` — the network
   gate consults only `policy.allowNetwork` and the mode; it never consults
   `safety.permission`, even though `common/src/tools/safety-registry-core.ts`
   already classifies all research tools as `permission: 'allow'` (outbound
   reads) vs e.g. `composio_manage_connections` as `permission: 'prompt'`
   (state-changing). Every network tool gets `prompt`.
2. **`prompt` downgrades to deny.**
   `packages/agent-runtime/src/tools/tool-executor/sandbox-gate.ts:74-84` —
   "Phase 1: no interactive TUI permission modal yet. Downgrade to deny."
   So `prompt` (the default) is indistinguishable from `deny` for every
   gated tool.
3. **Headless/gateway hardcode the stricter mode.**
   `cli/src/headless-run.ts:220` and
   `cli/src/server/gateway/default-run-prompt.ts:76` hardcode
   `permissionMode: 'safe'` — fully offline even where the default would
   apply.

The default is set at `cli/src/utils/settings/preferences.ts:34`
(`?? 'prompt'`) and threaded via the chat store → run config → SDK →
agent-runtime `fileContext` (subagents inherit).

### Evidence

```text
# Default mode:
cli/src/utils/settings/preferences.ts:34   loadSettings().permissionMode ?? 'prompt'
# Engine network gate (no permission-class consult):
packages/agent-runtime/src/tools/sandbox/engine.ts:84-96
# Prompt→deny downgrade:
packages/agent-runtime/src/tools/tool-executor/sandbox-gate.ts:74-84
# Hardcoded offline modes:
cli/src/headless-run.ts:220                 permissionMode: 'safe'
cli/src/server/gateway/default-run-prompt.ts:76  permissionMode: 'safe'
# Registry already encodes the taxonomy:
common/src/tools/safety-registry-core.ts (web_search/read_url/read_docs/
#   gravity_index/deep_research = network+allow;
#   composio_manage_connections = network+prompt)
# The defect is pinned by its own test:
packages/agent-runtime/src/tools/sandbox/__tests__/engine.test.ts
  'prompts for network tools in prompt mode'  ← asserts the broken behavior
# Adjacent symptom — the self-improving ledger cannot classify failures
# (36/36 records carry one generic error line; read_url failures recur ×8):
dev/experiences/raw-traces.jsonl
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/tools/sandbox/engine.ts` (network gate)
- `packages/agent-runtime/src/tools/sandbox/__tests__/engine.test.ts`
- `cli/src/headless-run.ts`, `cli/src/server/gateway/default-run-prompt.ts`
- `cli/src/commands/defs/chat-permissions.ts` (`/permissions` copy)
- `cli/src/utils/settings/types.ts`, `sdk/src/run/types.ts` (doc comments)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken (all research tooling) in the default mode;
      workaround (`/permissions unsafe`) exists but dismantles the entire
      sandbox — not a safe workaround.
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Make the engine honor the safety registry it already serves. Inside the
existing `effect === 'network'` gate (after the `allowNetwork` deny, before
the prompt return): network tools with `permission: 'allow'` pass when
`policy.allowNetwork` is true; network tools with `permission: 'prompt'`
keep today's prompt path. `safe` (allowNetwork=false) stays fully offline;
`unsafe` still short-circuits the whole engine before this gate; the shell
denylist and unknown-tool branches are different effect classes and remain
untouched. Then flip the two hardcoded `safe` call sites to `prompt` —
a strict capability superset (`safe` + exactly the seven outbound reads;
shell and side effects still denied) — and make every piece of user-facing
copy honest.

Result by mode × tool class:

| Tool class | `safe` | `prompt` (default) | `unsafe` |
|---|---|---|---|
| Outbound research reads (network+allow) | deny (offline) | **allow** | allow |
| State-changing network (network+prompt) | deny | prompt→deny | allow |
| Shell (denylist-gated), unknown/MCP | deny/gated | prompt→deny | allow |

**Security (Five Questions #3, honest):** `safe` is unchanged. The new
residual surface in the default mode is prompt injection via fetched content
— research reads can return hostile instructions. This risk already exists in
`unsafe` mode and matches the industry norm (leading coding agents ship
web-read enabled by default); compensations already present: `read_url` is
SSRF-guarded (pre-fetch host/resolved-IP validation), search/catalog tools hit
fixed vendor endpoints, provenance receipts attribute reads, and the
Adversary role exists for hostile-content review. The shell denylist,
side-effect gating, and unknown-tool gating are untouched by this change.
Adjacent debt (out of scope, cross-referenced): the interactive approval
modal is still unimplemented — `run_terminal_command` downgrades to deny
even in interactive sessions; `/permissions` copy must not over-promise
interactivity.

### Steps

1. `engine.ts` — insert the permission-class consult in the network gate
   (network+allow → allow when allowNetwork; network+prompt unchanged) +
   update the `createDefaultSandboxPolicy` doc comment.
2. `engine.test.ts` — flip 'prompts for network tools in prompt mode' to
   'allows…' (web_search, prompt mode); add a pin that
   `composio_manage_connections` (network+prompt) still prompts in prompt
   mode; safe/unsafe pins unchanged.
3. `headless-run.ts` + `default-run-prompt.ts` — `permissionMode: 'safe'` →
   `'prompt'` with comments stating the new headless contract (research
   reads on; side effects still denied — no interactive approver exists).
4. Honest copy: `chat-permissions.ts` mode descriptions;
   `settings/types.ts` + `sdk/src/run/types.ts` doc comments.
5. Grep sweep for stray fixtures pinning the old deny (mechanical gate, per
   Missed Question 4) and for any other hardcoded `permissionMode: 'safe'`
   production call sites.
6. Close per ceremony: status → closed, archive move, CHANGELOG entry,
   path-scoped atomic commit (G1–G4, G8).

### Verification

Focused suites + typecheck ×4 + eslint on every changed file, then the
declared gates below (receipt-stamped via `bun run fid:verify --write`,
live-re-run by `validate:repository`).

## Verification Gates

- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: typecheck cli
- gate: typecheck sdk
- gate: test packages/agent-runtime/src/tools/sandbox/__tests__/engine.test.ts
- gate: test packages/agent-runtime/src/__tests__/tool-executor-sandbox.test.ts
- gate: test cli/src/commands/__tests__/permissions-command.test.ts

### Verification Receipt

- fingerprint: sha256:69dbf17fbde1013eef5bde86e2a11ef11fb0a2d7757e4231f0d8f73832680b21
- verified: 2026-09-09T19:24:21.913Z
- typecheck common: exit 0
- typecheck packages/agent-runtime: exit 0
- typecheck cli: exit 0
- typecheck sdk: exit 0
- test packages/agent-runtime/src/tools/sandbox/__tests__/engine.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/tool-executor-sandbox.test.ts: exit 0
- test cli/src/commands/__tests__/permissions-command.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED (2026-09-09)

- **RED:** Full evidence chain cataloged above — engine network gate
  (engine.ts:84-96) overrides the registry taxonomy; prompt→deny downgrade
  (sandbox-gate.ts:74-84); default 'prompt' (preferences.ts:34); headless +
  gateway hardcode 'safe'; live researcher-web incident (6 rejections, zero
research); defect pinned by its own test; adjacent symptom: 36/36
  experience records carry one generic error line (separate finding —
  disposition recorded in Missed Question 7).
- **GREEN (design, converged):** registry-honoring network gate + headless/
  gateway flips + honest copy + test flip/pins. Thinker verdict: SOUND with
  three mandatory adjustments — (A) document the residual content-injection
  surface honestly (folded into Proposed Solution above); (B) /permissions +
  settings/sdk copy must state research-reads-on / side-effects-denied /
  interactive-approval-still-Phase-2 (folded into Steps 3-4); (C) add the
  mechanical grep sweep (folded into Step 5).
- **AUDIT (Verifier, 2026-09-09):** 9 PASS / 3 FAIL / 1 NEEDS-REVIEW.
  PASSes: the engine change matches the design exactly (consult after the
  effect check, inside the network gate only); safe-mode deny precedes the
  permission consult; unsafe short-circuit preserved by diff-containment;
  the two new test pins are behavioral, not tautological; the headless
  strict-superset claim holds on the visible machinery; receipt sequencing
  understood. FAILs: (1) a systematic first-line dedent across all 7
  str_replace targets — eslint has no indent rule so it passed, but
  prettier (a hard pre-push gate) was never run and would fail; (2) the
  evals/v2 non-flip decision was promised in GREEN prose but never
  recorded in the FID; (3) the 36/36 adjacent-finding pointer dangled at
  Missed Question 6. NEEDS-REVIEW: the mechanical graph-index Law-4 check
  returned no-match (stale index).
- **ADVERSARIAL (2026-09-09):** verdict STANDS — all three FAILs
  CONFIRMED (prettier remediated; two record gaps); the NEEDS-REVIEW
  REFUTED by direct read (engine.ts consults permissionMode only at :28
  policy construction, :52 unsafe short-circuit, :61 safe generic deny,
  :81 denylist branch — no generic prompt-mode branch exists; the textual
  grep chain is adequate Law-4 evidence). All security PASSes re-confirmed
  against the live files; the evals decision STRENGTHENED
  (evals/v2/src/runner.ts:131 pins `permissionMode?: 'safe'` at the type
  level — offline by construction, not oversight). Two non-blocking
  omissions: an archived research doc's prompt→deny claim is now partially
  stale (point-in-time snapshot, acceptable); the sdk/src/run/types.ts
  JSDoc glue wart on the permissionMode union is pre-existing, not
  introduced by this diff.
- **CHANGE DELTA:** closure pass ≈ 9% of the record (within the 10% cap).

### Missed Questions

1. *Is any network+allow tool NOT a safe outbound read?* No — the set is
   exactly {web_search, read_url, read_docs, gravity_index, deep_research,
   composio_search_tools, composio_get_tool_schemas}; all query fixed
   public/catalog endpoints. The one state-changing network tool
   (composio_manage_connections) is network+prompt and stays gated.
2. *Does the new branch shadow the denylist or unknown-tool branches?* No —
   the change is scoped inside `effect === 'network'`; shell tools are
   `effect: 'mixed' | 'shell'` and reach their own branches; `unsafe` still
   short-circuits before the network gate. Condition honored: the
   permission-class consult stays AFTER the effect check.
3. *Is headless `prompt` a regression vs `safe`?* No — strict capability
   superset (`safe` + the seven outbound reads). Nothing previously allowed
   becomes denied; headless stays shell-less and side-effect-free.
4. *Does any fixture pin the broken deny?* The one pin
   ('prompts for network tools in prompt mode') is the defect itself and is
   flipped by design; deny fixtures use `safe` (unchanged); evals assert
   answers, not permissions. Mechanical sweep added as Step 5.
5. *Security posture change?* Safe mode unchanged; residual new surface =
   content injection via fetched pages (documented above, not papered over);
   SSRF guard on read_url verified as a real pre-fetch validation class.
6. *Subagent inheritance?* Unchanged mechanism (fileContext threading);
   spawned researchers gain exactly the outbound-read set. Adjacent debt
   flagged: interactive shell-approval modal (Phase 2) — out of scope.
7. *Disposition of the adjacent 36/36 generic-error finding (audit
   finding 3 — the original pointer here dangled at MQ6):* **Out of
   scope for this FID; surfaced as finding 1 of the 2026-09-09 harness
   exploration report; candidate for its own FID.** Root cause:
   `packages/agent-runtime/src/tools/tool-executor/result-lifecycle.ts:244`
   hardcodes `errorMessage: 'tool result contains an error'` for the
   soft-failure hook path even though the real error text is in scope in
   `toolResult.content`; the dedup key
   (`sha256(toolName + NUL + errorFirstLine)`,
   `common/src/util/experiences.ts`) therefore collapses every failure of
   a tool into one bucket. Not absorbed into this change — no
   experience-capture file is in the commit.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** `4b03e9b` (path-scoped: the 7 code files; docs/FID
      ride the tree per the FID-001 same-day closure precedent)
- [x] **File:line ranges:**
      `packages/agent-runtime/src/tools/sandbox/engine.ts:18-30` (policy
      doc comment), `:87-104` (network gate consult);
      `packages/agent-runtime/src/tools/sandbox/__tests__/engine.test.ts:97-116`
      (flipped + new pins);
      `cli/src/headless-run.ts:219-223`;
      `cli/src/server/gateway/default-run-prompt.ts:75-79`;
      `cli/src/commands/defs/chat-permissions.ts:16-20`;
      `cli/src/utils/settings/types.ts:11-17`;
      `sdk/src/run/types.ts:153-159`.
- [x] **Gate output:** fid:verify 7/7 exit 0 (typecheck common,
      agent-runtime, cli, sdk + engine 18/0, tool-executor-sandbox 2/0,
      permissions 6/0); post-remediation battery: 26/26 across the three
      suites, prettier --check clean ×7, eslint --max-warnings 0 ×7,
      typecheck ×4 exit 0.
- [x] **Reproducibility:** the changed branch is grep-findable
      (`safety.permission === 'prompt'` inside `safety.effect === 'network'`
      at engine.ts:91-98; `permissionMode: 'prompt'` at headless-run.ts:223
      and default-run-prompt.ts:79); production reachability chain:
      pre-dispatch-gates.ts:156 + custom.ts:157 thread
      fileContext.permissionMode → sandbox-gate.ts → engine.
- [x] **Step statuses:**
      Step 1 — implemented; Step 2 — implemented; Step 3 — implemented;
      Step 4 — implemented; Step 5 — implemented (sweep result: remaining
      `'safe'` sites = 2 type unions + 2 intentional safe-mode fixtures;
      evals/v2 deliberately unchanged — `evals/v2/src/runner.ts:131` pins
      `permissionMode?: 'safe'` at the type level and
      `evals/v2/src/runners/savant.ts:69` defaults to `'safe'`, so the
      benchmark harness is offline by construction; widening it would
      shift benchmark baselines and require a RunnerConfig type change —
      out of scope); Step 6 — implemented (this closure).

### Code Verification Evidence

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence is present for new or repaired wiring
- [x] FID status reflects the actual implementation state

## Resolution

- **Closed Date:** 2026-09-09 15:21
- **Fix Description:** the sandbox engine's network gate now honors the
  safety registry's permission class — outbound-read research tools
  (network+allow) run in the default `prompt` mode while state-changing
  network tools keep the approval path; headless + gateway runs moved to
  `prompt` (strict capability superset of `safe`); `/permissions` copy and
  settings/SDK doc comments updated to the honest contract. `safe` stays
  fully offline; `unsafe` unchanged.
- **Tests Added:** 2 pins in `engine.test.ts` — 'allows network+allow
  research tools in prompt mode' (web_search → allow) and 'still prompts
  for network+prompt tools in prompt mode' (composio_manage_connections
  → prompt).
- **Verification Evidence:** receipt re-stamped at the archived path
  (fid:verify 7/7 exit 0); audit battery: Verifier 9 PASS / 3 FAIL → all
  three remediated/recorded; Adversary confirmed the verdict and
  re-confirmed every security PASS against live files.
- **Archived:** 2026-09-09 15:21

## Lessons Learned

A permission ladder needs a rung for "read the world, touch nothing." When
the engine overrides its own registry's permission classes, the registry
becomes documentation, not policy — and the only escape hatch that works
doubles as a self-destruct. Also: a `prompt` mode that silently downgrades
to `deny` is a denial-of-service against the default experience; until the
approval modal exists, the default mode must route the safe-by-class tools
around the dead rung.