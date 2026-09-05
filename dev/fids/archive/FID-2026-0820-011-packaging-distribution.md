# FID: Packaging & Distribution

**Filename:** `FID-2026-0820-011-packaging-distribution.md`
**ID:** FID-2026-0820-011
**Severity:** high
**Status:** closed
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

### Loop 5 — Release-readiness audit + local bundling smoke (2026-09-03)

- **TRIGGER:** operator decision "ship it now" — the Loop 4 checklist is
  ACTIVE. This pass executed everything agent-executable without the
  minisign private key or a GitHub dispatch.
- **AUDIT findings:** (a) workflow re-read — dispatch-based
  (`workflow_dispatch` with `release_tag` + optional `source_ref`),
  environment-scoped secrets (`desktop-updater-signing`), fail-closed
  latest.json job: all as designed. (b) NEGATIVE TEST executed live:
  `generate-latest-json.ts` against an empty artifacts dir refuses with
  exit 1 naming every missing artifact + `.sig` sidecar per platform
  (all-platforms-valid rule proven outside its unit suite). (c) **RELEASE
  BLOCKER FOUND AND FIXED:** `build-sidecar.ts` checked `--entry` against
  the RAW relative path — resolved from process cwd. Via
  `bun run --cwd=desktop` (workflow AND local), cwd is `desktop/`, so the
  workflow's `cli/src/server-command.ts` could never resolve — the
  sidecar step would have failed on first dispatch. Fix: relative entries
  resolve against a repo-root anchor derived from `import.meta.dir`
  (path-intrinsic; canonical rule `no-environment-dependent-guards`); two
  new regression tests incl. one pinning the workflow's exact entrypoint
  exists on disk. Gates: desktop suite 389/0 (5671 expect), typecheck
  exit 0, eslint `--max-warnings 0` exit 0. (d) Sidecar compile re-run
  with the workflow's EXACT invocation: wrote
  `src-tauri/binaries/savant-sidecar-x86_64-pc-windows-msvc.exe` (1,218
  modules). (e) **LOCAL BUNDLING SMOKE (Loop 3 boundary partially
  DISCHARGED):** `tauri build --no-bundle` Finished release profile in
  3m32s — `savant-desktop.exe` built with tauri-plugin-updater v2.10.1
  compiled in. The `--no-bundle` limit is deliberate: full bundling with
  `createUpdaterArtifacts: true` requires the signing key env — checklist
  item 1 must precede item 2, as ordered.
- **REMAINING (all operator-executed, in checklist order):** item 1
  secrets (DONE 2026-09-03: environment `desktop-updater-signing` created
  with the operator as required reviewer; both secret names verified
  present) → item 2 CI validation run → items 3–6 smoke, signature
  verify, E2E updater + negative test, closure ceremony.
- **G5/G6 CONSTRAINT on item 2 (recorded 2026-09-03):** the public remote
  is release-only (Solo Git Workflow standard); the sidecar entry-fix and
  this audit batch are local-only until the next release cut or an
  explicit operator push decision. A dispatch against `main` before the
  fix reaches the remote would compile the OLD build-sidecar and fail at
  the sidecar step (the exact defect fixed in Loop 5). Compliant paths:
  (a) the fix rides the next release cut (`bun run release:public`), then
  dispatch with `source_ref: main`; (b) operator authorizes an out-of-band
  push of the fix to main; (c) interim LOCAL verification — operator
  exports `TAURI_SIGNING_PRIVATE_KEY`(+`_PASSWORD`) in the local shell and
  runs the full `tauri build` with bundling, producing real `.sig`
  artifacts locally (no remote interaction; the CI-only remainder becomes
  the fail-closed latest.json job + draft-release flow at cut time).
  Dispatch uses a branch/tag ref, never a SHA (LEARNINGS dispatch-ref
  lesson); release_tag is bare semver matching the app version
  (`0.0.28`), not the CLI's `v`-prefixed tag style — alignment noted.
- **Status:** STAYS `analyzed` (release-time checklist unexecuted).
- **CHANGE DELTA:** this entry + the build-sidecar fix (~5% of document).

### Loop 6 — CI triage: desktop-ci run 33707308289 (2026-09-03)

- **TRIGGER:** operator asked to "check the desktop-release CI run result and
  triage any failures." Finding: NO `desktop-release.yml` run has ever been
  dispatched (the batch is uncommitted/unpushed; dispatch never happened).
  But the release push of 02:21Z did trigger `desktop-ci.yml` run
  33707308289 — **failed on all 3 platforms at "Build native sidecar
  (externalBin contract)"** on pre-fix code.
- **SECOND ROOT CAUSE FOUND AND FIXED (independent of the Loop 5 cwd
  bug):** CI log: `error: Could not resolve:
  "../../agents/bundled-agents.generated"` (`cli/src/utils/
  local-agent-registry/init.ts:11`). That generated module is GITIGNORED
  (only the `.d.ts` stub is tracked); it is produced by
  `cli/scripts/prebuild-agents.ts` — a step NEITHER desktop workflow ran
  (the CLI binary pipeline does: `cli/scripts/build-binary-main.ts:56`).
  Fresh CI checkouts can never contain it; the local file existed
  (regenerated 10:27 today), which is why the Loop 5 smoke passed.
- **FIX:** both workflows gain a `Generate bundled agents bundle` step —
  `bun run --cwd=cli prebuild:agents` — immediately before the sidecar
  build (desktop-ci.yml + desktop-release.yml).
- **VERIFICATION (cold-checkout simulation):** deleted
  `bundled-agents.generated.ts` + `-data/` → ran the exact workflow
  invocation → generator exit 0, 40 chunk modules regenerated → sidecar
  rebuilt from the fresh bundle, exit 0 (1,218 modules, contract filename
  written). Gates: desktop suite 389/0, eslint `--max-warnings 0` exit 0,
  lint:md exit 0, prettier clean on both workflow files.
- **STATUS:** checklist item 2 still waits on the commit/push decision —
  this fix now rides the same batch as the Loop 5 fix.
- **VALIDATION SCAFFOLD:** `desktop-ci.yml` gains `workflow_dispatch`
  (on-demand run, no main pressure) and its push/PR paths filter now
  covers the prebuild inputs (`agents/**`, `cli/scripts/prebuild-agents.ts`,
  `cli/package.json`) so agent-suite changes retrigger the sidecar E2E.
  Sequencing (honest boundary): the dispatch trigger only exists on the
  remote AFTER this batch lands — so the validation order is: push batch
  (already authorized) → `gh workflow run desktop-ci.yml -R
  savant0x/savant-code` → confirm green on all 3 platforms → only then
  dispatch `desktop-release.yml` for checklist item 2. The CI scaffold
  is deliberately release-independent: validating the prebuild fix no
  longer has to wait for a cut.
- **LOCAL SIGNED-BUNDLE E2E (2026-09-03, throwaway-key method):** proved
  the entire env→bundle→`.sig`→manifest machinery locally without touching
  the escrowed real key. Throwaway minisign keypair generated to temp
  (`tauri signer generate --write-keys`, empty password), exported as
  `TAURI_SIGNING_PRIVATE_KEY`(+`_PASSWORD`) exactly as CI injects them,
  then the REAL bundling: `tauri build --bundles msi,nsis` → exit 0,
  `Finished 2 bundles` + `Finished 2 updater signatures` (`.msi.sig` +
  NSIS `..._x64-setup.exe.sig`). The NSIS output name exactly matches the
  generator contract. Tauri's `secret key does not match plugins >
  updater > pubkey` warning is expected for a smoke key and itself proves
  keypair identity is validated at build time. Manifest both ways against
  the real bundle outputs: Windows-only dir → FAIL-CLOSED exit 1 naming
  both missing Linux artifacts, zero output written; completed set (Linux
  placeholder pair real-signed via `tauri signer sign` — AppImage bundling
  cannot run on Windows) → exit 0, `latest.json` written, 2 platforms,
  schema-valid, signature file contents embedded, URLs percent-encoded.
  Throwaway key + smoke artifacts destroyed afterward; bundle outputs
  confirmed gitignored.
- **BOUNDARY (honestly narrowed, not closed):** this discharge covers
  build-time signing + manifest generation mechanics ONLY. It does NOT
  prove (a) the REAL minisign key works — its first live use remains the
  CI run; (b) Linux native bundling (placeholder was real-signed, not
  bundled); (c) installer run-time smoke; (d) the updater E2E update
  loop. Checklist items 3–6 still stand.
- **CHECKLIST ITEM 3 PARTIALLY DISCHARGED — WINDOWS INSTALLER SMOKE
  (2026-09-03, live on this host):** NSIS (per-user): silent `/S` install
  → exit 0; files `savant-desktop.exe` + `savant-sidecar.exe` (externalBin
  contract fulfilled in the real installer) + `uninstall.exe` in
  `$LOCALAPPDATA/Savant Code`; complete HKCU uninstall entry (name, 0.0.28,
  publisher, location, uninstall string). LAUNCH: desktop + sidecar
  processes live; updater performed its first REAL remote check against
  the pinned endpoint → surfaced `Update check failed: Could not fetch a
  valid release JSON` — expected and correct: endpoint proven
  `302 → 404` (no latest.json published until items 2–5), and the app
  failed gracefully instead of crashing. Sidecar exited when parent was
  killed (zombie path confirmed in the real installed runtime). Silent
  uninstall → dir + registry gone; WebView2/CLI app-data retained by
  design. MSI (per-machine): non-elevated `/qn` → 1603 / Error 1925
  (insufficient privileges; silent mode can never surface UAC — rolled
  back clean); ELEVATED silent install → exit 0, files + real 112 MB
  sidecar in Program Files, product registered under MSI GUID key
  `{6379D363-…}`; elevated silent uninstall by product code → exit 0,
  fully removed. **SAVANT AGENT NOT TOUCHED:** `{809F686D-…}`
  (`C:\Program Files\Savant`, v0.4.5, publisher `savant`) is the Savant
  AI agent — a DIFFERENT program in the same family; verified intact
  after the cycle. Windows smoke = PASS; Linux installers + macOS remain
  CI/operator (other-host) territory.
- **INCIDENTAL FINDS (smoke):** (1) MSYS path-mangling variant: `/S` was
  converted to a Windows path on the first NSIS attempt (silent install
  silently no-oped; `MSYS_NO_PATHCONV` fixes it — new arg-form of the
  known `/tmp` trap); the same env ALSO breaks real `C:\` path args,
  flipping the failure mode. (2) MSI `InstallLocation` property records
  LOCALAPPDATA while files verifiably install to Program Files —
  cosmetic WiX/tauri quirk worth knowing in support. (3) First NSIS
  attempt also revealed install root is `$LOCALAPPDATA/Savant Code`
  (not the `Programs/` subdir some NSIS generators use).
- **BLANK-CONSOLE BUG FROM THE SMOKE — FOUND, FIXED, VERIFIED
  (2026-09-03):** operator reported a blank console window for
  `savant-sidecar.exe` at launch. Root cause: release shell is
  GUI-subsystem (`main.rs` `windows_subsystem = "windows"`) and the
  sidecar is console-subsystem; `spawn_sidecar`
  (`desktop/src-tauri/src/supervisor.rs`) set no creation flags, so
  Windows allocated the child its own visible console. Never seen in
  dev (debug shell owns a console the child inherits). Fix:
  `CREATE_NO_WINDOW` (0x0800_0000) applied in release builds only —
  debug keeps the console for direct log visibility. Verified END-TO-END:
  NSIS rebuilt with the fix (throwaway key #2, destroyed after),
  reinstalled, launched, probed via `Get-Process` — sidecar
  `MainWindowHandle = 0` (no window; desktop still "Savant Code
  v0.0.28"), then uninstalled clean. Also swept pre-existing
  `cargo fmt` drift in `sidecar_env_vars` (CI's `fmt --check` never ran
  past the broken sidecar step — latent gate break). Rust gates: fmt
  --check OK, clippy -D warnings clean, 14/14 crate tests.
- **WIX `InstallLocation` AUDIT (2026-09-03, closes the quirk):** the
  MSI Property table (19 properties, read via WindowsInstaller COM) has
  NO authored `InstallLocation` — the value is computed by Windows
  Installer at install time from directory resolution, and Tauri's WiX
  template resolves it per-user/per-machine conditionally (the failed
  non-elevated attempt's per-user INSTALLDIR leaked into ARP). ARPPRODUCTICON/
  ProductName/ProductVersion all correct. VERDICT: cosmetic ARP display
  skew only; uninstall-by-product-code removes everything correctly
  (component registration, not the property, drives removal). FILED AS
  NOTE, no fix warranted.
- **UNINSTALL-COMPLETENESS NOTE (from fix-verification cycle):** NSIS
  uninstall removes only what it installed; the running app had written
  `tree-sitter.wasm` into the install dir at runtime, which survived
  uninstall (removed manually). Minor gap, cosmetic for per-user
  scope; recorded for awareness, no action this cycle.
- **UPDATER POST-CUT VERIFICATION (queued):** once the release cut
  publishes `latest.json` to the pinned endpoint, relaunch the installed
  app and confirm the update check succeeds ("up to date" / no error) —
  closing the loop opened by the smoke's `302 → 404` graceful failure.
  The batch (19 files, incl. this fix) remains intentionally unpushed
  per G5/G6 release-only standard.
- **CHANGE DELTA:** this entry + two workflow edits (~4% of document).

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
      recorded 2026-08-23); re-homed to successor FID-2026-0903-001 scope
- [ ] Windows Azure Artifact Signing — DEFERRED-PENDING-ELIGIBILITY;
      re-homed to successor FID-2026-0903-001 scope
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
- [x] Cross-platform packaging verified — Windows LIVE 2026-09-03 (both
      installers, full install→launch→uninstall cycles, signed-bundle E2E
      via throwaway key, updater first-check graceful); Linux/macOS covered
      by the CI matrix contract, live verification rides the successor FID's
      first cut

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

CLOSED 2026-09-03: the release-time remainder was executed as a local
ceremony (Loop 5/6: signed-bundle E2E, installer smoke Windows both
flavors, blank-console fix + verification, WiX audit, CI prebuild fix +
dispatch scaffold) and the operator then re-homed the standing release-time
process into the automatic release system — successor FID-2026-0903-001
(desktop packaging as pipeline stages) carries the integration work and
any deferred macOS/Azure scope. Nothing is lost: the re-homing table in
the successor FID maps every Loop 4 checklist item to its new owner.
Fresh gate battery at closure: desktop suite 389/0, Rust crate 14/14
(fmt --check + clippy -D warnings clean), eslint 0, typecheck 0, lint:md 0,
prettier 0 warnings.

## Verification Gates

- gate: typecheck desktop
- gate: test desktop/scripts/build-sidecar.test.ts
- gate: test desktop/scripts/generate-latest-json.test.ts

### Verification Receipt

- fingerprint: sha256:1b8d0f37e963a457e94bac619d851b844afb562a91305fb1e9e6c13acfe9207d
- verified: 2026-09-03T16:39:52.361Z
- typecheck desktop: exit 0
- test desktop/scripts/build-sidecar.test.ts: exit 0
- test desktop/scripts/generate-latest-json.test.ts: exit 0
