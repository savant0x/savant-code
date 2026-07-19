<!-- markdownlint-disable MD041 -->
<img src="../../assets/banner.png" alt="@codebuff/code-map — Tree-sitter WASM code parsing + repo map" width="650" />

# @codebuff/code-map

Tree-sitter WASM-powered code parsing and repository mapping utilities. Supplies `@codebuff/agent-runtime` and `@codebuff/evals` with the structural context the agent uses to plan code changes.

[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=apache&logoColor=%2300fbff)](../../LICENSE)[![ECHO](https://img.shields.io/badge/ECHO-v0.2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](../../ECHO.md)[![Status](https://img.shields.io/badge/Status-internal-%23ff9500?style=flat-square&logo=github&logoColor=%2300fbff)](../../README.md)

## Purpose

`@codebuff/code-map` parses repository sources into a per-file AST via tree-sitter WASM (`@vscode/tree-sitter-wasm` + `web-tree-sitter`) and surfaces structural queries (function definitions, class definitions, imports, exports, call sites) to the agent. The agent uses these signals to plan edits intelligently rather than working on raw text. Consumed by `@codebuff/agent-runtime` (for tool-call site discovery) and `@codebuff/evals` (for per-task scoring heuristics).

## Quick Start

```bash
# From the repo root
bun install

# Type-check
bun --cwd packages/code-map typecheck
```

For full Quick Start see the [root README](../../README.md#key-technologies).

## License

[Apache-2.0](../../LICENSE) — see [LICENSE](../../LICENSE) for full text.

---

<div align="center">

_Part of the [codebuff/savant-code monorepo](https://github.com/savant0x/savant-code), governed by the [ECHO Protocol v0.2.0](../../ECHO.md)._

**Savant** • 2026
</div>
