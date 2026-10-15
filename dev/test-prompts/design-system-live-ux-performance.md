<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Savant Design-System Library — Live UX, Agent Feedback, and Performance Test

**Version:** 1.0.0
**Date:** 2026-08-11
**Status:** Active live-test prompt
**Feature:** `FID-2026-0811-030` / `savant-design-systems`
**Purpose:** Exercise the implemented design-system library through the real CLI
and capture user-facing behavior, agent feedback, latency, resource usage, and
failure quality.

This is a live behavioral test, not a source inspection or unit-test substitute.
Run it against the CLI that a user would actually launch. Use a disposable test
project and disposable project/user design-system scope. Do not publish, push,
commit, modify production projects, use real credentials, or change source files.

## 1. How to run

Point the Savant agent at this file and instruct it:

> Read this complete test prompt, execute every applicable test against the live
> CLI, record exact observations and timings, continue after individual failures,
> and write the final report to
> `dev/scratchpad/design-system-live-ux-performance-report.md`.

The testing agent must:

1. Read this file from start to end before testing.
2. Create a todo for each test phase.
3. Use a disposable project directory under `dev/scratchpad/` or an OS temp
   directory. Do not use the repository's real project selection or user
   design-system directory. Project-scope tests must use only the disposable
   project. User-scope tests are `SKIP` unless the run proves an isolated home
   and settings environment: on Windows isolate both `USERPROFILE` and any
   platform-specific home/config variables; on POSIX isolate `HOME` and the
   relevant config variables. Record the isolation variables and restore the
   parent environment after the run.
4. Record wall-clock duration for every command and workflow. Prefer the shell's
   high-resolution timer when available; otherwise record millisecond timestamps
   before and after each operation. Run one no-design baseline for comparable
   agent operations, then at least three warm trials for each repeatable design
   operation. Report median and p95 (or min/max when fewer than five trials are
   possible), not only a single sample.
5. Record whether each result is `PASS`, `FAIL`, `NEEDS-REVIEW`, or `SKIP`.
6. Continue after failures and capture the exact error, exit code, and last
   visible UI state.
7. Capture feedback from both sides of the interaction:
   - **User-facing feedback:** clarity, discoverability, number of prompts,
     confusing wording, cancellation behavior, and recovery quality.
   - **Agent-facing feedback:** whether the active contract is visible in
     context, whether the agent uses the selected tokens, whether enforcement
     steers corrections, and whether the agent reports useful diagnostics.
8. Clean all disposable artifacts after the report is written, except the final
   report itself.
9. Never call a test successful merely because the process did not crash. Verify
   the expected observable result.

## 2. Environment record

Record these values at the start and end of the report:

| Field | Value |
| --- | --- |
| Date/time | |
| OS/platform | |
| Bun version | |
| CLI version/build | |
| Launch command | |
| Model/provider mode | |
| Network available | yes/no |
| Disposable project path | |
| Interactive TTY available | yes/no |
| Chrome/tmux available | yes/no/not used |
| Baseline working-tree status | |

If a hosted provider is unavailable, run all local/offline and CLI parsing tests
that do not require model inference. Mark model-dependent tests `NEEDS-REVIEW`,
not `PASS`, and explain the provider limitation.

## 3. Measurement contract

### 3.1 Required measurements

Capture at least:

- CLI startup to usable prompt (`startup_ms`), with a no-design baseline;
- `/design current` response time (`current_ms`), with repeated warm trials;
- `/design list` response time (`list_ms`);
- first built-in `/design use <id>` response time (`cold_use_ms`);
- repeated use of the same ID (`warm_use_ms`);
- custom authoring validation time (`custom_validate_ms`);
- custom save-to-confirmation time (`custom_save_ms`);
- reload/current time after process restart (`reload_ms`);
- import and validation time (`import_ms`, `import_validate_ms`);
- deliberate invalid-input response time (`invalid_input_ms`);
- draft list/resume/discard times (`draft_*_ms`);
- one active-contract visual-write turn (`agent_contract_turn_ms`); and
- one blocked or review-required visual-write turn (`agent_enforcement_turn_ms`).

Report each measurement as observed data, not a performance promise. For each
value include command/workflow, start/end method, result, and environment.

### 3.2 Performance interpretation

For each repeatable operation, record trial count, baseline (where applicable),
median, p95 or max, and variance/notes. A single observation may demonstrate a
failure or crash, but it cannot establish a performance regression by itself.
Compare design-enabled agent operations against the no-design baseline using the
same prompt, project, model/provider, and terminal conditions.

Use these default investigation thresholds for a normal local development
machine. They are triage thresholds, not release SLOs:

| Measurement | Pass guidance | Investigate when |
| --- | ---: | ---: |
| `/design current` median | < 500 ms | >= 1 s |
| `/design list` median | < 2 s | >= 5 s |
| built-in warm-use median | < 500 ms | >= 1 s |
| custom validation median | < 1 s | >= 3 s |
| custom save median | < 1 s | >= 3 s |
| reload/current median | < 1 s | >= 3 s |
| invalid-input median | < 1 s | >= 3 s |
| active-contract context overhead vs baseline | < 10% | >= 25% |

If a threshold is exceeded, do not automatically mark the feature failed. Record
CPU, disk, provider, catalog, and environment context and classify the result
as `NEEDS-REVIEW` unless a reproducible product defect is demonstrated.

### 3.3 Resource observations

Where practical, capture before/after process RSS and the size of the loaded
skill/catalog. The expected product behavior is progressive disclosure: the
full catalog is available offline, but only the active contract enters the agent
context. Flag any observation showing all 74 resources injected into an
ordinary turn.

## 4. Test phases

## Phase 0 — Safety and baseline

| ID | Test | Expected |
| --- | --- | --- |
| DS-LIVE-000 | Confirm disposable project and isolated scope | No production/user files are in the target path |
| DS-LIVE-001 | Record repository status before launch | Baseline is captured; no test claims a clean tree if it is dirty |
| DS-LIVE-002 | Start CLI with no design command | CLI reaches a usable prompt or reports a clear environment error |
| DS-LIVE-003 | Record startup time and resource baseline | Timing and RSS/catalog baseline are recorded |

## Phase 1 — Catalog discovery and selection

| ID | Test | Expected |
| --- | --- | --- |
| DS-LIVE-010 | `/design current` | Reports `savant-cyberpunk` or the documented active selection and scope |
| DS-LIVE-011 | `/design list` | Lists built-ins and valid custom systems without crashing |
| DS-LIVE-012 | Count built-ins in output or supporting manifest | Exactly 74 built-in resources are available |
| DS-LIVE-013 | `/design use <known-id>` | Selection succeeds and reports the selected ID |
| DS-LIVE-014 | `/design current` after use | Reports the selected system and correct scope |
| DS-LIVE-015 | Restart CLI and run `/design current` | Persisted selection reloads when the selected scope is persistent |
| DS-LIVE-016 | `/design use does-not-exist` | Actionable failure; no silent fallback |
| DS-LIVE-017 | `/design use ../../outside` | Rejected as invalid/unsafe; no outside file read |
| DS-LIVE-018 | Repeat `/design use` for the same system | Warm path is measured and does not duplicate catalog state |

Record usability feedback:

- Can a new user discover `/design` without reading source?
- Is the active scope understandable?
- Does the error identify the invalid ID and next action?
- Is list output usable at the terminal size used for the test?

## Phase 2 — Interactive custom authoring

Use a disposable project-scoped custom ID such as `live-feedback-system`.

| ID | Test | Expected |
| --- | --- | --- |
| DS-LIVE-020 | `/design create` | Opens the guided wizard without writing immediately |
| DS-LIVE-021 | Complete identity/scope/target steps | Values are accepted with understandable prompts |
| DS-LIVE-022 | Enter semantic colors, typography, spacing, radius, components, accessibility | Wizard accepts valid values and rejects malformed values clearly |
| DS-LIVE-023 | Review preview before save | Preview reflects entered values and target scope |
| DS-LIVE-024 | Cancel before confirmation | No active system or partial saved resource is created |
| DS-LIVE-025 | Re-run create and explicitly save without activation | Valid custom resource is saved but active selection remains unchanged |
| DS-LIVE-026 | `/design use live-feedback-system` | Custom resource becomes active after validation |
| DS-LIVE-027 | `/design current` | Reports custom source, ID, and correct scope |
| DS-LIVE-028 | Restart CLI and `/design current` | Custom selection and resource reload successfully |
| DS-LIVE-029 | Repeat the workflow with one invalid field | Validation error is actionable and the prior valid system remains intact |

Record user feedback after each wizard section:

- Prompt clarity: `1`–`5`.
- Amount of typing: low/medium/high.
- Unexpected or redundant questions.
- Whether cancel/recovery behavior was obvious.
- Whether the preview was sufficient to approve the save.

## Phase 3 — Edit, clone, import, and drafts

| ID | Test | Expected |
| --- | --- | --- |
| DS-LIVE-030 | `/design edit live-feedback-system` | Existing custom values are loaded into the editor |
| DS-LIVE-031 | Change one token and save | New validated hash/revision is produced |
| DS-LIVE-032 | `/design edit savant-cyberpunk` | Built-in is cloned before editing; embedded resource remains unchanged |
| DS-LIVE-033 | `/design drafts` before a draft exists | Clear empty-state response |
| DS-LIVE-034 | Start authoring and cancel/skip | A bounded non-active draft is offered or saved according to the UI contract |
| DS-LIVE-035 | `/design drafts` | Draft ID and updated time are listed |
| DS-LIVE-036 | `/design resume <draft-id>` | Draft values return to the wizard |
| DS-LIVE-037 | `/design discard <draft-id>` | Draft is removed and no longer resumable |
| DS-LIVE-038 | `/design import <disposable-valid-file>` | Imported resource is copied into the approved scope and validated |
| DS-LIVE-039 | `/design validate <id-or-path>` | Valid resource returns a clear success result |
| DS-LIVE-040 | Import malformed/unsafe/outside-root file | Fails without partial activation or silent fallback |

Record:

- Time from edit start to first preview.
- Time from import start to validation result.
- Whether the clone-before-edit behavior is visible to the user.
- Whether draft recovery explains what will be resumed.

## Phase 4 — Headless authoring and error contract

Create a valid JSON fixture only under the disposable test directory. Use
`--design-input -` for stdin and a file path in separate runs.

| ID | Test | Expected |
| --- | --- | --- |
| DS-LIVE-050 | Valid file input | Exit 0; machine-readable success JSON; resource is saved |
| DS-LIVE-051 | Valid stdin input | Exit 0; same schema/result behavior as file input |
| DS-LIVE-052 | Malformed JSON | Non-zero exit; machine-readable `DESIGN_INPUT_INVALID`; no partial file |
| DS-LIVE-053 | Missing `activate` | Non-zero exit; `INTERACTIVE_INPUT_REQUIRED`; no partial file |
| DS-LIVE-054 | Unknown schema version | Non-zero exit; `DESIGN_INPUT_INVALID`; no partial file |
| DS-LIVE-055 | Missing required token fields | Non-zero exit; actionable validation error; prior valid system unchanged |
| DS-LIVE-056 | Repeat the same valid input | Deterministic content/normalized hash behavior is observed |

Record stdout and stderr separately. Do not treat human-readable logs mixed into
machine-readable stdout as a pass.

## Phase 5 — Agent grounding and visual enforcement

These tests require a live agent/provider. If unavailable, mark them
`NEEDS-REVIEW` and run the static/local portions.

Use the active custom system with distinctive values such as a named primary
color and spacing token. Ask the agent to create a tiny disposable visual file
inside the disposable project.

| ID | Test | Expected |
| --- | --- | --- |
| DS-LIVE-060 | Ask agent to summarize the active design contract before writing | Agent identifies the active ID, target, or semantic tokens without loading all 74 systems |
| DS-LIVE-061 | Ask agent to create a visual component using active tokens | Supported write completes and uses the active contract |
| DS-LIVE-062 | Ask agent to introduce an unauthorized literal visual value | Write is blocked or classified `DESIGN_CONTRACT_NEEDS_REVIEW` with remediation |
| DS-LIVE-063 | Ask agent to correct the blocked write | Agent converges using the suggested token or explicit review path |
| DS-LIVE-064 | Use a patch/replacement workflow | Scanner evaluates final proposed content, not only the replacement fragment |
| DS-LIVE-065 | Trigger unavailable final-content path if safely reproducible | Fail-closed or explicit review result; never silent pass |
| DS-LIVE-066 | Inspect the resulting receipt | Design receipt is distinct from ECHO Law 15 and contains path/rule/remediation context |
| DS-LIVE-067 | Compare prompt/context size with and without active design contract | Only the active contract is injected; catalog is not dumped into every turn |

Agent feedback questions:

1. Did the agent know which design system was active?
2. Did it understand the difference between reference prose and ECHO policy?
3. Were blocked writes explained well enough to self-correct?
4. Did the agent loop or oscillate after a block?
5. Did the agent use the suggested semantic token?
6. Did the design context improve visual consistency without noticeably slowing
   unrelated coding work?

Do not accept model self-report as sole evidence. For every grounding or
enforcement claim, capture at least two objective artifacts from the live run:

- the relevant transcript/context excerpt or tool-call record;
- the resulting disposable file content or diff; and
- the EHEL receipt/error classification when enforcement was involved.

If the transcript is unavailable, the resulting file does not prove the token
choice, or the receipt cannot be located, classify the claim as `NEEDS-REVIEW`.
Redact credentials, tokens, personal paths, and unrelated conversation content
before placing excerpts in the report.

## Phase 6 — Reset, precedence, and recovery

| ID | Test | Expected |
| --- | --- | --- |
| DS-LIVE-070 | Set a user selection, then a project selection | Project selection wins |
| DS-LIVE-071 | Add a session override if the host supports it | Session selection wins |
| DS-LIVE-072 | `/design reset --project` | Project selection is removed; next valid scope resolves |
| DS-LIVE-073 | `/design reset --user` | User selection is removed; next valid scope resolves |
| DS-LIVE-074 | `/design reset --all` in disposable scope | All disposable selections are removed; default or lower scope resolves |
| DS-LIVE-075 | Corrupt a disposable selection record | Startup/current reports an actionable invalid-selection error |
| DS-LIVE-076 | Restore/delete disposable artifacts after recovery test | No test artifacts escape the disposable scope |

Do not claim an interactive confirmation for `reset --all` unless the live CLI
actually displays and receives one.

## Phase 7 — Performance and qualitative feedback synthesis

After functional tests, summarize:

### Timing table

| Operation | Baseline | Trials | Median ms | P95/max ms | Result | Notes |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| CLI startup | | | | | | |
| `/design list` | | | | | | |
| `/design current` | | | | | | |
| Built-in selection | | | | | | |
| Custom validation | | | | | | |
| Custom save | | | | | | |
| Reload/current | | | | | | |
| Import/validate | | | | | | |
| Headless valid input | | | | | | |
| Headless invalid input | | | | | | |
| Active-contract agent turn | | | | | | |
| Enforcement correction turn | | | | | | |

### Usability scorecard

Score each from `1` (poor) to `5` (excellent), with evidence:

| Dimension | Score | Evidence |
| --- | ---: | --- |
| Discoverability | | |
| Prompt clarity | | |
| Wizard flow | | |
| Preview usefulness | | |
| Error quality | | |
| Cancellation/recovery | | |
| Draft experience | | |
| Selection transparency | | |
| Headless ergonomics | | |
| Agent contract awareness | | |
| Enforcement remediation | | |
| Overall confidence | | |

### Findings classification

Classify every issue as:

- `PRODUCT-BLOCKER` — prevents safe or intended use;
- `UX-FRICTION` — usable but confusing, slow, or unnecessarily verbose;
- `PERFORMANCE-REGRESSION` — reproducible degradation against the baseline;
- `AGENT-FEEDBACK` — grounding, explanation, or correction quality issue;
- `ENVIRONMENT` — provider, terminal, OS, or network limitation;
- `NEEDS-REVIEW` — evidence incomplete or not reproducible.

## 5. Report contract

Write the final report to:

```text
dev/scratchpad/design-system-live-ux-performance-report.md
```

The report must contain:

1. Environment and safety boundary.
2. Summary counts: total, pass, fail, needs-review, skip.
3. Timing table with measurement method.
4. Resource/RSS observations where available.
5. Complete result table:

   ```text
   | Test ID | Status | Duration | Evidence | User feedback | Agent feedback | Notes |
   ```

6. All exact command output/error messages needed to reproduce failures.
7. Usability scorecard.
8. Performance findings and baseline comparison.
9. Product blockers and recommended follow-up FIDs, if any.
10. Cleanup confirmation.
11. Final verdict:

   - `PASS — live design-system workflow verified`;
   - `PASS WITH CAVEATS — live workflow works; named limitations remain`; or
   - `NEEDS-REVIEW — live evidence incomplete`.

A live test result is not a Nova implementation sign-off. Attach or link the
report to the pending independent review request after the test completes.

## 6. Cleanup checklist

Before ending the test:

- [ ] Remove disposable project files created by the test.
- [ ] Remove disposable custom design systems, manifests, journals, versions,
  drafts, and imported files.
- [ ] Restore any isolated user/project selection state.
- [ ] Stop any test-only CLI/provider process.
- [ ] Confirm no source files changed.
- [ ] Confirm no credentials were written or exposed.
- [ ] Keep only `dev/scratchpad/design-system-live-ux-performance-report.md` as
  the test deliverable.

## 7. Final evaluator guidance

Prefer observed behavior over expected behavior. A passing unit suite does not
prove that a user can find `/design`, complete the wizard, recover a draft,
understand an enforcement block, or tolerate catalog-loading latency. Conversely,
a provider timeout does not prove a product defect. Separate those conclusions
in the report, preserve exact evidence, and identify the smallest reproducible
follow-up for every issue.
