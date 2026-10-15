<!-- markdownlint-disable MD013 -->

# FID: CLI Top-Row Highlight and Mouse-Selection Forensics

**Filename:** `FID-2026-0812-007-top-row-click-selection.md`
**ID:** FID-2026-0812-007
**Severity:** medium
**Status:** closed
**Closed Date:** 2026-08-12 (operator-confirmed external-environment resolution)
**Created:** 2026-08-12
**YAGNI-Compliance:** Verified
**Master FID:** `FID-2026-0812-006`

> This FID contains no author or agent attribution. It records the top-row interaction investigation and its operator-confirmed external-environment resolution. It does not claim that the Savant application or OpenTUI was proven to be the root cause, and it authorizes no release, commit, push, or unrelated UI changes.

## Summary

The operator reports that clicking the decorative top area of the Savant CLI produces a full-row highlight even though the area has no intended click action. The initial observation affected one row. After adding explicit `focusable={false}` and `selectable={false}` to the full-viewport `AppShell` wrapper and pinned chat-header wrapper, the operator reports that the top two rows now exhibit the behavior. The changed footprint is important evidence but does not, by itself, prove OpenTUI selection bubbling: it may reflect application-level selection, terminal-host selection, renderable ownership, coordinate translation, hit-grid geometry, mouse-reporting state, or a combination.

This revision replaces the earlier narrow diagnosis with a forensic scope. The immediate objective is to classify the selection layer and identify the actual renderable/terminal owner before any additional production code is changed. The direct validation environment is the Windows workstation running `bun dev`; Linux, WSL, tmux, binary builds, and Savant-Free are excluded.

## Current Status Reconciliation (2026-08-12)

- **Visual scope resolved:** The sidebar palette, chat/sidebar surface consistency, and related visual problems are operator-confirmed resolved. They are not reopened by this FID.
- **Implementation evidence preserved:** `AppShell` and the pinned header wrapper retain `focusable={false}`. Their redundant `selectable={false}` guards were removed, and the speculative TopBanner text suppression was reverted after it worsened the observed footprint.
- **Static validation present:** Focused source-contract tests and CLI typecheck/lint/format checks passed for the attempted remediation. These tests do not prove pointer behavior, hit testing, terminal ownership, or child-control interaction.
- **Operator-confirmed resolution:** The operator reran the CLI in a different IDE and reports that the top-row highlight no longer occurs. This establishes an environment-dependent resolution, not a proven Savant/OpenTUI fix or a confirmed extension root cause.
- **Root-cause boundary:** The selection layer, owning renderable, and responsible IDE/extension/terminal condition remain unconfirmed because the original failure could not be reproduced in the confirming environment.
- **Closure decision:** Close this FID as resolved by an external-environment change with the application fix unverified. Preserve the forensic hypotheses and failed remediation as historical evidence; reopen only if the behavior recurs in a supported harness.
- **Forensic update:** Installed OpenTUI 0.2.2 evidence confirms that mouse events bubble through renderable parents (`node_modules/@opentui/core/index-jv9g79dk.js:16361-16368`) and that `dispatchMouseEvent` independently walks ancestors for autofocus (`node_modules/@opentui/core/index-jv9g79dk.js:23127-23140`). This proves that parent propagation exists, not that the operator's top-row event followed that path or that a failed selection target fell back to a selectable ancestor. Base renderables default to non-selectable (`node_modules/@opentui/core/index-jv9g79dk.js:15317`, `15442-15444`), while text-buffer renderables are selectable by default and explicitly honor `selectable` (`node_modules/@opentui/core/index-jv9g79dk.js:17798`, `18105-18111`).

## Environment

- **OS:** Windows workstation
- **Language/Runtime:** TypeScript, Bun 1.3.14, React 19
- **Terminal UI:** OpenTUI 0.2.2 through `@opentui/core` and `@opentui/react`
- **Renderer mode:** OpenTUI alternate-screen mode
- **Launch:** Direct `bun dev` in the operator's Windows harness; no tmux, WSL, Linux, binary build, or Savant-Free
- **Repository state:** Dirty working tree containing pending v0.0.23 work; no commit, push, release, publication, or deployment is part of this FID
- **Related record:** Coordinated by master `FID-2026-0812-006`; child closure remains independent

## Detailed Description

### Problem

The top decorative area of the terminal UI appears to respond to a mouse click by highlighting an entire row. That region is a layout/paint boundary, not a button, picker, link, input, or selectable transcript surface. The desired behavior is:

- no application-level focus change;
- no OpenTUI selection highlight;
- no full-row visual response to a stray click;
- no loss of legitimate interactions in descendants elsewhere;
- no claim that native terminal-emulator text selection can be controlled by React props.

The same broad class of whole-row highlighting was previously seen by the operator in VS Code and is now also observed in Cursor. This common history makes a terminal-host or terminal-input-layer contribution plausible, but it is not proof that the Savant application is uninvolved.

### Render hierarchy under investigation

The relevant conceptual tree is:

```text
AppShell
└── ChatLayout root
    ├── left chat column
    │   ├── pinned header wrapper
    │   │   └── ChatHeader (currently returns null)
    │   ├── transcript ScrollBox
    │   │   └── TopBanner and message content
    │   └── bottom/input area
    └── right sidebar
```

Current source evidence includes:

- `cli/src/components/app-shell.tsx` renders the full viewport shell.
- `cli/src/chat/panels.tsx` renders the chat root, left column, pinned header, transcript `scrollbox`, bottom area, and sidebar.
- `cli/src/components/chat-header.tsx` currently returns `null`, so the pinned header wrapper has no intended interactive child.
- `cli/src/components/top-banner.tsx` can contain legitimate interactive descendants: a close `Button` and a `TerminalLink` for switching to the Git root.
- `cli/src/components/button.tsx` uses mouse-down/mouse-up tracking and must not be disabled or rewritten as part of diagnosis.
- `cli/src/components/clickable.tsx` marks nested text/span hosts non-selectable for clickable components, but this is not evidence that every layout box is non-selectable.

### Selection layers that must be separated

#### Layer A — Terminal-host selection

Windows Terminal, Cursor's integrated terminal, and other terminal hosts maintain their own character-grid selection behavior. A terminal host may draw a highlight over the rendered output without the application receiving a usable OpenTUI event. Cursor and VS Code history makes this a live hypothesis. Native host selection may be affected by mouse-reporting mode, modifier-key bypasses, alternate-screen behavior, ConPTY/xterm.js translation, and terminal reset state.

#### Layer B — OpenTUI/application selection

OpenTUI may receive mouse-reporting sequences, resolve a renderable at a coordinate, and start application-level selection or dispatch mouse events. The installed OpenTUI 0.2.2 inspection confirms that selection checks include a renderable's `selectable` state and `shouldStartSelection` behavior. The exact ancestor fallback/bubbling path must be proven from the installed implementation before it is treated as the cause.

#### Layer C — Focus, hover, or repaint appearance

A row may appear highlighted because of focus styling, hover state, post-processing, or a rerender triggered by mouse movement rather than text selection. `ChatLayout` attaches `onMouseMove={handleMouseActivity}` for throttled activity reporting. That callback is not intended to select text, but its interaction with rerender timing and visual state must be ruled out.

#### Layer D — Geometry and hit testing

The visible top row may not be the renderable the operator assumes. Borders, padding, transparent/fill surfaces, alternate-screen coordinate origin, `screenY`, height, and OpenTUI hit-grid registration can make a click land on a parent, child, banner, border, or scrollbox row. The one-row-to-two-row change may be a geometry or target-resolution change rather than selection bubbling.

### Expected behavior

1. A stray click in the decorative top area produces no application-level selection or focus highlight.
2. The shell and pinned header remain layout/paint containers.
3. Existing interactive descendants retain mouse behavior:
   - top-banner close button;
   - Git-root switch link;
   - model/provider picker rows;
   - input controls;
   - other buttons and links.
4. The solution does not globally disable mouse input.
5. Native terminal-host selection is separately classified and not silently claimed as fixed by application props.
6. The top row and second row are measured and attributed to actual renderables before any new boundary is modified.

## Root Cause Hypotheses

These are hypotheses, not conclusions. Confidence is intentionally provisional until direct evidence is collected.

| Rank | Hypothesis | Provisional confidence | What would support it |
|---|---|---:|---|
| 1 | Wrong renderable or layout geometry owns the affected rows | High | Highlight footprint follows a box/border/banner height; screen coordinates or target renderable identify a different owner than the header |
| 2 | Native terminal-host selection or mouse-mode interaction | Medium-high | Behavior is drag/copy/terminal-dependent; it reproduces in Cursor/VS Code or standalone terminal; OpenTUI receives no event; host selection persists independently |
| 3 | OpenTUI application selection/fallback to a selectable ancestor | Medium | OpenTUI receives the click; selection state persists; installed source proves ancestor resolution; changing a precisely scoped prop changes the owner predictably |
| 4 | Coordinate translation or alternate-screen off-by-one | Medium | Top-row behavior changes by terminal host, border, resize, or screen mode; measured coordinates disagree with visual coordinates |
| 5 | Mouse-mode/reset state degradation | Low-medium | Clean versus forced exit changes behavior; mouse sequences are absent/partial; terminal remains in a bad state after exit |
| 6 | `onMouseMove` or post-processing creates a highlight-like repaint | Low | Removing only activity tracking/post-processing changes the visual response without changing selection/copy/event behavior |

The previous report's claim that the one-to-two-row change *definitively* proves OpenTUI bubbling is rejected. React/OpenTUI changes can alter geometry and visible characters, so the mutation is strong evidence of an application/layout relationship but is not a layer classification by itself.

## Evidence and Call-Graph Boundaries

### Current source evidence

- `cli/src/components/app-shell.tsx` currently renders the root `<box>` with `focusable={false}`; the redundant `selectable={false}` guard was removed because base boxes are non-selectable in the installed OpenTUI contract.
- `cli/src/chat/panels.tsx` currently renders the chat root with `focusable={false}` and `onMouseMove`, the left surface with `focusable={false}`, and the pinned header with `focusable={false}`. The pinned header's redundant `selectable={false}` guard was removed for the same reason.
- `cli/src/index.tsx` creates the renderer with `screenMode: 'alternate-screen'`, transparent infrastructure background, and `applyPostProcessing`.
- `cli/src/components/top-banner.tsx` marks its static banner text non-selectable while retaining legitimate child click targets (`Button` and `TerminalLink`), so a global pointer-interception fix is prohibited.
- `cli/src/components/__tests__/app-shell.test.tsx` and `cli/src/chat/__tests__/styles.test.ts` assert source-level prop contracts only.
- Installed OpenTUI inspection confirms selectable checks in text-buffer selection (`node_modules/@opentui/core/index-jv9g79dk.js:18105-18111`), base-renderable non-selection (`node_modules/@opentui/core/index-jv9g79dk.js:15317`, `node_modules/@opentui/core/index-jv9g79dk.js:15442-15444`), and parent event propagation (`node_modules/@opentui/core/index-jv9g79dk.js:16361-16368`). The native `checkHit` binding is exposed at `node_modules/@opentui/core/index-jv9g79dk.js:14026-14028` and `node_modules/@opentui/core/index-jv9g79dk.js:23311-23313`; the inspected JavaScript bundle yielded no matching renderable pointer-pass-through or mouse-ignore option. Exact selection-target fallback and the actual native hit-grid result remain unproven.

### Evidence limitations

The current source tests do not prove:

- actual OpenTUI pointer target resolution;
- screen coordinates or renderable dimensions;
- whether a selection is application-owned or host-owned;
- whether the terminal receives or suppresses native selection;
- whether child controls remain clickable after a parent change;
- whether `applyPostProcessing` affects the visible highlight.

### Recent-change boundary

The working tree is dirty and contains relevant uncommitted changes. The absence of a recent commit touching these files is not evidence that nothing changed. The forensic comparison must distinguish committed history from the current working-tree diff and inspect changes involving:

- app-shell background painting;
- chat/sidebar surface and `shouldFill` behavior;
- transparent wrappers;
- scrollbar styling;
- header visibility and geometry;
- picker viewport/layout changes;
- `focusable`/`selectable` props;
- renderer alternate-screen and terminal cleanup behavior.

## Impact Assessment

### Affected Components

- `cli/src/components/app-shell.tsx`
- `cli/src/chat/panels.tsx`
- `cli/src/chat/styles.ts`
- `cli/src/components/chat-header.tsx`
- `cli/src/components/top-banner.tsx`
- `cli/src/components/button.tsx`
- `cli/src/components/clickable.tsx`
- `cli/src/index.tsx`
- `cli/src/chat/use-chat-header-visibility.ts`
- `cli/src/chat/use-chat-derived.ts`
- `cli/src/hooks/use-terminal-focus.ts`
- `cli/src/components/__tests__/app-shell.test.tsx`
- `cli/src/chat/__tests__/styles.test.ts`
- this FID and the active master/index references

### Out of Scope

- Sidebar palette, chat/sidebar color consistency, or already-resolved surface design
- Provider integration, `/model`, `/provider`, or Nous behavior
- Savant-Free, release artifacts, version changes, commit, push, publication, deployment
- Global mouse disabling or manual terminal reset-sequence redesign
- Rewriting `Button`, `TerminalLink`, picker controls, or input controls without proven evidence
- Treating terminal-host selection as controllable by application-level React props

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Interactive terminal behavior degraded and may affect user trust/usability
- [ ] Low: Minor cosmetic issue only

## Proposed Forensic Approach

> Historical planning constraint. The operator has since authorized automation level 3 implementation; the current remediation and its remaining runtime evidence boundary are recorded in the implementation addendum below.

No additional broad production boundary change is authorized without classifying the selection layer and owner.

### Phase 1 — Classify the visible effect

Directly in `bun dev`, record whether the highlight:

- appears after a single click, drag, double-click, or triple-click;
- persists after moving the pointer away;
- clears after Escape or a normal keypress;
- moves with a held drag;
- copies text to the clipboard through native terminal behavior;
- triggers a visible CLI event or only changes the rendered grid.

### Phase 2 — Compare terminal hosts

Run the same scenario in:

1. Cursor integrated terminal;
2. standalone Windows Terminal;
3. another available terminal emulator, if available.

Record whether the defect is host-specific, common across hosts, or only appears after a forced termination or terminal-state disturbance.

### Phase 3 — Isolate layout/target ownership

Without changing production behavior broadly, compare:

- no active TopBanner versus active Git-root banner;
- empty transcript versus existing messages;
- first click versus repeated click;
- chat column versus sidebar;
- normal size versus resized terminal;
- current two `selectable={false}` props present versus temporarily reverted.

If temporary instrumentation is used, log only redacted geometry and component identity: renderable type, `screenX`, `screenY`, width, height, pointer coordinates, and event kind. Do not log credentials, prompts, or conversation content.

### Phase 4 — Verify OpenTUI semantics

Use the installed OpenTUI 0.2.2 source and, where possible, a minimal isolated renderable test to determine:

- whether `selectable` is inherited;
- whether a non-selectable target falls back to an ancestor;
- whether mouse events bubble independently of selection initialization;
- whether `pointer-events`/mouse-ignore/pass-through exists;
- how the hit grid registers transparent/fill boxes;
- how alternate-screen coordinates map to renderables.

### Phase 5 — Choose the smallest fix

> Historical decision framework; the current source-level remediation is recorded in the implementation addendum below.

Only after classification:

- if host-owned: document the terminal/input condition and avoid an application patch that cannot control it;
- if geometry-owned: correct the exact layout/hit-test seam and add geometry evidence;
- if OpenTUI-selection-owned: change only the proven owning boundary, preserving descendants;
- if mouse-mode/reset-owned: fix the lifecycle/reset path with direct clean/forced-exit verification;
- if repaint-owned: isolate the visual state mutation rather than adding selection guards.

## Direct Windows Harness Diagnostic Matrix

| # | Experiment | Evidence for | Evidence against |
|---:|---|---|---|
| 1 | Single left click versus vertical click-drag | Drag-based persistent selection suggests selection layer | Only a transient click repaint suggests focus/hover or event response |
| 2 | Move pointer away immediately | Persistent highlight suggests stored selection | Disappearing highlight suggests hover/focus |
| 3 | Copy/paste test in a separate editor | Clipboard text suggests host selection | No clipboard result keeps OpenTUI/repaint hypotheses open |
| 4 | Press Escape and a normal key | App state/selection clearing suggests application ownership | Host overlay persistence suggests terminal ownership |
| 5 | No active TopBanner | Disappearance implicates banner geometry/target | Persistence implicates shell/layout/other layer |
| 6 | Active Git-root banner | Footprint follows banner height implicates banner geometry | Fixed two-row footprint weakens banner hypothesis |
| 7 | Empty transcript | Change implicates content/hit-grid ownership | Stable behavior implicates structural layout |
| 8 | Existing messages and scrolled transcript | Random/shifted target implicates coordinate mapping | Stable top footprint weakens transcript coordinate theory |
| 9 | Cursor integrated terminal | Cursor-only behavior implicates host integration | Reproduction elsewhere weakens Cursor-specific theory |
| 10 | Standalone Windows Terminal | Host-specific difference classifies terminal layer | Identical result points toward app/OpenTUI or shared terminal mode |
| 11 | Another terminal emulator | Cross-host reproduction strengthens application hypothesis | Single-host result strengthens terminal hypothesis |
| 12 | Temporarily revert only AppShell/header selectable props | Footprint reverting proves a relationship, not yet the full fallback mechanism | No change weakens those props as the trigger |
| 13 | Temporarily add guards only to the ChatLayout root/left surface | Targeted disappearance supports structural owner theory | No change requires further target tracing |
| 14 | Compare exact affected row count after each controlled change | Deterministic row changes support geometry/target ownership | Non-deterministic changes support host/input state |
| 15 | Click top row of sidebar | Sidebar reproduction broadens shell-level hypothesis | Chat-only reproduction narrows the owner |
| 16 | Clean exit then restart | State reset indicates terminal mouse-mode/lifecycle involvement | Stable reproduction weakens terminal residue theory |
| 17 | Forced termination then restart, followed by clean reset | New behavior only after forced exit implicates cleanup/reset | No difference weakens reset hypothesis |
| 18 | Temporarily isolate `onMouseMove={handleMouseActivity}` | Visual change without selection/copy change implicates repaint/activity | No change weakens activity handler theory |
| 19 | Temporarily isolate `applyPostProcessing` in a diagnostic branch | Visual change implicates post-processing | No change weakens post-processing theory |
| 20 | Minimal OpenTUI sample in the same Windows host | Reproduction outside Savant implicates OpenTUI/host | Savant-only reproduction implicates Savant layout/wiring |

The operator should record observations, not conclusions. A result that is unavailable or ambiguous is `NEEDS-REVIEW`.

## Required Research and Verification Deliverables

The forensic pass must produce:

1. Selection-layer classification: host, OpenTUI, focus/hover, geometry, mouse lifecycle, or combination.
2. Actual renderable owner of the affected rows, with measured geometry where possible.
3. OpenTUI 0.2.2 evidence for `selectable`, `focusable`, hit testing, selection initialization, and any ancestor fallback.
4. Recent committed/uncommitted change timeline for the relevant paths.
5. Before/after analysis of the one-row-to-two-row mutation.
6. Ranked hypotheses with confidence and falsifiable evidence.
7. A short operator diagnostic record from direct Windows `bun dev`.
8. A minimal fix recommendation only if the root cause is proven.
9. A regression plan that distinguishes source tests from runtime evidence.
10. A determination of whether this FID's diagnosis should be revised again, split, or remain active.

Every verification claim must cite a current file/line or exact command/output. Runtime/visual claims that cannot be exercised in the current tool context remain `NEEDS-REVIEW`.

## Perfection Loop

### Loop 1 — RED: forensic scope correction

- **RED:** The original FID treated the issue as an OpenTUI application-selection problem localized to AppShell and the pinned header. The operator then reported that the affected footprint changed from one row to two after those props were added. Existing source-contract tests prove only prop presence, not runtime selection ownership. The prior FID omitted a required host-versus-application classification, renderable geometry mapping, recent-change comparison, and falsifiable direct Windows experiments.
- **GREEN:** Reframed the FID as a forensic investigation. Added separate host/application/focus/geometry/mouse-lifecycle layers; ranked hypotheses without treating bubbling as fact; preserved interactive descendants; prohibited broad guards and release work; and defined a direct Windows diagnostic matrix.
- **AUDIT:** PASS — current source boundaries are identified at `cli/src/components/app-shell.tsx:18-27`, `cli/src/chat/panels.tsx:140-182`, `cli/src/components/top-banner.tsx:82-142`, `cli/src/components/button.tsx:41-72`, and `cli/src/index.tsx:593-599`; the current tests are explicitly classified as source-contract tests; the FID records the operator's one-row-to-two-row observation without converting it into proof. Validation evidence: `bun test scripts/fid-ledger.test.ts` → 5 pass / 0 fail; Prettier, Markdownlint, and `git diff --check` all exit 0 for the revised FID set.
- **ADVERSARIAL:** FAIL — the first forensic draft still risked treating OpenTUI's reported `selectable` check as proof of ancestor bubbling and risked over-weighting the mutation as application proof. This revised record explicitly requires exact installed-source evidence for fallback semantics and retains native terminal selection as live.
- **CHANGE DELTA:** Scope correction from implementation diagnosis to layer-classification forensics.

### Missed Questions

1. **Is the highlight definitely produced by the application?** → No. Clipboard, drag, persistence, host comparison, and event-reception evidence must classify it.
2. **Does one-to-two rows prove bubbling?** → No. It is a strong mutation clue but may reflect geometry, hit-grid ownership, visible content, or host coordinate behavior.
3. **Does `selectable={false}` mean pointer-events-none?** → Not by assumption. It may only reject selection initialization while still allowing mouse dispatch and physical hit-grid registration.
4. **Could the AppShell guard be too broad?** → Yes. Descendant behavior must be verified before retaining or expanding it.
5. **Are source-contract tests behavioral tests?** → No. They assert text-level wiring only and cannot close runtime selection behavior.
6. **Could Cursor and VS Code history implicate a shared terminal layer?** → Yes. This is a live hypothesis, not proof; standalone Windows Terminal comparison is required.
7. **Could recent visual work alter hit geometry?** → Yes. `shouldFill`, transparent wrappers, borders, padding, and shell painting must be compared with the dirty working tree.
8. **Should all structural boxes become non-selectable?** → No. Only a proven owner should be changed, and child controls must remain intact.
9. **Can a terminal-host overlay be fixed with React props?** → Usually not. Host behavior must first be classified and documented.
10. **What is the closure criterion?** → A direct Windows harness record identifies the layer and owner, the minimal fix (if any) is independently validated, and legitimate controls remain usable.

### Code Verification Evidence

- [x] Current FID and master/index records were read completely before this revision.
- [x] Current AppShell/header guards and focused source-contract tests are acknowledged as existing implementation evidence, not runtime proof.
- [x] The narrowed color/sidebar scope is explicitly excluded.
- [x] Host/application/geometry/mouse-lifecycle hypotheses and falsifiable experiments are recorded.
- [x] Operator-confirmed no-highlight result in a different IDE; recorded as external-environment resolution only.
- [x] OpenTUI parent event propagation — confirmed by installed 0.2.2 source at `node_modules/@opentui/core/index-jv9g79dk.js:16361-16368`.
- [ ] Runtime selection owner — `NEEDS-REVIEW`; the original failure is no longer reproducible in the confirming environment.
- [ ] Exact OpenTUI selection-target fallback semantics — `NEEDS-REVIEW`; `checkHit` delegates to the native binding at `node_modules/@opentui/core/index-jv9g79dk.js:14026-14028` and `node_modules/@opentui/core/index-jv9g79dk.js:23311-23313`, so the inspected JavaScript does not establish whether a non-selectable hit fell through to an ancestor for selection.
- [ ] Native hit-grid result for the affected coordinates — `NEEDS-REVIEW`; no local evidence maps the original click to a specific renderable or geometry.
- [ ] Child-control preservation after any further fix — `NEEDS-REVIEW`; no child-control regression was reported, but the confirming run did not constitute a controlled interaction audit.

### Loop 2 — GREEN: adversarial correction

- **RED:** Review challenged the forensic scope for assuming DOM-like bubbling, over-scoring native selection as disproven, and recommending ancestor guards before proving the owner.
- **GREEN:** Corrected the record to state that OpenTUI target fallback must be demonstrated from installed source; retained native terminal selection as medium-high; made geometry/hit ownership the highest hypothesis; and changed the proposed solution into a no-code forensic sequence followed by conditional minimal remediation.
- **AUDIT:** PASS — the record now separates documented facts from hypotheses, identifies all current interaction boundaries, includes host comparisons and clean/forced-exit tests, and preserves a `NEEDS-REVIEW` status for unavailable runtime evidence. The implementation boundaries are `cli/src/components/app-shell.tsx:18-27`, `cli/src/chat/panels.tsx:140-182`, and `cli/src/index.tsx:593-599`; documentation validation passed as recorded above.
- **ADVERSARIAL:** PASS — no broad global mouse change, ancestor barricade, terminal reset rewrite, palette change, provider work, release action, or Savant-Free scope has been smuggled into the diagnostic plan.
- **CHANGE DELTA:** Hypothesis and evidence-boundary correction.

### Loop 3 — Final convergence

- **RED:** Final review checked whether the revised FID could be mistaken for an implementation authorization, whether the active master/index relationship remained coherent, and whether the operator had a direct executable diagnostic path.
- **GREEN:** Preserved `Status: verified` as planning convergence rather than closure, retained the child under master FID-0812-006, defined twenty direct Windows experiments with interpretation boundaries, and required exact classification before code changes.
- **AUDIT:** PASS — the FID has a complete RED/GREEN/AUDIT/ADVERSARIAL record, current source evidence with `file:line` citations, explicit missed questions, ranked hypotheses, direct-harness diagnostics, and no unsupported runtime PASS claims. The revised record itself passes FID-ledger validation, Prettier, Markdownlint, and diff checks.
- **ADVERSARIAL:** PASS — the final challenge found no remaining actionable planning contradiction. The only open boundaries are intentionally runtime/external: selection-layer classification, exact OpenTUI fallback behavior, actual renderable ownership, terminal-host comparison, and child-control preservation after any future fix. No implementation or release action is authorized by this planning convergence.
- **CHANGE DELTA:** Final forensic convergence; no new production implementation authorized.

### Loop 4 — Fresh master-queue re-audit

- **RED:** Re-ran the forensic record against the current master scope and the operator's report that the top-two-row behavior remains unresolved. The previous `selectable={false}` guards remain provisional source evidence; they do not establish the selection layer or owner.
- **GREEN:** Preserved the host/application/geometry/mouse-lifecycle hypothesis split, direct Windows diagnostic matrix, child-control protection, and prohibition on broad ancestor guards or global mouse disabling. No production remediation is authorized without classification evidence.
- **AUDIT:** PASS — the current reconciliation at `dev/fids/FID-2026-0812-007-top-row-click-selection.md:21-31` matches the active index at `dev/fids/README.md:23` and the master child gate at `dev/fids/FID-2026-0812-006-v0-0-23-active-queue-implementation-closure-master.md:106-112`. `cli/src/components/app-shell.tsx:18-27` and `cli/src/chat/panels.tsx:140-182` provide the provisional source guards. The source-contract nature of the current tests is directly shown by `cli/src/components/__tests__/app-shell.test.tsx:9-21`, which reads `app-shell.tsx` with `readFileSync` and asserts prop text, and `cli/src/chat/__tests__/styles.test.ts:50-66`, which reads/slices `panels.tsx` source and asserts prop text. The evidence rule at `dev/fids/FID-2026-0812-007-top-row-click-selection.md:298-298` therefore correctly keeps runtime/visual claims unavailable in the current tool context as `NEEDS-REVIEW`. Selection ownership, renderable geometry, terminal-host comparison, and child-control preservation remain `NEEDS-REVIEW`; exact selection fallback is also not exposed by the JavaScript bundle.
- **ADVERSARIAL:** PASS — the one-row-to-two-row mutation is not overstated as proof of bubbling; Cursor/VS Code history is not overstated as proof of host ownership; and no stale palette, provider, picker, grounding, release, or Savant-Free scope has entered this FID.
- **CHANGE DELTA:** Fresh current-scope loop; documentation only.

### Loop 6 — Installed OpenTUI semantic audit and minimal remediation

- **RED:** Audited the locally installed OpenTUI 0.2.2 bundle and separated three mechanisms that the earlier report conflated: selection eligibility, mouse-event propagation, and hit-grid target resolution.
- **GREEN:** Recorded only what the installed JavaScript proves. Base renderables default to `selectable = false` and their base `shouldStartSelection` returns `false` (`node_modules/@opentui/core/index-jv9g79dk.js:15317`, `node_modules/@opentui/core/index-jv9g79dk.js:15442-15444`). Text-buffer renderables default to selectable and reject selection when `this.selectable` is false (`node_modules/@opentui/core/index-jv9g79dk.js:17798`, `node_modules/@opentui/core/index-jv9g79dk.js:18105-18111`). Mouse events do bubble through `parent.processMouseEvent(event)` until propagation is stopped (`node_modules/@opentui/core/index-jv9g79dk.js:16361-16368`). `dispatchMouseEvent` separately performs ancestor autofocus (`node_modules/@opentui/core/index-jv9g79dk.js:23127-23140`). `checkHit` delegates to the native renderer binding (`node_modules/@opentui/core/index-jv9g79dk.js:14026-14028`, `node_modules/@opentui/core/index-jv9g79dk.js:23311-23313`), and the inspected JavaScript bundle yielded no matching renderable pointer-pass-through or mouse-ignore option. This search does not prove that the native layer lacks such behavior.
- **GREEN:** Applied the smallest source-level remediation: removed redundant `selectable={false}` from the base-box AppShell and empty pinned-header wrapper, and marked the two static TopBanner text paths non-selectable. The existing `Button` close control and `TerminalLink` remain unchanged and retain their mouse handlers.
- **AUDIT:** PASS — the semantic audit narrows the diagnosis without claiming a root cause. It confirms that ancestor event propagation is implemented, but does not establish that the operator's top-row event follows it or that selection itself falls back from a non-selectable hit to an ancestor. The targeted source change preserves the existing interactive descendants. The native hit-grid result, runtime owner, terminal layer, and child-control behavior remain unavailable without direct Windows harness evidence.
- **ADVERSARIAL:** PASS — no unsupported claim was made that OpenTUI bubbling causes the highlight; no native terminal behavior was declared fixed; no broad guard, mouse disable, terminal reset rewrite, or unrelated visual change was authorized. The implementation remains a hypothesis-driven diagnostic remediation pending operator verification.
- **CHANGE DELTA:** Targeted source remediation and regression contract only; no terminal lifecycle or unrelated production behavior changed.

## Implementation Addendum (2026-08-12)

- **Authorization:** Operator granted automation level 3 for the scoped FID-007 implementation. No GitHub, release, commit, push, publication, or deployment action was authorized.
- **Remediation attempt:** Removed redundant `selectable={false}` from the base-box AppShell and empty pinned-header wrapper. A follow-up attempt to mark both static TopBanner text paths `selectable={false}` worsened the operator-observed footprint to approximately three or four rows, so those text props were immediately reverted. The existing close `Button` and Git-root `TerminalLink` implementations remain unchanged.
- **Rationale correction:** Installed OpenTUI evidence confirms that structural base boxes are non-selectable by default, but explicitly rejecting a text hit can expose a larger ancestor/event path. The observed regression means text-level suppression is not accepted as the fix. No new broad guard or propagation change is being substituted without owner evidence.
- **Runtime boundary:** Direct Windows `bun dev` verification is still required to determine the current baseline after reverting the text props, classify the highlight layer/owner, and verify nested controls. The FID remains active.

## Resolution

- **Closed Date:** 2026-08-12.
- **Fix Description:** The operator reports that the top-row highlight disappeared when the CLI was run in a different IDE. The available evidence supports an external-environment-dependent resolution; it does not identify an extension, terminal host, OpenTUI path, or Savant source change as the root cause. The speculative TopBanner text suppression was reverted after it worsened the footprint, and the existing AppShell/header source guards were retained only as the current code state—not as a proven fix.
- **Tests Added:** Added a narrow TopBanner source contract confirming its existing `Button` and `TerminalLink` controls remain present; updated AppShell and pinned-header contracts to preserve focus guards without adding structural selection fallback.
- **Verification Evidence:** Focused source tests, CLI typecheck, ESLint, Prettier, Markdownlint, and diff checks passed for the correction. The operator supplied direct live evidence of no highlighting in a different IDE. Runtime owner, exact terminal/IDE condition, native hit-grid mapping, and controlled child-control preservation remain unproven and are explicitly not closure claims.
- **Closure Classification:** `operator-confirmed external-environment resolution; application fix unverified`.
- **Archived:** Moved to `dev/fids/archive/` after this closure record was added. No commit, push, release, publication, deployment, or GitHub operation was performed.

## Lessons Learned

- A changed visual footprint after a UI prop change is evidence of a relationship, not proof of a particular event-bubbling mechanism.
- Terminal UI debugging must classify host selection, application selection, focus styling, geometry, and mouse lifecycle separately.
- `selectable={false}` is not interchangeable with pointer-events-none and must not be applied broadly without child-control evidence.
- Source-contract tests are valuable regression guards but cannot replace direct Windows harness interaction evidence.
