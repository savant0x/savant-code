import crypto from 'crypto'

import { db } from './index'

// Types
export interface Session {
  id: string
  chat_id: string
  agent_id: string
  selected_model: string
  session_state: Record<string, unknown>
  status: string
  created_at: string
  updated_at: string
}

export interface AgentTemplate {
  id: string
  template: Record<string, unknown>
  version: number
  created_at: string
  updated_at: string
}

export interface AgentConfig {
  id: string
  session_id: string
  template_id: string
  config: Record<string, unknown>
  created_at: string
}

export interface FidDocument {
  id: string
  session_id: string
  content: string
  status: string
  perfection_loop_phase: string
  created_at: string
  updated_at: string
}

export interface MessageHistory {
  id: string
  session_id: string
  role: string
  content: unknown
  created_at: string
}

export interface CostTracking {
  id: string
  session_id: string
  agent_id: string
  credits_used: number
  direct_credits_used: number
  created_at: string
}

// Session operations
export function createSession(chatId: string, agentId: string, sessionState: Record<string, unknown>, selectedModel: string = ''): Session {
  const id = crypto.randomUUID()
  const stmt = db.prepare(`
    INSERT INTO sessions (id, chat_id, agent_id, session_state, selected_model)
    VALUES (?, ?, ?, ?, ?)
  `)
  stmt.run(id, chatId, agentId, JSON.stringify(sessionState), selectedModel)
  return getSession(id)!
}

export function getSession(id: string): Session | null {
  const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?')
  const row = stmt.get(id) as Record<string, unknown> | null
  if (row) {
    return {
      ...row,
      session_state: JSON.parse(row.session_state as string)
    } as Session
  }
  return null
}

export function updateSession(id: string, sessionState: Record<string, unknown>): void {
  const stmt = db.prepare(`
    UPDATE sessions 
    SET session_state = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  stmt.run(JSON.stringify(sessionState), id)
}

export function getSessionsByChatId(chatId: string): Session[] {
  const stmt = db.prepare('SELECT * FROM sessions WHERE chat_id = ? ORDER BY created_at DESC')
  const rows = stmt.all(chatId) as Record<string, unknown>[]
  return rows.map(row => ({
    ...row,
    session_state: JSON.parse(row.session_state as string)
  })) as Session[]
}

export function updateSessionModel(sessionId: string, model: string): void {
  const stmt = db.prepare(`
    UPDATE sessions 
    SET selected_model = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  stmt.run(model, sessionId)
}

export function getLatestModelForChat(chatId: string): string {
  const stmt = db.prepare('SELECT selected_model FROM sessions WHERE chat_id = ? ORDER BY created_at DESC LIMIT 1')
  const row = stmt.get(chatId) as Record<string, unknown> | null
  return (row?.selected_model as string) || ''
}

export function saveModel(model: string): void {
  const stmt = db.prepare(`
    UPDATE sessions 
    SET selected_model = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = (SELECT id FROM sessions ORDER BY created_at DESC LIMIT 1)
  `)
  stmt.run(model)
}

export function getLatestModel(): string {
  const stmt = db.prepare('SELECT selected_model FROM sessions ORDER BY created_at DESC LIMIT 1')
  const row = stmt.get() as Record<string, unknown> | null
  return (row?.selected_model as string) || ''
}

export function hasSessions(): boolean {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM sessions')
  const row = stmt.get() as Record<string, unknown> | null
  return (row?.count as number) > 0
}

// Agent Template operations
export function createAgentTemplate(template: Record<string, unknown>): AgentTemplate {
  const id = (typeof template.id === 'string' ? template.id : undefined) || crypto.randomUUID()
  const stmt = db.prepare(`
    INSERT INTO agent_templates (id, template)
    VALUES (?, ?)
  `)
  stmt.run(id, JSON.stringify(template))
  return getAgentTemplate(id)!
}

export function getAgentTemplate(id: string): AgentTemplate | null {
  const stmt = db.prepare('SELECT * FROM agent_templates WHERE id = ?')
  const row = stmt.get(id) as Record<string, unknown> | null
  if (row) {
    return {
      ...row,
      template: JSON.parse(row.template as string)
    } as AgentTemplate
  }
  return null
}

export function updateAgentTemplate(id: string, template: Record<string, unknown>): void {
  const stmt = db.prepare(`
    UPDATE agent_templates 
    SET template = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  stmt.run(JSON.stringify(template), id)
}

// Agent Config operations
export function createAgentConfig(sessionId: string, templateId: string, config: Record<string, unknown>): AgentConfig {
  const id = crypto.randomUUID()
  const stmt = db.prepare(`
    INSERT INTO agent_configs (id, session_id, template_id, config)
    VALUES (?, ?, ?, ?)
  `)
  stmt.run(id, sessionId, templateId, JSON.stringify(config))
  return getAgentConfig(id)!
}

export function getAgentConfig(id: string): AgentConfig | null {
  const stmt = db.prepare('SELECT * FROM agent_configs WHERE id = ?')
  const row = stmt.get(id) as Record<string, unknown> | null
  if (row) {
    return {
      ...row,
      config: JSON.parse(row.config as string)
    } as AgentConfig
  }
  return null
}

// FID Document operations
export function createFidDocument(sessionId: string, content: string, id?: string): FidDocument {
  const fidId = id || crypto.randomUUID()
  const stmt = db.prepare(`
    INSERT INTO fid_documents (id, session_id, content)
    VALUES (?, ?, ?)
  `)
  stmt.run(fidId, sessionId, content)
  return getFidDocument(fidId)!
}

export function getFidDocument(id: string): FidDocument | null {
  const stmt = db.prepare('SELECT * FROM fid_documents WHERE id = ?')
  return stmt.get(id) as FidDocument | null
}

export function updateFidDocument(id: string, content: string, status: string, perfectionLoopPhase: string): void {
  const stmt = db.prepare(`
    UPDATE fid_documents 
    SET content = ?, status = ?, perfection_loop_phase = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `)
  stmt.run(content, status, perfectionLoopPhase, id)
}

// Message History operations
export function createMessage(sessionId: string, role: string, content: unknown): MessageHistory {
  const id = crypto.randomUUID()
  const stmt = db.prepare(`
    INSERT INTO message_history (id, session_id, role, content)
    VALUES (?, ?, ?, ?)
  `)
  stmt.run(id, sessionId, role, JSON.stringify(content))
  return getMessage(id)!
}

export function getMessage(id: string): MessageHistory | null {
  const stmt = db.prepare('SELECT * FROM message_history WHERE id = ?')
  const row = stmt.get(id) as Record<string, unknown> | null
  if (row) {
    return {
      ...row,
      content: JSON.parse(row.content as string)
    } as MessageHistory
  }
  return null
}

export function getMessagesBySessionId(sessionId: string): MessageHistory[] {
  const stmt = db.prepare('SELECT * FROM message_history WHERE session_id = ? ORDER BY created_at ASC')
  const rows = stmt.all(sessionId) as Record<string, unknown>[]
  return rows.map(row => ({
    ...row,
    content: JSON.parse(row.content as string)
  })) as MessageHistory[]
}

// Cost Tracking operations
export function createCostRecord(sessionId: string, agentId: string, creditsUsed: number, directCreditsUsed: number): CostTracking {
  const id = crypto.randomUUID()
  const stmt = db.prepare(`
    INSERT INTO cost_tracking (id, session_id, agent_id, credits_used, direct_credits_used)
    VALUES (?, ?, ?, ?, ?)
  `)
  stmt.run(id, sessionId, agentId, creditsUsed, directCreditsUsed)
  return getCostRecord(id)!
}

export function getCostRecord(id: string): CostTracking | null {
  const stmt = db.prepare('SELECT * FROM cost_tracking WHERE id = ?')
  return stmt.get(id) as CostTracking | null
}

export function getCostsBySessionId(sessionId: string): CostTracking[] {
  const stmt = db.prepare('SELECT * FROM cost_tracking WHERE session_id = ? ORDER BY created_at ASC')
  return stmt.all(sessionId) as CostTracking[]
}

export function getTotalCostBySessionId(sessionId: string): { total_credits: number; total_direct_credits: number } {
  const stmt = db.prepare(`
    SELECT 
      COALESCE(SUM(credits_used), 0) as total_credits,
      COALESCE(SUM(direct_credits_used), 0) as total_direct_credits
    FROM cost_tracking 
    WHERE session_id = ?
  `)
  return stmt.get(sessionId) as { total_credits: number; total_direct_credits: number }
}