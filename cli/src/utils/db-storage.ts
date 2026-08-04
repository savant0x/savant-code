import {
  createSession,
  getSession as _getSession,
  updateSession,
  updateSessionModel,
  createMessage,
  getMessagesBySessionId,
  createCostRecord,
  getCostsBySessionId,
  getTotalCostBySessionId,
  getSessionsByChatId,
  getLatestModel,
  createFidDocument,
  getFidDocument,
  updateFidDocument,
} from '@savant-code/database/service'

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
      const existingSessions = getSessionsByChatId(chatId)
      if (existingSessions.length > 0) {
        session = existingSessions[0]
        updateSession(session.id, runState.sessionState)
        if (selectedModel) {
          updateSessionModel(session.id, selectedModel)
        }
      } else {
        session = createSession(
          chatId,
          agentId,
          runState.sessionState,
          selectedModel,
        )
      }
    }
    // FID-006 DB1: pass each message's stable id so createMessage's
    // INSERT OR IGNORE deduplicates re-persisted messages instead of appending
    // duplicate rows on every save.
    if (session && messages.length > 0) {
      for (const message of messages) {
        createMessage(session.id, message.variant, message.content, message.id)
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
    const sessions = getSessionsByChatId(chatId)
    if (sessions.length === 0) {
      return null
    }
    const session = sessions[0]
    const rawMessages = getMessagesBySessionId(session.id)
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
    const sessions = getSessionsByChatId(chatId)
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
// FID Document operations
// Check if a path is an FID document path.
// FID-006 CLI1: tolerate both '/' and '\\' separators so native Windows paths
// (dev\fids\...) match instead of silently skipping FID persistence.
export function isFidPath(filePath: string): boolean {
  // Match paths like: dev/fids/FID-*.md or dev/fids/archive/FID-*.md
  return /^dev[\\/]fids[\\/](archive[\\/])?FID-.*\.md$/.test(filePath)
}
// Extract FID name from path (e.g., "dev/fids/FID-123.md" -> "FID-123")
export function extractFidNameFromPath(filePath: string): string {
  const match = filePath.match(
    /dev[\\/]fids[\\/](?:archive[\\/])?(FID-[^/]+)\.md$/,
  )
  return match ? match[1] : ''
}
// Save FID document to database
export function saveFidDocumentToDb(
  filePath: string,
  content: string,
  sessionId?: string,
): void {
  try {
    const fidName = extractFidNameFromPath(filePath)
    if (!fidName) {
      return
    }
    // Extract status from content (look for status line in FID)
    const statusMatch = content.match(/## Status\s*\n\s*-\s*\*\*(\w+)\*\*/i)
    const status = statusMatch ? statusMatch[1].toLowerCase() : 'in_progress'
    // Extract perfection loop phase
    const phaseMatch = content.match(
      /## Perfection Loop Phase\s*\n\s*-\s*\*\*(\w+)\*\*/i,
    )
    const perfectionLoopPhase = phaseMatch ? phaseMatch[1].toLowerCase() : 'red'
    // Check if FID already exists in database
    const existingFid = getFidDocument(fidName)
    if (existingFid) {
      // Update existing FID
      updateFidDocument(fidName, content, status, perfectionLoopPhase)
    } else {
      // Create new FID with FID name as ID
      createFidDocument(sessionId || 'unknown', content, fidName)
    }
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to save FID document to database',
    )
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
