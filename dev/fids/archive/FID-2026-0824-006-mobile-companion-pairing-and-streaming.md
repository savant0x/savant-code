# FID: Mobile Companion — Pairing, Push, and Live Screen Streaming

**Filename:** `FID-2026-0824-006-mobile-companion-pairing-and-streaming.md`
**ID:** FID-2026-0824-006
**Severity:** medium
**Status:** closed
**Created:** 2026-08-24 01:04
**YAGNI-Compliance:** Verified
**Parent:** FID-2026-0824-008

---

## Summary

Phone companion (Maus parity item 8) with NO centralized account backend:
mDNS discovery + QR-code Noise-XX handshake pairing (X25519 identity keys,
persistent trust bond), transcripts/search/approval actions on mobile, blind
ENCRYPTED push relay for notifications (relay never sees plaintext), and live
screen frames as MJPEG ≤5fps over the authenticated channel (unified with the
-003 desktop transport — one path, two consumers). Outside the LAN, traffic
routes over the user's own Tailnet (opt-in) — consistent with the C3
local-default stance.

## Environment

- iOS-first companion (Android recorded as follow-up); desktop side is the
  existing Tauri/Bun stack.

## Detailed Description

### Problem

Long-running autonomous work is invisible away from the desk, and elevated
approvals block overnight/remote runs. No pairing, push, or streaming
substrate exists repo-wide.

### Approach (research §E, amended)

- Pairing: desktop broadcasts mDNS; generates ephemeral X25519 keypair; QR
  encodes pubkey + IP + port; phone initiates Noise XX over LAN; long-term
  identity keys exchanged → persistent bond. FALLBACK (risk #9): manual entry
  of IP + key when multicast is blocked (corporate networks).
- Push: APNs requires a central certificate, so a minimal self-hosted/cheap-
  tier ntfy-class relay forwards BLIND encrypted blobs (encrypted to the
  phone's public Noise key; decrypted on-device). The relay is a dumb pipe by
  construction, not by policy.
- Streaming: MJPEG multipart over HTTP within the authenticated Noise channel,
  hardware JPEG encode, ≤5fps cap, battery-conscious native decode on iOS.
- Anti-recommendation kept: no centralized user-account database, ever.

### Proposed Solution Steps

1. mDNS announcer + QR pairing flow in the Tauri host; Noise handshake lib
   pinned; pairing state persisted on both ends; revocation UI in settings.
2. Manual-pairing fallback screen.
3. Companion client skeleton: transcript browsing, search, approval
   allow/deny cards bound to the same approval events as -002 (one event
   family, three consumers: workspace, deck, mobile).
4. Blind push relay (deployable Docker/free-tier) + APNs forwarding +
   on-device decrypt.
5. MJPEG endpoint gated on pairing; rate/bandwidth caps shared with -003's
   pump configuration.

### Verification

Pairing E2E on real devices (QR + fallback); relay blind-ness asserted by
construction test (server sees only ciphertext); stream latency/battery spot
measurements pasted.

## Boundaries / Gates

- HARD GATE: starts after -003 establishes the MJPEG pump (reuse, not
  duplicate).
- iOS distribution/signing inherits -011 packaging decisions (Windows/Linux
  desktop first; companion timing is independent but shares signing posture).

## Perfection Loop

### Loop 1 — RED

- **RED:** No pairing/push/streaming substrate exists (Detective zero-match).
  Report §E adopted; C3/C4 corrections propagated (Tailnet opt-in; MJPEG only).
- **GREEN:** Blind-relay-by-construction design; three-consumer approval
  event alignment recorded; fallback pairing added.
- **AUDIT:** Batched Verifier PASS (2026-08-24): amendments C1–C7 folded
  consistently; repo citations match Detective evidence; manifest gates match
  this record verbatim (hard gate on -003 MJPEG pump confirmed). Its one FAIL
  (missing Author field) was REFUTED at ADVERSARIAL.
- **ADVERSARIAL:** STANDS WITH CORRECTIONS (2026-08-24): Author-field FAIL
  refuted (templates/FID-TEMPLATE.md has no Author field;
  scripts/fid-ledger.ts FORBIDDEN_ATTRIBUTION forbids it); its new omission —
  missing required `### Code Verification Evidence` heading — fixed in this
  revision.
- **CHANGE DELTA:** Initial authorship (n/a).

### Missed Questions

1. Lost phone? → Revocation list on the desktop bond store; paired-device
   management UI required before v1 ship.
2. Relay outage? → Notifications degrade to LAN-direct delivery; core
   approve/deny still works over Tailnet/LAN without the relay.

### Code Verification Evidence

Planning-phase record: no implementation exists yet; verification evidence is
intentionally pending. Substrate-absence claims were verified by Detective
zero-match sweeps during Loop 1 RED (2026-08-24); verification gates will be
declared and receipt-stamped per FID-2026-0823-009 before any status flips
past analyzed.

## Resolution

- **Closed Date:** 2026-09-03 — **Archived:** 2026-09-03 →
  `dev/fids/archive/`
- **Resolution:** CLOSED OUT-OF-SCOPE by operator decision (2026-09-03,
  session: active-FID review). The Maus-parity program was removed from the
  roadmap in its entirety: mobile pairing (mDNS+Noise), push, and live
  screen streaming are not planned work. The hard gate on -003's MJPEG path
  is moot with -003 closed. Loop 1 converged design is preserved in this
  archived record; no implementation existed and nothing in the codebase
  references it.