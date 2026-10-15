# Security Audit — Orchestrator → Agent Information Flow

**Date:** 2026-09-18
**Scope:** Information flow from the Orchestrator to all spawned agents; credential and
secret handling across that flow; trust boundaries at spawn, tool-execution, and
logging time.
**Method:** Static read of the runtime source tree (`packages/agent-runtime/src`,
`sdk/src`, `cli/src/utils/logger`, `common/src/crypto`) with call-graph verification of
the dispatch path. No code was modified.

---

## 1. Verified dispatch flow

Every tool call — Orchestrator or subagent — traverses one path:

```text
run-programmatic-step/execute-tool-calls.ts:116  executeToolCall()
  → tools/tool-executor/native.ts                parse → gate chain → dispatch
  → tools/tool-executor/gate-chain.ts            buildGateChain() — ORDER IS LOAD-BEARING
      1. pre-dispatch-gates.ts  createParseErrorGate      (C1: before any input deref)
      2. pre-dispatch-gates.ts  createCapabilityGate      (agent's declared toolNames)
      3. pre-dispatch-gates.ts  createWriteAndFsmGate     (containment + FSM phase)
      4. pre-dispatch-gates.ts  createSandboxGate         (permission-mode policy)
      5. ehel-gate.ts           createEhelGate            (ECHO Laws 1/3/7/8 — unconditional)
      6. hook-gate.ts           createHookGate           (PreToolUse, additional gate)
      7. hook-gate.ts           createProvenanceGate     (ZTAP enforce fail-closed)
  → handlers/tool/<tool>.ts                      handler executes
  → result-lifecycle.ts                          receipt + trace + cost
```

Spawn path:

```text
handlers/tool/spawn-agents.ts         handleSpawnAgents
  → spawn-agents-child-run.ts         runSingleSubagent
      → spawn-agent-resolution.ts     resolveSpawnableAgent (spawnableAgents allowlist)
      → spawn-agent-utils.ts          withParentModel (model + providerOptions inheritance)
                                     createAgentState (message-history inheritance)
      → execute-subagent.ts           executeSubagent → child step loop
```

**Call-graph verification (Law 4):** `executeToolCall` is reached from
`run-programmatic-step/execute-tool-calls.ts:116` (grep-confirmed); the gate chain is
assembled in `gate-chain.ts:buildGateChain` and consumed by `native.ts`. Both are live
production paths, not dead code.

---

## 2. Findings

### SEC-1 — HIGH: full process environment handed to every spawned shell

**Evidence:**
`sdk/src/tools/run-terminal-command.ts:44`

```typescript
const processEnv = {
  ...getSystemProcessEnv(),
  ...(env ?? {}),
} as NodeJS.ProcessEnv
```

`sdk/src/env.ts:50`

```typescript
export const getSystemProcessEnv = (): NodeJS.ProcessEnv => {
  return process.env
}
```

**Impact:** `process.env` carries every provider credential the CLI resolved —
`SAVANT_CODE_API_KEY`, `INFERENCE_API_KEY`, `TOKENROUTER_API_KEY`,
`TOKENHARBOR_API_KEY`, `NVIDIA_API_KEY`, `CLOUDFLARE_API_TOKEN`,
`COMMAND_CODE_API_KEY`, `BYOK_OPENROUTER_API_KEY`, and the ChatGPT OAuth token env
override (all enumerated in `sdk/src/env.ts`). Every `run_terminal_command` and
`run_readonly_command` child shell inherits all of them.

**Threat:** an agent that reads a malicious file, or a prompt-injected instruction,
runs `env` (or `printenv`, which is not on any denylist) and the secrets are in the
tool result, in message history, and therefore visible to every downstream subagent
that inherits history (see SEC-2). Same for `cli/src/commands/router/bash.ts:55`.

**Remediation:** resolve an explicit allowlist of env vars the child shell needs
(`PATH`, `HOME`, `SystemRoot`, `MSYS`, `LANG`, plus the SDK's own binary-path vars),
or scrub the credential blocklist keys before spawning.

### SEC-2 — HIGH: unbounded message-history inheritance propagates injected content to all children

**Evidence:**
`packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts` — `createAgentState`:

```typescript
if (agentTemplate.includeMessageHistory) {
  messageHistory = filterUnfinishedToolCalls(parentAgentState.messageHistory)
  …
}
```

**Impact:** any tool result — `read_files` of a hostile repo, `read_url` of an
attacker-controlled page, web-search snippets — becomes part of the parent's history
and is then handed verbatim to every child whose template opts into
`includeMessageHistory`. There is no content quarantine, no role-tagging of
untrusted tool output, and no sanitization at the spawn boundary.

**Threat:** classic indirect prompt injection. A repo file or fetched page containing
`<instructions>` framing can steer a downstream agent that trusts its inherited
context as agent-originated. The only filtering applied is
`filterUnfinishedToolCalls` (structural, not semantic).

**Remediation:** tag tool-result messages with a provenance role (`tool_result` /
`untrusted`) and instruct models in the system prompt that tool output is data, never
instructions; consider a sanitizing boundary for agents with write capability.

### SEC-3 — MEDIUM: `2>&1` waives the entire metacharacter scan in `run_readonly_command`

**Evidence:**
`packages/agent-runtime/src/tools/handlers/tool/readonly-command-validation.ts`:

```typescript
const WINDOWS_STDERR_REDIRECT_REGEX = /\b2>nul\b|\b2>&1\b/
…
if (
  hasUnquotedForbiddenMetachar(segment) &&
  !WINDOWS_STDERR_REDIRECT_REGEX.test(segment)   // ← whole-segment waiver
) {
  return { valid: false, reason: 'Command contains forbidden shell metacharacters…' }
}
```

**Impact:** the regex is tested against the *whole segment*, so a command containing
`2>&1` **anywhere** gets its metacharacter violation forgiven — including unquoted
`>`, `$(`, backticks, and `;`. Worked example, all accepted by
`isReadonlyCommand` in **every FSM phase** (read-only tools are deliberately not
phase-gated — `pre-dispatch-gates.ts` "run_readonly_command is intentionally NOT
gated here"):

- `cat .env > /tmp/exfil.txt 2>&1` — arbitrary file write outside project root, via
  the read-only tool, bypassing `runWriteGate`'s path containment entirely (shell
  redirection is invisible to `resolveAndContain`).
- `echo $(cat .env) > out 2>&1` — full command substitution.

I confirmed this by reading the validation path, not by executing it.

**Threat:** a "read-only" tool becomes an arbitrary-write and arbitrary-execution
primitive, in `idle` phase, with no sandbox review. The denylist architecture
(`DESTRUCTIVE_COMMAND_REGEX`, `DANGEROUS_COMMAND_REGEX`) is bypassed because the
offending operators are forgiven, not because the commands are allowed.

**Remediation:** scope the Windows-redirect exemption to the matched span only
(replace the substring, then re-scan the remainder), or require `2>&1` to be the
segment's terminal tokens.

### SEC-4 — MEDIUM: secret redaction is key-name-based only; secret *values* pass through

**Evidence:**
`cli/src/utils/logger/sanitize.ts`:

```typescript
const SENSITIVE_KEYS = new Set([
  'authToken', 'apiKey', 'api_key', 'token', 'accessToken',
  'refreshToken', 'secret', 'password', 'authorization',
])
…
if (isSensitiveKey(key) && typeof val === 'string') {
  result[key] = '[REDACTED]'
}
```

`cli/src/utils/logger/sink.ts` — for `error`/`fatal` levels, raw data ships to remote
telemetry:

```typescript
const includeRawData =
  fullTelemetry || level === 'error' || level === 'fatal'
```

**Impact:** redaction fires only when the *key* looks sensitive. Secrets riding under
`stdout`, `message`, `content`, `command`, `input`, or `value` — the exact fields that
carry `env` output, file contents, and shell commands — are shipped verbatim. And
error-level logs send raw payloads to both PostHog and the Axiom `/api/logs` sink.
SEC-1's `env` leak, once logged at error level, becomes a remote secret disclosure.

The over-redaction tradeoff (`tokenCount` gets redacted) is documented and accepted;
the gap is the under-redacted half of the domain.

**Remediation:** add a value-shape pass (high-entropy / known-token patterns) for the
fields known to carry command output and file content before the telemetry fan-out.

### SEC-5 — MEDIUM: ZTAP `record` mode silently drops receipts on signing failure

**Evidence:**
`packages/agent-runtime/src/provenance/session.ts` — `recordWriteReceipt`:

```typescript
} catch (error) {
  if (this.mode === 'enforce') {
    throw error                     // fail closed
  }
  this.emitNotice(`receipt signing failed for ${receiptPath}: ${String(error)}`)
  return null                       // ← record mode: write proceeds, no receipt
}
```

`protocol.config.yaml` ships `provenance.mode: 'record'` — the default for every run.

`spawn-agents-child-run.ts` — verdict binding failures are swallowed with no surface:

```typescript
.catch(() => {
  // Best-effort: a failed binding never fails the spawn.
})
```

**Impact:** in the default mode, any signing failure produces an unaudited write with
only a `console.warn`. The audit trail is only fail-closed when an operator opts into
`enforce`. Verdict-binding failures produce no parent-visible signal at all, so a
missing audit binding is invisible to the Orchestrator.

**Positive:** key custody is well done — the session seed is memory-only, never
serialized, and redefined non-enumerable so an accidental `JSON.stringify` of the
session cannot leak it (`session.ts` constructor + `common/src/crypto/keys.ts`).
Credentials at rest are `0600` in a `0700` dir (`sdk/src/credentials.ts`,
FID-2026-0802-008 SEC1).

**Remediation:** surface receipt/verdict signing failures to the parent as an
advisory (not a block) so the audit gap is visible; consider `enforce` for
release-path runs.

### SEC-6 — MEDIUM: agent templates self-declare their own capabilities

**Evidence:**
`pre-dispatch-gates.ts` — `createCapabilityGate`:

```typescript
!deps.declaredToolNames().includes(ctx.toolCall.toolName)
```

where `declaredToolNames: () => agentTemplate.toolNames`.

`spawn-agent-resolution.ts` — `resolveSpawnableAgent` loads templates via
`getAgentTemplate`, which consults `localAgentTemplates` **and**
`fetchAgentFromDatabase` (remote agent definitions).

**Impact:** the capability allowlist is the template's own `toolNames` declaration. A
remote/database agent definition that declares `toolNames: ['write_file',
'run_terminal_command', …]` is granted those capabilities — the gate does not clamp
database-sourced templates to a policy subset. The `spawnableAgents` allowlist
correctly constrains *who* may spawn; it does not constrain *what* the spawned agent
may touch.

**Remediation:** clamp database-sourced templates to a policy allowlist at load time,
separating "declared tools" from "granted tools."

### SEC-7 — LOW: `unsafe` permission mode bypasses the destructive denylist entirely

**Evidence:**
`packages/agent-runtime/src/tools/sandbox/engine.ts`:

```typescript
if (policy.permissionMode === 'unsafe') {
  return { type: 'allow' }   // ← runs BEFORE the destructive-pattern denylist
}
```

`sandbox-gate.ts`:

```typescript
if (isDevOverride) {
  return false   // ← bypasses the whole sandbox evaluation
}
```

**Impact:** `unsafe` mode returns `allow` before the `findDestructivePattern`
denylist (`rm -rf /`, `curl | sh`, fork bombs, `dd` to a device) is consulted. The
dev-mode bypass skips sandbox evaluation with only a `debug`-level log
(`pre-dispatch-gates.ts`). Both are operator-facing escape hatches, but neither
preserves the destructive-command floor.

**Remediation:** evaluate the destructive denylist unconditionally, then apply the
mode/dev override — the denylist should be a floor, not a policy input.

---

## 3. What is working well (defense in depth)

| Control | Location | Assessment |
|---|---|---|
| Gate-chain order pinned by characterization suite | `tool-executor-gate-order.test.ts` | Reordering a gate is caught by tests, not just review |
| Path containment runs for **every** write, incl. dev mode | `write-gate.ts` (F3) | `resolveAndContain` precedes the FSM check |
| Symlink realpath rewriting | `write-gate.ts` (F2) | Canonical form written downstream |
| Law 1 read-before-write with canonical-path compare | `pre-write-gates.ts` | Survives any path spelling of the same file |
| `apply_patch` nested `operation.path` handled | `pre-write-gates.ts:getTargetPath` | Would otherwise silently bypass Law 1/7 (FID-2026-0820-014 EC-2) |
| ZTAP key custody | `crypto/keys.ts`, `provenance/session.ts` | Memory-only, non-enumerable, never logged |
| Credentials at rest | `sdk/src/credentials.ts` | `0600` file, `0700` dir |
| `data_collection: 'deny'` survives model inheritance | `spawn-agent-utils.ts:withParentModel` | Privacy flag not dropped when the parent spawns infra helpers |
| Spawn fan-out + depth limits | `spawn-agents.ts`, `createAgentState` | `MAX_SUBAGENT_FAN_OUT` / `MAX_SUBAGENT_DEPTH` enforced |
| Recorder stall relay guard | `spawn-agents.ts` | A no-write "done" cannot relay as a silent pass |
| Handler exception containment | `native.ts` (FID-2026-0802-005 C2) | A throwing handler surfaces as a tool error, never a run failure |
| Abort gate before dispatch | `native.ts` (FID-2026-0802-005 H7) | No orphaned tool_calls enter history after abort |

---

## 4. Severity summary

| ID | Severity | One-line |
|---|---|---|
| SEC-1 | **HIGH** | Full `process.env` (all provider keys) inherited by every spawned shell |
| SEC-2 | **HIGH** | Tool results inherit into all children verbatim — indirect prompt injection with no boundary |
| SEC-3 | **MEDIUM** | `2>&1` anywhere in a command waives the whole metacharacter scan → arbitrary write/exec via the read-only tool, any phase |
| SEC-4 | **MEDIUM** | Redaction is key-name-only; secret values under `stdout`/`command`/`content` ship to PostHog + Axiom |
| SEC-5 | **MEDIUM** | Default `record` mode silently drops audit receipts on signing failure |
| SEC-6 | **MEDIUM** | Capability gate trusts the agent template's own `toolNames` — including database-sourced templates |
| SEC-7 | **LOW** | `unsafe`/dev bypass skips the destructive-command denylist entirely |

## 5. Recommended fix order

1. **SEC-3** — smallest change, highest bypass leverage (arbitrary write in `idle`
   phase today). Scope the Windows-redirect exemption to the matched span.
2. **SEC-1** — env allowlist for spawned shells; removes the largest single disclosure
   surface and starves SEC-4's telemetry path at the source.
3. **SEC-4** — value-shape redaction on command-output fields before the telemetry
   fan-out.
4. **SEC-2** — provenance-tag tool results as untrusted data; a design decision worth
   operator input before implementation.
5. **SEC-6 / SEC-5 / SEC-7** — policy hardening, no runtime behavior change.

Each finding above is a candidate for a FID under `dev/fids/` if you want them
tracked through the Perfection Loop rather than fixed inline. None have been
implemented — this report is analysis only.

---

## 6. Verification appendix (2026-09-19, single-agent ECHO session)

**Status:** all seven findings were independently re-verified against the
live tree on 2026-09-19 — every quoted snippet and line reference matched
the source verbatim. All seven are now FID-tracked (Task 66, SCOPE.md);
none are implemented yet.

### 6.1 FID mapping

| Finding | FID | Status (updated 2026-09-19) |
|---|---|---|
| SEC-1 env leak | `dev/fids/FID-2026-0919-008-sec1-env-leak-to-spawned-shells.md` | **verified** — implemented (env allowlist, both spawn sites) |
| SEC-2 history inheritance | `dev/fids/FID-2026-0919-009-sec2-untrusted-history-inheritance.md` | **risk accepted** — layer 3 declined by operator 2026-09-19 (recorded in FID); layers 1-2 available on request |
| SEC-3 redirect waiver | `dev/fids/FID-2026-0919-010-sec3-readonly-redirect-waiver.md` | **verified** — implemented (span-scoped waiver) |
| SEC-4 telemetry values | `dev/fids/FID-2026-0919-011-sec4-telemetry-secret-value-pass-through.md` | **verified** — implemented (value-shape masking) |
| SEC-5 receipt drop | `dev/fids/FID-2026-0919-012-sec5-record-mode-silent-receipt-drop.md` | **verified** — implemented (signing_failed event + counter) |
| SEC-6 self-declared caps | `dev/fids/FID-2026-0919-013-sec6-template-self-declared-capabilities.md` | **verified** — implemented (load-time clamp) |
| SEC-7 denylist bypass | `dev/fids/FID-2026-0919-014-sec7-unsafe-mode-skips-destructive-denylist.md` | **verified** — implemented (unconditional floor) |

### 6.2 Verification notes (deltas and confirmations)

1. **SEC-1 confirmed with one addition.** `cli/src/commands/router/bash.ts:54-57`
   reads `getSystemProcessEnv()` and passes the FULL env as the explicit
   `env` argument to `runTerminalCommand`. Because that argument lands in
   the *override* layer of the spawn-site merge, fixing only the sdk spread
   site would NOT stop the leak through this router — FID-008's GREEN
   covers both sites (allowlist at spawn + router routed through it).
2. **SEC-2 confirmed with an amplifier note.** `spawn-agent-inline.ts:135-140`
   forces `includeMessageHistory: true` for inline agents, and
   `spawn-agent-utils.ts:184-192` (FID-2026-0824-026) re-splices raw tool
   evidence into inherited history for audit agents. Both widen the
   untrusted channel; the FID preserves the audit guarantee while adding
   provenance tagging + advisory scanning. Layer 3 (sanitize-before-
   inheritance for write-capable children) is explicitly an operator
   design decision.
3. **SEC-3 confirmed at `readonly-command-validation.ts:16` and `:187-190`**
   (whole-segment test). The worked example was constructed but NOT
   executed — no file was written during this audit.
4. **SEC-4 confirmed at `sanitize.ts:8-14/26-32` and `sink.ts:146-151` +
   `185-198`** (PostHog and Axiom share the error/fatal raw-ship policy).
5. **SEC-5 confirmed at `provenance/session.ts:169-179` and the two empty
   binding catches** (`spawn-agents-child-run.ts:284-286`,
   `spawn-agent-inline-verdict.ts:59-61`). Key-custody positives
   re-confirmed as described in §3.
6. **SEC-6 confirmed end-to-end:** `agent-registry.ts:21-85` resolves
   database-sourced templates (local → DB-cache → `fetchAgentFromDatabase`)
   and `native.ts:88` feeds the template's own `toolNames` to the
   capability gate. No clamp exists anywhere on the path.
7. **SEC-7 confirmed at `engine.ts:52-54` (early allow) vs `:78`
   (denylist) and `sandbox-gate.ts:40` (dev bypass).**

### 6.3 Related work completed in the same session (not from this report)

- FID-2026-0918-005/006/007 implemented, Loop 2/3, receipts stamped
  (`verified`). FID-007 part 3 (install-time vendor guarantee, root
  `prepare` hook) was operator-approved and implemented 2026-09-19.
- FID-007's PATH fallback also mitigates this audit's tooling reality:
  the auditor session's `code_search` failed again with the OUTER client
  rg ENOENT (`~/.config/manicode/rg.exe`) — outside this repo; operator
  env-var remediation already recorded in FID-2026-0918-007.

### 6.4 Open decisions for the operator

1. ~~Approve implementation of FIDs 0919-008/010/011/012/013/014~~ DONE
   (2026-09-19): all six implemented in the recommended order, receipts
   stamped, statuses `verified`.
2. ~~FID-0919-009 layer 3~~ DECIDED (2026-09-19): DECLINED. The
   residual indirect-injection risk through inherited history is
   accepted and documented in the FID — with the mitigating context that
   the channel's two weaponizable payloads are closed by FIDs 008 (env
   leak) and 010 (readonly redirect waiver), reducing practical impact
   to steering rather than exfiltration/destruction. Layers 1-2
   (provenance tagging + advisory scan) were presented as zero-cost and
   remain available on request, but are NOT approved by this decline.
3. Consider `provenance.mode: 'enforce'` for release-path runs
   (recommendation only; FID-0919-012 adds visibility either way).
4. G2 commits remain withheld per operator instruction (2026-09-19):
   FIDs 2026-0918-004…007 work + FIDs 0919-008…014 work + this report
   all sit uncommitted.