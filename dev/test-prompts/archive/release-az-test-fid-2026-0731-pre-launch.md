<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->
# Current Release A–Z Audit — Savant-Code v0.0.11

**Version:** v0.0.11  
**FID:** FID-2026-0731-003  
**Purpose:** Fresh pre-launch evidence for the currently published package. Historical v0.0.9 prompts and reports are not certification for this version.

## Ground Rules

- Run from the repository root unless a command changes directory explicitly.
- Record exact exit codes and concise output for every check.
- Use `PASS`, `FAIL`, or `DEFERRED`; never convert unavailable interactive/backend checks into `PASS`.
- Do not publish, upload, promote, advertise, commit, or push.
- Telemetry/privacy behavior is governed by the closed FID-2026-0731-006 decision and is validated as a bounded control surface by this audit.

## Tier 1 — Version and Package Identity

### T1.1 — Release sources
Read `VERSION`, root `package.json`, `cli/package.json`, `sdk/package.json`, and `protocol.config.yaml`. Expected: release sources report `0.0.11`; protocol version remains `0.2.0`; internal workspace packages may retain their documented `0.0.1` versions.

### T1.2 — Registry version
Run `npm view savant-code version`. Expected: `0.0.11`.

### T1.3 — Package dry-runs
Run:

```text
npm pack ./cli/release --dry-run
npm pack ./cli/release-staging --dry-run
npm pack ./savant-free/cli/release --dry-run
```

Expected: all supported package contracts exit 0; staging is private/internal-only.

## Tier 2 — Workspace Safety

### T2.1 — Common typecheck
`cd common && bun run typecheck`

### T2.2 — Agent-runtime typecheck
`cd packages/agent-runtime && bun run typecheck`

### T2.3 — SDK typecheck
`cd sdk && bun run typecheck`

### T2.4 — CLI typecheck
`cd cli && bun run typecheck`

### T2.5 — LLM-provider typecheck
`cd packages/llm-providers && bun run typecheck`

### T2.6 — Focused release regression tests
Run the wrapper-safety, proxy HTTP, terminal-reset, and settings tests.

## Tier 3 — Safety and Runtime Claims

### T3.1 — Permission controls
Verify `/permissions`, `/sandbox`, `/safety`, and `--permission-mode safe|prompt|unsafe` are registered and parsed.

### T3.2 — Sandbox enforcement
Verify the sandbox registry, destructive-command denylist, and network gating are present in the runtime and covered by tests.

### T3.3 — Onboarding/health
Verify Ollama detection/onboarding and `/health` sources exist and have focused tests.

### T3.4 — Regression command paths
Verify `/goal`, `/loop`, `/login`, and `/signin` remain registered.

## Tier 4 — Public Claims and Governance

### T4.1 — FID gate
Verify the v0.0.11 report does not inherit historical Go decisions and that the master/child FIDs remain the controlling gate.

### T4.2 — Telemetry boundary
Verify FID-2026-0731-006 remains archived `closed`, its control surface is tested, and no broader promotion claim is inferred.

### T4.3 — Documentation inventory
Verify current README/landing/launch artifacts are covered by FID-2026-0731-005 and that placeholders/stale claims are not silently certified.

### T4.4 — Lifecycle inventory
Verify FID-2026-0731-004 evidence and report any remaining historical metadata backlog honestly.

## Tier 5 — Interactive and Environment-Dependent Checks

### T5.1 — CLI launch
**DEFERRED** unless a configured backend and interactive terminal are available; use tmux when running this check.

### T5.2 — Auth/model selection
**DEFERRED** unless credentials/backend are available. Do not fabricate a successful backend call.

### T5.3 — Cross-platform packaging
**DEFERRED** for platforms not exercised in this Windows environment.

## Report Contract

Write `dev/scratchpad/release-az-test-fid-2026-0731-pre-launch-report.md` with:

1. Exact command/file evidence for every tier.
2. PASS/FAIL/DEFERRED status and friction.
3. Blockers and pre-existing issues.
4. Version-source classification.
5. A fresh Go/No-Go recommendation that treats unresolved release, FID, docs, telemetry, or deferred critical evidence as a No-Go for promotion.
