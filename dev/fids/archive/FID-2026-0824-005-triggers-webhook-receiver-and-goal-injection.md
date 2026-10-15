# FID: Triggers — Local Webhook Receiver and Goal-Engine Injection

**Filename:** `FID-2026-0824-005-triggers-webhook-receiver-and-goal-injection.md`
**ID:** FID-2026-0824-005
**Severity:** high
**Status:** closed
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
3. Scheduler: recurrence metadata + tick evaluator + missed-run
   policy (DONE 2026-09-03 — mechanics; v1 amendment: recurrence lives on
   trigger records, not goal metadata; the rail-panel calendar-receipt
   rendering moved to step 5, which already owns the UI pass).
4. Relay opt-in toggle + docs (Funnel/cloudflared setup guides)
   (DONE 2026-09-03 — Loop 4 resolution: toggle = the SAVANT_TRIGGERS=1
   code-side opt-in; relays are external infrastructure forwarding to
   loopback, recipes in docs/triggers-relay.md; per-trigger rate limiting
   added as the real code gap).
5. Rail configuration region (create/edit/rotate/delete triggers) consuming
   the shared comms stores (DONE 2026-09-03 — triggers_* JSON-RPC methods
   + desktop TriggersPanel with calendar receipts; enable/disable rather
   than edit-in-place, secret rotation stays CLI-reachable via the store).

### Verification

Replay/duplication unit tests green; end-to-end probe: webhook → goal resumes
→ agent acts → receipt logged; crash-resume test proves at-least-once.

## Boundaries / Gates

- App-offline deliveries queue nowhere (documented; relay retry semantics are
  the sender's concern — same tradeoff Maus accepts).

## Verification Gates

- gate: test cli/src/server/triggers/__tests__/cron.test.ts
- gate: test cli/src/server/triggers/__tests__/scheduler.test.ts
- gate: test cli/src/server/triggers/__tests__/trigger-store.test.ts
- gate: test cli/src/server/triggers/__tests__/receiver.test.ts
- gate: test cli/src/server/triggers/__tests__/inject.test.ts
- gate: test cli/src/server/__tests__/gateway.test.ts

### Verification Receipt

- fingerprint: sha256:3ff220703a566a3ab4378f803fbea6fce6469830d4a3b7eb8962015f8e9c837e
- verified: 2026-09-03T20:24:03.004Z
- test cli/src/server/triggers/__tests__/cron.test.ts: exit 0
- test cli/src/server/triggers/__tests__/scheduler.test.ts: exit 0
- test cli/src/server/triggers/__tests__/trigger-store.test.ts: exit 0
- test cli/src/server/triggers/__tests__/receiver.test.ts: exit 0
- test cli/src/server/triggers/__tests__/inject.test.ts: exit 0
- test cli/src/server/__tests__/gateway.test.ts: exit 0

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

### Loop 2 — Idempotency layering amendment (FID-document correction)

- **TRIGGER (2026-09-03):** During steps 1–2 implementation (Forge phase,
  post-Loop-1 convergence — see Code Verification Evidence), Loop 1 Missed
  Question 1's resolution proved incoherent: an idempotency key that
  includes the nonce can never detect duplicates, because retries
  regenerate the nonce by definition.
- **RED:** Replay protection and delivery idempotency were conflated into
  one key. They are distinct mechanisms at distinct layers.
- **GREEN (document amendment):** nonce = REPLAY protection (receiver
  layer, in-window cache); (triggerId, eventId) = IDEMPOTENCY (bridge
  layer, dedup pre-drive). Missed Question 1 amended below. The Approach
  section needed no change (it never specified the nonce component).
- **AUDIT:** Unit tests assert the amended contract (same event + fresh
  nonce → duplicate dropped pre-drive; fresh event → delivered; same
  nonce → 401 at the receiver). Implementation evidence is out of scope
  for the loop and lives in Code Verification Evidence.
- **ADVERSARIAL:** Not re-summoned — the amendment corrects an incoherent
  definition, narrows no boundary, and weakens no gate; the next full
  audit runs at closure (steps 4–5 + gates + receipt).
- **CHANGE DELTA:** Missed Question 1 answer amended; this loop record.

### Loop 3 — Scheduler scoping amendments (FID-document corrections)

- **TRIGGER (2026-09-03):** During step-3 implementation (Forge phase,
  post-Loop-1 convergence — see Code Verification Evidence), two Approach
  statements proved impossible or premature as written:
  1. "recurrence metadata on goals": the goal engine is not wired to the
     trigger path (steps 1–2 inject via the gateway run seam); attaching
     schedules to goals would couple the scheduler to a substrate it does
     not drive.
  2. "calendar receipts rendered in the workspace rail panel": step 3's
     deliverable is the scheduler MECHANICS; rendering belongs to step 5,
     which already owns the UI pass.
- **RED:** As authored, step 3 had no implementable home for the
  recurrence state and double-owned the rail UI across steps 3 and 5.
- **GREEN (document amendment):** recurrence + cursor (`nextRunAt`) live
  on trigger records (the store step 1 built, already persisted under the
  config dir); calendar-receipt rendering moves to step 5. The missed-run
  policy (run-latest-on-resume) was already converged and is unchanged.
- **AUDIT:** The amended home matches the FID's own YAGNI guards — no new
  persistence layer, no UI in a mechanics step. Step 3's checkbox updated.
- **ADVERSARIAL:** Not re-summoned — both amendments narrow implementation
  scope toward the converged architecture; no boundary or gate changes.
- **CHANGE DELTA:** Approach step 3 reworded (trigger records; rendering
  to step 5); this loop record.

### Loop 4 — Relay toggle resolution (FID-document correction)

- **TRIGGER (2026-09-03):** During step-4 implementation (Forge phase),
  the Approach's "explicit settings toggle enabling Tailscale Funnel or
  cloudflared" needed resolution: a tunnel MANAGER inside the CLI would
  re-implement two external products the FID itself cites as the
  infrastructure (YAGNI guard violated).
- **RED:** As written, "toggle + docs" had no implementable seam that was
  not either (a) a redundant on/off switch (the code-side opt-in,
  `SAVANT_TRIGGERS=1`, already exists) or (b) an in-process tunnel client
  duplicating `tailscale`/`cloudflared` CLIs.
- **GREEN (document amendment):** the toggle resolves to the EXISTING
  code-side opt-in; a relay is external infrastructure forwarding to the
  loopback receiver (recipes in `docs/triggers-relay.md`). The real code
  gap for internet-facing exposure is RATE LIMITING — added to step 4's
  scope: per-trigger fixed-window limiter on the hook route (active
  always, harmless locally, essential when relayed).
- **AUDIT:** The resolution matches the C3 architecture (local-default,
  relay-opt-in) and the FID's own YAGNI-Compliance: Verified header. No
  boundary changes.
- **ADVERSARIAL:** Not re-summoned — the amendment narrows implementation
  scope onto already-converged architecture; the closure audit below
  covers the full record.
- **CHANGE DELTA:** Approach step 4 resolved (toggle = SAVANT_TRIGGERS;
  relay = external infra + docs; rate limiting added); this loop record.

### Missed Questions

1. Duplicate webhook deliveries? → **(amended Loop 2)** Idempotency key =
   hash(triggerId, eventId); duplicates dropped pre-drive. The nonce is
   REPLAY protection (receiver layer), not an idempotency component — a
   key including it could never detect a retry.
2. Can a webhook inject arbitrary agent instructions? → Payloads are data,
  never prompts; only the fixed directive template interpolates whitelisted
  fields.

### Code Verification Evidence

Forge-phase implementation after Loop 1 convergence (steps 1–3, 2026-09-03;
the FID was converged — Loop 1 ended in an ADVERSARIAL verdict — before any
code was written, per the FSM: the loop runs on this document, code
implementation begins only after convergence).

**Step 3 — scheduler (cron + missed-run policy, 2026-09-03):**

- `cli/src/server/triggers/cron.ts` — dependency-free 5-field cron subset
  (`*`, `*/n`, `n`, `a-b`, lists; DOM/DOW standard OR rule; dow 7 ≡ 0;
  fail-closed parse; day-skip scans bounded at 4 years so Feb-29 schedules
  resolve; impossible dates → null). 16-case battery, boundaries included.
- `scheduler.ts` — PURE evaluator (`dueScheduledFires(store, now)`): base =
  persisted `nextRunAt` ?? `createdAt`; fires exactly the LATEST occurrence
  ≤ now (run-latest-on-resume — the recorded missed-run policy), collapses
  the cursor to the next future occurrence; deterministic
  `eventId = sched-<occurrenceMs>` so double-fires dedupe through the
  bridge's existing (triggerId, eventId) idempotency; invalid stored
  expressions are skipped fail-closed (no fire, cursor untouched).
- Store: `recurrence` + `nextRunAt` fields; `setRecurrence` validates
  fail-closed at set time (throws on invalid; never mutates), `null` clears
  back to webhook-only. v1 amendment (recorded Loop 3): recurrence lives on
  trigger records, not goal metadata — the goal engine is not wired to the
  trigger path yet (steps 1–2 inject via the gateway run seam).
- Wiring: scheduler shares the receiver's deliverOne path (fixed template,
  dedup, 409-busy, stderr outcome log); startup-resume sweep + 30 s tick
  with a reentrancy guard; sweep failures logged, never fatal; timer
  unref'd so it never holds the process open.
- Gates: 43/0 trigger units (16 cron + 6 scheduler + 8 store + 13
  receiver/inject); full cli suite 3468 tests / 256 files / 0 fail
  (NODE_ENV=production preload); typecheck 0; eslint 0 warnings; prettier
  clean. Live E2E smoke (scratchpad, 4/4): trigger seeded with a past
  cursor → real server boot → startup-resume sweep injected the scheduled
  fire (log evidence) → cursor collapsed to the future occurrence →
  receiver healthy. Tick path shares the sweep implementation proven here.

**Steps 4–5 (2026-09-03):**

- **Step 4 — relay enablement (per Loop 4 resolution):** per-trigger
  fixed-window rate limiter in `receiver.ts` (5 deliveries / 60 s, `429` +
  `Retry-After`, DI clock so tests drive the window; enforced AFTER auth —
  auth failures cannot exhaust a bucket — and BEFORE the body read).
  `docs/triggers-relay.md`: enabling triggers, loopback hard-requirement
  rationale, Tailscale Funnel + cloudflared recipes, ngrok
  anti-recommendation (ephemeral URLs), app-offline semantics.
- **Step 5 — gateway management surface:** `GatewayTriggerManager` DI on
  `startGateway` (server-command wires the real store; feature off →
  undefined → methods answer `invalidRequest`, graceful degradation).
  Five authenticated JSON-RPC methods (`triggers_list` sanitized — never
  the secret or its hash; `triggers_create` returns the plaintext secret
  EXACTLY once; `triggers_set_recurrence` null-clears; `triggers_set_enabled`;
  `triggers_delete`), capability list extended.
- **Step 5 — store/evaluator extensions:** atomic create-with-recurrence
  (invalid cron → throw, NO half-record persisted), `setEnabled` toggle
  (absent on legacy records = enabled), scheduler skips disabled triggers
  without touching their cursor (re-enable resumes from the preserved
  cursor — battery-tested).
- **Step 5 — desktop rail panel:** `TriggersPanel` in the workspace right
  rail: calendar receipts (recurrence + next run + last-fired humanized),
  enable/disable, delete, create form (client-side validation; the store
  stays the fail-closed authority), secret-shown-once flow until dismissed,
  capability-gated rendering (off server → quiet "feature off" card).
  Client mirrors: zod schemas + request builders (`gateway-protocol.ts`,
  drift-guarded file), `GatewayClient` methods, capability flag from the
  hello frame (`getTriggersAvailable()`), styles following the fid-queue
  card language.
- **Tests:** store battery extended (3), scheduler battery extended (3:
  disabled-skip, no-cursor-seed, resume-on-enable), receiver battery
  extended (4: flood → 429, Retry-After header, per-trigger independence,
  window reset via DI clock), gateway battery extended (3: full lifecycle
  incl. secret-once + sanitized list, validation errors as `invalidRequest`,
  feature-off degradation), desktop protocol battery (4), panel battery
  (7 pure-function cases).
- **Full-suite audit gates (2026-09-03):** cli 3481 tests / 256 files /
  0 fail; desktop 400 / 0; cli typecheck 0; desktop typecheck 0;
  `bunx eslint . --max-warnings 0` PASS (repo-wide); prettier clean.

**Gate-integrity incidents found and fixed during step 3 (both
pre-existing):**

1. Watchdog-in-runner truncation: `gateway.test.ts`'s in-process
   `runServerCommand` boot armed the stdin-watchdog on the TEST RUNNER's
   stdin; under any piped-stdin harness the watchdog fired
   `process.exit(0)` mid-suite — bun exited green with no summary and
   silently skipped every file after it (80 of 213 cli test files ran;
   the triggers battery never executed in the gate). Fixed with a
   `skipStdinWatchdog` DI seam on `ServerCommandOptions` (production
   wiring unchanged); the full suite now runs 256 files / 3468 tests to
   its summary.
2. Leaked fetch mock: `use-usage-query.test.ts` leaves a mock on
   `globalThis.fetch` after its run (the hazard documented at
   `gateway.test.ts:47` — "some leak the mock"), which turned every later
   fetch-based test into a fake 200. The receiver battery now probes via
   node:http (immune to fetch mocks), following the gateway suite's own
   precedent.

**Steps 1–2 (2026-09-03):**

- **Tests (RED → GREEN):** failing batteries written first —
  `cli/src/server/triggers/__tests__/trigger-store.test.ts` (6 cases),
  `receiver.test.ts` (9 cases, real loopback binds via fetch),
  `inject.test.ts` (4 cases, DI drive seam) — then made to pass: 19/0.
- **Implemented:** `trigger-store.ts` (JSON store under
  `getConfigDir()/triggers.json`, `SAVANT_CODE_CONFIG_DIR` seam, `trg_`/
  `svt_` ids, plaintext secret returned exactly once at create/rotate,
  SHA-256 hash persisted); `receiver.ts` (standalone `Bun.serve` bound
  127.0.0.1 — C3, typed loopback-literal union AND runtime guard for
  untyped callers; gatewayPort+1 Maus pattern; route allowlist
  `GET /health` + `POST /hooks/:triggerId`; auth BEFORE any body read:
  bearer constant-time compare via sha256 + `safeTokenEqual`, timestamp
  ±5 min, nonce replay cache; unknown ids answer 401 identically to bad
  secrets — no enumeration); `inject.ts` (fixed-template directive
  `[SYSTEM TRIGGER: webhook <name>] {single-line payload JSON}` — C5,
  payloads are DATA never prose; idempotency key sha256(triggerId,
  eventId), duplicates dropped pre-drive; busy → 409); gateway seam
  `injectTriggerRun` (`cli/src/server/gateway.ts` — reuses the EXISTING
  run machinery: single-session `activeRun` guard, `pushEvent` to
  connected renderers, `lastRunState` continuation; acknowledge-then-run,
  202 = accepted not completed, mirroring the WS `user_message` path);
  wiring in `cli/src/server-command.ts` (opt-in `SAVANT_TRIGGERS=1`,
  receiver on gatewayPort+1, bind conflict logged never fatal, per-
  delivery outcome stderr log, shared in-memory dedup cache).
- **Implementation audit (Verifier pass):** 19/0 trigger units; gateway
  suite 24/0; cli typecheck 0; eslint 0 warnings; prettier clean. Live
  E2E smoke (ephemeral scratchpad script, 13/13): real server spawn
  (stdin pipe held — the watchdog correctly treats ignored-stdin as a
  dead parent, fail-closed), provider creds stripped so the injected run
  fails fast at the provider layer, full probe set passed: health 200,
  unknown route 404, no-auth 401, bad secret 401, stale timestamp 401,
  missing eventId 400, valid → 202 + "injected" log, same-nonce replay
  → 401, same-eventId fresh-nonce → duplicate (dropped), receiver alive
  after the failed run. The smoke exposed one real seam flaw
  (await-the-whole-run before 202 → head-of-line block under long runs)
  — fixed to acknowledge-then-run before the audit pass.
- **Remaining:** steps 4–5 — implementation evidence intentionally
  pending; verification gates will be declared and receipt-stamped per
  FID-2026-0823-009 at closure.

## Resolution

- **RESOLVED 2026-09-03.** All five steps implemented and audited:
  steps 1–2 (receiver + injection bridge, 13/13 live E2E smoke), step 3
  (cron scheduler + run-latest-on-resume, 4/4 live resume-fire smoke),
  steps 4–5 (rate limiting + relay docs + management RPC + desktop rail
  panel with calendar receipts). Converged decisions D4 (FSM-run-seam
  injection) and C3 (local-default, relay-opt-in) carried through; two
  document amendments (Loops 2–4) resolved approach text that was
  incoherent or premature as written, each recorded with rationale.
  Final audit: cli 3481/0, desktop 400/0, typechecks 0/0, eslint 0
  warnings, prettier clean, lint:md clean. Status → `fixed`.