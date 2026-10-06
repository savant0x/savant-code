# LEARNINGS

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

## Lesson: The register-completeness gate decides what a scope register may be condensed to, not the author

- **Date:** 2026-09-27
- **Failure:** A 1,696-line `SCOPE.md` whose 16 largest sections were entirely `[x]` read as a work log rather than
  an active register, and the obvious cleanup — deleting the completed task sections — is mechanically illegal.
  `collectRegisterCompletenessIssues` requires every `Task NN` / `TNN-X` cited by an active FID or a session summary
  dated on/after `SCOPE_GUARD_EFFECTIVE_DATE` to have a register line, and **16** task numbers were cited by the
  windowed summaries (65, 66, 73, 74, 75, 77, 78, 79, 80, 81, 82, 83, 84, 86, 87, 88). Proposing deletion would have
  red `validate:repository` on `scope.unregistered-item`.
- **Evidence:** packages/agent-runtime/src/echo/scope-register-completeness.ts →
  symbol:scanUnregisteredTaskReferences,
  packages/agent-runtime/src/echo/scope-register-completeness.ts → symbol:collectRegisteredTasks
- **Invariant:** The gate resolves an item reference as
  `registered.itemIds.has(id) || registered.taskNumbers.has(n)`, so a bare `## Task NN` heading keeps every `TNN-X`
  reference legal on its own. **Condensing is legal; deleting a heading is not** — the heading *is* the registration,
  not a title. Per-item narrative may be dropped only where the evidence survives elsewhere, and open items must be
  reproduced in full, because a condensed register's whole job is that an unfinished item stays visible.
- **Guard:** Before condensing a register, enumerate the cited task numbers first (`grep` the windowed summaries)
  and keep every one of them as a heading; confirm with `bun run scripts/scope-register-check.ts`, the probe that
  answers this directly. Claim each condensed entry's evidence pointer only where it was measured — a bare "no
  CHANGELOG entry" negative is unfalsifiable when the same file mentions the paths for unrelated reasons, so name
  the token instead and state its count.
- **Verification:** `scope-register-check` PASS (0 issues) and `scope-guard-check` PASS (0 issues) on the condensed
  register; 1,696 → 350 lines with all 24 `## Task` headings and all 8 pre-existing unchecked items intact. The
  Verifier's NEEDS-REVIEW on the CHANGELOG-coverage claims was resolved with tool evidence, and four overstated
  negatives were rewritten to name a verifiable token. `validate:repository` PASS, `lint:md` clean, prettier clean.
- **Scope:** internal
- **Owning FID:** FID-2026-0919-025 (closed + archived)
- **Status:** active
- **Canonical rule:** gate-grammar-decides-condensable-scope

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

## Lesson: A stage followed by a network-bound step cannot pin its own retry — extract the seam

- **Date:** 2026-09-24
- **Failure:** The FID-2026-0922-001 npm retry was first pinned through the whole
  `verifyPublishedPackage` boundary. Its next step is the real `npm pack`
  artifact inspection, so the pin failed for a reason unrelated to the retry
  (it reached the network and died on an absent artifact) and the retry's own
  behavior was never isolated — the assertion would have passed or failed on the
  wrong thing.
- **Evidence:** scripts/public-release/npm-guards.ts →
  symbol:awaitPublishedPackage,
  scripts/__tests__/public-release-npm-guards.test.ts →
  test:absorbs a transient 404 instead of failing the stage
- **Invariant:** A behavior whose function continues into a slow/networked step
  cannot be pinned through that function hermetically; extract the behavior at
  its own boundary (exported, with an injectable probe — the same seam shape
  `verifyReleaseAssets` uses for `fetchImpl`) and prove the stage-level wiring by
  a call-graph census instead of a networked assertion.
- **Guard:** When a new pin cannot stay offline, stop and ask which boundary owns
  the behavior; if the answer is "a sub-step of the function I am calling",
  extract that sub-step rather than mocking the network.
- **Verification:** Both legs hermetic and load-bearing — the absorb leg
  resolves on the third probe read; collapsing the window to single-shot makes
  it fail in 0.73 ms (source restored); release suites 138/0 across 22 files;
  receipt 3/3 live.
- **Scope:** release
- **Owning FID:** FID-2026-0922-001
- **Status:** active
- **Canonical rule:** networked-downstream-defeats-boundary-pin

## Lesson: A mode parameter must be pinned on every branch that returns a verdict

- **Date:** 2026-09-24
- **Failure:** `checkStaleTag(root, version, resume)` ignored its `resume`
  parameter on the on-origin branch for the whole life of the shipped-version
  guard, while its own failure message told the operator to run `--resume`. Every
  signal that resume had been considered was present — the parameter, a
  resume-specific branch (local-only tag), the message — so the mode-blind block
  was indistinguishable from a mode-aware one, and the recovery path for any
  release failure after `GIT_PUSH` was dead. It survived until a real release
  failed after its tag was pushed.
- **Evidence:** scripts/public-release/pre-audit-local.ts → symbol:checkStaleTag,
  scripts/__tests__/pre-audit.test.ts → test:tag on origin is kept in resume mode
  (finishing the shipped release), scripts/public-release/preflight.ts →
  symbol:verifyPreflight
- **Invariant:** When a parameter selects between branches and each branch
  returns a verdict, the parameter's effect belongs in a test for EACH such
  branch. A mode-aware branch elsewhere in the same function is not evidence for
  the branch you did not pin; and a remediation message naming a mode is a claim
  that mode is honored.
- **Guard:** Before signing off a mode-parameterized gate, enumerate the branch
  that returns the blocking verdict and pin the tolerant mode against it; keep
  the strict-mode pin beside it so the guard cannot be softened silently.
- **Verification:** The new pin failed pre-fix (`Expected: "warn" / Received:
  "block"`) and passes now, with the mutation-mode block pin retained; negative
  leg via window collapse; receipt 3/3 live.
- **Scope:** release
- **Owning FID:** FID-2026-0922-001
- **Status:** active
- **Canonical rule:** pin-mode-parameter-on-every-verdict-branch

## Lesson: A suppression key that can legitimately be null cannot distinguish "inactive" from "active with no identity"

- **Date:** 2026-09-18
- **Failure:** The FID-2026-0917-006 compaction retirement stamped a
  nullable epoch string on `onNewUserMessage`, and the suppression guards
  required `retiredEpoch !== null` to fire. But `compactionStatusEpochOf`
  returns `null` for every *live* phase (`warning`/`blocked`/`compacting`/
  `idle`) — which is the ordinary post-compaction regime: after a compaction
  that doesn't drop context back below threshold, every subsequent run ends
  on `warning`. The retirement stamped a null that suppressed nothing, and a
  second hole cleared both stamps on any non-matching status, so the stale
  seed re-mirror resurrected the pinned panel forever. Two prior fixes patched
  symptoms without touching the null-keyed scheme.
- **Evidence:**
  cli/src/state/chat-store/compaction-helpers.ts → symbol:compactionStatusEpochOf,
  cli/src/state/chat-store/sidebar-reset.ts → symbol:applyCompactionStatus,
  dev/fids/archive/FID-2026-0918-004-compaction-signal-repin-retirement.md →
  heading:Root Cause
- **Invariant:** A suppression scheme keyed on a value that can be
  legitimately `null` cannot distinguish "no suppression active" from
  "suppression active with no stable identity." Prefer an explicit active
  flag plus the captured retired values, so suppression is an equality test
  over the full domain — and end the suppression only on a genuinely new
  terminal outcome, never on a live-phase update.
- **Guard:** Any guard of the form `if (key !== null && key ===
  computeKey(x))` where `computeKey` can return null is a latent
  always-suppresses-nothing bug. Replace with a boolean active flag +
  captured-value equality; add a regression test for the null-keyed half of
  the domain.
- **Verification:** typecheck cli + agent-runtime + common exit 0; eslint 0;
  prettier clean; chat-store-compaction 18/18 incl. the live-phase-hole and
  report-lateness regressions; agent-runtime 83/83 incl. the 4 emission tests.
- **Scope:** internal
- **Owning FID:** FID-2026-0918-004 (closed + archived)
- **Status:** active
- **Canonical rule:** null-keyed-suppression-is-always-broken

## Lesson: A FID's Verification section is a contract — each promised test must exist before "verified"

- **Date:** 2026-09-18
- **Failure:** FID-2026-0918-004's Verification section promised "New
  runtime test: micro-compact with `tokensSaved > 0` emits exactly one
  `compaction_summary`," but only the CLI store tests were written. Nothing
  in the Perfection Loop caught the mismatch — the Verifier had no disk
  access, and the loop's own status transition to `verified` did not check
  the FID's stated verification artifacts against the test tree. The gap
  survived until the Adversary read the FID's Verification bullets against
  the actual suites.
- **Evidence:**
  packages/agent-runtime/src/run-agent-step/context-tokens-compaction.ts →
  symbol:runMicroCompactPass,
  dev/fids/archive/FID-2026-0918-004-compaction-signal-repin-retirement.md →
  heading:Verification
- **Invariant:** A FID's Verification section is a contract with the loop,
  not a plan. Status `verified` is earned only when every artifact named
  there exists and passes; compilation + green suites are silent about an
  artifact that was promised but never authored.
- **Guard:** Before flipping a FID to `verified`, re-read its own
  Verification bullets and confirm each named test/gate exists in the tree
  and was run this session. If the loop cannot check this mechanically, the
  Adversary pass must.
- **Verification:** the missing test was authored and run (4/4 pass); the
  FID was re-audited clean before archive.
- **Scope:** internal
- **Owning FID:** FID-2026-0918-004 (closed + archived)
- **Status:** active
- **Canonical rule:** fid-verification-section-is-contract

<!-- Add new entries above this line -->

## Lesson: Environment-dependent guards need live probes — cwd-scoped path matching passed tests and failed production

- **Date:** 2026-08-23
- **Failure:** Relay-guard rev 1 scoped canonicalized-path matches to
  `canonicalizePath('.')` (process.cwd() at module load); the CLI's
  launch-dependent cwd made every legit absolutized write fail the check
  while all repo-root unit tests passed — a successful Recorder CREATE
  write was falsely relayed as a stall.
- **Evidence:**
  packages/agent-runtime/src/tools/handlers/tool/recorder-stall-check.ts →
  symbol:isAllowedWritePath,
  packages/agent-runtime/src/tools/handlers/tool/__tests__/recorder-stall-check.test.ts →
  test:counts an SDK-absolutized FID write (the live false-stall form)
- **Invariant:** A guard matcher must never depend on launch-environment
  state; match path-intrinsic structure, and treat green suites as silent
  about environment-dependence when the tests share the same assumption.
- **Guard:** Path-classification helpers match intrinsic segments or
  suffixes (e.g. includes('/dev/fids/')); any environment-derived anchor
  requires an injected seam or a live-probe verification step before the
  fix is called done.
- **Verification:** typecheck packages/agent-runtime exit 0; focused
  suites 21 pass / 0 fail incl. the arbitrary-NON-cwd-root case; Probe C
  first-hand normal relay under rev 2.
- **Scope:** internal
- **Owning FID:** FID-2026-0823-014
- **Status:** active
- **Canonical rule:** no-environment-dependent-guards

## Lesson: Active-ledger status admission — admissible active-queue statuses

- **Date:** 2026-08-21
- **Failure:** The desktop master FID was authored with `**Status:** converged`
  (a value ECHO.md's status vocabulary lists as allowed), and
  `validate:repository` flagged it as a non-active ledger status — while its
  six unchecked Step Status items cascaded into hard `fid.steps.unresolved`
  failures, because the anti-deferral gate treats `converged`/`closed` as
  closure-claiming statuses.
- **Evidence:** scripts/fid-ledger.ts → symbol:ALLOWED_ACTIVE_STATUSES,
  packages/agent-runtime/src/echo/fid-validator.ts → symbol:validateFidStepStatus
- **Invariant:** Files living in `dev/fids/` may carry
  `created | analyzed | converged | fixed | verified` (FID-2026-0915-004:
  the 2026-09-15 operator vocabulary ruling supersedes this lesson's
  original FID-2026-0820-007 admission rule — `converged` IS an admissible
  active-queue status meaning "the Perfection Loop completed, awaiting
  implementation approval", and `fixed` is deprecated-but-accepted legacy
  language). The anti-deferral step gate is UNCHANGED (converged = planning
  done, not work done — unchecked steps still fail), and the receipt
  contract stays keyed to `fixed | verified`. Pin:
  `scripts/__tests__/fid-ledger-vocab.test.ts`.
- **Guard:** Before setting a planning FID's status, admit only the
  admissible active statuses; re-run `bun run validate:repository` (or the
  fid-ledger probe) after any FID metadata edit.
- **Verification:** FID-2026-0820-007 → `analyzed`: fid-ledger probe 32 → 0;
  `validate:repository` 200 → 168 (quality-only, intentional).
- **Scope:** internal
- **Owning FID:** FID-2026-0820-007
- **Status:** active
- **Canonical rule:** active-ledger-status-admission

## Lesson: FID metadata carries no attribution fields

- **Date:** 2026-08-21
- **Failure:** Five desktop-suite FIDs carried `**Author:** Savant
  (Orchestrator)` metadata; each was flagged by the ledger's
  forbidden-attribution policy, and the current FID template has no Author
  field at all — it was replaced by `YAGNI-Compliance:` in the
  no-attribution governance sweep.
- **Evidence:** scripts/fid-ledger.ts → symbol:FORBIDDEN_ATTRIBUTION
- **Invariant:** FID documents carry no author/attribution metadata — lines
  matching `**Author:`, `**Fixed By:`, `**Verified By:`, or `**Signed By:`
  are forbidden; documents speak for themselves.
- **Guard:** Author new FIDs from the current `templates/FID-TEMPLATE.md`
  (never from older FIDs' headers); grep new FIDs for the four forbidden
  prefixes before writing. ECHO.md's stale required-Author rule is a known
  doc bug (see session summary 2026-08-21-0314).
- **Verification:** All five Author lines removed across
  FID-2026-0820-007..011; fid-ledger probe reports zero attribution findings.
- **Scope:** internal
- **Owning FID:** FID-2026-0820-007
- **Status:** active
- **Canonical rule:** no-attribution-fid-metadata

## Lesson: Files over the 100k-character tool read limit break every in-place edit path

- **Date:** 2026-08-21
- **Failure:** (2026-08-21) `str_replace` and `read_files` silently failed to match content near the tail of a
  102,314-char `SCOPE.md` — the read path truncates at 100,000 — reporting old-string-not-found for content `grep`
  confirms exists, and six `apply_patch` attempts with removal-style hunks also failed to serialize. (2026-09-27
  amendment) The ceiling is **not** specific to `str_replace`: `write_file` reads the target to compute a diff and
  fails identically, reporting `Failed to apply patch` and leaving the file byte-identical — so a whole-file rewrite
  of a >100K file is also unavailable, and the error names a patch the caller never authored. Reproduced on a
  118,822-byte `SCOPE.md` and a 792,353-character `CHANGELOG.md`.
- **Evidence:** dev/fids/archive/FID-2026-0819-005-quality-ratchet-file-remediation.md → heading:Current Evidence
- **Invariant:** The 100,000-char cap is a property of the **shared read path**, not of any one edit tool, so every
  tool that reads a target before writing inherits it. Past the cap no in-place edit is available at all, and a
  whole-file rewrite needs a route that never reads the target through the tool surface.
- **Guard:** Check `wc -c` before choosing an edit tool. Under the cap: apply_patch with exact FULL-LINE context
  (partial context lines are rejected), insert-only hunks. Over the cap: write the new content to a path **outside**
  the target — a gitignored `dev/scratchpad/active/` file — and move it into place with a terminal command, or run a
  small anchor-matched script that reads the file itself. The scratchpad route is safe by construction: the staging
  artifact is gitignored and can never enter a commit.
- **Verification:** `write_file` on the 118,822-byte `SCOPE.md` returned `Failed to apply patch` with the file
  byte-identical (`wc -c` 118,822 before and after). The staged-copy route produced 350 lines / 21,494 chars with
  `validate:repository`, `scope-register`, `scope-guard`, `lint:md` and prettier all exit 0. The same route inserted
  four CHANGELOG entries (792,353 → 804,413 chars) under a unique-anchor assertion with an idempotence guard, after
  which `release:public:preview` still extracted `Changelog section ready: ## 0.0.33 — 2026-09-22`. The 2026-08-21
  record remains in FID-2026-0819-005 (Program Paused section).
- **Scope:** internal
- **Owning FID:** FID-2026-0819-005
- **Status:** active
- **Canonical rule:** large-file-edits-bypass-the-tool-read-path

## Lesson: Static-string decompositions require a byte-identity hash gate

- **Date:** 2026-08-21
- **Failure:** Splitting a static template-literal payload across modules can silently corrupt whitespace or escape
  sequences, and tests may not catch it.
- **Evidence:** cli/src/commands/graph-export/universe-app-script.ts → symbol:UNIVERSE_APP_SCRIPT
- **Invariant:** Capture length + SHA-256 of the original constant BEFORE splitting; after the split,
  the concatenating facade must reproduce both exactly or the loop fails.
- **Guard:** A bun -e probe with node:crypto runs before and after the split; any mismatch aborts the loop.
- **Verification:** Loop 135 (len=7056) and Loop 136 (len=82450) probes byte-identical — the same gate applied to
  EXPORT_CSS_PART_2; recorded in FID-2026-0819-005.
- **Scope:** internal
- **Owning FID:** FID-2026-0819-005
- **Status:** active
- **Canonical rule:** string-split-byte-identity-gate

## Lesson: Brand colors must be traced to provenance, not inherited from code

- **Date:** 2026-08-16
- **Failure:** The dark theme's neutral scale was the Tailwind **slate** family
  (`surface #0f172a`, `border #1e293b`, `muted #94a3b8`, `foreground
  #e2e8f0`) — a navy-blue cast inherited from pre-fork Freebuff branding.
  Every popup, overlay, bubble, and dialog rendered navy, and the operator
  had to point out that Savant's identity is **near-black + cyan only**
  (`#050508` background, `#18faf9` primary). The earlier FID-2026-0812-002
  even *established* the slate values as "native" without questioning their
  provenance.
- **Evidence:** cli/src/utils/theme-system/palette.ts → symbol:chatThemes,
  docs/design/easter-eggs.md → heading:Easter Eggs
- **Invariant:** A color token's hex is a branding claim. The brand
  colorway must come from operator-confirmed provenance (design system,
  brand doc), never from "whatever the pre-fork code shipped with".
- **Guard:** Before touching theme tokens, ask: where did this hex come
  from — operator-stated brand, or inherited code? If the latter, confirm
  with the operator before keeping it. When the operator corrects a
  colorway, purge it from ALL mirrors (palette, design contract, fallbacks,
  export templates, logo colors) and grep-verify zero residue.
- **Verification:** grep for `#0f172a` / `#1e293b` / `#64748b` / `#94a3b8` /
  `#e2e8f0` in `cli/src` + `packages/design-systems/src` → zero matches
  (2026-08-16).
- **Scope:** internal
- **Owning FID:** FID-2026-0816-008
- **Status:** active
- **Canonical rule:** brand-color-provenance-operator-confirmed

## Lesson: Undeclared imports can ride a phantom node_modules outside the repo

- **Date:** 2026-08-16
- **Failure:** The v0.0.24 release shipped live (commit `05f829a`, tag, GitHub release, npm publish) with
  zero platform binaries because `@noble/hashes/sha512` was imported but never declared: every local gate
  passed against a phantom hoist (`C:\Users\spenc\node_modules\@noble\hashes`, outside the repo), and only
  the CI compile could see the missing dependency — `Could not resolve: "@noble/hashes/sha512"` at
  `common/src/crypto/keys.ts:2:24`, failing all 5 platform builds.
- **Evidence:** common/src/crypto/keys.ts → symbol:deriveRoleKeypair@line=48,
  common/package.json → field:version,
  scripts/validation-gates.ts → symbol:repositoryValidationGates
- **Invariant:** Every source import must resolve from the repo's own node_modules after
  `bun install --frozen-lockfile`; a resolution that only works from a node_modules outside the repo is a defect.
- **Guard:** `cli-bundle-resolution` release gate (`bun build cli/src/index.tsx --target=bun`) — the exact
  phase that failed in CI now fails the release gates before shipping, not the post-release binary workflow.
- **Verification:** The gate exits non-zero on an undeclared import; `import.meta.resolve` of every
  dependency points under the repo root, never a parent-directory node_modules.
- **Scope:** release
- **Owning FID:** FID-2026-0816-001
- **Status:** active
- **Canonical rule:** dependency-resolution-repo-bound

## Lesson: workflow_dispatch source_ref must be a branch or tag, not a SHA

- **Date:** 2026-08-16
- **Failure:** Re-dispatching `build-release-binaries.yml` with `source_ref: <commit-sha>` failed on all 5
  platform jobs at the Checkout step — actions/checkout resolved the SHA into `refs/heads/<sha>*` refspecs
  and the fetch failed (run `31927208483`). A second dispatch with `source_ref: main` (the pushed fix)
  succeeded.
- **Evidence:** .github/workflows/build-release-binaries.yml → field:source_ref,
  scripts/public-release/assets.ts → symbol:verifyReleaseAssets
- **Invariant:** The workflow's checkout `ref` input is a branch/tag name; a bare commit SHA is not
  resolvable by actions/checkout.
- **Guard:** Dispatch with a branch/tag (e.g. `main`); the pipeline's asset-verify failure message now says
  `<branch-or-tag-with-the-fix>` instead of `<fixed commit>`.
- **Verification:** Dispatch with a SHA → Checkout failure; dispatch with a branch → builds succeed.
- **Scope:** release
- **Owning FID:** FID-2026-0816-001
- **Status:** active
- **Canonical rule:** dispatch-ref-branch-or-tag

## Lesson: Perfection Loop convergence on a FID document is not FID closure

- **Date:** 2026-08-16
- **Failure:** Six planning FIDs (FID-2026-0816-002..007) for the UI overhaul
  were created, loop-converged, then marked `closed` and moved to
  `dev/fids/archive/` despite zero implementation. The Perfection Loop's
  COMPLETE state converges the *document*; the FID status vocabulary
  (`created | analyzed | fixed | verified | closed`) and the Ground-Truth
  rule describe *implementation* state. A `closed` FID with no code is a
  status claim that contradicts the codebase — and it hid the work queue
  from the operator.
- **Evidence:** ECHO.md → heading:FID Ground-Truth Verification
- **Invariant:** FID closure requires implementation evidence
  (fixed/verified ⇒ code exists and gates pass). A converged planning FID
  stays open as `analyzed` in `dev/fids/` until its phase is implemented.
- **Guard:** Before setting `closed`/archiving, ask: does the codebase
  contain the implementation this FID describes? If not, the status must
  remain `analyzed` regardless of loop convergence.
- **Verification:** The six FIDs report `analyzed` and sit in `dev/fids/`;
  CHANGELOG and archive README record the correction.
- **Scope:** internal
- **Owning FID:** FID-2026-0816-002
- **Status:** active
- **Canonical rule:** fid-closure-requires-implementation-evidence

## Lesson: The test renderer is not a proxy for the production renderer

- **Date:** 2026-08-16
- **Failure:** Phase 3 adopted native `<diff>`/`<code>`/`<line-number>`/
  `<image>` renderables after a spike verified them clean against
  `@opentui/core/testing`'s frame buffer. In the real CLI renderer they
  painted nothing: the diff viewer showed only the `Edit filename` header and
  code blocks lost their line-number gutter. The operator found the regression
  in live terminal testing after the adoption had shipped.
- **Evidence:** cli/src/components/tools/diff-viewer.tsx → symbol:DiffRow
- **Invariant:** A renderable verified only against `@opentui/core/testing`
  must be re-verified against the real CLI renderer before adoption; the test
  harness's frame buffer does not exercise the same tree-sitter/worker/
  highlighting path the production renderer uses.
- **Guard:** Any native-renderable adoption includes a production-smoke step
  (drive the real TUI to render the component) before declaring it "wins".
- **Verification:** Reverted to the custom renderers; diff/code/image render
  again in production.
- **Scope:** internal
- **Owning FID:** FID-2026-0816-006
- **Status:** active
- **Canonical rule:** test-renderer-not-proxy

## Lesson: OpenTUI Timeline defaults halt looping animations after 1 s

- **Date:** 2026-08-16
- **Failure:** `new Timeline({ autoplay: false })` inherits `loop: false` +
  `duration: 1000`, so a looping item (its own `loop: true`) is frozen the
  moment the timeline reaches 1000 ms — every continuous animation stopped
  ~1 s after starting.
- **Evidence:** cli/src/hooks/use-animation-timeline.ts → symbol:useAnimationTimeline
- **Invariant:** A looping timeline must be constructed with `loop: true` and
  an unbounded (or cycle-matching) `duration`; otherwise the timeline
  self-stops and the per-item `loop` never gets to run.
- **Guard:** `useAnimationTimeline({ loop: true, duration: Infinity })` for
  looping components; regression test pins it.
- **Verification:** cli/src/hooks/__tests__/animation-timeline-loop.test.ts
  (2 tests: default options halt at 1 s; loop+Infinity keeps playing).
- **Scope:** internal
- **Owning FID:** FID-2026-0816-005
- **Status:** active
- **Canonical rule:** timeline-loop-duration

## Lesson: Generated artifacts require source-shape validation

- **Date:** 2026-08-11
- **Failure:** A generator can silently accept the wrong source shape and emit incomplete guidance.
- **Evidence:** scripts/protocol-bundle-assertions.ts → symbol:runContentAssertions
- **Invariant:** Generated content is trustworthy only when extraction validates the source's observed structure.
- **Guard:** `bun run generate:protocol-bundle:check`
- **Verification:** Regenerate twice and compare the generated files byte-for-byte.
- **Scope:** internal
- **Owning FID:** FID-2026-0811-022
- **Status:** active
- **Canonical rule:** generated-artifact-drift

## Lesson: Structured lessons need executable evidence

- **Date:** 2026-08-11
- **Failure:** Narrative-only lessons cannot reliably become reusable guardrails.
- **Evidence:** scripts/learnings-validation.ts → symbol:validateLearnings
- **Invariant:** New lessons declare failure, evidence, invariant, guard, verification, scope, and ownership.
- **Guard:** `bun run learnings:check`
- **Verification:** Malformed fixtures fail and legacy prose remains preserved below the boundary.
- **Scope:** internal
- **Owning FID:** FID-2026-0811-024
- **Status:** active
- **Canonical rule:** learning-schema

## Lesson: Legacy clean-shell guidance is superseded by reversible preflight

- **Date:** 2026-08-11
- **Failure:** A historical clean-shell recipe required manual environment and
  settings restoration and could be followed without proving restoration.
- **Evidence:** scripts/public-release/local-state.ts →
  symbol:withLocalStateRestoration,
  scripts/public-release/local-state.ts → symbol:restoreLocalState
- **Invariant:** Release preparation uses the existing reversible preflight contract;
  historical recipes are context only.
- **Guard:** `bun run release:public:diagnose`
- **Verification:** Failure, timeout, signal, receipt, and restoration paths are
  tested without publishing or remote mutation.
- **Scope:** release
- **Owning FID:** FID-2026-0811-025, FID-2026-0811-027
- **Status:** active
- **Canonical rule:** release-preflight-restoration

## Lesson: Manual clean-shell recipe is superseded

- **Date:** 2026-08-11
- **Failure:** An earlier manual environment recipe did not prove restoration.
- **Evidence:** scripts/public-release/local-state.ts →
  symbol:withLocalStateRestoration
- **Invariant:** Historical recipes remain context and must point to the current reversible release contract.
- **Guard:** `bun run release:public:diagnose`
- **Verification:** The replacement contract is exercised by restoration and failure-path tests.
- **Scope:** release
- **Owning FID:** FID-2026-0811-025
- **Status:** superseded
- **Superseded by:** Legacy clean-shell guidance is superseded by reversible preflight
- **Canonical rule:** release-preflight-restoration

## Lesson: Harness grounding keeps protocol variants explicit

- **Date:** 2026-08-11
- **Failure:** Broad boundary wording can confuse a separate governance contract with the harness contract.
- **Evidence:** common/src/util/boot-contract.ts → symbol:resolveBootContract,
  scripts/protocol-bundle-assertions.ts → symbol:runContentAssertions
- **Invariant:** The harness selects and injects only its own contract; explicit
  variant markers remain separate and fail closed.
- **Guard:** `bun run generate:protocol-bundle:check`
- **Verification:** Local-first resolution, embedded fallback, and scoped
  injected-context checks pass without bundling the separate variant.
- **Scope:** internal
- **Owning FID:** FID-2026-0811-026
- **Status:** active
- **Canonical rule:** protocol-variant-boundary

<!-- Legacy entries below this line are preserved historical prose. -->

<!-- Narrative sessions 2026-07-25..2026-08-10 were retired to
  dev/LEARNINGS-RETIRED.md verbatim (FID-2026-0916-007, move-only). -->

<!-- The lessons below are pre-schema narrative entries
  (Context/Invariant/Guard), preserved verbatim and NOT validated; new entries
  must be added above the marker in governed space. -->

## Lesson: A retry that re-emits the same oversized tool call is not recovery

- **Date:** 2026-08-16
- **Failure:** A Forge subagent run died with `Native tool-call recovery
  failed twice consecutively` while implementing FID-2026-0816-011. A
  flash-class model truncated a large `write_file` native call mid-JSON; the
  runtime retried with only "retry with a complete arguments object"; the
  model re-emitted the same giant payload and truncated again; the 2-strike
  cap killed the run with a guidance-free stack trace. The same truncation
  class had already appeared dozens of times as recovered one-off tool-call
  errors — the difference was payload size, not model.
- **Evidence:** `FID-2026-0816-012` (closed, archived);
  `packages/agent-runtime/src/tools/stream-parser.ts:370-413` (steering +
  drift warn), `run-agent-step/constants.ts:1-26` (3-strike cap + guidance),
  `loop-iteration.ts:315-320` (exhausted builder).
- **Invariant:** When a native tool call fails because its arguments are
  truncated, the recovery prompt must change the strategy (split large
  payloads into smaller calls), the strike cap must be large enough for that
  guidance to land, and the exhausted failure must name the tool and give the
  parent a re-spawn path. Re-issuing the same oversized arguments object is
  re-rolling the same die.
- **Guard:** Before raising the strike count for a truncated native tool
  call, ask: is the model being told HOW to avoid the truncation, and will
  the parent get an actionable failure if recovery exhausts?
- **Verification:** typecheck ×4, agent-runtime 973/0, SDK 477/0, eslint 0,
  lint:md 0, prettier clean; 3-strike/steering/drift tests in
  `loop-agent-steps-part-f.test.ts`.
- **Scope:** agent-runtime recovery
- **Owning FID:** FID-2026-0816-012
- **Status:** active
- **Canonical rule:** recovery-steers-not-just-retries

## Lesson: Autonomy is a driver problem, not a governance problem

- **Date:** 2026-08-18
- **Failure:** The Auto Drive blueprint (Every Code-inspired autonomous
  execution) framed the work as building new governance: a new FSM layer, a
  new agent role, and a "Decomposition Engine" on top of the harness. A
  ground-truth pass against the repo showed the opposite: the full ceremony
  already exists as STRICT mode (`agents/savant/savant-strict.ts`,
  `agents/savant/system-prompt.ts:35` — "No direct writes, no phase
  skipping, no self-verification"), the continuation driver already exists
  (`run-agent-step/goal-driver.ts`, FID-2026-0814-002), and the anti-deferral
  gate (FID-2026-0817-005) already turned FID Step Status sections into
  machine-readable progress records. The genuinely new code is a thin
  supervisor: queue selection, phase-completion validation from the FID
  file, legal `transition_phase` invocation, and a failure ladder. An
  estimate that assumed "new governance" triples the real work.
- **Evidence:** `agents/savant/savant-strict.ts` (STRICT agent),
  `packages/agent-runtime/src/run-agent-step/goal-driver.ts` (driver),
  `packages/agent-runtime/src/echo/fid-validator.ts` (step-status parsers),
  `scripts/fid-ledger.ts:18-23` (active status set), program FIDs
  `FID-2026-0818-001..007` (drafted 2026-08-18).
- **Invariant:** Before designing new enforcement machinery for an
  autonomy feature, inventory what the harness already enforces mechanically
  (EHEL gates, FSM transitions, FID ledger, step-status validator) and what
  it already drives (goal driver, STRICT ceremony). The ceremony exists;
  autonomy is the driver between it and the operator's one-time approval.
- **Guard:** When a feature request says "autonomous X", ask: which existing
  enforcement point becomes the progress signal, and which existing agent
  contract becomes the execution unit? If neither is answerable, the design
  is not grounded in the repo yet.
- **Verification:** `bun run validate:repository` PASS with the seven
  program FIDs active; markdownlint PASS; every FID's AUDIT section cites
  file:line evidence verified against the working tree.
- **Scope:** planning/architecture
- **Owning FID:** FID-2026-0818-001
- **Status:** active
- **Canonical rule:** autonomy-is-a-driver-problem

## Lesson: Local commits ≠ publishes — granular history beats the monolithic release commit

- **Date:** 2026-08-27
- **Failure:** The "release-only-commits" convention (one giant release commit
  per version) accumulated 644 changed paths over a multi-day build and left
  the tree uncommitted for a week — destroying per-FID audit trails and
  risking catastrophic WIP loss on a single disk. Post-hoc LLM review of a
  100+ file diff degrades from signal dilution, not raw size.
- **Evidence:** `docs/design/Solo Git Workflow Optimization.md` (research),
  `dev/nova/outbox/2026-08-23-git-workflow-echo-amendment-draft.md` (G1–G9),
  `ECHO.md` → "Version-Control Workflow Laws (G1–G9)".
- **Invariant:** Local commits are safety + audit checkpoints, not publishes.
  Commit atomically at FID/area boundaries; push granularly at release time
  (G6) so public history stays bisectable; back up between releases via git
  bundles (G5).
- **Guard:** No monolithic release commit; no `git add .` while sessions are
  active (G4); every commit message references its FID (G8); the operator
  (never the agent) executes git (G1).
- **Verification:** ECHO.md G-rules section adopted 2026-08-27; tree drained
  into path-scoped atomic commits; `git log --grep="FID-"` aggregatable.
- **Scope:** process/workflow
- **Owning FID:** (build-order BO-2026-08-23-git-workflow-enforcement)
- **Status:** active
- **Canonical rule:** local-commits-are-not-publishes

---

## Lesson: Assume-unchanged files are phantom source invisible to every local gate

- **Date:** 2026-09-06
- **Failure:** Three tracked files sat in assume-unchanged state from the
  OpenCode Zen integration, silently excluding 21 lines of source
  (`PROVIDER_PROTOCOL_MAPS` re-exports, `TOKENROUTER` names, the GLM 5.3
  Free catalog entry) from every commit. Local typecheck, tests, and all
  20+ release gates passed against worktree content; any clean checkout
  failed to compile — first surfaced by CI (desktop-ci failed twice,
  3 platforms each, `No matching export ... PROVIDER_PROTOCOL_MAPS`) and
  the v0.0.29 release binary workflow, hours after the npm publish.
- **Evidence:** commit `4d85b6b` (the fix; its message documents the
  incident and the three files); GH run 34009246538 (desktop-ci, all 3
  platforms, the export error); v0.0.29 receipt
  (`savant-public-release-0.0.29.json`, all gates exit 0 on the
  worktree-shaped tree).
- **Invariant:** A gate that runs against the working tree verifies the
  worktree, not the commit. Published artifacts derive from committed
  content; anything that makes the index diverge from the worktree
  (assume-unchanged, skip-worktree, smudge filters) makes every local
  gate a lie about what ships.
- **Guard:** (proposed, not yet implemented — SCOPE.md Task 16
  [OPEN-OUT-OF-SCOPE]) pipeline PREFLIGHT fails closed on
  `git ls-files -v` lowercase flags; clean-checkout build gate;
  tag/asset/commit binding assert at POST_RELEASE_VERIFY.
- **Verification:** `git ls-files -v | grep '^[a-z]'` → empty on the
  current tree; the 21 lines are committed at `4d85b6b`.
- **Scope:** release/provenance
- **Owning FID:** proposed FID-2026-0906-003 (not yet authored — see
  SCOPE.md Task 16 OPEN-OUT-OF-SCOPE; operator decides)
- **Status:** active
- **Canonical rule:** assume-unchanged-phantom-source

- **What happened:** Six consecutive scratch dispatches of
  `desktop-release.yml` peeled one failure layer per run: corrupted
  signing secret (fixed by *recovery* — the original keypair was on disk,
  gitignored and never committed, and paired with the committed updater
  pubkey) → missing Linux system deps → missing compile-time icon.png →
  linuxdeploy without FUSE → linuxdeploy strip crash → the real root
  cause: the GTK plugin's second linuxdeploy pass core-dumps on `ldd`
  against the patchelf-rewritten static bun single-file sidecar
  (oven-sh/bun#28281; tauri-apps/tauri#14796, fix pending #12491) — and a
  bundling that survived would have shipped the corrupted sidecar anyway.
- **Evidence:** runs 34042941045 / 34044435124 / 34045779966 /
  34047404386 / 34048699120 / 34050762638 (the last all-green);
  FID-2026-0906-001 live-cut table; run-6 verbose log exposing the
  swallowed stderr (`Failed to run ldd: exited with code 1`, exit 134).
- **Invariant:** An unproven platform leg fails one layer at a time, and
  each layer's failure message names the *next* layer, not the root
  cause — only `--verbose` (or equivalent) stderr exposure reveals it.
  A build step that *transforms* an opaque vendor binary (patchelf on a
  static bun exe) can corrupt it silently: bundling success is not
  artifact integrity.
- **Guard:** RED-first workflow pins for every fix
  (`public-release-desktop-workflow.test.ts`); fail-closed generator key
  set as the single platform-contract authority; prefer RECOVERY of an
  existing key over regeneration whenever the pubkey is already in the
  field.
- **Scope:** desktop/release
- **Owning FID:** FID-2026-0906-001 (closed; Linux auto-update deferred
  to tauri#12491)
- **Status:** active
- **Canonical rule:** unproven-leg-layered-failures

## Lesson: A test whose runtime approaches the harness timeout is flaky by construction

- **Context:** `post-terminal-breaker-integration.test.ts` ran 30 full
  agent-loop iterations to prove the Auto Drive carve-out; measured
  3.8–6.5s across loads against Bun's default 5s per-test timeout, and
  died at exactly 5004.91ms under full-suite load — blocking one pre-push
  gate and one release-gate run while the test passed in isolation every
  time it was retried.
- **Invariant:** Timeout flakes are *time-budget races*, not logic bugs —
  the signature is death at exactly the timeout value plus high variance
  across machine load. A loop-exhaustion test's iteration count is a
  time budget: set it to the smallest value that still distinguishes the
  property (here `LIMIT + 2`), never a large round number, and add an
  explicit per-test timeout belt when the harness default is the cliff.
- **Guard:** Backstop reduced 30 → 8 (> breaker `LIMIT` 6, so a falsely
  firing breaker still flips both assertions: `llmCallCount` 6 ≠ 8 and
  the terminator chunk appears) + explicit `{ timeout: 60_000 }` per repo
  precedent (`gateway-server-command.test.ts:126`). Sibling survey: every
  other large-backstop test terminates early (<600ms) — only
  exhaustion-style tests need this scrutiny.
- **Scope:** agent-runtime/testing
- **Owning FID:** none (maintenance fix; 2-recurrence pattern, tracked
  via experience capture — a third strike promotes it to a FID)
- **Status:** active
- **Canonical rule:** test-timeout-budget-race

## Lesson: Generated download URLs must target the asset store, not the encoder's inverse

- **Context:** The updater manifest generator percent-encoded artifact
  names (`Savant%20Code_…`) while GitHub stores release assets with
  spaces normalized to dots and serves no alias — probing the manifest's
  own URL right after uploading v0.0.29 returned HTTP 404, meaning every
  Windows client's first auto-update would have failed.
- **Invariant:** A URL emitted from `encodeURIComponent` (or any encoder)
  describes a *theory* of the target system; only the stored form on the
  receiving system is real. Pin generated URLs against the external
  system's stored representation — and beware tautological tests, where
  the assertion mirrors the implementation instead of the world.
- **Guard:** `storedAssetName()` in `desktop/scripts/generate-latest-json.ts`
  maps spaces to dots with two pins (encoded form rejected, real v0.0.29
  name pinned); the fix was verified live by fetching the artifact
  through the manifest URL and sha256-matching the original bytes.
- **Scope:** desktop/release, release-tooling
- **Owning FID:** FID-2026-0906-004
- **Status:** active
- **Canonical rule:** generated-urls-match-asset-store

## Lesson: A stage that shells out to a CLI inherits that CLI's layout

- **Context:** The pipeline's `DESKTOP_RELEASE` stage pointed the
  fail-closed manifest generator at the `gh run download` root, but the
  CLI creates one subdirectory per artifact name — proven live on the
  v0.0.29 attach; the next real cut would have failed closed with
  "missing artifact" for every platform, on a stage that had never run.
- **Invariant:** When a helper's real output shape is load-bearing,
  stubbing the helper at its function boundary hides the shape; pin the
  real layout as a test fixture. The first live exercise of an unproven
  stage is a layout audit, not a formality.
- **Guard:** `flattenDownloadedArtifacts()` in
  `scripts/public-release/desktop-stages.ts` hoists bundle + `.sig`
  files flat (excluding the CI `latest.json`, which is never trusted —
  the local regeneration exit is the fail-closed assertion) with a
  fixture pin encoding the real `gh` layout.
- **Scope:** release-pipeline
- **Owning FID:** FID-2026-0906-004
- **Status:** active
- **Canonical rule:** cli-output-layout-is-contract

## Lesson: A bootstrap that covers one context imports the failure into all others

- **Context:** FID-2026-0906-007: `env.ts` self-bootstrapped the release
  env.json leg but not `.env.local`; the CLI compensated in its own
  pre-init, so CLI-routed processes worked while the pre-push smoke,
  spawned sidecars, and any sub-package entrypoint threw at import — and
  three pushes needed a hand-rolled env prefix before the class was
  named.
- **Invariant:** A convergence-point module must bootstrap every context
  it can be imported from, or each uncompensated consumer re-imports the
  failure. Compiled artifacts add a second rule: their `import.meta.dir`
  is virtual (cwd fallback required) and a bootstrap fix is only live
  after the artifact is rebuilt.
- **Guard:** `common/src/env-bootstrap.ts` (findUp + existing-env-wins)
  wired into `env.ts` (binary-env XOR two-pass findUp); the spawned-import
  class pin in `env-bootstrap.test.ts` is the regression guard;
  desktop's suite now rides the root test chain so the class can never
  silently leave every standard gate again.
- **Scope:** env, bootstrapping, spawned processes
- **Owning FID:** FID-2026-0906-007
- **Status:** active
- **Canonical rule:** bootstrap-covers-every-import-context

## Lesson: One dynamic-import seam is only as durable as its pin

- **Context:** FID-2026-0906-005 (T17-A): the shell statically imported
  the whole three/R3F graph (~190 kB gz) through a single edge. Converting
  it to a `React.lazy` boundary put the 3D graph in its own chunk
  (540→shell, 1,208 kB lazy) — but nothing structural stops a future
  "cleanup" from re-adding a static import and silently collapsing the
  split back into the eager chunk.
- **Invariant:** A bundler split survives only while its import edges
  stay dynamic; any new static edge to the lazy subtree undoes it
  silently (no test fails, no type error). Structure must be pinned by
  test, and size by build evidence.
- **Guard:** `desktop/src/floor/__tests__/office-lazy.test.tsx` pins the
  boundary (deck-view imports the wrapper, never office-scene statically;
  the wrapper uses `import()`); the vite chunk listing (pasted in the
  FID) is the size evidence.
- **Scope:** desktop, bundling
- **Owning FID:** FID-2026-0906-005
- **Status:** active
- **Canonical rule:** lazy-boundary-pinned-structurally

## Lesson: A ledger ruling inherits the freshness of its evidence

- **Context:** FID-2026-0906-006 (T17-B): the 2026-09-06 ruling authorized
  building the office presentation layer from a 2026-08-31 smoke finding;
  FID-2026-0905-005 had already built and composed the entire layer on
  09-05. Executing the ruling literally would have duplicated working
  code behind an approval.
- **Invariant:** Before executing an approved item, re-ground its premise
  against the current tree; a scope item is only as fresh as the evidence
  it was authored from. Present the ground-truth shift (Law 2) and
  converge the record — never build duplicates, never silently drop.
- **Guard:** the per-element audit table in FID-2026-0906-006 (every
  ruled element → `file:line` of composed, rendered code); acceptance
  stays with the operator visual smoke, the original bar.
- **Scope:** governance, scope-grounding
- **Owning FID:** FID-2026-0906-006
- **Status:** active
- **Canonical rule:** ruling-premise-regrounded-at-execution

## Lesson: Status-based guards inherit git's index-state blindness

- **Context:** The v0.0.29 phantom-source incident: three tracked files
  marked assume-unchanged kept 21 lines of real source out of every
  commit while every gate stayed green — `git status` does not render
  hidden index-state flags, so every guard built on status was blind to
  the exact mechanism of the corruption.
- **Invariant:** Any git state that hides content from `git status`
  hides it from every check built on `git status`. Provenance guards
  must query the index directly (`git ls-files -v`: `S`/lowercase tags =
  hidden) and prove the *committed* tree independently of the worktree.
- **Guard:** `scripts/public-release/provenance.ts` — index-state
  uniformity assertion in `verifyPreflight` (fail in mutation/automation,
  warn in preview) plus a clean-checkout compile gate in the GATES stage
  (detached temp worktree at HEAD, frozen-lockfile install, typecheck
  chain, removed on every path). The two cover disjoint classes: the
  flag, and committed-vs-worktree content drift.
- **Scope:** release-pipeline, provenance
- **Owning FID:** FID-2026-0906-003
- **Status:** active
- **Canonical rule:** index-state-asserted-directly

## Lesson: The release gate is an environment, not a gate list

- **Date:** 2026-09-09
- **Failure:** The v0.0.30 cut failed at three successive gates on code that
  passed every dev-shell run: (1) `build:sdk` — `common/src/env.ts:44` used
  Bun-only `import.meta.dir`, and the SDK's dts-bundle-generator step
  recompiles common under a plain-TS program without Bun types (TS2339);
  (2) `gateway-server-command.test.ts:85/158` spawned children by bare
  `'bun'` — `uv_spawn` ENOENT under the gate's sanitized spawn environment;
  (3) `evals/v2/tests/tempdir-sandbox.test.ts` spread `process.env` into a
  plain object before the allowlist, materializing the launching shell's
  Windows env casing (PowerShell `Path` vs Git Bash `PATH`) so the
  case-sensitive lookup missed `PATH`.
- **Evidence:** release transcripts `build-sdk-1.log` (TS2339) and
  `test-1.log` ×2 (ENOENT ×2, then `env.PATH → undefined`); fixes `2b22103`,
  `87bcc44`, `05e2e1a`; owning FID-2026-0909-002 (instances + structural
  guard proposal).
- **Invariant:** The release GATES stage is a distinct execution environment
  (PowerShell-launched, secret-sanitized, plain-TS declaration pass) — code
  must behave identically across it and every dev shell.
- **Guard:** Prefer `process.execPath` over bare runtime names in spawned
  children; standard `import.meta.url` over runtime-specific properties in
  SDK-reachable common sources; fixture envs (never host-env spreads) in
  tests feeding env-filtering functions. Structural parity guard proposed
  in FID-2026-0909-002.
- **Verification:** Each fix re-ran its exact failing gate green
  (build:sdk exit 0; gateway suite 6/0; evals suite 166/0) plus typecheck
  ×12, eslint 0, prettier clean.
- **Scope:** release/gates, testing
- **Owning FID:** FID-2026-0909-002
- **Status:** active
- **Canonical rule:** gate-environment-parity

## Lesson: "Compiles" is one claim per compiler configuration

- **Date:** 2026-09-09
- **Failure:** `verify:clean` (the committed-tree compile proof) passed on
  the exact commit whose `build:sdk` release gate failed — the typecheck
  chain compiles `common` with Bun types loaded, while the SDK build's
  dts-bundle-generator declaration pass recompiles the same sources under a
  plain-TS program without Bun types. That surface is exercised only inside
  the release pipeline, so a declaration-surface blocker reached the cut
  with every local gate green.
- **Evidence:** release transcript `build-sdk-1.log` (`TS2339` on
  `common/src/env.ts:44`, `durationMs: 7011`) vs `bun run typecheck` exit 0
  on the same commit; owning FID-2026-0909-003.
- **Invariant:** "Compiles" is one claim per compiler configuration; every
  compilation surface a release consumes (workspace tsconfigs, declaration
  programs, bundle targets) needs its own gate in the committed-tree proof.
- **Guard:** Proposed (FID-2026-0909-003 Steps): add `build:sdk` (~7s) to
  `verify:clean`'s chain with transcript capture, plus a RED pin that
  reverts the anchor fix on a scratch worktree and asserts the extended
  gate fails.
- **Verification:** `build:sdk` exit 0 post-fix `2b22103` (the failed gate
  now passes); the RED pin and chain extension are pending per the owning
  FID.
- **Scope:** release/gates, verification
- **Owning FID:** FID-2026-0909-003
- **Status:** active
- **Canonical rule:** compiles-is-per-surface

## Lesson: A policy scrub must sweep the rule text and its generator anchors, not just the artifacts

- **Date:** 2026-09-10
- **Failure:** The 2026-08-09 no-signature scrub (FID-2026-0809-014)
  removed `Author:` attribution from every artifact — but missed the rule
  itself: `ECHO.md`'s FID Authoring Rules still declared `**Author**` a
  required metadata field for 20 days. Because the sentence is a generator
  anchor (`FRAMING.fidAuthoringParagraphs` in
  `scripts/protocol-copies/content.ts`), the drift guard froze the stale
  wording into both generated protocol constants — re-teaching the dead
  rule to every agent — while `fid-ledger.ts` FORBIDDEN_ATTRIBUTION
  mechanically rejected what the rule required. Live consequence: the
  FID-2026-0910-001 Verifier correctly FAILED a compliant FID for the
  missing field. Flagged 2026-08-21 (session summary 0314:53) and never
  fixed until the audit exposed it.
- **Evidence:** commit `7031d6b9` (the 3-site atomic fix);
  `scripts/protocol-copies/content.ts:169`, `dev/echo-v0.1.2-single-agent.md:288-289`
  (which forbids `Author:` at its own :30), `scripts/fid-ledger.ts:32`.
- **Invariant:** The sentence declaring a requirement is itself an
  artifact. When a generator anchors to rule text, the drift guard that
  normally protects consistency freezes the stale wording until ALL
  coupled sites are edited in one commit.
- **Guard:** A policy scrub greps its forbidden patterns across governance
  docs AND generator sources, not just the artifacts the policy governs;
  when an auditor fails a document for violating a rule that contradicts
  policy, the auditor is the signal, not the bug.
- **Verification:** parity suite 15/0 (pre-regen 14/1 = the drift guard
  firing by design); `generate:protocol-bundle:check` exit 0; repo-wide
  grep = 5 fixed sites, zero live residue.
- **Scope:** governance, generated artifacts
- **Owning FID:** FID-2026-0910-002 (closed + archived)
- **Status:** active
- **Canonical rule:** rule-text-outlives-policy

## Lesson: External research citations are hypotheses until grepped against the tree

- **Date:** 2026-09-10
- **Failure:** The Gemini Deep Research report on SkillOpt integration
  correctly identified the presentation-stage gap but built its blueprint
  on fabricated seams: `cli/src/components/SkillList.tsx:65` (component
  does not exist), `prompts.ts:415` (file is 211 lines),
  `session-end-review.ts:140` (file is 117 lines), a quarantine-root
  `VERSIONS.jsonl` (never existed) — and its SkillOpt Issue #247
  "fragile backup" rejection rationale was inverted (current SkillOpt
  main fail-closes; Savant's rollback machinery is ahead). Two claims
  needed adjustment, not rejection (`/skills` already prints counts on
  demand; the Levenshtein cap is already engine-enforced).
- **Evidence:** the adversarial verification pass in session summary
  `2026-09-10-1245`; FID-2026-0910-001's Evidence section (the verified
  seam set).
- **Invariant:** A research report — however well-reasoned its
  architecture — carries file:line citations that are hypotheses, not
  facts. Building on an unverified seam propagates the fabrication into
  the FID record.
- **Guard:** Before folding any external report into a FID, grep every
  file:line citation against the working tree; classify each finding
  CONFIRMED / REFUTED / ADJUSTED, and build only on the verified subset.
- **Verification:** all three fabricated citations refuted by direct
  grep/read; the corrected 6-FID plan derived from the verified seams
  only.
- **Scope:** research workflow, FID authoring
- **Owning FID:** FID-2026-0910-001 (analyzed)
- **Status:** active
- **Canonical rule:** verify-research-citations-before-building

## Lesson: EHEL verification credit is per-agent — subagent runs do not clear the parent's gate

- **Date:** 2026-09-10
- **Failure:** After editing two files, `basher` subagents ran the full
  verification battery (prettier/eslint/markdownlint/typecheck) with all
  green tool output — but EHEL's Law 3 per-file gate still BLOCKED the
  parent's next write: the tracker credits verification from the
  parent's own tool executions, not from a spawned agent's terminal
  output relayed back through conversation context.
- **Evidence:** the Law 3 block sequence in session summary
  `2026-09-10-1245`; the gate cleared only after the parent ran the same
  chains via its own read-only command tool.
- **Invariant:** The Law 3 "unverified file" list is scoped to the
  agent attempting the write; verification evidence must come from that
  agent's own tool calls. A subagent's green run is real verification of
  the code but not credit the parent can spend.
- **Guard:** When EHEL blocks with unverified files after subagent
  verification, re-run the same lint/typecheck chain directly (the
  read-only command tool runs in every phase) — do not re-spawn bashers
  expecting different behavior.
- **Verification:** each direct re-run cleared the gate immediately;
  observed consistently across three block/clear cycles this session.
- **Scope:** harness, EHEL enforcement
- **Owning FID:** none (harness behavior observation — tracked so it
  does not silently recur; promote to a FID if a third session confirms
  an undesired interaction)
- **Status:** active
- **Canonical rule:** eHEL-verification-credit-is-per-agent

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
