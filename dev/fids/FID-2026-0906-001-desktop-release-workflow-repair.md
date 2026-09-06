# FID: Desktop Release Workflow Repair (signing-secret preflight + Linux system deps)

**Filename:** `FID-2026-0906-001-desktop-release-workflow-repair.md`
**ID:** FID-2026-0906-001
**Severity:** high
**Status:** fixed
**Created:** 2026-09-06
**YAGNI-Compliance:** Verified
**Related:** FID-2026-0820-011 (archived — packaging ceremony), FID-2026-0903-001
(pipeline integration), FID-2026-0906-002 (pipeline visibility)

---

## Summary

The Savant desktop app has never shipped. v0.0.29 (2026-09-06) was intended as
the first desktop cut, and `desktop-release.yml` failed on two independent,
deterministic blockers: (1) the `TAURI_SIGNING_PRIVATE_KEY` environment secret
is not valid base64, killing the Windows job at signing time after the full
compile; and (2) the Linux job dies immediately because the ubuntu runner has
none of the GTK/WebKit system libraries Tauri requires — the workflow declares
no apt step at all. This FID repairs the workflow so the next dispatch (manual
or pipeline-driven via `DESKTOP_BUNDLES`) can produce verified signed bundles
and the fail-closed updater manifest.

## Environment

- **OS:** Windows 11 host (win32, Git Bash); CI: GitHub Actions
  (windows-latest / ubuntu-latest)
- **Runtime:** Bun 1.3.14-pinned; tauri-cli 2.11.4; Rust 1.97.1
  (`desktop/src-tauri/rust-toolchain.toml`)
- **Commit/State:** `4d85b6b` (v0.0.29 tag target, post phantom-source fix)

## Detailed Description

### Problem

Two platform jobs of `desktop-release.yml` run 34016453164 (dispatched on
`4d85b6b`, created 2026-09-06T06:25:38Z) failed for unrelated reasons, and the
`latest-json` fail-closed job was correctly skipped (`needs: build-desktop`):

1. **Windows — signing secret not decodable.** Tauri's minisign signer
   rejected the secret:

   ```text
   Build windows-x86_64 2026-09-06T07:27:31Z
   failed to decode secret key: failed to decode base64 secret key:
   failed to decode base64 key: Invalid symbol 33, offset 10.
   error: script "tauri" exited with code 1
   ```

   ASCII 33 is `!` — a non-base64 character sits 10 bytes into the secret.
   The full Rust compile (40+ minutes) completed before the failure.

2. **Linux — missing system libraries.** The `glib-sys` build script failed
   before any compilation progress:

   ```text
   Build linux-x86_64 2026-09-06T07:16:28Z
   error: failed to run custom build command for `glib-sys v0.18.1`
   Package 'glib-2.0', required by 'virtual:world', not found
   The system library `glib-2.0` required by crate `glib-sys` was not found.
   ```

### Expected Behavior

Dispatching `desktop-release.yml` with `release_tag: v<version>` produces
signed Windows bundles (nsis+msi) and Linux bundles (appimage+deb) with
`.sig` sidecars, then the fail-closed `latest.json` job validates the
artifact set and emits the updater manifest — the FID-2026-0820-011 Loop 6
contract (Windows proven live 2026-09-03; Linux leg first exercised here).

### Root Cause

1. **Secret integrity is never validated before use.** The pipeline
   (`scripts/public-release/`) asserts secret *presence* at PREFLIGHT, and
   the workflow injects the secret verbatim at the `Tauri build` step
   (`.github/workflows/desktop-release.yml:59-62`). Nothing between the
   paste and the 40-minute compile checks that the value decodes.
2. **The Linux runner's system-dependency surface is undeclared.**
   `grep -c "apt"` over `.github/workflows/desktop-release.yml` returns 0
   and over `.github/workflows/desktop-ci.yml` returns 0. The workflow
   assumes the Tauri Linux build deps pre-exist on the runner image; they
   do not.

### Evidence

- Failure logs quoted above are from `gh run view 34016453164 --log-failed`
  (pulled 2026-09-06); jobs: `Build windows-x86_64: failure`,
  `Build linux-x86_64: failure`, `Fail-closed latest.json: skipped`.
- Workflow structure: `.github/workflows/desktop-release.yml` — Linux matrix
  entry :39-40 (`name: linux-x86_64`, `os: ubuntu-latest`), Tauri build step
  with secret env :59-62, `latest-json` job on ubuntu-latest :85, v-strip
  derivation per FID-2026-0903-001 Loop 1 AUDIT V2.
- Updater chain: `desktop/src-tauri/tauri.conf.json:45-47` — committed
  `pubkey` (minisign public key, comment decodes to
  `untrusted comment: minisign public key: C57CBE59A9F6BF4`) and endpoint
  `releases/latest/download/latest.json`.
- Desktop CI has never compiled the Linux crate to completion:
  `gh run list --workflow=desktop-ci.yml` shows the last 3 runs (2026-09-03,
  2026-09-06 x2) all `failure` at the `Build native sidecar` step
  (`.github/workflows/desktop-ci.yml:77`) — those runs predate the
  phantom-source fix `4d85b6b` and died before cargo. The Linux Tauri build
  surface is 100% unproven on CI.
- The proven packaging ceremony (FID-2026-0820-011 Loop 6, archived) ran
  **Windows-only, locally**: signed `tauri build --bundles msi,nsis` exit 0
  with `.sig` sidecars and a positive 2-platform manifest check. Linux was
  never exercised.

## Impact Assessment

### Affected Components

- `.github/workflows/desktop-release.yml` — new secret preflight step; new
  Linux apt step
- `.github/workflows/desktop-ci.yml` — same Linux apt step (crate-compile
  parity so the Linux leg can go green)
- Operator action (outside the repo): re-create `TAURI_SIGNING_PRIVATE_KEY`
  in the `desktop-updater-signing` environment
- `desktop/scripts/generate-latest-json.ts` — reused unchanged (fail-closed
  manifest generation is NOT this FID's surface)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

The desktop product surface is unshippable until both blockers are fixed.
The CLI release is unaffected.

## Proposed Solution

### Approach

1. **Secret preflight (fail fast, both jobs):** add a workflow step before
   `Tauri build` that base64-decodes `TAURI_SIGNING_PRIVATE_KEY` and exits 1
   with a remediation message when decoding fails. Runtime cost: <1 second.
   The same check must NOT print the secret (Law 12) — decode to `stdout`
   suppressed, report only pass/fail. The Windows job currently wastes 40+
   compile minutes before dying; the preflight moves that failure to second
   one with an actionable message.
2. **Linux system deps (both workflows):** add an apt step to the Linux leg
   installing the Tauri v2 ubuntu build dependencies per the official Tauri
   CI guidance: `libwebkit2gtk-4.1-dev build-essential curl wget file
   libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`. Add to
   `desktop-release.yml` (Linux matrix job) and `desktop-ci.yml` (ubuntu
   matrix entry) so the crate-compile leg and the bundle leg share one
   declared dependency surface. No version pinning: the runner image owns
   package versions (drift is GitHub's contract, not ours).
3. **Operator secret re-paste (outside the repo, blocking):** re-create
   `TAURI_SIGNING_PRIVATE_KEY` in the `desktop-updater-signing` environment
   from the minisign private key, key line only. Local verification before
   saving: `base64 -d` accepts the value. If the source key cannot be
   recovered in clean form, regenerate the keypair — no desktop release has
   ever shipped, so regeneration invalidates nothing; the new public key
   replaces `tauri.conf.json:45` in the same change.
4. **Validation:** first green run is the live proof (both platform jobs +
   `latest-json` positive). Record the run id in this FID at closure.

### Steps

1. [x] RED: workflow-content pins in
       `scripts/public-release-desktop-workflow.test.ts` — 3 new tests failed
       against the unedited YAML (8/3) while all pre-existing pins held
2. [x] GREEN: edit `desktop-release.yml` — preflight step + apt step;
       edit `desktop-ci.yml` — apt step on the ubuntu leg
3. [x] AUDIT: suite 11 pass / 0 fail (parity held); YAML parse-validated
       (python yaml.safe_load, both files); `grep -c "apt"` now returns 8
       (release) and 9 (ci)
4. [ ] Operator: re-paste the signing secret (outside the repo); verify
       decode locally before saving — **`blocked` (operator hands)**
5. [ ] Live: dispatch `desktop-release.yml` on a scratch tag (or the next
       cut's `DESKTOP_BUNDLES` stage) — both jobs green + `latest.json`
       emitted; record the run id and close — **`blocked` (depends on
       Step 4)**

### Verification

- Static: pinned suites green (gates below); both workflows carry the new
  steps (grep-verifiable).
- Live: a full `desktop-release.yml` run concludes `success` on all three
  jobs; artifacts carry `.sig` sidecars; `latest.json` lists both platforms
  with non-empty signatures and the correct URL base.

## Verification Gates

- gate: test scripts/public-release-desktop-workflow.test.ts
- gate: test scripts/public-release-desktop.test.ts
- gate: test scripts/public-release.test.ts
- gate: test scripts/public-release-receipts.test.ts

### Verification Receipt

- fingerprint: sha256:424f2acd52597a06f9bf2dbfcfc68f64d0fbd6786d6193b855146a736151beee
- verified: 2026-09-06T15:05:37.404Z
- test scripts/public-release-desktop-workflow.test.ts: exit 0
- test scripts/public-release-desktop.test.ts: exit 0
- test scripts/public-release.test.ts: exit 0
- test scripts/public-release-receipts.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** release-night audit (2026-09-06) cataloged the two deterministic
  failures with run logs; absence greps for `apt` in both workflows (0
  matches each); desktop-ci run history shows the Linux crate leg never
  completed; the pipeline receipt shows desktop stages never ran
  (`completedStages` ends at `NPM_PUBLISH_CLI`).
- **GREEN (document convergence):** approach reduced to the two workflow
  repairs plus the operator secret re-paste; generator scope explicitly
  excluded (YAGNI — `generate-latest-json.ts` is correct as-is); the
  Windows-first shipping option (matrix reduction) recorded as an operator
  decision, not implemented here (see Missed Questions 1 — it couples to
  the manifest generator's exact platform-key-set assertion).
- **AUDIT (tool-evidenced):**
  - V1 PASS — failure quotes verified against
    `gh run view 34016453164 --log-failed` output pulled this session.
  - V2 PASS — `.github/workflows/desktop-release.yml:39-40` (Linux matrix),
    `:59-62` (secret env on Tauri build), `:85` (latest-json job);
    `grep -c "apt"` → 0 in both workflow files.
  - V3 PASS — `desktop/src-tauri/tauri.conf.json:45-47` pubkey + endpoint.
  - V4 FAIL → corrected: the earlier session claim that GitHub renders
    environment secret fields in a specific way ("plain text fields;
    trailing newline isn't stripped by the secrets API") is **out of
    reach** — it is GitHub-UI behavior, not repo-observable, and the exact
    paste mistake that produced `Invalid symbol 33, offset 10` is not
    recoverable from the CI log alone. Corrected to: the corruption class
    is real (CI-proven), the minisign comment-line-paste hypothesis is
    plausible (the committed public key's decoded comment shows the same
    two-line file shape), and the private secret's exact corruption is
    **NEEDS-REVIEW** — the operator's re-paste resolves it empirically.
  - V5 NOTE — the pubkey/private-key pairing cannot be verified until a
    decodable private key exists; a signing mismatch would surface at the
    first build as a signature-verification failure. The regeneration path
    (Approach 3) is the documented fallback.
- **ADVERSARIAL:** "just ship Windows-only and drop the Linux leg" —
  counter: Linux is half the committed v1 matrix
  (`tauri.conf.json` `bundle.targets` includes appimage+deb) and the
  fail-closed manifest generator asserts the platform key set, so a
  Windows-only cut requires a generator scope change that is deliberately
  out of this FID; reducing the matrix is a recorded operator decision
  (Missed Questions 1), not a silent drop. "Add the preflight check as a
  pipeline PREFLIGHT instead" — counter: the dispatch path runs the
  workflow either way (pipeline or manual); the check must live where the
  secret is consumed. Pipeline-side secret checks remain FID-2026-0906-002
  territory (visibility), and duplicating decode logic into
  `scripts/public-release/` for v1 buys nothing the workflow check misses.
- **CHANGE DELTA:** initial authoring (Loop 1 converged in-document; audit
  correction V4 folded before first presentation).

### Missed Questions

1. *Should the next cut ship Windows-only if the secret is fixed first?* →
   Possible, but it is an operator decision with a coupling: the fail-closed
   generator (`desktop/scripts/generate-latest-json.ts`) asserts the exact
   platform key set of its artifact directory, so a Windows-only manifest
   requires either a generator scope change or accepting no `latest.json`
   for that cut (updater dead until the next full cut). Not implemented
   here; record the decision in this FID if taken.
2. *Does the corrupted secret match the committed pubkey?* → Unknowable
   until the secret decodes (NEEDS-REVIEW). The safe default is Approach 3's
   regeneration path if clean recovery fails; regeneration is free because
   no signed desktop artifact has ever been published.
3. *Why has desktop-ci's Linux leg never compiled?* → The crate job runs
   the sidecar build before cargo (`.github/workflows/desktop-ci.yml:77`);
   the last 3 runs died at that step on pre-`4d85b6b` content (the
   phantom-source bug), and the path filter did not trigger desktop-ci on
   the fix commit (it touched only `cli/src` + `common/src`). The Linux
   cargo leg has never been reached on the current tree — this FID's apt
   step makes the next reach a real test instead of a new failure mode.
4. *Should the pipeline PREFLIGHT also decode-check the secret?* → The
   pipeline runs on the operator host without access to GitHub environment
   secrets (they resolve only inside Actions). The workflow-side check is
   the only trustworthy placement. Pipeline-side surface belongs to
   FID-2026-0906-002 (skipped-stage visibility), not secret handling.
5. *Pin apt package versions?* → No. The runner image owns system-package
   versions; pinning creates maintenance debt against GitHub's drift
   contract. The Tauri-documented package list is the declared surface.

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** `2c1ea600` (fix(desktop): release workflow secret
      preflight + Linux system deps — 4 files, 506 insertions)
- [x] **File:line ranges:** `.github/workflows/desktop-release.yml:60-78`
      (secret preflight step — decode check, remediation stderr, exit 1,
      no secret output), `:80-95` (Linux apt step, 9 packages,
      `if: runner.os == 'Linux'`), `:100` (Tauri build — preflight now
      precedes it);
      `.github/workflows/desktop-ci.yml:75-91` (same apt step, before the
      sidecar build);
      `scripts/public-release-desktop-workflow.test.ts:10,55-63,225-269`
      (readRepoFile helper + 3 new pin tests)
- [x] **Gate output:** `bun test scripts/public-release-desktop-workflow.test.ts`
      → 11 pass / 0 fail / 28 expects (RED baseline was 8 pass / 3 fail);
      full 4-file gate battery → 28 pass / 0 fail (authoring) re-run at
      audit; `bun run lint:md` exit 0; YAML parse OK both files
- [x] **Reproducibility:** `grep -n "Verify updater signing secret"
      .github/workflows/desktop-release.yml` → line 60;
      `grep -n "libwebkit2gtk-4.1-dev" .github/workflows/desktop-ci.yml`
      → line 85; `bun test scripts/public-release-desktop-workflow.test.ts`
      green
- [x] **Step statuses:** Steps 1-3 `implemented` (build output above);
      Step 4 `blocked` (operator: GitHub environment secret — outside
      agent reach); Step 5 `blocked` (depends on Step 4; recorded per the
      anti-deferral gate)
- [ ] **Archived:** (set when moved to `dev/fids/archive/`)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (both workflow files,
      `desktop/src-tauri/tauri.conf.json`, `desktop/scripts/generate-latest-json.ts`)
- [x] Evidence citations verified at the cited lines this session (V2/V3
      above; absence greps pasted in Root Cause)
- [x] Out-of-reach claims marked NEEDS-REVIEW (V4 — secret-corruption
      specifics; V5 — keypair pairing)
- [x] Typecheck/tests/lint pass with pasted tool output (11/0 suite +
      28/0 battery + lint:md exit 0 + YAML parse OK, recorded above and in
      the Verification Receipt)
- [x] Production call-graph evidence — the preflight and apt steps are
      wired into the workflow step lists immediately before `Tauri build`
      (`desktop-release.yml:60,80` → `:100`) and before the sidecar build
      (`desktop-ci.yml:80`); the pin tests assert the ordering, not just
      presence
- [x] FID status reflects the actual implementation state — `fixed`
      (implementation exists, gates green; closure awaits Steps 4-5)

### Loop 2 — Independent audit and self-correction

- **RED:** none remaining in-document; implementation risks are the two
  live boundaries (secret re-paste, first green run).
- **GREEN:** no corrections — Loop 1 already folded V4/V5; re-read of the
  final document found no unevidenced PASS claims.
- **AUDIT:** re-verified the three changed-surface citations
  (`desktop-release.yml:39-40,59-62,85`; absence greps; `tauri.conf.json:45-47`)
  against the working tree — all confirmed unchanged.
- **ADVERSARIAL:** STANDS. The loop boundary holds: no workflow edit has
  been made inside the loop; Steps 1-3 are implementation scope.
- **CHANGE DELTA:** <2% (convergence — no further passes warranted).

### Loop 3 — Structural verification (pre-implementation)

- **RED:** `bun run fid:verify --check` exposed a gate-parser defect: the
  blockquote note inside the Verification Gates section parsed as four
  malformed gate declarations and failed the structural check.
- **GREEN:** blockquote moved out of the gates section into trailing prose;
  the gate list is now the only content under the heading.
- **AUDIT:** `fid:verify --check` re-run at implementation stamps the
  receipt against the corrected section; sibling FID-2026-0906-002 passed
  the same check live (all four shared gates exit 0, run
  2026-09-06T14:29:52Z), which independently proves the gate files exist
  and are green on the current tree.
- **ADVERSARIAL:** the defect was in this document, not the tooling — the
  parser's strictness is the contract (FID-2026-0823-009 allowlist); the
  fix is the document, not the validator.
- **CHANGE DELTA:** ~1% (blockquote relocation only).

### Loop 4 — Implementation audit (post-GREEN)

- **RED:** implementation self-review found one defect introduced and
  fixed mid-edit: the desktop-ci apt step initially lost a shell
  line-continuation backslash after `libayatana-appindicator3-dev` —
  caught by re-reading the edit before any test run (the same class as
  the LEARNINGS cast-surgery rule: re-read the final block).
- **GREEN:** none — the preflight message keeps the secret out of the log
  (pass/fail shape only, Law 12); apt step is shared verbatim between
  both workflows so the two declared surfaces cannot drift.
- **AUDIT:** 11 pass / 0 fail (workflow pins incl. ordering);
  python `yaml.safe_load` parse OK both files; `bun test` 4-file gate
  battery 28 pass / 0 fail; `lint:md` exit 0. Receipt stamped via
  `fid:verify --write`.
- **ADVERSARIAL:** "the preflight is redundant — the Tauri signer already
  rejects bad keys" → counter: the signer rejects them AFTER a 40-minute
  compile inside a job that then reports a stack-trace-shaped error with
  no remediation; the preflight moves the failure to second one with the
  fix instructions. "The apt step belongs in the runner image" → counter:
  the image is GitHub's contract and changes without notice; a declared
  step is the only surface we own.
- **CHANGE DELTA:** document +~15% (implementation evidence folded in;
  document-only change, code untouched).

## Resolution

- (pending — closure after Steps 4-5: operator secret re-paste + first
  green desktop-release run records its run id here. Implementation
  complete 2026-09-06: workflow repaired, 11/0 pins, receipt stamped.)

## Lessons Learned

- **Presence is not integrity.** A gate that asserts a secret exists says
  nothing about the secret being usable; validate the consuming contract
  (here: base64 decodability) as close to the consumer as possible, before
  the expensive work.
- **A CI job's system-dependency surface must be declared, never assumed.**
  The Linux Tauri build failed on libraries the workflow never asked for;
  the first CI exercise of an unproven platform leg is a dependency audit,
  not a build.
- **An unproven platform leg accumulates silent risk.** The Windows-local
  ceremony proved one platform and the project carried Linux as "ready"
  for two weeks; the first real run found it 100% broken. Live validation
  boundaries (FID-2026-0903-001 Step 5) are load-bearing.
