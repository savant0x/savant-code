# Scholarly acceptance review and lesson feature pipeline

## Intent and scope

Read the operator's full run report and correlate it with source/runtime logs.
Read all 74 lesson entries, including the historical tail, before proposing
changes. The operator replaced ledger condensation with turning lessons into
features and setting up a pipeline. Preserve the ledger and existing skill
governance. FID-2026-1012-004 owns the new script/review surface.

## Acceptance verdict

The scholarly argument pipeline passes live: search, lookup, similarity and
citation exploration succeed with numeric parameters and real identifier
arrays. Citation exploration first reports missing references, then succeeds
using another seed. This is appropriate bounded recovery from a coverage gap.

Traffic-light appearance, terminal interaction, resize, copy/export, local
render-error recovery and process restart were not observed by the agent.
The report explicitly disclaims them. The surrounding logs contain a resumed
turn, which proves a continuation occurred; it does not prove complete history
fidelity or crash recovery. Internal encoded-string repair was not tested by
this run, because the calls already supplied typed values.

## Findings in priority order

1. Database chat-state saves fail six times at 17:34-17:43 UTC with cyclic
   serialization. The database is a fallback/audit store; these errors do not
   prove the authoritative filesystem save failed. Durable resume needs a
   separate end-to-end snapshot comparison and precise cycle diagnosis.
2. Evidence is removed by micro-compaction at 11% of threshold, while the repo
   config disables it. extractSubagentContextParams omits compression and
   contextWindow, and the child logs a 200k fallback. Increasing the recent
   tail alone would treat the symptom. Propagate policy first, then evaluate
   on-demand access to retained evidence using existing spill/inventory seams.
3. read_files advertises line windows but the SDK truncates content before
   runtime slicing. LEARNINGS has 2,147 lines, but its 100k prefix has only
   1,552. An offset of 1,750 consequently returns empty despite existing data.
   Implement slicing at the actual filesystem boundary, then enforce the
   response cap on the selected window.
4. read_url already rejects 403 and unsupported content types before reading
   the response body. The suggested preflight duplicates existing behavior.
   A useful feature would provide supported HTML/full-text fallback discovery
   or a separately scoped PDF extractor, preserving the SSRF and size gates.
5. The main call table omits the PDF failure mentioned later. That failure
   exists in the preceding attempt at 17:15, while the 17:24 scholarly attempt
   has a 403 at 17:26. Reports must bind calls/failures to the exact run, rather
   than merge surrounding session history into one acceptance claim.
6. The claim that single-hop, relevant retrieval reliably reduces hallucination
   overstates the evidence. Accuracy is not a measured hallucination guarantee;
   the robustness abstract presents some statements as research questions.
   Full-text fetch limited to 14k characters needs a truncation/section check
   before claiming every detailed finding is full-text-supported.
7. The agent's token-fragment and identical write_todos-retry observations lack
   paired raw payloads in this report. Streaming chunks alone are normal; the
   defect to prove is UI stalls, duplicate content or unbounded history growth.

## Review of the lessons

Repeated themes: preserve evidence before destructive transforms; transmit
configuration at boundaries; distinguish absent/failed/zero; test production
callers and real environments; preserve user control; detect stale guidance;
enforce idempotence and scope with mechanical state.

Many entries already describe implemented guards: command uniqueness, fixture
isolation, gate declaration, provider breaker behavior, explicit child-field
classification and projection-only loaders. They are invariants to retain,
not proof that a new feature must be built. Historical guidance also includes
obsolete operator-only local-commit wording and dated platform proposals.

## Implementation plan

Extend the existing SessionEnd review with a reviewed feature store, strict
source/evidence/FID admission, and a reproducible inventory/report command.
Draft remedies remain draft; verified gaps are ready for FID convergence.
Implemented claims require owning closed records and implementation evidence.
The ledger remains byte-identical and lesson-to-skill parsing retains its input.

## Verification evidence

Implemented the strict candidate store, source/evidence snapshots, owning-FID
and commit checks, read-only/check/report commands, full 74-entry inventory,
and SessionEnd routing. Six candidates: two ready, four draft. These are
reviewed proposals; the product fixes themselves are not claimed implemented.
Full typecheck and eslint pass; focused suites 22 pass, zero fail; quality and
real-store admission pass. The actual Windows junction escape is rejected.
LEARNINGS SHA-256 remains
baa91dbd17dafdd5ba2dd9e205c48f390bb067ae786e61609bd8e3619e82de41.
The aggregate CI issue remains the existing Savant-Free disposition under T122.
