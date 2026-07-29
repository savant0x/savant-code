# Hacker News First Comment

This comment should be posted immediately after the submission.

---

Hi HN. I built Savant Code because I kept spending more time debugging
AI-generated code than it would have taken to write it myself.

The core bet is that accuracy matters more than speed. Savant Code runs a
9-agent ECHO loop before it writes anything to disk:

1. **Detective** explores the codebase and finds relevant context.
2. **Thinker** reasons about the approach.
3. **Forge** writes the change.
4. **Verifier** audits it.
5. If the audit fails, the loop self-corrects up to a hard limit.

Every step is transparent in the terminal. You can see which agent made which
decision and why.

Key trade-offs, because I think HN will ask:

- **It is slower than Copilot/Cursor.** The loop takes extra time because it
  audits before outputting. We think that is worth it for multi-file changes.
- **It is local-first.** If you run Ollama, your code never leaves your machine.
  BYOK mode is also supported; we do not have a paid "hosted inference" tier
  that sees your code. Remote providers receive only what you send them.
- **It is opinionated.** The ECHO Protocol enforces a strict workflow. Some
  developers will hate that. The ones who want correctness over speed will
  probably love it.
- **It is not perfect.** We have seen the loop get stuck in cycles on ambiguous
  prompts. That is why there is a hard iteration cap and a permission mode
  system (`safe` / `prompt` / `unsafe`).

What is currently broken / we need help with:

- Windows path handling in a few edge cases.
- Ollama auto-detection on non-standard ports.
- The TUI color scheme assumes a dark terminal.

If you try it, please file issues with real reproductions. We will be here for
 the next few hours.
