import fs from 'fs'
import os from 'os'
import path from 'path'

import { Database } from 'bun:sqlite'

// Database path
const DB_DIR = path.join(os.homedir(), '.savant-free')
const DB_PATH = path.join(DB_DIR, 'echo.db')

// Ensure directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

// Create database connection
const db = new Database(DB_PATH)

// Enable WAL mode for better performance
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

// Create schema
function createSchema(): void {
  db.exec(`
    -- Schema version tracking
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Sessions: Core session state and metadata
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      selected_model TEXT DEFAULT '',
      session_state TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Agent Templates: Agent definition templates
    CREATE TABLE IF NOT EXISTS agent_templates (
      id TEXT PRIMARY KEY,
      template TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Agent Configs: Runtime agent configurations (instance-specific)
    CREATE TABLE IF NOT EXISTS agent_configs (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id),
      template_id TEXT REFERENCES agent_templates(id),
      config TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- FID Documents: Foundation Implementation Documents
    CREATE TABLE IF NOT EXISTS fid_documents (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id),
      content TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      perfection_loop_phase TEXT DEFAULT 'idle',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Message History: Chat messages
    CREATE TABLE IF NOT EXISTS message_history (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Cost Tracking: Cost and usage analytics
    CREATE TABLE IF NOT EXISTS cost_tracking (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id),
      agent_id TEXT NOT NULL,
      credits_used REAL DEFAULT 0,
      direct_credits_used REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_sessions_chat_id ON sessions(chat_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON sessions(agent_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_fid_documents_session_id ON fid_documents(session_id);
    CREATE INDEX IF NOT EXISTS idx_fid_documents_status ON fid_documents(status);
    CREATE INDEX IF NOT EXISTS idx_message_history_session_id ON message_history(session_id);
    CREATE INDEX IF NOT EXISTS idx_cost_tracking_session_id ON cost_tracking(session_id);
    CREATE INDEX IF NOT EXISTS idx_cost_tracking_agent_id ON cost_tracking(agent_id);
  `)
}

// Initialize schema
createSchema()

// Export database and types
export { db }
export type DatabaseType = typeof db

// Helper functions
export function getDatabase(): typeof db {
  return db
}

export function closeDatabase(): void {
  db.close()
}
