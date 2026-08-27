# FID: Computer Use — Cua Daemon Adoption and MJPEG Screen Transport

**Filename:** `FID-2026-0824-003-computer-use-cua-daemon-and-mjpeg-transport.md`
**ID:** FID-2026-0824-003
**Severity:** critical
**Status:** analyzed
**Created:** 2026-08-24 01:04
**YAGNI-Compliance:** Verified
**Parent:** FID-2026-0824-008

---

## Summary

Give Savant agents computer-use hands (Maus parity item 3) WITHOUT cursor
hijacking: adopt `@trycua/cua-driver` as an EXTERNAL managed daemon using
OS accessibility trees (UIAutomation on Windows, AT-SPI on Linux) for
background host control, supervised by extending the proven -009 sidecar-
supervisor machinery. Live screen preview streams MJPEG over the existing
gateway WebSocket on BOTH desktop and mobile. Safety: process-class allowlist,
synthetic consent cursor, hardware kill switch. This corrects the research
report's two placement errors (C2: no Rust port; C4: no H.264/WebCodecs v1).

## Environment

- Windows 10+ (UIA), Linux GNOME/X11-first (AT-SPI); macOS deferred.
- Bun sidecar cannot host Rust; daemon runs as a separate managed child process.

## Detailed Description

### Problem

Savant agents have zero computer-use capability — the largest Maus gap.
Naive coordinate-click agents steal focus and make the host unusable while the
agent works.

### Approach

- ADOPT, don't build (C2): run the cua-driver daemon (Maus pins 0.20;
  MIT-family — VERIFY at GREEN) beside the sidecar; reuse the -009 supervisor
  lifecycle FSM (spawn spec, exponential backoff restart, stdin-watchdog,
  env-only credentials) as the management plane. Daemon binaries follow the
  vendored-binary precedent (`sdk/scripts/fetch-ripgrep.ts` manifest pins +
  verify script).
- Background control via accessibility-tree patterns (TogglePattern/
  ValuePattern) — no physical cursor movement, window need not be foreground.
- Transport (C4 correction): Bun has NO built-in H.264 encoder and WebKitGTK
  WebCodecs support is partial/unverified. v1 ships ONE path — MJPEG frames
  over the gateway WS/multipart — consumed by canvas painting on desktop AND
  mobile (Law 13). H.264/WebCodecs recorded as post-v1 upgrade gated on a
  WebKitGTK capability probe.
- Threat model (report §B kept): process-class allowlist (user-configurable
  targetable windows; password managers/terminals/system settings excluded by
  default); synthetic transparent consent cursor painted over the target UI;
  hardware kill switch (global OS hotkey, e.g. Ctrl+Shift+Escape) that severs
  the driver connection and terminates the agent loop outside the React stack.
- Cloud computer-use APIs (Anthropic hosted instances) ANTI-RECOMMENDED for
  local work: latency + cost + local-first violation.

### Proposed Solution Steps

1. License/provenance audit of `@trycua/cua-driver` (+ transitive deps) pasted
   into GREEN record; pin version + platform binaries via vendored-manifest.
2. Daemon supervisor extension in the desktop shell: spawn/restart/watchdog
   reusing supervisor.rs patterns; health probe; kill-switch hotkey handler in
   the Tauri host.
3. Gateway event family: `computer_session_*` zod-literal additions under
   Amendment Gate G1–G4 (blast-radius grep mandatory pre-GREEN).
4. MJPEG capture + frame-pump service in the sidecar (DPR clamp, ≤60fps cap,
   backpressure-aware drop policy); WebView canvas consumer component.
5. Allowlist config UI region + consent-cursor overlay; every local action
   routes through the existing permission broker modes.

### Verification

Desktop typecheck/tests green; E2E probe driving the real daemon in CI-lite
form; kill switch severing verified behaviorally; live smoke carried
NEEDS-REVIEW until real-webview pass.

## Boundaries / Gates

- GREEN gate: license audit must pass before any daemon code lands.
- Host-control default OFF per machine; explicit per-agent opt-in (Maus
  discipline).

## Perfection Loop

### Loop 1 — RED

- **RED:** Zero computer-use code exists repo-wide (Detective sweep). Report's
  Rust-port and WebCodecs claims refuted on repo facts (sidecar is Bun;
  packaging is single-file).
- **GREEN:** Adoption-over-port decision; unified MJPEG transport; safety
  triad (allowlist/consent-cursor/kill switch) imported from report §B.
- **AUDIT:** Batched Verifier PASS (2026-08-24): amendments C1–C7 folded
  consistently; repo citations match Detective evidence; manifest gates match
  this record verbatim; Amendment-Gate discipline verified where new event
  families are proposed. Its one FAIL (missing Author field) was REFUTED at
  ADVERSARIAL.
- **ADVERSARIAL:** STANDS WITH CORRECTIONS (2026-08-24): Author-field FAIL
  refuted (templates/FID-TEMPLATE.md has no Author field;
  scripts/fid-ledger.ts FORBIDDEN_ATTRIBUTION forbids it); its new omission —
  missing required `### Code Verification Evidence` heading — fixed in this
  revision.
- **CHANGE DELTA:** Initial authorship (n/a).

### Missed Questions

1. What if the daemon crashes mid-action? → Supervisor restart ladder + agent
   turn watchdog; partial actions surfaced as failed tool results, never
   silently retried against the host.
2. Multi-monitor? → v1 targets primary display; monitor selection is a
   recorded follow-up.

### Code Verification Evidence

Planning-phase record: no implementation exists yet; verification evidence is
intentionally pending. Repo-path citations were ground-truth-checked during
Loop 1 RED (Detective pass, 2026-08-24); verification gates will be declared
and receipt-stamped per FID-2026-0823-009 before any status flips past
analyzed.

## Resolution

- (pending)