# FID: Voice Pipeline — Local STT, BYO-Key TTS, and Barge-In Call Mode

**Filename:** `FID-2026-0824-004-voice-pipeline-stt-tts-barge-in.md`
**ID:** FID-2026-0824-004
**Severity:** medium
**Status:** closed
**Created:** 2026-08-24 01:04
**YAGNI-Compliance:** Verified
**Parent:** FID-2026-0824-008

---

## Summary

Voice for the command surface (Maus parity item 6), Windows/Linux-first where
Maus is macOS-only: whisper.cpp local STT for dictation and call mode, BYO-key
TTS adapter (Cartesia Sonic-class or ElevenLabs Flash-class, sub-100ms
time-to-first-audio) provisioned through the EXISTING credentials layer, VAD-
driven barge-in with echo cancellation, and markdown-to-speech pre-processing
so code never gets spoken. LLM calls obey the single-model rule (C7a); TTS/STT
are BYO-key/local only (C7b). Savant-Free stance DEFERRED (operator decision
2026-08-24) — recorded as the open boundary below.

## Environment

- Windows 10+/Linux; no reliance on OS dictation APIs (fragmented on both).
- Keys arrive via the existing TS credentials layer; nothing new for secret
  handling in this child (-007 owns upgrades).

## Detailed Description

### Problem

No voice capability exists repo-wide (Detective zero-match on tts/elevenlabs/
whisper/cartesia). Users cannot listen to long-running agent output or call an
agent hands-free.

### Approach (research §C, amended)

- Latency budget: ≤700ms round trip (transport ~100ms + STT ~200ms + LLM TTFT
  ~200ms + TTS TTFA ~200ms). Persistent WS audio stream through the sidecar.
- STT: embedded whisper.cpp quantized base/small — near-zero network latency,
  absolute privacy for ambient mic data, identical behavior on Win/Linux.
- Barge-in: Silero VAD (WASM) detects user speech; cancels TTS playback buffer
  and in-flight TTS request; hardware-level echo cancellation + aggressive mute
  of the STT buffer during TTS playback (risk #5 mitigation — prevents the
  self-transcription loop).
- Markdown-to-speech heuristics (kept verbatim from report): strip fenced
  blocks with synthesized contextual cues ("I have written the implementation,
  thirty lines of TypeScript, displaying it now"); phonetic expansion of
  inline symbols; asynchronous tool-narration cues fill acoustic dead air.
- Anti-recommendation kept: never speak raw code/stack traces/JSON.
- Provider adapter behind one interface so Cartesia/ElevenLabs/OpenAI-class
  endpoints are swappable; OpenAI Realtime demoted to second choice (locks
  the ecosystem, breaks model-agnosticism).

### Proposed Solution Steps

1. Audio I/O seam in the sidecar (capture device selection, level metering,
   echo-cancellation toggle).
2. whisper.cpp integration + model download flow (vendored-binary precedent
   for the native lib; models fetched on demand with size/hash pins).
3. TTS provider adapter + composer affordance + modal call overlay in the
   workspace (regions, not modes — master placement rule).
4. Barge-in pipeline: VAD gate → playback cancel → LLM interruption context.
5. Speech pre-processing module (heuristics above) with unit tests on real
   transcript fixtures.

### Verification

Round-trip latency measured on real hardware and pasted; barge-in loop
regression test (TTS output never re-transcribed); focused suites green.

## Boundaries / Gates

- OPEN BOUNDARY (deferred by operator 2026-08-24): Savant-Free stance — voice
  disabled vs ad-metered. Must be decided before release packaging of voice.
- Voice features unavailable until keys provisioned; graceful degradation
  required (no dead UI).

## Perfection Loop

### Loop 1 — RED

- **RED:** Zero voice code exists; report §C adopted under corrections C7a/C7b
  (single-model rule governs LLM calls; BYO-key only; free-mode deferred).
- **GREEN:** Steps specified; provider-adapter abstraction keeps one truth;
  privacy posture documented (local STT default).
- **AUDIT:** Batched Verifier PASS (2026-08-24): amendments C1–C7 folded
  consistently; repo citations match Detective evidence; manifest gates match
  this record verbatim. Its one FAIL (missing Author field) was REFUTED at
  ADVERSARIAL.
- **ADVERSARIAL:** STANDS WITH CORRECTIONS (2026-08-24): Author-field FAIL
  refuted (templates/FID-TEMPLATE.md has no Author field;
  scripts/fid-ledger.ts FORBIDDEN_ATTRIBUTION forbids it); its new omission —
  missing required `### Code Verification Evidence` heading — fixed in this
  revision.
- **CHANGE DELTA:** Initial authorship (n/a).

### Missed Questions

1. Which TTS ships first? → Adapter-first: whichever provider key the operator
   provisions; no hard-coded vendor preference.
2. Does voice leak transcripts anywhere? → No cloud STT; TTS payloads contain
   only post-heuristic text; keys never reach the webview (existing layer).

### Code Verification Evidence

Planning-phase record: no implementation exists yet; verification evidence is
intentionally pending. Repo-path citations were ground-truth-checked during
Loop 1 RED (Detective pass, 2026-08-24); verification gates will be declared
and receipt-stamped per FID-2026-0823-009 before any status flips past
analyzed.

## Resolution

- **Closed Date:** 2026-09-03 — **Archived:** 2026-09-03 →
  `dev/fids/archive/`
- **Resolution:** CLOSED OUT-OF-SCOPE by operator decision (2026-09-03,
  session: active-FID review). The Maus-parity program was removed from the
  roadmap in its entirety: local STT, BYO-key TTS, and barge-in call mode
  are not planned work. The recorded operator deferral of the voice
  free-mode stance (2026-08-24) is superseded by this closure. Loop 1
  converged design is preserved in this archived record; no implementation
  existed and nothing in the codebase references it.