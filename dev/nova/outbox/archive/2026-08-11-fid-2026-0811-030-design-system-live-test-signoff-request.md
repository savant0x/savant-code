<!-- markdownlint-disable MD013 -->

# Independent Sign-off Request — Design-System and v0.0.23 Comprehensive Live Tests

**Date:** 2026-08-11
**To:** Independent third-party ECHO auditor
**Scope:** design-system live testing plus the comprehensive pending-update
prompt and their future live reports:

- `dev/test-prompts/design-system-live-ux-performance.md`
- `dev/test-prompts/v0.0.23-comprehensive-live-test.md`
- `dev/scratchpad/design-system-live-ux-performance-report.md`
- `dev/scratchpad/v0.0.23-comprehensive-live-test-report.md`
**Feature:** `FID-2026-0811-030` / `savant-design-systems`; comprehensive target: pending `v0.0.23`
**Status:** AWAITING INDEPENDENT REVIEW
**Priority:** High

> This request contains no signature or agent-attribution fields. It follows the
> no-signature policy in `ECHO-single-agent.md` and `dev/echo-v0.1.2-single-agent.md`.

## 1. Purpose

Please independently review both live-test prompts for completeness and
safety, then review each captured live result when available. The comprehensive
prompt uses the current changelog as its coverage index and adds protocol boot,
ECHO enforcement, LEARNINGS validation, provider/configuration parity, Code
Universe, SDK/headless behavior, packaging wrappers, CLI modes, and release
safety to the design-system user-path coverage. Together the tests cover
user-facing usability, agent feedback, runtime performance, persistence
recovery, packaging, and real CLI behavior that cannot be established by unit
tests or source review alone.

This is a test-design and live-evidence sign-off request. It is not a request to
modify source code, create a FID, publish a package, commit, push, tag, deploy,
or certify a clean release.

The implementation FID is already closed as working-tree implementation evidence.
The documentation/implementation review and this live-test review remain separate
boundaries. A passing prompt review does not imply that the live workflow passed;
a provider timeout or unavailable TTY is `NEEDS-REVIEW`, not a product pass.

## 2. Files and evidence under review

### Prompt and product documentation

- `dev/test-prompts/design-system-live-ux-performance.md`
- `dev/test-prompts/v0.0.23-comprehensive-live-test.md`
- `docs/design/design-system-library.md`
- `README.md`
- `README.zh-CN.md`
- `CHANGELOG.md`
- `dev/fids/archive/FID-2026-0811-030-loadable-design-system-skill-library.md`

### Implementation surfaces to re-check where claims require them

- `.agents/skills/savant-design-systems/manifest.json`
- `.agents/skills/savant-design-systems/resources/`
- `packages/design-systems/src/`
- `cli/src/commands/design.ts`
- `cli/src/cli-args.ts`
- `cli/src/index.tsx`
- `cli/src/utils/design-system-service.ts`
- `packages/agent-runtime/src/echo/design-contract.ts`
- `cli/src/__tests__/release/wrapper-safety.test.ts`

### Future live artifacts

- `dev/scratchpad/design-system-live-ux-performance-report.md`
- `dev/scratchpad/v0.0.23-comprehensive-live-test-report.md`

The comprehensive report must include a result row for the isolated dev-prebuild/env-validation path and restoration proof.

The comprehensive prompt is the authoritative live-test entry point when the
operator wants coverage of the full pending update; the design-system prompt
remains the focused workflow/performance test.

Future reports must be treated as working-tree evidence. They must not be
claimed to exist or pass until the corresponding live prompt has actually been
executed and the report inspected.

## 3. Prompt-design audit

Before the live run, verify the prompt itself:

### A. Coverage

Confirm that it exercises the real user path for:

- catalog discovery and exact-74 availability;
- built-in selection and persisted reload;
- invalid ID and unsafe-path failures;
- interactive custom creation, validation, preview, cancel, save, and activation;
- editing a custom system;
- built-in clone-before-edit;
- import and validation;
- draft list, resume, and discard;
- headless file and stdin authoring;
- malformed JSON, missing `activate`, unknown schema, and invalid fields;
- active-contract grounding;
- compliant visual writes;
- blocked or review-required visual writes;
- final-content/patch scanning;
- design-specific receipts and correction guidance;
- selection precedence and reset/recovery; and
- cleanup and artifact containment.

### B. Performance methodology

Confirm that the prompt requires:

- a no-design baseline for comparable agent work;
- at least three warm trials for repeatable operations;
- median and p95 or max reporting;
- measured cold and warm catalog/selection operations;
- authoring/import/reload/error timings;
- active-contract and enforcement-turn timings;
- RSS/catalog/context observations where practical; and
- environment details sufficient to distinguish product latency from provider,
  disk, OS, terminal, or network effects.

The prompt's thresholds are triage guidance only, not release SLOs. A threshold
exceedance must be classified with evidence rather than automatically called a
failure.

### C. Safety and isolation

Confirm that the prompt:

- uses a disposable project;
- forbids production mutation, publication, push, commit, and credential use;
- skips user-scope tests unless `HOME`/`USERPROFILE` and related settings are
  demonstrably isolated;
- restores isolated environment variables afterward;
- keeps test fixtures inside the disposable scope;
- removes temporary design systems, manifests, journals, drafts, and imports;
- preserves only the final scratchpad report; and
- records the baseline working-tree state without claiming cleanliness.

### D. Evidence quality

Confirm that the prompt requires objective evidence rather than agent self-report.
For grounding and enforcement claims, the report must include at least two of:

- transcript/context excerpt or tool-call record;
- resulting disposable file or diff; and
- EHEL receipt or error classification.

Missing transcript, file proof, or receipt evidence must be `NEEDS-REVIEW`.
Sensitive values, credentials, personal paths, and unrelated conversation must
be redacted.

## 4. Live-result audit

When either future report exists, verify it against the live run rather than
the prompt's expected results. When both exist, ensure their overlapping
design-system results agree or explain every difference.

### A. Report integrity

- Environment, CLI/build, provider, TTY, isolation, and baseline state are recorded.
- Every applicable `DS-LIVE-*` and `V023-*` test has `PASS`, `FAIL`, `NEEDS-REVIEW`, or `SKIP`.
- The comprehensive report includes a coverage row for every update domain, its complete `V023-*` result table, static-vs-live labels, and separate functional/UX/release-safety verdicts.
- Skips identify a concrete environment reason.
- Commands, exit codes, durations, and exact failures are preserved.
- User feedback and agent feedback are separately recorded.
- Timing tables include trial count, baseline, median, and p95/max where applicable.
- RSS/context observations are labeled as measured or unavailable.
- Cleanup is explicitly confirmed.
- The verdict is one of the prompt's allowed values.

### B. Functional behavior

Re-check any reported pass for the focused design-system workflow and the
comprehensive update domains:

- `/design list`, `/design current`, `/design use`, `/design create`,
  `/design edit`, `/design import`, `/design validate`, `/design drafts`,
  `/design resume`, `/design discard`, and `/design reset`;
- headless `--design-input <path|->` stdout/stderr separation and exit codes;
- invalid-input no-partial-write behavior;
- selection precedence and invalid-selection fail-closed behavior;
- custom persistence and reload;
- draft bounds and cleanup; and
- built-in immutability during edit;
- protocol local/embedded boot and first-turn grounding;
- ECHO turn-end/scanner reachability, execution-policy boundaries, and bounded correction;
- LEARNINGS privacy/schema/chronology/supersession/evidence checks;
- provider registry/configuration parity without credentials;
- Code Universe offline/browser behavior and deterministic export;
- SDK RunState/propagation/headless compatibility;
- packaging-wrapper resource parity; and
- release diagnostics/preview reversibility and direct exit classification.

### C. Agent behavior

For model-dependent tests, verify objective artifacts showing:

- active design-system identity and target context;
- selected semantic token usage in the resulting file;
- a blocked or review-required unauthorized literal;
- remediation guidance and subsequent correction;
- distinct design-contract receipt classification; and
- absence of all-74 catalog injection into an ordinary turn.

A model/provider timeout is not evidence of a design-system failure. It is an
environmental `NEEDS-REVIEW` unless a separate local reproduction proves the
product path is defective.

### D. Performance behavior

Check that:

- measurements use comparable conditions;
- baseline and design-enabled operations use the same prompt/project/provider;
- repeated trials are not mislabeled as cold starts;
- outliers are explained rather than silently dropped;
- provider/network time is distinguished from local catalog or persistence time;
- context overhead is measured from actual evidence; and
- a claimed regression is reproducible.

### E. Comprehensive update-result integrity

For the `V023-*` report, also verify:

- Every changelog update domain has a coverage row and an independent status.
- Static-only checks are labeled `STATIC` and are not presented as live behavior.
- Release diagnostics remain local-only and no remote action occurred.
- Typecheck/test/lint commands preserve direct exit codes; pipelines do not mask failures.
- Timeouts are `NEEDS-REVIEW`, never `PASS`.
- Current-update results are separated from historical `0.0.22` regression context.

## 5. Required independent response

Return a new inbox response with:

1. A prompt-design verdict for domains A–E, including an explicit verdict that every changelog update domain is represented in the comprehensive prompt and that the dev-prebuild/env-validation failure path is covered.
2. A live-result verdict for domains A–E, including the comprehensive report's coverage matrix, complete `V023-*` result table, static-vs-live labels, and separate functional/UX/release-safety verdicts, or `NEEDS-REVIEW` if the report is not yet present.
3. Exact `path:line` evidence for every material PASS, FAIL, or NEEDS-REVIEW.
4. Any missing safety isolation, timing methodology, objective evidence, cleanup,
   redaction requirement, or changelog-domain coverage.
5. Confirmation that no source, release, remote, or credential boundary was
   crossed by the test.
6. Confirmation that the no-signature/no-attribution policy is followed.
7. A distinction between:
   - prompt ready for execution;
   - live workflow result verified;
   - implementation/documentation sign-off; and
   - clean-release certification.
8. One overall verdict using exactly one of:

```text
PASS — live-test prompt and captured result approved
PASS WITH CAVEATS — prompt/result usable with named limitations
NEEDS-REVIEW — named live evidence remains outstanding
FAIL — test design or live result requires correction
```

If the live report is not yet available, do not issue the first verdict. Return
`NEEDS-REVIEW — named live evidence remains outstanding`, identify that the prompt
is ready or not ready, and wait for the captured report.

No source modification is requested during this review. Packaging/install/build
checks must be independently verified in an isolated repository copy or marked
`NEEDS-REVIEW`; they must not mutate the real checkout. Place the response in
the independent-audit inbox and archive this request after responding.
