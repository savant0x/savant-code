# Source CLI fan-out verification — 2026-10-19

Fan-out is enabled. The actual source CLI ran three Verifiers concurrently,
returned their indexed reports to the orchestrator, and continued after the
batch completed. A separate mixed Scout/Detective/Verifier exercise returned
discovery artifacts and the Verifier's review.

## Execution boundary

- Checkout: version 0.0.36, starting at
  `1e013a49267416c5e62c34da1dff34b7f8c66447`.
- Windows, Bun 1.3.14; configured development route
  `river/deepseek-ai/DeepSeek-V4.1-Flash`.
- Executed `bun --no-env-file cli/src/index.tsx --cwd . --print --json`,
  after `bun run --cwd cli prebuild:agents`. Allowed parent tools were
  `read_files,spawn_agents,list_directory,glob,recover_evidence`.
- The downloaded npm executable trial was stopped when the operator clarified
  that acceptance must use this checkout. The observations below use source.
- Read-only acceptance prompts explicitly requested the batches. They establish
  capability, not the frequency of autonomous batching on ordinary tasks.

## Production path and observed scheduling

The orchestrator exposes `spawn_agents` and permits Verifier, Scout and
Detective children. The ordinary handler maps entries into `runSingleSubagent`
and awaits `Promise.allSettled`; each child reaches `executeSubagent` and the
actual agent loop. The configured limits are 32 children per call and depth 8.

The original source run started at 20:17:26.042Z. Three Verifier start events
arrived at 20:17:36.041Z, .060Z and .078Z. The parent received its aggregate
result at 20:17:40.065Z and synthesized its answer afterward.

After the lifecycle/answer repair, source run
`e5c9b858-9718-4701-bb44-ea79a53bb2d6` produced these child lifetimes:

| Verifier | Started (UTC) | Cleaned up (UTC) |
| --- | --- | --- |
| `VdUSOOjzIJ8` | 20:23:09.631 | 20:23:12.408 |
| `VdUSUqCy52g` | 20:23:09.654 | 20:23:14.876 |
| `VdUSZeYmw0Y` | 20:23:09.674 | 20:23:14.925 |

All three lifetimes overlap. The original-index reports carried FANOUT-A/32,
FANOUT-B/8 and FANOUT-C/200. Direct inspection of the parent tool-result bytes
confirmed that association; a model-written allegation of scrambling did not
match those bytes.

Existing saved development sessions at 01:34:03Z, 00:45:18Z and 00:00:41Z on
the same date also contain three-basher `spawn_agents` batches. Those histories
show selected batching; they do not independently measure timing overlap.

The parent waits for every batch member. It does not work in the background
while children run and does not consume early completions individually. The
optional research-plan branch adds validated dependency stages and read-only
research restrictions; it is not required for ordinary multi-Verifier calls.

## Demonstrated defects and repairs

| Record | Severity | Reproduction and repair |
| --- | --- | --- |
| FID-2026-1019-002 | medium | Reversed same-role start events bound final results to the wrong CLI rows. Host-issued spawning call/index metadata now identifies each placeholder. The headless final artifact also retained only the final streamed fragment; it now uses the existing complete-turn selector. |
| FID-2026-1019-003 | medium | Scout's programmatic completion could return no parent-facing text, and Scout/Detective overwrote authored output after STEP. Scout now uses structured output; all three generators preserve authored results and retain real discovery evidence in fallback reports. |
| FID-2026-1019-004 | medium | A real Windows scoped glob returned zero for known files. Normalize file and cwd separators at the SDK glob boundary. Final source Scout output finds both agents.ts and free-agents.ts in common/src/constants. |
| FID-2026-1019-005 | low | SDK cancellation fixtures failed before starting because bare bun resolved to a PATH shim. Pin both fixture children to quoted process.execPath, keeping the real termination assertions and timeouts. |

The final valid mixed-role exercise returned Scout's actual file matches,
Detective's source evidence for `MAX_SUBAGENT_DEPTH = 8`, and the Verifier's
report. An earlier Detective request omitted required `searchQueries` and was
correctly rejected; input validation was preserved. The last live run also
issued an extra singleton review despite the prompt's exact-batch instruction.
Runtime capability passed; exact model instruction compliance was imperfect.

## Verification and practical limits

- Full root typecheck: all 14 workspaces plus scripts pass.
- Full root test chain: 9,420 pass, 23 skip, zero fail.
- New runtime tests execute the real child loops with injected inference and
  controlled barriers: all three enter before any may finish; completion order
  2/0/1 still returns reports in declaration order and preserves accounting.
- Real CLI event-handler regressions cover reversed same-role starts,
  overlapping identical prompts, final reconciliation and legacy fallback.
- Real stream-stager regression proves complete headless answer extraction.
- Six discovery-generator tests cover authored output and evidence fallback;
  the SDK glob test uses real files and checks sibling exclusion.
- SDK build and full formatting check pass. FID receipts and delivery gates
  are recorded with the implementation and closure records.

Implementation commits: `6b5039c5` (identity/answers), `f6f7b530` (discovery
artifacts), `ff4d1b58` (Windows glob), `592257be` (cancellation fixture).
All four FIDs closed and archived after their declared gates passed.

There is no automatic two- or three-Verifier quorum. Existing instructions
recommend independent batching, while the model chooses when and how many
agents to spawn. Verifiers have zero tools and review supplied evidence;
command execution belongs to command-capable roles. Native interactive TUI
appearance was not observed in this headless acceptance run. CLI state/event
behavior was tested through the production handlers.

These repairs are source changes made after npm 0.0.36 publication. They are
not a claim that the already published package contains the repairs, and no
new release is performed by this verification task.
