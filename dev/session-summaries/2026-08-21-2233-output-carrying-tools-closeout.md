# Session Summary — FID-2026-0821-007 closeout: output-carrying tools header-only rendering

**Date:** 2026-08-21 · **Branch:** main (working tree, NOTHING COMMITTED)

## What This Session Did

1. **Applied the input-vs-output check** requested after FID-2026-0821-006
   across every header-only tool. Finding: `end_turn` and `task_completed` are
   NOT the same bug (empty `z.object({})` input; their content is the preceding
   assistant text, already rendered). The one input-payload sibling
   (`think_deeply`) is dead — not in any agent's `toolNames`.
2. **Found the second, output-side class:** 14 result-bearing tools render
   header-only because they have no renderer and the generic fallback collapses
   unregistered tools by default, while their result already sits in the
   formatted `output`.
3. **Authored FID-2026-0821-007** (low), ran the Perfection Loop to convergence
   (RED → GREEN → AUDIT → ADVERSARIAL), implemented, verified, and closed +
   archived per the operator directive ("needs a FID and perfection loop").

## What Landed

- `cli/src/components/tools/output-result.tsx` (NEW) — shared
  `OutputResultComponent` rendering the formatted `output` expanded as a code
  block with a one-line collapsed preview (Law 13, mirroring
  `run_readonly_command` → `RunTerminalCommandComponent`).
- `cli/src/components/tools/registry.ts` — aliased the component to 14 tool
  names (`deep_research`, `find_files`, `list_tables`, `describe_table`,
  `execute_query`, `analyze_query`, `lookup_agent_info`, `query_blast_radius`,
  `query_domain_clusters`, `query_node_edges`, `ponytail_debt`,
  `run_file_change_hooks`, `get_goal`, `browser_logs`) at :80-93.
- `cli/src/components/tools/__tests__/output-result.test.tsx` (NEW) — 4 cases.

## Verification (all green, tool output pasted)

- `bun run --cwd=cli typecheck` — exit 0.
- `bun test cli/src/components/tools/__tests__/output-result.test.tsx` — 4 pass / 0 fail.
- `bun x eslint <3 changed files> --max-warnings 0` — exit 0 (one double-escaped
  sanitizer regex fixed).
- Call-graph grep: registry.ts:12 import + :80-93 aliases.

## Notes

- Pre-existing, unrelated test failures remain in `sdk/src/native/ripgrep.ts`
  (missing `./platform-targets`) and the vendored `resources/freebuff-main/*`
  tree — neither modified by this FID.
- Everything remains uncommitted per the operator's release-only-commits rule.
