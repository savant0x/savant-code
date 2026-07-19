<!-- markdownlint-disable MD041 -->
<img src="../assets/banner.png" alt="@codebuff/cli — TUI source for Savant-Code and Savant-Free" width="650" />

# @codebuff/cli

The TUI source for both **Savant-Code** and **Savant-Free** — built with OpenTUI and React.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-%23000000?style=flat-square&logo=typescript&logoColor=%2300fbff)](https://www.typescriptlang.org/)[![Bun](https://img.shields.io/badge/Bun-1.3.14-%23000000?style=flat-square&logo=bun&logoColor=%2300fbff)](https://bun.sh/)[![OpenTUI](https://img.shields.io/badge/OpenTUI-0.2.2-%23000000?style=flat-square&logo=opentui&logoColor=%2300fbff)](https://github.com/anomalyco/opentui)[![React](https://img.shields.io/badge/React-19-%23000000?style=flat-square&logo=react&logoColor=%2300fbff)](https://react.dev/)[![ECHO](https://img.shields.io/badge/ECHO-v0.2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](../ECHO.md)

**For the end-user Quick Start** (how to install/launch Savant-Code or Savant-Free), see the [root README](../README.md#quick-start). This CLI package is the **internal dev source** used to build both CLI binaries.

## Installation

```bash
bun install
```

## Development

Run the TUI in development mode:

```bash
bun run dev
```

## Testing

Run the test suite:

```bash
bun test
```

### Interactive E2E Testing

For testing interactive CLI features, install tmux:

```bash
# macOS
brew install tmux

# Ubuntu/Debian
sudo apt-get install tmux

# Windows (via WSL)
wsl --install
sudo apt-get install tmux
```

Then run the proof-of-concept:

```bash
bun run test:tmux-poc
```

**Note:** When sending input to the CLI via tmux, you must use bracketed paste mode. Standard `send-keys` drops characters.

```bash
# ❌ Broken: tmux send-keys -t session "hello"
# ✅ Works:  tmux send-keys -t session $'\e[200~hello\e[201~'
```

See [tmux.knowledge.md](tmux.knowledge.md) for comprehensive tmux documentation and [src/__tests__/README.md](src/__tests__/README.md) for testing documentation.

## Build

Build the package:

```bash
bun run build
```

## Run

Run the built TUI:

```bash
bun run start
```

Or use the binary directly:

```bash
codebuff-tui
```

## Features

- Built with OpenTUI for modern terminal interfaces
- Uses React for declarative component-based UI
- TypeScript support out of the box
- Multi-agent orchestration via [ECHO Protocol v0.2.0](../ECHO.md) (9 specialized agents)
- ECHO-driven Perfection Loop: RED → GREEN → AUDIT → SELF-CORRECT → COMPLETE
- FID-Bound Execution: code is never written until the FID converges

---

<div align="center">

_This CLI source is part of the [codebuff/savant-code monorepo](https://github.com/savant0x/savant-code), governed by the [ECHO Protocol](../ECHO.md)._

**Savant** • 2026
</div>

---

## License

Apache-2.0 — this project ships under the [root LICENSE](../LICENSE) file. See [LICENSE](../LICENSE) for full text.
