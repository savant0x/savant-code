<!-- markdownlint-disable MD041 -->
<img src="../assets/banner.png" alt="@codebuff/evals — Buffbench benchmark runner + public eval fixtures" width="650" />

# @codebuff/evals

Eval harness for the Savant agent. Runs the **Buffbench** benchmark suite against public eval fixtures (codebuff-hard / manifold / plane / saleor / additional profiles) and traces per-task performance.

[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=apache&logoColor=%2300fbff)](../LICENSE)[![ECHO](https://img.shields.io/badge/ECHO-v0.2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](../ECHO.md)[![Status](https://img.shields.io/badge/Status-internal-%23ff9500?style=flat-square&logo=github&logoColor=%2300fbff)](../README.md)

## Purpose

`@codebuff/evals` is the regression gate for agent quality. Each benchmark profile (e.g., `codebuff-hard`) feeds a curated task list into a Codebuff run, captures the trajectory, and scores pass/fail. Run before/after any agent-runtime or model change to detect capability regressions. The runner consumes `@codebuff/code-map` (for source parsing), `@codebuff/common` (for tool schemas), and `@codebuff/sdk` (for the harness driver).

## Quick Start

```bash
# From the repo root
bun install

# Run the public buffbench subset
bun --cwd evals run-buffbench

# Type-check
bun --cwd evals typecheck
```

See `evals/buffbench/README.md` (if present) for per-task scoring rules.

## License

[Apache-2.0](../LICENSE) — see [LICENSE](../LICENSE) for full text.

---

<div align="center">

_Part of the [codebuff/savant-code monorepo](https://github.com/savant0x/savant-code), governed by the [ECHO Protocol v0.2.0](../ECHO.md)._

**Savant** • 2026
</div>
