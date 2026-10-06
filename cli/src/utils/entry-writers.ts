/**
 * FID-2026-1006-003 WP5: the durable session-entry writers.
 *
 * FID-2026-1006-002 shipped the entry classes (`message` / `custom` / `label`
 * / `model_change` / `thinking_level_change`) and their read paths with no
 * writer anywhere, so the `entry_kind` and `exclude_from_context` columns
 * could only ever hold their defaults and the steering-override audit went to
 * the logger alone. This module is the missing writer: each function persists
 * one entry class at the seam where the event really happens — a model change
 * at save time, a completed compaction boundary, a steering override drained
 * from agentState.
 *
 * Every write is fail-open: the database is an audit/fallback store, so a
 * failed write is reported and never allowed to fail a turn or a chat switch.
 */
import path from 'path'

import {
  createCustomEntry,
  createLabelEntry,
  createModelChangeEntry,
  createThinkingLevelChangeEntry,
  getSessionsByChatId,
} from '@savant-code/database/service'

import { logger } from './logger'
import { findGatewayModel } from './openrouter-models'
import { resolveCurrentChatDir } from './run-state-storage/state'

import type { SteeringOverrideAuditRecord } from '@savant-code/common/types/session-state'

function reportFailure(step: string, error: unknown): void {
  logger.warn(
    {
      step,
      error: error instanceof Error ? error.message : String(error),
    },
    'session entry write failed (the run continues)',
  )
}

/**
 * The session row attached to the current chat, or null when the chat has no
 * session yet (a brand-new chat is not in the database until its first save).
 */
export function resolveCurrentSessionId(): string | null {
  try {
    const chatId = path.basename(resolveCurrentChatDir())
    const sessions = getSessionsByChatId(chatId)
    return sessions.length > 0 ? sessions[0].id : null
  } catch (error) {
    reportFailure('resolve-session', error)
    return null
  }
}

/**
 * The model's effective reasoning level, read from the provider catalog. A
 * reasoning level can only change when the model changes today, so this is
 * the ``from``/``to`` pair the `thinking_level_change` audit records;
 * `default` stands in when the catalog reports no explicit default, and both
 * sides use the same stand-in so an unreported level never reads as a change.
 */
export function reasoningLevelOf(modelId: string): string {
  return findGatewayModel(modelId)?.reasoningEfforts?.default ?? 'default'
}

/**
 * The audit trail for one mid-session model change. `model_change` is always
 * written; `thinking_level_change` only when the effective reasoning level
 * actually moved, so the entry class never carries a no-op record.
 */
export function writeModelChangeEntries(
  sessionId: string,
  from: string,
  to: string,
): void {
  try {
    createModelChangeEntry(sessionId, from, to)
    const previousLevel = reasoningLevelOf(from)
    const nextLevel = reasoningLevelOf(to)
    if (previousLevel !== nextLevel) {
      createThinkingLevelChangeEntry(sessionId, previousLevel, nextLevel)
    }
  } catch (error) {
    reportFailure('model-change', error)
  }
}

/** Bookmark a completed compaction boundary on the current chat. */
export function writeCompactionLabel(
  label: string,
  sessionId: string | null = resolveCurrentSessionId(),
): void {
  if (!sessionId) return
  try {
    createLabelEntry(sessionId, label)
  } catch (error) {
    reportFailure('compaction-label', error)
  }
}

/**
 * Drain the overrides the tool executor audited during the run into durable
 * `custom` entries. The caller clears the source list once this returns,
 * which is what keeps each override recorded exactly once.
 */
export function writeSteeringOverrideAudits(
  sessionId: string,
  audits: readonly SteeringOverrideAuditRecord[],
): void {
  for (const audit of audits) {
    try {
      createCustomEntry(sessionId, { kind: 'steering_override', ...audit })
    } catch (error) {
      reportFailure('steering-override', error)
    }
  }
}
