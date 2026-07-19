<!-- markdownlint-disable MD041 -->
<img src="../assets/banner.png" alt="<WORKSPACE_NAME> — <WORKSPACE_TAGLINE>" width="650" />

# <WORKSPACE_NAME>

<WORKSPACE_TAGLINE>. One-sentence summary explaining what the workspace is and why it exists.

[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=apache&logoColor=%2300fbff)](../LICENSE)[![ECHO](https://img.shields.io/badge/ECHO-v0.2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](../ECHO.md)[![Status](https://img.shields.io/badge/Status-internal-%23ff9500?style=flat-square&logo=github&logoColor=%2300fbff)](../README.md)

## Purpose

Two to four sentences explaining:

- What this workspace provides
- Which other workspaces consume it
- Any non-obvious invariants or constraints

## Quick Start

```bash
# From the repo root
bun install

# Type-check this workspace
bun --cwd <WORKSPACE_DIR> typecheck

# (Optional) Run tests
bun --cwd <WORKSPACE_DIR> test
```

For end-user Quick Start see the [root README](../README.md).

## Optional: Features / Architecture / API Reference

Add as many `## ` and `### ` sections as needed beyond the canonical Purpose + Quick Start blocks above. Common additions:

- `## Features` — bullet list of capabilities
- `## Architecture` — high-level design (consider a Mermaid diagram for complex flows)
- `## API Reference` — public exports + signatures (only if not documented elsewhere)
- `## Common Patterns` — idiomatic usage examples
- `## Troubleshooting` — known gotchas

## License

[Apache-2.0](../LICENSE) — see [LICENSE](../LICENSE) for full text.

---

<div align="center">

_Part of the [codebuff/savant-code monorepo](https://github.com/savant0x/savant-code), governed by the [ECHO Protocol v0.2.0](../ECHO.md)._

**Savant** • 2026
</div>

---

<!--
Replace this comment with your workspace-specific notes.

Substitutions needed before publishing:
- <WORKSPACE_NAME>     → e.g. "@codebuff/agent-runtime"
- <WORKSPACE_TAGLINE>  → e.g. "Core agent execution engine"
- <WORKSPACE_DIR>      → e.g. "packages/agent-runtime"

Don't shadow any of the 5 canonical sections above unless you have a strong reason — contributors expect to find Quick Start and License in this position.

For README that ships to npm (i.e., workspace has `private: false`), add a 4-5 badge block instead of the 3-badge internal variant:
- License + ECHO + npm + Bun + TypeScript

Banner image width:
- root README: 850px
- Publishable sub-READMEs (sdk): 650px
- Internal READMEs (all others): 650px

For dev-tooling READMEs (scripts/tmux, scripts/release), drop the ECHO badge block entirely — the worktop tooling is intentionally outside ECHO protocol scope.

LICENSE: Private workspaces (`private: true` in package.json) DO NOT need a per-workspace LICENSE file — they inherit from the root `LICENSE` via the explicit `Apache-2.0` cross-link in your README's License section. Only publishable workspaces (`private: false` — currently only `@codebuff/sdk`) need their own LICENSE file. (Per FID-2026-0718-024 Decision B: DECLARE pattern over COPY or SYMLINK.)
-->
