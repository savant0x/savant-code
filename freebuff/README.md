<!-- markdownlint-disable MD041 -->
<img src="../assets/banner.png" alt="Freebuff — The free coding agent. No subscription, no config." width="650" />

# Freebuff

**The free coding agent** — no subscription, no API key, no configuration. Start in seconds.

An AI coding agent that runs in your terminal. Describe what you want, and Freebuff edits your code. Built from the same `@codebuff/cli` source as Savant-Code, then compiled with `FREEBUFF_MODE=true` so the bundler strips paid-only features (credits UI, mode switching, MAX/PLAN prompts).

[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=apache&logoColor=%2300fbff)](LICENSE)[![ECHO](https://img.shields.io/badge/ECHO-v0.2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](../ECHO.md)[![Release](https://img.shields.io/badge/Release-pre__publishing-%23ff9500?style=flat-square&logo=semver&logoColor=%2300fbff)](../CHANGELOG.md)

## Features

- **Zero-config** — no API key (uses bundled inference), no account, no subscription
- **Multi-agent orchestration** — 9 specialized ECHO agents coordinate via [ECHO Protocol v0.2.0](../ECHO.md)
- **Perfection Loop** — RED → GREEN → AUDIT → SELF-CORRECT → COMPLETE state machine
- **Streaming output** — token-by-token display, mid-stream cancellation
- **Slash commands** — `/new`, `/history`, `/bash`, `/feedback`, `/theme:toggle`, `/exit`
- **Knowledge files** — auto-loaded from `knowledge.md`, `AGENTS.md`, or `CLAUDE.md`
- **Skills system** — auto-discovered `SKILL.md` files via OpenClaw format

## Install

> **Status:** `@codebuff/freebuff` is not yet published on the npm registry (private workspace, v0.0.1). For now, **build from source** (see below) to produce a local `freebuff` binary. The npm install command will be `npm install -g @codebuff/freebuff` once the free variant ships.

## Usage

```bash
cd ~/my-project
freebuff
```

For end-user Quick Start including how Savant-Code and Savant-Free relate, see the [repo root README](../README.md).

## Project Structure

```
freebuff/
├── cli/       # CLI build & npm release files (binary: freebuff)
└── e2e/       # E2E tests for the free variant
```

## Building from Source

```bash
# From the repo root
bun freebuff/cli/build.ts 1.0.0
```

Built binary lives at `freebuff/bin/freebuff`.

---

For everything else — what Freebuff does, how it works, FAQ, and how it relates to Codebuff — see the [repo root README](../README.md). We keep that one up to date as the single source of truth.

## License

[Apache-2.0](../LICENSE) — see [LICENSE](../LICENSE) for full text.

---

<div align="center">

_Freebuff is part of the [codebuff/savant-code monorepo](https://github.com/savant0x/savant-code), governed by the [ECHO Protocol v0.2.0](../ECHO.md). It's the free, ad-supported companion to the full **Savant-Code** CLI._

**Savant** • 2026
</div>
