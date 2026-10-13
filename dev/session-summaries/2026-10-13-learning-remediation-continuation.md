# Learning remediation continuation — 2026-10-13

## Authorization and initial state

Continue FID-2026-1012-014 and the FID-2026-1012-022 program at automation
level 3. Preserve provider-parity, raw experiences, wiki and handoff artifacts.
The operator holds commits, pushes and releases. ECHO G2 therefore prevents
formal closure and archival; deterministic implementation can still proceed.

Read ECHO.md 0-EOF and the single-agent adaptation, protocol configuration,
architecture, scope register and applicable learning FIDs. Strict mode stays on.

## Verification and findings

- Root typecheck: exit 0, all declared legs.
- Root ESLint: exit 0.
- Learning tier/projection/validator/skill suites: 35 pass, 0 fail.
- Root formatting identified scripts/learnings-rules.ts and scripts/learnings.ts;
  both read completely and formatted with the existing formatter.
- Root tests: SDK 740 pass, 1 skip, 1 fail. The Windows detached-grandchild
  readiness file is absent at run-terminal-command.test.ts:224. Isolated rerun:
  6 pass, 1 fail. Investigate under the execution-reliability FID-2026-1012-023.
- Real feature admission reproduces seven missing retired titles.

## Recorded implementation presentation — FID-2026-1012-012

Implement the converged Loop 2 shared locator contract. Extract the existing
lesson field parser into scripts/learnings-locator.ts, retaining its public
parseLessons facade. Read live and retired locations with date, status, rule,
line and governed metadata. Identical bodies retain all locations; conflicting
bodies fail closed. Resolve supersession chains with replacement notices and
cycle/missing-target diagnostics. Feature admission resolves retired titles
without changing candidate links. Skills continue selecting only live active
entries. Retirement uses the same entry parser; FID-011's move receipts remain
the move writer. Add locator and admission regression coverage, plus existing
retirement tests. No actual retirement or candidate promotion is authorized here.

## Interim implementation record

## Implemented continuation

- FID-010: shared 24,000-character digest contract; prompt/mechanical grounding/
  embedded bundle aligned; SDK status/truncation/omission/window reads do not earn
  false grounding credit; count telemetry. Four original public invariants and
  guards retained. Current digest: 1,938 characters.
- FID-013: structured reproduction and validated historical snapshots; durable
  current-code prefix/truncation probes; all three legacy lessons governed and
  active; two contradictory guards corrected. Real ledger: 37 structured entries,
  1,170 lines, 76,975 characters. No retirement or incident loss.
- FID-016: 74-title invariant/guard/rule inventory, zero exact merge proposals,
  zero mutation and zero claimed boot saving.
- FID-015: admission and report freshness in the repository collector; fingerprint
  covers live/retired/manifest; deterministic red publication retains failure;
  real report regenerated. Four drafts remain drafts.
- FID-021: qualified lesson-last checks join exact class links to shared owner/
  horizon/receipt evidence; SessionEnd drafts proposed records idempotently under
  an exclusive lock. Proposals confer no active owner or source-write grant.

Focused continuation batteries pass: boot/cadence/lifecycle 11; common boot/
embedded 16; reproduction/consolidation/admission/report 19; coverage/order/
draft/SessionEnd 23. All require final declared-gate receipts and serial root
verification below. Formal closure remains blocked by the no-commit hold;
no class observation, actual production exposure or boundary is fabricated.

## Interim verification and recovered failures

FID-014 and FID-012 now have live stamped receipts. Real admission passes with
74 lessons / 6 candidates. Gate discovery excluded scripts from its workspace
root resolution; FID-2026-1013-001 owns the repaired test argv/cwd contract.
The full-root rerun reached runtime worktree fixtures and hit 20 five-second
timeouts. The same three suites pass isolated (24 pass, 0 fail); a serial full
battery remains required. Windows readiness/cleanup was also timing-sensitive;
the full SDK rerun passed (741 pass, 1 skip) and the test now surfaces its actual
startup result if readiness fails.

Recorded FID-010 presentation: reuse the generated boot projection, assert the
shared 24,000-character budget, update prompt/mechanical grounding/embedded
aliases together, refuse incomplete grounding credit, and log payload counts.
No ledger incident is removed by this work.

Run declared FID gates and stamp receipts after evidence and statuses are
reconciled. Continue remaining unblocked master-plan dependencies. Operator
holds on concrete consolidation and external inputs remain active.

## Final verified state

This section supersedes the interim pending/failure state above.

- Full configured root test chain: exit 0; 8,994 PASS, 23 SKIP, 0 FAIL across
  thirteen workspace legs. SDK 741, CLI 4,145, common 867, agents 158, evals
  229, runtime 2,086, design systems 19, code map 55, database 53, knowledge
  graph 76, providers 92, connectors 23, desktop 450.
- Serial suite execution recovered the Windows readiness/worktree timing
  failures. An independent Bun file-descriptor runner recorded the root gate's
  real exit 0 after the PowerShell redirect wrapper retained a console handle.
  Only the identified owned wrapper/console were stopped after that proof.
- Combined learning battery: 69 PASS, 0 FAIL, 263 expectations across thirteen
  files. Final candidate/report suites after metadata additions: 13 PASS.
- Full root typecheck, ESLint, Prettier check and Markdown lint: exit 0.
- `learnings:check`: PASS, 37 structured entries, 1,170 logical lines,
  76,975 JavaScript characters. `quality:report`: PASS, 1,502 baselined files.
- Generated protocol bundle, boot projection and boot-budget checks: PASS.
  Digest 1,938 / 24,000 JavaScript characters; four public rule guards retained.
- Repository validation: PASS. Its only earlier structural failure was the
  new script-gate FID's missing Missed Questions heading; corrected and restamped.
- Live receipts stamped for FID-010, -012, -013, -014, -015, -016, -021 and
  FID-2026-1013-001. No receipt substitutes for production class observation.
- The last audit run alongside formatting/lint reported the reproduction test
  gate red without its child stderr. Its immediate isolated rerun passed 4/4,
  and the complete FID-013 receipt rerun passed all seven gates. The fresh serial
  repository audit passed (exit 0); no fixture failure was removed or represented as
  a production repair. The precise intermittent failure cause is not established.
- Feature report: 74 unique titles, 37 governed lessons, nine admitted candidates.
  Existing two implemented and four draft states retained. LF-007, LF-008 and
  LF-009 are routed to FID-010, FID-014 and FID-013; no commit was invented.
- Shared recurrence census: 586 records, 57 stable classes, zero unowned,
  zero issues, zero observed. No raw capture or class boundary was manually edited.

Logs are under `dev/scratchpad/active/learning-remediation-2026-10-13/`:
`root-test-exit-proof.log`, `root-test-serial.log`, `typecheck-latest.log` and
`recurrence-latest.json`. Root test totals count final successful legs once.

## Production consumers checked

- `result-lifecycle.ts:136` calls `completeGroundingReads` before granting
  grounding credit; the runtime test drives real SDK file reads into that flow.
- `validate-repository.ts:243` calls `collectFeaturePipelineIssues`; the
  standalone feature probe calls the same collector, avoiding recursive FID gates.
- `session-end-review.ts:268` calls `repairDraftRoutingNotes`; draft proposals
  remain separate from approval, ownership and implementation write grants.
- Live/retired resolution feeds feature admission and skill extraction; the
  retirement writer shares the same lesson-block parser. Existing moves remain intact.

## Remaining register measurements

No provider source, parity record, credential store or user configuration changed.
All network requests in this measurement were model-list GETs; no inference,
funding, purchase, account creation or message was performed.

T119: the current registry has 27 entries. Twenty-five remote model catalog
endpoints returned HTTP 200; eleven were public and fourteen required existing
stored keys. Local Ollama and Cloudflare's account-specific endpoint were not
misreported as generic remote catalog failures. Measurements were compared to the
registry endpoints documented through `docs/providers.md`; its provider facts
gate passes. Counts are live account/surface observations, not universal rosters.

| Provider | Rows | Boundary |
|---|---:|---|
| apinex | 34 | keyed |
| atria | 1 | keyed |
| bai | 60 | keyed |
| bazaarlink | 123 | public |
| chatanywhere | 30 | keyed |
| cleanapis | 33 | keyed |
| codecraft | 33 | keyed |
| commandcode | 88 | public |
| hcnsec | 21 | keyed |
| infron | 492 | public |
| intern | 10 | keyed |
| kiosapi | 80 | public pricing catalog |
| mistral | 46 | keyed |
| nous | 423 | public |
| nvidia | 80 | public |
| openai | 127 | keyed |
| openrouter | 461 | public |
| orcarouter | 207 | public |
| tiarina | 20 | keyed |
| tokenbom | 88 | public |
| tokenharbor | 69 | keyed |
| tokenrouter | 157 | keyed |
| unorouter | 259 | keyed |
| vercel | 459 | public |
| xkiro | 129 | public |

Raw read-only receipts: `provider-live-catalogs.json` and
`provider-keyed-catalogs.json` in the scratch directory above (UTC timestamps).

T173: vendor pricing has 80 rows and contains gpt-oss-20b,
claude-haiku-4-5-20251001, llama-3.2-11b-vision-instruct and deepseek-v4-pro-0813;
none publishes a window field. codex-auto-review is absent. The authenticated
model list returns 28 rows with id/object/created/owned_by/supported_endpoint_types;
none of the five exact targets appears. `kiosapi-keyed-windows.json` records
the payload fields. A Jina Reader fetch of the public vendor page adds no window
specification. Vendor evidence remains an external blocker; fallback rows unchanged.

T171: current explicit `/provider add <host>` calls `readDiscoveryPrefill`
(`provider-subcommands-handlers.ts:83`) and adopts the existing per-step wizard.
The model picker delegates unconfigured registry providers to setup
(`use-chat-pickers.ts`); the provider picker has no discovery-host prefill branch.
The real existing suite is `cli/src/commands/__tests__/provider-wizard-discovery.test.ts`
and passes 15 tests. The register's old utils-suite path is stale. This establishes
the remaining picker work; the stricter verdict/consent choice is still operator-owned.

## Open boundaries

All verified continuation FIDs remain active and SCOPE entries remain unchecked:
ECHO G2 requires commits for formal closure, which the operator expressly holds.
Class investigations and exposure-qualified observation remain open. T122/T186,
T175, T62, T187 and T171's ruling retain their recorded operator/external blockers;
T173 additionally needs vendor-published exact window evidence. Master closure is
not claimed. Provider-parity, wiki, raw capture, idea-shelf and prior handoff work
were preserved. No stage, commit, push, release or archive move was performed.
