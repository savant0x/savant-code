# FID: Desktop Attach Defects (updater URL asset-name mapping + stage download layout)

**Filename:** `FID-2026-0906-004-desktop-attach-defects.md`
**ID:** FID-2026-0906-004
**Severity:** high
**Status:** fixed
**Created:** 2026-09-06
**YAGNI-Compliance:** Verified
**Related:** FID-2026-0824-011 (generator fail-closed contract), FID-2026-0903-001
(pipeline integration), FID-2026-0906-001 (closed — desktop workflow repair),
FID-2026-0906-002 (desktop stage visibility)

---

## Summary

Attaching desktop-release run 34050762638's artifacts to the v0.0.29 release
(the operator-approved completion of the desktop channel) exercised the
`DESKTOP_RELEASE` stage surface live for the first time and exposed two
independent defects that no prior test or run could have caught:

1. **Updater URL asset-name mismatch (broken updater, caught pre-release).**
   The manifest generator percent-encodes artifact names
   (`Savant%20Code_…`), but GitHub stores release assets with spaces
   normalized to dots (`Savant.Code_…`) and does **not** alias the encoded
   form — the updater's first download would have 404'd. Caught by
   simulating the updater's fetch chain immediately after upload; the
   manifest was regenerated and re-uploaded before any client saw it.
2. **`DESKTOP_RELEASE` download-layout mismatch (latent pipeline failure).**
   The stage pointed the manifest generator at the `gh run download` root,
   but `gh run download <id> --dir X` (no `-n`) creates one subdirectory
   per artifact name. The stage has never run live (v0.0.29 shipped without
   desktop stages), so the next real cut would have failed closed at the
   generator with "missing artifact" for every platform.

## Environment

- **OS:** Windows 11 host (win32, Git Bash); release: GitHub Releases
- **Runtime:** Bun 1.3.14-pinned; `gh` authenticated as `savant0x`
- **Commit/State:** run 34050762638 built `3e4d7c6e` (the all-green
  FID-2026-0906-001 closure run); attach executed from post-`80a59136` tree

## Detailed Description

### Problem 1 — updater URL vs GitHub asset store

The generator emitted:

```text
url: baseDownloadUrl + '/' + encodeURIComponent(`Savant Code_${version}_x64-setup.exe`)
→ …/download/v0.0.29/Savant%20Code_0.0.29_x64-setup.exe
```

GitHub's asset listing after upload shows the stored names:

```text
Savant.Code_0.0.29_x64-setup.exe        (space → dot)
Savant.Code_0.0.29_x64_en-US.msi
Savant.Code_0.0.29_amd64.deb
```

Live probe (2026-09-06): the `%20` URL returns **HTTP 404**; the dotted
name serves the asset. Tauri's updater downloads exactly the URL in
`latest.json`, so every Windows client would have failed its first update.

### Problem 2 — stage layout vs `gh run download`

`scripts/public-release/desktop-stages.ts` (pre-fix):

```ts
downloadDesktopArtifacts(runRecord.id, artifactDir, ctx.root)
const latestPath = path.join(artifactDir, 'latest.json')
const generate = run('bun', generatorArgs(ctx.version, artifactDir, latestPath), …)
```

But the real download layout is nested per artifact (proven live):

```text
<artifactDir>/desktop-windows-x86_64/Savant Code_0.0.29_x64-setup.exe[.sig]
<artifactDir>/desktop-linux-x86_64/Savant Code_0.0.29_amd64.deb[.sig]
<artifactDir>/desktop-latest-json/latest.json
```

`buildLatestJson` reads bundle + `.sig` **flat** in `artifactsDir`
(`desktop/scripts/generate-latest-json.ts:144-156`), so the stage's
generator invocation would fail closed: `missing artifact` × platform keys.

### Expected Behavior

After attach, the updater chain works end-to-end from the pinned endpoint:
`releases/latest/download/latest.json` → manifest URL → artifact bytes
identical to the CI-signed build.

### Root Cause

1. `encodeURIComponent` is the *URL-theory* mapping; GitHub applies its own
   *asset-store* normalization (spaces → dots) without aliasing. The
   generator's contract was written from theory and only ever verified
   against synthetic names in tests (`Savant Code_0.0.27_...` with
   `encodeURIComponent` mirrored in the assertion) — never against the
   real asset store.
2. The stage was authored against the *expected* flat layout and its test
   suite stubs `downloadDesktopArtifacts`/`uploadDesktopAssets` at the
   function boundary, so the real `gh` layout never reached the generator.
   The defect was invisible until a live run fed the real layout through.

## Impact Assessment

### Affected Components

- `desktop/scripts/generate-latest-json.ts` — URL emission
  (`storedAssetName` mapping)
- `desktop/scripts/generate-latest-json.test.ts` — URL contract pins
- `scripts/public-release/desktop-workflow.ts` —
  `downloadDesktopArtifacts` returns the destination (composition)
- `scripts/public-release/desktop-stages.ts` —
  `flattenDownloadedArtifacts` + stage rewiring
- `scripts/public-release-desktop.test.ts` — flatten-layout pin

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

Defect 1 breaks desktop auto-update for every Windows client (no
workaround client-side); caught and fixed before any client observed it.
Defect 2 would have failed the next real cut closed at `DESKTOP_RELEASE`
(pipeline aborts; no corrupt public state — fail-closed did its job).

## Proposed Solution

### Approach

1. **Generator (RED-first):** pin the real GitHub mapping — the manifest
   URL must target the *stored* name (`spaces → dots`, never `%20`) — then
   implement `storedAssetName()` and use it for every platform URL. The
   `.sig` verification is unaffected: the signature is over the artifact
   bytes, and the dotted URL serves byte-identical bytes (sha256-verified).
2. **Stage (RED-first):** pin `flattenDownloadedArtifacts(downloadedDir,
   parentDir)` — hoist every file out of the per-artifact subdirectories
   into a flat `artifacts-flat` dir, **excluding** `latest.json` (the
   stage regenerates it locally; the CI copy is informational and never
   trusted) — then rewire `runDesktopReleaseStage`:
   download → flatten → generate (into the flat dir) → upload bundles +
   locally-generated manifest. `downloadDesktopArtifacts` now returns its
   destination so the chain composes without globals.
3. **Live verification:** regenerate the v0.0.29 manifest with the fixed
   generator, re-upload via the pipeline's own `uploadDesktopAssets`, then
   simulate the updater end-to-end: pinned endpoint → manifest → artifact
   URL → sha256 round-trip against the original build bytes.

### Steps

1. [x] RED: 2 generator pins fail (`%20` contract + real-name mapping)
       — 9 pass / 2 fail
2. [x] GREEN: `storedAssetName()` in the generator — 11 pass / 0 fail
3. [x] Live: manifest regenerated + re-uploaded to v0.0.29; updater chain
       verified end-to-end (HTTP 200 → 32,790,683 bytes → sha256
       `54a7c2c4…` identical to run 7's build; pinned endpoint identical)
4. [x] RED: stage-layout pin fails at import
       (`flattenDownloadedArtifacts` not exported)
5. [x] GREEN: `flattenDownloadedArtifacts` + stage rewiring — 35 pass /
       0 fail across the four desktop suites

### Verification

- The live updater chain is the primary evidence (Step 3 output below).
- Suite gates: all four desktop suites green (receipt below).

## Verification Gates

- gate: test desktop/scripts/generate-latest-json.test.ts
- gate: test scripts/public-release-desktop.test.ts
- gate: test scripts/public-release-desktop-workflow.test.ts
- gate: test scripts/public-release-desktop-manifest.test.ts

### Verification Receipt

- fingerprint: sha256:19c74699e1c14320b8f14a6e05326ede3e2bde26b896fb018a3c1ec42880b42f
- verified: 2026-09-06T19:32:25.756Z
- test desktop/scripts/generate-latest-json.test.ts: exit 0
- test scripts/public-release-desktop.test.ts: exit 0
- test scripts/public-release-desktop-workflow.test.ts: exit 0
- test scripts/public-release-desktop-manifest.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** defect 1 found by probing the manifest's own artifact URL with
  curl immediately after upload (HTTP 404, 9 bytes) against the asset
  listing (`gh release view --json assets` shows dotted names); defect 2
  found by executing the stage's real download path into a temp dir and
  listing the layout before trusting it.
- **GREEN (document convergence):** fix scope limited to URL mapping +
  download layout; no changes to the signature scheme, platform key set,
  or updater protocol (YAGNI). `latest.json` is regenerated locally, not
  trusted from CI — CI manifest remains an informational artifact.
- **AUDIT (tool-evidenced):**
  - V1 PASS — 404 probe + asset listing quoted above; post-fix probe
    HTTP 200 with byte-identical sha256.
  - V2 PASS — `desktop/scripts/generate-latest-json.ts:144-156` reads
    artifact + `.sig` flat (pre-fix citation); stage pre-fix passed
    `artifactDir` (root) to `generatorArgs`.
  - V3 PASS — real layout listing from the live download (three
    per-artifact subdirectories) quoted in Problem 2.
  - V4 PASS — the dotted URL serves the identical bytes as the original
    build (sha256 `54a7c2c4…` both sides), so the URL rewrite cannot
    mask a corrupted artifact.
- **ADVERSARIAL:** "Rename the uploaded assets to dotted names instead of
  rewriting the URL" — counter: the bundler's `.sig` sidecar names embed
  the artifact name and the updater contract binds manifest URL to
  signature over bytes; renaming upstream assets would desynchronize the
  local ceremony and any operator tooling for zero benefit. "Rename the
  product to avoid spaces" — counter: product renames are outside a
  release-engineering fix and touch every bundler path; the mapping is
  one pure function with pins.
- **CHANGE DELTA:** initial authoring (converged in-document).

### Missed Questions

1. *Why did the generator tests not catch defect 1?* → They mirrored the
   implementation (`encodeURIComponent` in both code and assertion) —
   the classic tautological pin. The new pins encode the *external*
   contract (GitHub's stored name) instead.
2. *Why did the stage tests not catch defect 2?* → They stub both `gh`
   helpers at the function boundary; the real layout lives inside
   `gh run download`. The new pin encodes the real layout as a fixture.
3. *Should `latest.json` from CI be uploaded directly?* → No: the local
   regeneration exit is the fail-closed assertion that every artifact +
   sidecar survived the round-trip; trusting the CI copy would bypass it.
   CI's manifest remains published as an artifact for humans only.

## Resolution

- **Closed Date:** (pending — closes when a real cut's `DESKTOP_RELEASE`
  stage runs green end-to-end using `flattenDownloadedArtifacts`; the
  generator fix is already live-proven on v0.0.29)
- **Fix Description:** `storedAssetName()` (spaces → dots, GitHub asset
  store mapping) in the manifest generator; `flattenDownloadedArtifacts()`
  hoists real `gh run download` layout flat before local regeneration;
  `downloadDesktopArtifacts` returns its destination; stage rewired
  download → flatten → generate → upload.
- **Tests Added:** Yes — 2 generator URL pins + 1 stage-layout pin, all
  RED-first; 35 pass / 0 fail across the four desktop suites.
- **Verification Evidence:** v0.0.29 updater chain live end-to-end
  (2026-09-06): pinned endpoint and per-release URL both serve the
  windows-only manifest; manifest artifact URL HTTP 200;
  sha256 `54a7c2c4…` byte-identical to run 34050762638's build.

## Lessons Learned

- **URL-encoding is a theory mapping; the asset store is the real one.**
  Any generated URL must be pinned against the *external system's stored
  form*, not the encoder's inverse — synthetic-name tests that mirror the
  implementation prove nothing about the world.
- **A stage that shells out to a CLI inherits that CLI's layout.** When a
  helper's real output shape (here: one subdirectory per artifact) is
  load-bearing, pin the shape as a fixture instead of stubbing at the
  helper boundary; first live exercise of an unproven stage is a layout
  audit, not a formality.
- **Probe the updater chain the way the client does.** manifest URL →
  artifact URL → bytes → sha256 took under a minute and caught a
  broken-for-every-client defect after upload but before impact.
