<!-- markdownlint-disable MD013 -->

# FID folder ground-truth audit — 2026-10-14

## Intent and impact

Operator request: audit the FID folder after the substantial work on 2026-10-13.
Automation level 3; governed by the single-agent protocol and the existing
FID-folder audit item in `SCOPE.md`.

Reconcile all fifteen active records against metadata, current implementation
and production callers, declared gates, local history, and closure conditions.
Correct stale index/master/register prose, Wave 3/4 Resolution claims, and
FID-021's superseded commit hold. Preserve historical planning evidence with
its date. The four QOL waves exist in the working tree, but their baseline HEAD
references are not implementation commit hashes. Class repair requires actual
qualified observation; no production evidence will be invented for closure.

## Initial evidence

- `git log --since=2026-10-13T00:00:00-04:00`: learning-store and harness
  closures, provider integrations, and class-instrument continuations committed
  locally; current HEAD `6e6998b6`.
- `git status --short`: the QOL wave records and several new implementation
  modules are untracked, with their consumers modified. No wave commit exists.
- `bun run fid:verify --check`: PASS for active fixed/verified receipts.
- `bun scripts/scope-register-check.ts`: PASS, zero issues.
- `bun run validate:repository`: `validation: PASS`, including the live
  deduplicated rerun of declared gates on enforced FID statuses.
- `bun run typecheck`: exit 0 across all configured workspace and scripts legs.
- `bun scripts/experiences-recurrence.ts --json`: 589 records, 58 classes,
  zero issues, zero observed classes. `fix-boundaries.json` contains no boundaries.

## Audit findings

1. The active index and master list Waves 1–4 as converged/unstarted, although
   their headers are fixed and their source changes and valid receipts exist.
2. Wave 3/4 Resolution and current verification prose still claim converged,
   unstarted work despite `implementation_started: true` and implemented steps.
3. The QOL coordinator describes all four child waves as unstarted. It remains
   a coordination plan, with child closure still required.
4. FID-021 and its scope row still state a no-commit hold that Loop 6 lifted;
   the recorded count-reporting implementation is committed at `2a34e558`.
5. SCOPE's learnings-store description and build order still describe Chain B
   as active, despite all seven artifact records closing on 2026-10-13.
6. Wave 3 names its new code-surface-stripper regression suite in implementation
   evidence but does not declare that suite as a verification gate.
7. `git diff --check` found an extra blank line at EOF in Wave 2's
   `cli/src/commands/export-conversation/format.ts:48`. Remove that blank line
   by a direct edit; no runtime behavior changes.
8. The completed parity-probe item still had a checked register line and an
   active write-target grant. Evict both, retaining its operator acceptance
   ruling and dated measurement as evidence; the provider expansion stays open.

## Closure assessment

No active record is proven eligible for archival in this audit. The class lanes
and recurrence machinery still owe their recorded observation/investigation
conditions. Provider parity is unimplemented, the Cloudflare probe carries an
external account-configuration boundary, and the four QOL waves require committed
implementation evidence. The two coordinators await their children.

## Per-record ground truth and next lifecycle action

The status column matches the actual FID headers. Gate counts are declarations,
not substitutes for implementation or production observation. The validator
live-runs gates for fixed/verified records; converged/analyzed records are outside
its enforced receipt contract. FID-024's existing receipt is historical instrument
evidence, not a fresh lane-repair PASS.

| FID | Header / gates | Current evidence | Remaining lifecycle action |
|---|---|---|---|
| `FID-2026-1012-017` | fixed / 12 | `propose-write-file.ts:8` consumes chunked writing; commits `f46af839` and `232f0022`; 19 owned unresolved classes | Investigate remaining provider rejection and earn qualified observation; no fix boundary exists. |
| `FID-2026-1012-018` | fixed / 7 | `sdk/src/run/tool-call.ts:182` supplies the run cache; `read-url/fetch.ts:192` classifies HTTP outcomes; commit `d9cee722`; 11 unresolved classes | Prove remaining class causes and begin qualified observation. |
| `FID-2026-1012-019` | fixed / 10 | `loop-context.ts:213` invokes capability preflight; commit `3ee91a35`; 5 unresolved classes | Resolve the recorded host-resolver cause and prove production behavior. |
| `FID-2026-1012-020` | fixed / 11 | `process-str-replace.ts:279` invokes edit diagnosis; SDK patch diagnosis at `apply-patch.ts:101`; commit `be66e79f`; 9 unresolved classes | Investigate lost historical causes and earn qualified observation. |
| `FID-2026-1012-021` | verified / 12 | `hygiene.ts:225` invokes coverage, `learnings-validation.ts:181` invokes repair ordering, `session-end-review.ts:268` invokes proposed drafting; `2a34e558` resolves the held commit | Retain the recorded class-observation condition; commit permission is resolved. |
| `FID-2026-1012-022` | converged / 0 | Fifteen active records; completed Chain B in archive; reconciled child status board | Close after child closure and fresh allocation. |
| `FID-2026-1012-023` | fixed / 11 | `run-terminal-command.ts:181` produces `CommandTimeoutError`; shared command metadata reaches client bridge; commit `1d552548`; 5 unresolved classes | Distinguish expected timeout outcomes and prove qualified production observation. |
| `FID-2026-1012-024` | converged / 13 | `hooks/engine.ts:47` dispatches exposure capture; `experiences-recurrence.ts:235` inspects boundary evidence; commit `c7ca48a1`; 9 unresolved classes | Instrument is implemented, but underlying repairs/expectedness and exercised observation remain unproved. |
| `FID-2026-1012-026` | converged / 0 | All eighteen proposed provider keys are absent from registry partitions | Implement the converged provider expansion and declare/execute its gates. |
| `FID-2026-1013-005` | analyzed / 0 | Recorded local Ollama HTTP 200 / three models; Cloudflare configuration boundary documented | Supply account ID/token through the operator-owned configuration, then repeat the account catalog probe; this audit does not re-test credentials or endpoints. |
| `FID-2026-1013-009` | converged / 0 | Four fixed child waves, registration and gates present | Coordination plan awaits committed child evidence and closure. |
| `FID-2026-1013-010` | fixed / 10 | `preserved-state.ts:177` reads patch operations; `micro-compact.ts:137` counts real tokens; cache reset at runtime test preload `:62` | Commit existing implementation and finish the closure record. |
| `FID-2026-1013-011` | fixed / 16 | `/copy` and `/export` import common display helpers; `store.ts:7` imports common SQLite loader; stage nameplate uses shared drawing at `:77` | Commit existing implementation and finish the closure record. |
| `FID-2026-1013-012` | fixed / 14 | `validate-repository.ts:192` wires rationale audit; `post-write-scanners.ts:174` uses stripped code; template imports body C at `:18` | Commit existing implementation and finish the closure record; missing stripper-test declaration repaired in this audit. |
| `FID-2026-1013-013` | fixed / 10 | `ToolCard.tsx:139`, `use-gateway.ts:237`, `scene-frame-loop.ts:123`, `use-message-block-sync.ts:88`, `use-chat-messages.ts:90` are production consumers | Commit existing implementation and finish the closure record; live UI acceptance is unclaimed by this audit. |

Paths abbreviated in the table are resolved by the owning FID's full component
paths. Class counts use the current stable classifier; the older 68-class / 559-row
tables retain their dated legacy instrument and are not rewritten as current data.

## Completed reconciliation

- Repaired the index and master QOL rows and separated historical index snapshots
  from the current queue. Added the unimplemented provider-parity row to the master.
- Corrected the coordinator's child-progress claims, Wave 3/4 Resolution and
  current verification prose, and their baseline-versus-implementation commit wording.
- Removed superseded FID-021 commit-hold/current-unimplemented claims and the
  stale register hold. Kept its qualified-observation condition intact.
- Reconciled completed Chain B and the latest passing validator evidence in SCOPE.
- Added the missing Wave 3 stripper-test gate and refreshed affected receipts
  with the repository's own gate executor; no receipt was hand-written.
- Removed one extra EOF blank line in the export formatter. No runtime logic changed.
- Completed the audit register item and removed its write-target grant from SCOPE;
  all fifteen underlying work items remain registered and active.
- Evicted the already-completed parity-probe item and its obsolete grant. Its
  2026-10-12 measurement was Kilo HTTP 200 / 391 rows plus an inference round-trip,
  OpenCode HTTP 200 / 83 rows with free-tier inference HTTP 403, and a Tier 1 sweep
  of two public, fourteen key-gated and two no-surface providers. The operator's
  registry-expansion acceptance ruling remains in SCOPE; no provider work was dropped.

Yesterday's fifteen local closures are already archived: the seven Chain B
records, surface-coverage and two other harness records, Apixo/AIHubMix, and the
three suite-health/clock records. Their archive headers and CHANGELOG entries
agree; no closed record remains in the active folder. This pass adds no closure
entry because no further FID has earned closure.

No source implementation was committed or replaced during this audit. Existing
working-tree changes remain intact; the missing QOL implementation commits are
reported as lifecycle work, not as an operator-permission requirement. No push,
release, fabricated exposure, or archival was performed.

## Final verification

- `bun run validate:repository` — exit 0, `validation: PASS`; live declared
  fixed/verified gates pass against the reconciled tree.
- `bun run fid:verify --check` — exit 0, all active fixed/verified receipts valid.
  Five converged/analyzed records are explicitly outside the enforced contract.
- `bun run fid:verify <FID-021> --write` — 12/12 gates PASS; receipt stamped.
- `bun run fid:verify <Wave-3> --write` — 14/14 gates PASS, including the newly
  declared stripper suite; receipt stamped.
- `bun run fid:verify <Wave-4> --write` — 10/10 gates PASS; receipt stamped.
- `bun run typecheck` — exit 0, all configured workspace and scripts legs.
- `bun x eslint . --max-warnings 0` — exit 0.
- `bun run lint:md` — exit 0; touched documents also checked after final edits.
- `bun scripts/scope-register-check.ts` — exit 0, zero issues after grant eviction.
- `bun x prettier --check cli/src/commands/export-conversation/format.ts` — exit 0.
- `git diff --check` over the touched tracked surfaces — exit 0 after EOF repair.

The two audit methods were live gate execution and manual reconciliation against
the FIDs, current production consumers, census, and local history. The whole root
unit/build battery was not rerun: this pass changes governance documentation,
adds one test declaration, and removes a formatter blank line. No fresh release
or live UI certification is claimed.
