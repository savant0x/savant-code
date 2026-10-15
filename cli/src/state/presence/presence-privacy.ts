import { z } from 'zod'

/**
 * FID-2026-0818-009: Discord Rich Presence — mechanical privacy boundary.
 *
 * Everything the presence subsystem can ever transmit flows through
 * `sanitizeRawState` + `validatePayload`. Redaction is absolute and
 * deterministic (Law 12): no heuristic filtering of tool arguments, no path
 * survives, the FID kebab title is stripped (it may name a vulnerability),
 * and search queries are masked. The Zod schema is the last mechanical gate:
 * it rejects path separators in the visible fields and falls back to a
 * hardcoded safe payload on any violation — never a crash, never a leak.
 */

/** Raw state the selector reads from the Zustand store (pre-redaction). */
export type PresenceRawState = {
  cwd: string
  model: string
  mode: string
  phase: string
  agentId: string | null
  activityKind: string | null
  toolName: string | null
  activityAgentType: string | null
  activeFid: string | null
}

/** Redacted, path-free, arg-free state ready for the mapper. */
export type SanitizedPresenceState = {
  project: string
  model: string
  mode: string
  phase: string
  agentId: string | null
  activity: string | null
  fidId: string | null
}

/** The exact outbound SET_ACTIVITY payload shape the mapper emits. */
export type PresencePayload = {
  details: string
  state: string
  largeImageKey?: string
  largeImageText?: string
  smallImageKey?: string
  smallImageText?: string
  startTimestamp: number
}

/** Project basename only — every parent directory is discarded. */
export function sanitizeProject(cwd: string): string {
  const normalized = cwd.replace(/\\/g, '/')
  const basename = normalized.split('/').filter(Boolean).pop() ?? normalized
  return basename.replace(/[/\\]/g, '-')
}

/**
 * Model identifier → short, provider-free display label. The provider/org
 * prefix is dropped (last `/` segment) and any variant suffix (`:free`,
 * `:beta`, …) is removed — the label is the model name only, never a long
 * provider-qualified slug. `openrouter/free` has no model name of its own, so
 * it maps to a stable, readable label instead of the bare tier "free". Any
 * remaining separator is neutralized (no `/` may reach Discord).
 */
export function sanitizeModel(model: string): string {
  if (model === 'openrouter/free') return 'OpenRouter Free'
  const lastSegment = model.split(/[/\\]/).filter(Boolean).pop() ?? model
  // Strip any variant/tier suffix wherever it appears (`:free`, `:beta`,
  // `:online`, `:extended` are OpenRouter tier markers, not part of the
  // model's name). The lookahead stops `:free` from eating into a real model
  // token like `foo:freeze`.
  const withoutVariant = lastSegment.replace(
    /:(free|beta|online|extended)(?=$|:)/gi,
    '',
  )
  return withoutVariant.replace(/[/\\]/g, '-')
}

/** FID → numeric ID only; the kebab title may name a vulnerability. */
export function sanitizeFidId(fid: string): string {
  const match = fid.match(/^(FID-\d{4}-\d{4}-\d{3})/i)
  return match ? match[1] : fid.replace(/[/\\]/g, '-')
}

/**
 * Tool activity → "using tool: <name>" only. Arguments are dropped
 * absolutely — never inspected, never forwarded.
 */
export function sanitizeToolActivity(toolName: string): string {
  return `using tool: ${toolName}`
}

/** A search/research query is masked entirely (intellectual property). */
export function maskSearchQuery(): string {
  return 'Analyzing knowledge graph'
}

/** Subagent type → path-separator-free label (no `/` may reach Discord). */
export function sanitizeAgentType(agentType: string): string {
  return agentType.replace(/[/\\]/g, '-')
}

/**
 * Compose the raw state into redacted, path-free strings. This is the single
 * entry point — the mapper can never receive unsanitized state.
 */
export function sanitizeRawState(
  raw: PresenceRawState,
): SanitizedPresenceState {
  const activity =
    raw.activityKind === 'tool' && raw.toolName
      ? sanitizeToolActivity(raw.toolName)
      : raw.activityKind === 'researching'
        ? maskSearchQuery()
        : raw.activityKind === 'thinking'
          ? 'Thinking…'
          : raw.activityKind === 'subagent' && raw.activityAgentType
            ? `Delegating to ${sanitizeAgentType(raw.activityAgentType)}`
            : null
  return {
    project: sanitizeProject(raw.cwd),
    model: sanitizeModel(raw.model),
    mode: raw.mode,
    phase: raw.phase,
    agentId: raw.agentId,
    activity,
    fidId: raw.activeFid ? sanitizeFidId(raw.activeFid) : null,
  }
}

const assetKeySchema = z.string().regex(/^[a-z0-9_]+$/)

export const OutboundPresenceSchema = z.object({
  details: z
    .string()
    .min(2)
    .max(128)
    .refine((v) => !v.includes('/') && !v.includes('\\'), {
      message: 'path leakage detected in details',
    }),
  state: z
    .string()
    .min(2)
    .max(128)
    .refine((v) => !v.includes('/') && !v.includes('\\'), {
      message: 'path leakage detected in state',
    }),
  largeImageKey: assetKeySchema.optional(),
  largeImageText: z.string().max(128).optional(),
  smallImageKey: assetKeySchema.optional(),
  smallImageText: z.string().max(128).optional(),
  startTimestamp: z.number().int().positive(),
})

export const SAFE_PRESENCE_PAYLOAD: PresencePayload = {
  details: 'Working in Savant-Code',
  state: 'Awaiting Operator Input',
  startTimestamp: Date.now(),
}

/**
 * Validate the mapper's payload. On failure, return the hardcoded safe payload
 * (and the parse errors for the caller to log as a `compliance_warning`) —
 * never throw into the transport.
 */
export function validatePayload(payload: PresencePayload): {
  ok: boolean
  payload: PresencePayload
  errors?: string[]
} {
  const result = OutboundPresenceSchema.safeParse(payload)
  if (result.success) return { ok: true, payload }
  return {
    ok: false,
    payload: SAFE_PRESENCE_PAYLOAD,
    errors: result.error.issues.map((i) => i.message),
  }
}
