---
name: library-complete-needs-a-named-consumer
description: Incomplete arguments for tool read_files; retry the tool cal
version: 0.1.0
metadata:
    origin: agent
provenanceRef: lesson:library-complete-needs-a-named-consumer proposal:91d3a01c4670fdb1b03d0042c8e449299ff5b71603976a7fec3073e9715fcc84
---

# library complete needs a named consumer

## When to Use
When read_files fails with: `Incomplete arguments for tool read_files; retry the tool call with a complete arguments object.`.

## Procedure
1. library-complete-needs-a-named-consumer
2. Verify with the project test suite before proceeding.

## Pitfalls
- Do not treat this as a blanket bypass — the rule exists because the naive path fails.

## Verification
- `bun run typecheck` (all workspaces)
- Focused test suite for the affected area

> Auto-drafted from lesson: A library-complete hand-off needs a named consumer, not a readiness note (48× across 19 distinct sessions)
