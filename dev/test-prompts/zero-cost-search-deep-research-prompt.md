# Deep Research Prompt — Zero-Cost Search for 100K+ Users (Reject the $95/month Tax)

**Created:** 2026-08-18
**Purpose:** Feed to Gemini Deep Research to find a genuinely free search architecture
**Method:** Attach this prompt + Savant-Code core files for context

---

## Prompt (paste into Gemini Deep Research)

Research Topic: ZERO-COST Search Architecture for 100,000+ Coding Agent Users (No Monthly Fees, No API Keys, No Per-User Costs)

I need a comprehensive architectural blueprint for providing web search and documentation search to 100,000+ users of a coding agent. **This must cost $0/month flat — no $95 SearXNG server, no commercial API keys, no monthly fees.**

## Reject the Premise

Previous research concluded: "SearXNG + $95/month is the only answer." **We reject this.** There is always another way. The challenge is finding it.

The false assumptions in that conclusion:
- That users need "the entire web indexed"
- That search must return 10 blue links like Google
- That general-purpose web search is what developers actually need
- That there's no way around commercial API limits

## The Real Problem

Developers using an AI coding agent don't need Google. They need:

| Actual Need | What Developers Really Ask | Free Source |
|---|---|---|
| "How do I do X in [language]?" | Code examples, patterns | GitHub, DevDocs, ReadTheDocs |
| "Why is this error happening?" | Debugging, solutions | Stack Overflow, GitHub Issues |
| "What's the API for [library]?" | Documentation, types | DevDocs, official docs, TypeScript definitions |
| "Is there a newer version?" | Package metadata | npm, crates, pypi APIs (all free) |
| "What's the latest on [framework]?" | News, changelogs | RSS feeds, GitHub releases, DevTo |

**For 90% of coding agent queries, you don't need a general search engine.** You need structured, developer-specific sources that are free.

## Requirements

1. **$0/month flat cost** — no monthly fees, no API keys, no infrastructure to maintain
2. **Cross-platform** — Windows, macOS, Linux
3. **Self-hosted or fully client-side** — no central server, no single point of failure
4. **100,000+ users** — scales without per-user costs
5. **Legal and ToS-compliant** — no scraping that gets IPs banned
6. **Works offline where possible** — docs, examples, patterns should be cacheable
7. **Free when online** — uses only free APIs, free endpoints, free indexes

## Free Sources We Should Exhaust

### Code Search (All Free)
- **GitHub Search API** — 5,000 requests/hour with token (free), code search across all public repos
- **Sourcegraph** — free for public code, self-hostable
- **GitHub Code Search** — free via web, structured API

### Documentation (All Free)
- **DevDocs** — free, open-source, offline-capable docs aggregator
- **ReadTheDocs** — free, downloadable docs
- **Zeal / Dash** — free docset format, downloadable
- **DevTo API** — free, developer articles
- **Official docs** — most frameworks have downloadable/offline docs

### Q&A and Solutions (All Free)
- **Stack Exchange API** — free, 300 requests/day without key, 10,000 with free key
- **GitHub Issues** — free API, searchable

### Package Metadata (All Free)
- **npm registry API** — completely free, no key needed
- **crates.io API** — free
- **PyPI API** — free
- **pkg.go.dev** — free

### News and Updates (All Free)
- **RSS feeds** — free, every major framework has one
- **GitHub Releases API** — free
- **DevTo** — free API

## The Architecture We Need

Not a search engine. A **developer answer engine** that:

1. **Classifies the query** — "Is this a code example request? An error lookup? A docs question? A news question?"
2. **Routes to the right free source** — code → GitHub, error → Stack Overflow, docs → DevDocs, news → RSS
3. **Caches aggressively** — most questions have been asked before
4. **Falls back gracefully** — when no free source has the answer, the model uses its own knowledge

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

How do we build a **developer answer engine** that provides search and docs capabilities for 100,000+ users at **$0/month flat cost** by:

1. **Routing queries to the right free source** — not everything needs Google
2. **Pre-compiling documentation** — DevDocs/Zeal format, local SQLite, free CDN hosting
3. **Caching aggressively** — most queries are duplicates, cache at the edge
4. **Using model knowledge first** — LongCat 2.0 knows most answers; search is confirmation, not discovery
5. **Falling back to structured sources** — GitHub, Stack Overflow, npm, crates, PyPI

## What I Need

1. **Query Classification Taxonomy** — What are the ~10 types of developer queries? Which free source answers each?

2. **Documentation Pipeline** — How to pre-compile DevDocs/ReadTheDocs into downloadable SQLite docsets? Free CDN hosting (GitHub Releases, Cloudflare R2, Backblaze B2)?

3. **GitHub Search Integration** — How to use GitHub's free API for code examples? Rate limits? Caching?

4. **Stack Overflow Integration** — Free API limits? How to search for error solutions?

5. **Caching Architecture** — Local SQLite? In-memory LRU? How long to cache? How to invalidate?

6. **Query Routing Algorithm** — Given a user query, how does the system decide: model knowledge → cache → GitHub → Stack Overflow → docs → "I can't find this"?

7. **Graceful Degradation** — What happens when no free source has the answer? Honest "I don't know" instead of broken?

8. **Implementation Path** — Week 1, Week 2, Week 3. What ships first?

9. **Savant-Code Specifics** — Use actual file paths, actual agent roles, actual EHEL enforcement points. No generic architecture — this must be implementable in the savant-code repo.

## Constraints

- **$0/month flat** — this is non-negotiable
- **No per-user API keys** — users don't sign up for anything
- **No infrastructure to maintain** — no servers, no VPS, no Docker containers running 24/7
- **Cross-platform** — Windows, macOS, Linux
- **Local-first** — works offline for cached/compiled content
- **Legal** — no scraping that violates ToS or gets IPs banned
- **Works within existing TypeScript/Bun stack**
- **Respects ECHO governance**

## Existing Projects to Evaluate (GitHub-First)

Please research these specific open-source projects and evaluate how they can be leveraged:

- **DevDocs** — open-source docs aggregator, offline-capable
- **Zeal** — offline docset browser
- **Dash** — docset format (proprietary but format is documented)
- **DevTo** — free API for developer articles
- **DuckDuckGo MCP** — `uvx duckduckgo-mcp-server` (community)
- **Master-fetch** — MCP server with Cloudflare bypass (GitHub)
- **SearXNG** — metasearch engine (free but requires hosting)
- **Whoogle** — self-hosted Google proxy (free but requires hosting)
- **LibreY** — self-hosted metasearch (free but requires hosting)
- **Firecrawl** — web scraping API (has free tier)
- **Jina AI** — free summarizer/API

## Deliverable

A single comprehensive research document I can use as the architectural blueprint for a $0/month search system for 100K+ users. Include query taxonomy, source routing, caching architecture, documentation pipeline, and concrete implementation steps. Prove that $0/month is achievable.

---

## Attachments for Gemini Deep Research

When running this prompt, attach the following files for context:

1. This prompt file
2. `README.md` (root)
3. `ARCHITECTURE.md`
4. `ECHO.md`
5. `AGENTS.md`
6. `dev/fids/FID-2026-0818-001-auto-drive-master.md` (Auto Drive master FID)
