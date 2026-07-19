<!-- markdownlint-disable MD041 -->
<img src="../../assets/banner.png" alt="@codebuff/database — Postgres + Drizzle schema, types, services" width="650" />

# @codebuff/database

Database abstraction layer: Postgres + Drizzle schema, connection types, and service objects for analytics, billing, and auth.

[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=apache&logoColor=%2300fbff)](../../LICENSE)[![ECHO](https://img.shields.io/badge/ECHO-v0.2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](../../ECHO.md)[![Status](https://img.shields.io/badge/Status-internal-%23ff9500?style=flat-square&logo=github&logoColor=%2300fbff)](../../README.md)

## Purpose

`@codebuff/database` owns the **persistence boundary** between the Savant runtime and Postgres. Exports two surfaces: the root (`.` → `src/index.ts`) for connected clients and migrations, and `./service` for the higher-level service objects the CLI uses to record runs, agent state, billing events, and analytics. Consumed by `@codebuff/common` (for billing/analytics adapters) and indirectly by the CLI run state.

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

_Part of the [codebuff/savant-code monorepo](https://github.com/savant0x/savant-code), governed by the [ECHO Protocol v0.2.0](../../ECHO.md)._

**Savant** • 2026
</div>
