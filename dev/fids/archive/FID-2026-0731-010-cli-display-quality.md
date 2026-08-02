# FID: CLI Display Quality — Excessive Spacing and Missing Markdown Formatting

**Filename:** `FID-2026-0731-010-cli-display-quality.md`
**ID:** FID-2026-0731-010
**Severity:** high
**Status:** closed
**Created:** 2026-07-31 12:00
**Author:** Buffy

---

## Summary

Two related CLI display quality issues: (1) excessive vertical spacing between code blocks and blockquotes, and (2) the agent system prompt does not instruct the LLM to use markdown formatting in its responses.

## Environment

- **OS:** Windows (win32)
- **Language/Runtime:** TypeScript / Bun
- **Tool Versions:** OpenTUI + React CLI

## Detailed Description

### Problem 1: Excessive Spacing

`renderCodeBlock` and `renderBlockquote` in `markdown-renderer.tsx` add `\n\n` after their content, causing excessive blank lines.

### Problem 2: Agent Not Using Markdown

The system prompt lacks instructions for the LLM to format responses with markdown (bullets, tables, headings, etc.).

## Perfection Loop

### RED Phase — 2 Issues Found

| # | Issue | Location | Fix |
|---|-------|----------|-----|
| 1 | Double newline after code blocks | `renderCodeBlock` L530 | `\n\n` → `\n` |
| 2 | Double newline after blockquotes | `renderBlockquote` L566 | `\n\n` → `\n` |
| 3 | No markdown instructions in system prompt | `agents/savant/savant.ts` | Add formatting section |

### GREEN Phase — Fixes Applied

1. Changed `\n\n` → `\n` in `renderCodeBlock` and `renderBlockquote`
2. Added diagnostic logging to `renderMarkdown` catch block
3. Added "Response Formatting" section to system prompt

### AUDIT Phase — All Passing

| Check | Result |
|-------|--------|
| Typecheck | ✅ Pass (exit code 0) |
| Tests | ✅ 18/18 pass, 0 fail |
| Code Review | ✅ Approved |

### Missed Questions

1. Should headings keep `\n\n`? → Yes, they serve as visual section separators
2. Should thematic breaks keep `\n\n`? → Yes, same reason
3. Does `nodeToPlainText` still use `\n\n`? → Yes, but only in fallback path

### Code Verification Evidence

- [x] Typecheck passes
- [x] Tests pass (18/18)
- [x] Code review approved
- [x] FID status updated

## Resolution

- **Fixed By:** Buffy
- **Fixed Date:** 2026-07-31 12:30
- **Fix Description:** Changed \n\n to \n in renderCodeBlock and renderBlockquote; added markdown formatting instructions to agent system prompt
- **Tests Added:** No new tests needed
- **Verified By:** Typecheck + 18/18 tests + code-reviewer-mimo

## Lessons Learned

1. Keep `\n\n` for headings and dividers — they serve as visual section separators
2. Agent behavior depends on system prompt instructions
3. Always follow ECHO Law 2: present before act
