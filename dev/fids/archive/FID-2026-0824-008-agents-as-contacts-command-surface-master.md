# FID: Agents-as-Contacts Command Surface — Master Architecture

**Filename:** `FID-2026-0824-008-agents-as-contacts-command-surface-master.md`
**ID:** FID-2026-0824-008
**Severity:** critical
**Status:** closed
**Created:** 2026-08-24 01:04
**YAGNI-Compliance:** Verified

---

## Summary

Master architecture FID for the full-build agents-as-contacts command surface:
an evolution of the existing desktop chat workspace (FID-2026-0820-010) into an
agents-as-contacts control room — roster rail, project/fleet thread duality,
inline approvals, computer-use panels, voice, trigger ingress, and mobile
companion. NOT a separate screen (Thinker verdict 5–0 for merge, Law 13).
Parity-plus target is OpenMausBot's capability inventory; uniqueness comes from
governance-native surfaces (ECHO roster, Perfection Loop artifacts, durable
goals, Gravity integrations). Canonical research:
`docs/design/Agents-as-Contacts Architecture Research.md` (Gemini Deep Research,
2026-08-24) — binding only as amended by the corrections table below.

## Environment

- **OS:** Windows 10+, Linux (desktop v1 targets); macOS deferred per -011
- **Language/Runtime:** TypeScript strict monorepo, Bun 1.3.14 (pinned);
  Rust (Tauri host only)
- **Shell:** Tauri v2 + Bun sidecar gateway (JSON-RPC/WS, ephemeral port +
  bearer token) per closed FIDs -0820-008/-009
- **Commit/State:** main @ v0.0.27 prep (working tree, release-only-commits)

## Binding Amendments to the Research Report

The report is fit-to-seed ONLY after these corrections (Thinker review,
2026-08-24). Each child FID inherits them.

| # | Report claim | Corrected position |
|---|---|---|
| C1 | keyring-rs "in the Tauri sidecar" | keyring-rs lives in the Tauri HOST (only Rust surface), exposed via Tauri commands; sidecar receives secrets via the env-only spawn channel (-009 pattern). Audit `sdk/src/credentials.ts` FIRST (Law 7) |
| C2 | Port UIA logic into Rust | Adopt `@trycua/cua-driver` as external managed daemon (Maus-proven at 0.20), supervised by extending -009 supervisor machinery; vendored-binary manifest pins; license audit = GREEN gate |
| C3 | Tailscale Funnel as THE ingress | Local-only 127.0.0.1 receiver (bearer + nonce + timestamp) is DEFAULT; relays are opt-in toggles |
| C4 | H.264/WebCodecs desktop preview | MJPEG everywhere for v1 (Bun has no H.264 encoder; WebKitGTK WebCodecs unverified); H.264 = post-v1 upgrade gated on capability probe |
| C5 | Build progressive compaction | 4-layer context compactor ALREADY EXISTS; route comms events through it; zero new machinery |
| C6 | Parallel SQLite schema | Extend `cli/src/utils/db-storage.ts`; ALL new event families enter PrintModeEvent as zod-literal additions under Amendment Gate G1–G4 with mandatory pre-GREEN blast-radius grep |
| C7a | Per-agent model switching | REJECTED — hard project rule: the UI-selected model is the only model project-wide (operator confirmed 2026-08-24). Per-agent routing OUT OF SCOPE |
| C7b | Voice providers | BYO-key only via existing credentials layer; Savant-Free stance DEFERRED (operator 2026-08-24) — open boundary on -004 |
| C7c | Unverified repo citations | Every FID cites Detective-verified paths only (see Loop 1 RED); unverified claims become GREEN-gate verification items |

## Suite Manifest

| Child | Scope | Hard gate |
|---|---|---|
| `-009` Workspace regions (roster rail, fleet/project threads) | Chat workspace evolution | `-010` Steps 4–7 land first |
| `-003` Computer use (cua daemon, MJPEG transport, kill switch) | Highest-risk subsystem | license audit at GREEN |
| `-004` Voice pipeline (whisper.cpp STT, BYO-key TTS, barge-in) | Ambient interaction | free-mode stance decision |
| `-005` Triggers (webhook receiver, routines → goal injection) | Proactive execution | none |
| `-006` Mobile companion (mDNS+Noise pairing, push, stream) | Remote control | after -003 MJPEG path exists |
| `-007` Security (keychain upgrade, consent UX) | Trust layer | credentials audit first |

## Resolution Policy

- Master STAYS `created`→`analyzed` until ALL children close; closes when the
  last child closes.
- Sequencing guard: `-009` implementation may not begin until `-010` Steps 4–7
  are complete; children build on the completed chat surface, never in parallel
  with its foundation.
- Operator decisions recorded 2026-08-24: suite approved as proposed; single-
  model rule retained; voice free-mode deferred.
- All new event families respect Amendment Gate G1–G4 (FID-2026-0820-008
  amendment discipline; G3 synthetic-fixture markers; G4 zero SessionState/goal
  symbol references in floor modules).
- C5 invariant ownership (Adversary-adjusted 2026-08-24): comms-surface content
  enters agent threads ONLY via compactable summaries routed through the
  EXISTING 4-layer compactor — owners: `-009` (timeline hygiene keeps raw
  payloads out of thread context) and `-005` (synthetic directives are
  fixed-template short strings). No new machinery (YAGNI).

## Perfection Loop

### Loop 1 — RED

- **RED:** Ground-truth pass over the research report before seeding (Detective
  + Thinker, 2026-08-24). CONFIRMED: goal engine FSM at
  `packages/agent-runtime/src/run-agent-step/goal-driver.ts:21`;
  `common/src/types/print-mode.ts:224` discriminated union (zero
  audio/computer/pairing events); Tauri host Rust surface
  (`desktop/src-tauri/gateway.rs:36-89` env-only token); sandbox engine exists
  (`packages/agent-runtime/src/tools/sandbox/engine.ts`). BONUS: CSWSH
  mitigation partially shipped — `cli/src/server/gateway.ts:534` enforces Origin
  allowlist + bearer token on WS upgrade. REFUTED/CORRECTED: C1–C7 above.
- **GREEN:** Corrections folded as binding amendments; suite structure authored;
  operator decisions recorded (suite approval, single-model rule, voice defer).
- **AUDIT:** Batched suite Verifier (2026-08-24): 5/6 criteria PASS across all
  seven records — corrections C1–C7 folded consistently, citations
  evidence-matched, gates verbatim-consistent, Amendment-Gate discipline
  present wherever new event families are proposed. One FAIL (missing Author
  field ×7) and one NEEDS-REVIEW (-007 sandbox-gate.ts path).
- **ADVERSARIAL:** STANDS WITH CORRECTIONS (2026-08-24): Author FAIL REFUTED
  (templates/FID-TEMPLATE.md has no Author field; scripts/fid-ledger.ts
  FORBIDDEN_ATTRIBUTION forbids it — adding it would CREATE a violation);
  sandbox-gate.ts NEEDS-REVIEW upgraded to PASS (exact glob match at
  packages/agent-runtime/src/tools/tool-executor/sandbox-gate.ts);
  C5-orphaned ADJUSTED to master-level invariant (owners -002/-005, note in
  Resolution Policy); new OMISSION caught — required
  `### Code Verification Evidence` heading missing ×7 — fixed in this
  revision. Statuses flipped to `analyzed`.
- **CHANGE DELTA:** Initial authorship (n/a).

### Missed Questions

1. Does a second chat surface risk drift? → Yes; resolved by merging into the
   workspace (no third center-canvas mode; Deck stays the WATCH surface).
2. Who owns secrets today? → Existing TS credentials layer
   (`sdk/src/credentials.ts`) with storage integration tests; keychain upgrade
   is incremental (-007), never green-field.
3. Is the gateway already hardened against CSWSH? → Partially; origin+bearer
   enforced at `gateway.ts:534`. New endpoints inherit the same gate (-007
   verifies and extends).

### Code Verification Evidence

Planning-phase master: no implementation exists yet; verification evidence is
intentionally pending. All repo-path claims in this record were ground-truth-
checked during Loop 1 RED (Detective pass, 2026-08-24) and re-audited at
ADVERSARIAL; per-child verification gates will be declared and receipt-stamped
per FID-2026-0823-009 as each child reaches fixed/verified.

## Resolution

- **Closed Date:** (pending — closes when all children close)