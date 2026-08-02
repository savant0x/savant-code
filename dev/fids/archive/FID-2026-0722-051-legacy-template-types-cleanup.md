# FID-2026-0722-051 — Legacy Codebuff Template-Type Cleanup

**Filename:** `FID-2026-0722-051-legacy-template-types-cleanup.md`
**ID:** FID-2026-0722-051
**Severity:** low
**Status:** closed
**Created:** 2026-0722 00:00
**Author:** Savant

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed`; Original ID: `FID-2026-0722-051-legacy-template-types-cleanup`. Canonical ID: `FID-2026-0722-051`. Backfilled fields: Filename, ID, Created. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.

**Status:** closed
**Severity:** low  
**Date:** 2026-07-22  
**Author:** Savant  

## Summary

During the Codebuff → Savant rebrand, many legacy `AgentTemplateType` values were left in `AgentTemplateTypeList` (`common/src/types/session-state.ts` and `agents/types/secret-agent-definition.ts`) even though the actual agent files were removed or renamed. This FID catalogs those leftovers, maps them to the current 9-agent ECHO roster, and defers the cleanup until later in the session.

## Background

`AgentTemplateTypeList` currently contains entries such as:

- `base`, `base_free`/`base_lite`, `base_max`, `base_experimental`
- `claude4_gemini_thinking`, `superagent`, `base_agent_builder`
- `ask`
- `planner`, `dry_run`, `thinker`
- `file_picker`, `file_explorer`, `researcher`, `reviewer`, `agent_builder`
- `recorder`, `scribe`, `forge`, `code_searcher`
- `example_programmatic`

The actual `agents/` directory contains the 9 ECHO agents and infrastructure agents (basher, browser-use, context-pruner, tmux-cli, file-explorer/*). Many of the template types above do not correspond to files on disk, and the two type-definition files have drifted out of sync.

## Mapping to current agents

| Legacy template type | Current ECHO/infrastructure replacement |
|---|---|
| `base` | Keep/remap to `savant` (or remove persona in `common/src/constants/agents.ts`) |
| `base_free` / `base_lite` | `savant-free` / `savant-lite` |
| `base_max` | `savant-max` |
| `base_experimental` | none (dead) |
| `claude4_gemini_thinking` | `thinker` variants |
| `superagent` | none (dead) |
| `base_agent_builder` / `agent_builder` | `agent-builder` persona |
| `planner` | `planner` persona still exists; decide if it stays or merges into `savant-plan` |
| `dry_run` | `savant-analyze` |
| `file_picker` / `file_explorer` | `scout` + `file-explorer/*` |
| `researcher` | `researcher-web` + `researcher-docs` |
| `reviewer` | `verifier` |
| `ask` | `ask` persona still exists; verify whether it is used |
| `recorder` / `scribe` | Current ECHO roles; verify whether they are used |
| `forge` | Current ECHO role; currently only in `common/src/types/session-state.ts` |
| `code_searcher` | Current ECHO role; currently only in `common/src/types/session-state.ts` |
| `example_programmatic` | none (dead) |

## Perfection Loop

### Loop 1 — RED

After auditing the code, the following gaps and inaccuracies were found:

1. **Missing types in the FID catalog.** `ask`, `recorder`, and `scribe` are present in both `AgentTemplateTypeList` arrays but were not listed in the Background or Mapping sections.
2. **Divergence between the two type lists is undocumented.**
   - `common/src/types/session-state.ts` contains: `planner`, `scout`, `verifier`, `forge`, `code_searcher`.
   - `agents/types/secret-agent-definition.ts` contains: `base_lite` (but not `base_free`).
3. **Mappings in the original table were partly aspirational.** The codebase still uses IDs like `base`, `planner`, and `researcher` in `common/src/constants/agents.ts` and elsewhere. We cannot simply rename them to `savant`, `savant-plan`, or `researcher-web` without a broader rename refactor.
4. **Backward-compatibility risk was omitted.** `agentType` values are stored in the database/session-state blobs. Removing enum members from `AgentTemplateTypeList` will break Zod parsing of older stored states unless a fallback/migration is added.
5. **`sdk/src/impl/llm.ts` overstatement.** The underscore-to-dash conversion is a generic regex (`toolName.replace(/_/g, '-')`) applied to all tool names, not a hardcoded `file_picker` → `file-picker` fallback.

### Loop 1 — GREEN

Updated this FID to:
- Include `ask`, `recorder`, `scribe`, `forge`, and `code_searcher` in the catalog.
- Note the list divergence and which types are in which file.
- Replace aspirational mappings with the actual current state (e.g., `planner` still exists as a persona).
- Add a database backward-compatibility prerequisite.
- Correct the `llm.ts` claim.

### Loop 1 — AUDIT

Verification performed:
- Read `common/src/types/session-state.ts` and `agents/types/secret-agent-definition.ts` line by line.
- Read `common/src/constants/agents.ts` to confirm which personas actually exist.
- Read `packages/agent-runtime/src/templates/types.ts` to confirm `baseAgentSubagents`.
- Read `cli/src/utils/local-agent-registry.ts` to confirm the `def.id.startsWith('base')` special case.
- Read `sdk/src/impl/llm.ts` to confirm the generic underscore-to-dash conversion.

## Why this is deferred

This cleanup touches a wide surface area:

- `AgentTemplateTypeList` in `common/src/types/session-state.ts` and `agents/types/secret-agent-definition.ts`
- `AgentTemplateTypes` auto-generated mapping (`name.replaceAll('_', '-')`) in both files
- `baseAgentSubagents` in `packages/agent-runtime/src/templates/types.ts`
- `AGENT_PERSONAS` in `common/src/constants/agents.ts`
- Tests that use `base`/`base_max`/`file-picker`/`reviewer` as mock agent IDs
- CLI block-processor and suggestion-engine tests
- SDK examples and README references to `agent: 'base'`
- `cli/src/utils/local-agent-registry.ts` special-casing IDs starting with `base`
- `sdk/src/impl/llm.ts` generic underscore-to-dash fallback (`toolName.replace(/_/g, '-')`)

It is not in scope for the current prompt-audit FID (FID-2026-0722-050).

## Proposed future work

1. Decide the canonical agent ID set. Is the goal to **remove dead types only**, or also to **rename live types** (e.g., `base` → `savant`, `planner` → `savant-plan`)?
2. Reconcile the two `AgentTemplateTypeList` definitions so they contain the same types.
3. Remove dead template types from `AgentTemplateTypeList` in both locations.
4. Update `baseAgentSubagents` to reference only live agent IDs.
5. Update tests to use current agent IDs (`savant`, `scout`, `verifier`, etc.) instead of legacy mock IDs.
6. Update SDK examples/docs to reference `savant` instead of `base`.
7. Revisit or remove the “base agent” special case in `local-agent-registry.ts`.
8. Add a database migration/fallback for legacy `agentType` values before removing enum members.
9. Run full typecheck and test suite.

## Impact

- **Risk:** Medium. The change is mostly type-level, but the template-type enum is used for Zod validation and stored in session-state blobs. Removing enum values without a migration path will break deserialization of old sessions.
- **Benefit:** Removes dead code, clarifies the canonical agent set, and prevents confusion between the 9 ECHO agents and legacy Codebuff names.

## Risks and prerequisites

- **Backward compatibility:** Old session states stored in the database contain `agentType` values. Before removing any enum members, add a Zod fallback or migration that maps legacy values to current ones.
- **Scope ambiguity:** The cleanup must explicitly decide whether it includes renaming live agent IDs or only deleting dead ones.
- **List synchronization:** `common/src/types/session-state.ts` and `agents/types/secret-agent-definition.ts` must be kept in sync after cleanup.

## Notes

This FID is intentionally **deferred**. Do not start implementation until it is explicitly pulled into the current session scope and a separate approval is given.
