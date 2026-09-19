# FID: Secret Redaction Is Key-Name-Based Only — Secret Values Ship To Remote Telemetry

**Filename:** `FID-2026-0919-011-sec4-telemetry-secret-value-pass-through.md`
**ID:** FID-2026-0919-011
**Severity:** medium
**Status:** verified
**Created:** 2026-09-19
**YAGNI-Compliance:** Confirmed (Loop 3 — three deterministic masking
layers; no entropy threshold tuning UI, no remote-side filtering)

---

## Summary

Logger redaction (`cli/src/utils/logger/sanitize.ts`) fires only when a *key*
looks sensitive. Secrets riding under `stdout`, `message`, `content`,
`command`, `input`, or `value` — the exact fields that carry command output,
file contents, and shell commands — pass through untouched. Meanwhile
`sink.ts` ships **raw** payloads to PostHog and the Axiom `/api/logs` sink
for `error`/`fatal` levels (`includeRawData = fullTelemetry || level ===
'error' || level === 'fatal'`). A credential that enters a tool result —
e.g. via FID-2026-0919-008's env inheritance — and is then logged at error
level becomes a remote third-party secret disclosure. The documented,
accepted tradeoff covers *over*-redaction (`tokenCount`); the gap is the
*under*-redacted half.

## Environment

- **OS:** all (CLI logger surface)
- **Language/Runtime:** TypeScript, Bun 1.3.14
- **Tool Versions:** `cli/src/utils/logger/sanitize.ts`, `cli/src/utils/logger/sink.ts`
- **Commit/State:** branch `main`, uncommitted working tree; verified against
  live source 2026-09-19 (Task 66 audit)

## Detailed Description

### Problem

`sanitize.ts:8-14` — the key set:

```typescript
const SENSITIVE_KEYS = new Set([
  'authToken', 'apiKey', 'api_key', 'token', 'accessToken',
  'refreshToken', 'secret', 'password', 'authorization',
])
```

Substring matching (`SENSITIVE_KEY_SUBSTRINGS`, lines 26-32) widens the key
net but still never inspects values. `sink.ts:146-151` (PostHog) and
`sink.ts:185-198` (Axiom) both compute `includeRawData` true for
`error`/`fatal` and ship `sanitizedData` — sanitized only by the key filter.

### Expected Behavior

Before any remote fan-out, the fields known to carry command output and file
content get a value-shape pass: high-entropy tokens and known credential
prefixes are masked. Key-based redaction remains as the first layer.

### Evidence

```text
sanitize.ts:8-14    SENSITIVE_KEYS (key-only)
sanitize.ts:26-32   substring matching — still key-only
sink.ts:146-151     PostHog includeRawData = fullTelemetry || error || fatal
sink.ts:185-198     Axiom same policy; ships sanitizedData verbatim on raw path
docs/security-audit-orchestrator-agent-flow.md  SEC-4 (verified 2026-09-19)
```

## Impact Assessment

### Affected Components

- `cli/src/utils/logger/sanitize.ts` — redaction layer
- `cli/src/utils/logger/sink.ts` — PostHog + Axiom fan-out
- Compounds FID-2026-0919-008 (env leak → error log → remote disclosure)

### Risk Level

- [x] Medium: third-party remote disclosure of credentials; requires the
  secret to enter an error/fatal payload (which SEC-1 makes likely);
  disclosure is permanent (key rotation required)

## Proposed Solution

### Approach

1. Add a value-shape pass in `sanitize.ts` applied to the output-carrying
   fields (`stdout`, `stderr`, `message`, `content`, `command`, `input`,
   `value`, and stringified object values at any depth): mask strings
   matching high-entropy token shapes and known credential prefixes
   (e.g. `sk-`, `Bearer `, `ghp_`, `xoxb-`) with `[REDACTED]`.
2. Conservative thresholds (documented): minimum length ≥ 20, charset
   entropy heuristic — the same over/under-redaction honesty as the
   existing `tokenCount` tradeoff note.
3. Apply before both sink fan-outs (single chokepoint in `sanitize.ts`, so
   PostHog and Axiom inherit the fix symmetrically).
4. Tests: secret-shaped value inside `stdout` masked; short innocent
   strings untouched; key-based redaction unchanged; summary path
   unaffected.

Alternatives considered and rejected:

- *Never ship raw payloads* — removes the debugging value of error
  telemetry; value-masking preserves it.
- *Remote-side filtering* — data has already left the process; too late.

### Steps

1. [x] DONE — `maskSecretValues` in `sanitize.ts` (three layers:
   known-prefix regex; credential KEY=value assignment regex;
   high-entropy token regex with mixed-case+digit requirement).
2. [x] DONE — wired via the single chokepoint: `sanitizeSecrets` applies
   the value pass to the output-carrying fields (`stdout`, `stderr`,
   `message`, `content`, `command`, `input`, `value`, case-insensitive);
   both sinks already consume `sanitizeSecrets`, so PostHog and Axiom
   inherit the fix symmetrically.
3. [x] DONE — `logger-mask-secret-values.test.ts` (8 tests: per-layer
   masking, non-masking guarantees incl. sha256/UUID shapes, nested
   fields, key-redaction unchanged).

### Verification

- New suite green (pasted output); existing logger suites green;
  typecheck cli; eslint `--max-warnings 0`; quality gate.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/utils/__tests__/logger-mask-secret-values.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:1ab28bfcfb334a83377e6e9b13902c3466fb0208b9130446090933787291228b
- verified: 2026-09-19T04:02:50.277Z
- typecheck cli: exit 0
- test cli/src/utils/__tests__/logger-mask-secret-values.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Key-only redaction + error-level raw fan-out verified (lines
  above); report SEC-4.
- **GREEN:** Value-shape pass proposed. Not implemented; awaiting operator
  approval.
- **AUDIT:** Document-level double audit; evidence re-verified on disk
  2026-09-19.
- **ADVERSARIAL:** Will entropy masking corrupt legitimate long strings
  (diffs, base64 assets)? Possibly — thresholds are conservative, masking
  is confined to the enumerated fields, and the summary path (the
  high-volume path) is unaffected. Is client-side masking enough? It is the
  only point where masking is still possible; after fan-out it is not.
- **CHANGE DELTA:** n/a (document creation).

### Missed Questions

1. Should masking apply at `debug`/local console too? → No: local console
   is the operator's own machine; the boundary that matters is remote
   fan-out.
2. Known-prefix list maintenance? → Mirror the credential env names already
   documented in `sdk/src/env.ts`; extend only on recorded recurrence
   (YAGNI).

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** pending G2 (operator commit withheld; no silent
  deferral — presented at turn end)
- [x] **File:line ranges:** `cli/src/utils/logger/sanitize.ts`
  (`maskSecretValues` + `sanitizeSecrets` integration),
  `cli/src/utils/__tests__/logger-mask-secret-values.test.ts` (new)
- [x] **Gate output:** receipt below — typecheck/test/quality all exit 0
- [x] **Reproducibility:** `bun test cli/src/utils/__tests__/logger-mask-secret-values.test.ts`
  → 8 pass / 0 fail; existing key-redaction suite 5 pass / 0 fail
- [x] **Step statuses:** all 3 steps `implemented` (operator-approved
  2026-09-19; no deferrals)

### Code Verification Evidence

- [x] Files referenced in this FID exist and contain the quoted code
  (verified by read 2026-09-19)
- [x] Implementation matches Proposed Solution (value-shape pass; Loop 2
  audit)
- [x] Typecheck/tests/lint pass with pasted output (receipt below)
- [x] No production call-graph change proposed (sanitizer-internal pass)

### Loop 2 — Independent audit and self-correction

- **RED:** Confirmed: key-only redaction + error/fatal raw fan-out;
  env-dump values ride output fields under innocent keys.
- **GREEN:** Implemented with one design refinement over the proposal:
  the assignment regex (credential KEY=value) was added after Loop 1's
  FID-008 interaction analysis — a bare `printenv` dump leaks values whose
  *shape* is unremarkable, so key-name-in-text matching is required.
- **AUDIT:** Static: typecheck cli exit 0; eslint 0; quality PASS;
  receipt gates exit 0. Manual re-read: regex anchors verified against
  live output (masked: `sk-…`, `KEY=value`; preserved: sha256 hex, prose,
  counts).
- **ADVERSARIAL:** (1) Over-redaction of legitimate long mixed-case
  strings in output fields — accepted and documented (same tradeoff class
  as `tokenCount`); confined to output fields, never the summary path.
  (2) `Bearer ` prefix requires a token charset run ≥8 — short JWTs
  unlikely; accepted residual. (3) Case-insensitive field matching could
  mask a user field literally named `Value` — accepted: masking is
  conservative by design.
- **CHANGE DELTA:** `sanitize.ts` +~70 lines (3 regex layers, field set,
  integration); 1 new test file (8 tests); no call-site changes (sinks
  consume `sanitizeSecrets` already).

### Loop 3 — Final convergence

- **RED:** Converged — under-redaction half closed with per-layer tests.
- **GREEN:** Converged — value pass live (uncommitted, G2-pending).
- **AUDIT:** Converged — receipt gates exit 0; eslint 0; lint:md clean.
- **ADVERSARIAL:** Converged — three challenges resolved.
- **CHANGE DELTA:** Final: see Loop 2; none after receipt stamp.

## Resolution

- **Closed Date:** pending G2 commit (operator authorization)
- **Fix Description:** Value-shape masking (credential prefixes,
  KEY=value assignments, high-entropy tokens) applied to output-carrying
  fields before the remote fan-out
- **Tests Added:** `cli/src/utils/__tests__/logger-mask-secret-values.test.ts`
  (8 pass / 0 fail)
- **Verification Evidence:** receipt below
- **Archived:** pending G2 (moves to `dev/fids/archive/` with the commit)

## Lessons Learned

Redaction keyed on names protects structured secrets; secrets in the wild
live in values. Any remote fan-out of raw payloads needs a value-shape
defense at the last point where the process still controls the bytes.
