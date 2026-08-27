import { HOOK_BUILTIN_ACTIONS, HOOK_EVENTS } from '../types/hooks'

import type { ProtocolContractConfig } from './protocol-config-types'
import type { HookBuiltinAction, HookConfig, HookEvent } from '../types/hooks'

export function parseProtocolContract(
  lines: string[],
): ProtocolContractConfig | null {
  const versionMatch = lines
    .join('\n')
    .match(/^\s+version:\s*["']([^"']+)["']/m)
  const strictMatch = lines.join('\n').match(/^\s+strict_mode:\s*(true|false)/m)
  if (!versionMatch || !strictMatch) return null
  return {
    version: versionMatch[1],
    strictMode: strictMatch[1] === 'true',
  }
}

/**
 * FID-2026-0814-003: parse the `hooks:` block (a list of hook entries). Each
 * entry starts with a `- event: ...` line; following indented `key: value`
 * lines fill in the entry. Invalid entries (unknown event, missing command,
 * non-positive timeout) are DROPPED fail-safe — a malformed hook can never
 * brick a session or silently change enforcement semantics.
 */
export function parseHookConfigs(lines: string[]): HookConfig[] {
  const hooks: HookConfig[] = []
  let current: Partial<HookConfig> | null = null
  let env: Record<string, string> | undefined
  let inEnv = false

  const flush = () => {
    if (!current) return
    // Valid = known event AND (an external command OR an allowlisted builtin
    // action). Unknown actions / missing both are DROPPED fail-safe — a
    // malformed hook can never brick a session or silently change semantics.
    const hasCommand =
      typeof current.command === 'string' && current.command.trim() !== ''
    const hasValidAction =
      current.action !== undefined &&
      (HOOK_BUILTIN_ACTIONS as readonly string[]).includes(current.action)
    if (
      current.event !== undefined &&
      HOOK_EVENTS.includes(current.event as HookEvent) &&
      (hasCommand || hasValidAction)
    ) {
      const timeout =
        typeof current.timeout === 'number' && current.timeout > 0
          ? current.timeout
          : undefined
      hooks.push({
        event: current.event as HookEvent,
        ...(hasCommand
          ? { command: (current.command as string).trim() }
          : { action: current.action as HookBuiltinAction }),
        ...(current.matcher !== undefined ? { matcher: current.matcher } : {}),
        ...(timeout !== undefined ? { timeout } : {}),
        ...(current.cwd !== undefined ? { cwd: current.cwd } : {}),
        ...(env !== undefined && Object.keys(env).length > 0 ? { env } : {}),
      })
    }
    current = null
    env = undefined
    inEnv = false
  }

  const parseValue = (raw: string): string => {
    const trimmed = raw.trim()
    const unquoted = trimmed.replace(/^["']|["']$/g, '')
    // Strip YAML inline comments outside quotes (best-effort).
    return unquoted.split(/#/)[0].trim()
  }

  for (const line of lines) {
    if (line.trim() === '') continue
    const entryMatch = line.match(/^\s*-\s+event:\s*(.+)$/)
    if (entryMatch) {
      flush()
      current = { event: parseValue(entryMatch[1]) as HookEvent }
      inEnv = false
      continue
    }
    if (!current) continue
    const fieldMatch = line.match(/^\s{4,}(\w+):\s*(.*)$/)
    if (!fieldMatch) {
      inEnv = false
      continue
    }
    const key = fieldMatch[1]
    const raw = fieldMatch[2]
    if (key === 'env') {
      env = {}
      inEnv = true
      continue
    }
    if (inEnv && key !== 'command' && key !== 'event') {
      // env sub-entries are `  key: value` pairs (indent deeper than 4).
      if (env) env[key] = parseValue(raw)
      continue
    }
    inEnv = false
    if (key === 'event') {
      current.event = parseValue(raw) as HookEvent
    } else if (key === 'command') {
      current.command = parseValue(raw)
    } else if (key === 'action') {
      current.action = parseValue(raw) as HookBuiltinAction
    } else if (key === 'matcher') {
      current.matcher = parseValue(raw)
    } else if (key === 'timeout') {
      const parsed = Number.parseInt(raw.trim(), 10)
      if (Number.isFinite(parsed) && parsed > 0) current.timeout = parsed
    } else if (key === 'cwd') {
      current.cwd = parseValue(raw)
    }
  }
  flush()
  return hooks
}

export function extractYamlSection(
  lines: string[],
  key: string,
  indentation: number,
): string[] {
  const header = `${key}:`
  const start = lines.findIndex(
    (line) =>
      line.trim() === header &&
      line.length - line.trimStart().length === indentation,
  )
  if (start === -1) return []

  const section: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '') {
      section.push(line)
      continue
    }
    const lineIndentation = line.length - line.trimStart().length
    if (lineIndentation <= indentation) break
    section.push(line)
  }
  return section
}

export function parseYamlBool(text: string, key: string): boolean | undefined {
  const match = text.match(new RegExp(`^\\s+${key}:\\s*(true|false)`, 'm'))
  return match ? match[1] === 'true' : undefined
}

export function parseYamlNumber(text: string, key: string): number | undefined {
  const match = text.match(new RegExp(`^\\s+${key}:\\s*([0-9.]+)`, 'm'))
  return match ? Number.parseFloat(match[1]) : undefined
}

export function parseYamlString(text: string, key: string): string | undefined {
  const match = text.match(
    new RegExp(`^\\s+${key}:\\s*["']?([^#\\s"']+)["']?`, 'm'),
  )
  return match ? match[1] : undefined
}

export const boolOr = (v: boolean | undefined, d: boolean): boolean => v ?? d
