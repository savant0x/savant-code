---
name: fid-gates-unfenced-parser-contract
description: "FID gate parser strips fences; declare bare - gate: lines"
version: 0.1.1
metadata:
    origin: agent
---

# FID Verification Gates: Unfenced Declarations Required

## When to Use

When `bun run fid:verify <fid> --write` fails with "malformed verification
gates" / "no gates declared" on a FID whose `- gate:` lines visibly exist.

The gate parser
(`packages/agent-runtime/src/echo/fid-verification-gates.ts`) strips ALL fenced
code blocks BEFORE parsing. A fence around your gates makes them invisible, and
the surrounding prose is then reported as malformed declarations.

## Procedure

Declare gates as bare unfenced lines directly under `## Verification Gates`:

```
## Verification Gates

- gate: typecheck <workspace>
- gate: test <path-to-test-file>
```

No prose, no fences inside that section — any non-empty line that is not a
`- gate:` bullet or receipt block is an error.

## Pitfalls

- Wrapping the gates in a ```markdown fence silences them rather than
  documenting them, and the failure reads as a parse bug rather than a fence.
- Putting a prose line inside the section is an error even when the `- gate:`
  bullets are correct.

## Verification

After authoring a FID's gates section, grep it for triple-backticks between
`## Verification Gates` and the next `##` heading — zero matches required. Then
run `bun run fid:verify <fid> --write` and confirm it stamps rather than warns.

Evidence: recurred at FID-2026-0824-017 closure and again at master
FID-2026-0824-013 closure (2026-08-25/26).
