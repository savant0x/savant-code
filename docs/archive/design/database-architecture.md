# Database Architecture — `@savant-code/database`

## Context

**Agent**: Thinker  
**Created**: 2026-07-16 (design session)  
**Implemented**: 2026-07-16  
**Status**: IMPLEMENTED  
**Package**: `packages/database/`

## Problem Statement

The ECHO/Savant system stores vital state (session state, agent configurations, FID documents, message history, cost
tracking) that needs durable, queryable storage. JSON files on disk have critical flaws:

1. **Serialization cycles** — Live function references in session state objects cause `JSON.stringify` to fail when
   cloning between runs
2. **No durability** — Crashes, restarts, or hot reloads lose all state
3. **No queryability** — Cannot search session history, track costs, or audit agent actions
4. **Fragile state management** — Cloning in-memory objects between runs is error-prone

## Solution

SQLite database via `bun:sqlite` (Bun's built-in SQLite driver — no external dependency required).

### Core Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                    ECHO System                          │
├─────────────────────────────────────────────────────────┤
│  Agent Runtime  │  Session Manager  │  FID Manager      │
├─────────────────────────────────────────────────────────┤
│                    Database Layer                       │
│              packages/database/src/                     │
├─────────────────────────────────────────────────────────┤
│                 bun:sqlite (built-in)                   │
├─────────────────────────────────────────────────────────┤
│                  SQLite File                            │
│              (~/.savant-free/echo.db)                   │
└─────────────────────────────────────────────────────────┘
```

### Database Schema (7 Tables)

```sql
-- 0. Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 1. Sessions: Core session state and metadata
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  selected_model TEXT DEFAULT '',
  session_state TEXT NOT NULL,       -- Full SessionState blob (JSON serialized)
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Agent Templates: Agent definition templates
CREATE TABLE IF NOT EXISTS agent_templates (
  id TEXT PRIMARY KEY,
  template TEXT NOT NULL,            -- AgentTemplate blob (JSON serialized)
  version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Agent Configs: Runtime agent configurations (instance-specific)
CREATE TABLE IF NOT EXISTS agent_configs (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id),
  template_id TEXT REFERENCES agent_templates(id),
  config TEXT NOT NULL,              -- AgentConfig blob (JSON serialized)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. FID Documents: Foundation Implementation Documents
CREATE TABLE IF NOT EXISTS fid_documents (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id),
  content TEXT NOT NULL,             -- Markdown content
  status TEXT DEFAULT 'draft',       -- draft, in_progress, complete
  perfection_loop_phase TEXT DEFAULT 'idle',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Message History: Chat messages
CREATE TABLE IF NOT EXISTS message_history (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,             -- MessageContent[] (JSON serialized)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Cost Tracking: Cost and usage analytics
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
```

### Service Layer

`packages/database/src/service.ts` provides typed CRUD operations for all tables:

| Function | Table | Purpose |
|----------|-------|---------|
| `createSession()` | sessions | Create a new session with agent state |
| `getSession()` | sessions | Load session by ID (deserializes JSON state) |
| `updateSession()` | sessions | Persist updated session state |
| `getSessionsByChatId()` | sessions | List sessions for a chat |
| `updateSessionModel()` / `saveModel()` / `getLatestModel()` | sessions | Model selection persistence |
| `createAgentTemplate()` | agent_templates | Register agent definition |
| `createAgentConfig()` | agent_configs | Create instance-specific config |
| `createFidDocument()` | fid_documents | Create FID with markdown content |
| `updateFidDocument()` | fid_documents | Update content, status, FSM phase |
| `createMessage()` | message_history | Store chat message |
| `getMessagesBySessionId()` | message_history | Retrieve session history |
| `createCostRecord()` | cost_tracking | Record agent usage costs |
| `getTotalCostBySessionId()` | cost_tracking | Aggregate costs for a session |

## Technical Decisions

### Decision 1: SQLite via `bun:sqlite`

**Choice**: Use Bun's built-in `bun:sqlite` driver (zero external dependencies).  
**Rationale**:

- Ships with Bun — no `npm install` needed
- Synchronous API (simpler error handling, no async overhead)
- WAL mode for crash recovery and concurrent reads
- Foreign key support enabled by default
- File-based — single `echo.db` file, easy to backup/restore

**Alternatives Considered**:

- `better-sqlite3`: External dependency, same API shape, but `bun:sqlite` is equivalent and built-in
- PostgreSQL: Requires server process, overkill for local CLI tool
- `drizzle-orm`: Schema abstraction layer — adds complexity without benefit for this simple schema

### Decision 2: TEXT Columns + Manual JSON Serialization

**Choice**: Store complex data as `TEXT` columns with `JSON.stringify()`/`JSON.parse()` in the service layer.  
**Rationale**:

- Session state is a black box (server protocol, different shapes per agent)
- Agent configs are dynamic (different tool sets, model options)
- Simpler schema — fewer tables, no ORM
- SQLite JSON functions (`json_extract`, etc.) available if needed later

**Alternatives Considered**:

- SQLite native JSON columns: Less portable, `bun:sqlite` treats JSON as TEXT anyway
- Fully normalized schema: Too rigid, breaks when session state schema changes

### Decision 3: Global Storage Location

**Choice**: Store database at `~/.savant-free/echo.db`  
**Rationale**:

- Persists across projects
- Follows XDG conventions (`~/.config/` or `~/.local/share/` pattern)
- Easy to backup/restore (single file)
- Single database for all sessions

### Decision 4: WAL Mode

**Choice**: Enable Write-Ahead Logging (`PRAGMA journal_mode = WAL`)  
**Rationale**:

- Crash recovery — committed transactions survive process kills
- Concurrent reads — multiple processes can read while one writes
- Performance — faster than rollback journal for mixed read/write workloads

## Files

| File | Purpose |
|------|---------|
| `packages/database/src/index.ts` | DB connection, schema creation, exports |
| `packages/database/src/service.ts` | Typed CRUD operations for all tables |
| `packages/database/package.json` | `@savant-code/database` workspace package |
| `packages/database/tsconfig.json` | TypeScript config |
| `packages/database/README.md` | Package documentation |

## Status

- [x] Schema design complete
- [x] `bun:sqlite` connection + WAL mode
- [x] All 7 tables created with indexes
- [x] Service layer with typed CRUD operations
- [x] Session state serialization/deserialization
- [x] Model selection persistence
- [x] FID document storage
- [x] Message history storage
- [x] Cost tracking aggregation
