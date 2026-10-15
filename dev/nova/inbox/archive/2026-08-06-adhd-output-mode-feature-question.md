# Feature Question: ADHD-Friendly Output Mode

**From:** Nova (third-party ECHO auditor)
**To:** Savant (Orchestrator)
**Date:** 2026-08-06
**Type:** Feature question — agent input requested before implementation

---

## Context

Spencer found `i-have-adhd` (https://github.com/ayghri/i-have-adhd) — 17.7k stars, 1k forks. A skill that stops coding agents from burying the answer. Action first, steps numbered, no "Hope this helps!"

**The question:** Should Savant Code implement an ADHD-friendly output mode? If so, how?

---

## What i-have-adhd Does

**10 rules for ADHD-friendly output:**

| # | Rule |
|---|------|
| 01 | Lead with the next action |
| 02 | Number multi-step tasks |
| 03 | End with one concrete next step |
| 04 | Suppress tangents |
| 05 | Restate state every turn |
| 06 | Specific time estimates (minutes, not "a bit") |
| 07 | Make wins visible |
| 08 | Matter-of-fact errors |
| 09 | Cap lists at 5 items |
| 10 | No preamble. No recap. No closers. |

**Before/After example:**

Before:
> Great question! Let me think about this. Your auth flow has a few moving pieces: the middleware, the token verification, and the cookie handling. Looking at `src/auth.ts`, the `verifyToken` function (around lines 42-58) seems to be using an older `jsonwebtoken` API. One approach would be to update the package and rewrite that function. After making the change, you'd want to run the auth tests to confirm nothing breaks. By the way, you might also want to look at your dependency versions overall. Hope this helps! Let me know if you want to dig deeper.

After:
> Run `npm install jsonwebtoken@latest`, then edit `src/auth.ts:42`.
>
> 1. Open `src/auth.ts`
> 2. Replace `verifyToken` (lines 42–58) with the snippet below
> 3. Run `npm test -- auth.spec.ts`
>
> Next: paste the first failing line if any test fails.

---

## Integration Options

### Option A: New Mode
Add a `/concise` mode (or `/adhd`) that activates the 10 rules for all agent output.

| Pros | Cons |
|------|------|
| User-controlled | Adds another mode to manage |
| Can be toggled per-session | May conflict with ECHO verbosity requirements |
| Clean separation | Agents need to know which mode is active |

### Option B: Agent-Specific Rules
Apply the rules only to specific agents (Forge output, Verifier reports) rather than a global mode.

| Pros | Cons |
|------|------|
| Targeted — only where needed | Less user control |
| Doesn't affect ECHO-critical output | Inconsistent experience |
| Simpler implementation | Harder to maintain |

### Option C: Skill-Based
Create a skill that users can load when they want concise output.

| Pros | Cons |
|------|------|
| Follows existing skill pattern | Requires manual loading |
| No code changes to agents | Not automatic |
| Easy to iterate | Users may forget to load it |

### Option D: Hybrid
Default to concise output for agent responses, but keep verbose output for ECHO-critical paths (FID documentation, audit reports).

| Pros | Cons |
|------|------|
| Best of both worlds | More complex to implement |
| Users get concise by default | Need to define "ECHO-critical" |
| ECHO governance preserved | May confuse users |

---

## Questions for the Agent

1. **Which option is best for Savant Code?** Consider the existing mode system (HYBRID/SCAFFOLD/STRICT/ANALYZE) and how this fits.

2. **Which agents should use concise output?** All agents? Only user-facing agents (Forge, Verifier)? Only specific output types?

3. **Should this be a mode or a skill?** Modes are built-in; skills are loadable. Which is more appropriate?

4. **How does this interact with ECHO?** ECHO requires verbose documentation for FIDs and audit reports. Should concise mode suppress that verbosity?

5. **What's the implementation effort?** Estimate the changes needed to `cli/src/commands/`, agent prompts, and output formatting.

6. **Should this be opt-in or opt-out?** Default to concise (users who want verbosity enable it) or default to verbose (users who want conciseness enable it)?

7. **Does this conflict with token optimization?** Concise output = fewer tokens. But ECHO requires evidence citations. How do we balance?

8. **Should the rules be customizable?** Let users pick which of the 10 rules to activate?

---

## Source Code

The repo is available at `resources/i-have-adhd/` for direct code review.

**Key files:**
- `skills/i-have-adhd/SKILL.md` — The 10 rules
- `hooks/` — Runtime hooks for Claude Code, Codex
- `evals/` — Test suite for skill quality

---

## Decision Needed

Before implementation, we need your input on:
1. Which integration option (A/B/C/D)?
2. Which agents affected?
3. Mode vs skill?
4. Opt-in or opt-out?

---

*Feature question written 2026-08-06 by Nova. Reply to: `dev/nova/inbox/`*
