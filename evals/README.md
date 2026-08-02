<!-- markdownlint-disable MD041 -->
<img src="../assets/banner.png" alt="@savant-code/evals — Benchmark runner + public eval fixtures" width="650" />

# @savant-code/evals

Eval harness for the Savant agent. Runs the **benchmark** suite against public eval fixtures (savant-code-hard /
manifold / plane / saleor / additional profiles) and traces per-task performance.

[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=apache&logoColor=%2300fbff)](../LICENSE)[![ECHO](https://img.shields.io/badge/ECHO-v0.2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](../ECHO.md)[![Status](https://img.shields.io/badge/Status-internal-%23ff9500?style=flat-square&logo=github&logoColor=%2300fbff)](../README.md)

## Purpose

`@savant-code/evals` is the regression gate for agent quality. Each benchmark profile (e.g., `savant-code-hard`)
feeds a curated task list into a SavantCode run, captures the trajectory, and scores pass/fail. Run before/after
any agent-runtime or model change to detect capability regressions. The runner consumes `@savant-code/code-map`
(for source parsing), `@savant-code/common` (for tool schemas), and `@savant-code/sdk` (for the harness driver).

## Quick Start

```bash
# From the repo root
bun install

# Run the public benchmark subset
bun --cwd evals run-benchmark

# Type-check
bun --cwd evals typecheck
```

See `evals/benchmark/README.md` (if present) for per-task scoring rules.

## License

[Apache-2.0](../LICENSE) — see [LICENSE](../LICENSE) for full text.

---

<div align="center">

_Part of the [savant-code/savant-code monorepo](https://github.com/savant0x/savant-code), governed by the [ECHO
Protocol v0.2.0](../ECHO.md)._

**Savant** • 2026
</div>
