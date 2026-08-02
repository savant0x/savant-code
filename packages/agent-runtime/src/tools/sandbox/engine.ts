import { getToolSafety } from '@savant-code/common/tools/safety-registry'

import { findDestructivePattern } from './shell-denylist'

import type {
  SandboxDecision,
  SandboxPermissionMode,
  SandboxPolicy,
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
    // Network access is blocked in safe mode and gated by permission in prompt
    // mode. Only unsafe mode allows network requests without prompting.
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
}): SandboxDecision {
  const { toolName, input, policy } = params
  const safety = getToolSafety(toolName)

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

  // Shell command denylist.
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

  // Network gate.
  if (safety.effect === 'network') {
    if (!policy.allowNetwork) {
      return {
        type: 'deny',
        reason: `Network access is disabled. Tool \`${toolName}\` requires network.`,
      }
    }
    if (policy.permissionMode === 'prompt') {
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
