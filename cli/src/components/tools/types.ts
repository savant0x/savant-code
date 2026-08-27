import type { ContentBlock } from '../../types/chat'
import type { ChatTheme } from '../../types/theme-system'
import type { JSONValue } from '@savant-code/common/types/json'
import type { ToolName } from '@savant-code/sdk'
import type { ReactNode } from 'react'

export type ToolBlock = Extract<ContentBlock, { type: 'tool' }>

export type ToolBlockOf<T extends ToolName = ToolName> = ToolBlock & {
  toolName: T
}

export type ToolRenderOptions = {
  availableWidth: number
  indentationOffset: number
  previewPrefix?: string
  labelWidth: number
  /**
   * FID-2026-0823-006: collapse state + toggle, supplied by ToolBranch for
   * custom components that render their own expand/collapse chrome (mirrors
   * the AgentBranchItem/ToolCallItem affordance). Optional — components that
   * don't consume it are unaffected.
   */
  isCollapsed?: boolean
  onToggle?: () => void
}

export type ToolRenderConfig = {
  /** Optional path to display in the tool header */
  path?: string
  /** Custom content to render in the tool body */
  content?: ReactNode
  /** Preview text to show when the tool is collapsed */
  collapsedPreview?: string
  /**
   * FID-2026-0804-010: optional node rendered in the block's bottom-right
   * footer row, immediately left of the copy button. Used by the edit tools
   * to surface the `[-N/+M]` add/remove counter.
   */
  footerLeft?: ReactNode
}

/**
 * Base interface for tool-specific UI components.
 * Implement this interface to create a custom renderer for a specific tool.
 */
export interface ToolComponent<T extends ToolName = ToolName> {
  /** The tool name this component handles */
  toolName: T

  /**
   * Render function that returns configuration for how to display this tool.
   *
   * @param toolBlock - The tool block data containing input/output
   * @param theme - The current chat theme
   * @param options - Rendering options like width and indentation
   * @returns Configuration for rendering the tool, or null to use default rendering
   */
  render(
    toolBlock: ToolBlock & { toolName: T },
    theme: ChatTheme,
    options: ToolRenderOptions,
  ): ToolRenderConfig
}

/**
 * Type-safe tool component definition.
 * Use this helper to create tool components with full type inference.
 */
export function defineToolComponent<T extends ToolName>(
  component: ToolComponent<T>,
): ToolComponent<T> {
  return component
}

/** Safely read a string field from a tool input. */
export function getString(
  input: Record<string, JSONValue>,
  key: string,
): string | undefined {
  const value = input[key]
  return typeof value === 'string' ? value : undefined
}

/** Safely read an JSONValue field from a tool input. */
export function getJSONValue(
  input: Record<string, JSONValue>,
  key: string,
): JSONValue | undefined {
  return input[key]
}

/** Type guard for JSON objects (plain records, not arrays). */
export function isJSONObject(
  value: JSONValue,
): value is Record<string, JSONValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Safely read an array of strings from a tool input. */
export function getStringArray(
  input: Record<string, JSONValue>,
  key: string,
): string[] | undefined {
  const value = input[key]
  if (!Array.isArray(value)) return undefined
  const result: string[] = []
  for (const item of value) {
    if (typeof item === 'string') {
      result.push(item)
    }
  }
  return result.length > 0 ? result : undefined
}
