# FID: Code Universe Offline Sci-Fi Sound Effects

<!-- markdownlint-disable MD013 -- Long source paths, command evidence, and generated-contract examples are intentionally preserved verbatim. -->

**Filename:** `FID-2026-0807-007-code-universe-offline-sci-fi-sound-effects.md`
**ID:** FID-2026-0807-007
**Severity:** medium
**Status:** closed
**Created:** 2026-08-07
**Author:** Savant / Orchestrator
**YAGNI-Compliance:** Verified

---

## Summary

The self-contained Code Universe export currently provides visual interaction feedback but no sound layer. The user wants sci-fi feedback for button clicks, folders and documents opening/closing, navigation, search, reset/fit actions, and unavailable/error states. The export must remain a single offline HTML artifact opened from `file://`, with no network requests, no external audio directory, no autoplay failure that blocks the interface, and no accessibility regression. The approved direction is a curated local sound bank embedded into the generated HTML, with a small procedural fallback for micro-interactions and a first-interaction audio unlock, visible mute control, and volume control.

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** TypeScript, Bun 1.3.x, generated browser HTML/JavaScript
- **Frontend/export runtime:** Self-contained HTML, Sigma.js/Graphology export, Canvas ambient effects, Web Audio API where available
- **Relevant project paths:** `cli/src/commands/graph-export/template.ts`, `cli/src/commands/__tests__/graph-export.test.ts`, `dev/test-prompts/graph-export-e2e.ts`, and `packages/knowledge-graph/src/export-serializer.ts`
- **External reference:** Kenney UI Audio is listed by its publisher as 50 assets under Creative Commons CC0: `https://kenney.nl/assets/ui-audio`
- **Browser reference:** `AudioContext.resume()` resumes a suspended context and returns a Promise: `https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume`
- **Commit/State:** Working tree after implementation; six verified audio assets, generator, runtime wiring, tests, and binary packaging are present.

### Verified asset provenance

- **Official page:** `https://kenney.nl/assets/ui-audio`
- **Official archive:** `https://kenney.nl/media/pages/assets/ui-audio/490d233f68-1677590494/kenney_ui-audio.zip`
- **Archive SHA-256:** `946fc23a63d535d693eb31b2eabb80c8c28d6351e2186b344ceb71b2cb1d5eb6`
- **License:** `cli/src/commands/graph-export/audio/License.txt`, Creative Commons Zero (CC0); attribution is appreciated but not required.

| Cue | File | Bytes | Duration (s) | SHA-256 |
|---|---|---:|---:|---|
| `click` | `click1.ogg` | 4,983 | 0.093832 | `59175ac17cd49a68dd736285738441287636112a84a6f7ce0d89921bda5a5360` |
| `open` | `switch1.ogg` | 6,104 | 0.314694 | `efdd1d1e2904fb2d81259cd96bb80101caceae94be02baa4b5310714a6708b19` |
| `close` | `switch2.ogg` | 6,042 | 0.297211 | `aa8ad6e4745e87c84c24a0335e0e0f8629ccbbc474ccfd544fe07d7f3a1b2280` |
| `confirm` | `switch3.ogg` | 6,270 | 0.367143 | `75d87dc60b7d29df838530af8c9e28205102234e07b5f1e849aa3d95c3922bd0` |
| `warning` | `switch4.ogg` | 6,477 | 0.419592 | `687a42c24e5d25be1a256f35a439fe858548fe76d43ccfb17db546618b0d36db` |
| `travel` | `switch5.ogg` | 6,181 | 0.314694 | `8a5c85c0009cfd985634e8fdb4e0350690be5d85fd49f43a90b35c7de0bef7c0` |

Durations were derived from Ogg Vorbis maximum granule position at 44,100 Hz because `ffprobe` and `ogginfo` were unavailable in the build environment. All six files were identified as Ogg/Vorbis, stereo, 44.1 kHz. Raw selected audio total: 36,057 bytes. The repository copy is under `cli/src/commands/graph-export/audio/`.

## Detailed Description

### Problem

The Code Universe has no audio feedback. Users receive no acoustic confirmation when clicking a control, entering a system, drilling into a folder, opening a document, going back, searching, fitting/resetting the universe, or encountering an unavailable document. Adding external audio URLs or relative file fetches would violate the export's offline single-file contract and fail or become unreliable under `file://` security rules.

The current template exposes the relevant interaction entry points:

- `cli/src/commands/graph-export/template.ts:104-108` — header action buttons.
- `cli/src/commands/graph-export/template.ts:446-494` — document rendering and image fallback.
- `cli/src/commands/graph-export/template.ts:495-526` — folder, up/back, file, and pagination actions.
- `cli/src/commands/graph-export/template.ts:540-552` — fit/reset behavior.
- `cli/src/commands/graph-export/template.ts:577-601` — graph node and edge navigation.
- `cli/src/commands/graph-export/template.ts:638-646` — motion toggle and exported handlers.

### Expected Behavior

1. The generated HTML remains self-contained and works without network access or sibling asset files.
2. Audio is locked before interaction; no audible playback or decode is attempted during page load.
3. On the first non-SFX user gesture, the manager resumes the context and plays that gesture's mapped cue if enabled. The first SFX-control click is special: it resumes the context, leaves SFX enabled, updates `aria-pressed="true"`, and plays the toggle cue once if resume succeeds. It never requires a second click and never disables sound on first use.
4. A visible SFX control opens a compact menu containing an `aria-pressed` mute/enable button and an `input type="range"` volume control with an accessible label. The default is enabled after unlock at master gain `0.4`; the initial locked state is visually represented.
5. Sound feedback is short, restrained, and event-driven; hover and continuous ambience are silent/disabled in this FID.
6. Sound is suppressed when muted, when the browser has no usable Web Audio API, when the context cannot resume, or when decoding fails.
7. The first implementation embeds exactly the files listed by a generated manifest from `cli/src/commands/graph-export/audio/`. The manifest is the single source of truth; no runtime file reads or relative fetches are allowed. The generated payload format is one inert `<script type="application/json" id="savant-audio-data">` block containing cue, MIME, byte count, duration, hash, and data-URI fields. Source/license URLs remain repository-only manifest metadata and are not copied into the generated audio payload.
8. The initial curated bank contains exactly 6 clips, one per cue family: `click`, `open`, `close`, `confirm`, `warning`, and `travel`. Exact filenames and SHA-256 hashes are recorded in the manifest/license record before implementation. If provenance or source bytes cannot be verified, implementation must stop rather than substitute unverified assets.
9. Procedural Web Audio provides fallback cues for `click`, `toggle`, `confirm`, and `warning`; rich embedded clips are optional for `open`, `close`, and `travel`.
10. All sound calls are best-effort and never prevent navigation, document rendering, search, reset, or graph interaction from completing.
11. `prefers-reduced-motion` remains respected for visual motion. Sound preference is independent and explicit.
12. Document and image viewers remain functional when audio is disabled or unavailable.

### Root Cause

No audio manager, audio control, embedded audio asset registry, or sound event map exists in the generated export. The current HTML template contains inline graph data, SVG/branding assets, and an inline application script, but no audio capability or policy boundary. The current `file://` export contract prevents relying on `fetch()` of relative audio files. Modern browsers may create `AudioContext` in a suspended state and require a user gesture followed by `resume()` before playback can proceed.

### Evidence

```text
Current hook evidence:
cli/src/commands/graph-export/template.ts:104-108 — reset, fit, and motion buttons.
cli/src/commands/graph-export/template.ts:446-494 — document/back/image-error paths.
cli/src/commands/graph-export/template.ts:495-526 — folder/up/file/pagination paths.
cli/src/commands/graph-export/template.ts:540-552 — fit/reset paths.
cli/src/commands/graph-export/template.ts:577-601 — node/edge navigation paths.
cli/src/commands/graph-export/template.ts:638-646 — motion toggle and browser handler exports.

Required absence checks, run against the Code Universe source paths:
--- AudioContext|webkitAudioContext ---
NO-MATCH
--- data:audio|<audio ---
NO-MATCH
--- fetch(.*audio|audio.*fetch ---
NO-MATCH
--- UniverseAudio|soundRegistry|playSound|playCue ---
NO-MATCH

Research evidence:
- Kenney's official UI Audio page identifies the pack as 50 assets and CC0 licensed.
- MDN documents AudioContext.resume() as the operation that resumes a previously suspended context and returns a Promise.
- Exact selected asset filenames and hashes remain a pre-implementation provenance gate.
```

## Impact Assessment

### Affected Components

- Generated Code Universe HTML in `cli/src/commands/graph-export/template.ts`
- New manifest and license record under `cli/src/commands/graph-export/audio/`
- Graph export contract tests in `cli/src/commands/__tests__/graph-export.test.ts`
- Live generated-artifact harness in `dev/test-prompts/graph-export-e2e.ts`
- Potential generated artifact size and export performance budgets

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

Primary risks are payload bloat, browser autoplay restrictions, accidental sound repetition, asset-license ambiguity, and regressions in the generated inline script. The feature is additive and must degrade silently to visual-only interaction.

## Proposed Solution

### Approach

Implement a shared, inline `UniverseAudio` manager in the generated export with three layers:

1. **Curated embedded CC0 bank:** Embed exactly 6 verified local clips, mapped to `click`, `open`, `close`, `confirm`, `warning`, and `travel`. The generator reads the checked-in manifest at build time and emits exactly one inert `<script type="application/json" id="savant-audio-data">` payload. It never reads files from the export at runtime. Source/license URLs remain in the repository manifest only.
2. **Procedural fallback:** Generate tiny `click`, `toggle`, `confirm`, and `warning` cues with Web Audio oscillators, filters, and gain envelopes. This keeps micro-feedback available if a bundled buffer cannot decode or buffer playback is unavailable.
3. **Central policy manager:** Lazily create/resume `AudioContext` on the first user interaction, decode/cache buffers lazily, cap overlapping voices, expose `unlock`, `play`, `setEnabled`, `setVolume`, and `dispose`, and turn every failure into a no-op with no uncaught exception.

The implementation must not fetch audio from a URL, start a background ambience loop, or tie audio activation to page load. A visible SFX control beside the existing universe actions contains an accessible mute/enable button and volume range. Its default master gain is `0.4`, its range is `0.0`–`1.0`, and its step is `0.05`.

### Approved Event Map

| Event | Cue | Default |
|---|---|---:|
| Primary button click | `click` | Enabled after unlock |
| SFX toggle | `toggle` procedural | Enabled after unlock |
| System/folder open | `open` | Enabled after unlock |
| Folder up/back/document close | `close` | Enabled after unlock |
| Document open | `open` | Enabled after unlock |
| Unavailable/error | `warning` | Enabled after unlock |
| Search success | `confirm` | Enabled after unlock |
| Search miss | `warning` | Enabled after unlock |
| Fit/reset universe | `travel` | Enabled after unlock |
| Hover | Silent | Disabled |
| Continuous ambience | Not included | Disabled |

Sound dispatch is centralized. Calls happen after the associated action is scheduled or committed, so audio failure cannot interrupt the action.

### Audio, artifact, and voice budgets

- Exactly 6 embedded clips are permitted by this FID.
- Per-clip source limit: `<= 100 KiB` and `<= 2 seconds`.
- Embedded sound registry limit: `<= 512 KiB` after final HTML serialization, including base64 and metadata.
- Added final artifact limit: `<= 600 KiB` over the deterministic no-audio baseline export.
- If either limit is exceeded, the implementation fails validation and must reduce/convert assets; it may not silently raise the budget.
- Maximum simultaneously active voices: 4. Low-priority cues may be dropped rather than queued.
- No audio decode on initial page load. Decode occurs on first cue/use after unlock.
- No network references in generated audio payloads or audio source metadata.
- Same manifest bytes and event registry must produce deterministic output.

### Accessibility and browser policy

- Audio is locked before interaction. On the first non-SFX gesture, the manager creates/resumes the context and plays that mapped cue only if resume succeeds and enabled is true.
- The first SFX-control click resumes the context, leaves enabled state on, sets `aria-pressed="true"`, plays the toggle cue if resume succeeds, and gives visual status; it never requires a second click or toggles sound off on first use.
- Default state after a successful first unlock is enabled at gain `0.4`. If resume/decode fails, the control remains usable, the state is marked unavailable/silent, and graph actions continue.
- Muting immediately prevents future playback and disconnects/stops active voices.
- The volume range is keyboard accessible, labeled, clamped to `0.0`–`1.0`, and updates the master gain without reload.
- No sound preference persistence is required in this version; deterministic defaults win.
- Reduced motion controls visual animation only. Audio requires the explicit SFX state.
- No audio is the sole indication of a state; every cue accompanies visible status or content change.
- Missing `AudioContext`, suspended/closed contexts, decode failure, malformed data, and blocked playback are handled without uncaught exceptions.

### Steps

1. Verify and check in exactly 6 short source clips under `cli/src/commands/graph-export/audio/`, with a manifest containing cue name, filename, byte count, duration, MIME, SHA-256, source URL, and license identifier.
2. Add a generator helper that reads the manifest and emits a deterministic inline registry. Reject missing files, hash mismatches, unsupported MIME, or budget overflow during generation.
3. Add a small audio manager to the generated application script. Keep its public surface limited to `unlock`, `play`, `setEnabled`, `setVolume`, and `dispose`.
4. Add the SFX control and accessible volume interaction to the header action area.
5. Wire the centralized event map to button, system, folder, document, search, reset/fit, and unavailable-document paths.
6. Add procedural fallback cues for `click`, `toggle`, `confirm`, and `warning`.
7. Add static, generated-script, and fake-`AudioContext` tests for unlock, mute, volume, voice cap, decode failure, no-network policy, and fallback behavior.
8. Extend the live graph-export E2E harness to verify the generated SFX control, inline registry, no external audio references, and graceful audio markers.
9. Regenerate the real export and compare its size with the no-audio baseline.
10. Run implementation audit, typecheck, focused CLI tests, live E2E, ESLint, Prettier, and markdownlint.

### Verification

- `cli` typecheck passes.
- Existing graph-export and container tests pass with no regressions.
- Generated application script parses with `vm.Script`.
- Generated HTML contains an accessible SFX button and labeled range control.
- Sound registry contains exactly 6 entries with verified hashes and byte counts.
- Sound registry has no `http://` or `https://` audio source and no relative audio fetch.
- Final serialized registry is `<= 512 KiB`; final artifact growth is `<= 600 KiB` over the no-audio baseline.
- Fake-`AudioContext` tests verify first-gesture unlock, rejected resume, decode rejection, mute cancellation, volume clamping, and four-voice cap without uncaught errors.
- No auto-play-on-load path exists; no audio decode occurs before unlock.
- Each approved event path reaches centralized `play` dispatch, verified by source search and generated-script inspection.
- Live E2E verifies final artifact sound markers and the existing document viewer regression guard.
- Human speaker output remains `NEEDS-REVIEW`; automated tests may verify calls and state but not physical audio.

## Perfection Loop

### Loop 1 — RED

- **RED:** No audio manager, sound registry, SFX control, or sound event calls exist. Exact hook evidence is at `template.ts:104-108`, `446-494`, `495-526`, `540-552`, `577-601`, and `638-646`. Required absence checks returned `NO-MATCH` for `AudioContext|webkitAudioContext`, `data:audio|<audio`, `fetch(.*audio|audio.*fetch`, and `UniverseAudio|soundRegistry|playSound|playCue` in Code Universe source. The export is self-contained and must not introduce relative audio fetches. Browser research confirms suspended-context/user-gesture behavior. Official Kenney page, archive, CC0 license, archive hash, six file hashes, byte sizes, and derived durations are now recorded above.
- **GREEN:** Narrowed the design to exactly 6 checked-in, hash-verified clips, a deterministic manifest, a single inline registry format, exact source/final-artifact budgets, a concrete SFX button plus `0.0`–`1.0` range at default `0.4`, first-gesture unlock semantics, procedural fallback, fake-audio runtime tests, and no ambience/hover sounds. The six verified assets are staged under `cli/src/commands/graph-export/audio/`.
- **AUDIT:** Implementation audit initially found four gaps: stale test imports, procedural voice accounting, provenance metadata leaking into runtime JSON, and initialization/fit audio activation. Those were corrected in `audio.ts`, `template.ts`, the test suite, and the E2E harness. Final focused tests passed 19/19; CLI typecheck, ESLint, Prettier, and markdownlint passed.
- **ADVERSARIAL:** Final review confirmed the six verified assets, no runtime source/license metadata, explicit silent initialization, pending+active four-voice accounting in the generated manager, graceful decode/resume failure, and no dependency on audio for navigation. The only remaining boundary is physical speaker output, marked `NEEDS-REVIEW`.
- **CHANGE DELTA:** Implemented offline audio registry and Web Audio runtime, copied assets for compiled binaries, added fake-context/static/E2E coverage, regenerated the real export, and recorded final budget evidence.

### Missed Questions

1. **Should sound be on at page load?** → No. The user selected first-interaction unlock; no auto-play or audible initialization is allowed.
2. **Should the whole pack be embedded?** → No. Exactly 6 selected clips are sufficient; whole-pack embedding is unnecessary payload and maintenance debt.
3. **Should every hover produce a sound?** → No. Hover is silent to avoid repetitive noise and voice storms.
4. **Should continuous ambience ship now?** → No. It introduces autoplay, accessibility, focus, and performance risks; it is a separate future decision.
5. **What if Web Audio is blocked or absent?** → All actions remain visual and functional; sound calls become guarded no-ops.
6. **How should reduced motion affect sound?** → It should not automatically toggle sound. Visual motion and explicit SFX preference are separate controls.
7. **What source assets are legally safe?** → Only exact files with primary-source license evidence, hashes, and checked-in manifest records are eligible. If exact provenance cannot be verified, stop before coding.
8. **Should preferences persist across exports?** → No persistence is required; deterministic default behavior wins.
9. **What is the first interaction if the user clicks the SFX control?** → The control unlocks audio, toggles state, and updates visual status in one action.
10. **What is the failure policy for decode errors?** → Use procedural fallback for supported cues and otherwise remain silent; never block graph/document navigation.
11. **What is the exact test boundary?** → Fake `AudioContext` tests verify state transitions and calls; human audible output remains `NEEDS-REVIEW`.
12. **What happens if the pack exceeds the budget?** → Generation fails with a clear error; assets are reduced or converted, and the FID budget is not raised silently.

### Loop 1 — FID AUDIT GATE

- **Status:** COMPLETE — implementation, focused verification, live E2E, lint/format, and artifact measurement passed.
- **Final audit boundary:** The generated browser manager is intentionally inline but remains a separate implementation from the TypeScript fake-context seam. Fake-context tests cover the policy contract; generated HTML parsing/static contract checks and live E2E cover the emitted browser surface. Pending-cap, procedural-fallback, and bootstrap behavior are verified by generated-source assertions rather than an executable browser AudioContext. Physical speaker output remains `NEEDS-REVIEW` because CI cannot verify human-audible output.

## Code Verification Evidence

- [x] Relevant current template, test, and E2E paths inspected.
- [x] Existing sound implementation absence checked with exact `NO-MATCH` output.
- [x] Browser autoplay/resume behavior researched from MDN.
- [x] Candidate CC0 pack researched from the publisher's official page.
- [x] Exact selected source files, hashes, license record, archive hash, byte counts, and derived durations recorded above.
- [x] Implementation files exist — `cli/src/commands/graph-export/audio.ts:52-85` validates hashes, budgets, and emits the inert `savant-audio-data` registry; `cli/src/commands/graph-export/audio-manager.ts:31-131` provides the fake-context test seam; `cli/src/commands/graph-export/template.ts:155-281` emits the browser runtime and four-voice/pending accounting; `cli/scripts/build-binary.ts:421-445` copies the six OGG files plus `License.txt` beside compiled binaries.
- [x] Implementation matches proposed solution — `cli/src/commands/graph-export/template.ts:343-345` performs silent initialization; `template.ts:757-760` suppresses close audio during bootstrap; `template.ts:253-281` lazily decodes inline data URIs, counts pending voices, and falls back without blocking UI; `template.ts:724-727` routes search success to `confirm` without a duplicate open cue. The inline runtime is covered by generated-source/static assertions and live E2E; the fake-context manager is a separate policy-test seam.
- [x] Typecheck passes — `cd cli && bun run typecheck` exited 0 after the final changes.
- [x] Focused tests pass — `cli/src/commands/__tests__/graph-export.test.ts`: 19 pass / 0 fail / 176 expectations, including fake-context unlock rejection, decode failure, mute/voice cap, provenance, generated HTML parsing, and document/image regressions. Generated runtime behavior is additionally checked through emitted-source assertions and the live E2E harness; no claim is made that the fake context executes the inline browser manager.
- [x] Generated real export regenerated and measured — `dev/exports/graph/savant-graph.html`: 13,323,305 bytes; deterministic on second generation; 6 runtime cues; 49,246-byte audio registry; 48,212 bytes of data-URI audio; 49,310-byte growth over the serialized no-audio baseline (under 600 KiB); zero relative audio asset references; runtime audio JSON contains no `sourceUrl` or `license`. The reported broad-document `fetch` regex was narrowed to the generated app script because unrelated embedded document text contains the words “audio” and “fetch”; the scoped check passes.

> **AUDIT evidence-citation rule:** every implementation PASS and FAIL must cite `path/to/file.ts:LINE` with quoted
> code. Absence-shaped checks must paste the exact `NO-MATCH` search. Browser speaker/runtime behavior is `NEEDS-REVIEW`
> unless verified by a real browser/human-audible test.

## Resolution

- **Fixed By:** Savant / Orchestrator
- **Fixed Date:** 2026-08-07
- **Fix Description:** Downloaded the official Kenney UI Audio archive, checked in six hash-verified CC0 OGG cues, embedded them into the offline export, added first-gesture Web Audio unlock, SFX controls, procedural fallback, graceful failure handling, event wiring, and compiled-binary asset packaging.
- **Tests Added:** `cli/src/commands/__tests__/graph-export.test.ts` — 19/19; `dev/test-prompts/graph-export-e2e.ts` — 19/19; generated app `vm.Script` and inert-registry assertions included.
- **Verified By:** Final implementation audit PASS; CLI typecheck PASS; ESLint PASS; Prettier PASS; markdownlint PASS; deterministic real export measurement PASS.
- **Commit/PR:** Working tree
- **Archived:** 2026-08-07

## Lessons Learned

- Offline single-file exports require audio to be synthesized or embedded; relative file loading is not an acceptable default.
- Frequent UI cues should remain procedural or extremely small; rich bundled assets must be curated and budgeted.
- Audio preference must be independent from visual motion preference.
- Audio can enhance the Code Universe atmosphere, but it must never become the only feedback channel or block graph/document interaction.
