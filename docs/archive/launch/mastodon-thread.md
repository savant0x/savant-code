# Mastodon Launch Thread

Post 1/4 — intro

```text
Launching Savant Code, a local-first AI coding CLI.

The pitch: instead of generating code as fast as possible, a 10-agent ECHO
loop audits, critiques, and rewrites every change before it reaches your
codebase.

Built with TypeScript/Bun. Apache-2.0.
```

Post 2/4 — architecture

```text
The ECHO Protocol is the single bootstrap file that governs all 10 agents:

- Orchestrator: routes work
- Detective: explores the codebase
- Forge: implements
- Verifier: audits
- Recorder: tracks FIDs
- Thinker: reasons about approach
- Scout: gathers context
- Researcher: web/docs lookup
- Scribe: documentation
- Adversary: meta-verification

Separation of duties is enforced: the agent that writes code cannot verify it.
```

Post 3/4 — privacy / self-hosting

```text
Savant Code supports local Ollama and BYOK provider selection. If Ollama is
running, `savant-code` auto-detects it and routes inference locally; a remote
provider receives the prompt and context you choose to send it. No API key or
account is required for a local Ollama daemon. The broader telemetry/privacy
policy remains an explicit pre-launch decision and is not resolved by this post.
```

Post 4/4 — call to action

```text
We are doing a soft launch on r/LocalLLaMA and r/ChatGPTCoding this week before
a wider HN launch.

If you care about code correctness and privacy, we would love your feedback.

GitHub: https://github.com/savant0x/savant-code
Discord: not yet available; please use GitHub Issues for feedback.
```
