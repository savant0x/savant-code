<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: v0.0.23 Comprehensive Live-Test Remediation and Certification Master

**Filename:** `FID-2026-0812-001-v0-0-23-live-test-remediation-master.md`
**ID:** FID-2026-0812-001
**Severity:** critical
**Status:** closed (operator-directed closure 2026-08-12; see closure addendum)
**Created:** 2026-08-12 02:07 UTC
**YAGNI-Compliance:** Verified for planning scope

> **Planning boundary:** This FID converges the remediation and verification contract. It does not authorize a
> release, tag, push, publication, deployment, credential use, or production implementation until the operator approves
> the explicitly selected workstreams. `Status: verified` means the FID plan has converged; it does not mean the product
> or release is verified.
>
> **Attribution policy:** The single-agent ECHO protocol prohibits signatures, author fields, and agent attribution. None
> are included here.

---

## Summary

The v0.0.23 comprehensive live-test report began with 118 numbered checks at 36 PASS, 2 FAIL, 74 NEEDS-REVIEW,
and 6 SKIP. After the current deterministic rerun, the reconciled working-tree ledger is 42 PASS, 0 FAIL,
70 NEEDS-REVIEW, and 6 SKIP; clean-release certification and full live-boundary certification remain open. The findings include an **unverified credential-exposure assertion** (no exact
source transcript or exposure location was retained), 32 measured quality-growth entries, initial scripts/CLI regressions now corrected, duplicate `v0.0.23` changelog headings
now reconciled, and previously incomplete lint/format/audit gates now green under the current working-tree rerun. The unresolved rows additionally cover live protocol/ECHO behavior, interactive
design-system workflows, provider-safe configuration, SDK compatibility, graph/browser behavior, isolated packaging,
TUI modes/recovery, and reproducible performance measurements.

This master FID defines the smallest auditable program that can move the report to a defensible 100% result without
converting unavailable evidence into PASS. It separates product defects from environment limitations, requires a
controlled local/stub provider instead of real credentials, uses a cryptographically provable disposable repository copy
for package/build tests, and ends with a clean-baseline certification run. Every claim must retain direct exit status,
duration, redacted output, artifact identity, and cleanup proof.

---

## Environment and ground truth

- **OS:** Windows / Git Bash / x86_64
- **Runtime:** Bun `1.3.14`; TypeScript monorepo; pending package version `0.0.23`
- **Ground-truth report:** `dev/scratchpad/v0.0.23-comprehensive-live-test-report.md`
- **Test contract:** `dev/test-prompts/v0.0.23-comprehensive-live-test.md`
- **Governing protocol:** `dev/echo-v0.1.2-single-agent.md`, reread 0-EOF before this FID was drafted
- **Repository state at discovery:** Dirty working tree with staged, unstaged, deleted, renamed, and untracked files
- **Baseline identity:** `HEAD` `98acc253623050d9518ef528a8f7975057262948`; status-list SHA-256 `a66d1ca71f5c9021e064d9954b02ebbd31a5020259facc36599ecad2d1a00a09`; tracked-diff SHA-256 `5e53b9a052d63caad68912181fe2a33fd285d33c7cc2b6062dfdf0e9ec10a38c`
- **Current evidence boundary:** Working-tree evidence only; clean-release certification has not been established
- **Provider policy:** No real provider request and no real credential may be used by this program
- **Browser state:** System Chrome channel is installed and the graph-export file-protocol suite now passes; the
  Playwright-managed executable remains unavailable, so managed-browser-specific coverage is not claimed
- **FID location:** Active FIDs live in `dev/fids/`; this record must remain active until implementation and independent
  certification are complete

### Ground-truth baseline

The current report is the only accepted baseline for this program. Its ledger contains 118 rows with the following
status totals:

| Status | Count | Meaning |
| --- | ---: | --- |
| `PASS` | 42 | Evidence met the row's stated boundary; scope remains limited to its Type column |
| `FAIL` | 0 | No current ledger row retains an unresolved reproducible failure after the deterministic rerun |
| `NEEDS-REVIEW` | 70 | Required boundary was not completed or evidence was insufficient |
| `SKIP` | 6 | The prompt required isolation or an unavailable boundary prevented execution |
| **Total** | **118** | Every numbered row accounted for |

The prior report's alleged raw credential values are intentionally not copied here. Because no exact source transcript,
command, timestamp, or externally verifiable exposure location was retained, the assertion is **not a confirmed compromise**.
It remains a secret-safe handling verification item; rotation is required only if the operator independently confirms an
actual value escaped the intended local `.env` boundary.

---

## Detailed description

### Problem

The live-test run could not establish release readiness. Several failures are directly actionable, while many rows need
additional live evidence rather than code changes. Treating all rows as one implementation defect would create scope
confusion; treating them as environment noise would create false certification.

### Expected behavior

A completed program must produce a new redacted report in which every applicable V023 row has objective evidence and no
row is silently promoted from unavailable evidence. For the requested 100% target, the certification denominator is all
118 required rows: `PASS = 118`, `FAIL = 0`, `NEEDS-REVIEW = 0`, and `SKIP = 0`. A row may be reclassified as not applicable
only through an explicit operator-approved change to the test contract; it may not be removed merely because it is hard
to run.

The final certification must also show:

- no unresolved credential exposure or unsafe credential-handling path;
- all repository gates green with direct exit `0`;
- all failed functional paths fixed or their stale test contract corrected with regression evidence;
- all live runtime, TUI, browser, provider-stub, SDK, packaging, and performance boundaries exercised;
- a clean disposable baseline with stable manifest identity and pre/post source/worktree proof;
- no commit, tag, push, publication, deployment, or remote release action during verification.

## Impact Assessment

### Affected Components

- Release scripts, quality baseline, repository validation, lint/format configuration, and `CHANGELOG.md`
- FID/LEARNINGS validators and audit-evidence/report generation
- CLI/agent-runtime protocol boot, ECHO enforcement, design-system commands, and session state
- Provider registry/configuration, SDK RunState/headless paths, and propagation limits
- Knowledge-graph export/browser harness, package wrappers, and TUI/runtime cleanup

### Risk Level

- [x] Critical: unresolved security evidence boundary and inability to establish release certification
- [x] High: multiple user-visible/runtime/distribution boundaries remain unverified
- [ ] Medium: feature degraded, workaround exists
- [ ] Low: minor issue, cosmetic, or edge case

### Root causes and issue register

| Ref | Current evidence | Classification | Owning workstream |
| --- | --- | --- | --- |
| `V023-006 / F-01` | Historical report asserts credential-shaped values were printed, but no exact source transcript or exposure location is retained | `SECURITY/PRIVACY / UNVERIFIED` | W1 |
| `V023-010`, `V023-012`, `F-02` | Quality report and repository validation initially failed on 30 ratchet increases; the current deterministic gates now pass under the governed 32-entry measured-growth process | `GOVERNANCE` / possible implementation debt | W2 |
| Scripts suite | Pre-push E2E path was corrected; the full scripts suite now passes, including the quality-ratchet regression tests | `RESOLVED DETERMINISTICALLY` | W2 |
| CLI suite / `F-03` | DiffViewer fixture now derives the initialized runtime theme background; focused test passes | `RESOLVED IN WORKING TREE` | W2 |
| `V023-019 / F-05` | Duplicate semver headings reconciled to one release selector; focused preview exits 0 | `RESOLVED IN WORKING TREE` | W2 |
| Lint and format gates | Historical lint/format findings were corrected; repository-wide ESLint, Markdownlint, and Prettier checks now pass | `RESOLVED DETERMINISTICALLY` | W2 |
| `V023-017`, `V023-018`, `V023-020`, `V023-021` | Working-tree audit evidence now passes; diagnose/clean and byte-identity boundaries remain separate review items | `WORKING-TREE PASS / CLEAN REVIEW` | W3 and W10 |
| `V023-030`, `V023-035`–`V023-038` | FID inventory/fixture coverage not fully re-audited | `GOVERNANCE` | W3 |
| `V023-049`–`V023-059b` | Prebuild/env absence, embedded fallback, mode matrix, gate clearing, and restoration not live-proven | `NEEDS-REVIEW` | W4 |
| `V023-070`–`V023-080` | EHEL reachability, scanner lifecycle, provenance, receipts, and bounded correction lack live-turn proof | `NEEDS-REVIEW` | W5 |
| `V023-090`–`V023-110` | Interactive design commands, wizard, persistence, clone, reset, natural-language boundary, and live correction incomplete | `NEEDS-REVIEW` | W6 |
| `V023-122`–`V023-125` | Provider rejection, migration, keyless health, and no-network routing not exercised | `NEEDS-REVIEW` | W7 |
| `V023-140`, `V023-142`–`V023-150` | Graph/export suites and a system-Chrome file-protocol subset pass; remaining artifact/control/browser assertions remain unverified | `PARTIAL PASS / NEEDS-REVIEW` | W8 |
| `V023-161`–`V023-166` | RunState compatibility, bounded propagation, headless runtime, metadata, and embedder behavior incomplete | `NEEDS-REVIEW` | W7 |
| `V023-180`–`V023-188` | Packaging and wrapper tests skipped without isolated repository proof | `PACKAGING` / `NEEDS-REVIEW` | W9 |
| `V023-200`–`V023-209` | TUI modes, slash recovery, cancellation, interruption, and terminal cleanup not observed | `NEEDS-REVIEW` | W10 |
| `V023-005` and Phase 12 | No reproducible RSS or three-warm-trial performance matrix | `NEEDS-REVIEW` | W10 |

### Evidence already established

The following are accepted as narrow evidence, not as full certification:

- Version/manifests identify `0.0.23`; Bun reports `1.3.14`.
- Hygiene, protocol-bundle, provider-reference, design-system drift, and learnings checks passed in the prior run.
- Headless CLI help/version and valid/invalid design-input file/stdin probes were exercised in isolated user/config roots.
- Graph-export, SDK, common, agent-runtime, and several workspace suites passed in the prior run.
- The prior report itself passed structural review: 118 seven-column ledger rows, reconciled totals, Prettier, Markdownlint,
  and a raw-credential-pattern scan.

These facts must be retained as baseline evidence and rechecked after remediation; they cannot substitute for the missing
live boundaries below.

---

## Program objectives

1. Resolve the unverified security-handling assertion and prevent unsafe probe output without reproducing secrets.
2. Restore green repository, release-preview, lint, format, scripts, and CLI gates.
3. Re-audit FID/LEARNINGS governance and make evidence/closure semantics reproducible.
4. Prove protocol boot and ECHO enforcement through controlled runtime paths, not source-only claims.
5. Prove the design-system interactive lifecycle and live contract enforcement.
6. Prove provider and SDK behavior with deterministic local/stub fixtures only.
7. Execute the graph/browser checks offline with the required browser artifact available.
8. Execute packaging/build/install/wrapper checks in a separate, proven disposable repository copy.
9. Exercise CLI modes, recovery, terminal cleanup, and performance with isolated TUI sessions.
10. Produce a final evidence packet and certify only a clean, complete, reproducible result.

---

## Workstream register and dependencies

The workstreams below are logical ownership boundaries. If implementation changes cross a boundary, create a linked child
FID before expanding scope; do not hide new product defects inside this master.

| Order | Workstream | Scope | Main rows | Depends on | Deliverable |
| ---: | --- | --- | --- | --- | --- |
| 1 | **W1 Security verification** | Verify the historical assertion and harden test probes to `SET/UNSET` only; rotate/revoke only if an actual exposure is independently confirmed | `V023-006`, `F-01` | Operator evidence only if independently confirmed | Exposure disposition and secret-safe probe tests |
| 2 | **W2 Gate and defect remediation** | Quality baseline/debt, scripts path, DiffViewer assertion, changelog selector, ESLint/Markdownlint/Prettier | `V023-010`, `012`, `019`; gate matrix | W1 for safe logs | All direct gates exit 0 with regression tests |
| 3 | **W3 Governance and evidence** | FID inventory, LEARNINGS fixtures, audit receipt inspection, dirty/clean classification, report generator parity | `V023-017`, `020`, `021`, `030`, `035`–`038` | W2 | Reproducible redacted evidence packet |
| 4 | **W4 Boot and grounding** | Absent `.env.local`, local/embedded fallback, generated copies, all supported mode gates, restoration identity | `V023-049`–`059b` | W3 | Controlled transcripts and state hashes |
| 5 | **W5 ECHO enforcement** | Turn-end reachability, final-content reconstruction, policy/provenance boundaries, receipts, bounded correction | `V023-070`–`080` | W4 | Runtime tool/turn evidence plus focused regressions |
| 6 | **W6 Design-system UX** | Interactive commands, wizard, cancel/save/activate, persistence, clone, drafts, reset, natural-language confirmation, live scanner | `V023-090`–`110` | W5; W2 | TUI transcripts, files/diffs, receipts, restart proof |
| 7 | **W7 Provider and SDK** | No-network provider fixtures, keyless errors, migration, old RunState, propagation, headless and metadata paths | `V023-122`–`125`, `161`–`166` | W4; W6 for active design metadata | Stub transcripts, compatibility fixtures, bounded errors |
| 8 | **W8 Graph and browser** | Graph refresh/export identity, artifact/resource budget, Playwright install, offline `file://` interactions | `V023-140`, `142`–`150` | W2; isolated browser environment | Artifact hashes, browser assertions, console/network evidence |
| 9 | **W9 Packaging and wrappers** | Local pack/extract/install/typecheck/tests, full/staging/free wrapper parity, generated markers, test discovery | `V023-180`–`188` | W2, W4, W6, W8 | Clean-copy pack/install manifest and smoke evidence |
| 10 | **W10 CLI, performance, final certification** | TUI modes/recovery, terminal cleanup, high-resolution trials, complete 118-row rerun, clean certification | `V023-005`, `200`–`209`, all rows | W1–W9 | Final report and clean-certification manifest |

### Authoritative dependency edges

```text
W1 → W2 → W3 → W4 → W5 → W6 → W7
             ├──────────────→ W8 → W9
             └──────────────────────→ W10
W6 → W7
W1–W9 → W10
```

W1 is an operator security prerequisite. W2 must stabilize gates before later evidence is interpreted. W3 owns the
reporting contract. W4 and W5 establish the runtime boundary consumed by design and SDK work. W8 and W9 must use isolated
artifacts. W10 is last and may not certify a result if any prerequisite is unresolved.

---

## Non-goals and hard boundaries

- No real provider keys, API tokens, personal environment dumps, or credential-shaped values in commands, fixtures, logs,
  transcripts, screenshots, receipts, FIDs, or reports.
- No automatic credential rotation by an agent. Rotation/revocation is an operator action only if an actual exposure is
  independently confirmed; no secret value may be recorded.
- No commit, tag, push, npm/GitHub publication, deployment, remote release, or production mutation.
- No testing in the real checkout when a command can create installs, builds, hooks, lockfile changes, databases, generated
  bundles, or wrapper artifacts.
- No use of `tail`, `grep`, or other pipelines that hide the command's exit code.
- No browser PASS when the browser executable cannot launch.
- No model-dependent PASS from static source or unit tests. Use a deterministic local/stub provider or classify the row.
- No rewriting of historical FIDs, archived correspondence, dated summaries, or prior reports to make counts look green.
- No silent deletion of the prior report, dirty working-tree artifacts, or unrelated files.
- No quality-baseline update merely to suppress findings. Baseline changes require measured classification, rationale, and
  regression protection.
- No change to the 118-row denominator without an explicit test-contract amendment and operator approval.

---

## Proposed solution and implementation contract

### Approach

Execute W1–W10 in dependency order, preserving the 118-row denominator and separating product defects from environment
limitations. Remediation work may change source only after this FID is operator-approved and the relevant workstream has
been independently audited. Verification work uses disposable boundaries, direct exits, redacted evidence, and a final
clean identity-bound run.

### Steps

1. Complete operator-only security containment before producing further provider-related evidence.
2. Clear direct repository/gate failures and classify quality debt without weakening the policy.
3. Stabilize governance/evidence contracts, then prove protocol and ECHO runtime behavior with deterministic fixtures.
4. Exercise design UX, provider/SDK, browser/graph, packaging, TUI, and performance boundaries in isolated environments.
5. Rerun all 118 rows and certify only when every row and final gate meets the closure matrix.

### Verification

Each workstream must provide direct command output or captured runtime artifacts, exit codes, durations, redaction proof,
identity/hash evidence, and cleanup proof. Static evidence is labeled `STATIC`; unit evidence is labeled `EXECUTABLE`; live
behavior includes the command/transcript/file/receipt that observed it. Every PASS is independently reviewed against its
row contract by the verifier and adversary; a report generator may reject malformed or unsupported claims but does not
replace human evidence review.

### W1 — Security verification

1. Preserve the historical report row as written, but verify whether any concrete transcript, command, timestamp, or
   external record identifies an actual credential value leaving the intended local `.env` boundary. The current repository
   evidence identifies none; do not infer compromise from the phrase "credential-shaped" alone.
2. Audit current shell history, captured transcripts, temporary files, receipts, and report artifacts for secret-shaped
   content without printing or copying values. Quarantine only confirmed disposable evidence, preserving immutable history
   where policy requires it.
3. Change all test runners and prompts to report only presence state (`SET`/`UNSET`) and provider name. Add tests that fail
   if values are printed.
4. Prove no credential was used by this program through environment allowlisting and provider-call logs where available.
5. If the operator independently confirms an actual value escaped the intended local boundary, the operator—not an agent—
   performs rotation/revocation and supplies only a redacted confirmation or safe external reference.

**Acceptance:** the current evidence disposition is explicitly recorded as `UNVERIFIED — no concrete exposure located`,
secret-shaped scan is clean for current deliverables, negative/positive probe tests prove values never enter stdout/stderr/
receipts, and no real provider request occurred. Rotation is not a prerequisite unless an actual exposure is independently
confirmed. Without either a verified no-exposure disposition or operator-supplied confirmation of a real incident, W1 remains
`NEEDS-REVIEW` and 100% certification is blocked.

### W2 — Gate and defect remediation

1. Reproduce `bun run quality:report` and `bun run validate:repository` directly. Classify each of the 32 measured growth entries as
   intended changed surface, accidental regression, generated/test exception, or decomposition work.
2. Fix code/decompose files for accidental regressions. Update the checked-in baseline only for approved intended debt,
   with a reasoned ledger and a test that rejects unapproved growth. Do not lower the quality bar.
3. Fix scripts test path resolution so the pre-push tests invoke the intended `pre-push-scan.ts` from any supported cwd.
   Re-run both pushed-secret rejection and clean-push acceptance tests.
4. Reproduce the DiffViewer failure with expected/actual RGB values. Correct implementation if behavior is wrong; otherwise
   correct a stale platform-sensitive fixture only with a deterministic color test and documented rendering contract.
5. Reconcile `CHANGELOG.md` to one deterministic current `v0.0.23` release selector while preserving historical release
   text; add a regression test for duplicate-heading handling.
6. Fix all reported ESLint warnings, Markdownlint findings, and Prettier files. Run each command independently and capture
   direct exit codes.

**Acceptance:** quality, validation, scripts, CLI, ESLint, Markdownlint, Prettier, and release preview all exit 0; exact
failure tests exist; no unrelated historical text is rewritten.

### W3 — Governance and evidence

1. Re-inventory active/archive FIDs against `dev/fids/README.md`, filename IDs, statuses, relationships, dependencies,
   cycles, and changelog/archive claims. Preserve historical contradictions and record corrective index entries only.
2. Run the chronology, supersession, stable-reference, canonical-rule, privacy, and no-attribution fixture suites directly.
3. Run audit evidence in working-tree and clean modes. Inspect the redacted receipt, manifest identity, transcript hashes,
   timeout/spawn classifications, staged/unstaged/untracked/deleted/renamed/ignored counts, and cleanup result.
4. Require the report generator to reject missing evidence, malformed seven-column rows, status-total mismatch, raw secrets,
   and unsupported PASS claims.

**Acceptance:** FID/LEARNINGS inventory is internally consistent; all focused governance tests exit 0; evidence is deterministic
and redacted; dirty-tree evidence cannot be labeled clean certification.

### W4 — Protocol boot and grounding

Use a disposable copy or fixture boundary. Do not remove files from the real checkout.

1. Clear `.env.local` and `NEXT_PUBLIC_*` only inside an isolated prebuild environment; prove before/after environment and
   generated-file identity. Verify actionable `.env.example` guidance and no raw schema crash.
2. Remove grounding files only in an isolated copy and verify local-first behavior with files present and embedded fallback
   with files absent. Confirm the single-agent marker is never injected into harness context.
3. Exercise generated bundle idempotence and condensed-copy parity.
4. Start fresh HYBRID/default, STRICT, ANALYZE, SCAFFOLD, PLAN, and headless sessions with a deterministic provider fixture.
   Verify tool gating, first-turn clearing, ungrounded-completion steering, bounded retry/disarm, and no infinite loop.
5. Read grounding through the normal path and prove synthetic embedded reads do not write or inject user-cwd files.

**Acceptance:** every applicable mode produces a redacted transcript and exit result; local/embedded source is explicit;
state restoration is byte/state verified; all gate lifecycle claims have runtime evidence.

### W5 — ECHO enforcement

1. Prove the production caller for turn-end evaluation with both call-graph search and a live controlled completion.
2. Exercise compliant and unauthorized visual writes, complete final-content scanning, patch reconstruction, unavailable
   content fail-closed behavior, custom/MCP provenance, typed execution-policy overrides, dedicated receipts, and bounded
   correction.
3. Confirm design-contract errors are distinct from ECHO Law 15 and include path, active-system identity/hash, rule, and
   remediation.
4. Capture the resulting file/diff plus transcript/tool record plus receipt for model-dependent rows; one evidence type alone
   cannot produce PASS.

**Acceptance:** the evaluator is reached exactly at the intended lifecycle point; writes are accepted/blocked/reviewed as
specified; no broad dev-mode bypass exists; correction is bounded and observable.

### W6 — Design-system interactive UX

Run in a disposable project with isolated `HOME`, `USERPROFILE`, and config variables.

1. Exercise `/design current`, `list`, `use`, `create`, `edit`, `import`, `validate`, `drafts`, `resume`, `discard`, and
   `reset`/`reset --all`.
2. Verify invalid IDs, traversal, restart persistence, project/user precedence, cancel-before-save, cancel-after-preview,
   save-without-activation, explicit activation, built-in clone-before-edit, revision/history, atomic persistence, and
   failed-commit rollback.
3. Exercise the documented natural-language imperative grammar with positive, negative, ambiguous, and confirmation-refusal
   fixtures. Ordinary design discussion must never write.
4. Exercise headless file/stdin schema through the same service; omitted `activate`, unknown schema, malformed fields, and
   unsafe paths must return bounded machine-readable errors and no partial file.
5. Exercise active-contract propagation and live compliant/unauthorized visual writes through W5.

**Acceptance:** each workflow has a redacted TUI transcript, resulting file/diff or explicit no-mutation proof, and receipt
where applicable; built-ins remain immutable; failed saves leave the prior valid version active.

### W7 — Provider-safe runtime and SDK compatibility

1. Add or reuse a deterministic no-network provider fixture that emits scripted tool/text turns and bounded timeout/error
   responses; it must never require a real key.
2. Test unknown provider/model rejection, active-provider migration, keyless health/config guidance, and selected-provider
   routing against the fixture.
3. Deserialize a representative old RunState fixture and compare preserved fields; exercise bounded child depth/fan-out,
   headless valid/error paths, active design metadata, and non-ECHO SDK embedder behavior.
4. Separate provider latency from local parsing/persistence/startup measurements.

**Acceptance:** every provider/runtime row has fixture identity, direct exit, safe stderr, and preserved-state/artifact proof;
no test uses a real network credential.

### W8 — Graph and browser

1. Run graph refresh in an isolated read-only project, remove generated databases/locks afterward, and prove no stale lock.
2. Generate the export twice with normalized timestamps; compare hashes, artifact size, embedded resource presence, and
   final-message cardinality.
3. Install or use the repository-pinned Playwright browser only in the isolated test environment. If installation is blocked,
   classify the environment limitation and do not claim 100%.
4. Run the offline `file://` browser suite with network interception and console collection. Verify search, navigation,
   fallback, breadcrumbs, controls, keyboard/ARIA, reduced motion, resource budget, and no external requests.

**Acceptance:** graph and browser rows have artifact hashes plus browser results; record the exact Playwright executable,
browser version, installation source, launch command, network-interception result, console-error result, and resource-budget
result. There must be zero unexpected console/network errors; a missing browser, unavailable installation source, or
unrecorded browser identity means the program cannot claim 100%.

### W9 — Packaging and wrappers

1. Create a disposable repository copy with an independent `.git`/index or proven local clone. Record source commit,
   worktree fingerprint, path, and isolation markers before any install/build.
2. Run frozen install, applicable typechecks, focused tests, local pack/extract, and wrapper smoke tests only there.
3. Validate full, staging, and Savant-Free wrapper manifests/resources, generated protocol/design markers, package size, and
   manual E2E test-discovery exclusion.
4. Compare extracted resources and manifests against the source identity; remove the copy and prove cleanup.

**Acceptance:** V023-180–188 all have direct outputs and exit 0 where applicable; package artifacts are installed and run from
extraction, not source; no real checkout lockfile/hooks/generated files change.

### W10 — CLI, performance, and final certification

1. Use `tmux` or an approved equivalent with isolated config to exercise HYBRID, STRICT, ANALYZE, SCAFFOLD/PLAN, help,
   diagnostics, history/new/mode/permissions, invalid slash commands, cancellation, rapid input, interruption, and terminal
   raw/alternate-screen cleanup.
2. Record RSS and high-resolution timings for startup/version, protocol boot/read, design list/current/validation, graph
   export, headless valid/invalid, release preview/diagnose, active-contract turn, and enforcement correction. Use one
   baseline and at least three warm trials where meaningful; report median, p95/max, variance, and trial count.
3. Re-run all 118 V023 rows after all workstreams. Generate the final report with exact seven-column ledger, failure output,
   timing table, scorecard, cleanup proof, and separate verdicts.
4. Run the final gate matrix in a clean disposable clone or clean commit state. Record the exact source commit, worktree
   fingerprint, browser executable/version, package-copy identity, and generated manifest hash. Generate
   `audit:evidence --clean`; require clean certification to refuse any dirty or identity-mismatched state.

**Acceptance:** 118/118 PASS, zero unresolved statuses, all gates exit 0, performance evidence is reproducible, cleanup passes,
and the final manifest explicitly certifies the exact tested source identity. If any condition is unavailable, final verdict
remains `NEEDS-REVIEW`.

---

## Cross-workstream invariants

1. **No false PASS:** static or unit evidence cannot satisfy a row requiring live behavior.
2. **No secret disclosure:** output reports only presence and redacted classifications; secrets never enter evidence.
3. **Direct exits:** every command is run independently; pipelines cannot mask failure.
4. **Isolation:** destructive/install/build/browser/provider operations occur only in disposable boundaries.
5. **Reproducibility:** identical inputs produce stable manifests, hashes, normalized output, and ordered summaries.
6. **Call graph:** every new or repaired runtime entry point has a production caller and a regression test.
7. **History:** historical records remain immutable; current corrections use explicit index/changelog updates.
8. **Rollback:** failed persistence, cleanup, or restoration leaves the previous valid state active and reports the failure.
9. **Evidence triad:** model-dependent PASS requires transcript/tool record plus resulting artifact/diff or receipt, as applicable.
10. **Certification boundary:** working-tree evidence, clean evidence, and release certification are distinct statuses.
11. **Scope control:** newly discovered independent defects become linked FIDs rather than silent master-scope expansion.
12. **No release side effects:** successful verification never implies publication or deployment authority.

---

## Verification matrix for final closure

| Gate | Required proof | Closure condition |
| --- | --- | --- |
| Security | Exposure disposition; secret-safe probe tests; no raw values | W1 PASS |
| Quality/debt | Classified 32 measured entries; approved ceilings with rationale and ratchet regression | W2 PASS |
| Scripts/CLI | Named failures reproduced and fixed; direct suites exit 0 | W2 PASS |
| Release selector | Exactly one deterministic current heading; preview exit 0 | W2 PASS |
| Governance | FID/LEARNINGS inventory and fixtures | W3 PASS |
| Audit evidence | Redacted deterministic receipt; dirty/clean classification | W3 PASS |
| Protocol | Env, fallback, mode, gate, restoration transcripts | W4 PASS |
| ECHO | Live reachability, scanner, receipts, correction | W5 PASS |
| Design UX | TUI lifecycle, persistence, clone, reset, live contract | W6 PASS |
| Provider/SDK | No-network fixture, compatibility, bounds, metadata | W7 PASS |
| Graph/browser | Artifact identity, offline browser assertions | W8 PASS |
| Packaging | Proven isolated copy, pack/extract/install/wrapper parity | W9 PASS |
| CLI/performance | Mode/recovery/cleanup matrix and three-warm-trial timings | W10 PASS |
| Final report | 118 rows, 118 PASS, all required sections, redacted | W10 PASS |
| Clean certification | Exact source identity, `audit:evidence --clean`, no dirty delta | W10 PASS |

---

## Perfection Loop

### Loop 1 — RED

- **RED:** The initial live report identified 2 direct failures, 74 incomplete boundaries, and 6 skipped isolation-dependent
  checks. Focused remediation corrected the pre-push path, DiffViewer fixture, release selector, and deterministic repository
  gates. The remaining scope spans security, governance evidence, protocol boot, ECHO enforcement, design UX, providers,
  providers, SDK compatibility, graph/browser, packaging, CLI modes, and performance.
- **GREEN:** Created ten bounded workstreams with a dependency graph. W1 contains credential containment; W2 contains direct
  gate defects; W3 owns evidence; W4–W10 own each missing runtime/distribution boundary. Defined 118/118 as the explicit
  target and prohibited environment limitations from being mislabeled product PASS.
- **AUDIT:** Initial document audit checked the report ledger, test prompt, single-agent protocol, FID template, prior
  master-FID patterns, and current FID directory. No production file or release artifact was changed by this planning pass.
- **ADVERSARIAL:** Challenged whether one FID could hide scope. The workstream register, dependencies, non-goals, and
  linked-child rule prevent silent expansion. Security and release actions remain operator-gated.
- **CHANGE DELTA:** New planning FID only.

### Loop 2 — Independent audit and self-correction

- **RED:** Independent review must challenge denominator integrity, workstream ownership, credential remediation claims,
  browser/package environment assumptions, direct-exit evidence, test-contract changes, and whether “100%” is achievable
  without falsifying unavailable rows.
- **GREEN:** The FID requires all 118 rows to remain in the denominator, supplies a deterministic local/stub-provider path,
  a proven isolated repository-copy path, a pinned browser requirement, explicit operator-only rotation only for a confirmed
  incident, and a final clean-certification gate. It distinguishes `PASS`, `FAIL`, `NEEDS-REVIEW`, `SKIP`, working-tree evidence, and clean
  certification.
- **AUDIT:** The final document must be reviewed against every report finding and every required report section. Required
  evidence is exact command output or captured runtime artifact; source-only claims remain labeled static.
- **ADVERSARIAL:** No workstream may close because a test was skipped, a provider timed out, Chrome was installed but
  Playwright was not, or a dirty-tree gate happened to pass. Any unavailable prerequisite blocks the 100% claim.
- **CHANGE DELTA:** Planning corrections only.

### Loop 3 — Final convergence

- **RED:** Final challenge targets hidden gaps: operator credential rotation cannot be agent-verified, approved quality-growth
  ceilings can mask debt if not measured, browser installation can mutate the wrong environment, packaging can accidentally use source files,
  TUI evidence can be asserted without transcript artifacts, and report totals can drift from the ledger.
- **GREEN:** Added explicit operator evidence without secret values; classified baseline work as measured remediation rather
  than automatic acceptance; required isolated browser/package roots and source-vs-extracted artifact identity; required
  transcript + artifact/receipt evidence for model-dependent rows; and required a generated report validator that rejects
  malformed rows, count mismatches, raw credentials, and unsupported PASS claims.
- **AUDIT:** The FID is converged as a planning contract: every report domain and unresolved row family has one owner,
  dependencies are acyclic, acceptance criteria are observable, and final certification is fail-closed. Implementation and
  final command evidence remain intentionally pending.
- **ADVERSARIAL:** The plan does not claim 100% today. It explicitly says 100% is impossible while W1–W10 evidence or
  required environment prerequisites are unavailable. Historical records remain untouched, and no release authority is
  implied.
- **CHANGE DELTA:** Final planning-only convergence; no production implementation changed.

### Loop 4 — Fresh RED, GREEN, AUDIT, and ADVERSARIAL correction (2026-08-12)

- **RED:** A fresh review found two boundary risks: the FID itself is an untracked working-tree planning artifact, so its
  existence cannot be treated as durable repository certification; and Nova's review needed a dedicated planning-only
  response contract rather than an implied implementation approval. The review also required browser identity/install
  evidence to remain explicit at the W8 acceptance boundary.
- **GREEN:** Recorded the exact current `HEAD`, status-list hash, and tracked-diff hash in Environment and ground truth;
  retained the explicit working-tree-only boundary; kept implementation, closure, archive, and release actions operator-
  gated; and defined the separate Nova request as a planning audit with explicit `PASS`, `FAIL`, and `NEEDS-REVIEW`
  targets. W8 now requires the exact Playwright executable, browser version, installation source, launch command,
  network-interception result, console result, and resource-budget result.
- **AUDIT:** The corrected FID passed direct Prettier and Markdownlint checks, structural required-section checks, W1–W10
  uniqueness, forbidden-attribution scanning, planning-only status checks, acyclic dependency validation, and
  `bun test scripts/fid-ledger.test.ts` (`5 pass / 0 fail`). These are document and governance checks only; no product
  implementation or release gate is claimed.
- **ADVERSARIAL:** Independent review returned `PASS`: prior template caveats are resolved; the denominator remains 118;
  all report issue families have owners; browser and package limitations cannot be converted into PASS; any rotation remains
  operator-only and conditional on a confirmed incident; and `verified` remains planning convergence rather than implementation closure. The FID remains
  active and untracked working-tree evidence pending operator and Nova planning decisions.
- **CHANGE DELTA:** Planning-document corrections only; no production source, package, generated artifact, release state, or
  historical record changed.

### Loop 5 — Final SELF-CORRECT and convergence confirmation (2026-08-12)

- **RED:** The final independent review found two non-blocking evidence-hardening issues: the Nova navigation examples
  used a bounded `sed -n '1,999p'` range instead of an explicit EOF-safe read, and W1 could be misread as requiring an agent
  to prove or perform credential rotation.
- **GREEN:** Replaced the Nova navigation examples with `cat` full-file reads and clarified W1: rotation/revocation remains
  operator-only and conditional on a confirmed incident; a redacted operator confirmation or safe external reference is
  required only when such an incident exists, while the present unverified disposition remains explicit.
- **AUDIT:** Fresh post-edit evidence was captured after these corrections: `bunx prettier --check` on the master and Nova
  request both exited `0`; `bunx markdownlint` on both files exited `0`; the structural parser reported
  `missing=[]`, unique workstreams `W1`–`W10`, `forbiddenCount=0`, `operatorOnly=true`, `eofSafe=true`,
  `planningOnly=true`, `loop5=true`, and `dependencyAcyclic=true` with exit `0`; and
  `bun test scripts/fid-ledger.test.ts` reported `5 pass / 0 fail` with exit `0`. No production implementation or release
  action is authorized by this loop.
- **ADVERSARIAL:** The correction preserves the no-secret boundary, avoids fabricated external evidence, keeps Nova's scope
  planning-only, and does not convert the untracked FID into durable certification.
- **CHANGE DELTA:** Documentation-only evidence-boundary correction; no source, package, generated artifact, release state,
  or historical record changed.

---

### Missed Questions

> Historical planning questions below intentionally retain their original wording; current execution evidence is recorded in the report addendum. The quality-growth count is now 32 measured entries.

1. **Does “100%” mean all features work or all report rows have evidence?** → For this FID it means both: all 118 required
   rows have objective PASS evidence and the product/runtime gates they represent are green. A test-contract amendment is
   required to change the denominator.
2. **Where exactly was the alleged credential exposure?** → No exact transcript path, command, timestamp, source line, or
   externally verifiable location is retained. The claim is therefore `UNVERIFIED`, not confirmed compromise.
3. **When is credential rotation required?** → Only when the operator independently confirms an actual value escaped the
   intended local `.env` boundary. Rotation is operator-only; no key value belongs in evidence.
4. **Can credential rotation be proven without recording the key?** → Yes, if an actual incident is confirmed: record only
   provider/operator confirmation or a safe external reference and secret-safe scan output; never record the value.
5. **Should the quality baseline be updated immediately?** → No. Classify the 31 measured growth entries first; remediate accidental
   growth and approve only intentional debt with a measurable ledger, non-empty rationale, current-line-count check, and ratchet test.
6. **Is the DiffViewer failure definitely a product regression?** → Not yet. Capture expected/actual values and determine
   whether the implementation or platform-sensitive fixture owns the defect.
7. **Can the missing Playwright browser be called a product failure?** → No. It is an environment blocker until the pinned
   executable is installed and the test is attempted; it still blocks 100% certification.
8. **Can a dirty working tree certify the release?** → No. It can produce working-tree evidence only. Final certification
   requires a clean, identity-bound boundary.
9. **Can real providers be used for live protocol tests?** → No. Use a deterministic local/stub provider; if one does not
   exist, add a bounded test fixture under an implementation child FID.
10. **Can packaging run in a `tmp` directory copied from the current tree?** → Only after recording independent Git/index,
   source identity, worktree fingerprint, and isolation proof. A path alone is not proof.
11. **Should skipped packaging/browser rows be removed?** → No. Resolve them or obtain explicit operator-approved test-contract
   changes; do not hide them.
12. **What if W2 discovers quality findings are unrelated pre-existing debt?** → Separate baseline debt from update
    regressions, preserve the evidence, and make the gate policy explicit; do not silently relabel current failures. The current
    governed set contains 32 measured entries, including the quality checker itself; each approved ceiling must equal or exceed
    the file's current measured line count.
13. **What is the final stopping rule?** → Stop only at 118 PASS, all gates direct exit 0, clean-certification evidence, and
    independent review. Otherwise retain `NEEDS-REVIEW` or `FAIL` with the smallest reproducible follow-up.
14. **What if a new defect appears while implementing a workstream?** → Stop scope expansion, record it, and create/link a
    new FID before proceeding.
15. **Does an untracked FID file constitute repository certification?** → No. It is current working-tree evidence only; durable
    certification requires the repository's normal tracked-state and clean-boundary process.
16. **What exactly is Nova being asked to approve?** → Planning readiness and scope coherence only. Nova's verdict does not
    authorize implementation, closure, archive movement, release, or any remote action.
17. **What if Nova cannot verify a live boundary during planning review?** → Nova must mark that target `NEEDS-REVIEW` with
    the smallest missing evidence; the plan must not convert unavailable runtime evidence into planning PASS.

---

### Code Verification Evidence

This is a planning FID; no implementation is claimed.

- [x] `dev/echo-v0.1.2-single-agent.md` read 0-EOF before drafting.
- [x] `templates/FID-TEMPLATE.md` read and followed, with forbidden attribution fields omitted per protocol.
- [x] The complete live-test prompt and report were read; all report domains and unresolved families are represented.
- [x] Current FID directory/archive conventions and prior master-FID dependency patterns were inspected.
- [x] Workstream dependencies are acyclic and W1–W10 have unique ownership.
- [x] No production source, package, generated artifact, release state, or historical record was changed by this planning FID itself; the approved remediation work was performed separately in the working tree and is documented by the current report addendum.
- [x] `git ls-files --error-unmatch dev/fids/FID-2026-0812-001-v0-0-23-live-test-remediation-master.md` returned no tracked match; the FID is explicitly untracked working-tree evidence.
- [x] Direct document checks: Prettier exit 0; Markdownlint exit 0; structure/dependency/attribution checks exit 0; `bun test scripts/fid-ledger.test.ts` reported 5 pass / 0 fail.
- [x] Approved remediation workstreams produced the current working-tree implementation/gate evidence documented in the report addendum; this planning FID itself did not author those changes.
- [ ] Final runtime/package/browser/clean-certification evidence — intentionally pending.

---

## Operator approval addendum — 2026-08-12

- **Decision:** Full program approved for implementation consideration: W1 through W10.
- **Approval meaning:** The operator authorizes execution of the bounded workstreams in the dependency order defined by
  this FID, subject to all stated acceptance criteria, isolation rules, direct-exit evidence, and stop conditions.
- **Not authorized:** Credentials remain operator-controlled; no credential value may be requested, copied, logged, or
  stored. No commit, tag, push, publication, deployment, remote release action, or unrelated artifact disposition is
  authorized by this approval.
- **Status boundary:** The FID remains `verified`, not `fixed`, `closed`, or archived. Approval does not establish product
  verification or clean-release certification. Each workstream requires implementation evidence and independent audit before
  closure; the master closes only after W10's 118/118 PASS and clean-certification gates.
- **Execution order:** W1 → W2 → W3 → W4 → W5 → W6 → W7; W8 may proceed after W2 with isolated browser evidence; W9
  follows W2/W4/W6/W8 in an isolated repository copy; W10 is final and consumes W1–W9.
- **Immediate prerequisite:** W1 first requires a bounded evidence-disposition check. The current disposition is
  `UNVERIFIED — no concrete exposure located`; no rotation confirmation is required unless the operator independently
  confirms an actual exposure. Any confirmed incident remains operator-only and must be represented only by redacted
  confirmation or a safe external reference.

## Resolution

- **Closed Date:** Not applicable — this planning FID is `verified`, not `closed`.
- **Status:** `verified` — planning convergence completed through the Perfection Loop; the FID remains a planning record while approved remediation evidence is tracked in the working-tree report addendum.
- **Fix Description:** The planning FID did not directly author production changes. Approved workstream remediation corrected deterministic gates, added governed quality-growth checks, and produced the current partial live-test evidence.
- **Tests Added:** Workstream remediation added/updated regression coverage; the planning FID itself adds no test files.
- **Verification Evidence:** Current deterministic gate evidence is recorded in `dev/scratchpad/v0.0.23-comprehensive-live-test-report.md`; clean certification and remaining live boundaries are intentionally not claimed.
- **Archived:** Not applicable. Keep active until all approved workstreams are implemented, independently verified, and the
  final clean-certification gate passes.

## Lessons learned

A comprehensive live-test result is a portfolio of evidence boundaries, not a single test-suite score. The correct path to
100% is to fix direct failures first, then prove each missing boundary in an isolated environment, and finally rerun the
entire denominator from a clean identity-bound source. Security incidents, environment limitations, stale tests, and product
defects must remain distinct even when all block release certification.

---

## Operator-directed closure addendum — 2026-08-12

- **Decision:** The operator directed closure and archive of this master FID (`clean up the fids folder`,
  2026-08-12) after the A-Z v0.0.23 harness live-test program reached ledger closure and the full
  release-readiness review passed.
- **Evidence basis:** `dev/scratchpad/az-v0.0.23-harness-live-test-report.md` v2.1.0 reconciles its
  85-row table exactly (46 PASS + 33 OPERATOR-CONFIRMED + 1 FAIL\* + 5 SKIP, **0 NEEDS-REVIEW**). The
  single FAIL\* (AZ-018, `release:public:diagnose`) is honestly labeled: it failed during the run, its
  root cause was found and fixed after the run (markdownlint gate + prettier subprocess allowlist), and
  it was re-verified EXIT=0 on 2026-08-12. The 5 SKIP rows (AZ-094–098) are pre-fork verified browser
  matrix rows. The in-harness agent cannot drive the interactive TUI surface from inside itself, so the
  33 interactive rows are operator-executed and labeled `OPERATOR-CONFIRMED` rather than converted to
  unobserved PASS.
- **Release-readiness review (2026-08-12):** all deterministic gates exit 0 — 11-workspace typecheck,
  5,014 workspace tests (0 failures), ESLint `--max-warnings 0`, Markdownlint, Prettier,
  `validate:repository`, `quality:report` (1,304 baselined files), protocol-bundle/provider-docs/
  design-systems/learnings/hygiene drift checks, `audit:evidence` (correctly classified
  `WORKING_TREE_EVIDENCE`), `release:public:diagnose` ("Diagnostic gates passed"), and
  `release:public:preview` (mutation-free). Version sync is exact across all 12 workspaces and the
  CHANGELOG has exactly one `v0.0.23` heading.
- **Post-run housekeeping (2026-08-12):** dead `buffbench` script removed, stale committed
  `evals/v2/reports/` artifacts untracked and ignored, undocumented slash commands and feature
  write-ups added to `docs/features.md`, and `docs/index.md` feature bullets updated.
- **What this closure does NOT authorize:** a release, tag, push, publication, deployment, credential
  use, or clean-release certification. The working tree remains dirty and uncommitted; clean
  certification (`audit:evidence --clean`) requires the tree to be committed first and remains a
  separate operator action.
- **Lifecycle:** status transitioned `verified` → `closed` and the file is moved to
  `dev/fids/archive/FID-2026-0812-001-v0-0-23-live-test-remediation-master.md`. The closure is
  recorded in `dev/fids/README.md`, `dev/fids/archive/README.md`, and `CHANGELOG.md`. Historical
  content is preserved; no section was rewritten.
