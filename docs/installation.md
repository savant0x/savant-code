<!-- markdownlint-disable MD013 -->
# Installation

**Get started with Savant Code in 30 seconds.**

---

## Prerequisites

- **Node.js** — v16 or later (the npm wrapper launches a platform binary)
- **Ollama** (optional) — For local inference, no API key required

---

## Install

```bash
npm install -g savant-code
```

`npm i savant-code -g` is the equivalent short form. Published as
[`savant-code` on npm](https://www.npmjs.com/package/savant-code).

---

## Quick Start

```bash
cd your-project
savant-code
```

Describe the change you want. Savant Code explores the repository, plans the work, implements approved changes, and verifies the result.

---

## Local Inference with Ollama

If Ollama is installed and running, it is detected automatically:

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a coding model
ollama pull codellama
# or
ollama pull deepseek-coder

# Launch Savant Code
savant-code
```

Run `/health` inside the chat to inspect Ollama connectivity, available local models, provider mode, and permission mode.

---

## Hosted Providers

Savant Code supports multiple hosted providers. The CLI **boots to OpenRouter
by default** (`openrouter/free` free tier), so `/provider openrouter` is the
fastest path. Use the interactive picker:

```bash
/provider
```

Or configure one directly:

| Provider | Command | Environment Variable |
|----------|---------|---------------------|
| OpenRouter | `/provider openrouter` | `OR_MASTER_KEY`, `OPENROUTER_API_KEY`, or `INFERENCE_API_KEY` (default provider) |
| OpenCode Go | `/provider opencode-go` | `OPENCODE_GO_API_KEY` |
| TokenRouter | `/provider tokenrouter` | `TOKENROUTER_API_KEY` |
| TokenHarbor | `/provider tokenharbor` | `TOKENHARBOR_API_KEY` |
| NVIDIA NIM | `/provider nvidia` | `NVIDIA_API_KEY` |
| CommandCode | `/provider commandcode` | `COMMAND_CODE_API_KEY` |
| Nous Research | `/provider nous` | `NOUS_API_KEY` (direct OpenAI-compatible API; Portal OAuth is separate) |

---

## Configuration

Credentials are stored in the user configuration directory:

- **Windows:** `C:\Users\<username>\.savant-code\credentials.json`
- **macOS/Linux:** `~/.savant-code/credentials.json`

Shell environment variables take precedence over saved credentials.

---

## First Launch

1. **Install:** `npm install -g savant-code`
2. **Navigate:** `cd your-project`
3. **Launch:** `savant-code`
4. **Configure provider:** `/provider` (or use Ollama automatically)
5. **Start coding:** Describe what you want to build

---

## Verification

After installation, verify everything works:

```bash
# Check version
savant-code --version

# Check health
# Inside Savant Code, run:
/health
```

---

## Troubleshooting

### Permission Errors

```bash
# Use a user-writable installation
npm install -g savant-code

# Or with elevated permissions
sudo npm install -g savant-code
```

### No Model Available

Run `/provider` to configure a hosted provider (boot default is OpenRouter's
free tier), or install and start Ollama for local inference.

### Headless / scripting

```bash
# Run a single prompt without the TUI, print the answer to stdout
savant-code --print "refactor the error handling"

# Pipe a prompt in (auto-headless)
echo "summarize this repo" | savant-code
```

Exit codes: `0` success, `1` error/timeout, `2` usage error. Set
`SAVANT_CODE_RUN_TIMEOUT_MS` to bound long runs.

### Provider Connection Issues

```bash
# Check provider status
# Inside Savant Code, run:
/health
```

---

## Next Steps

- [ECHO Protocol](echo-protocol.md) — Learn about the governance system
- [Agent Roster](agents.md) — Understand the 10 agents
- [Features](features.md) — Explore all features
- [GitHub](https://github.com/savant0x/savant-code) — Source code
