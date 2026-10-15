<!-- markdownlint-disable MD041 -->
<img src="../../assets/banner.png" alt="@savant-code/database — SQLite persistence layer for sessions, agents, and messages"
width="650" />

# @savant-code/database

Database abstraction layer: SQLite via `bun:sqlite`, schema, connection, and service objects for sessions, agent
configs, FID documents, message history, and cost tracking.

[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=apache&logoColor=%2300fbff)](../../LICENSE)[![ECHO](https://img.shields.io/badge/ECHO-v0.2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](../../ECHO.md)[![Status](https://img.shields.io/badge/Status-internal-%23ff9500?style=flat-square&logo=github&logoColor=%2300fbff)](../../README.md)

## Purpose

`@savant-code/database` owns the **persistence boundary** for the Savant runtime. Uses `bun:sqlite` (Bun's built-in
SQLite driver) with WAL mode for crash recovery. Exports a database connection, schema creation, and typed service
objects for CRUD operations on sessions, agent templates, agent configs, FID documents, message history, and cost
tracking. Consumed by the CLI run state and agent runtime.

## Quick Start

```bash
# From the repo root
bun install

# Type-check
bun --cwd packages/database typecheck
```

For full Quick Start see the [root README](../../README.md#repo-map).

## License

[Apache-2.0](../../LICENSE) — see [LICENSE](../../LICENSE) for full text.

---

<div align="center">

_Part of the [savant-code/savant-code monorepo](https://github.com/savant0x/savant-code), governed by the [ECHO
Protocol v0.2.0](../../ECHO.md)._

**Savant** • 2026
</div>
