<!-- markdownlint-disable MD041 -->
<img src="../../assets/banner.png" alt="@savant-code/llm-providers — OpenAI-compatible LLM provider shims" width="650" />

# @savant-code/llm-providers

AI SDK provider abstractions and routing logic for OpenAI-compatible LLMs (`@ai-sdk/provider` + `ai` ^5.0.52).

[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=apache&logoColor=%2300fbff)](../../LICENSE)[![ECHO](https://img.shields.io/badge/ECHO-v0.2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](../../ECHO.md)[![Status](https://img.shields.io/badge/Status-internal-%23ff9500?style=flat-square&logo=github&logoColor=%2300fbff)](../../README.md)

## Purpose

`@savant-code/llm-providers` is the **adapter layer** between `@savant-code/agent-runtime` and any OpenAI-compatible chat API (Anthropic via compatible shim, OpenAI directly, self-hosted inference). Exports the OpenAI-compatible surface as `./openai-compatible` plus per-provider shims. Consumed by `@savant-code/agent-runtime` and the CLI's selection of MAX / DEFAULT / PLAN modes.

## Quick Start

```bash
# From the repo root
bun install

# Type-check
bun --cwd packages/llm-providers typecheck
```

For full Quick Start see the [root README](../../README.md#key-technologies).

## License

[Apache-2.0](../../LICENSE) — see [LICENSE](../../LICENSE) for full text.

---

<div align="center">

_Part of the [savant-code/savant-code monorepo](https://github.com/savant0x/savant-code), governed by the [ECHO Protocol v0.2.0](../../ECHO.md)._

**Savant** • 2026
</div>
