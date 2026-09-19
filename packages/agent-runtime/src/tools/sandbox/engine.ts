import { getToolSafety } from '@savant-code/common/tools/safety-registry'

import { findDestructivePattern } from './shell-denylist'

import type {
  SandboxDecision,
  SandboxPermissionMode,
  SandboxPolicy,
  ToolSafety,
} from '@savant-code/common/tools/safety'
import type { JSONValue } from '@savant-code/common/types/json'

/**
 * Default sandbox policy values. Kept in code so tests can override them
 * explicitly without depending on mutable module state.
 */
export function createDefaultSandboxPolicy(
  workspaceRoot: string,
  mode: SandboxPermissionMode = 'prompt',
): SandboxPolicy {
  return {
    workspaceRoot,
    // Network access is blocked in safe mode. In prompt mode outbound-read
    // research tools (registry permission 'allow') run while state-changing
    // network tools still require approval; only unsafe mode skips approval
    // (FID-2026-0909-004).
    allowNetwork: mode !== 'safe',
    permissionMode: mode,
  }
}

/**
 * Evaluates a tool call against the sandbox policy.
 *
 * Returns:
 *   - `allow` if the call is permitted.
 *   - `prompt` if the call needs interactive approval (downgraded to deny
 *     in non-interactive mode unless auto-approve is set).
 *   - `deny` if the call violates a hard policy.
 */
export function evaluateToolCall(params: {
  toolName: string
  input: Record<string, JSONValue>
  policy: SandboxPolicy
  safetyOverride?: ToolSafety
}): SandboxDecision {
  const { toolName, input, policy, safetyOverride } = params
  const safety = safetyOverride ?? getToolSafety(toolName)

  // FID-2026-0919-014 (SEC-7): the destructive-command denylist is a FLOOR —
  // it is evaluated unconditionally, BEFORE the `unsafe`-mode early return.
  // An operator who opts out of sandboxing did not thereby opt out of
  // machine destruction (`rm -rf /`, `dd` to a device, fork bombs). For
  // shell tools the floor denies outright in every mode; every other policy
  // relaxation still applies above this floor (mode, network, prompts).
  if (
    toolName === 'run_terminal_command' ||
    toolName === 'run_readonly_command'
  ) {
    const command = typeof input.command === 'string' ? input.command : ''
    const pattern = findDestructivePattern(command)
    if (pattern) {
      return {
        type: 'deny',
        reason: `${pattern.reason} (matched: ${pattern.name}) — destructive-command floor applies in every permission mode (FID-2026-0919-014)`,
      }
    }
  }

  // `unsafe` mode bypasses the sandbox engine. Path containment for write
  // tools is already enforced by the caller before the sandbox check runs.
  if (policy.permissionMode === 'unsafe') {
    return { type: 'allow' }
  }

  // Hard deny tools that are explicitly denied, or any tool that requires
  // approval when the user has selected safe mode. Only tools marked
  // `allow` are permitted in safe mode.
  if (
    safety.permission === 'deny' ||
    (policy.permissionMode === 'safe' && safety.permission !== 'allow')
  ) {
    return {
      type: 'deny',
      reason:
        safety.permission === 'deny'
          ? `Tool \`${toolName}\` is denied by default. ${safety.reason}`
          : `Tool \`${toolName}\` requires explicit approval and is blocked in safe mode. ${safety.reason}`,
    }
  }

  // Shell command denylist (pre-mode floor above handles destructive
  // patterns unconditionally; this branch keeps the safe/prompt
  // distinction for the residual denylist surface — none today, but the
  // structure documents intent if patterns gain severity classes).
  if (
    toolName === 'run_terminal_command' ||
    toolName === 'run_readonly_command'
  ) {
    const command = typeof input.command === 'string' ? input.command : ''
    const pattern = findDestructivePattern(command)
    if (pattern) {
      return {
        type: policy.permissionMode === 'safe' ? 'deny' : 'prompt',
        reason: `${pattern.reason} (matched: ${pattern.name})`,
      }
    }
  }

  // Network gate (FID-2026-0909-004): honors the registry's permission
  // class. Outbound-read research tools (permission 'allow') pass whenever
  // network is enabled; state-changing network tools (permission 'prompt')
  // keep the approval path. Safe mode keeps allowNetwork=false → deny.
  if (safety.effect === 'network') {
    if (!policy.allowNetwork) {
      return {
        type: 'deny',
        reason: `Network access is disabled. Tool \`${toolName}\` requires network.`,
      }
    }
    if (safety.permission === 'prompt') {
      return {
        type: 'prompt',
        reason: `Tool \`${toolName}\` requires network access.`,
      }
    }
  }

  // Permission metadata.
  if (safety.permission === 'prompt') {
    return {
      type: 'prompt',
      reason:
        safety.reason || `Tool \`${toolName}\` requires explicit approval.`,
    }
  }

  return { type: 'allow' }
}
