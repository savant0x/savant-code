# Newsletter Pitch (Console.dev style)

**To:** Console.dev submissions
**Subject:** Submission: Savant Code — local-first AI coding CLI with a
10-agent auditing loop

---

Hi Console.dev team,

I would like to submit Savant Code for consideration.

## What it is

Savant Code is an open-source, terminal-native AI coding assistant. Instead of
racing to generate code as fast as possible, it runs a 10-agent "perfection
loop" that audits, critiques, and rewrites changes before they touch your
codebase.

## Why it matters

Most AI coding tools optimize for speed. Savant Code optimizes for correctness.
The loop is slower by design, but the output is code that actually works. It is
built for developers who are tired of debugging hallucinated patches.

## Local-first and provider choice

- Local-first: auto-detects Ollama and routes inference locally.
- BYOK: bring your own API keys if you prefer; remote providers receive the
  prompt and context you choose to send them.
- No mandatory account is required for a local Ollama workflow.
- Telemetry/privacy policy remains an explicit pre-launch decision and is not
  asserted as resolved by this submission.

## Built with

- TypeScript + Bun
- React + OpenTUI for the terminal UI
- ECHO Protocol for agent governance
- Apache-2.0 license

## Links

- GitHub: <https://github.com/savant0x/savant-code>
- Docs: <https://github.com/savant0x/savant-code/blob/main/ECHO.md>

Thanks for considering it.

— The Savant Code team
