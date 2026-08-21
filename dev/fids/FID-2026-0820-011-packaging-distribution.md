# FID: Packaging & Distribution

**Filename:** `FID-2026-0820-011-packaging-distribution.md`
**ID:** FID-2026-0820-011
**Severity:** high
**Status:** created
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
- **RED:** Not yet run — this FID awaits its implementation-planning session.
- **GREEN:** Not yet run.
- **AUDIT:** Not yet run.
- **ADVERSARIAL:** Not yet run.
- **CHANGE DELTA:** N/A — no document edits beyond planning scaffolding + the pre-RED fold-in above.

### Missed Questions

Not yet conducted — the Loop 1 RED/GREEN missed-questions pass runs with the
implementation-planning session. Questions already answered at authoring
time: the root cause is scoped to desktop packaging only (the CLI release
pipeline exists — master Manifest Sync mandate); signing prerequisites are
operator calendar risks (Apple Developer ID, Azure Artifact Signing
eligibility), not code; the updater is consent-gated by design.

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

- [ ] tauri.conf.json + externalBin
- [ ] macOS entitlements + notarization
- [ ] Windows Azure Artifact Signing
- [ ] Consent-gated updater
- [ ] CI release workflow
- [ ] Cross-platform packaging verified

## Resolution

Not closed. This FID is in the authored state (status `created`); its
Perfection Loop and implementation are gated on the master FID-2026-0820-007
Commit Gate (design doc + five suite FIDs committed to main) AND the signing
prerequisite gate (master Loop 2 rule). This section records the closed
date, fix description, tests added, and verification evidence when the phase
closes.
