# LEARNINGS

## Lesson: An unavailable tool needs a different recovery policy from incomplete arguments

- **Date:** 2026-10-12
- **Failure:** A completeness predicate returned false for an undeclared tool
  before inspecting its arguments. The runtime called that truncation, advised
  payload splitting, and exhausted retries on a tool the child could never use.
  An inherited phase note advertised those unavailable tools; near-miss tool
  envelopes also reached visible text as protocol JSON.
- **Evidence:** packages/llm-providers/src/openai-compatible/chat/stream-transform/flush-handler.ts → symbol:flushStream,
  sdk/src/impl/llm/stream-error-chunk.ts → symbol:classifyInvalidToolCall,
  packages/agent-runtime/src/run-agent-step/loop/native-strikes.ts → symbol:applyNativeStrikeHandling,
  packages/agent-runtime/src/templates/strings.ts → symbol:getAgentPrompt
- **Invariant:** Tool availability and argument completeness are separate facts.
  Classify the cause where the request's declared tools are known, preserve the
  distinction through recovery, and derive child instructions from the child's
  allowlist. A payload retry cannot make an unavailable tool available.
- **Guard:** Before diagnosing truncation, compare the name with the tools
  declared for that request. Give unavailable calls one corrective retry listing
  actual tools, then fail with the real cause. Keep the truncation budget and
  finish reason intact. Contain protocol envelopes before rendering text.
- **Verification:** Recovery reran all nine original FID gates successfully;
  targeted runtime/parser suites 41 pass, provider split 3 pass, SDK suite
  607 pass / 1 skip / 0 fail. The inherited-prompt test passes 3/3; both it and
  the SDK classification suite are declared in the FID's gate contract.
- **Scope:** internal
- **Owning FID:** FID-2026-1012-002
- **Status:** active

## Lesson: A register target line whose globs all sit on continuation lines contributes nothing

- **Date:** 2026-10-10
- **Failure:** A new SCOPE.md register item for `FID-2026-1010-001` was written as
  `- FID-2026-1010-001:` with every backticked glob on the following indented
  continuation lines. Two subsequent writes were then blocked by the Law 2
  write-time scope gate with `no approved scope item covers "<path>"` — naming
  the missing coverage and never the malformed entry. The entry looked correct to
  a human reader: it listed the paths, indented, in the same shape every
  neighbouring entry uses.
- **Evidence:** packages/agent-runtime/src/echo/scope-targets.ts → symbol:loadScopeArtifact,
  packages/agent-runtime/src/echo/pre-write-gates-law2.ts → symbol:runLaw2Gate,
  SCOPE.md → heading:Machine-readable scope targets
- **Invariant:** The gate matches item heads with `/^- ([A-Za-z0-9-]+): (.+)$/`,
  which requires at least one character AFTER the colon. Continuation-line
  collection is purely additive — it runs only once a head has matched. So an
  item whose head ends at the colon contributes ZERO patterns, and because the
  gate fails closed it denies exactly the paths that entry names. The block
  message points at the missing coverage, which is the one thing that is not
  wrong.
- **Guard:** Always put at least one backticked glob on the same line as the
  `- <id>:` head; continuation lines are additive only. When a Law 2 block names
  a path the entry visibly lists, re-read the entry's HEAD line before touching
  anything else. Related observation: the gate reads the register per write, so a
  SCOPE.md edit and a gated write issued in the same tool batch can still see the
  pre-edit artifact — retry the write rather than re-authoring the entry.
- **Verification:** after moving the first glob onto the head line, both
  previously blocked writes applied on the first attempt;
  `bun run scripts/scope-register-check.ts` prints
  `scope-register PASS (0 issues)`; the four TokenHarbor suites are
  53 pass / 0 fail.
- **Scope:** internal
- **Owning FID:** FID-2026-1010-001
- **Status:** active

## Lesson: A machine-readable register entry is a parsed artifact, not prose

- **Date:** 2026-10-09
- **Failure:** The `FID-2026-1009-001` entry in SCOPE.md's machine-readable
  scope-targets section was edited incrementally three times, and each edit
  silently corrupted the entry — a dropped continuation indent, duplicated
  glob lines, a stray trailing backslash. The corruption never announced
  itself as corruption; it announced itself as the Law 2 write gate blocking
  the very files the entry covered ("no approved scope item covers ...").
  The gate read the register exactly as written — the entry's shape had
  stopped parsing.
- **Evidence:** packages/agent-runtime/src/echo/scope-targets.ts → symbol:loadScopeArtifact,
  SCOPE.md → heading:Machine-readable scope targets
- **Invariant:** A register entry that gates writes is code, not
  documentation — its indentation and line shape are the contract, and a
  malformed entry fails closed by denying approved work. The failure is
  uniquely confusing because the block message names the missing coverage,
  never the mangled entry that caused it.
- **Guard:** Never edit a machine-readable register entry line-by-line. Read
  the entry, then rewrite the WHOLE entry block in one operation (or run a
  small anchor-based script), and confirm the globs still parse — a targeted
  write to one of the entry's own paths is the live probe. Prefer a script
  for multi-line glob lists; the tool-call payload path is lossy for them.
- **Verification:** after the script rewrite, the previously blocked edits
  applied on the first attempt and the full battery passed (typecheck ×2,
  tests 5/5 and 1/1, probe 5/5, quality, eslint, prettier, lint:md,
  fid:verify 6/6).
- **Scope:** internal
- **Owning FID:** FID-2026-1009-001
- **Status:** active

## Lesson: A repair script that slices on a re-run is a data-loss script

- **Date:** 2026-10-09
- **Failure:** The repair script for the two lessons above removed a
  previously inserted block with `text.slice(0, start) + text.slice(markerAt)`,
  where `start` was the heading of the block it had itself inserted at the
  TOP of the file. Re-running the script then sliced from that top block all
  the way down to the insertion marker — deleting 1,082 lines and 35 governed
  lessons from dev/LEARNINGS.md. The file's own tool gate never flagged it:
  learnings:check passed on the truncated file (fewer entries is still a
  valid file), and only `git diff --stat` against HEAD revealed the loss.
- **Evidence:** scripts/learnings-schema.ts → symbol:LEARNINGS_INSERTION_MARKER
- **Invariant:** A script that removes content by slicing between two
  located indices is only safe when both indices bound EXACTLY the content it
  inserted. Locating the block by a heading that the script itself placed at
  an arbitrary position (the top) turns any re-run into an unbounded delete.
  Idempotence in a repair script means "no-op when already correct", never
  "delete then re-insert".
- **Guard:** Repair scripts insert and remove only between a stable anchor
  and its immediate neighbor (marker-adjacent insert; block-anchored delete
  bounded by the block's own start AND end headings). After any scripted
  edit to a tracked ledger file, diff against HEAD (`git diff --numstat`)
  before declaring success — a green content validator proves the file is
  well-formed, never that nothing was lost.
- **Verification:** pristine file restored from HEAD (1,989 lines; the
  expected 2026-10-09 lesson present); `git diff --numstat` shows insertions
  only and zero deletions; learnings:check PASS; lint:md and prettier clean.
- **Scope:** internal
- **Owning FID:** FID-2026-1009-001
- **Status:** active

## Lesson: Verification gates inside a code fence are invisible to fid:verify

- **Date:** 2026-10-09
- **Failure:** FID-2026-1009-001 declared its verification gates inside a
  markdown fence, copying the shape of the FID template's example block. The
  gates-section locator strips fenced blocks BEFORE parsing, so the fence —
  which the template uses to show an EXAMPLE — declared nothing, and
  fid:verify would have reported "no gates declared" with no receipt
  stampable for the verified status flip. Archived records declare gates as
  plain bullets outside any fence.
- **Evidence:** packages/agent-runtime/src/echo/fid-verification-gates-locators.ts → symbol:withoutFencedBlocks,
  packages/agent-runtime/src/echo/fid-verification-gates-locators.ts → symbol:verificationGatesSection,
  dev/fids/archive/FID-2026-1008-005-model-picker-swr-gauntlet-docs-autowire.md → heading:Verification Gates
- **Invariant:** A fence makes content documentation, never declaration —
  any machine-read contract (gates, receipts, register targets) must live
  outside fences. The template's fenced block shows the SHAPE of a
  declaration; copying the fence copies the invisibility.
- **Guard:** When declaring FID gates, write plain gate bullets directly
  under the Verification Gates heading and dry-run fid:verify on the record —
  it fails loudly ("no gates declared") long before a status flip. Copy the
  structure of an archived record, never the template's fenced example.
- **Verification:** after un-fencing, fid:verify --write stamped 6/6 gates
  exit 0 and fid:verify --check PASS — all active fixed/verified FIDs carry
  valid receipts.
- **Scope:** internal
- **Owning FID:** FID-2026-1009-001
- **Status:** active

## Lesson: Extend an existing command before registering its replacement

- **Date:** 2026-10-09
- **Failure:** Compliance added a second `/telemetry` entry beside remote
  consent. Full CLI regression caught the duplicate; first-match dispatch
  would otherwise hide the new feature.
- **Evidence:** cli/src/commands/telemetry.ts → symbol:handleTelemetryCommand,
  cli/src/commands/__tests__/telemetry-command.test.ts → test:the telemetry command is registered
- **Invariant:** One public command name has one registry owner; new argument
  behavior must preserve its existing consent and alias semantics.
- **Guard:** Search registry and menu before registration; pin uniqueness and
  exercise dispatch through the real registry rather than a helper alone.
- **Verification:** Targeted CLI integration 46 pass; full CLI 4,026 pass;
  full root 8,572 pass, zero failures after command integration.
- **Scope:** internal
- **Owning FID:** FID-2026-1007-012
- **Status:** active

## Lesson: Preserve operator-owned controls through a visual redesign

- **Date:** 2026-10-09
- **Failure:** Sidebar polish removed the S logo and raised fold buttons,
  left folded controls off-center, and lost context after re-expansion.
  The operator had to identify each regression.
- **Evidence:** cli/src/components/right-sidebar-rail-control.tsx → symbol:RailControl,
  cli/src/components/__tests__/right-sidebar-responsive.test.tsx →
  test:chat composition follows the breakpoint and preserves manual folds
- **Invariant:** Existing brand controls, alignment, user state and truthful
  context are acceptance requirements during visual refinement.
- **Guard:** Record existing controls before redesign; verify real fold,
  resize and re-expand paths, including native layout event names and cleanup.
- **Verification:** 84 UI tests pass; 38 revised native captures; centered
  S/navigation/context/version, raised buttons and context recovery verified.
- **Scope:** internal
- **Owning FID:** FID-2026-1008-006
- **Status:** active

## Lesson: A failing part is not a failing whole

- **Date:** 2026-10-07
- **Failure:** The identity gauntlet tested one hard-coded target and emitted one
  verdict, so a single route being down read as a statement about the provider —
  the operator corrected it twice: "why does that gauntlet only test a single
  model and call it done?" and "just because one model is down, does not mean the
  entire provider is down. For example, i just tried glm 5.3 flash and it
  responded." In the same minute HCNSec answered `glm-5.3-flash` with 200 and
  `kimi-k3` with 500, so a one-target run could not tell a broken route from a
  broken host, and never asked the routes where a substituted `model` label was
  being served.
- **Evidence:** scripts/providers/lib/provider-models.ts → symbol:providerRoutes,
  scripts/providers/lib/identity-core.ts → symbol:classifyServedLabel,
  scripts/providers/lib/identity-matrix.ts → symbol:runIdentityMatrix,
  scripts/providers/__tests__/identity-matrix.test.ts → test:a served label that does not name the requested model is flagged
- **Invariant:** A per-member result must be reported per member; a failure in
  one member must never be aggregated into a claim about its container. Testing
  one member of a set and reporting on the set is not a smaller version of the
  test — it is a false one, because a healthy sibling is exactly the evidence
  that separates "this member is broken" from "the container is broken".
- **Guard:** When a tool's subject is a collection (a provider's routes, a host's
  endpoints), enumerate the collection by default and emit one row per member
  with its own status; require an explicit scope argument to narrow it. Keep the
  member states distinct — `ok`, `unavailable` (refused for funding) and
  `failed` (the route is broken) are three facts, not two.
- **Verification:** `bun run providers:identity -- --provider hcnsec --all` wrote
  `dev/provider-identity/identity-matrix.md` with seven per-route rows (ok 1,
  failed 6) and no provider-level failure; the pins assert one `ok` row beside a
  `failed` row, that a quota refusal is `unavailable` rather than `failed`, and
  that a served label not naming the requested model is flagged `mismatch`.
- **Scope:** internal
- **Owning FID:** FID-2026-1007-008
- **Status:** active

## Lesson: A control that fails is not a control that disagrees

- **Date:** 2026-10-07
- **Failure:** The identity gauntlet's first draft counted a comparison
  control's *attempts* as its denominator and its *matches* as its numerator, so
  a control that never answered scored zero matches out of three attempts and
  was classified `separated` — "this control is a different model" — when the
  truth was "this control did not respond". That single confusion would have
  converted six connection refusals into evidence that the target route serves
  something other than the model it claims, which is precisely the fabrication
  the whole audit program exists to prevent. The pin asserting
  `controls.sameModel === 'unavailable'` failed with `Received: "separated"`
  and found it. A control's verdict and its liveness are separate facts, and
  only the first may feed a comparison.
- **Evidence:** scripts/providers/lib/identity-runner.ts → symbol:verdictFor,
  scripts/providers/__tests__/identity-gauntlet.test.ts → test:an unavailable control means inconclusive,
  dev/fids/archive/FID-2026-1007-008-provider-identity-gauntlet.md → heading:Code Verification Evidence
- **Invariant:** A comparison needs three outcomes, not two: agrees, disagrees,
  and did not answer. Collapsing "did not answer" into "disagrees" turns an
  infrastructure failure into a substantive finding, and the more the
  infrastructure fails the stronger the false finding looks. When a control is
  required for a verdict, an absent control must force the weakest conclusion,
  never the strongest.
- **Guard:** Any comparison against a baseline must count completed baseline
  observations separately from matching ones, and must branch on the completed
  count first. If the baseline produced nothing, the result is `unavailable` — a
  third state that can only widen the uncertainty, never narrow it. Prefer a
  `no-signal` status over a default verdict in every per-vector summary too.
- **Verification:** The gauntlet pins drive an invoker that throws for the
  control and completes for the target: the verdict falls to `inconclusive`,
  `controls.sameModel` reads `unavailable`, and a target probe that times out
  leaves its vector `no-signal` with the failure class named in the evidence;
  absent token usage is pinned as `no-signal` rather than a tokenizer breach.
- **Scope:** internal
- **Owning FID:** FID-2026-1007-008
- **Status:** active

## Lesson: A telemetry value's absence and its zero are different facts

- **Date:** 2026-10-07
- **Failure:** The CLI had no cache-reuse row, and the reason was not a missing
  component: the fact itself had been destroyed twice on the way up. The SDK
  emitter normalized `cachedInputTokens: params.usage.cachedInputTokens ?? 0` to
  keep the shape stable, and the runtime then applied an R3 heuristic —
  `cachedInputTokens > 0` means "known" — which read that coerced `0` as
  "unknown". So a provider that reports no caching and a provider reporting a
  genuine cache miss were indistinguishable, in opposite directions: absent data
  could not be shown as unknown, and a real miss could not be shown as a miss.
  Rendering either one would have been an invention about what the provider
  sent, and the operator's whole ask was that the number not lie. The fix is a
  presence flag carried from the provider's own field to the UI, not a smarter
  inference at the bottom of the stack.
- **Evidence:** common/src/types/session-state-cache-usage.ts → symbol:CacheUsageSummary,
  packages/agent-runtime/src/util/cache-session-telemetry.ts → symbol:accumulateCacheUsage,
  packages/agent-runtime/src/util/token-telemetry.ts → symbol:isCachedTokenCountKnown
- **Invariant:** Absence and zero are different observations and must stay
  different all the way to the point of display. Normalization that improves
  shape stability by substituting a default destroys exactly the bit a truthful
  UI needs, and no downstream heuristic can recover it — a default is
  indistinguishable from a measured value once it is written. Presence must be
  recorded where the provider's field is read, and carried as its own fact.
- **Guard:** Any boundary that coerces a missing field to a default must emit
  presence alongside the value in the same object, or be forbidden from
  defaulting at all. Any consumer that interprets a numeric default as
  meaningful (a `> 0` test, a threshold, a ratio) must be taught to prefer
  explicit presence and must keep its old behavior only for records that carry
  no flag — so pre-existing callers do not silently change meaning.
- **Verification:** Checking the two seam files out to their pre-fix revisions
  fails the new pins (`9 pass / 1 fail` at the R3 seam, `1 pass / 3 fail` at the
  SDK boundary) and restoring them returns 10 pass and 4 pass; the sidebar pins
  read the row's own text node, because a bare `toContain('0%')` passes against
  every row's `width="100%"` without the Cache row existing at all.
- **Scope:** internal
- **Owning FID:** FID-2026-1007-009
- **Status:** active

## Lesson: A new AgentState field is not a free edit — the compiler makes you classify it

- **Date:** 2026-10-07
- **Failure:** Adding `cacheUsage` to `AgentState` broke `typecheck` in a file
  nobody would think to open, with a message that names nothing:
  `spawn-child-fields.ts(210,15): error TS2344: Type 'string' does not satisfy
  the constraint 'never'`. The module holds a compile-time exhaustiveness gate —
  `Exclude<keyof AgentState, Inherited | ChildOwn | ByDesign>` asserted `never` —
  so every field must be *declared* as copied from the spawning parent,
  constructed for the child, or deliberately absent with a written reason. The
  gate is right and the error is the gate working; the half hour is spent
  re-deriving the error rather than fighting the design. Reading the gate first
  turns an alarming opaque failure into one line of work.
- **Evidence:** packages/agent-runtime/src/tools/handlers/tool/spawn-child-fields.ts → symbol:NOT_INHERITED_BY_DESIGN,
  common/src/types/session-state-agent-state.ts → symbol:AgentState,
  dev/fids/archive/FID-2026-1007-009-sidebar-cache-hit-tracker.md → heading:Code Verification Evidence
- **Invariant:** New per-run state belongs to exactly one of three
  classifications, and "not inherited by design" is not an escape hatch — its
  entries must carry the reason the child is safe without the field. The reason
  is the artifact; the list membership is bookkeeping. A child that silently
  inherits per-run telemetry pollutes the parent's accounting with another
  run's traffic.
- **Guard:** When a field is appended to `AgentState`, classify it in the same
  change: append to `INHERITED_FROM_PARENT` or `CHILD_OWN`, or add an entry to
  `NOT_INHERITED_BY_DESIGN` with a sentence naming why the child does not need
  it. Treat `Type 'string' does not satisfy the constraint 'never'` as "open
  spawn-child-fields.ts", not as a compiler mystery.
- **Verification:** `bun run typecheck` fails at that line before the entry is
  added and exits 0 after; the added reason sits beside `lastProviderUsage`,
  the closest precedent (provider usage observed on the owning run's stream);
  the FID records the classification rather than the compile error alone.
- **Scope:** internal
- **Owning FID:** FID-2026-1007-009
- **Status:** active

## Lesson: A health breaker may throttle background traffic but must never deny a user action

- **Date:** 2026-10-07
- **Failure:** The operator was refused their own model turns twice in one session,
  for 30 minutes at a time, and could not tell what had happened because every model
  that had not tripped its own gate still worked: *"i don't even know what caused it,
  the model was working perfetly fine?"* The cause was a provider-reachability
  circuit breaker doing exactly what it was designed to do — three transient failures
  open a 30-minute cooldown — but it was wired where it had no business being: at the
  top of `runWithClassifiedRetry`, before `params.create()`, so it refused the turn
  instead of pacing a retry. Two properties made it look random: the breaker is keyed
  per provider *connection*, so switching models on one connection could not escape
  it, while separate providers each opened independently; and the refusal arrived as a
  local error that masked the real upstream verdict. The operator's ruling supplied
  the missing acceptance criterion, verbatim: *"it should NEVER stop a user from using
  a model."* A breaker's legitimate job is to stop *automatic* traffic — retries,
  background probes, scheduled work. A user action is not automatic traffic, and the
  cost of throttling it (a silent 30-minute denial) is not the cost the breaker was
  calibrated to trade against.
- **Evidence:** packages/agent-runtime/src/prompt-agent-stream.ts → symbol:getAgentStreamFromTemplate,
  packages/agent-runtime/src/provider-boundary/provider-circuit-breaker.ts → symbol:ProviderCircuitBreaker,
  dev/fids/archive/FID-2026-1007-007-user-model-calls-bypass-provider-breaker.md → heading:Code Verification Evidence
- **Invariant:** A circuit breaker may suppress retries; it may never suppress the
  first request of a decision a human just made. Whatever gates a user action must be
  able to name the response it is denying — if no request was attempted, there is no
  provider health to report, only a local implementation choice being presented as a
  provider verdict. Corollary: never let a local refusal wear the provider's clothes.
  If the gate fires, the user must still be able to distinguish "the provider said no"
  from "we never asked."
- **Guard:** Before placing any breaker, rate limiter or health gate on a path, ask
  who initiates that path. Human-initiated work gets at most retry suppression, never
  a preflight refusal, and the failure it finally reports must be the provider's own
  classified error. When a user-visible refusal is added anywhere, the record must
  state which physical request it prevented.
- **Verification:** The closure pass re-reproduced the defect rather than trusting the
  earlier run — reverting only `classified-stream-retry.ts` restores `0 pass / 2 fail`
  printing `ProviderBoundaryBlockedError: provider call blocked: Circuit breaker open
  — 30min cooldown remaining`, and restoring it returns 2 pass and 6 pass — with
  `typecheck packages/agent-runtime` and all five declared gates at exit 0, receipt 5/5
  live at the archived path. `grep -rn checkCooldown packages/agent-runtime/src cli/src
  common/src` shows the provider breaker's cooldown gate now has no production caller.
- **Scope:** internal
- **Owning FID:** FID-2026-1007-007
- **Status:** active

## Lesson: Removing a gate from its only caller leaves production-dead code behind

- **Date:** 2026-10-07
- **Failure:** FID-2026-1007-007's fix was correct and complete against its stated
  steps — "remove the pre-request cooldown refusal from `runWithClassifiedRetry`" — and
  it silently left two pieces of production-dead surface behind:
  `ProviderCircuitBreaker.checkCooldown()`, the very method whose call site was
  removed, and `ProviderBoundaryBlockedError`, the error the removed line threw. Both
  still compile, both are still unit-tested, and both still read as live API: the
  breaker's own class comment described `checkCooldown` as the way to "gate one call."
  A future author wiring a new call site would have found a method with a
  gate-one-call docstring and three passing tests, and would have re-armed the exact
  defect this record cured. Deleting them blindly was equally wrong — they are the FSM's
  tested public surface, and `checkCooldown` is the only thing that exercises the
  `half_open` admission rule directly.
- **Evidence:** packages/agent-runtime/src/provider-boundary/provider-circuit-breaker.ts → symbol:ProviderCircuitBreaker,
  packages/agent-runtime/src/provider-boundary/failure-class.ts → symbol:ProviderBoundaryBlockedError,
  dev/fids/archive/FID-2026-1007-007-user-model-calls-bypass-provider-breaker.md → heading:Code Verification Evidence
- **Invariant:** A repair that removes a call site must account for what the call site
  was the only user of. "No production caller remains" is a finding to record in the
  same breath as the fix, and the surviving surface must say so in its own docstring —
  dead code that still advertises the old contract is a re-arming instruction, and the
  next author cannot be expected to rediscover the removal.
- **Guard:** After any change that deletes a call site, grep the removed symbol's
  callee across every production workspace and state the result. If the callee
  survives, either delete it or update its docstring to say that it has no production
  caller and why it is retained — and record the choice and its limits in the record's
  Code Verification Evidence rather than leaving it to be inferred.
- **Verification:** `grep -rn ProviderBoundaryBlockedError packages/agent-runtime/src
  cli/src common/src` returns only its definition plus one test that constructs it,
  and `grep -rn checkCooldown` returns the provider-breaker definition, the separate
  context-compactor breaker (a real production caller) and the two breaker test files;
  both limits are written into FID-2026-1007-007's Loop 3 ADVERSARIAL and Code
  Verification Evidence.
- **Scope:** internal
- **Owning FID:** FID-2026-1007-007
- **Status:** active

## Lesson: A blocker inherited from an outside document must be traced to its owner

- **Date:** 2026-10-07
- **Failure:** Two steps of `FID-2026-1006-005` were recorded as blocked on a live
  provider endpoint and provider billing, and the record stayed open on that basis
  across several passes and a full gate battery. Tracing the requirement backwards
  ended at the record's OWN reconciliation of a vendor report's Approval Point 3 — not
  at the operator, who had never approved paying for anything and said so when asked
  (verbatim: *"im not paying for anything, i never approved that — so where is that
  even coming from as a requirement?"*). "We were waiting on a live endpoint" reads
  exactly like "the operator asked for a paid measurement", and the difference was
  one look at who raised it. Once the requirement was re-scoped to what is evaluable
  offline, both steps closed the same day: the tool set turns out to be assembled once
  per run, so the Anthropic betas have nothing to smooth, and the prefix-stability
  ratio the shipped instrument computes is 100% on the loop the program targets.
- **Evidence:** packages/agent-runtime/src/run-agent-step/loop-context.ts → symbol:createLoopContext,
  packages/agent-runtime/src/run-agent-step/loop-context-drive.ts → symbol:applyDriveDirectives,
  SCOPE.md → heading:Open items
- **Invariant:** A blocker is a claim about WHO is holding the work. Trace every
  blocker to its owner before it is allowed to hold anything — and when the owner is a
  document the work is adjudicating, the requirement does not exist until the operator
  raises it. A blocker with no owner is not a blocker; it is unexamined work, and the
  honest disposition is to make it measurable rather than to wait on it.
- **Guard:** Before recording any blocker, name the person or artifact holding the
  work and the sentence that put it there. If the answer is "a document we are
  adjudicating", the step is not blocked — it is unexamined, and the fix is to reduce
  it to something the environment can measure. The live leg may stay a stated boundary
  ("no provider hit ratio is claimed here"), but a boundary is not a blocker and must
  never hold a record open.
- **Verification:** `git log -S"not startable in this environment"` finds the old step
  text; the re-scoped steps' evidence is in the record's Loop 7 and its step 8/step 10
  text; `bun run dev/scratchpad/active/cache-prefix-ratio-measure.ts` reproduces the
  step-10 table, and the step-8 absence is a scoped grep returning 0 matches; all
  eight declared gates exit 0 at the stamped receipt.
- **Scope:** internal
- **Owning FID:** FID-2026-1006-005
- **Status:** active

## Lesson: Opt-in isolation is not isolation, and a reset is not an authority

- **Date:** 2026-10-07
- **Failure:** The `cli` suite's one red test passed alone and failed in the
  workspace run, receiving the operator's own cached provider naming for a row its
  mock never produced. Two readings were available and the first was wrong: the suite
  does not read the user's config directory (the dir it resolves holds no catalog) — it
  FETCHES, from a fire-and-forget boot warm that the server test harness raises 36
  times per run. The per-file isolation that existed was opt-in (only the files that
  called the harness got a temp config dir), and the module-scope catalog was published
  by whichever build settled last, including builds whose caller had already finished.
  Instrumenting the new guard named the file in one run: 82 claims against 37
  suppressed publishes.
- **Evidence:** cli/src/utils/openrouter-models/gateway.ts → symbol:fetchGatewayModels,
  cli/src/server/gateway.ts → symbol:startGateway,
  cli/src/utils/__tests__/openrouter-models-test-harness.ts → symbol:registerGatewayCatalogLifecycle
- **Invariant:** Isolation a file must remember to opt into protects the files that
  remember, so it belongs in the preload every file inherits. And when shared state is
  written by an un-awaited promise, widening the reset cannot fix it — a reset can only
  null state it can reach, so the repair is an AUTHORITY rule (only the current build
  may publish), which is also the only shape that survives a caller that has moved on.
- **Guard:** Set the environment override in the workspace preload, not in a per-file
  helper, so a file that forgets is still isolated; and treat any un-awaited shared-state
  write as an authority question rather than a cleanup question — ask which build may
  publish, not what state should be cleared. When a suite failure names a value no
  fixture contains, instrument the writer and run it once: the stack names the file.
- **Verification:** `cli/src/utils/__tests__/openrouter-models-gateway-cache.test.ts`
  (2 pins) and `cli/src/utils/__tests__/config-dir-isolation.test.ts` (1 pin) all fail
  on the pre-fix tree — reverting `gateway.ts` alone restores `3964 pass / 4 fail`, and
  reverting `test-setup.ts` alone fails the config-dir pin; the full `cli` suite is
  `3969 pass / 18 skip / 0 fail` across 482 files.
- **Scope:** internal
- **Owning FID:** FID-2026-1007-006
- **Status:** active

## Lesson: A marker rule and a placement rule are different rules

- **Date:** 2026-10-07
- **Failure:** One predicate, `isFreeTierEntry`, answered two questions that look
  alike and are not: which rows deserve the ⭐ (the operator's actual request — "if it
  has free in the name or is from this provider, add the star") and which rows leave
  their provider group. Because a free-key provider's every row satisfies the marker
  rule, a correct wiring of ChatAnywhere would still have relocated its whole roster
  out of its own `CHATANYWHERE` group into the synthetic section — the "doesn't match
  the rest of the list" half of the operator's report, and invisible to every gate
  because the count was right and the placement was untested. The same pass found the
  class behind it: the registry/catalog pairing was derived in ONE direction only, so a
  provider whose registry entry declared `modelsRef` and which contributed zero picker
  rows failed nothing.
- **Evidence:** cli/src/components/model-picker-grouping.ts → symbol:buildGroupedItems,
  cli/src/utils/free-badge.ts → symbol:isFreeTierEntry,
  scripts/provider-catalog-parity.ts → symbol:catalogPairingIssues
- **Invariant:** When one predicate answers two questions, they will eventually be
  answered the same way and the wrong one will win. Split the marker rule from the
  presentation rule and let each be pinned separately — and make a derived pairing
  check BOTH directions, so a stale exception cannot hide a provider that has since
  been wired.
- **Guard:** Before reusing a predicate, read it as a sentence about the QUESTION it
  answers, not the intent it was written with; if one name answers both "is it marked"
  and "where does it live", split it. And when a registry declares a pairing
  (`modelsRef` → a catalogue), assert the pairing's REACH, not just its types — a
  compile-time key check proves the reference resolves and says nothing about whether
  anything consumes it.
- **Verification:** `cli/src/components/__tests__/model-picker-free-section.test.ts`
  (the rewritten hoisting pin plus three new ones), the ChatAnywhere rows in
  `cli/src/utils/__tests__/openrouter-models-gateway-providers.test.ts`, and four
  offline pairing cases in `scripts/__tests__/provider-catalog-parity.test.ts`; the
  live census through the shipped function reads `chatanywhere: 27` and
  `provider-parity-check` exits 0.
- **Scope:** internal
- **Owning FID:** FID-2026-1007-005
- **Status:** active

## Lesson: A suite can be passing because of the defect it is named after

- **Date:** 2026-10-07
- **Failure:** The heaviest evidence in this loop was not a new failing test but an
  old one going red. `util/__tests__/messages-trim.test.ts` was passing **partly
  because of the defect it exists to prevent**: its terminal fixtures were bare JSON
  strings, a shape `run_terminal_command`'s output schema cannot produce, so the old
  transform threw into its lossy fallback (`{ command: '',
  stdoutOmittedForLength: true }`), collapsing a ~2,018-character result to roughly
  40 characters — and that silent destruction was what satisfied the suite's own
  token-budget assertion (`finalTokens < maxTotalTokens * 0.5`). A transform
  changed to refuse a shape it cannot faithfully represent turned that assertion
  red, and the two candidate repairs were not equivalent: rewriting the assertion to
  match the new code hides the defect again, while repairing the fixture to the shape
  the real tool emits — and registering the retention handles the precondition now
  requires — keeps the assertion and turns a decorative test into evidence.
- **Evidence:** packages/agent-runtime/src/util/simplify-tool-results.ts → symbol:simplifyTerminalCommandResults,
  packages/agent-runtime/src/util/messages/trimming.ts → symbol:ledgerTrimPass,
  packages/agent-runtime/src/util/__tests__/messages-trim.test.ts → test:handles all features working together correctly
- **Invariant:** A passing suite is a claim about the CODE **and** the FIXTURES. When a
  fixture cannot be produced by the tool it stands for, the test measures the
  transform's error path instead of its real one — and an error path that returns a
  conveniently tiny result will keep a token/size assertion green no matter what the
  production path does.
- **Guard:** When a fix turns an existing test red, the first question is not "how do
  I restore it" but "which of the two was lying"; repair the fixture to the shape the
  real tool emits and keep the assertion. Pin the precondition the fixture depends on
  (here: the boundary retained these payloads, so the fixture registers the handles)
  instead of relying on a transform that used to drop first and never ask.
- **Verification:** the repaired fixture drives the SHIPPED transforms and asserts the
  same budget as before (`packages/agent-runtime` 1905 pass / 0 fail across 297
  files); the refusals it now depends on are pinned by
  `util/__tests__/simplify-tool-results-omission.test.ts` (9 tests, both legs of the
  property) and `util/__tests__/messages-trim-inventory.test.ts` (3 tests); all eleven
  gates declared on FID-2026-1007-004 exit 0 at the stamped receipt.
- **Scope:** internal
- **Owning FID:** FID-2026-1007-004
- **Status:** active

## Lesson: A gate that cannot be declared cannot be proven

- **Date:** 2026-10-07
- **Failure:** Twelve repository gates were enforced and un-recordable at the same
  time. The FID gate executor accepts four shapes and nothing else
  (`typecheck <workspace>`, `test <path>`, `probe <path>`, `quality`,
  FID-2026-0823-009), so `eslint`, `prettier`, the frozen lockfile install, the SDK
  build, the CLI bundle resolution, the version sync, the provider census, the
  design-system token freshness, the release pre-audit, the eval-tier rehearsal, the
  CI build chain and the governance smoke had no declaration in that vocabulary —
  which means a record whose subject was any of them could not declare the check
  that proved it. The route out was documented, and it had been used exactly once:
  make the check independently runnable and declare it as a `probe`. It was applied
  as a one-off fix to the markdown gate (T154) instead of as the answer to a class,
  and nothing enumerated the rest, so the class stayed open — green every day and
  unusable at the one moment a record needed it.
- **Evidence:** scripts/probe-runner.ts → symbol:runProbe,
  scripts/gate-declarability.ts → symbol:collectGateDeclarabilityIssues,
  scripts/gate-declarability-registry.ts → symbol:auditedGates,
  scripts/gate-declarability-registry.ts → symbol:INTENTIONALLY_NON_DECLARABLE,
  scripts/validation-gates.ts → symbol:repositoryValidationGates
- **Invariant:** "The gate passed" and "the gate can be recorded" are different
  properties. The second is set by the record contract's vocabulary, not by the
  gate, so a gate outside that vocabulary is invisible until a FID's subject IS that
  gate — and then the record cannot be written at all, which is a defect in the gate
  surface rather than in the record.
- **Guard:** When a check cannot be expressed in the record contract's vocabulary,
  make it independently runnable (exit 0 clean / 1 with issues) and declare it as a
  probe — and spawn through `process.execPath` with argv ARRAYS and an INHERITED
  env, or the probe reintroduces the runtime-name and environment class the release
  gates exist to catch. Then audit the pairing rather than the prose: verify each
  declaration with the SAME allowlist the executor uses, and drive the audit from
  the gate contract so a newly added gate is found without anyone remembering to
  add it to the audit.
- **Verification:** 29 repository gates are audited with the declaration that proves
  each, 16 of them thin `scripts/probe-runner.ts` probes; `validate:repository`
  fails on an unaudited contract gate, on a declaration the real allowlist rejects,
  and on an undeclarable gate with no stated and permitted reason; 19 tests pass
  across the audit's two pin files and the scripts tree typechecks.
- **Scope:** internal
- **Owning FID:** FID-2026-1007-003
- **Status:** active

## Lesson: A marker that names a possibility is not a locator

- **Date:** 2026-10-07
- **Failure:** The tool-output truncation pre-pass reads as if it retains the full
  value behind a pointer, and it does not. Measured on the shipped functions: a
  60,000-char string returns a 500-char quoted preview whose marker's `fullOutput`
  is the fixed string `'[See cache-debug snapshot / rerun the tool for full
  output]'` — two possibilities, neither a location, and cache-debug is off; a
  3,000-item array returns 2,000 `keptItems` with no pointer to the rest; and the
  two other model-facing simplifiers (`simplifyReadFileResults`,
  `simplifyTerminalCommandResults`) each emit their own boolean
  (`contentOmittedForLength`, `stdoutOmittedForLength`) with no count and no
  pointer. Three markers, three vocabularies, zero locators. The one place the raw
  bytes actually survive — the per-run evidence spill at
  `.savant/evidence/<runId>.jsonl`, bounded at 512 KiB/record and 8 MiB/file — is
  unreachable from any of them and is spliced back only for
  `requiresRawEvidence` agents.
- **Evidence:** packages/agent-runtime/src/util/simplify-tool-results.ts →
  symbol:truncateToolOutputValue, packages/agent-runtime/src/evidence/spill.ts →
  symbol:recordEvidence, packages/agent-runtime/src/util/messages/trimming.ts →
  symbol:trimMessagesToFitTokenLimit
- **Invariant:** A replacement payload and a retention claim are two different
  things, and only one of them is testable inside the process. A marker that
  cannot name where the omitted bytes are is a hopeful comment with a type: the
  reader has no way to distinguish "retained elsewhere" from "gone".
- **Guard:** When a destructive path replaces a value, the marker must name a
  location the caller can actually COMPUTE (a path plus a key), not a possibility —
  and the retention mechanism's own caps must be reported where they truncate,
  because a bounded store that silently stops recording is the same as no store.
  Audit such paths by measuring the shipped functions over payload shapes, never by
  reading the code and the comment above it: the comment here says "retains the
  pre-truncation value on disk" about a file that is not written unless cache-debug
  is enabled.
- **Verification:** `dev/scratchpad/active/step3-truncation-audit.ts` drove the
  shipped truncation functions over a 60,000-char string, a 3,000-item array, a
  3,000-line string, an over-cap object and a nested search-shape object; the
  measured numbers are in FID-2026-1006-005 step 3, and the locator gap it found is
  recorded there as step 11 rather than reported as parity.
- **Scope:** internal
- **Owning FID:** FID-2026-1006-005
- **Status:** active

## Lesson: A leak class is enumerated, not inferred from the instance that hurt

- **Date:** 2026-10-07
- **Failure:** Repairing the one registry that caused 76 failures (the provider
  breaker, FID-2026-1007-001) left the class it belonged to invisible: module-scope
  state that `bun test` shares across files. Reasoning about "probably more of these"
  produced no action; enumerating them produced 144 bindings across 98 files with no
  way back to their start state, plus six workspaces that had NO test preload at all
  (Bun does not walk up for `[test] preload` — measured, not assumed). The first
  scanner was also wrong in both directions and would have made the repair worse: a
  matcher that accepted only `reset*` names reported covered bindings as gaps, and it
  could not see a declaration wrapped across lines (`const listToolsCache: Record<`
  with the initializer several lines below). Acting on that list would have minted a
  second reset for the same state in dozens of files.
- **Evidence:** scripts/audit-module-state.ts → symbol:collectModuleStateAudit,
  scripts/module-state-scan.ts → symbol:scanModuleState,
  scripts/__tests__/module-state-audit.test.ts →
  test:a declaration wrapped across lines is still a candidate
- **Invariant:** A defect that appears in one place is usually the visible member of a
  class, and the class is only actionable once it is a list. A guard that produces that
  list must be validated in both directions first — a false POSITIVE spends effort on
  work that is already done, and a false NEGATIVE leaves the class unenumerated, which
  is the state the enumeration exists to end.
- **Guard:** Before repairing a second instance of a class, build the enumerator and
  measure the class size; before acting on the enumerator's output, check its
  state/no-state boundary and its coverage-name vocabulary against the repository's
  real conventions (`reset*`, `clear*`, `__reset*`) with fixture pins.
- **Verification:** the audit went from 144 findings to 0 over 2481 scanned files
  (`bun scripts/module-state-check.ts` exit 0), and the pins in
  `scripts/__tests__/module-state-audit.test.ts` are 11/11, including the read-only
  constant (not state), the nested binding (not module scope), the wrapped declaration
  (a candidate) and the `__reset*`/`clear*` seams (coverage).
- **Scope:** internal
- **Owning FID:** FID-2026-1007-002
- **Status:** active

## Lesson: A reset has no value until a preload calls it, and a boundary has two levels

- **Date:** 2026-10-07
- **Failure:** Coverage is not isolation. A module can expose a perfect reset that no
  test process ever calls — so the audit grew a wiring leg (a preload's imported reset
  must still exist AND still be called) and a reach leg (which resettable modules no
  preload loads, named with a reason). Wiring then produced two failures that showed the
  boundary is not one level: clearing the database connection cache before every case
  handed a later case a different in-memory database than the handle its file had
  captured (`FOREIGN KEY constraint failed`), and resetting the CLI theme store broke
  122 component tests that render without initializing it. State a case must be able to
  observe belongs to the FILE boundary; state that must not leak between cases belongs
  to the case. And a leak can be load-bearing: 122 tests depended on it, which makes
  removing it a change to those tests rather than a wiring detail.
- **Evidence:** scripts/module-state-wiring.ts → symbol:wiringIssues,
  scripts/module-state-exemptions.ts → symbol:UNWIRED_MODULE_REASONS,
  packages/database/src/sqlite.ts → symbol:resetSqliteState,
  cli/src/hooks/use-theme.tsx → symbol:resetUseThemeState
- **Invariant:** "It is resettable" and "it is isolated" are different claims: a reset
  needs a caller, a caller needs a safe import, and a safe import needs the right
  boundary. Clearing state at the wrong level breaks the very tests it was meant to
  stabilize — a shared in-memory handle, a store a suite initializes once — so the
  boundary is chosen by what a single case must be able to observe, not by which line
  is convenient to add.
- **Guard:** When adding an isolation reset, wire it and run the workspace suite; put
  per-case state in `beforeEach` and state that a case owns its handle in `afterAll`;
  and when a reset cannot be wired, record the module and the reason where the audit
  can enforce it (an unreached module with no reason fails, and a reason that no longer
  describes anything fails too).
- **Verification:** 180 of 187 resettable bindings are wired across ten preload
  surfaces, the database suite is 51/51 with the connection caches at the file
  boundary, the CLI suite is 3960 pass / 0 fail with the theme store unwired and its
  reason recorded, and all 13 workspace legs are green (8389 pass / 0 fail / 23 skip).
- **Scope:** internal
- **Owning FID:** FID-2026-1007-002
- **Status:** active

## Lesson: A process-lifetime registry plus a reused fixture key is deterministic test-order dependence

- **Date:** 2026-10-07
- **Failure:** 76 failures across four unrelated families (`run-agent-step`, `web_search`,
  `read-docs`, the hook-event suites) all threw the same provider-boundary error, and the
  only signal that mattered was that `getLlmCallCount()` read 0: the turns were refused
  before any physical request existed. One module-level `Map` of circuit breakers with no
  reset caused all 76 — `bun test` runs every file in a single process, the shared fixtures
  reuse the literal `clientSessionId: 'test-session'`, and three transient failures in one
  suite (`PROVIDER_BREAKER_MAX_FAILURES = 3`, 30-minute cooldown base) left the circuit
  OPEN on the key `legacy:test-session` for the rest of the run, so one suite's verdicts
  silently became every later suite's. The count was the distraction: 76 failures read as
  rot rather than as one defect. A second registry of the same class (the process-lifetime
  `DEFAULT_SEEN_SHAPES` set) suppressed an unknown shape already logged by an earlier file
  and was the last order-dependent failure.
- **Evidence:** packages/agent-runtime/src/provider-boundary/provider-circuit-breaker.ts →
  symbol:resetProviderCircuitBreakers,
  packages/agent-runtime/src/provider-boundary/classified-stream-retry.ts →
  symbol:resetUnknownShapeLog,
  packages/agent-runtime/src/__tests__/provider-breaker-test-isolation.test.ts →
  test:an open circuit on the shared key survives into a later case
- **Invariant:** Mutable module-level state is shared by every suite, because the runner
  loads all test files into one process, and a fixture that reuses one literal id turns that
  sharing from an accident into a deterministic ordering dependency: a test's verdict then
  depends on which files were loaded first, not on the test. Resetting such state at the test
  boundary is not the same change as relaxing the production contract — the registry stays
  process-wide and shared across turns in production, and neither reset has a production
  caller.
- **Guard:** Before accepting that a red suite has N causes, count the mechanism: when
  failing cases share a singleton, a registry or a fixed key, reduce the evidence to the
  smallest repro pair and run it together and alone in BOTH orders. Every module-level
  `Map`/`Set`/`let` that accumulates gets an exported reset called from a test preload, plus
  a pin showing the reset clears state an earlier case left behind.
- **Verification:** the two-file repro went from 4 pass / 5 fail in both orders to 9 pass /
  0 fail in both orders with zero `ProviderBoundaryBlockedError` lines;
  `bun run --cwd=packages/agent-runtime test` is 1868 pass / 0 fail across 292 files, and
  the new isolation suite is 4/4.
- **Scope:** internal
- **Owning FID:** FID-2026-1007-001
- **Status:** active

## Lesson: Removing shared-state noise is the start of the diagnosis, not the end of the repair

- **Date:** 2026-10-07
- **Failure:** The 76 failures were not the whole finding. Three production behaviour defects
  had no failing test of their own, because the suites that exercise those paths were refused
  at the provider boundary before the code under test ran — so the red run was equally
  silent about them as the green one would have been. With the leak isolated: `isAbortError`
  did not read through an error's `cause` chain, so a boundary-wrapped abort was treated as a
  failure; the loop's fallback message reported the wrapper's `provider call failed (…)`
  label instead of the provider's own error; and the stale-cycle guard — newer than the
  operator-mandated AUTONOMY CARVE-OUT documented in `post-terminal-breaker.ts` — auto-ended
  autonomous runs at exactly six identical steps
  (`STALE_CYCLE_REPEATS=3` × `MIN_STALE_CYCLE_LENGTH=2`), which is what Auto Drive does by
  design. A mandate with no test is advice: the guard never re-read the carve-out it was
  written under.
- **Evidence:** common/src/util/error/abort.ts → symbol:isAbortError,
  packages/agent-runtime/src/run-agent-step/error-output.ts → symbol:innermostError,
  packages/agent-runtime/src/run-agent-step/loop-guard-wiring.ts → symbol:evaluateLoopGuard,
  packages/agent-runtime/src/run-agent-step/post-terminal-breaker.ts →
  symbol:isAutonomousContinuation,
  packages/agent-runtime/src/__tests__/loop-guard-rails-wiring.test.ts →
  test:an autonomous run is not ended by the stale-cycle diagnosis
- **Invariant:** A defect is visible only to a test that runs. When an infrastructure fault
  blocks a suite before the code under test executes, both the red run and the green run that
  replaces it say nothing about that code, so "the suite is green now" is not evidence that
  the newly-running paths are correct — it is the first state in which it is possible to
  obtain such evidence.
- **Guard:** After removing noise that masked failures, enumerate what the now-running suites
  exercise for the first time and name every behaviour path that has no pin; write the pins
  before calling the repair complete. Before shipping a new mechanism, check it against the
  operator mandates that predate it, and pin each mandate it could override.
- **Verification:** the loop-guard suite pins both legs (an autonomous run survives a
  stale-cycle diagnosis; the iteration cap still ends it), `error-output-innermost.test.ts` is
  3/3, the abort suite carries four cause-chain cases, and all four fixes carry production
  call-graph evidence in `dev/fids/FID-2026-1007-001-agent-runtime-suite-breaker-leak-and-behavior-corrections.md`.
- **Scope:** internal
- **Owning FID:** FID-2026-1007-001
- **Status:** active

## Lesson: A cost model outgrown twice needs every site enumerated, not the constant retuned

- **Date:** 2026-10-06
- **Failure:** This subsystem had already recorded one correction of the same class — the
  reconcile scan was fixed for a 610-file tree on 2026-10-02 — and the fix was applied to
  one of its two hashing legs. The un-fixed sibling was then outgrown by the same growth
  that prompted the first fix, and the deletion leg's per-key `statSync` scan (5,459 calls)
  sat inside the same 500 ms budget, so a capture repair alone would have converted the
  advisory rather than restored verification.
- **Evidence:** packages/agent-runtime/src/echo/enforcement/worktree-capture.ts → symbol:captureWorktreeBaseline,
  packages/agent-runtime/src/echo/enforcement/worktree-scan.ts → symbol:collectDeletions
- **Invariant:** A size-dependent cost model is rarely one site. Finding a scale defect is
  a mandate to enumerate every site that shares the cost model, because the un-fixed
  sibling will be outgrown by the same growth that produced the finding.
- **Guard:** Before closing a budget or scale defect, grep for the shared constant and the
  sibling cost centres, fix each one, and pin each one structurally (work performed, not
  elapsed time).
- **Verification:** the record pins both legs structurally (hashes performed, paths
  checked) and its live probe measures capture and reconcile separately;
  `bun run fid:verify dev/fids/archive/FID-2026-1006-004-law15-capture-budget-refusal.md
  --check` reports 10/10.
- **Scope:** internal
- **Owning FID:** FID-2026-1006-004 (closed + archived)
- **Status:** active

## Lesson: A governance control that degrades to an advisory needs a loud, specific degradation

- **Date:** 2026-10-06
- **Failure:** Refusing a half-captured baseline was the correct call, but the advisory it
  produced named no files, no leg and no cause, and it disarmed the backstop for the rest of
  the session. Three distinct causes (enumeration failure, dirty-set failure, budget
  exhaustion) shared one catch-all sentence, and a git that answered in ~110 ms was reported
  as "git failed at turn end" — indistinguishable from a broken control, so the only
  observable symptom was a line of prose every reader learns to ignore.
- **Evidence:** packages/agent-runtime/src/echo/enforcement/worktree-capture.ts → symbol:captureWorktreeBaseline,
  packages/agent-runtime/src/echo/enforcement/worktree-git.ts → symbol:describeGitFailure
- **Invariant:** A control's degradation path needs the same specificity as its success
  path — the failed leg, the budget, the count and the error evidence. A degradation that
  cannot say why is dismissed as noise, and the real defect leaves with it.
- **Guard:** Every refusal or degraded verdict names the specific failed leg and carries its
  evidence; no two distinct causes share one message.
- **Verification:** the pins assert the leg name and the failure evidence per leg, and the
  live probe shows the post-fix path returning `degraded: false` with a named method.
- **Scope:** internal
- **Owning FID:** FID-2026-1006-004 (closed + archived)
- **Status:** active

## Lesson: A fix that deletes a detection class costs more than the work it removes

- **Date:** 2026-10-06
- **Failure:** Two deletion classes — a file untracked at capture and a session-created file
  — are invisible to every status-derived source, and were caught only by the expensive
  per-key loop being replaced. A cheaper `git ls-files --cached` diff looked equivalent and
  was strictly worse: the index says nothing about an unstaged removal, which is the single
  case the deletion leg exists for, so both nets would have gone blind at once.
- **Evidence:** packages/agent-runtime/src/echo/enforcement/worktree-scan.ts → symbol:collectDeletions,
  packages/agent-runtime/src/echo/enforcement/worktree-capture.ts → symbol:advanceWorktreeBaseline
- **Invariant:** Before replacing an expensive mechanism with a cheaper one, enumerate the
  cases for which the expensive one is the only net. A detection net that becomes cheaper by
  covering fewer classes has not been optimised; it has been removed.
- **Guard:** Each preserved class gets its own term and its own pin, and the pin names the
  class it protects rather than the mechanism it exercises.
- **Verification:** one pin per deletion class (a clean-at-capture removal, a vanished
  untracked-at-capture file, a vanished session-created path) — the deletion suite is 6/6
  across two consecutive runs.
- **Scope:** internal
- **Owning FID:** FID-2026-1006-004 (closed + archived)
- **Status:** active

## Lesson: A library-complete hand-off needs a named consumer, not a readiness note

- **Date:** 2026-10-06
- **Failure:** `FID-2026-1006-002` closed six deliverables as "module + tests" and
  reported "no production call path yet" as a *stated limitation* in the same pass that
  closed it. No follow-on item was registered, so the limitation left the record with
  the record — the same failure that record's own Lessons Learned had already named for
  T148 and T149, where a review closed on its report and delegated adoption to "its own
  registered item" that was never created. `FID-2026-1006-003` had to be authored from
  the operator's ruling that a delivered-but-uncalled module is not a complete feature.
- **Evidence:** dev/fids/archive/FID-2026-1006-002-pi-harness-adoption-program.md → heading:Lessons Learned,
  dev/fids/archive/FID-2026-1006-003-wire-uncalled-adoption-modules.md → heading:Lessons Learned
- **Invariant:** "Ready for the first consumer" is a hand-off, and a hand-off is complete
  only when a live surface names the owner of the next step. A limitation stated inside
  a record that then closes is invisible to every register-shaped check, because the
  register holds open items and a closed record is no longer one.
- **Guard:** Before closing a FID that leaves any artifact without a production caller,
  create the wiring item in the same pass — a register line with its write targets, or
  an active FID — and say in the closure text which one owns it.
- **Verification:** the wiring record exists and closes on Law 4 grep evidence; the six
  production callers are pasted under `### Code Verification Evidence` in
  `dev/fids/archive/FID-2026-1006-003-wire-uncalled-adoption-modules.md`.
- **Scope:** internal
- **Owning FID:** FID-2026-1006-003 (closed + archived)
- **Status:** active
- **Canonical rule:** library-complete-needs-a-named-consumer

## Lesson: Law 4 is satisfied by the caller, not by the test that imports the module

- **Date:** 2026-10-06
- **Failure:** The four surfaces `FID-2026-1006-002` left uncalled all had green module
  suites — the cut-point planner, the file ledger, the guard rails and the preset
  validator each tested their own behaviour and passed. Every test imported the module;
  nothing asserted that production called it, so the features were inert for a user
  while every gate stayed green. Law 4's own words — "Zero grep results = NOT wired" —
  were the only signal, and no declared gate produced them.
- **Evidence:** dev/fids/archive/FID-2026-1006-003-wire-uncalled-adoption-modules.md → heading:Code Verification Evidence,
  packages/agent-runtime/src/run-agent-step/compaction-plan.ts → symbol:planCompactionCut
- **Invariant:** A module suite proves the module; only a caller assertion proves the
  feature. The two are not interchangeable, and a green suite is silent about which one
  you have.
- **Guard:** Every wiring work package ships a test that fails when the call is removed
  (assert-the-caller), and the record carries the per-package production grep under a
  Code Verification Evidence heading.
- **Verification:** six wiring suites are declared gates on `FID-2026-1006-003`;
  `bun run fid:verify … --check` reports 19/19 with the production greps pasted
  alongside.
- **Scope:** internal
- **Owning FID:** FID-2026-1006-003 (closed + archived)
- **Status:** active
- **Canonical rule:** call-graph-proof-asserts-the-caller

## Lesson: An embedded scope cannot import — give it data-shaped seams

- **Date:** 2026-10-06
- **Failure:** The context pruner is serialized into its own agent definition via
  `.toString()`, so its source cannot import runtime code. That is why the compaction
  cut plan and the file ledger had no route to reach it and stayed inert; designing the
  module first and discovering the channel second cost a whole follow-on FID.
- **Evidence:** agents/context-pruner/summarization-context.ts → symbol:cutPlan,
  packages/agent-runtime/src/run-agent-step/compaction-plan.ts → symbol:planCompactionCut
- **Invariant:** A module that runs inside an embedded, serialized scope has exactly one
  honest integration channel — data. Inputs travel as `agentState` fields forwarded as
  spawn params, never as imports, and the seam must be designed with that shape from the
  start.
- **Guard:** Before writing a module whose consumer is serialized, name the spawn param
  it will read (`keepRecentTokens` is the precedent) and compute the value at the
  runtime step boundary.
- **Verification:** the pruner reads `cutPlan` and `fileLedger` off its spawn params and
  honours `cutWindowStart`; the field partition gate (`spawn-child-fields.ts`) plus the
  two wiring suites pin the channel.
- **Scope:** internal
- **Owning FID:** FID-2026-1006-003 (closed + archived)
- **Status:** active
- **Canonical rule:** embedded-scopes-need-data-seams

## Lesson: A config loader must parse the repository's formatted file, not a hand-written sample

- **Date:** 2026-10-06
- **Failure:** The orchestration-preset parser silently read every list value as empty,
  because prettier wraps long YAML lists across lines and the parser understood only the
  single-line hand-written shape its author had in mind. The declaration and the
  validator were both correct; the loader that reads the file the repository actually
  ships was not. Only a repo-gate test over the real `protocol.config.yaml` caught it.
- **Evidence:** common/src/util/protocol-config.ts → symbol:readProtocolConfig,
  common/src/util/orchestration-preset.ts → symbol:parseOrchestrationPresetConfig
- **Invariant:** A new section in a formatter-managed config file must be parsed in its
  *formatted* shape, because that is the shape every gate and every future reader sees.
  A fixture written by hand proves the intended case and is blind to wrapping.
- **Guard:** Read the repository's own formatted file in the test rather than a synthetic
  snippet, and pin the multi-line form explicitly for any wrapped list value.
- **Verification:** the parser fix is pinned and the repo gate passes against the live
  `orchestration:` declaration; `common/src/util/__tests__/orchestration-preset.test.ts`
  is a declared gate on `FID-2026-1006-003`.
- **Scope:** internal
- **Owning FID:** FID-2026-1006-003 (closed + archived)
- **Status:** active
- **Canonical rule:** config-loader-parses-the-formatted-file

## Lesson: A quality-gate extraction must carry its census pin to the new site

- **Date:** 2026-10-06
- **Failure:** Splitting the main loop to satisfy the 300-line ceiling moved the
  terminal-hook call out of `loop.ts` into `run-agent-step/loop/setup-cancelled.ts`, and
  FID-2026-0919-031's caller census failed — it had pinned the old call site, so the
  extraction looked exactly like the wiring vanishing. The failure was correct
  behaviour: the pin existed to catch a call that moved or disappeared.
- **Evidence:** packages/agent-runtime/src/run-agent-step/loop/setup-cancelled.ts → symbol:handleSetupCancelled,
  scripts/hook-events-census.ts → symbol:hookEventSites
- **Invariant:** A census pins a call site, not a module. Any extraction that moves a
  pinned call reds the gate until the pinned list names the new site, and that is the
  gate working — not a false positive to route around.
- **Guard:** Before extracting code that a census, manifest or drift checker pins, read
  the checker and update the pin in the same change; never relax the checker to let an
  extraction pass.
- **Verification:** the census was updated with the moved site and
  `bun run scripts/hook-events-check.ts` passes; the extraction then proceeded under the
  quality gate.
- **Scope:** internal
- **Owning FID:** FID-2026-1006-003 (closed + archived)
- **Status:** active
- **Canonical rule:** extractions-carry-their-census-pins

## Lesson: A parser that reads prose must separate *describing* a convention from *using* one

- **Date:** 2026-10-03
- **Failure:** `FID-2026-1003-007` surfaces register items blocked on an operator ruling by parsing
  SCOPE.md's own convention. Its 11-pin suite passed, then the **first live run against the real
  register** reported the mechanism's own item as a pending decision, with the blocker "operator
  ruling for weeks because nothing presented them" — the item *quotes* `**Blocker:**` mid-sentence to
  describe the failure the mechanism fixes, and the parser read the quotation as a declaration. A
  mechanism asking the operator for a ruling it is itself delivering is worse than silence: it
  manufactures the exact noise it exists to cut, on every session end.
- **Evidence:** scripts/session-end-review.ts → symbol:pendingOperatorDecisions
- **Invariant:** The fixture is the tell. Pins written against hand-picked prose prove the *intended*
  case and are blind to any real document that *mentions* the convention — the live register is the
  only input that quotes it. Make the declaration **structural** (a line-leading token on its own
  continuation line) rather than making the text special; capture from the declaration, so an item
  that quotes first and declares later still reads its own blocker.
- **Guard:** For any prose-parsing mechanism over a real human-edited document, add one pin whose
  fixture **documents the convention it parses** and asserts it yields nothing. Then run the
  mechanism once against the real document before calling it verified — the live run is part of the
  evidence, not a smoke test.
- **Verification:** 13/13 suite; live agenda surfaces exactly T119, T62-followups, T122;
  `scope-register-check` PASS; `validate:repository` PASS.
- **Scope:** internal
- **Owning FID:** FID-2026-1003-007 (closed + archived)
- **Status:** active
- **Canonical rule:** prose-parser-must-separate-description-from-declaration

## Lesson: A fixed character budget must account for the prefix that renders before it

- **Date:** 2026-10-03
- **Failure:** The pending-decision agenda line sliced the blocker to 110 characters and then
  prefixed `      blocker: ` (15 more), rendering 125 columns against MD013's 120 bound.
  `lint:md` failed on the *generated* `dev/agenda.md` — a committed artifact — not on the source that
  produced it, so the defect was invisible at the function and only appeared through a repo-wide
  markdown gate on real output.
- **Evidence:** scripts/session-end-review.ts → symbol:AGENDA_MAX_LINE
- **Invariant:** A truncation budget is a budget for the *whole rendered line*, not for the field.
  Compute it as the remainder after the actual prefix: `` `${prefix}${value.slice(0, MAX - prefix.length)}` ``.
  A variable-width prefix (an interpolated id) makes a constant budget wrong for every id but the
  shortest one.
- **Guard:** Any generated file that is committed and linted needs a unit pin asserting the
  *rendered* lines respect the linter's bound, using the worst-case variable (here: an over-long id),
  not the sample that happens to fit.
- **Verification:** 13/13 suite incl. the new width pin; `lint:md` clean; prettier clean.
- **Scope:** internal
- **Owning FID:** FID-2026-1003-007 (closed + archived)
- **Status:** active
- **Canonical rule:** truncation-budget-includes-its-rendered-prefix

## Lesson: An archived walkthrough is a claim — ground the plan in the current contract modules

- **Date:** 2026-09-27
- **Failure:** The archived provider runbook (`docs/archive/design/Adding New
  Providers.md`) promised "one registry entry + a catalog reference. Everything
  else derives" — but following it literally would have failed the registry audit
  (which requires a `live-catalog` entry in `PROVIDER_EXCEPTION_MANIFEST` with
  owner + evidence paths) and silently mis-parsed the Vercel AI Gateway catalog,
  which publishes `context_window`/`max_tokens` and a numeric `created` where the
  shared `OpenRouterModel` type expects `context_length`/`max_completion_tokens`
  and a string `created`. The runbook was true of a past contract, not the live
  one.
- **Evidence:** common/src/providers/audit.ts → symbol:requiredExceptionKinds,
  cli/src/utils/openrouter-models/vercel.ts → symbol:parseVercelCatalog,
  dev/fids/archive/FID-2026-0927-001-vercel-ai-gateway-provider.md → heading:Lessons Learned
- **Invariant:** An archived runbook is a dated claim about a contract that lives
  in code; the ground truth is whatever the enforcing modules (audit gates,
  shared types, quality ceilings, drift checkers) require *now*. Measure the
  external API's actual response shape at intake instead of trusting the doc's
  description of it.
- **Guard:** For every "everything else derives" claim in a walkthrough, grep the
  enforcing module named above it and diff the doc's described shapes against a
  live probe of the endpoint; record each divergence in the FID's RED evidence
  before writing the GREEN plan.
- **Verification:** RED-first named both divergences before any source change
  (common 4 fail / cli 3 fail + import error / sdk 2 fail); the registry audit
  passes with the manifest entry; the parser pins the drift (5 tests); receipt
  13/13 live at the archived path.
- **Scope:** internal
- **Owning FID:** FID-2026-0927-001 (closed + archived)
- **Status:** active
- **Canonical rule:** archived-runbook-is-claim-not-contract

<!-- Add new entries above this line -->

<!-- Legacy entries below this line are preserved historical prose. -->

<!-- Narrative sessions 2026-07-25..2026-08-10 were retired to
  dev/LEARNINGS-RETIRED.md verbatim (FID-2026-0916-007, move-only). -->

<!-- The lessons below are pre-schema narrative entries
  (Context/Invariant/Guard), preserved verbatim and NOT validated; new entries
  must be added above the marker in governed space. -->

---

## Lesson: Focusable is not reachable — keyboard access needs a control that moves focus

- **Date:** 2026-10-05
- **Failure:** The right sidebar's section headers and FID cards were
  mouse-only (`focusable={false}` + onMouseDown). Setting `focusable={true}`
  alone would not have fixed keyboard access: OpenTUI 0.5.3 has no Tab
  traversal (verified against the vendored core — `focus()` only registers a
  per-renderable keypress handler, nothing cycles focusable renderables), so
  a focusable control nobody can focus is still unreachable.
- **Evidence:** cli/src/components/right-sidebar-focus.ts →
  symbol:createSidebarFocusController (the parent cycle);
  cli/src/components/savant-ui/primitives/sidebar-section.tsx →
  symbol:SidebarSection (registration + Enter/Space activation).
- **Invariant:** A keyboard-accessible control needs (1) an activation key
  handler, (2) focus state it can render, and (3) a parent mechanism that
  moves focus to it — all three, or none.
- **Guard:** Before adding `focusable` to any TUI control, grep the platform
  version for Tab/focus-cycling; if absent, wire the control into an explicit
  focus-cycle parent in the same change.
- **Verification:** cli sidebar-collapse suite 10/10 (5 new cycle legs);
  typecheck exit 0; quality PASS.
- **Scope:** cli, TUI
- **Owning FID:** FID-2026-1005-002 (closed + archived)
- **Status:** active
- **Canonical rule:** focusable-requires-a-focus-mover

## Lesson: Count-only consumers should not pay for a full parse — derive the count at the source

- **Date:** 2026-10-05
- **Failure:** The right sidebar consumed only `archivedFids.length`, but
  `useFids` fed it from `loadFidInventory`, which parses every archived FID's
  Markdown on each refresh — 54.65 ms vs 0.31 ms for a directory listing at
  the current archive size (455 files), on a hot cache, on every watcher hit.
- **Evidence:** cli/src/utils/fid-loader.ts → symbol:countArchivedFids;
  cli/src/hooks/use-fids.ts → symbol:useFids.
- **Invariant:** When a caller uses only a projection (length/count/exists),
  the data path must do work proportional to the projection; the rich API
  stays available for callers that need the full shape.
- **Guard:** Before wiring a loader into a hot refresh path, list every field
  each consumer reads; if the set is a projection, add a projection-specific
  function beside the loader and point the hot path at it (keep the watcher
  driving freshness — the projection must stay live).
- **Verification:** cli fid-loader suite 12/12 (3 new count-path legs incl.
  freshness across create/remove); measured delta in FID-2026-1005-002 Loop 2.
- **Scope:** cli, performance
- **Owning FID:** FID-2026-1005-002 (closed + archived)
- **Status:** active
- **Canonical rule:** count-only-consumers-get-count-paths

## Lesson: Reserve proposal slots mechanically — a record store is a cap, prompt discipline is a wish

- **Date:** 2026-10-05
- **Failure:** The isolated skill proposer's one-atomic-proposal-per-session
  contract had no production caller and no mechanical enforcement point on
  the draft path; the mechanical lesson script wrote generic draft bodies
  directly (omitting the actual lesson rule) and only a session-end text
  alert could surface background drafts.
- **Evidence:** common/src/util/skill-proposals.ts →
  symbol:prepareCandidateHandoff (reservation before write, idempotent by
  content sha); common/src/util/skill-lifecycle-events.ts →
  symbol:appendSkillLifecycleEvent (metadata-only durable events);
  scripts/lessons-to-skills.ts → symbol:draftCandidates (the production
  caller).
- **Invariant:** Concurrency/caps must be enforced by a store the code cannot
  bypass (reserve BEFORE the side effect; retries idempotent by content
  hash; a different proposal fails closed). Operator-facing notices must be
  derivable from a schema with no free-text fields, so untrusted prose cannot
  reach a privileged surface by construction.
- **Guard:** When a contract says "at most one per session/turn", name the
  record store that rejects the second one and write the same-session
  second-attempt pin; when a notice must not echo untrusted text, define the
  event schema first and build display text from validated fields only.
- **Verification:** scripts suites 49/0; common suites 11/0; evals 20/0;
  root typecheck exit 0; quality PASS.
- **Scope:** harness, skills
- **Owning FID:** FID-2026-1005-003 (closed + archived)
- **Status:** active
- **Canonical rule:** reserve-slots-mechanically-notices-are-metadata-only
