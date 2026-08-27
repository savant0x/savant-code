import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

/**
 * Compaction inventory (FID-2026-0824-027): append-only per-run ledger of
 * compaction events — which layer fired, how much was removed, when — so the
 * operator and downstream audits can answer "what did compaction take?".
 * Shares the `.savant/evidence/` directory with the -026 spill. Fail-open.
 */

export type CompactionLayer = 'micro' | 'auto' | 'reactive'

export type CompactionInventoryRecord = {
  ts: number
  runId: string
  kind: 'compaction'
  layer: CompactionLayer
  removedMessages: number
  tokensSaved: number
  percentUsed?: number
  /** FID-2026-0824-025/-027 post-closure amendment: half-open [start, end)
   *  spans of the PRE-compaction history that were folded/cleared, so audits
   *  can pinpoint WHICH regions were taken without replaying the run. */
  regions?: CompactionRegion[]
  /** FID-2026-0824-027 post-closure amendment: bounded per-item detail for
   *  removed tool results, capped at MAX_INVENTORY_ITEMS. */
  items?: CompactionRemovedItem[]
}

/** Half-open [start, end) span over the pre-compaction message array. */
export type CompactionRegion = { start: number; end: number }

/** Bounded per-item detail for one removed tool-result message. */
export type CompactionRemovedItem = {
  toolCallId?: string
  toolName?: string
  byteSize: number
}

/** Items array cap — ledger rows stay bounded even for mass truncations. */
export const MAX_INVENTORY_ITEMS = 64

/**
 * Extract item identity from a removed message (tolerant narrowing — tool
 * results carry toolName/toolCallId; everything else yields null so items
 * stay tool-result-scoped).
 */
export function describeRemovedToolItem(
  message: unknown,
): CompactionRemovedItem | null {
  if (!message || typeof message !== 'object') return null
  const msg = message as Record<string, unknown>
  if (msg.role !== 'tool') return null
  const toolCallId =
    typeof msg.toolCallId === 'string' && msg.toolCallId.length > 0
      ? msg.toolCallId
      : undefined
  const toolName =
    typeof msg.toolName === 'string' && msg.toolName.length > 0
      ? msg.toolName
      : undefined
  if (!toolCallId && !toolName) return null
  let byteSize = 0
  try {
    byteSize = JSON.stringify(message).length
  } catch {
    byteSize = 0
  }
  return {
    ...(toolCallId !== undefined ? { toolCallId } : {}),
    ...(toolName !== undefined ? { toolName } : {}),
    byteSize,
  }
}

/**
 * FID-2026-0824-025/-027 post-closure amendment: derive WHICH positions
 * disappeared between pre- and post-compaction histories by reference
 * identity (kept messages keep object identity across set_messages /
 * microCompact / reactiveCompact replacement). Set-membership alignment is
 * order-robust: regions are maximal runs of absent references in PRE
 * coordinates, items are bounded per-tool-result detail. Pure + generic.
 */
export function diffRemovedSpans<T>(params: {
  prev: readonly T[]
  next: readonly T[]
  describeItem?: (item: T) => CompactionRemovedItem | null
}): { regions: CompactionRegion[]; items: CompactionRemovedItem[] } {
  const { prev, next, describeItem } = params
  const nextSet = new Set<unknown>(next)
  const regions: CompactionRegion[] = []
  const items: CompactionRemovedItem[] = []
  let runStart = -1
  for (let i = 0; i < prev.length; i++) {
    const item = prev[i]
    if (item !== undefined && nextSet.has(item)) {
      if (runStart !== -1) {
        regions.push({ start: runStart, end: i })
        runStart = -1
      }
      continue
    }
    if (runStart === -1) runStart = i
    if (describeItem && items.length < MAX_INVENTORY_ITEMS) {
      const described = describeItem(item)
      if (described) items.push(described)
    }
  }
  if (runStart !== -1) {
    regions.push({ start: runStart, end: prev.length })
  }
  return { regions, items }
}

export function inventoryFilePath(projectRoot: string, runId: string): string {
  return path.join(
    projectRoot,
    '.savant',
    'evidence',
    `${runId}.inventory.jsonl`,
  )
}

/** Fixed-template model-facing notice (bounded; never carries payloads). */
export function buildCompactionModelNotice(layer: CompactionLayer): string {
  return `<compaction-notice layer="${layer}">Earlier tool responses in this conversation were compacted to bounded digests. Re-read files or re-run commands if exact contents matter.</compaction-notice>`
}

/** Append one inventory row. Fail-open: never throws. */
export async function appendCompactionInventory(params: {
  projectRoot: string
  runId: string
  layer: CompactionLayer
  removedMessages: number
  tokensSaved: number
  percentUsed?: number
  regions?: CompactionRegion[]
  items?: CompactionRemovedItem[]
}): Promise<boolean> {
  try {
    if (!params.projectRoot || !params.runId) return false
    const record: CompactionInventoryRecord = {
      ts: Date.now(),
      runId: params.runId,
      kind: 'compaction',
      layer: params.layer,
      removedMessages: params.removedMessages,
      tokensSaved: params.tokensSaved,
      ...(params.percentUsed !== undefined
        ? { percentUsed: params.percentUsed }
        : {}),
      ...(params.regions && params.regions.length > 0
        ? { regions: params.regions }
        : {}),
      ...(params.items && params.items.length > 0
        ? { items: params.items }
        : {}),
    }
    const file = inventoryFilePath(params.projectRoot, params.runId)
    await mkdir(path.dirname(file), { recursive: true })
    await appendFile(file, `${JSON.stringify(record)}\n`, 'utf8')
    return true
  } catch {
    return false
  }
}
