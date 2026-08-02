<!-- markdownlint-disable MD041 -->
<img src="../../assets/banner.png" alt="@savant-code/agent-runtime — Core agent execution engine" width="650" />

# @savant-code/agent-runtime

Core agent execution engine powering the CLI: prompt execution, tool-loop state, token limits, LLM API integration,
FSM transitions.

[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=apache&logoColor=%2300fbff)](../../LICENSE)[![ECHO](https://img.shields.io/badge/ECHO-v0.2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](../../ECHO.md)[![Status](https://img.shields.io/badge/Status-internal-%23ff9500?style=flat-square&logo=github&logoColor=%2300fbff)](../../README.md)

## Purpose

This is the **heart of the agent loop**. Given a prompt + agent definition + tool registry,
`@savant-code/agent-runtime` drives the multi-step model → tool → result → repeat cycle until `end_turn` or budget
exhaustion. It also owns the `AgentState` (fsmPhase, iterationCount, ancestorRunIds) and the `transition_phase`
tool that enforces the Perfection Loop FSM. Consumed by both the CLI (`@savant-code/cli`) and the SDK
(`@savant-code/sdk`).

## Quick Start

```bash
# From the repo root
bun install

# Type-check
bun --cwd packages/agent-runtime typecheck

# Run tests
bun --cwd packages/agent-runtime test
```

For full Quick Start see the [root README](../../README.md#features).

## License

[Apache-2.0](../../LICENSE) — see [LICENSE](../../LICENSE) for full text.

---

<div align="center">

_Part of the [savant-code/savant-code monorepo](https://github.com/savant0x/savant-code), governed by the [ECHO
Protocol v0.2.0](../../ECHO.md)._

**Savant** • 2026
</div>
