# Researcher acceptance and render recovery

## Initial state and intent

Single-agent ECHO v0.1.2, strict mode, autonomy ceiling 3. Operator reports a
researcher freeze, noninteractive resume fallback, failed resume, and requests
traffic-light output. Initial HEAD 7df92cba. Preserve operator-appended experience
traces. The supplied results.md was read, then deleted at the operator's explicit
request as disposable run output. No push or release is authorized.

## Evidence and planned work

FID-2026-1012-003 records AppRoot's text-host error at
2026-10-12T16:10:17.878Z, continued runtime execution, typed MCP validation
failures, and generic MCP rendering. Reproduce at the production seams; converge
the repair before editing source. Use real OpenTUI rendering, typed runtime
regressions, configured static gates and a separate manual re-read.

## Implementation and evidence

- Preserve MCP server schemas without the lossy JSON -> Zod -> JSON roundtrip.
  Search/similarity nullable fields had degraded to empty model schemas.
- Decode one layer of JSON only at schema type-error paths, fully revalidate,
  reject non-object roots, and pass the validated values to the real executor.
- Namespaced MCP calls use StructuredCard and TrafficLightPanel with readable
  action names, loading/empty/error states, folding and existing copy/export.
- Normalize structured Markdown through legal OpenTUI text hosts. Isolate root
  and nested transcript groups; retain siblings and input, expose bounded raw
  fallback and retry, and capture error/component stacks. Logging and fallback
  serialization cannot escalate an isolated error to the root boundary.
- Native tests reproduce the recorded error class and show typing surviving
  restored defective content; a mouse retry remounts corrected content.
- Full runtime: 2009 pass, zero fail after the final non-object rejection pin.
  SDK: 607 pass, one platform skip, zero fail. CLI: 4133 pass, 18 skip, zero fail.
  Full typecheck, eslint and Markdown lint passed. SDK build and Windows CLI
  binary build passed. Four live MCP round trips succeeded with repaired arrays
  and integers, including get_papers; no LLM request was made.
- Registered panels no longer eagerly parse an unused generic Markdown dump
  on every streamed update, avoiding duplicate processing of large MCP results.
- The HUD preview suite exposed a fixed-delay blank-frame race. Its capture now
  waits for native layout with a hard bound. New rendering tests also wait for
  observed frames rather than assume a commit after a fixed sleep.
- Deleted results.md at the operator's request after recording relevant evidence;
  removed its temporary lint/git exclusions.
- Normalized 36 pre-existing formatting violations in a separate change.
  Structural TypeScript trees match initial HEAD in all 36 files; three comment
  blocks were shortened to retain the 300-line ceiling. Final full typecheck,
  eslint and quality checks pass.
- Local commits: 285cf3fb (baseline formatting), f3dd0eee (MCP/schema/parser,
  traffic-light renderer and transcript containment). Repository validation,
  full Prettier and Markdown lint pass. The local Windows binary reports
  0.0.35 and includes the repair; the installed/published CLI was not updated.

## Verification boundaries

The exact offending subtree from the first run is not provable from logs that
recorded only AppRoot and the error message. The native regression proves the
error class, containment and recovery, not a replay of that original session.
The original scholarly prompt still needs an operator acceptance run on this
build. Aggregate bun run ci fails in the existing Savant-Free build; its
repair/removal disposition remains operator-owned under T122. No release or
push occurred. FID closure is not claimed while these boundaries remain active.
