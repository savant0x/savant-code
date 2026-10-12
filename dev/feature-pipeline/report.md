# Lesson feature pipeline

Source fingerprint: baa91dbd17dafdd5ba2dd9e205c48f390bb067ae786e61609bd8e3619e82de41.

Readiness is a reviewed proposal. Implementation status records closed-FID
evidence; it does not claim that historical tests were rerun today.

Inventory: 74 headed lessons; 55 schema-governed.

## Feature candidates

### LF-001: Read complete large files through real paginated windows

P1; implemented; observed-gap.

The SDK truncates the whole file before the runtime applies line offsets. LEARNINGS line 1750 exists but is beyond the
  truncated prefix, so a valid offset returns empty. Preserve bounded responses by selecting the requested window at the
  filesystem boundary.

Acceptance:

- An offset beyond the first 100k characters returns the real requested lines through the production SDK/runtime path.
- The selected response remains capped; traversal, ignored-file and 10MB safety rules remain enforced.
- Overlapping paginated reads reconstruct the complete file with a matching SHA-256.

Owning FID: FID-2026-1012-007.

### LF-002: Carry compression policy and model context into child agents

P1; implemented; observed-gap.

The parent disables micro-compaction, but the child extractor does not forward compression or contextWindow. The child
  uses default compaction and a 200k context fallback, clearing fetched paper records from model context at 11% of the
  threshold.

Acceptance:

- Both child spawn paths preserve the configured microCompact:false and evidence-retention settings.
- A same-model child receives the resolved context window; a different-model child resolves its own window.
- A live-style scholarly sequence retains early paper records through synthesis with micro-compaction disabled.

Owning FID: FID-2026-1012-008.

### LF-003: Prove durable save and resume with nested runtime state

P1; draft; investigation.

Six database snapshot saves failed with cyclic serialization in the surrounding acceptance session. Diagnose the exact
  field and compare filesystem and database persistence before choosing a repair; database failures alone do not prove
  all resume state was lost.

Acceptance:

- A nested child-agent run saves and restores semantically equivalent conversation state.
- A cyclic transient field produces a bounded diagnostic and preserves durable user content.
- Fault injection proves what survives a failed write and whether retry recovers.

Owning FID: not routed.

### LF-004: Recover retained research evidence on demand

P1; draft; investigation.

First repair policy propagation, then assess whether the existing evidence spill/inventory can restore fetched paper
  records after intentional compaction. Do not create a second evidence store or claim that retained bytes were
  destroyed merely because model context changed.

Acceptance:

- A compacted result has a resolvable locator with truthful retention bounds.
- An authorized researcher can retrieve the original fetched record without rerunning the service.
- Missing or expired evidence is reported as a gap, never synthesized from memory.

Owning FID: not routed.

### LF-005: Record production acceptance separately from agent tool success

P2; draft; investigation.

The agent report confirms tool calls but explicitly does not observe terminal rendering or recovery. Define a run-bound
  acceptance record that separates model observations, operator UI checks and automated regression evidence.

Acceptance:

- Every claimed UI behavior has an operator/native observation or remains unverified.
- Exact run identifiers bind the call ledger, failures and fallback steps.
- Resize, input responsiveness, folding, copy/export and resumed-history fidelity have separate outcomes.

Owning FID: not routed.

### LF-006: Detect stale lesson guidance against current executable authority

P2; draft; investigation.

Historical lessons retain outdated local-commit authority and platform proposals. Preserve their evidence while
  identifying current authority and supersession; do not present dated active flags as proof that work remains
  unimplemented.

Acceptance:

- Historical guidance is visibly distinguished from current protocol authority.
- Source changes invalidate reviewed readiness without automatically changing policy.
- A stale proposal cannot create duplicate work when a real implemented FID already owns it.

Owning FID: not routed.

## Complete lesson inventory

Unlinked lessons retain their documented guards. No current defect is inferred
from their presence. Historical entries require current-source review.

- An unavailable tool needs a different recovery policy from incomplete arguments — governed; no new candidate.
- A register target line whose globs all sit on continuation lines contributes nothing — governed; no new candidate.
- A machine-readable register entry is a parsed artifact, not prose — governed; no new candidate.
- A repair script that slices on a re-run is a data-loss script — governed; no new candidate.
- Verification gates inside a code fence are invisible to fid:verify — governed; no new candidate.
- Extend an existing command before registering its replacement — governed; no new candidate.
- Preserve operator-owned controls through a visual redesign — governed; no new candidate.
- A failing part is not a failing whole — governed; no new candidate.
- A control that fails is not a control that disagrees — governed; no new candidate.
- A telemetry value's absence and its zero are different facts — governed; no new candidate.
- A new AgentState field is not a free edit — the compiler makes you classify it — governed; LF-002.
- A health breaker may throttle background traffic but must never deny a user action — governed; no new candidate.
- Removing a gate from its only caller leaves production-dead code behind — governed; no new candidate.
- A blocker inherited from an outside document must be traced to its owner — governed; no new candidate.
- Opt-in isolation is not isolation, and a reset is not an authority — governed; no new candidate.
- A marker rule and a placement rule are different rules — governed; no new candidate.
- A suite can be passing because of the defect it is named after — governed; LF-004.
- A gate that cannot be declared cannot be proven — governed; no new candidate.
- A marker that names a possibility is not a locator — governed; LF-002, LF-004.
- A leak class is enumerated, not inferred from the instance that hurt — governed; no new candidate.
- A reset has no value until a preload calls it, and a boundary has two levels — governed; no new candidate.
- A process-lifetime registry plus a reused fixture key is deterministic test-order dependence — governed; no new
  candidate.
- Removing shared-state noise is the start of the diagnosis, not the end of the repair — governed; no new candidate.
- A cost model outgrown twice needs every site enumerated, not the constant retuned — governed; no new candidate.
- A governance control that degrades to an advisory needs a loud, specific degradation — governed; no new candidate.
- A fix that deletes a detection class costs more than the work it removes — governed; no new candidate.
- A library-complete hand-off needs a named consumer, not a readiness note — governed; no new candidate.
- Law 4 is satisfied by the caller, not by the test that imports the module — governed; LF-005.
- An embedded scope cannot import — give it data-shaped seams — governed; LF-002.
- A config loader must parse the repository's formatted file, not a hand-written sample — governed; no new candidate.
- A quality-gate extraction must carry its census pin to the new site — governed; no new candidate.
- A parser that reads prose must separate *describing* a convention from *using* one — governed; no new candidate.
- A fixed character budget must account for the prefix that renders before it — governed; no new candidate.
- The register-completeness gate decides what a scope register may be condensed to, not the author — governed; no new
  candidate.
- An archived walkthrough is a claim — ground the plan in the current contract modules — governed; LF-006.
- A stage followed by a network-bound step cannot pin its own retry — extract the seam — governed; no new candidate.
- A mode parameter must be pinned on every branch that returns a verdict — governed; no new candidate.
- A suppression key that can legitimately be null cannot distinguish "inactive" from "active with no identity" —
  governed; LF-003.
- A FID's Verification section is a contract — each promised test must exist before "verified" — governed; LF-005.
- Environment-dependent guards need live probes — cwd-scoped path matching passed tests and failed production —
  governed; no new candidate.
- Active-ledger status admission — admissible active-queue statuses — governed; no new candidate.
- FID metadata carries no attribution fields — governed; no new candidate.
- Files over the 100k-character tool read limit break every in-place edit path — governed; LF-001.
- Static-string decompositions require a byte-identity hash gate — governed; no new candidate.
- Brand colors must be traced to provenance, not inherited from code — governed; no new candidate.
- Undeclared imports can ride a phantom node_modules outside the repo — governed; no new candidate.
- workflow_dispatch source_ref must be a branch or tag, not a SHA — governed; no new candidate.
- Perfection Loop convergence on a FID document is not FID closure — governed; no new candidate.
- The test renderer is not a proxy for the production renderer — governed; LF-005.
- OpenTUI Timeline defaults halt looping animations after 1 s — governed; no new candidate.
- Generated artifacts require source-shape validation — governed; no new candidate.
- Structured lessons need executable evidence — governed; no new candidate.
- Legacy clean-shell guidance is superseded by reversible preflight — governed; no new candidate.
- Manual clean-shell recipe is superseded — governed; no new candidate.
- Harness grounding keeps protocol variants explicit — governed; no new candidate.
- A retry that re-emits the same oversized tool call is not recovery — historical; LF-003.
- Autonomy is a driver problem, not a governance problem — historical; no new candidate.
- Local commits ≠ publishes — granular history beats the monolithic release commit — historical; no new candidate.
- Assume-unchanged files are phantom source invisible to every local gate — historical; no new candidate.
- A test whose runtime approaches the harness timeout is flaky by construction — historical; no new candidate.
- Generated download URLs must target the asset store, not the encoder's inverse — historical; no new candidate.
- A stage that shells out to a CLI inherits that CLI's layout — historical; no new candidate.
- A bootstrap that covers one context imports the failure into all others — historical; no new candidate.
- One dynamic-import seam is only as durable as its pin — historical; no new candidate.
- A ledger ruling inherits the freshness of its evidence — historical; LF-006.
- Status-based guards inherit git's index-state blindness — historical; no new candidate.
- The release gate is an environment, not a gate list — historical; no new candidate.
- "Compiles" is one claim per compiler configuration — historical; no new candidate.
- A policy scrub must sweep the rule text and its generator anchors, not just the artifacts — historical; LF-006.
- External research citations are hypotheses until grepped against the tree — historical; no new candidate.
- EHEL verification credit is per-agent — subagent runs do not clear the parent's gate — historical; no new candidate.
- Focusable is not reachable — keyboard access needs a control that moves focus — historical; no new candidate.
- Count-only consumers should not pay for a full parse — derive the count at the source — historical; no new candidate.
- Reserve proposal slots mechanically — a record store is a cap, prompt discipline is a wish — historical; no new
  candidate.
