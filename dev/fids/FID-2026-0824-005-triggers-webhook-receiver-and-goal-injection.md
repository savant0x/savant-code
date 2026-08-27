# FID: Triggers — Local Webhook Receiver and Goal-Engine Injection

**Filename:** `FID-2026-0824-005-triggers-webhook-receiver-and-goal-injection.md`
**ID:** FID-2026-0824-005
**Severity:** high
**Status:** analyzed
**Created:** 2026-08-24 01:04
**YAGNI-Compliance:** Verified
**Parent:** FID-2026-0824-008

---

## Summary

Routines and webhook triggers (Maus parity item 7) implemented as EDGE
TRIGGERS into the EXISTING durable goal engine — no standalone scheduler, no
parallel task queue (D4 selected: FSM goal injection scored 24/25 vs 16/25).
Ingress defaults to a LOCAL-ONLY receiver on loopback with bearer-token auth,
constant-time comparison, nonce + timestamp replay protection; Tailscale
Funnel/cloudflared are OPT-IN relay toggles (C3 correction — a mandatory
two-party account fails Five Questions Q1/Q3).

## Environment

- Desktop sidecar (Bun) binds loopback only; app must run to accept deliveries
  (documented limitation, mirrors Maus).

## Detailed Description

### Problem

Agents are reactive only. There is no way to schedule recurring runs or fire
agent actions from external systems (GitHub, Stripe, CI). The goal engine
(`packages/agent-runtime/src/run-agent-step/goal-driver.ts`, FSM active|
paused|blocked|complete, SQLite checkpointing) already provides persistence,
dedup semantics, and resume-on-crash — building a second executor would split
the source of truth and violate the ZTAP ledger sequence (report D4 rationale
kept).

### Approach

- Receiver: dedicated loopback listener (pattern: Maus's webhook-only port,
  one above the app port) exposing ONLY `/health` + secret `/hooks/...`
  routes. Secrets shown once at creation, rotatable; bearer auth constant-time
  compared; nonce + timestamp headers validated BEFORE any payload touches
  storage or the goal engine (risk #7 mitigation kept).
- Injection: valid triggers construct a synthetic system directive appended
  to the target agent's thread (e.g. `[SYSTEM TRIGGER: webhook GitHub PR #42]`)
  and drive the goal FSM mechanically — the Orchestrator continuation driver
  resumes paused goals; crash-mid-run resumes from checkpoint on reboot
  (at-least-once via existing SQLite checkpointing).
- Schedules: cron-like recurrence stored as goal metadata; missed-run policy
  = run-latest-on-resume (recorded default; configurable later).
- Relays: explicit settings toggle enabling Tailscale Funnel or cloudflared
  for public delivery; receiver remains loopback-bound either way; stable URL
  documented per relay choice. ngrok ANTI-RECOMMENDED (ephemeral URLs).

### Proposed Solution Steps

1. Receiver service in the sidecar (loopback bind, route allowlist, secret
   provisioning + rotation, constant-time compare, nonce/timestamp guard) +
   focused unit battery incl. replay cases.
2. Goal-injection bridge: synthetic directive constructor + FSM drive path +
   dedup idempotency keys.
3. Scheduler: recurrence metadata on goals + tick evaluator + missed-run
   policy; calendar receipts rendered in the workspace rail panel.
4. Relay opt-in toggle + docs (Funnel/cloudflared setup guides).
5. Rail configuration region (create/edit/rotate/delete triggers) consuming
   the shared comms stores.

### Verification

Replay/duplication unit tests green; end-to-end probe: webhook → goal resumes
→ agent acts → receipt logged; crash-resume test proves at-least-once.

## Boundaries / Gates

- App-offline deliveries queue nowhere (documented; relay retry semantics are
  the sender's concern — same tradeoff Maus accepts).

## Perfection Loop

### Loop 1 — RED

- **RED:** No webhook/routine code exists (Detective zero-match). Goal engine
  substrate CONFIRMED at cited paths. C3 correction applied: local-default,
  relay-opt-in.
- **GREEN:** D4 injection design locked to existing FSM; security header set
  imported unconditionally.
- **AUDIT:** Batched Verifier PASS (2026-08-24): amendments C1–C7 folded
  consistently; goal-engine citations match Detective evidence; manifest gates
  match this record verbatim. Its one FAIL (missing Author field) was REFUTED
  at ADVERSARIAL.
- **ADVERSARIAL:** STANDS WITH CORRECTIONS (2026-08-24): Author-field FAIL
  refuted (templates/FID-TEMPLATE.md has no Author field;
  scripts/fid-ledger.ts FORBIDDEN_ATTRIBUTION forbids it); C5 orphan adjusted
  to a master-level invariant note naming this record as an owner
  (fixed-template synthetic directives); its new omission — missing required
  `### Code Verification Evidence` heading — fixed in this revision.
- **CHANGE DELTA:** Initial authorship (n/a).

### Missed Questions

1. Duplicate webhook deliveries? → Idempotency key from (source, event id,
   nonce) hash; duplicates dropped pre-injection.
2. Can a webhook inject arbitrary agent instructions? → Payloads are data,
  never prompts; only the fixed directive template interpolates whitelisted
  fields.

### Code Verification Evidence

Planning-phase record: no implementation exists yet; verification evidence is
intentionally pending. Goal-engine substrate citations were ground-truth-
checked during Loop 1 RED (Detective pass, 2026-08-24); verification gates
will be declared and receipt-stamped per FID-2026-0823-009 before any status
flips past analyzed.

## Resolution

- (pending)