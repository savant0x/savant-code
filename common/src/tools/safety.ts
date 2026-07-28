/**
 * Tool safety metadata shared between agent-runtime and consumers.
 *
 * FID-2026-07-27-001 — Tool Safety + Sandbox Engine (Phase 1)
 */

/** Side-effect class of a tool. */
export type ToolEffect = 'read' | 'write' | 'shell' | 'network' | 'mixed'

/** Default runtime decision for a tool class. */
export type ToolPermission = 'allow' | 'prompt' | 'deny'

/** Permission mode selected by the user / host. */
export type SandboxPermissionMode = 'safe' | 'prompt' | 'unsafe'

/** Declarative safety metadata for a single tool. */
export interface ToolSafety {
  /** Side-effect class. */
  effect: ToolEffect
  /** Default permission when no explicit policy says otherwise. */
  permission: ToolPermission
  /** Human-readable explanation of why this classification was chosen. */
  reason: string
  /** Whether the tool may require interactive approval before running. */
  requiresApproval?: boolean
}

/** Runtime policy evaluated by the sandbox engine. */
export interface SandboxPolicy {
  /** Absolute path to the workspace root. */
  workspaceRoot: string
  /** Whether network access is permitted at all. */
  allowNetwork: boolean
  /** User-selected permission mode. */
  permissionMode: SandboxPermissionMode
}

/** Result of evaluating a tool call against the sandbox policy. */
export type SandboxDecision =
  | { type: 'allow' }
  | { type: 'prompt'; reason: string }
  | { type: 'deny'; reason: string }
