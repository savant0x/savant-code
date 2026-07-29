# Mastodon Launch Thread

Post 1/4 — intro

```text
Launching Savant Code, a local-first AI coding CLI.

The pitch: instead of generating code as fast as possible, a 9-agent ECHO loop
audits, critiques, and rewrites every change before it reaches your codebase.

Built with TypeScript/Bun. Apache-2.0.
```

Post 2/4 — architecture

```text
The ECHO Protocol is the single bootstrap file that governs all 9 agents:

- Detective: explores the codebase
- Thinker: reasons about approach
- Forge: implements
- Verifier: audits
- Recorder: tracks FIDs
- Scout: gathers context
- Researcher: web/docs lookup
- Scribe: documentation
- Orchestrator: routes work

Separation of duties is enforced: the agent that writes code cannot verify it.
```

Post 3/4 — privacy / self-hosting

```text
Savant Code is BYOK/local-Ollama by design. We do not have a hosted inference
tier that sees your code.

If Ollama is running, `savant-code` auto-detects it and routes inference locally.
No API key, no account, and telemetry defaults to off.

Telemetry and ads are opt-in and default to off.
```

Post 4/4 — call to action

```text
We are doing a soft launch on r/LocalLLaMA and r/ChatGPTCoding this week before
a wider HN launch.

If you care about code correctness and privacy, we would love your feedback.

GitHub: https://github.com/savant0x/savant-code
Discord: [invite link TBD]
```
