---
name: fid-gates-unfenced-parser-contract
description: FID gate parser strips fences; declare bare - gate: lines
version: 0.1.0
metadata:
    origin: agent
---

# FID Verification Gates: Unfenced Declarations Required

When `bun run fid:verify <fid> --write` fails with "malformed verification gates" / "no gates declared" on a FID whose `- gate:` lines visibly exist:

1. The gate parser (`packages/agent-runtime/src/echo/fid-verification-gates.ts`) strips ALL fenced code blocks BEFORE parsing — a ```markdown fence around your gates makes them invisible, and surrounding prose becomes malformed-declaration errors.
2. Fix: declare gates as bare unfenced lines directly under `## Verification Gates`:

```
## Verification Gates

- gate: typecheck <workspace>
- gate: test <path-to-test-file>
```

No prose, no fences inside that section — any non-empty line that is not a `- gate:` bullet or receipt block is an error.

Evidence: recurred at FID-2026-0824-017 closure and again at master FID-2026-0824-013 closure (2026-08-25/26). Guard: after authoring any FID's gates section, grep it for triple-backticks between `## Verification Gates` and the next `##` heading — zero matches required.
