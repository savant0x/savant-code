<!-- markdownlint-disable MD041 -->
<img src="../assets/banner.png" alt="@codebuff/agents — Public agent definitions for the Savant CLI" width="650" />

# @codebuff/agents

Public agent definitions shipped with the Savant CLI (Detective, Forge, Verifier, Recorder, Thinker, Scout, Researcher, Scribe, Orchestrator).

[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=apache&logoColor=%2300fbff)](../LICENSE)[![ECHO](https://img.shields.io/badge/ECHO-v0.2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](../ECHO.md)[![Status](https://img.shields.io/badge/Status-internal-%23ff9500?style=flat-square&logo=github&logoColor=%2300fbff)](../README.md)

## Purpose

The agents in this workspace are the **separation-of-duties specialists** that execute the Perfection Loop FSM (RED → GREEN → AUDIT → SELF-CORRECT → COMPLETE). Each agent is restricted to a small tool set per ECHO Law 13 — Detective reads + searches only, Forge writes only, Verifier reads only, Recorder archives FIDs, Thinker reasons sequentially, etc. The Orchestrator in `agents/base2/` routes work across agents and is the only one allowed to spawn child agents.

## Quick Start

```bash
# From the repo root
bun install

# Validate all agents
bun --cwd agents typecheck
```

For full Quick Start including how agents are wired into the CLI runtime, see the [root README](../README.md#features).

## License

[Apache-2.0](../LICENSE) — see [LICENSE](../LICENSE) for full text.

---

<div align="center">

_Part of the [codebuff/savant-code monorepo](https://github.com/savant0x/savant-code), governed by the [ECHO Protocol v0.2.0](../ECHO.md)._

**Savant** • 2026
</div>
