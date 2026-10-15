import { createDefaultSandboxPolicy, evaluateToolCall } from '../sandbox'
import { findDestructivePattern } from '../sandbox/shell-denylist'

import type {
  SandboxPermissionMode,
  ToolSafety,
} from '@savant-code/common/tools/safety'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

/**
 * FID-2026-07-27-001: Evaluate a tool call against the sandbox policy after
 * FSM and agent-restriction gating, but before streaming the tool_call event
 * or invoking the handler. devMode bypasses the sandbox (logged elsewhere).
 * Returns true when the call was rejected (an error chunk was emitted and the
 * caller should return early).
 */
export function checkSandboxPolicy(params: {
  isDevOverride: boolean
  toolName: string
  toolCallToolName: string
  toolCallInput: Record<string, JSONValue>
  projectRoot: string | undefined
  permissionMode: 'safe' | 'prompt' | 'unsafe' | undefined
  safetyOverride?: ToolSafety
  logger: Logger
  onResponseChunk: (chunk: string | PrintModeEvent) => void
}): boolean {
  const {
    isDevOverride,
    toolName,
    toolCallToolName,
    toolCallInput,
    projectRoot,
    permissionMode,
    logger,
    onResponseChunk,
  } = params

  // FID-2026-0919-014 (SEC-7): the destructive-command denylist is a floor
  // evaluated BEFORE the dev override. Dev mode bypasses sandbox *policy*
  // (approvals, network gates) — it does not authorize machine-destruction
  // commands. The check mirrors engine.evaluateToolCall's floor; failure
  // emits the same error chunk shape as a sandbox denial.
  if (
    (toolCallToolName === 'run_terminal_command' ||
      toolCallToolName === 'run_readonly_command') &&
    typeof toolCallInput.command === 'string'
  ) {
    const pattern = findDestructivePattern(toolCallInput.command)
    if (pattern) {
      logger.warn(
        { toolName, pattern: pattern.name },
        'Destructive-command floor denied a command under dev override (FID-2026-0919-014)',
      )
      onResponseChunk({
        type: 'error',
        message: `Tool \`${toolName}\` was blocked: ${pattern.reason} (matched: ${pattern.name}) — the destructive-command floor applies in every mode (FID-2026-0919-014).`,
      })
      return true
    }
  }

  if (isDevOverride) {
    return false
  }
  if (!projectRoot) {
    logger.error(
      { toolName },
      'Sandbox check denied: fileContext.projectRoot is missing.',
    )
    onResponseChunk({
      type: 'error',
      message: `Tool \`${toolName}\` was blocked by the sandbox: project root is missing.`,
    })
    return true
  }

  const sandboxPolicy = createDefaultSandboxPolicy(
    projectRoot,
    permissionMode as SandboxPermissionMode | undefined,
  )
  const sandboxDecision = evaluateToolCall({
    toolName: toolCallToolName,
    // C1: same safe narrowing as the write gate — validated input only.
    input: toolCallInput,
    policy: sandboxPolicy,
    safetyOverride: params.safetyOverride,
  })
  if (sandboxDecision.type === 'deny') {
    onResponseChunk({
      type: 'error',
      message: `Tool \`${toolName}\` was blocked by the sandbox: ${sandboxDecision.reason}`,
    })
    return true
  }
  if (sandboxDecision.type === 'prompt') {
    // Phase 1: no interactive TUI permission modal yet. Downgrade to deny
    // in headless mode. Future work will surface a permission request event.
    logger.debug(
      { toolName, reason: sandboxDecision.reason },
      'Sandbox prompt decision downgraded to deny in headless mode',
    )
    onResponseChunk({
      type: 'error',
      message: `Tool \`${toolName}\` requires approval: ${sandboxDecision.reason}. Run with permission mode \`unsafe\` or re-run interactively when supported.`,
    })
    return true
  }
  return false
}
