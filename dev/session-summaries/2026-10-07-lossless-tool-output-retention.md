# No silent tool-output loss: the retention contract landed, and the trim suite was passing because of the defect

**Date:** 2026-10-07
**Automation level:** 3 (operator rulings, verbatim: "approve, grant automation
level 3" and "approve, work until everything is completed, no more blockers and
all fixed with echo compliance")
**Register items touched:** T159 (opened, implemented, verified, closed and
archived in this pass); T155 untouched and still `fixed` with three open steps

This pass began from the operator's report that the previous truncation work
"really looks like they keep failing in production" — against a repository that
already claimed a deterministic truncation layer. The claim was false in the way
that matters: Savant discarded model-facing tool output in five places and in
every one of them told the model the bytes were available somewhere it could not
reach. `FID-2026-1007-004` (high) is the record; it was opened, loop-passed,
implemented, verified, receipt-stamped, closed and archived inside one pass under
the operator's level-3 ruling, and nothing was pushed.

## What was done

**Local commits (no push, no release):**

1. `d7e40856` — `docs(fids): open the lossless tool-output retention record
   (FID-2026-1007-004)`. The record, authored from a measured audit rather than
   from the report: five destructive paths enumerated from the tree, each driven
   through the SHIPPED functions by a gitignored probe
   (`dev/scratchpad/active/step3-truncation-audit.ts`).
2. `b3531e58` — `fix(scope): make the open-item count match its own
   enumeration (FID-2026-1007-004)`. The register said "Six items are open" above
   an enumeration of five; corrected rather than smoothed.
3. `e9322b38` — `feat(evidence): return a retention handle instead of a silent
   boolean (FID-2026-1007-004)` (steps 1-2). The retention seam returns a handle
   or a named refusal, the verdict travels from the tool-result boundary to the
   synchronous transforms, and `recordEvidence` becomes the boolean view over the
   same primitive instead of a second implementation (Law 13).
4. `eb2ee0f3` — `feat(evidence): refuse to drop unretained bytes
   (FID-2026-1007-004)` (steps 3-7; 24 files, +1769/-280). The four transforms now
   return the payload **untouched** when there is no handle; one `omitted` marker
   carries `retained: { file, toolCallId, sha256, bytes, redacted }` or a named
   refusal and `fullOutput` is deleted; the trim pass writes a `layer: 'trim'`
   ledger row; the store resolves for whoever holds the handle with the spawn read
   gate scoped by need; credentials are redacted before hashing and appending; the
   store shards so its ceilings are a stated, reported bound.
5. `49c7bab4` — `refactor(evidence): split modules under the ceiling
   (FID-2026-1007-004)`. `quality:report` rejected five files this work had grown
   past the 300-line absolute maximum; each was split at a real seam
   (`spill-contract.ts`, `spill-read.ts`, `omission-marker.ts`,
   `evidence-capture.ts`, `request-files-training.ts`) with every origin
   re-exporting what moved, so no caller changed.
6. `8c7448fb` and `e4c56a83` — the record's step statuses, loop passes, deviations
   and the stamped receipt; `SCOPE.md` register update (open items Six → Five,
   T159 box checked).
7. The closure commits below.

**The defect, in one line.** `truncateToolOutputValue`'s marker carried
`fullOutput: '[See cache-debug snapshot / rerun the tool for full output]'` — a
fixed string naming two *possibilities*, while the cache-debug feature it names is
disabled by default — and the other four paths
(`simplifyVerboseToolResults`, `simplifyReadFileResults`,
`simplifyTerminalCommandResults`, the trim pass in
`trimMessagesToFitTokenLimit`) dropped the payload with no locator at all, the
trim pass deleting whole messages and writing no inventory row. The store that
could have answered all of it — the per-run evidence spill at
`.savant/evidence/<runId>.jsonl` — was unreachable from every marker, its read
side gated behind `requiresRawEvidence` (Verifier and Adversary only), its splice
firing only on a `[compacted]` sentinel the trim pass never produces, its ceilings
refused silently, and its raw output persisted unredacted. So "the full output is
retained" was true in the narrowest possible sense and false in every sense a
reader would mean.

**Reach was measured, not assumed.** `getMessagesSubset` — the trim pass's only
production caller — is reached from `find-files/request-files-prompt.ts:196` and
`:269`, so the loss is confined to the find-files request path. The worst
*mechanism* (whole-message deletion) has the narrowest *blast radius*, and the
record states both rather than overstating its severity. The same correction was
applied to the record's own first draft, which had described the trim pass as "the
largest loss" from the module's contents without a call-graph check.

## Defects found during verification

1. **The loop's heaviest finding ran the other way: an existing suite was passing
   because of the defect it is named after.** `util/__tests__/messages-trim.test.ts`
   used bare JSON strings as terminal fixtures — a shape
   `run_terminal_command`'s output schema cannot produce. The old transform threw
   into its lossy fallback (`{ command: '', stdoutOmittedForLength: true }`) and
   collapsed a ~2,018-character result to roughly 40 characters, and that silent
   destruction was what satisfied the suite's own token-budget assertion. Making
   the transform refuse a shape it cannot faithfully represent turned the
   assertion red; the honest repair was to the FIXTURE (repaired to the real shape,
   with the retention handles its precondition now requires registered in
   `beforeEach`) and the assertion was kept unchanged. Promoted to
   `dev/LEARNINGS.md` as its own lesson.
2. **Two deviations from the record's own plan, written down rather than smoothed
   over.** (a) Step 3 planned to delete all three marker spellings, but
   `contentOmittedForLength` and `stdoutOmittedForLength` are members of the
   `read_files` / `run_terminal_command` output zod unions and the first is
   type-guarded in `util/messages/history.ts:156`, so deleting them would have
   widened a correctness fix into the tool-output schemas — they stay as the
   marker's boolean view (Law 13). (b) The trim ledger's diff must run against the
   SIMPLIFIED pre-drop array, because that pass also REPLACES messages and a
   reference-identity diff against the caller's array would have reported every
   replaced-but-kept message as deleted.
3. **`store-full` moved from "unpinnable" to pinned.** The previous loop had
   recorded that refusal reason as unpinnable because producing it honestly needs
   an 8 MiB fixture; making the caps injectable per call is what made it
   pinnable, and the RED captured before the production edit included it.
4. **A file left prettier-dirty by the implementation commits.** The last edit to
   `packages/agent-runtime/src/util/messages/trimming.ts` removed one blank line
   that the committed blob did not have; `git show HEAD:…` piped through
   `prettier --stdin-filepath … --check` exits 1, so the cleanup is required
   rather than cosmetic and rides its own path-scoped commit (see Closure).

## Verification evidence

Run on the final tree, each as a plain command with its exit status read:

```text
bun run fid:verify dev/fids/archive/FID-2026-1007-004-…md --write
                                                11/11 gates exit 0
bun run typecheck                               exit 0 (13 workspaces + scripts)
bun run validate:repository                     PASS
bun run fid:verify --check                      PASS — all active fixed/verified
                                                FIDs carry valid receipts
bun run scripts/scope-register-check.ts         PASS (0 issues)
bun run learnings:check                         PASS (39 structured entries)
bun run lint:md                                 exit 0
bun x prettier --check <the five edited docs>   exit 0
bun test (packages/agent-runtime, from its root) 1905 pass / 0 fail, 297 files
bun scripts/module-state-check.ts               PASS (183 of 188 wired)
quality:report                                  PASS (1498 baselined files)
```

The archived record's re-stamp fingerprint is
`sha256:f28729c2885c8320eaf9b912c2b737a8be013168f7a5690a70bba91e7e3aebcb`
(`2026-10-07T19:29:45.892Z`); the fingerprint at the active path was
`sha256:cc4dfd18748a8af45beea2f47cdd45c084210f7b1eeb90168d225eb0dd23ed7f`.

`bun scripts/module-state-check.ts` is worth calling out because it is the
repository's own tooling auditing this record's work: the retention registry is
module-scope state, so FID-2026-1007-002's audit owns it, and it reports **183 of
188** resettable bindings wired — unchanged by this pass, because this work adds
no module-scope state.

## Recorded boundaries and forks

1. **T155 is NOT closed and was not touched.** Three of its ten steps cannot be
   completed in this environment: step 8 (the Anthropic
   `tool_addition`/`tool_removal` evaluation) needs a captured wire body from a
   live endpoint, step 10 (the `>75%` hit-ratio measurement) needs live traffic and
   provider billing, and step 11 is the locator gap its own step-3 audit measured.
   Closing it would launder three open steps into an archive. Step 11's defect is
   the one this pass fixed from the other side, so the register line now says the
   locator contract exists.
2. **`no-retention-verdict` is a bounded failure, not an unbounded one.** With the
   verdict present for every production tool result (the boundary retains before
   any layer sees the result), refusing to drop can only fire if the async write
   loses its race *and* the find-files path runs inside that window — and the
   failure it chooses is a prompt that is too big, which fails loudly and cheaply,
   over a finding that is gone, which fails silently and permanently.
3. **"Lossless" is not literal for credentials.** Redacting at the store means a
   payload containing a secret is stored in its redacted form, so a redacted
   payload is not recoverable in original form **by design**. That is a Law 12
   decision, it is stated in the module contract, it is carried on the record and
   the handle as `redacted: true`, and it removes bytes only from the STORE —
   never from the model's context.
4. **The repository-wide format gate is RED, pre-existing, and not from this
   pass.** `bun x prettier --check .` reports 54 unformatted files (measured on the
   final tree; `cli/`, `common/`, `evals/v2/skill-cases/*.json`,
   `packages/agent-runtime/`, `website/`) — none of them a file this pass edited,
   and one of them (`website/index-2.html`) is an untracked input parked on purpose.
   `scripts/prettier-check.ts` is the declared gate probe for
   `protocol.config.yaml` `commands.format`, so this is a real gate failure carried
   by the repository and left undecided rather than swept into this pass: a 54-file
   mechanical reformat is its own coherent change (G3) and an operator call.
5. **Not re-run in this pass:** the full root `bun test` chain and the
   `sdk`, `desktop`, `evals`, `database`, `knowledge-graph`, `connectors` and
   `code-map` suites. Stated as limits, not as passes.
6. **Nothing was pushed.** G1 permits granular local commits to `main`; push,
   release and tag mutations remain outside this session's authority, and the
   pre-push credential scan and hook battery have not been exercised against these
   commits.

## Closure

`FID-2026-1007-004` is `closed` and lives at
`dev/fids/archive/FID-2026-1007-004-lossless-tool-output-retention-and-verified-locators.md`;
its receipt was re-stamped LIVE at the archived path so the closed record is
byte-consistent with its final content. `dev/fids/README.md` gained its paragraph in
the closed-records list (the active queue still reads **One**, which is
`FID-2026-1006-005`), `dev/fids/archive/README.md` gained a
`## 2026-10-07 closure — lossless tool-output retention and verified locators`
section, `CHANGELOG.md` gained its entry as the newest under `Unreleased —
2026-10-04` `### Fixed`, and `dev/LEARNINGS.md` gained the lesson "A suite can be
passing because of the defect it is named after".

## Continuation note

Register state after this pass: **Five** open items — T119, T62-followups and T122
blocked pending operator input, T147 shelved on an operator ruling, and T155
awaiting work with steps 8, 10 and 11 open. T159 is complete and its box is
checked. Three untracked inputs remain parked and are not this pass's to dispose
of: `docs/archive/reports/echo-astra-review-2026-10-06.md`,
`docs/design/Savant_ECHO Cache Optimization Research.md` and `website/index-2.html`.
