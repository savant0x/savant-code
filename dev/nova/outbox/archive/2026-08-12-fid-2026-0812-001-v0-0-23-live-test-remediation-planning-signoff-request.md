<!-- markdownlint-disable MD013 -->

# Nova Planning Sign-off Request — v0.0.23 Live-Test Remediation Master

**Date:** 2026-08-12
**To:** Nova — independent third-party ECHO auditor
**Scope:** Planning convergence review for `FID-2026-0812-001-v0-0-23-live-test-remediation-master.md`
**Status:** AWAITING NOVA REVIEW
**Priority:** Critical — implementation remains blocked pending operator decision and independent planning review
**Method requested:** Read the referenced protocol, FID, prompt, and report 0-EOF. Independently verify planning claims against the current working tree. Return `PASS`, `FAIL`, or `NEEDS-REVIEW` per target with exact `path:line` or command-output evidence.

> This request intentionally contains no signature, author, or agent-attribution fields. It follows the no-signature policy
> in `ECHO-single-agent.md` and `dev/echo-v0.1.2-single-agent.md`.

---

## 1. Approval boundary

This request asks Nova to review **planning readiness only**. It does not request implementation, source modification,
release preparation, closure, archive movement, commit, tag, push, publication, deployment, credential use, or remote action.

A Nova planning PASS does not authorize implementation by itself. Implementation requires a separate explicit operator
approval for the selected workstreams. A conditional PASS authorizes nothing beyond the stated planning conditions.

The current FID is an untracked working-tree planning artifact. It must be treated as working-tree evidence, not durable
repository certification. The FID remains `Status: verified`, meaning planning convergence; it is not `fixed`, `closed`, or
archived.

**Mutation boundary for Nova review:** read-only inspection of the referenced artifacts and current repository state. Do not
modify production source, package manifests, protocol configuration, generated artifacts, FIDs, reports, release files, or
durable settings while reviewing.

---

## 2. Documents under review

1. `ECHO-single-agent.md`
2. `dev/echo-v0.1.2-single-agent.md`
3. `protocol.config.yaml`
4. `templates/FID-TEMPLATE.md`
5. `dev/test-prompts/v0.0.23-comprehensive-live-test.md`
6. `dev/scratchpad/v0.0.23-comprehensive-live-test-report.md`
7. `dev/fids/FID-2026-0812-001-v0-0-23-live-test-remediation-master.md`
8. `dev/fids/README.md`
9. `dev/nova/README.md` if available

### Baseline identity to verify

- FID target: `FID-2026-0812-001`
- FID path: `dev/fids/FID-2026-0812-001-v0-0-23-live-test-remediation-master.md`
- Planning status: `verified`, not implementation closure
- Discovery HEAD recorded in FID: `98acc253623050d9518ef528a8f7975057262948`
- FID/report baseline: v0.0.23 comprehensive live-test result with 118 numbered rows
- Report baseline totals: 35 PASS / 4 FAIL / 73 NEEDS-REVIEW / 6 SKIP

The status-list and tracked-diff hashes are recorded in the FID as working-tree identity evidence. They are not release
certificates and must not be treated as current if the worktree changed after FID creation.

---

## 3. Planning targets

### Target 1 — Grounding and protocol compliance

Verify that the FID:

- explicitly records that `dev/echo-v0.1.2-single-agent.md` was reread 0-EOF;
- follows the no-signature/no-attribution policy;
- distinguishes single-agent governance from harness governance;
- respects Read 0-EOF, Present Before Act, Verify Before Proceed, and call-graph/evidence boundaries;
- does not use the single-agent protocol as authorization to modify production code before FID convergence and approval.

### Target 2 — Complete issue coverage

Verify that every unresolved family from the live-test report is owned exactly once or explicitly shared with a bounded
handoff:

- credential exposure and secret-safe probes;
- quality ratchet, validation, scripts, CLI, changelog, lint, and format failures;
- FID/LEARNINGS governance and audit evidence;
- protocol boot/embedded grounding/mode gates/restoration;
- ECHO turn-end reachability, scanner content, provenance, receipts, and bounded correction;
- interactive design-system workflows and live enforcement;
- provider-safe configuration, local/stub routing, SDK compatibility, and propagation bounds;
- graph refresh/export and offline browser behavior;
- isolated packaging/install/wrapper parity;
- TUI modes/recovery/terminal cleanup/performance/final 118-row certification.

### Target 3 — Workstream architecture and dependencies

Verify the ten-workstream register W1–W10, unique ownership, authoritative dependency edges, and acyclicity. Confirm:

- security containment is operator-gated and precedes additional provider evidence;
- direct gate remediation precedes interpretation of later evidence;
- evidence/reporting is a distinct boundary;
- runtime, design, SDK, browser, packaging, and TUI work are not silently collapsed;
- W10 cannot certify while any prerequisite remains unresolved;
- newly discovered independent defects require linked FIDs rather than silent scope expansion.

### Target 4 — Evidence and 100% contract

Verify that the target is explicit and honest:

```text
118 PASS
0 FAIL
0 NEEDS-REVIEW
0 SKIP
```

Confirm the FID does not achieve this by deleting rows, reclassifying unavailable evidence, relying on static claims for live
behavior, or changing the test denominator without an operator-approved contract amendment.

Verify the direct-exit, duration, redaction, artifact/hash, cleanup, evidence-triad, and independent-review requirements.

### Target 5 — Security and isolation boundaries

Verify that the FID:

- never requests or reproduces real credentials;
- leaves rotation/revocation as an operator action;
- requires `SET`/`UNSET`-only probes and secret-safe receipts;
- requires disposable project/config/provider/browser/package boundaries;
- prevents install/build/packaging mutations in the real dirty checkout;
- distinguishes system Chrome from the exact Playwright executable and records executable, version, installation source,
  launch command, network interception, console, and resource-budget evidence.

### Target 6 — Product/runtime verification contract

Verify that the FID requires live evidence, not only source/unit claims, for protocol gates, ECHO enforcement, design-system
TUI workflows, provider/SDK behavior, graph/browser interactions, packaging, and CLI recovery. Confirm model-dependent
paths require a deterministic local/stub provider and artifact/receipt/transcript evidence.

### Target 7 — Clean certification boundary

Verify that the FID distinguishes:

- current dirty working-tree evidence;
- isolated disposable-copy evidence;
- clean identity-bound evidence;
- release certification.

Confirm `audit:evidence --clean` is a final fail-closed gate and that an untracked FID or dirty worktree cannot be described
as durable release certification.

### Target 8 — FID lifecycle and closure semantics

Verify that `verified` means planning convergence only, while `closed` requires implementation, independent verification,
CHANGELOG closure entry, and archive movement. Confirm the FID does not claim implementation, closure, archive, release, or
Nova approval.

### Target 9 — Perfection Loop convergence

Review the FID’s Loop 1–4 records and confirm:

- RED catalogs the live-test findings;
- GREEN creates bounded workstreams and acceptance criteria;
- AUDIT cites tool output and structural checks;
- ADVERSARIAL review corrects omissions without silently expanding scope;
- missed questions are answered;
- the latest loop records that the FID is untracked working-tree evidence;
- no production implementation was performed by this planning pass.

---

## 4. Evidence navigation

The FID contains the primary plan and line-level evidence. The following commands are safe, read-only navigation aids;
Nova may use equivalent commands:

```text
cat dev/fids/FID-2026-0812-001-v0-0-23-live-test-remediation-master.md
cat dev/test-prompts/v0.0.23-comprehensive-live-test.md
cat dev/scratchpad/v0.0.23-comprehensive-live-test-report.md
bunx prettier --check dev/fids/FID-2026-0812-001-v0-0-23-live-test-remediation-master.md
bunx markdownlint dev/fids/FID-2026-0812-001-v0-0-23-live-test-remediation-master.md
bun test scripts/fid-ledger.test.ts
```

These commands validate document/governance state only. They do not establish product implementation or release readiness.

---

## 5. Requested Nova response

Please return a new response in the Nova inbox containing:

1. Verdict for Targets 1–9: `PASS`, `FAIL`, or `NEEDS-REVIEW`.
2. Exact `path:line` evidence for every PASS and FAIL.
3. Any missing acceptance criterion, contradiction, unsupported claim, scope overlap, or dependency cycle.
4. Confirmation that all requested documents were reviewed 0-EOF, or a precise list of documents not fully reviewed.
5. Confirmation that the current FID is planning-only and untracked working-tree evidence.
6. Confirmation that the no-signature/no-attribution policy is followed.
7. Overall verdict using exactly one:
   - `PASS — planning approved for operator decision`
   - `FAIL — planning revision required`
   - `NEEDS-REVIEW — named evidence remains unavailable`
8. Explicit statement that Nova’s verdict does not authorize implementation, closure, archive movement, release, or remote
   action.

If a target fails, identify the smallest required FID correction. Do not redesign the program or modify production files while
reviewing.

---

## 6. Expected boundaries and non-claims

This request does not claim:

- that the 118-row live test is green;
- that credentials have been rotated;
- that product implementation has begun or completed;
- that the browser/package environments are available;
- that the current worktree is clean;
- that the FID is tracked, closed, or archived;
- that Nova has already approved anything.

The only requested decision is whether the planning FID is sufficiently complete and bounded for the operator to decide
whether to authorize selected implementation workstreams.
