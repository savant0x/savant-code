import {
  createSession,
  getSession,
  updateSession,
  updateSessionModel,
  createMessage,
  getMessagesBySessionId,
  createCostRecord,
  getCostsBySessionId,
  getTotalCostBySessionId,
  getSessionsByChatId,
  getLatestModel,
  hasSessions,
  createFidDocument,
  getFidDocument,
  updateFidDocument,
} from '@savant-code/database/service'
import type { RunState } from '@savant-code/sdk'
import type { ChatMessage } from '../types/chat'

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
  try {
    let session = null
    if (runState.sessionState) {
      const existingSessions = getSessionsByChatId(chatId)
      if (existingSessions.length > 0) {
        session = existingSessions[0]
        updateSession(session.id, runState.sessionState)
        if (selectedModel) {
          updateSessionModel(session.id, selectedModel)
        }
      } else {
        session = createSession(chatId, agentId, runState.sessionState, selectedModel)
      }
    }

    if (session && messages.length > 0) {
      for (const message of messages) {
        createMessage(session.id, message.variant, message.content)
      }
    }

    if (session && runState.sessionState?.mainAgentState) {
      const agentState = runState.sessionState.mainAgentState
      if (agentState.creditsUsed > 0 || agentState.directCreditsUsed > 0) {
        createCostRecord(
          session.id,
          agentId,
          agentState.creditsUsed,
          agentState.directCreditsUsed,
        )
      }
    }

    return {
      sessionId: session?.id || '',
      runState,
      messages,
    }
  } catch (error) {
    console.error('Failed to save chat state to database:', error)
    throw error
  }
}

// Load chat state from database
export function loadChatStateFromDb(
  chatId: string,
): DbChatState | null {
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
      content: msg.content,
      timestamp: msg.created_at,
    }))

    return {
      sessionId: session.id,
      runState: {
        sessionState: session.session_state,
        output: {
          type: 'error',
          message: 'No output yet',
        },
        traceSessionId: session.id,
      },
      messages,
    }
  } catch (error) {
    console.error('Failed to load chat state from database:', error)
    return null
  }
}

// Get cost summary for a chat
export function getCostSummary(chatId: string): {
  totalCredits: number
  totalDirectCredits: number
  costRecords: any[]
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
    console.error('Failed to get cost summary:', error)
    return { totalCredits: 0, totalDirectCredits: 0, costRecords: [] }
  }
}

// FID Document operations

// Check if a path is an FID document path
export function isFidPath(filePath: string): boolean {
  // Match paths like: dev/fids/FID-*.md or dev/fids/archive/FID-*.md
  return /^dev\/fids\/(archive\/)?FID-.*\.md$/.test(filePath)
}

// Extract FID name from path (e.g., "dev/fids/FID-123.md" -> "FID-123")
export function extractFidNameFromPath(filePath: string): string {
  const match = filePath.match(/dev\/fids\/(?:archive\/)?(FID-[^/]+)\.md$/)
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
    const phaseMatch = content.match(/## Perfection Loop Phase\s*\n\s*-\s*\*\*(\w+)\*\*/i)
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
    console.error('Failed to save FID document to database:', error)
  }
}

// Load selected model from database (most recent session) for audit trail
export function loadModelFromDb(_chatId: string): string | null {
  try {
    const model = getLatestModel()
    return model || null
  } catch (error) {
    console.error('Failed to load model from database:', error)
    return null
  }
}
