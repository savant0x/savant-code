<!-- markdownlint-disable MD041 -->
<img src="../../assets/banner.png"
alt="@savant-code/design-systems — Offline design-system presets"
width="650" />

# @savant-code/design-systems

Offline design-system presets and validated custom design contracts for Savant visual work.

[![License](https://img.shields.io/badge/License-Apache_2.0-%23000000?style=flat-square&logo=apache&logoColor=%2300fbff)](../../LICENSE)[![ECHO](https://img.shields.io/badge/ECHO-v0.2.0-%23000000?style=flat-square&logo=github&logoColor=%2300fbff)](../../ECHO.md)[![Status](https://img.shields.io/badge/Status-internal-%23ff9500?style=flat-square&logo=github&logoColor=%2300fbff)](../../README.md)

## Purpose

`@savant-code/design-systems` ships 74 approximately 2 MB offline presets with deterministic manifests and
provenance. It provides the parser, selection logic, and theme adapter for the `/design` command surface in the
CLI. Custom systems are validated, versioned, reloadable, and scanned at the EHEL write boundary. The active
contract enters agent context; only the selected design system influences visual output.

## Quick Start

```bash
# From the repo root
bun install

# Type-check
bun --cwd packages/design-systems typecheck

# Run tests
bun --cwd packages/design-systems test
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
