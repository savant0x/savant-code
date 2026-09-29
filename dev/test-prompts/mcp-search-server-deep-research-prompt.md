# Deep Research Prompt — Unified MCP Search Server for Savant-Code

**Created:** 2026-08-18
**Purpose:** Feed to Gemini Deep Research to design a unified MCP search server with automatic rotation
**Method:** Attach this prompt + Savant-Code core files for context

---

## Prompt (paste into Gemini Deep Research)

Research Topic: Designing a Unified MCP Search Server with Backend Rotation for Savant-Code

I need a comprehensive architectural blueprint for building a single, unified MCP search server that rotates between multiple free search backends to maximize free query volume.

## The Core Idea

Instead of three separate MCP servers (one per search backend), build ONE MCP server that rotates between backends:

1. **Brave Search** — 2,000 free queries/month, reliable, official MCP server exists
2. **Exa** — generous free tier, neural/semantic search, official MCP server exists
3. **DuckDuckGo** — unlimited queries but fragile, community MCP server exists via `uvx duckduckgo-mcp-server`

When one hits its limit or fails, automatically rotate to the next. Combined, users get 6,000+ free queries/month before paid tiers kick in. DuckDuckGo acts as the unlimited (but unreliable) fallback.

## Why This Architecture

- **Users get 3x the free queries** — Brave 2K + Exa free tier + DDG unlimited
- **No downtime** — if one backend fails, rotate to the next
- **Single configuration** — one MCP server to set up, not three
- **Zero per-user keys** — the MCP server holds the keys, users just connect
- **Cross-platform** — runs on Windows, macOS, Linux via Bun

## Savant-Code Context (the system we're building on)

Savant-Code is a TypeScript/Bun terminal agent harness governed by the ECHO Protocol v0.2.0. Key properties:

### Governance (ECHO Protocol)
- 15 Laws enforced mechanically by EHEL (ECHO Harness Enforcement Layer)
- Perfection Loop FSM: RED → GREEN → AUDIT → ADVERSARIAL → SELF_CORRECT → COMPLETE → IMPLEMENT
- FID (Feature Implementation Document) lifecycle: created → analyzed → fixed → verified → converged → closed
- Anti-deferral gate: no silent scope drops, operator approval required for deferrals
- Implementation evidence required for FID closure (commit SHA or file:line + grep match)

### Agent Roster (10 roles)
- Orchestrator (routing, enforcement)
- Detective (codebase analysis, grep call-graphs)
- Forge (implementation only)
- Verifier (double-audit, test/grep, cite file:line evidence)
- Recorder (FID lifecycle, CHANGELOG)
- Thinker (sequential reasoning)
- Scout (glob/list_directory/read_files)
- Researcher (web search + docs)
- Scribe (session summaries, LEARNINGS.md)
- Adversary (meta-verification, refutes FAILs, re-audits unevidenced PASSes)

### Current State (v0.0.25)
- UI overhaul shipped (near-black/cyan design, animation engine, Easter egg)
- 5,429+ tests, typecheck ×4, ESLint, lint:md, prettier — all green
- FID queue empty (all 0816 program FIDs closed + archived)
- Release pipeline: release:public (tag → push → GitHub release → npm publish → binary verification)
- Auto Drive program (FID-001..010) implemented and verified — autonomous end-to-end execution
- Discord Rich Presence (FID-009) shipped with hardcoded client id + privacy redaction

### Technical Stack
- TypeScript strict, Bun 1.3.14
- OpenTUI 0.5.3 + React (terminal UI — current)
- Zustand + Immer for state management
- EHEL enforcement at tool-executor level

### Current Search Implementation (Broken)
- `web_search` — routes through Savant backend (Serper/Google), fails in direct mode
- `read_docs` — routes through Savant backend (Context7), fails in direct mode
- `read_url` — native HTTP fetch, works everywhere
- `read_files` — native disk read, works everywhere

## The Research Question

How do we design a unified MCP search server that:

1. **Combines Brave + Exa + DuckDuckGo into one MCP server** — single endpoint for Savant-Code
2. **Rotates between backends automatically** — when one hits its limit or fails, use the next
3. **Maximizes free query volume** — 2K Brave + Exa free tier + unlimited DDG = 6K+/month per user
4. **Provides documentation search** — search GitHub, ReadTheDocs, DevTo for relevant docs, then fetch with read_url
5. **Runs self-hosted** — on Windows, macOS, Linux via Bun
6. **Connects via MCP protocol** — stdio transport, auto-discovered by Savant-Code
7. **Requires zero user configuration** — the MCP server manages keys and rotation internally

## What I Need

1. **Rotation Algorithm** — How to decide which backend to use? Round-robin? Priority-based? Failure-driven? How to track per-backend usage?

2. **Rate Limit Tracking** — How to monitor Brave 2K limit? Local counter? Reset schedule? What happens when all limits hit?

3. **Backend Priority Order** — What's the default rotation order? Brave → Exa → DDG? Or DDG → Brave → Exa? Why?

4. **Failure Detection** — How to detect a backend is down vs. rate-limited vs. returning garbage? When to rotate vs. retry?

5. **Documentation Search Strategy** — No free docs index exists. How to find docs? GitHub API search + read_url? ReadTheDocs scraping? DevTo API? Search for "site:docs.bun.sh <query>"?

6. **Caching Layer** — Should search results be cached? How? Local SQLite? In-memory LRU? Deduplicate identical queries across backends?

7. **MCP Server Architecture** — Bun-based MCP server implementing the MCP spec. What's the tool surface? `web_search` and `read_docs` only? Or separate tools per backend?

8. **Savant-Code Integration** — How does Savant-Code discover and connect to the MCP server? Bundled binary? Auto-config? What's the MCP config JSON?

9. **Implementation Path** — Week 1, Week 2, Week 3. What ships first?

10. **Savant-Code Specifics** — Use actual file paths, actual agent roles, actual EHEL enforcement points. No generic architecture — this must be implementable in the savant-code repo.

## Constraints

- Must be free for end users (no per-user API keys)
- Must work in direct-provider mode (no backend proxy)
- Must be local-first, zero cloud dependency (except the search index itself)
- Must work within the existing TypeScript/Bun stack
- Must respect ECHO governance (no silent scope drops, operator approval required)
- Must leverage existing Auto Drive infrastructure (FID-001..010)

## Deliverable

A single comprehensive research document I can use as the architectural blueprint for building a unified MCP search server with backend rotation for Savant-Code. Include rotation algorithm, rate-limit tracking, backend priority, failure detection, docs search strategy, caching, MCP tool surface, and concrete implementation steps.

---

## Attachments for Gemini Deep Research

When running this prompt, attach the following files for context:

1. This prompt file
2. `README.md` (root)
3. `ARCHITECTURE.md`
4. `ECHO.md`
5. `AGENTS.md`
6. `dev/fids/FID-2026-0818-001-auto-drive-master.md` (Auto Drive master FID)
