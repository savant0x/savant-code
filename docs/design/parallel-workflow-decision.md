# Workflow selection for safe parallel work

Status: five live workflows complete; bounded research contract selected for
the first product slice. FID-2026-1017-003. No production installation claimed.

**Plan:** 4 observations and a decision. Subject: choose a buildable workflow
from equal final deliverables rather than assuming more agents are faster.

## Decision record

### Thought 1

Existing `handleSpawnAgents` (`spawn-agents.ts`) already runs children
concurrently and joins their reports. The previous live graph had no useful
sibling overlap. C's boundary analysis can inspect its own sources before A's
spawn analysis completes; D can join both. Removing that ordering dependency
is a hypothesis to test, not a measured speed claim.

### Branch A from 1

Fused: one bounded read-only investigator gets all nine source files and the
complete final brief. No handoff overhead; no independent model cross-check.

### Branch B from 1

Flat: C/A/B investigate separate source domains independently, then D receives
all three validated artifacts and all final sources. Existing batch semantics
remain. C is admitted first; HTTP concurrency stays two, so queued time counts.

### Branch C from 1

Chain: A -> C and B/C -> D, retaining the previous research dependencies.
Same final brief and final sources; extra intermediate context is an intentional
workflow cost. This is the control, not a new asynchronous API.

### Thought 2

The predeclared semantic review checks the same final obligation for each
variant. Mechanical citation success alone does not satisfy these checks.

| Check | Required final-answer behavior |
| --- | --- |
| Spawn visibility | Separate streamed lifecycle, returned reports and cost aggregation. |
| Tool boundary | Distinguish native/XML completion; consume at a safe parent boundary. |
| Steering | Distinguish genuine user input from child/compliance messages. |
| Persistence | Filesystem-first restore; DB fallback; drain/return is not a durable atomic commit. |
| Concrete workflow | Identify work to combine/overlap and distinguish proposal from existing code. |
| Safety | Retain true dependencies, write ownership, independent code review and stale-result fencing. |
| Unsafe shortcut | Identify a shortcut that would violate delivery or evidence semantics. |
| Limits | State what is unproven; invent no benchmark or durability guarantee. |

Fixed dispatch order: fused, flat, chain. Nominal sends: 1 + 4 + 4 = 9.
All variants use the actual SDK, read tools, selected Apixo route, source
fingerprint, output ceiling, and request guard. There is one live sample per
variant, no synthetic delay, and no statistical reliability claim.

### Thought 3

All three variants completed on source fingerprint
`6ccdadadf823b4e4d5cf1a82c7fa27ca3fd5d3ad225f05b2d27ece45b5a065cf`.
Evidence: `dev/research/parallel-agent-slice-1zh9YM/report.json`, with separate
SQLite stores and full histories. No source changes, inference errors or retries.

| Variant | Wall time | Sends | First-step history characters | Final words |
| --- | ---: | ---: | ---: | ---: |
| Fused | 41.230 s | 1 | 187,020 | 389 |
| Flat | 90.202 s | 4 | 380,030 | 422 |
| Chain | 91.603 s | 4 | 419,768 | 358 |

History characters are the sum of JSON-serialized first-step message histories,
not actual provider input tokens, pricing or billed usage. All final answers
exceeded the advisory 350-word instruction; the hard request ceiling remained
4,000 output tokens. No output was trimmed or silently repaired.

Mechanical checks passed for all nine tasks. Replaying actual read_files JSON
results against the stricter read-receipt gate verified every assigned file's
content after CRLF normalization, including uncited files. Exact predecessor
artifact JSON and digests appear in the correct downstream histories.

Flat's 1.401 s difference from chain is inconclusive. Although C was declared
first, source preparation and SDK scheduling meant its HTTP dispatch followed
A's completion: actual request intervals show A/B occupying the first two
permits, then C. Task preparation order is not provider admission priority.
There is one sample per variant and fixed order, not a latency distribution.

The fastest draft is not accepted. Its recommendation says late reports/costs
are ignored unless their generation is current. Stale delivery must be fenced,
but incurred/uncertain usage must remain accounted for. This is an unsafe
proposal in model output, not an observed cost-loss bug in the current runtime.
The existing `handleSpawnAgents` explicitly includes partial failed-child cost.

| Common review | Fused | Flat | Chain |
| --- | --- | --- | --- |
| Spawn/report/accounting distinction | Supported | Supported | Supported |
| Native/XML and safe boundary | Supported | Supported | Supported |
| Genuine versus synthetic steering | Supported | Supported | Supported |
| Files/DB authority and drain caveat | Supported | Supported | Supported |
| Concrete proposed workflow and limits | Present | Present | Present |
| Stale-result handling preserves incurred cost | **Unsafe** | Explicitly retained | Explicitly retained |
| Existing mandatory review triggers preserved | Ambiguous risk qualifier | Ambiguous risk qualifier | Required phases retained |
| Production-ready contract | Not accepted | Needs refinement | Needs refinement |

Selected references are mechanically valid, but not every prose assertion has
a selected citation. This review checks source-backed distinctions and safety;
it is not proof of every implementation detail or deployable code.

### Thought 4

Branch C offers no measured advantage here. Branch B preserves domain separation
and useful findings, but adds context and coordination with no clear speed win
in this sample. Branch A exposes a substantial opportunity in fewer model hops,
but fails the safety check. The next candidate is therefore **a compact draft
plus fresh, focused review under an explicit host-owned contract**.

The candidate is implemented as --review-workflows: two fresh D -> R trials,
two sends nominally each. Both stages read all nine sources, use the same final
brief and binding host constraints. R receives only D's selected artifact plus
actual source reads, not private draft reasoning/history; it must correct
unsupported or unsafe recommendations and identify the correction/verification.
This is research review, not the product's Verifier role or a code approval.

The operator's subsequent "resume" authorized the four additional requests
just proposed. Only the cumulative ceiling changed, from 60 to 64; concurrency
two, 4,000 output tokens per request, 20 minutes per invocation and retry
accounting remained. Both trials completed within those four sends.

Verification checklist: branches were compared against the same final brief;
the fastest unsafe draft was rejected; no timing result is generalized; actual
tool results and handoffs were checked; residual semantic failures are retained.

### Reviewed-workflow results

Evidence: `dev/research/parallel-agent-slice-Du53Wn/report.json`, separate SQLite
stores and full histories. Same source fingerprint; four HTTP 200 streams with
recorded finish times, no retries. Cumulative ledger now contains 64 sends.

| Trial | Draft | Fresh review | End to end | Sends | First-step history characters |
| --- | ---: | ---: | ---: | ---: | ---: |
| Reviewed 1 | 52.069 s | 36.968 s | 89.142 s | 2 | 380,375 |
| Reviewed 2 | 29.451 s | 33.981 s | 63.511 s | 2 | 380,252 |

Each child has nine byte-matching source reads. Saved history hashes match the
report; each review's actual input contains its exact draft artifact and digest.
All selected evidence checks pass. Context characters remain proxies, not token
or money measurements: fresh review still rereads the complete source set.

Both reviews explicitly preserve incurred/uncertain usage, mandatory review,
genuine-user boundaries, and the filesystem/DB durability distinction. Review 1
corrected the implication that current parent execution can continue while
spawned children run. Review 2 corrected the claim that current aggregation
already observes all usage: it adds exposed credit fields, including available
failed partial credits, rather than proving complete billing settlement.

Residual defects prevent automatic acceptance of either prose artifact as a
product specification. Review 1 still proposes parent planning during child
execution without implementing its lifecycle contract. Review 2 repeats
"read-only Forge/research children": Forge is implementation-only and must not
be repurposed for research. Both remain proposals rather than installed
capabilities. These defects are retained in raw outputs; the host contract
below rejects both parent overlap and research dispatch to Forge.

The advisory eight-citation instruction was exceeded by draft/review 1 (12/10)
and draft 2 (11); review 2 used eight. The schema checks identity and references,
not this upper count. Whitespace word counts were 346/295 and 336/377; review 2
exceeded the advisory 350-word instruction. The 4,000-output-token request limit
remained hard. No truncation, repair or retry concealed these instruction misses.

The two-request shape halves physical sends against the four-request flat/chain
samples. End-to-end times were near the earlier chain in trial 1 and lower in
trial 2. Different prompts/host constraints, fixed order and two replications
cannot isolate causality or establish a latency/reliability distribution. Fresh
context in the same model is useful cross-checking, not independent failure
probability. This supports the bounded contract, not blind reviewer trust.

### Final

Recommended build direction: **one conductor, few model hops, and hard evidence
and review boundaries**, with read-only fan-out selected by real data dependency
and work size. Do not make full asynchronous background sessions the initial
performance investment on the strength of these results.

Select consolidated investigation -> fresh research review for bounded coupled
research, with host validation and explicit rejection/escalation on unresolved
semantic defects. This is a concrete executable prototype and integration
contract, not a globally optimized or production-ready system. Keep read-only
fan-out as a conditional path for genuinely separable, substantial domains;
the current samples do not establish a useful workload threshold.

## Build contract and integration map

1. **Choose research shape before spawning.** Bounded context and one coupled
   question use consolidated investigation. Distinct costly source domains can
   fan out read-only, with only the final synthesis joining them. Every edge
   names an input artifact; role labels alone do not create dependencies.
   Enforce this at Orchestrator planning, alongside `buildSystemPrompt` and
   `buildImplementationInstructionsPrompt`; prompting alone is not an authority
   gate. Existing examples already batch independent agents, so the change is
   concrete dependency/acceptance planning rather than adding another slogan.
2. **Keep evidence and authority in the host.** Before dispatch, pin objective,
   source identity, allowed tools/write scope, budget and acceptance checks.
   Resolve source references against captured bytes; reject missing or changed
   reads before consuming results. Product references should include symbols
   and source hashes; experimental line IDs are snapshot locators, not durable
   live-code identity. Never let a model grant itself tools or approve its output.
3. **Use existing aggregate spawn semantics first.** `handleSpawnAgents` and
   `runSingleSubagent` already provide the execution path. The current read-only
   tests have no detached child lifetime or parent wake-up requirement. Keep
   turn ownership and one writer. A bounded worker pool would need explicit
   admission/priority and nested-spawn analysis; array order is insufficient.
4. **Use fresh review for the right obligation.** The experimental R corrects
   research proposals. Production Verifier returns verdicts and cannot rewrite
   code; Thinker has no read tools and needs actual evidence supplied by its
   parent. Do not copy R into either role or grant new capabilities. Reuse
   `loadRawEvidenceForSpawn`, raw-evidence spill/splice and existing capability
   checks when constructing bounded, fresh evidence contexts.
5. **Preserve the engineering pipeline.** Converged FID -> Forge -> Verifier ->
   Adversary remains. Read-only code review and deterministic validation may
   overlap after Forge stops writing, but acceptance waits for both. Adversary
   must receive Verifier findings and actual evidence. Any later source change
   invalidates affected reads/reviews. This research does not authorize dropping
   a mandatory role, review trigger, test, receipt or phase transition.
6. **Separate delivery eligibility from resource accounting.** Generation and
   attempt identity may reject a late result's influence; they never erase
   observed or uncertain usage. Provider permits live only across physical
   requests/streams, not child waits or tool execution. Runtime projections
   must not double-count on replay. The current harness caps physical sends;
   it does not establish a monetary ceiling or production settlement ledger.
7. **Retain storage authority until async lifetime is required.** First build
   needs no canonical-session migration. If useful background work later
   requires a parent to return before children settle, the earlier task-service
   proposal's transactional inbox/state authority, cancellation and restart
   contracts must be implemented and tested. A mailbox beside filesystem-first
   restore does not supply those guarantees.

The smallest reviewable implementation slice is the bounded research-plan
contract and fresh evidence handoff, exercised through the existing spawn path.
Acceptance must include exact source/read identity, no unauthorized writer or
descendant, cancelled result rejection with retained usage, and required review
phases. Add broader task services only when measured workloads require them.

## First product slice: bounded research, no detached parent

The conductor owns an immutable plan: objective, snapshot hash, assigned sources,
allowed role/tools, artifact dependencies, request/output limits, cancellation
identity and acceptance checks. The typed plan, not a worker's prose, decides
dispatch. A research worker cannot become Forge or grant another role tools.

| Work shape | Execution contract | Required join |
| --- | --- | --- |
| Small local lookup | One bounded read task; no research reviewer by default | Existing review triggers still apply |
| Coupled research fitting context | Consolidated investigator -> fresh research reviewer | Host evidence checks plus unresolved-claim review |
| Substantial independent source domains | Read-only fan-out -> fresh synthesis/review | Only actual artifact dependencies; aggregate spawn return |
| Code changes | Converged FID -> Forge -> Verifier -> Adversary | Mandatory tests, verdicts and receipts |

Use existing role capabilities: Detective/Scout gather code evidence, Researcher
handles external research, and the conductor supplies bounded evidence to a
Thinker where reasoning is needed. The experimental D/R templates are test
roles, not additions to the canonical roster. Bind product roles separately;
never port the custom R's rewrite behavior into Verifier's verdict contract.

The first implementation must preserve the current aggregate spawn barrier:
no detached parent reasoning, child wake-up API or storage-authority migration.
Before accepting a result, verify source/read identity and exact predecessor
identity; reject changed sources, unsupported capability requests or unresolved
safety claims. A reviewer passing is additional evidence, not permission to
bypass host checks. Failure returns an explicit rejected result within the
budget; exhaustion never turns failure into a pass.

Required integration cases are successful two-hop delivery, invalid draft
blocking review, changed sources invalidating acceptance, cancelled/stale output
with retained usage, forbidden role/tool/write requests rejected before dispatch,
and unchanged engineering review triggers. Existing isolated controls exercise
evidence, scheduling, cancellation and request accounting; they do not prove
these future product integrations. The current CLI's named consumer is the
research runner; shipping this contract requires a converged implementation FID
and those production-path checks. No additional inference is needed to specify
that slice, and none beyond the approved 64 has been dispatched.
