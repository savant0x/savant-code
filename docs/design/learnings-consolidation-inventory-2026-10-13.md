# Learning consolidation inventory

Inventory: 74 unique titles; 0 exact merge proposals.

Live ledger: 76975 JavaScript characters. Boot digest: 1938 characters.
Measured boot reduction from this inventory pass: 0 characters; no rule selection or lesson status changed.

Merge eligibility requires the same invariant, guard and canonical rule. Thematic families alone do not qualify.
Any concrete supersession requires the recorded operator ruling. All incident accounts and distinct guards remain.

## An unavailable tool needs a different recovery policy from incomplete arguments

Locations: dev/LEARNINGS.md:3.
Status: historical. Rule: unruled historical evidence.
Invariant: Tool availability and argument completeness are separate facts. Classify the cause where the request's
  declared tools are known, preserve the distinction through recovery, and derive child instructions from the child's
  allowlist. A payload retry cannot make an unavailable tool available.
Guard: Before diagnosing truncation, compare the name with the tools declared for that request. Give unavailable calls
  one corrective retry listing actual tools, then fail with the real cause. Keep the truncation budget and finish reason
  intact. Contain protocol envelopes before rendering text.

## A register target line whose globs all sit on continuation lines contributes nothing

Locations: dev/LEARNINGS.md:31.
Status: historical. Rule: unruled historical evidence.
Invariant: The gate matches item heads with `/^- ([A-Za-z0-9-]+): (.+)$/`, which requires at least one character AFTER
  the colon. Continuation-line collection is purely additive — it runs only once a head has matched. So an item whose
  head ends at the colon contributes ZERO patterns, and because the gate fails closed it denies exactly the paths that
  entry names. The block message points at the missing coverage, which is the one thing that is not wrong.
Guard: Always put at least one backticked glob on the same line as the `- <id>:` head; continuation lines are additive
  only. When a Law 2 block names a path the entry visibly lists, re-read the entry's HEAD line before touching anything
  else. Related observation: the gate reads the register per write, so a SCOPE.md edit and a gated write issued in the
  same tool batch can still see the pre-edit artifact — retry the write rather than re-authoring the entry.

## A machine-readable register entry is a parsed artifact, not prose

Locations: dev/LEARNINGS.md:66.
Status: historical. Rule: unruled historical evidence.
Invariant: A register entry that gates writes is code, not documentation — its indentation and line shape are the
  contract, and a malformed entry fails closed by denying approved work. The failure is uniquely confusing because the
  block message names the missing coverage, never the mangled entry that caused it.
Guard: Never edit a machine-readable register entry line-by-line. Read the complete file, then rewrite the WHOLE entry
  block in one direct edit, and confirm the globs still parse — a targeted write to one of the entry's own paths is the
  live probe. The current single-agent Law 1 forbids scripted edits, including multi-line glob lists; the incident's
  script is historical.

## A repair script that slices on a re-run is a data-loss script

Locations: dev/LEARNINGS.md:97.
Status: historical. Rule: unruled historical evidence.
Invariant: A script that removes content by slicing between two located indices is only safe when both indices bound
  EXACTLY the content it inserted. Locating the block by a heading that the script itself placed at an arbitrary
  position (the top) turns any re-run into an unbounded delete. Idempotence in a repair script means "no-op when already
  correct", never "delete then re-insert".
Guard: Read the complete file and make direct edits bounded by the block's own start AND end headings; the current
  single-agent Law 1 forbids scripted ledger edits. Diff against HEAD (`git diff --numstat`) before declaring success —
  a green content validator proves the file is well-formed, never that nothing was lost. Preserve unrelated operator
  work.

## Verification gates inside a code fence are invisible to fid:verify

Locations: dev/LEARNINGS.md:127.
Status: historical. Rule: unruled historical evidence.
Invariant: A fence makes content documentation, never declaration — any machine-read contract (gates, receipts, register
  targets) must live outside fences. The template's fenced block shows the SHAPE of a declaration; copying the fence
  copies the invisibility.
Guard: When declaring FID gates, write plain gate bullets directly under the Verification Gates heading and dry-run
  fid:verify on the record — it fails loudly ("no gates declared") long before a status flip. Copy the structure of an
  archived record, never the template's fenced example.

## Extend an existing command before registering its replacement

Locations: dev/LEARNINGS.md:155.
Status: historical. Rule: unruled historical evidence.
Invariant: One public command name has one registry owner; new argument behavior must preserve its existing consent and
  alias semantics.
Guard: Search registry and menu before registration; pin uniqueness and exercise dispatch through the real registry
  rather than a helper alone.

## Preserve operator-owned controls through a visual redesign

Locations: dev/LEARNINGS.md:173.
Status: historical. Rule: unruled historical evidence.
Invariant: Existing brand controls, alignment, user state and truthful context are acceptance requirements during visual
  refinement.
Guard: Record existing controls before redesign; verify real fold, resize and re-expand paths, including native layout
  event names and cleanup.

## A failing part is not a failing whole

Locations: dev/LEARNINGS.md:192.
Status: historical. Rule: unruled historical evidence.
Invariant: A per-member result must be reported per member; a failure in one member must never be aggregated into a
  claim about its container. Testing one member of a set and reporting on the set is not a smaller version of the test —
  it is a false one, because a healthy sibling is exactly the evidence that separates "this member is broken" from "the
  container is broken".
Guard: When a tool's subject is a collection (a provider's routes, a host's endpoints), enumerate the collection by
  default and emit one row per member with its own status; require an explicit scope argument to narrow it. Keep the
  member states distinct — `ok`, `unavailable` (refused for funding) and `failed` (the route is broken) are three facts,
  not two.

## A control that fails is not a control that disagrees

Locations: dev/LEARNINGS.md:227.
Status: historical. Rule: unruled historical evidence.
Invariant: A comparison needs three outcomes, not two: agrees, disagrees, and did not answer. Collapsing "did not
  answer" into "disagrees" turns an infrastructure failure into a substantive finding, and the more the infrastructure
  fails the stronger the false finding looks. When a control is required for a verdict, an absent control must force the
  weakest conclusion, never the strongest.
Guard: Any comparison against a baseline must count completed baseline observations separately from matching ones, and
  must branch on the completed count first. If the baseline produced nothing, the result is `unavailable` — a third
  state that can only widen the uncertainty, never narrow it. Prefer a `no-signal` status over a default verdict in
  every per-vector summary too.

## A telemetry value's absence and its zero are different facts

Locations: dev/LEARNINGS.md:264.
Status: historical. Rule: unruled historical evidence.
Invariant: Absence and zero are different observations and must stay different all the way to the point of display.
  Normalization that improves shape stability by substituting a default destroys exactly the bit a truthful UI needs,
  and no downstream heuristic can recover it — a default is indistinguishable from a measured value once it is written.
  Presence must be recorded where the provider's field is read, and carried as its own fact.
Guard: Any boundary that coerces a missing field to a default must emit presence alongside the value in the same object,
  or be forbidden from defaulting at all. Any consumer that interprets a numeric default as meaningful (a `> 0` test, a
  threshold, a ratio) must be taught to prefer explicit presence and must keep its old behavior only for records that
  carry no flag — so pre-existing callers do not silently change meaning.

## A new AgentState field is not a free edit — the compiler makes you classify it

Locations: dev/LEARNINGS.md:303.
Status: historical. Rule: unruled historical evidence.
Invariant: New per-run state belongs to exactly one of three classifications, and "not inherited by design" is not an
  escape hatch — its entries must carry the reason the child is safe without the field. The reason is the artifact; the
  list membership is bookkeeping. A child that silently inherits per-run telemetry pollutes the parent's accounting with
  another run's traffic.
Guard: When a field is appended to `AgentState`, classify it in the same change: append to `INHERITED_FROM_PARENT` or
  `CHILD_OWN`, or add an entry to `NOT_INHERITED_BY_DESIGN` with a sentence naming why the child does not need it. Treat
  `Type 'string' does not satisfy the constraint 'never'` as "open spawn-child-fields.ts", not as a compiler mystery.

## A health breaker may throttle background traffic but must never deny a user action

Locations: dev/LEARNINGS.md:338.
Status: historical. Rule: unruled historical evidence.
Invariant: A circuit breaker may suppress retries; it may never suppress the first request of a decision a human just
  made. Whatever gates a user action must be able to name the response it is denying — if no request was attempted,
  there is no provider health to report, only a local implementation choice being presented as a provider verdict.
  Corollary: never let a local refusal wear the provider's clothes. If the gate fires, the user must still be able to
  distinguish "the provider said no" from "we never asked."
Guard: Before placing any breaker, rate limiter or health gate on a path, ask who initiates that path. Human-initiated
  work gets at most retry suppression, never a preflight refusal, and the failure it finally reports must be the
  provider's own classified error. When a user-visible refusal is added anywhere, the record must state which physical
  request it prevented.

## Removing a gate from its only caller leaves production-dead code behind

Locations: dev/LEARNINGS.md:383.
Status: historical. Rule: unruled historical evidence.
Invariant: A repair that removes a call site must account for what the call site was the only user of. "No production
  caller remains" is a finding to record in the same breath as the fix, and the surviving surface must say so in its own
  docstring — dead code that still advertises the old contract is a re-arming instruction, and the next author cannot be
  expected to rediscover the removal.
Guard: After any change that deletes a call site, grep the removed symbol's callee across every production workspace and
  state the result. If the callee survives, either delete it or update its docstring to say that it has no production
  caller and why it is retained — and record the choice and its limits in the record's Code Verification Evidence rather
  than leaving it to be inferred.

## A blocker inherited from an outside document must be traced to its owner

Locations: dev/LEARNINGS.md:421.
Status: historical. Rule: unruled historical evidence.
Invariant: A blocker is a claim about WHO is holding the work. Trace every blocker to its owner before it is allowed to
  hold anything — and when the owner is a document the work is adjudicating, the requirement does not exist until the
  operator raises it. A blocker with no owner is not a blocker; it is unexamined work, and the honest disposition is to
  make it measurable rather than to wait on it.
Guard: Before recording any blocker, name the person or artifact holding the work and the sentence that put it there. If
  the answer is "a document we are adjudicating", the step is not blocked — it is unexamined, and the fix is to reduce
  it to something the environment can measure. The live leg may stay a stated boundary ("no provider hit ratio is
  claimed here"), but a boundary is not a blocker and must never hold a record open.

## Opt-in isolation is not isolation, and a reset is not an authority

Locations: dev/LEARNINGS.md:460.
Status: historical. Rule: unruled historical evidence.
Invariant: Isolation a file must remember to opt into protects the files that remember, so it belongs in the preload
  every file inherits. And when shared state is written by an un-awaited promise, widening the reset cannot fix it — a
  reset can only null state it can reach, so the repair is an AUTHORITY rule (only the current build may publish), which
  is also the only shape that survives a caller that has moved on.
Guard: Set the environment override in the workspace preload, not in a per-file helper, so a file that forgets is still
  isolated; and treat any un-awaited shared-state write as an authority question rather than a cleanup question — ask
  which build may publish, not what state should be cleared. When a suite failure names a value no fixture contains,
  instrument the writer and run it once: the stack names the file.

## A marker rule and a placement rule are different rules

Locations: dev/LEARNINGS.md:495.
Status: historical. Rule: unruled historical evidence.
Invariant: When one predicate answers two questions, they will eventually be answered the same way and the wrong one
  will win. Split the marker rule from the presentation rule and let each be pinned separately — and make a derived
  pairing check BOTH directions, so a stale exception cannot hide a provider that has since been wired.
Guard: Before reusing a predicate, read it as a sentence about the QUESTION it answers, not the intent it was written
  with; if one name answers both "is it marked" and "where does it live", split it. And when a registry declares a
  pairing (`modelsRef` → a catalogue), assert the pairing's REACH, not just its types — a compile-time key check proves
  the reference resolves and says nothing about whether anything consumes it.

## A suite can be passing because of the defect it is named after

Locations: dev/LEARNINGS.md:533.
Status: historical. Rule: unruled historical evidence.
Invariant: A passing suite is a claim about the CODE **and** the FIXTURES. When a fixture cannot be produced by the tool
  it stands for, the test measures the transform's error path instead of its real one — and an error path that returns a
  conveniently tiny result will keep a token/size assertion green no matter what the production path does.
Guard: When a fix turns an existing test red, the first question is not "how do I restore it" but "which of the two was
  lying"; repair the fixture to the shape the real tool emits and keep the assertion. Pin the precondition the fixture
  depends on (here: the boundary retained these payloads, so the fixture registers the handles) instead of relying on a
  transform that used to drop first and never ask.

## A gate that cannot be declared cannot be proven

Locations: dev/LEARNINGS.md:572.
Status: historical. Rule: unruled historical evidence.
Invariant: "The gate passed" and "the gate can be recorded" are different properties. The second is set by the record
  contract's vocabulary, not by the gate, so a gate outside that vocabulary is invisible until a FID's subject IS that
  gate — and then the record cannot be written at all, which is a defect in the gate surface rather than in the record.
Guard: When a check cannot be expressed in the record contract's vocabulary, make it independently runnable (exit 0
  clean / 1 with issues) and declare it as a probe — and spawn through `process.execPath` with argv ARRAYS and an
  INHERITED env, or the probe reintroduces the runtime-name and environment class the release gates exist to catch. Then
  audit the pairing rather than the prose: verify each declaration with the SAME allowlist the executor uses, and drive
  the audit from the gate contract so a newly added gate is found without anyone remembering to add it to the audit.

## A marker that names a possibility is not a locator

Locations: dev/LEARNINGS.md:615.
Status: historical. Rule: unruled historical evidence.
Invariant: A replacement payload and a retention claim are two different things, and only one of them is testable inside
  the process. A marker that cannot name where the omitted bytes are is a hopeful comment with a type: the reader has no
  way to distinguish "retained elsewhere" from "gone".
Guard: When a destructive path replaces a value, the marker must name a location the caller can actually COMPUTE (a path
  plus a key), not a possibility — and the retention mechanism's own caps must be reported where they truncate, because
  a bounded store that silently stops recording is the same as no store. Audit such paths by measuring the shipped
  functions over payload shapes, never by reading the code and the comment above it: the comment here says "retains the
  pre-truncation value on disk" about a file that is not written unless cache-debug is enabled.

## A leak class is enumerated, not inferred from the instance that hurt

Locations: dev/LEARNINGS.md:658.
Status: historical. Rule: unruled historical evidence.
Invariant: A defect that appears in one place is usually the visible member of a class, and the class is only actionable
  once it is a list. A guard that produces that list must be validated in both directions first — a false POSITIVE
  spends effort on work that is already done, and a false NEGATIVE leaves the class unenumerated, which is the state the
  enumeration exists to end.
Guard: Before repairing a second instance of a class, build the enumerator and measure the class size; before acting on
  the enumerator's output, check its state/no-state boundary and its coverage-name vocabulary against the repository's
  real conventions (`reset*`, `clear*`, `__reset*`) with fixture pins.

## A reset has no value until a preload calls it, and a boundary has two levels

Locations: dev/LEARNINGS.md:694.
Status: historical. Rule: unruled historical evidence.
Invariant: "It is resettable" and "it is isolated" are different claims: a reset needs a caller, a caller needs a safe
  import, and a safe import needs the right boundary. Clearing state at the wrong level breaks the very tests it was
  meant to stabilize — a shared in-memory handle, a store a suite initializes once — so the boundary is chosen by what a
  single case must be able to observe, not by which line is convenient to add.
Guard: When adding an isolation reset, wire it and run the workspace suite; put per-case state in `beforeEach` and state
  that a case owns its handle in `afterAll`; and when a reset cannot be wired, record the module and the reason where
  the audit can enforce it (an unreached module with no reason fails, and a reason that no longer describes anything
  fails too).

## A process-lifetime registry plus a reused fixture key is deterministic test-order dependence

Locations: dev/LEARNINGS.md:731.
Status: historical. Rule: unruled historical evidence.
Invariant: Mutable module-level state is shared by every suite, because the runner loads all test files into one
  process, and a fixture that reuses one literal id turns that sharing from an accident into a deterministic ordering
  dependency: a test's verdict then depends on which files were loaded first, not on the test. Resetting such state at
  the test boundary is not the same change as relaxing the production contract — the registry stays process-wide and
  shared across turns in production, and neither reset has a production caller.
Guard: Before accepting that a red suite has N causes, count the mechanism: when failing cases share a singleton, a
  registry or a fixed key, reduce the evidence to the smallest repro pair and run it together and alone in BOTH orders.
  Every module-level `Map`/`Set`/`let` that accumulates gets an exported reset called from a test preload, plus a pin
  showing the reset clears state an earlier case left behind.

## Removing shared-state noise is the start of the diagnosis, not the end of the repair

Locations: dev/LEARNINGS.md:772.
Status: historical. Rule: unruled historical evidence.
Invariant: A defect is visible only to a test that runs. When an infrastructure fault blocks a suite before the code
  under test executes, both the red run and the green run that replaces it say nothing about that code, so "the suite is
  green now" is not evidence that the newly-running paths are correct — it is the first state in which it is possible to
  obtain such evidence.
Guard: After removing noise that masked failures, enumerate what the now-running suites exercise for the first time and
  name every behaviour path that has no pin; write the pins before calling the repair complete. Before shipping a new
  mechanism, check it against the operator mandates that predate it, and pin each mandate it could override.

## A cost model outgrown twice needs every site enumerated, not the constant retuned

Locations: dev/LEARNINGS.md:811.
Status: historical. Rule: unruled historical evidence.
Invariant: A size-dependent cost model is rarely one site. Finding a scale defect is a mandate to enumerate every site
  that shares the cost model, because the un-fixed sibling will be outgrown by the same growth that produced the
  finding.
Guard: Before closing a budget or scale defect, grep for the shared constant and the sibling cost centres, fix each one,
  and pin each one structurally (work performed, not elapsed time).

## A governance control that degrades to an advisory needs a loud, specific degradation

Locations: dev/LEARNINGS.md:836.
Status: historical. Rule: unruled historical evidence.
Invariant: A control's degradation path needs the same specificity as its success path — the failed leg, the budget, the
  count and the error evidence. A degradation that cannot say why is dismissed as noise, and the real defect leaves with
  it.
Guard: Every refusal or degraded verdict names the specific failed leg and carries its evidence; no two distinct causes
  share one message.

## A fix that deletes a detection class costs more than the work it removes

Locations: dev/LEARNINGS.md:858.
Status: historical. Rule: unruled historical evidence.
Invariant: Before replacing an expensive mechanism with a cheaper one, enumerate the cases for which the expensive one
  is the only net. A detection net that becomes cheaper by covering fewer classes has not been optimised; it has been
  removed.
Guard: Each preserved class gets its own term and its own pin, and the pin names the class it protects rather than the
  mechanism it exercises.

## A library-complete hand-off needs a named consumer, not a readiness note

Locations: dev/LEARNINGS.md:880.
Status: active. Rule: library-complete-needs-a-named-consumer.
Invariant: "Ready for the first consumer" is a hand-off, and a hand-off is complete only when a live surface names the
  owner of the next step. A limitation stated inside a record that then closes is invisible to every register-shaped
  check, because the register holds open items and a closed record is no longer one.
Guard: Before closing a FID that leaves any artifact without a production caller, create the wiring item in the same
  pass — a register line with its write targets, or an active FID — and say in the closure text which one owns it.

## Law 4 is satisfied by the caller, not by the test that imports the module

Locations: dev/LEARNINGS.md:907.
Status: active. Rule: call-graph-proof-asserts-the-caller.
Invariant: A module suite proves the module; only a caller assertion proves the feature. The two are not
  interchangeable, and a green suite is silent about which one you have.
Guard: Every wiring work package ships a test that fails when the call is removed (assert-the-caller), and the record
  carries the per-package production grep under a Code Verification Evidence heading.

## An embedded scope cannot import — give it data-shaped seams

Locations: dev/LEARNINGS.md:932.
Status: active. Rule: embedded-scopes-need-data-seams.
Invariant: A module that runs inside an embedded, serialized scope has exactly one honest integration channel — data.
  Inputs travel as `agentState` fields forwarded as spawn params, never as imports, and the seam must be designed with
  that shape from the start.
Guard: Before writing a module whose consumer is serialized, name the spawn param it will read (`keepRecentTokens` is
  the precedent) and compute the value at the runtime step boundary.

## A config loader must parse the repository's formatted file, not a hand-written sample

Locations: dev/LEARNINGS.md:956.
Status: active. Rule: config-loader-parses-the-formatted-file.
Invariant: A new section in a formatter-managed config file must be parsed in its *formatted* shape, because that is the
  shape every gate and every future reader sees. A fixture written by hand proves the intended case and is blind to
  wrapping.
Guard: Read the repository's own formatted file in the test rather than a synthetic snippet, and pin the multi-line form
  explicitly for any wrapped list value.

## A quality-gate extraction must carry its census pin to the new site

Locations: dev/LEARNINGS.md:979.
Status: active. Rule: extractions-carry-their-census-pins.
Invariant: A census pins a call site, not a module. Any extraction that moves a pinned call reds the gate until the
  pinned list names the new site, and that is the gate working — not a false positive to route around.
Guard: Before extracting code that a census, manifest or drift checker pins, read the checker and update the pin in the
  same change; never relax the checker to let an extraction pass.

## Focusable is not reachable — keyboard access needs a control that moves focus

Locations: dev/LEARNINGS.md:1003.
Status: active. Rule: focusable-requires-a-focus-mover.
Invariant: A keyboard-accessible control needs (1) an activation key handler, (2) focus state it can render, and (3) a
  parent mechanism that moves focus to it — all three, or none.
Guard: Before adding `focusable` to any TUI control, grep the platform version for Tab/focus-cycling; if absent, wire
  the control into an explicit focus-cycle parent in the same change.

## Count-only consumers should not pay for a full parse — derive the count at the source

Locations: dev/LEARNINGS.md:1028.
Status: active. Rule: count-only-consumers-get-count-paths.
Invariant: When a caller uses only a projection (length/count/exists), the data path must do work proportional to the
  projection; the rich API stays available for callers that need the full shape.
Guard: Before wiring a loader into a hot refresh path, list every field each consumer reads; if the set is a projection,
  add a projection-specific function beside the loader and point the hot path at it (keep the watcher driving freshness
  — the projection must stay live).

## Reserve proposal slots mechanically — a record store is a cap, prompt discipline is a wish

Locations: dev/LEARNINGS.md:1051.
Status: active. Rule: reserve-slots-mechanically-notices-are-metadata-only.
Invariant: Concurrency/caps must be enforced by a store the code cannot bypass (reserve BEFORE the side effect; retries
  idempotent by content hash; a different proposal fails closed). Operator-facing notices must be derivable from a
  schema with no free-text fields, so untrusted prose cannot reach a privileged surface by construction.
Guard: When a contract says "at most one per session/turn", name the record store that rejects the second one and write
  the same-session second-attempt pin; when a notice must not echo untrusted text, define the event schema first and
  build display text from validated fields only.

## A parser that reads prose must separate *describing* a convention from *using* one

Locations: dev/LEARNINGS.md:1079.
Status: active. Rule: prose-parser-must-separate-description-from-declaration.
Invariant: The fixture is the tell. Pins written against hand-picked prose prove the *intended* case and are blind to
  any real document that *mentions* the convention — the live register is the only input that quotes it. Make the
  declaration **structural** (a line-leading token on its own continuation line) rather than making the text special;
  capture from the declaration, so an item that quotes first and declares later still reads its own blocker.
Guard: For any prose-parsing mechanism over a real human-edited document, add one pin whose fixture **documents the
  convention it parses** and asserts it yields nothing. Then run the mechanism once against the real document before
  calling it verified — the live run is part of the evidence, not a smoke test.

## A fixed character budget must account for the prefix that renders before it

Locations: dev/LEARNINGS.md:1106.
Status: active. Rule: truncation-budget-includes-its-rendered-prefix.
Invariant: A truncation budget is a budget for the *whole rendered line*, not for the field. Compute it as the remainder
  after the actual prefix: `` `${prefix}${value.slice(0, MAX - prefix.length)}` ``. A variable-width prefix (an
  interpolated id) makes a constant budget wrong for every id but the shortest one.
Guard: Any generated file that is committed and linted needs a unit pin asserting the *rendered* lines respect the
  linter's bound, using the worst-case variable (here: an over-long id), not the sample that happens to fit.

## An archived walkthrough is a claim — ground the plan in the current contract modules

Locations: dev/LEARNINGS.md:1128.
Status: active. Rule: archived-runbook-is-claim-not-contract.
Invariant: An archived runbook is a dated claim about a contract that lives in code; the ground truth is whatever the
  enforcing modules (audit gates, shared types, quality ceilings, drift checkers) require *now*. Measure the external
  API's actual response shape at intake instead of trusting the doc's description of it.
Guard: For every "everything else derives" claim in a walkthrough, grep the enforcing module named above it and diff the
  doc's described shapes against a live probe of the endpoint; record each divergence in the FID's RED evidence before
  writing the GREEN plan.

## The register-completeness gate decides what a scope register may be condensed to, not the author

Locations: dev/LEARNINGS-RETIRED.md:815.
Status: active. Rule: gate-grammar-decides-condensable-scope.
Invariant: The gate resolves an item reference as `registered.itemIds.has(id) || registered.taskNumbers.has(n)`, so a
  bare `## Task NN` heading keeps every `TNN-X` reference legal on its own. **Condensing is legal; deleting a heading is
  not** — the heading *is* the registration, not a title. Per-item narrative may be dropped only where the evidence
  survives elsewhere, and open items must be reproduced in full, because a condensed register's whole job is that an
  unfinished item stays visible.
Guard: Before condensing a register, enumerate the cited task numbers first (`grep` the windowed summaries) and keep
  every one of them as a heading; confirm with `bun run scripts/scope-register-check.ts`, the probe that answers this
  directly. Claim each condensed entry's evidence pointer only where it was measured — a bare "no CHANGELOG entry"
  negative is unfalsifiable when the same file mentions the paths for unrelated reasons, so name the token instead and
  state its count.

## A stage followed by a network-bound step cannot pin its own retry — extract the seam

Locations: dev/LEARNINGS-RETIRED.md:848.
Status: active. Rule: networked-downstream-defeats-boundary-pin.
Invariant: A behavior whose function continues into a slow/networked step cannot be pinned through that function
  hermetically; extract the behavior at its own boundary (exported, with an injectable probe — the same seam shape
  `verifyReleaseAssets` uses for `fetchImpl`) and prove the stage-level wiring by a call-graph census instead of a
  networked assertion.
Guard: When a new pin cannot stay offline, stop and ask which boundary owns the behavior; if the answer is "a sub-step
  of the function I am calling", extract that sub-step rather than mocking the network.

## A mode parameter must be pinned on every branch that returns a verdict

Locations: dev/LEARNINGS-RETIRED.md:880.
Status: active. Rule: pin-mode-parameter-on-every-verdict-branch.
Invariant: When a parameter selects between branches and each branch returns a verdict, the parameter's effect belongs
  in a test for EACH such branch. A mode-aware branch elsewhere in the same function is not evidence for the branch you
  did not pin; and a remediation message naming a mode is a claim that mode is honored.
Guard: Before signing off a mode-parameterized gate, enumerate the branch that returns the blocking verdict and pin the
  tolerant mode against it; keep the strict-mode pin beside it so the guard cannot be softened silently.

## A suppression key that can legitimately be null cannot distinguish "inactive" from "active with no identity"

Locations: dev/LEARNINGS-RETIRED.md:913.
Status: active. Rule: null-keyed-suppression-is-always-broken.
Invariant: A suppression scheme keyed on a value that can be legitimately `null` cannot distinguish "no suppression
  active" from "suppression active with no stable identity." Prefer an explicit active flag plus the captured retired
  values, so suppression is an equality test over the full domain — and end the suppression only on a genuinely new
  terminal outcome, never on a live-phase update.
Guard: Any guard of the form `if (key !== null && key === computeKey(x))` where `computeKey` can return null is a latent
  always-suppresses-nothing bug. Replace with a boolean active flag + captured-value equality; add a regression test for
  the null-keyed half of the domain.

## A FID's Verification section is a contract — each promised test must exist before "verified"

Locations: dev/LEARNINGS-RETIRED.md:952.
Status: active. Rule: fid-verification-section-is-contract.
Invariant: A FID's Verification section is a contract with the loop, not a plan. Status `verified` is earned only when
  every artifact named there exists and passes; compilation + green suites are silent about an artifact that was
  promised but never authored.
Guard: Before flipping a FID to `verified`, re-read its own Verification bullets and confirm each named test/gate exists
  in the tree and was run this session. If the loop cannot check this mechanically, the Adversary pass must.

## Environment-dependent guards need live probes — cwd-scoped path matching passed tests and failed production

Locations: dev/LEARNINGS-RETIRED.md:987.
Status: active. Rule: no-environment-dependent-guards.
Invariant: A guard matcher must never depend on launch-environment state; match path-intrinsic structure, and treat
  green suites as silent about environment-dependence when the tests share the same assumption.
Guard: Path-classification helpers match intrinsic segments or suffixes (e.g. includes('/dev/fids/')); any
  environment-derived anchor requires an injected seam or a live-probe verification step before the fix is called done.

## Active-ledger status admission — admissible active-queue statuses

Locations: dev/LEARNINGS-RETIRED.md:1017.
Status: active. Rule: active-ledger-status-admission.
Invariant: Files living in `dev/fids/` may carry `created | analyzed | converged | fixed | verified` (FID-2026-0915-004:
  the 2026-09-15 operator vocabulary ruling supersedes this lesson's original FID-2026-0820-007 admission rule —
  `converged` IS an admissible active-queue status meaning "the Perfection Loop completed, awaiting implementation
  approval", and `fixed` is deprecated-but-accepted legacy language). The anti-deferral step gate is UNCHANGED
  (converged = planning done, not work done — unchecked steps still fail), and the receipt contract stays keyed to
  `fixed | verified`. Pin: `scripts/__tests__/fid-ledger-vocab.test.ts`.
Guard: Before setting a planning FID's status, admit only the admissible active statuses; re-run `bun run
  validate:repository` (or the fid-ledger probe) after any FID metadata edit.

## FID metadata carries no attribution fields

Locations: dev/LEARNINGS-RETIRED.md:1050.
Status: active. Rule: no-attribution-fid-metadata.
Invariant: FID documents carry no author/attribution metadata — lines matching `**Author:`, `**Fixed By:`, `**Verified
  By:`, or `**Signed By:` are forbidden; documents speak for themselves.
Guard: Author new FIDs from the current `templates/FID-TEMPLATE.md` (never from older FIDs' headers); grep new FIDs for
  the four forbidden prefixes before writing. ECHO.md's stale required-Author rule is a known doc bug (see session
  summary 2026-08-21-0314).

## Files over the 100k-character tool read limit break every in-place edit path

Locations: dev/LEARNINGS-RETIRED.md:1075.
Status: active. Rule: large-file-edits-bypass-the-tool-read-path.
Invariant: The 100,000-char cap is a property of the **shared read path**, not of any one edit tool, so every tool that
  reads a target before writing inherits it. Past the cap no in-place edit is available at all, and a whole-file rewrite
  needs a route that never reads the target through the tool surface.
Guard: Check `wc -c` before choosing an edit tool. Under the cap: apply_patch with exact FULL-LINE context (partial
  context lines are rejected), insert-only hunks. Over the cap: write the new content to a path **outside** the target —
  a gitignored `dev/scratchpad/active/` file — and move it into place with a terminal command, or run a small
  anchor-matched script that reads the file itself. The scratchpad route is safe by construction: the staging artifact
  is gitignored and can never enter a commit.

## Static-string decompositions require a byte-identity hash gate

Locations: dev/LEARNINGS-RETIRED.md:1107.
Status: active. Rule: string-split-byte-identity-gate.
Invariant: Capture length + SHA-256 of the original constant BEFORE splitting; after the split, the concatenating facade
  must reproduce both exactly or the loop fails.
Guard: A bun -e probe with node:crypto runs before and after the split; any mismatch aborts the loop.

## Brand colors must be traced to provenance, not inherited from code

Locations: dev/LEARNINGS-RETIRED.md:1125.
Status: active. Rule: brand-color-provenance-operator-confirmed.
Invariant: A color token's hex is a branding claim. The brand colorway must come from operator-confirmed provenance
  (design system, brand doc), never from "whatever the pre-fork code shipped with".
Guard: Before touching theme tokens, ask: where did this hex come from — operator-stated brand, or inherited code? If
  the latter, confirm with the operator before keeping it. When the operator corrects a colorway, purge it from ALL
  mirrors (palette, design contract, fallbacks, export templates, logo colors) and grep-verify zero residue.

## Undeclared imports can ride a phantom node_modules outside the repo

Locations: dev/LEARNINGS-RETIRED.md:1156.
Status: active. Rule: dependency-resolution-repo-bound.
Invariant: Every source import must resolve from the repo's own node_modules after `bun install --frozen-lockfile`; a
  resolution that only works from a node_modules outside the repo is a defect.
Guard: `cli-bundle-resolution` release gate (`bun run scripts/cli-bundle-resolution-check.ts`) — the exact phase that
  failed in CI now fails the release gates before shipping, not the post-release binary workflow. The gate bundles
  inside a pristine install of the frozen lockfile and fails when any module the bundler loaded resolved from a
  `node_modules` OUTSIDE that tree, so a stray install up the ancestor chain (measured: a `node_modules` in the user
  profile, which defeated every working-tree form of this check) is a failure rather than a rescue.

## workflow_dispatch source_ref must be a branch or tag, not a SHA

Locations: dev/LEARNINGS-RETIRED.md:1184.
Status: active. Rule: dispatch-ref-branch-or-tag.
Invariant: The workflow's checkout `ref` input is a branch/tag name; a bare commit SHA is not resolvable by
  actions/checkout.
Guard: Dispatch with a branch/tag (e.g. `main`); the pipeline's asset-verify failure message now says
  `<branch-or-tag-with-the-fix>` instead of `<fixed commit>`.

## Perfection Loop convergence on a FID document is not FID closure

Locations: dev/LEARNINGS-RETIRED.md:1205.
Status: active. Rule: fid-closure-requires-implementation-evidence.
Invariant: FID closure requires implementation evidence (fixed/verified ⇒ code exists and gates pass). A converged
  planning FID stays open as `analyzed` in `dev/fids/` until its phase is implemented.
Guard: Before setting `closed`/archiving, ask: does the codebase contain the implementation this FID describes? If not,
  the status must remain `analyzed` regardless of loop convergence.

## The test renderer is not a proxy for the production renderer

Locations: dev/LEARNINGS-RETIRED.md:1232.
Status: active. Rule: test-renderer-not-proxy.
Invariant: A renderable verified only against `@opentui/core/testing` must be re-verified against the real CLI renderer
  before adoption; the test harness's frame buffer does not exercise the same tree-sitter/worker/ highlighting path the
  production renderer uses.
Guard: Any native-renderable adoption includes a production-smoke step (drive the real TUI to render the component)
  before declaring it "wins".

## OpenTUI Timeline defaults halt looping animations after 1 s

Locations: dev/LEARNINGS-RETIRED.md:1257.
Status: active. Rule: timeline-loop-duration.
Invariant: A looping timeline must be constructed with `loop: true` and an unbounded (or cycle-matching) `duration`;
  otherwise the timeline self-stops and the per-item `loop` never gets to run.
Guard: `useAnimationTimeline({ loop: true, duration: Infinity })` for looping components; regression test pins it.

## Generated artifacts require source-shape validation

Locations: dev/LEARNINGS-RETIRED.md:1279.
Status: active. Rule: generated-artifact-drift.
Invariant: Generated content is trustworthy only when extraction validates the source's observed structure.
Guard: `bun run generate:protocol-bundle:check`

## Structured lessons need executable evidence

Locations: dev/LEARNINGS-RETIRED.md:1294.
Status: active. Rule: learning-schema.
Invariant: New lessons declare failure, evidence, invariant, guard, verification, scope, and ownership.
Guard: `bun run learnings:check`

## Legacy clean-shell guidance is superseded by reversible preflight

Locations: dev/LEARNINGS-RETIRED.md:1309.
Status: active. Rule: release-preflight-restoration.
Invariant: Release preparation uses the existing reversible preflight contract; historical recipes are context only.
Guard: `bun run release:public:diagnose`

## Manual clean-shell recipe is superseded

Locations: dev/LEARNINGS-RETIRED.md:1329.
Status: superseded. Rule: release-preflight-restoration.
Invariant: Historical recipes remain context and must point to the current reversible release contract.
Guard: `bun run release:public:diagnose`

## Harness grounding keeps protocol variants explicit

Locations: dev/LEARNINGS-RETIRED.md:1346.
Status: active. Rule: protocol-variant-boundary.
Invariant: The harness selects and injects only its own contract; explicit variant markers remain separate and fail
  closed.
Guard: `bun run generate:protocol-bundle:check`

## A retry that re-emits the same oversized tool call is not recovery

Locations: dev/LEARNINGS-RETIRED.md:1373.
Status: active. Rule: recovery-steers-not-just-retries.
Invariant: When a native tool call fails because its arguments are truncated, the recovery prompt must change the
  strategy (split large payloads into smaller calls), the strike cap must be large enough for that guidance to land, and
  the exhausted failure must name the tool and give the parent a re-spawn path. Re-issuing the same oversized arguments
  object is re-rolling the same die.
Guard: Before raising the strike count for a truncated native tool call, ask: is the model being told HOW to avoid the
  truncation, and will the parent get an actionable failure if recovery exhausts?

## Autonomy is a driver problem, not a governance problem

Locations: dev/LEARNINGS-RETIRED.md:1407.
Status: active. Rule: autonomy-is-a-driver-problem.
Invariant: Before designing new enforcement machinery for an autonomy feature, inventory what the harness already
  enforces mechanically (EHEL gates, FSM transitions, FID ledger, step-status validator) and what it already drives
  (goal driver, STRICT ceremony). The ceremony exists; autonomy is the driver between it and the operator's one-time
  approval.
Guard: When a feature request says "autonomous X", ask: which existing enforcement point becomes the progress signal,
  and which existing agent contract becomes the execution unit? If neither is answerable, the design is not grounded in
  the repo yet.

## Local commits ≠ publishes — granular history beats the monolithic release commit

Locations: dev/LEARNINGS-RETIRED.md:1447.
Status: active. Rule: local-commits-are-not-publishes.
Invariant: Local commits are safety + audit checkpoints, not publishes. Commit atomically at FID/area boundaries; push
  granularly at release time (G6) so public history stays bisectable; back up between releases via git bundles (G5).
Guard: No monolithic release commit; no `git add .` while sessions are active (G4); every commit message references its
  FID (G8); the operator (never the agent) executes git (G1).

## Assume-unchanged files are phantom source invisible to every local gate

Locations: dev/LEARNINGS-RETIRED.md:1476.
Status: active. Rule: unproven-leg-layered-failures.
Invariant: An unproven platform leg fails one layer at a time, and each layer's failure message names the *next* layer,
  not the root cause — only `--verbose` (or equivalent) stderr exposure reveals it. A build step that *transforms* an
  opaque vendor binary (patchelf on a static bun exe) can corrupt it silently: bundling success is not artifact
  integrity.
Guard: RED-first workflow pins for every fix (`public-release-desktop-workflow.test.ts`); fail-closed generator key set
  as the single platform-contract authority; prefer RECOVERY of an existing key over regeneration whenever the pubkey is
  already in the field.

## A test whose runtime approaches the harness timeout is flaky by construction

Locations: dev/LEARNINGS-RETIRED.md:1542.
Status: active. Rule: test-timeout-budget-race.
Invariant: Timeout flakes are *time-budget races*, not logic bugs — the signature is death at exactly the timeout value
  plus high variance across machine load. A loop-exhaustion test's iteration count is a time budget: set it to the
  smallest value that still distinguishes the property (here `LIMIT + 2`), never a large round number, and add an
  explicit per-test timeout belt when the harness default is the cliff.
Guard: Backstop reduced 30 → 8 (> breaker `LIMIT` 6, so a falsely firing breaker still flips both assertions:
  `llmCallCount` 6 ≠ 8 and the terminator chunk appears) + explicit `{ timeout: 60_000 }` per repo precedent
  (`gateway-server-command.test.ts:126`). Sibling survey: every other large-backstop test terminates early (<600ms) —
  only exhaustion-style tests need this scrutiny.

## Generated download URLs must target the asset store, not the encoder's inverse

Locations: dev/LEARNINGS-RETIRED.md:1570.
Status: active. Rule: generated-urls-match-asset-store.
Invariant: A URL emitted from `encodeURIComponent` (or any encoder) describes a *theory* of the target system; only the
  stored form on the receiving system is real. Pin generated URLs against the external system's stored representation —
  and beware tautological tests, where the assertion mirrors the implementation instead of the world.
Guard: `storedAssetName()` in `desktop/scripts/generate-latest-json.ts` maps spaces to dots with two pins (encoded form
  rejected, real v0.0.29 name pinned); the fix was verified live by fetching the artifact through the manifest URL and
  sha256-matching the original bytes.

## A stage that shells out to a CLI inherits that CLI's layout

Locations: dev/LEARNINGS-RETIRED.md:1593.
Status: active. Rule: cli-output-layout-is-contract.
Invariant: When a helper's real output shape is load-bearing, stubbing the helper at its function boundary hides the
  shape; pin the real layout as a test fixture. The first live exercise of an unproven stage is a layout audit, not a
  formality.
Guard: `flattenDownloadedArtifacts()` in `scripts/public-release/desktop-stages.ts` hoists bundle + `.sig` files flat
  (excluding the CI `latest.json`, which is never trusted — the local regeneration exit is the fail-closed assertion)
  with a fixture pin encoding the real `gh` layout.

## A bootstrap that covers one context imports the failure into all others

Locations: dev/LEARNINGS-RETIRED.md:1616.
Status: active. Rule: bootstrap-covers-every-import-context.
Invariant: A convergence-point module must bootstrap every context it can be imported from, or each uncompensated
  consumer re-imports the failure. Compiled artifacts add a second rule: their `import.meta.dir` is virtual (cwd
  fallback required) and a bootstrap fix is only live after the artifact is rebuilt.
Guard: `common/src/env-bootstrap.ts` (findUp + existing-env-wins) wired into `env.ts` (binary-env XOR two-pass findUp);
  the spawned-import class pin in `env-bootstrap.test.ts` is the regression guard; desktop's suite now rides the root
  test chain so the class can never silently leave every standard gate again.

## One dynamic-import seam is only as durable as its pin

Locations: dev/LEARNINGS-RETIRED.md:1641.
Status: active. Rule: lazy-boundary-pinned-structurally.
Invariant: A bundler split survives only while its import edges stay dynamic; any new static edge to the lazy subtree
  undoes it silently (no test fails, no type error). Structure must be pinned by test, and size by build evidence.
Guard: `desktop/src/floor/__tests__/office-lazy.test.tsx` pins the boundary (deck-view imports the wrapper, never
  office-scene statically; the wrapper uses `import()`); the vite chunk listing (pasted in the FID) is the size
  evidence.

## A ledger ruling inherits the freshness of its evidence

Locations: dev/LEARNINGS-RETIRED.md:1664.
Status: active. Rule: ruling-premise-regrounded-at-execution.
Invariant: Before executing an approved item, re-ground its premise against the current tree; a scope item is only as
  fresh as the evidence it was authored from. Present the ground-truth shift (Law 2) and converge the record — never
  build duplicates, never silently drop.
Guard: the per-element audit table in FID-2026-0906-006 (every ruled element → `file:line` of composed, rendered code);
  acceptance stays with the operator visual smoke, the original bar.

## Status-based guards inherit git's index-state blindness

Locations: dev/LEARNINGS-RETIRED.md:1685.
Status: active. Rule: index-state-asserted-directly.
Invariant: Any git state that hides content from `git status` hides it from every check built on `git status`.
  Provenance guards must query the index directly (`git ls-files -v`: `S`/lowercase tags = hidden) and prove the
  *committed* tree independently of the worktree.
Guard: `scripts/public-release/provenance.ts` — index-state uniformity assertion in `verifyPreflight` (fail in
  mutation/automation, warn in preview) plus a clean-checkout compile gate in the GATES stage (detached temp worktree at
  HEAD, frozen-lockfile install, typecheck chain, removed on every path). The two cover disjoint classes: the flag, and
  committed-vs-worktree content drift.

## The release gate is an environment, not a gate list

Locations: dev/LEARNINGS-RETIRED.md:1709.
Status: active. Rule: gate-environment-parity.
Invariant: The release GATES stage is a distinct execution environment (PowerShell-launched, secret-sanitized, plain-TS
  declaration pass) — code must behave identically across it and every dev shell.
Guard: Prefer `process.execPath` over bare runtime names in spawned children; standard `import.meta.url` over
  runtime-specific properties in SDK-reachable common sources; fixture envs (never host-env spreads) in tests feeding
  env-filtering functions. Structural parity guard proposed in FID-2026-0909-002.

## "Compiles" is one claim per compiler configuration

Locations: dev/LEARNINGS-RETIRED.md:1744.
Status: active. Rule: compiles-is-per-surface.
Invariant: "Compiles" is one claim per compiler configuration; every compilation surface a release consumes (workspace
  tsconfigs, declaration programs, bundle targets) needs its own gate in the committed-tree proof.
Guard: Proposed (FID-2026-0909-003 Steps): add `build:sdk` (~7s) to `verify:clean`'s chain with transcript capture, plus
  a RED pin that reverts the anchor fix on a scratch worktree and asserts the extended gate fails.

## A policy scrub must sweep the rule text and its generator anchors, not just the artifacts

Locations: dev/LEARNINGS-RETIRED.md:1774.
Status: active. Rule: rule-text-outlives-policy.
Invariant: The sentence declaring a requirement is itself an artifact. When a generator anchors to rule text, the drift
  guard that normally protects consistency freezes the stale wording until ALL coupled sites are edited in one commit.
Guard: A policy scrub greps its forbidden patterns across governance docs AND generator sources, not just the artifacts
  the policy governs; when an auditor fails a document for violating a rule that contradicts policy, the auditor is the
  signal, not the bug.

## External research citations are hypotheses until grepped against the tree

Locations: dev/LEARNINGS-RETIRED.md:1810.
Status: active. Rule: verify-research-citations-before-building.
Invariant: A research report — however well-reasoned its architecture — carries file:line citations that are hypotheses,
  not facts. Building on an unverified seam propagates the fabrication into the FID record.
Guard: Before folding any external report into a FID, grep every file:line citation against the working tree; classify
  each finding CONFIRMED / REFUTED / ADJUSTED, and build only on the verified subset.

## EHEL verification credit is per-agent — subagent runs do not clear the parent's gate

Locations: dev/LEARNINGS-RETIRED.md:1843.
Status: active. Rule: eHEL-verification-credit-is-per-agent.
Invariant: The Law 3 "unverified file" list is scoped to the agent attempting the write; verification evidence must come
  from that agent's own tool calls. A subagent's green run is real verification of the code but not credit the parent
  can spend.
Guard: When EHEL blocks with unverified files after subagent verification, re-run the same lint/typecheck chain directly
  (the read-only command tool runs in every phase) — do not re-spawn bashers expecting different behavior.
