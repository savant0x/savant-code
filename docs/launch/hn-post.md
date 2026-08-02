# Show HN Post

**Title:** Show HN: Savant Code – a local-first AI coding CLI with a 9-agent auditing loop

**URL:** <https://github.com/savant0x/savant-code>

**Body:**

Savant Code is a terminal-native AI coding assistant built for developers who
are tired of cleaning up hallucinated code. It runs locally with Ollama or
connects to your own API keys (BYOK). With local Ollama, your code never leaves
your machine.

The core idea is a 9-agent "perfection loop" (we call it ECHO) that audits,
critiques, and rewrites code before it ever reaches your codebase. Detective
finds issues. Forge implements. Verifier audits. The loop repeats up to a hard
cap, with explicit permission controls so you know exactly what is about to run.

It is slower than Copilot. That is the point. We would rather ship code that
actually works.

Install the v0.0.15 release:

```bash
npm install -g savant-code
```

Then just run `savant-code` in any project. If you have Ollama running, it will
auto-detect and use it. No account, no API key, no setup prompts.

Built with TypeScript, Bun, and React for the TUI. Apache-2.0 licensed. We are
opening it up for stress-testing before a wider launch.

We would love feedback from anyone with a real codebase. Especially interested in
edge cases on Windows and unusual Ollama setups.
