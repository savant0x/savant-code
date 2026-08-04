<!-- markdownlint-disable MD041 -->
<img src="../assets/banner.png" alt="SavantFree — The free coding agent. No subscription, no config." width="650" />

# SavantFree

**The free coding agent** — no subscription, no API key, no configuration. Start in seconds.

An AI coding agent that runs in your terminal. Describe what you want, and SavantFree edits your code. Built from
the same `@savant-code/cli` source as Savant-Code, then compiled with `SAVANT_FREE_MODE=true` so the bundler strips
paid-only features (credits UI, mode switching, MAX/PLAN prompts).

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

> **Status:** `@savant-code/savant-free` is not yet published on the npm registry (private workspace, v0.0.1). For
  now, **build from source** (see below) to produce a local `savant-free` binary. The npm install command will be
  `npm install -g @savant-code/savant-free` once the free variant ships.

## Usage

```bash
cd ~/my-project
savant-free
```

For end-user Quick Start including how Savant-Code and Savant-Free relate, see the [repo root README](../README.md).

## Project Structure

```text
savant-free/
├── cli/       # CLI build & npm release files (binary: savant-free)
└── e2e/       # E2E tests for the free variant
```

## Building from Source

```bash
# From the repo root
bun savant-free/cli/build.ts 1.0.0
```

Built binary lives at `savant-free/bin/savant-free`.

---

For everything else — what SavantFree does, how it works, FAQ, and how it relates to SavantCode — see the [repo
root README](../README.md). We keep that one up to date as the single source of truth.

## License

[Apache-2.0](../LICENSE) — see [LICENSE](../LICENSE) for full text.

---

<div align="center">

_Savant is part of the [savant-code/savant-code monorepo](https://github.com/savant0x/savant-code), governed by
the [ECHO Protocol v0.2.0](../ECHO.md). It's the free, ad-supported companion to the full **Savant-Code** CLI._

**Savant** • 2026
</div>
