<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Idea-Farm — YT Roundup Triag (ManuAGI #283, 2026-08-15)

**Logged:** 2026-08-15
**Status:** SHELVED — brainstorming capture from a YouTube roundup. Spencer reviewing aloud before his work session; NOT pressing. Revisit if any item becomes relevant.
**Source:** https://www.youtube.com/watch?v=8V348y_VYZ4 (ManuAGI - AutoGPT Tutorials, #283)

## Picks Spencer flagged (all verified real, links included)

| Pick | Repo | Stars | Why flagged |
|---|---|---|---|
| git-knife | https://github.com/TheRealYT/git-knife | 318 | **ACTIONABLE** — edits commit author/committer dates + name/email via `commit-tree` (file contents unchanged), bulk regex, auto-backup `refs/knife-backup/`. Could strip the CommandCode author from savant-code git history safely. v0.3.0, active. |
| Ante | https://github.com/AntigmaLabs/ante | 1.8k | Deep-dive candidate. Rust single-binary coding agent, BYOK, 12+ providers, multi-agent, MCP, memory. Apache-2.0. Same local-first philosophy as Savant-Code, no governance layer. Competitive landscape. |
| Orca | https://github.com/stablyai/orca | 46k | Multi-agent ADE fleet (parallel coding agents, isolated worktrees). Already cloned in `resources/`. Reference for fan-out architecture. |
| Cursor plugins | https://github.com/cursor/plugins | 2.9k | Plugin spec: manifest + skills/ + rules/ + mcp.json. Maps to Savant-Code skill system. Marketplace-structure reference. MIT. |
| diagram-design | https://github.com/cathrynlavery/diagram-design | 18.4k | 29 editorial diagram types, brand-matched HTML/SVG. Ties to `architecture-diagram` skill for branded Savant docs. |
| watermark-remover | https://github.com/guillaumemeyer/watermarks-remover | 9.5k | Strips AI provenance (Unicode/crypto/C2PA) from files. Privacy tool, not core. |
| chatbot-template | https://github.com/shadcn-ui/chatbot-template | 685 | Next.js + AI SDK + Vercel Gateway. Idea-farm for a user-facing Savant chat UI. MIT. |
| arc-task-gen | https://github.com/pathwaycom/arc-task-gen | 2.4k | Generates ARC-AGI-1-style tasks distribution-matched to public eval. Spencer: could enhance internal benchmark tool as a feature. MIT. |
| attention-span | https://github.com/alexgreensh/attention-span | 414 | ADHD-friendly output *styles* (markdown files changing how agent talks). Spencer: enable different modes. AGPL-3.0 (copyleft — concept only, can't embed). |
| PLEXI | https://github.com/ianjamesburke/PLEXI | 14 | "Terminal's dad" — Rust + egui terminal env. Cool but alpha, not relevant. Skip. |
| rustdesk | https://github.com/rustdesk/rustdesk | (huge) | Self-hostable Rust remote desktop. Personal infra, not idea-farm. |

## Also noted
- Spencer mentioned possibly **redesigning a lot of the terminal** (Savant-Code UI). Flagged as a future consideration, NOT to start before current session work. Logged so the thought isn't lost.
- **Full backstory + thesis captured in dedicated note:** `terminal-visual-rust-unification.md` — covers the Rust-origin → FreeBuff-fork → TS → Rust-again arc, the Savant Core unification driver, and the "one mind, a thousand faces" north-star. Not committed; endgame Rust rewrite in crosshairs, not on plate.

## Re-activation trigger
- git-knife → when ready to clean CommandCode author from savant-code history (verify `commit-tree` preserves trees, test on a scratch branch first).
- Ante → when doing competitive-analysis of local-first agent harnesses.
- arc-task-gen → when enhancing the internal benchmark/eval tool.
- attention-span → when adding output-mode system to Savant-Code (concept: mode = output-style file).
- Terminal redesign → after current feature work, as its own FID track.
