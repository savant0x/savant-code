# FID: Packaging & Distribution

**Filename:** `FID-2026-0820-011-packaging-distribution.md`
**ID:** FID-2026-0820-011
**Severity:** high
**Status:** analyzed
**Created:** 2026-08-20 19:04
**Parent:** FID-2026-0820-007

---

## Summary

Implement packaging, code signing, and auto-update via the Tauri bundler and updater. Phase 4 (final).

## Environment

- **Bundler:** Tauri v2 `tauri build` (.app/.dmg, .msi/.nsis, AppImage/deb/rpm)
- **Sidecar:** Bun `--compile` executable declared under `externalBin` (signed alongside the host) —
  packaged under the Rust-target-triple filename produced by the FID-009 rename step
  (`$NAME-$TAURI_ENV_TARGET_TRIPLE[.exe]`)
- **Signing:** Apple Developer ID + notarization (macOS); Azure Artifact Signing (formerly Trusted
  Signing) in CI via Tauri's generic `signCommand` hook (`artifact-signing-cli` — Azure has no native
  Tauri support, tauri#9578; jsign is an acceptable direct-signer alternative)
- **Prerequisite gate (master Loop 2 rule):** this FID may not enter GREEN until Apple Developer ID
  enrollment AND Azure Artifact Signing eligibility (US/Canada identity + paid Azure subscription) are
  confirmed by the operator — or a revised distribution strategy is recorded here. Day-0 checks:
  enrollment/validation takes days-to-weeks
- **Updater:** Tauri updater, consent-gated, GitHub Releases-backed
- **Commit/State:** main @ v0.0.26 (working tree)

## Detailed Description

### Problem

The desktop app needs signed installers and safe auto-updates. Without signing, SmartScreen/Gatekeeper block installation.

### Expected Behavior

- Tauri bundler produces platform artifacts with the Bun sidecar packaged + signed via externalBin
- macOS: Hardened Runtime entitlements for the Bun sidecar — com.apple.security.cs.allow-jit AND
  com.apple.security.cs.allow-unsigned-executable-memory (plus disable-executable-page-protection,
  allow-dyld-environment-variables, disable-library-validation per Bun's codesign guide); notarization via
  notarytool + staple. The entitlements plist MUST be declared via `bundle > macOS > entitlements` in
  tauri.conf.json: the bundler signs sidecars itself WITHOUT custom entitlements unless configured,
  stripping the JIT set and breaking notarization (open issue tauri#11992). Verify with
  `codesign --verify --deep --strict` + `spctl assess` BEFORE upload
- Windows: Azure Artifact Signing via the Tauri `signCommand` hook; timestamp EVERY signature (so they
  survive certificate expiry); the hook runs per-executable (`%1`) — confirm BOTH the host exe and the
  sidecar exe inside the NSIS/MSI are signed, since one unsigned child exe undermines installer-level
  SmartScreen reputation. Post-June-2023 CA/B rules force signing keys into HSM/cloud storage; EV buys
  instant SmartScreen reputation while OV accrues it with download volume
- Tauri updater: signature-verified updates from GitHub Releases; consent-gated (never interrupts an active
  session; applies on restart). Minisign ed25519 keys (`tauri signer generate`) are MANDATORY — signatures
  cannot be disabled; the public key goes INLINE in `plugins.updater.pubkey` (config string, not a file
  path); `latest.json`'s `signature` field carries the `.sig` FILE CONTENTS; `TAURI_SIGNING_PRIVATE_KEY`
  (+ `_PASSWORD`) is NOT read from `.env` files; the whole `latest.json` must be valid for every platform
  or updates break for everyone; consent UX lives entirely in our UI (on Windows the app exits once
  install begins; `installMode`: passive/basicUi/quiet)
- CI: GitHub Actions release workflow building all platforms

### Root Cause

No desktop packaging pipeline exists. The canonical blueprint selects the Tauri bundler.

### Evidence

- Design doc: `docs/design/Savant Desktop App Architecture.md` — distribution and signing sections
- Verified external facts (2026-08-20): Bun --compile supports bun-windows-x64/bun-darwin-arm64
  cross-targets; Bun docs specify the macOS JIT entitlement set; Azure Trusted Signing was renamed Azure
  Artifact Signing and individual identity validation is limited to US/Canada developers with a paid Azure
  subscription
- Verified external facts (2026-08-21 review fold-in): Tauri `externalBin` resolves Rust-target-triple
  filenames; the Tauri bundler signs sidecars without custom entitlements unless
  `bundle > macOS > entitlements` is configured (tauri#11992, open); Azure Artifact Signing integrates via
  the `signCommand` hook (tauri#9578); updater signatures are mandatory minisign ed25519 with the pubkey
  inline in config and the `signature` field carrying `.sig` contents

## Impact Assessment

### Affected Components

- `desktop/` — tauri.conf.json, entitlements, CI workflow
- Release pipeline — new artifact family alongside CLI binaries
- Operator prerequisites (calendar risks, not code): Apple Developer ID; Azure Artifact Signing eligibility
  (US/Canada individual or org verification)

### Risk Level

- [x] High: code signing authority, notarization compliance, external account prerequisites

## Proposed Solution

### Approach

Configure tauri.conf.json + entitlements; wire signing into the existing GitHub Actions release patterns
used for CLI binaries; gate the updater behind consent.

### Steps

1. tauri.conf.json with multi-target config + externalBin sidecar (triple-suffixed filename per FID-009)
2. macOS entitlements.plist (full Bun JIT set) declared via `bundle > macOS > entitlements` + notarytool
   CI job
3. Azure Artifact Signing via Tauri `signCommand` hook with per-executable coverage + timestamps
4. Tauri updater integration (minisign keypair, inline pubkey config, consent-gated, signature-verified)
5. GitHub Actions release workflow
6. Test: package per platform, verify signatures (`codesign --verify --deep --strict` + spctl / signtool,
   host AND sidecar), test update flow, and run the updater negative test (malformed/platform-incomplete
   `latest.json` must be rejected — all-platforms-valid rule)

### Verification

- `cargo check` + `bun run --cwd=desktop typecheck` pass
- Artifacts produced for all targets; codesign verification passes on host AND sidecar
- Update flow: publish test release, verify client detects + applies on restart with consent
- Updater negative test: a malformed or platform-incomplete `latest.json` is rejected; signing private
  keys appear in no committed file, log, or artifact
- Sidecar executes from the bundle (not ASAR — N/A for Tauri; verify externalBin resolution)

## Perfection Loop

### Loop 1 — RED

- **Pre-RED review fold-in (2026-08-21):** operator-requested review amendments applied before RED:
  signing moved from jsign to the Tauri `signCommand` hook path (Environment/Steps), entitlements-via-
  config requirement with tauri#11992 citation (Expected Behavior), updater minisign specifics
  (Expected Behavior), day-0 signing prerequisite gate (Environment, mirroring the master Resolution
  Policy rule), externalBin triple-naming cross-reference, updater negative test (Steps/Verification),
  folded decisions recorded below. RED/GREEN/AUDIT/ADVERSARIAL remain not yet run and will audit this
  amended spec. Master FID-007 Loop 2 records the Manifest Sync.
- **RED:** PASS 2026-08-21 (program-wide pass) — ground-truth verification:
  release-pipeline prior art confirmed (`.github/workflows/build-release-
  binaries.yml` + `scripts/public-release.ts` implement the CLI binary
  release family this FID extends, including the asset-verifier pattern that
  Step 6's all-platforms-valid rule should EXTEND rather than duplicate);
  no `desktop/` workspace or tauri configuration exists yet; the signing
  prerequisite gate remains operator-blocked (Apple Developer ID enrollment
  and Azure Artifact Signing eligibility unconfirmed — calendar risk,
  unchanged).
- **GREEN:** PASS 2026-08-21 — missed-questions pass conducted (10 questions;
  see Missed Questions). TWO PRE-IMPLEMENTATION REQUIREMENTS harden the
  open signing gate and are recorded here: (1) the minisign private-key
  escrow/backup procedure AND key-rotation path must be documented in this
  FID BEFORE the first signed release (a lost key bricks the update channel
  permanently); (2) `TAURI_SIGNING_PRIVATE_KEY` (+ `_PASSWORD`) lives in
  GitHub Actions ENVIRONMENT secrets with required-reviewer approval —
  never repo-wide secrets, never echoed into logs (Law 12). Robust-default
  decisions folded: manual promotion gate instead of canary (no staged-rollout
  infra exists in static-host updater land), latest.json hosted as a GitHub
  Release asset generated FAIL-CLOSED only after both platform artifacts +
  .sig files pass the extended verifier, downgrade refused by design
  (manual reinstall path documented), per-user install default with the
  elevation coupling recorded, delta updates consciously absent (revisit
  trigger >100MB artifacts), SmartScreen reputation monitoring is
  operator-owned weekly cadence, invalid-signature updates abort with a
  user-visible toast and NEVER auto-relaunch into unverified binaries,
  update-check cadence launch + N hours over plain HTTPS with no telemetry
  payload.
- **AUDIT:** PASS 2026-08-21 — the Verifier found no conflict between the
  ten folded answers / two pre-implementation requirements and the FID's
  existing content (including the tauri#9578/#11992 external facts); deep
  body re-check bounded by transcript compaction was noted and resolved by
  the Adversary's disk reads.
- **ADVERSARIAL:** UPHELD 2026-08-21 — no finding against this FID in the
  adversarial disk-resolution sweep.
- **CHANGE DELTA:** loop bullets filled + Missed Questions conducted; the
  two pre-implementation requirements live in this entry until they are
  promoted into the Environment prerequisites at implementation planning.

### Loop 2 — Gate Status Re-recording (2026-08-23 ~23:00 EDT)

- **Trigger:** operator command "run the perfection loop on the master and
  all children" (post-restart session).
- **RED refresh:** the day-0 signing gate is UNCHANGED — still operator-
  blocked on: (1) Apple Developer ID enrollment confirmation and (2) Azure
  Artifact Signing eligibility confirmation (US/Canada identity + paid
  Azure subscription) OR a revised distribution strategy recorded here —
  the two master-gate conditions; plus (3, child-record prerequisite)
  minisign private-key escrow procedure documented in this FID before the
  first signed release. No code progress is possible on Steps 1–6 until
  these land.
- **Routed to operator:** the gate conditions above were presented via
  ask_user (~23:08 EDT) and ANSWERED — see the addendum below.
- **Program position:** sibling children -009/-014 closed+archived; -010
  is the critical path ahead of this FID.
- **Status:** STAYS `analyzed`; the GREEN blocker is LIFTED — the revised
  distribution strategy recorded in the addendum below satisfies the
  master Resolution Policy Loop 2 rule via its recorded-revision route.
- **CHANGE DELTA:** this entry + the addendum + escrow section.

### Loop 2 addendum — Operator Decisions Folded (2026-08-23 ~23:10 EDT)

- **ask_user answered ~23:08 EDT. REVISED DISTRIBUTION STRATEGY RECORDED
  per the master Loop 2 rule — the day-0 signing gate is SATISFIED via the
  recorded-revision route:**
  - (a) macOS: DEFERRED — v1 targets Windows + Linux only; entitlements/
    notarization work moves behind enrollment (Step 2 annotated, not
    deleted).
  - (b) Windows: Azure Artifact Signing NOT ELIGIBLE (no US/Canada identity
    + paid Azure subscription). Revised v1 strategy: locally-built Windows
    artifacts ship UNSIGNED with the documented SmartScreen bypass ("More
    info → Run anyway" support macro, missed-Q8); production code-signing
    re-opens when Azure eligibility changes OR an OV certificate is
    purchased (jsign/direct-signer remains the fallback hook per
    tauri#9578). Step 3 annotated deferred-pending-eligibility.
  - (c) Minisign escrow: DOCUMENTED NOW — see the escrow procedure below;
    satisfies the child-record prerequisite (missed-Q1).
- **Gate consequence:** FID-011 may enter GREEN for the Windows/Linux
  scope (Steps 1, 4, 5, 6; Steps 2–3 deferred per above). The updater
  consent/signature behavior is unchanged — minisign signatures remain
  mandatory for any published update channel.

#### Minisign Key Escrow & Rotation Procedure (documented 2026-08-23)

Satisfies the 2026-08-21 pre-implementation requirement. MUST be complete
before the first signed release.

1. Generation: `tauri signer generate` ONCE, on the operator's machine,
   never in CI.
2. Storage: private key + password live in the operator's password manager
   (primary) PLUS one encrypted offline backup (encrypted archive on
   removable media stored separately from the machine).
3. Recovery: decrypt backup → provide the key via `TAURI_SIGNING_PRIVATE_KEY`
   (+ `_PASSWORD`) → verify by signing a test `latest.json` and validating
   the signature against the committed pubkey.
4. Rotation: Tauri pins the pubkey per manifest — rotation is a deliberate
   one-time migration: generate a new keypair → publish one bridge release
   trusting the new pubkey (manually installed if the running client cannot
   verify it) → retire the old key. Never improvised during an incident.
5. Loss without backup: the update channel is bricked — recovery is the
   same manually-installed bridge release with a new pubkey. Documented so
   it is never improvised.

### Loop 3 — Implementation Increment 1 (2026-08-26)

- **SCOPE:** the unblocked Windows/Linux GREEN surface per the Loop 2
  addendum; updater CLIENT wiring deferred until the operator generates the
  minisign keypair (escrow procedure step 1 — operator-machine action,
  chosen via ask_user "Generate now").
- **LANDED:** (a) `tauri.conf.json` bundle surface extended to the full v1
  matrix (`msi`, `nsis`, `appimage`, `deb`) + `nsis.installMode:
  currentUser` (missed-Q6 coupling honored); (b) NEW fail-closed
  `desktop/scripts/generate-latest-json.ts` — refuses to emit output unless
  EVERY expected platform artifact AND non-empty `.sig` sidecar exists,
  exact platform-key-set enforcement, zod round-trip, https-only download
  base URL (missed-Q4 all-platforms-valid rule); suite **8/0**; (c) NEW
  `.github/workflows/desktop-release.yml` — windows-latest (nsis+msi) /
  ubuntu-latest (appimage+deb) matrix, sidecar built per triple from the
  FID-009 contract (`--entry cli/src/server-command.ts`), updater-signing
  environment secret wired (missed-Q2), manual-promotion draft flow,
  latest.json job fails closed.
- **GATES (tool-mediated):** desktop typecheck exit 0 · generator suite
  8 pass / 0 fail · eslint --max-warnings 0 on all touched files · prettier
  clean ×4 (conf, generator, tests, workflow).
- **HONEST BOUNDARIES:** the CI workflow has not executed live yet (first
  run needs a real release tag); local Linux/Windows bundling untested on
  this host; `createUpdaterArtifacts` and `plugins.updater.pubkey` land
  WITH the keypair in increment 2 — until then the pipeline fails closed
  exactly as designed (.sig files cannot exist without the signing key).

### Loop 3 — Implementation Increment 2: Consent-Gated Updater (2026-08-26)

- **TRIGGER:** operator generated the minisign keypair locally per the
  escrow procedure and supplied the PUBLIC key (after one near-miss where
  the encrypted SECRET key was pasted first — caught by comment-line
  decode before any use; the public key from `<key>.pub` is the value
  pinned below). Escrow steps 1–2 are the operator's completed actions.
- **LANDED:** (a) `tauri.conf.json` — `plugins.updater.pubkey` (inline
  minisign pubkey, config string not file path), `endpoints` →
  `https://github.com/savant0x/savant-code/releases/latest/download/latest.json`,
  `bundle.createUpdaterArtifacts: true`; (b) Rust — `tauri-plugin-updater =
  "2"` dep + registration in `lib.rs` with the never-auto-relaunch note;
  (c) JS dep `@tauri-apps/plugin-updater ^2` + NEW
  `desktop/src/lib/updater.ts` — launch + 4-hour cadence gate over plain
  HTTPS with no telemetry payload (missed-Q10), explicit-consent install
  with Windows app-closes warning in the banner copy, failures map to a
  dismissible error and NEVER auto-relaunch (missed-Q9); pure core
  (cadence/storage/outcome mapping) unit-tested against an injected
  checker, suite **6/0**; (d) App wiring — inline-styled consent/error
  banner mounted in `App.tsx`.
- **GATES (tool-mediated):** desktop typecheck exit 0 · updater suite 6/0 ·
  generator suite 8/0 · eslint --max-warnings 0 on all touched files ·
  prettier clean.
- **HONEST BOUNDARIES:** end-to-end update flow untested until a real
  signed release exists (`latest.json` + platform `.sig` artifacts via CI);
  `cargo check` with the new plugin pending in this session's battery;
  downgrade refusal and version-compare behavior are Tauri defaults,
  exercised only at first release.

### Loop 4 — SHELVED per operator directive (2026-08-26)

- **OPERATOR DECISION:** the desktop app release is "a while" out; this FID
  parks HERE with all code-side work landed and verified. Status STAYS
  `analyzed` honestly — not closed: release-time verification remains.
  Nothing below is lost state; it is the resume point.
- **RELEASE-TIME CHECKLIST (execute in order when desktop release planning
  begins; each item gates the next):**
  1. Add `TAURI_SIGNING_PRIVATE_KEY` + `_PASSWORD` to the
     `desktop-updater-signing` GitHub ENVIRONMENT secret (missed-Q2;
     required-reviewer protection).
  2. Trigger `.github/workflows/desktop-release.yml` on a scratch tag;
     confirm BOTH platform bundle sets + `.sig` artifacts materialize and
     the latest.json job passes (it fails closed by design until 1 lands).
  3. Human smoke-test BOTH installers, then publish the draft (manual
     promotion gate, missed-Q3). Windows SmartScreen bypass macro documented
     per the revised v1 strategy.
  4. Signature verification on host AND sidecar executables (`signtool`
     today; `codesign --verify --deep --strict` + spctl when macOS
     enrollment lands) — one unsigned child exe undermines installer-level
     SmartScreen reputation.
  5. E2E updater flow against a real release: client detects, consents,
     installs on restart; PLUS the negative test — a malformed or
     platform-incomplete `latest.json` must be rejected (all-platforms-valid
     rule).
  6. "Cross-platform packaging verified" step completes ⇒ close THIS FID and
     masters `FID-2026-0820-007` + `FID-2026-0823-003` in one ceremony.

### Missed Questions

Conducted 2026-08-21 (program-wide pass). Authoring-time answers retained:
the root cause is scoped to desktop packaging only (the CLI release pipeline
exists); signing prerequisites are operator calendar risks (Apple Developer
ID, Azure Artifact Signing eligibility), not code; the updater is
consent-gated by design.

1. Minisign private key escrow/backup? Decision (CRITICAL, before first
   signed release): generate once; private key + password live in the
   operator's password manager PLUS one encrypted offline backup; the full
   recovery procedure is written INTO this FID; rotation path documented
   now (Tauri pins the pubkey per manifest, so rotation = deliberate
   one-time migration shipping the new pubkey) so it is never improvised
   during an incident.
2. CI secret storage for TAURI_SIGNING_PRIVATE_KEY? Decision: GitHub
   Actions ENVIRONMENT secrets (not repo-wide) protected by required
   -reviewer approval — mirrors the fail-closed receipt philosophy of
   scripts/public-release.ts; consumed via env var by the Tauri action,
   never echoed or interpolated into logs (Law 12).
3. Staging/canary rollout? Decision: manual promotion gate — latest.json
   for a release is published only after a human smoke-tests BOTH platform
   artifacts; no percentage-canary infra exists in static-host updater
   land (latest.json is all-or-nothing per platform); documented explicitly
   so staged rollout is never assumed.
4. latest.json hosting + all-platform validity enforcement? Decision: host
   as a GitHub Release asset (zero infra); CI regenerates + uploads it ONLY
   after both platform artifacts AND .sig files pass verifier checks; the
   generator FAILS CLOSED if any expected platform artifact/sig is missing
   (extend the existing public-release.ts verifier — Law 13 reuse).
5. Rollback/downgrade policy? Decision: the updater refuses downgrades
   (Tauri default version-compare); previous versions remain manually
   installable via per-release download links; auto-downgrade is a footgun
   with client-side schema/migration drift.
6. installMode/elevation interplay? Decision: per-user install (no UAC)
   stays default so the updater also runs unelevated writing only under
   the user profile; any future per-machine NSIS mode must record that
   updates then require elevation — the coupling is noted NOW so a silent
   toggle cannot break silent updates.
7. Delta updates? Decision: consciously absent — Tauri v2 ships full
   binaries (~10–20MB compressed); revisit trigger recorded (>100MB
   artifacts or measured bandwidth pain).
8. SmartScreen/OV reputation monitoring owner? Decision: OPERATOR-owned
   weekly manual check during early releases plus a support macro
   documenting "More info → Run anyway"; no programmatic API exists —
   named owner prevents ambient nobody-work.
9. Invalid-signature update handling? Decision: the updater aborts and
   keeps the running version (Tauri behavior); UI obligation added — map
   updater error events to a user-visible toast; NEVER auto-relaunch into
   an unverified/rejected binary (hostile-survival question).
10. Update-check cadence/privacy? Decision: check at launch + every N hours
    (config constant); plain HTTPS fetch to the manifest host, no telemetry
    payload; the privacy docs note that the manifest host sees client IPs.

Folded in 2026-08-21 (operator-review, pre-RED): signing eligibility is now a
GATE, not a footnote — FID-011 GREEN is blocked until Apple Developer ID
enrollment and Azure Artifact Signing eligibility (US/Canada + paid Azure)
are confirmed or a revised strategy is recorded; Azure integrates through the
generic Tauri `signCommand` hook because there is no native Tauri support
(tauri#9578); macOS entitlements must ride `bundle > macOS > entitlements` or
the bundler's own sidecar signing strips them (tauri#11992); the updater
requires mandatory minisign keys with the pubkey inline in config, the
`signature` field carrying `.sig` file contents, and `TAURI_SIGNING_PRIVATE_KEY`
is not read from `.env` files.

### Code Verification Evidence

Planning-stage record — status `created`: no implementation exists yet.

- Release-pipeline prior art verified against the working tree 2026-08-20:
  `.github/workflows/build-release-binaries.yml` and `scripts/public-release.ts`
  implement the CLI binary release family this FID extends; no `desktop/`
  workspace or tauri configuration exists yet.
- Gate output: none yet — `cargo check`, per-platform signature verification
  (spctl / signtool), and the update-flow test become the implementation
  AUDIT gates.

## Step Status

- [x] tauri.conf.json + externalBin — full v1 matrix landed 2026-08-26
      (externalBin itself shipped earlier via FID-009); nsis per-user mode;
      createUpdaterArtifacts lands with the minisign keypair (increment 2)
- [ ] macOS entitlements + notarization — DEFERRED (operator decision
      2026-08-23: macOS out of v1 scope)
- [ ] Windows Azure Artifact Signing — DEFERRED-PENDING-ELIGIBILITY
      (operator decision 2026-08-23); unsigned local Windows builds proceed
      meanwhile per the revised strategy
- [x] Consent-gated updater — landed 2026-08-26 (increment 2): pubkey
      pinned, plugin registered, cadence+consent module tested 6/0,
      banner wired; end-to-end flow awaits first signed release
- [x] CI release workflow — desktop-release.yml authored 2026-08-26
      (matrix + fail-closed manifest job); first LIVE execution still
      pending a real release tag
- [ ] Cross-platform packaging verified

## Resolution

Not closed (planning complete; status `analyzed`). The Perfection Loop
converged 2026-08-21 (Loop 1 RED/GREEN plus program-wide-pass AUDIT PASS
and ADVERSARIAL UPHELD). Implementation remains gated on operator actions,
now three: (1) Apple Developer ID enrollment confirmation, (2) Azure
Artifact Signing eligibility confirmation (US/Canada identity + paid Azure)
or a revised distribution strategy recorded here, and (3) the minisign
private-key escrow procedure documented in this FID before the first signed
release (2026-08-21 requirement). The master Commit Gate itself is CLEARED
(`git ls-files` re-verified 2026-08-21). This section records the closed
date, fix description, tests added, and verification evidence when the
phase closes.

2026-08-23 ~23:10 EDT: ALL THREE resolved by operator decisions (see the
Loop 2 addendum) — the revised distribution strategy (macOS deferred;
Windows unsigned-local v1) lifts the GREEN blocker for the Windows/Linux
scope; the escrow procedure is documented above.

2026-08-26: SHELVED per operator directive — increments 1–2 (bundle surface,
CI workflow, consent-gated updater) are landed and verified; the remainder
is exclusively release-time execution captured as the ordered checklist in
Loop 4. Resume there when desktop release planning begins.
