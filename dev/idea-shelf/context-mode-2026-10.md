# Context Mode (mksglu) — Eval + Shelf Note (2026-10-08)

Source: https://github.com/mksglu/context-mode — **25.4k stars** (global rank #1668),
2,221 commits, created 2026-02-23. Author: mksglu (Mustafa Komur). Licence:
**Elastic License 2.0** (source-available) — explicit anti-SaaS choice: "MIT permits
repackaging as a competing closed-source SaaS; ELv2 prevents that."

## What it is
Context-window optimization for coding agents, operating at the **MCP protocol layer**:
- **Sandboxed tool output** — raw data stays in a subprocess, never enters context.
  Claims: 98% reduction (986KB → 62KB batch, 7.5MB JSON → 0.9KB, 56KB → 299B execute)
- **11 MCP tools**: 6 sandbox (ctx_execute/execute_file/batch_execute/index/search/
  fetch_and_index) + 5 meta (stats/doctor/upgrade/purge/insight)
- **SQLite FTS5 knowledge base** (bun:sqlite / node:sqlite / better-sqlite3 auto-select),
  BM25 ranking, 14-day TTL cleanup
- **Session continuity** via hooks: PreCompact fires → priority-tiered XML snapshot (≤2KB)
  → SessionStart restores → model continues with full working state. 17 platforms
- **Intent-driven filtering**: output >5KB + intent → index full output, return only
  matches + searchable vocabulary

## Platform support (the compatibility matrix is the artifact)
Full continuity (capture+snapshot+restore): Claude Code, Gemini CLI, VS Code Copilot,
JetBrains Copilot, OpenCode, KiloCode. Partial: Cursor, GitHub Copilot CLI, Antigravity,
Codex CLI, Kiro, Zed, Pi, OMP (~98% compliance, parity with Claude Code hooks).
MCP-only fallback = ~60% compliance (rule-based via SYSTEM.md). Tracking issue #775.
OpenCode = full support via plugin (opencode.json plugin array).

## Security posture (the interesting part)
- **Project-boundary containment on by default**: ctx_execute_file refuses paths outside
  the workspace — closes issue #852 escape vector where an agent denied an out-of-project
  read by the host sandbox RETRIED through the MCP sandbox (invisible to the approval
  prompt, which can't inspect input params)
- Honors the host's permissions.allow rules (one place, stays meaningful)
- Approval titles reworded as code execution so unfamiliar reviewers can recognize the class
- Honest disclosure: "ctx_execute/ctx_batch_execute run arbitrary code and still inherit
  the process's filesystem access — the boundary guard is defense-in-depth for the
  file-read tool, not a full OS sandbox. Treat approving any execution tool as approving
  arbitrary code."

## Why this matters for Savant (the direct hits)
1. **The ECHO connection is in the name**: the issue-#852 escape vector (agent denied by
   host sandbox → retried through MCP sandbox → invisible to approver) is EXACTLY the
   cross-agent claim rule / tool-executor enforcement territory EHEL covers. A real-world
   exploit pattern matching ECHO's threat model
2. **The 98% sandbox reduction is the cache-thesis mirror**: we cache-harvest free
   compute; context-mode reduces the demand side. Same economics, opposite lever —
   Spencer's cache research (10-07) + this = both sides of the token-cost equation
3. **PreCompact→snapshot→restore** = the compaction-recovery pattern (2KB priority-tiered
   XML) — directly comparable to Hermes's compaction LLM rewrite (v0.0.32) and the
   session-grounding skill. Portable: the ≤2KB priority-tiered snapshot format
4. **intent-driven filtering** (index full output, return intent-matches + vocabulary) —
   a stronger pattern than truncation; relevant to savant-code's own tool-output handling

## Shelf verdict
SHELVED as an install (OpenCode plugin = full support if ever wanted; ELv2 licence is
clean for internal use). PATTERNS to steal: (a) the #852 escape-vector threat model →
EHEL test case, (b) ≤2KB priority-tiered compaction snapshot format, (c) intent-driven
filtering over truncation, (d) the 17-platform compliance matrix as requirements research
for Savant Desktop's hook support.
Re-activation trigger: savant-code cache/prompt-cost work (in flight) — this is the
demand-side lever for the same equation.
