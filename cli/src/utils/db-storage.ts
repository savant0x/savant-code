import {
  createSession,
  getSession,
  updateSession,
  updateSessionModel,
  saveConversationMessages,
  getInContextMessages,
  getEntriesByKind,
  createCostRecord,
  getCostsBySessionId,
  getTotalCostBySessionId,
  getSessionsByChatId,
  getLatestModel,
} from '@savant-code/database/service'

import {
  writeCompactionLabel,
  writeModelChangeEntries,
  writeSteeringOverrideAudits,
} from './entry-writers'
import { logger } from './logger'

import type { ChatMessage } from '../types/chat'
import type { CostTracking } from '@savant-code/database/service'
import type { RunState } from '@savant-code/sdk'

// FID-006 DB1: previous total cost per session, used to persist per-save
// deltas instead of cumulative snapshots (which inflated getTotalCostBySessionId).
// Returns null on read failure so the caller skips the cost write entirely —
// falling back to zeros here would re-insert a cumulative snapshot and
// reintroduce the compounding DB2 bug on a transient read error.
function getPreviousCostTotals(sessionId: string): {
  total_credits: number
  total_direct_credits: number
} | null {
  try {
    return getTotalCostBySessionId(sessionId)
  } catch {
    return null
  }
}
// Storage interface for database-backed state
export interface DbChatState {
  sessionId: string
  runState: RunState
  messages: ChatMessage[]
}
// Save chat state to database
export function saveChatStateToDb(
  chatId: string,
  agentId: string,
  runState: RunState,
  messages: ChatMessage[],
  selectedModel: string = '',
): DbChatState {
  // Hoisted so the error path below can reference it (DB5 no-rethrow).
  let session: { id: string } | null = null
  try {
    if (runState.sessionState) {
      const existingSessions = getSessionsByChatId(chatId, 1)
      if (existingSessions.length > 0) {
        session = existingSessions[0]
        updateSession(session.id, runState.sessionState)
        if (selectedModel) {
          // FID-2026-1006-003 WP5: audit an ACTUAL change. This save runs after
          // every turn, so writing unconditionally would stamp the unchanged
          // model on every save instead of recording one mid-session change.
          const previousModel = getSession(session.id)?.selected_model ?? ''
          if (previousModel !== '' && previousModel !== selectedModel) {
            writeModelChangeEntries(session.id, previousModel, selectedModel)
          }
          updateSessionModel(session.id, selectedModel)
        }
      } else {
        session = createSession(
          chatId,
          agentId,
          runState.sessionState,
          selectedModel,
          'project',
          chatId,
        )
      }
    }
    // FID-006 DB1: pass each message's stable id so createMessage's
    // INSERT OR IGNORE deduplicates re-persisted messages instead of appending
    // duplicate rows on every save.
    if (session && messages.length > 0) {
      saveConversationMessages(session.id, messages.map(message => ({
        id: message.id, role: message.variant, content: message.content,
      })))
    }
    // FID-2026-1006-003 WP5: the tool executor has no database access, so a
    // steering override rides on agentState until this save drains it into a
    // durable `custom` entry. The list clears only after the writes, so a
    // failed write leaves the record for the next save instead of dropping it.
    const mainAgentState = runState.sessionState?.mainAgentState
    const auditedOverrides = mainAgentState?.pendingSteeringOverrideAudits
    if (
      session &&
      mainAgentState &&
      auditedOverrides &&
      auditedOverrides.length > 0
    ) {
      mainAgentState.pendingSteeringOverrideAudits =
        writeSteeringOverrideAudits(session.id, auditedOverrides)
    }
    // FID-2026-1006-003 WP5: a `label` bookmark at each COMPLETED compaction
    // boundary. The runtime already counts every completed compaction on
    // `compactionMetrics.events`, so comparing that count against the labels
    // this session already carries makes the write idempotent — a re-save
    // records only the newly completed boundaries, never a duplicate.
    const compactionEvents = mainAgentState?.compactionMetrics?.events ?? 0
    if (session && compactionEvents > 0) {
      const recorded = new Set(getEntriesByKind(session.id, 'label').map(entry => entry.id))
      const owner = mainAgentState?.runId ?? session.id
      for (let n = 1; n <= compactionEvents; n += 1) {
        const id = `compaction:${session.id}:${owner}:${n}`
        if (!recorded.has(id)) writeCompactionLabel(`compaction boundary ${n}`, session.id, id)
      }
    }
    // FID-006 DB2: persist only the delta over the session's previous total;
    // storing cumulative snapshots per save inflated the summed totals.
    if (session && runState.sessionState?.mainAgentState) {
      const agentState = runState.sessionState.mainAgentState
      if (agentState.creditsUsed > 0 || agentState.directCreditsUsed > 0) {
        const previous = getPreviousCostTotals(session.id)
        if (!previous) {
          // Read failed — skip the cost write. Writing a delta computed
          // against zeros would re-insert a cumulative snapshot.
          return {
            sessionId: session.id,
            runState,
            messages,
          }
        }
        const deltaCredits = Math.max(
          0,
          agentState.creditsUsed - previous.total_credits,
        )
        const deltaDirect = Math.max(
          0,
          agentState.directCreditsUsed - previous.total_direct_credits,
        )
        if (deltaCredits > 0 || deltaDirect > 0) {
          createCostRecord(session.id, agentId, deltaCredits, deltaDirect)
        }
      }
    }
    return {
      sessionId: session?.id || '',
      runState,
      messages,
    }
  } catch (error) {
    // FID-006 DB5: the DB is a fallback/audit store (filesystem is
    // authoritative). Log and continue — a DB failure must never fail the
    // turn, matching loadChatStateFromDb's non-throwing semantics.
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to save chat state to database',
    )
    return { sessionId: session?.id ?? '', runState, messages }
  }
}
// Load chat state from database
export function loadChatStateFromDb(chatId: string): DbChatState | null {
  try {
    const sessions = getSessionsByChatId(chatId, 1)
    if (sessions.length === 0) {
      return null
    }
    const session = sessions[0]
    // FID-2026-1006-003 WP5: load only what belongs in the LLM context. Now
    // that the entry-class writers exist, an audit/custom/label row carries
    // `exclude_from_context`, and mapping EVERY row here would re-inject those
    // audit rows into a resumed chat as if they were conversation turns.
    const rawMessages = getInContextMessages(session.id)
    const messages: ChatMessage[] = rawMessages.map((msg) => ({
      id: msg.id,
      variant: msg.role as ChatMessage['variant'],
      content: msg.content as string,
      timestamp: msg.created_at,
    }))
    return {
      sessionId: session.id,
      runState: {
        sessionState: session.session_state as RunState['sessionState'],
        // FID-2026-0802-006 DB11: intentional sentinel (not a real failure) —
        // consumers must not treat `output.type === 'error'` as a run failure
        // before the first step completes.
        output: {
          type: 'error',
          message: 'No output yet',
        },
        traceSessionId: session.id,
      },
      messages,
    }
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to load chat state from database',
    )
    return null
  }
}
// Get cost summary for a chat
export function getCostSummary(chatId: string): {
  totalCredits: number
  totalDirectCredits: number
  costRecords: CostTracking[]
} {
  try {
    const sessions = getSessionsByChatId(chatId, 1)
    if (sessions.length === 0) {
      return { totalCredits: 0, totalDirectCredits: 0, costRecords: [] }
    }
    const session = sessions[0]
    const costRecords = getCostsBySessionId(session.id)
    const totals = getTotalCostBySessionId(session.id)
    return {
      totalCredits: totals.total_credits,
      totalDirectCredits: totals.total_direct_credits,
      costRecords,
    }
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to get cost summary',
    )
    return { totalCredits: 0, totalDirectCredits: 0, costRecords: [] }
  }
}
// Load selected model from database for audit trail.
// FID-006 DB3: scope to the provided chat id so model attribution stays
// correct when multiple chats exist.
export function loadModelFromDb(chatId: string): string | null {
  try {
    const model = getLatestModel(chatId || undefined)
    return model || null
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to load model from database',
    )
    return null
  }
}
