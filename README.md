<!-- markdownlint-disable MD033 -->
<div align="center">

<img src="assets/banner.png" alt="Savant-Code — Multi-Agent AI Coding Assistant" width="850" />

**Savant-Code — Multi-Agent AI Coding Assistant. TypeScript Monorepo. ECHO-Protocol Citizen.**

Two products ship from this monorepo. **Savant-Code** is the full-featured AI coding agent for your terminal — multi-agent orchestration, custom skills, MCP tool discovery, progressive skill loading, custom slash commands, stream-JSON output for CI, and the [`@codebuff/sdk`](https://www.npmjs.com/package/@codebuff/sdk) for embedding agents in your own apps. **Savant-Free** is the free, ad-supported variant — no subscription, no API key, same agent runtime with paid features stripped at compile time via `FREEBUFF_MODE=true`.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-%23000000?style=flat-square&logo=typescript&logoColor=%2300fbff)](https://www.typescriptlang.org/)[![Bun](https://img.shields.io/badge/Bun-1.3.14-%23000000?style=flat-square&logo=bun&logoColor=%2300fbff)](https://bun.sh/)[![React](https://img.shields.io/badge/React-19-%23000000?style=flat-square&logo=react&logoColor=%2300fbff)](https://react.dev/)[![OpenTUI](https://img.shields.io/badge/OpenTUI-0.2.2-%23000000?style=flat-square&logo=opentui&logoColor=%2300fbff)](https://github.com/anomalyco/opentui)[![ECHO](https://img.shields.io/badge/ECHO-v0.2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](ECHO.md)[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=apache&logoColor=%2300fbff)](LICENSE)[![Release](https://img.shields.io/badge/Release-v0.0.2-%23000000?style=flat-square&logo=semver&logoColor=%2300fbff)](CHANGELOG.md)

</div>

> **Note:** 0.0.2 is the **pre-rebrand safety checkpoint** — workspace package names retain `@codebuff/*` for compatibility with the 1,131 consumer imports in the repo (per FID-2026-0718-017 Option C). Workspace-level rebrand to `@savant-code/*` arrives in the next push. CLI binary names (`savant-code`, `freebuff`) are pre-renamed.

---

## Overview

Savant-Code is a TypeScript monorepo that builds, ships, and maintains two AI coding-agent products from one workspace:

- **Savant-Code** (npm: `@codebuff/cli` — binary: `savant-code`) — the paid CLI + the public [`@codebuff/sdk`](https://www.npmjs.com/package/@codebuff/sdk). Multi-agent orchestration, custom skills, MCP tool discovery, mode switching (`FREE` / `MAX` / `PLAN`), usage metering.
- **Savant-Free** (npm: `@codebuff/freebuff` — binary: `freebuff`) — the free, ad-supported CLI. Same agent runtime, same SDK, but built with `FREEBUFF_MODE=true` so the bundler strips paid-only slash commands, credits UI, and mode switching. Result: a single binary that "just works" — no subscription, no API key, no config.

Both products are built from the same `cli/` source — only the build flag differs. The SDK, the agent runtime, the multi-agent orchestration engine, the tool layer, and the LLM provider shims are shared. That's why