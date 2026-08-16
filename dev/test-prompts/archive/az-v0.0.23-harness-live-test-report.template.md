<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# A–Z v0.0.23 Harness Live Test — Report

**Run date:**
**Commit/worktree identity:**
**OS/platform/arch:**
**Bun version / package version:**
**CLI launch command (this session):**
**Ollama model used:**
**Ollama reachability:**
**Network availability:**
**Baseline `git status --short`:**
**Final `git status --short` (must match baseline):**

## 1. Summary

| Metric | Count |
| --- | ---: |
| Total tests | |
| PASS | |
| OPERATOR-CONFIRMED | |
| FAIL | |
| NEEDS-REVIEW | |
| SKIP | |
| STATIC-only | |

Ledger rows superseded by this run: (list V023-* IDs)

> **OPERATOR-CONFIRMED** = interactive TUI/slash-command surface the in-harness
> agent cannot drive from inside itself; the operator executed the test in the
> live CLI and confirmed the expected behavior. Recorded as operator attestation,
> distinct from harness-observed `LIVE` evidence.

## 2. Result table

| Test ID | Domain | Status | Type | Duration | Evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| AZ-001 | Identity | | | | | |
| AZ-002 | Identity | | | | | |
| AZ-003 | Identity | | | | | |
| AZ-004 | Identity | | | | | |
| AZ-005 | Identity | | | | | |
| AZ-010 | Gates | | | | | |
| AZ-011 | Gates | | | | | |
| AZ-012 | Gates | | | | | |
| AZ-013 | Gates | | | | | |
| AZ-014 | Gates | | | | | |
| AZ-015 | Gates | | | | | |
| AZ-016 | Gates | | | | | |
| AZ-017 | Gates | | | | | |
| AZ-018 | Gates | | | | | |
| AZ-019 | Gates | | | | | |
| AZ-020 | Gates | | | | | |
| AZ-021 | Gates | | | | | |
| AZ-022 | Gates | | | | | |
| AZ-023 | Gates | | | | | |
| AZ-024 | Gates | | | | | |
| AZ-025 | Gates | | | | | |
| AZ-030 | Governance | | | | | |
| AZ-031 | Governance | | | | | |
| AZ-032 | Governance | | | | | |
| AZ-033 | Governance | | | | | |
| AZ-034 | Governance | | | | | |
| AZ-035 | Governance | | | | | |
| AZ-040 | Protocol | | | | | |
| AZ-041 | Protocol | | | | | |
| AZ-042 | Protocol | | | | | |
| AZ-043 | Protocol | | | | | |
| AZ-044 | Protocol | | | | | |
| AZ-050 | Enforcement | | | | | |
| AZ-051 | Enforcement | | | | | |
| AZ-052 | Enforcement | | | | | |
| AZ-053 | Enforcement | | | | | |
| AZ-054 | Enforcement | | | | | |
| AZ-055 | Enforcement | | | | | |
| AZ-060 | Design | | | | | |
| AZ-061 | Design | | | | | |
| AZ-062 | Design | | | | | |
| AZ-063 | Design | | | | | |
| AZ-064 | Design | | | | | |
| AZ-065 | Design | | | | | |
| AZ-066 | Design | | | | | |
| AZ-067 | Design | | | | | |
| AZ-068 | Design | | | | | |
| AZ-069 | Design | | | | | |
| AZ-070 | Design | | | | | |
| AZ-071 | Design | | | | | |
| AZ-072 | Design | | | | | |
| AZ-073 | Design | | | | | |
| AZ-080 | Provider | | | | | |
| AZ-081 | Provider | | | | | |
| AZ-082 | Provider | | | | | |
| AZ-083 | Provider | | | | | |
| AZ-084 | Provider | | | | | |
| AZ-090 | Graph | | | | | |
| AZ-091 | Graph | | | | | |
| AZ-092 | Graph | | | | | |
| AZ-093 | Graph | | | | | |
| AZ-094 | Graph | | | | | |
| AZ-095 | Graph | | | | | |
| AZ-096 | Graph | | | | | |
| AZ-097 | Graph | | | | | |
| AZ-098 | Graph | | | | | |
| AZ-099 | Graph | | | | | |
| AZ-100 | SDK | | | | | |
| AZ-101 | SDK | | | | | |
| AZ-102 | SDK | | | | | |
| AZ-103 | SDK | | | | | |
| AZ-104 | SDK | | | | | |
| AZ-105 | SDK | | | | | |
| AZ-106 | SDK | | | | | |
| AZ-107 | SDK | | | | | |
| AZ-110 | CLI UX | | | | | |
| AZ-111 | CLI UX | | | | | |
| AZ-112 | CLI UX | | | | | |
| AZ-113 | CLI UX | | | | | |
| AZ-114 | CLI UX | | | | | |
| AZ-115 | CLI UX | | | | | |
| AZ-116 | CLI UX | | | | | |
| AZ-117 | CLI UX | | | | | |
| AZ-118 | CLI UX | | | | | |
| AZ-119 | CLI UX | | | | | |

## 3. Failures and findings

For every FAIL: exact command, stdout/stderr, exit code, error message, smallest
reproducible follow-up, and classification.

## 4. Timing observations

| Operation | Baseline | Trials | Median ms | P95/max ms | Status | Notes |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Lightweight startup | | | | | | |
| `/design list` | | | | | | |
| `/design current` | | | | | | |
| Graph refresh | | | | | | |
| Graph export | | | | | | |
| Headless valid/invalid input | | | | | | |
| Release diagnose/preview | | | | | | |

## 5. Findings classification

- `PRODUCT-BLOCKER` —
- `REGRESSION` —
- `SECURITY/PRIVACY` —
- `GOVERNANCE` —
- `UX-FRICTION` —
- `PERFORMANCE-REGRESSION` —
- `PACKAGING` —
- `AGENT-FEEDBACK` —
- `ENVIRONMENT` —
- `NEEDS-REVIEW` —

## 6. Verdicts

- **LIVE FUNCTIONAL VERDICT:**
- **LIVE UX/PERFORMANCE VERDICT:**
- **RELEASE-SAFETY VERDICT:**
- **IMPLEMENTATION/STATIC GATE VERDICT:**
- **CLEAN-RELEASE CERTIFICATION: NOT ESTABLISHED BY THIS TEST**

- **OVERALL VERDICT:** (`PASS` / `PASS WITH CAVEATS` / `NEEDS-REVIEW` / `FAIL`)

## 7. Cleanup confirmation

- [ ] Disposable fixtures removed.
- [ ] Settings/session state restored.
- [ ] `git status --short` identical to baseline.
- [ ] No credentials written or exposed.
- [ ] No commit/tag/push/publish/deploy occurred.
