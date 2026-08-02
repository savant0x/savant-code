<!-- markdownlint-disable MD041 -->
<img src="../assets/banner.png" alt="@savant-code/common — Shared types, tool definitions, utilities" width="650" />

# @savant-code/common

Shared types, tool definitions, and utilities used across the Savant runtime (Zod schemas, MCP client, AI SDK helpers,
auth, billing/Postgres).

[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=apache&logoColor=%2300fbff)](../LICENSE)[![ECHO](https://img.shields.io/badge/ECHO-v0.2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](../ECHO.md)[![Status](https://img.shields.io/badge/Status-internal-%23ff9500?style=flat-square&logo=github&logoColor=%2300fbff)](../README.md)

## Purpose

`@savant-code/common` is the **cross-workspace source of truth** for shared types and tool wiring (per ECHO Law 13).
Contains tool schemas for `read_files`, `write_file`, `str_replace`, `run_terminal_command`, `web_search`,
`code_search`, MCP client, AI SDK integrations, and the analytics/billing/Postgres adapters. No agent imports anything
from another workspace without going through `@savant-code/common`.

## Quick Start

```bash
# From the repo root
bun install

# Type-check common
bun --cwd common typecheck
```

For full Quick Start including how the CLI runtime consumes `common/`, see the [root README](../README.md#repo-map).

## License

[Apache-2.0](../LICENSE) — see [LICENSE](../LICENSE) for full text.

---

<div align="center">

_Part of the [savant-code/savant-code monorepo](https://github.com/savant0x/savant-code), governed by the [ECHO Protocol v0.2.0](../ECHO.md)._

**Savant** • 2026
</div>
