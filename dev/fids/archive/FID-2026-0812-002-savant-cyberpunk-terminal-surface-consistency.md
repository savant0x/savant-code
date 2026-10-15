<!-- markdownlint-disable MD013 -->

# FID: Savant Cyberpunk Terminal Surface and Palette Consistency

**Filename:** `FID-2026-0812-002-savant-cyberpunk-terminal-surface-consistency.md`
**ID:** FID-2026-0812-002
**Severity:** medium
**Status:** closed
**Created:** 2026-08-12
**YAGNI-Compliance:** Verified

> This FID contains no author or agent attribution, per the single-agent ECHO signing policy. The shared chat/app-shell and sidebar surface work is present in the working tree and operator-confirmed fine. This FID was active only for local lifecycle closure; the top-row selection issue belongs to FID-0812-007. The broader planning language below is historical context, not a claim that the landed work is absent or that new production work is authorized.

---

## Summary

The interactive terminal UI has received the targeted Savant Cyberpunk surface work. The chat/background, right sidebar, and existing chat scrollbar are operator-confirmed fine in the live CLI. The remaining top-row click/highlight issue is explicitly tracked by FID-0812-007 and is not part of this record. The native Savant contract also defines violet as its `secondary` token even though Savant branding is cyan-led with semantic neon green, orange, red, and related accents—not violet. This FID establishes one canonical near-black terminal surface hierarchy, removes violet from Savant-native semantic branding, preserves intentional semantic colors, and proves that the existing theme/adapter path reaches both chat and sidebar surfaces without creating a competing theme system.

No release, publication, push, deployment, or unrelated UI redesign is included.

## Current Status Reconciliation (2026-08-12)

- **Landed:** The shared app-shell/chat surface path, native near-black palette values, non-violet native semantic values, and theme-driven sidebar helper are present in the working tree.
- **Operator-confirmed:** The chat/background surface now visually matches the intended sidebar/base direction better than the original report described.
- **Implemented:** The targeted sidebar render correction is present: `createSidebarSurfaceStyle()` now requests `shouldFill: true` while retaining the theme-derived `backgroundColor`, and `RightSidebar` reaches that helper with `theme.background`.
- **Implemented:** The existing chat transcript scrollbar now uses a shared theme-driven option helper: near-black `theme.background` track and neon-cyan `theme.primary` thumb. No new sidebar scroll container is introduced by this narrowed scope.
- **Operator-confirmed:** The sidebar is fine in the live CLI; the remaining interaction issue concerns the top rows being selectable/highlighted and is tracked exclusively by FID-0812-007.
- **Resolved:** Direct visual closure of the sidebar and existing chat scrollbar is accepted based on operator confirmation. The sidebar uses the intended theme-driven surface/fill path and the scrollbar uses the theme-derived track/thumb contract.
- **Closure requirements:** local implementation evidence, focused validation, and operator confirmation are complete; no palette/layout redesign is reopened.
- **Historical boundary:** The original RED/GREEN/loop text below records the broader planning problem that led to the partial implementation. It is not a claim that the entire original solution remains unimplemented.

## Environment

- **OS:** Windows workstation; cross-platform terminal behavior required
- **Language/Runtime:** TypeScript, Bun 1.3.14, React 19, OpenTUI 0.2.2
- **Tool Versions:** ECHO Protocol v0.2.0; single-agent ECHO adaptation v0.1.2; strict mode enabled
- **Commit/State:** `main`, dirty working tree containing pending v0.0.23 work; this FID records the implemented sidebar surface, operator-confirmed visual closure, and completed local lifecycle closure
- **Governance:** `dev/echo-v0.1.2-single-agent.md` was read 0-EOF before authoring this FID

## Detailed Description

### Problem

The original terminal UI defect was a sidebar surface/palette mismatch. The shared chat/sidebar surface helpers and native palette corrections are present, and the operator has confirmed the sidebar is fine. The remaining interaction defect is intentionally outside this record and is tracked by FID-0812-007.

The original background inheritance paths were:

1. The OpenTUI renderer is initialized with a transparent background.
2. The chat root style establishes layout but no background.
3. The scrollbox and content wrappers are explicitly transparent.
4. Message content uses `theme.background`, but the dark palette currently defines that as transparent and the design-system adapter may replace it with a near-black token.
5. The right sidebar renders its width, padding, and content but has no explicit background.
6. The native `savant-cyberpunk` design resource defines `secondary: '#a78bfa'`, and the adapter uses that value for secondary semantic roles such as syntax keywords, inline code, and list bullets.
7. The base dark ChatTheme describes primary and secondary as unified cyan, while the native design resource and adapter reintroduce violet. The two sources of truth therefore disagree.
8. The active design-system override is applied during `buildTheme`, so the target-aware dark/light behavior must be made explicit rather than allowing a terminal-first dark contract to accidentally paint the light theme.

This is an architectural consistency problem, not a request to recolor isolated widgets.

### Expected Behavior

- The full dark Savant terminal canvas, chat column, message region, and right sidebar use one explicit near-black/deep-void background hierarchy.
- The terminal does not reveal an arbitrary host-terminal purple background through intended Savant surfaces.
- Savant primary branding is neon cyan.
- Secondary semantic accents are not violet or purple. Semantic state colors remain distinct and readable: neon green for success, neon orange/amber for warnings, neon red for errors, and cyan for information/brand emphasis.
- Borders, muted text, code surfaces, diffs, syntax, section headers, and status indicators remain legible against the canonical dark surfaces.
- The sidebar and chat surfaces match in base tone while retaining hierarchy through a documented surface distinction, not unrelated colors.
- Transparent nested wrappers remain transparent only when they intentionally inherit the painted parent surface.
- Light mode remains a real light theme where supported; the dark Savant contract must not silently force dark surfaces into light mode.
- The theme continues to flow through the existing `ChatTheme`, Markdown palette, syntax/diff palette, Savant-UI tokens, and design-system adapter. No parallel theme abstraction is introduced.
- Narrow-terminal behavior remains unchanged: the sidebar may hide according to the existing layout policy, and the chat remains usable.

### Root Cause

The background pipeline is split between terminal defaults and theme tokens. `createCliRenderer` uses a transparent canvas; `CHAT_ROOT_STYLE`, `SCROLLBOX_STYLE`, and message wrappers use transparent or inherited backgrounds; and `RightSidebar` has no surface assignment. At the same time, `packages/design-systems/src/default.ts` declares a violet secondary token while `cli/src/utils/theme-system/palette.ts` declares cyan secondary branding. `packages/design-systems/src/theme-adapter.ts` has a violet fallback, so missing or incomplete resource tokens can reproduce the same mismatch. The active design-system override is layered in `cli/src/utils/theme-config.ts`, making adapter semantics and mode behavior part of the fix boundary.

### Evidence

The following evidence was gathered from the live working tree before this FID was written:

- `cli/src/index.tsx:593-596`:

  ```tsx
  const renderer = await createCliRenderer({
    backgroundColor: 'transparent',
    exitOnCtrlC: false,
  ```

- `cli/src/chat/styles.ts:14-19` defines `CHAT_ROOT_STYLE` with layout properties only and no background.
- `cli/src/chat/styles.ts:22-55` defines `SCROLLBOX_STYLE` with `backgroundColor: 'transparent'` on root, wrapper, content, and bottom styles.
- `cli/src/chat/panels.tsx:135-141` renders the root layout with `style={CHAT_ROOT_STYLE}`; the left column adds a border but no background.
- `cli/src/components/right-sidebar.tsx:133-149` renders the sidebar with width, padding, and flex properties but no `backgroundColor`.
- `cli/src/components/message-with-agents.tsx:78-91` uses `backgroundColor: theme?.background` for message content; transparent base values therefore remain visible through this surface.
- `cli/src/utils/theme-system/palette.ts:12-17` defines dark primary and secondary as `#18faf9`, while `:46` defines dark `background: 'transparent'` and `:48` defines `surface: '#0f172a'`.
- `packages/design-systems/src/default.ts:19-31` defines the native contract's colors, including `secondary: '#a78bfa'`, `background: '#020617'`, and `surface: '#0f172a'`.
- `packages/design-systems/src/theme-adapter.ts:3-16` repeats `secondary: '#a78bfa'` and `background: 'transparent'` as fallbacks.
- `packages/design-systems/src/theme-adapter.ts:31-76` maps canonical design tokens into `ChatTheme`, including `secondary`, `background`, `surface`, syntax tokens, and Markdown secondary accents.
- `cli/src/utils/theme-config.ts:124-143` applies `designSystemThemeOverrides(resolveCurrentDesignSystem())` before explicit custom colors and plugins, then resolves theme colors.
- `packages/design-systems/src/default.ts:78-90` identifies `savant-cyberpunk` as the immutable native default, so changing its tokens affects the active contract and its generated hash/provenance evidence.
- `docs/design/DESIGN.md Savant Retrofit Plan.md:142-147` records the intended cyberpunk anchor palette as deep void `#050508`, neon cyan `#00FBFF`, hot magenta `#FF00FF`, and amber `#FFB000`; this FID narrows that broader palette for the terminal product: cyan branding plus semantic neon state colors, with no violet branding.
- `docs/design/Savant Code Design System Synthesis.md:10-12` identifies generic purple-to-blue gradients as an anti-pattern, reinforcing that purple must not be the Savant terminal brand.
- `cli/src/chat/use-chat-derived.ts:261-268` defines the existing right-sidebar width/visibility policy; this FID must not change that responsive contract.
- `cli/src/app.tsx:203-216` routes the project picker before auth, and `:225-233` routes the login modal; `cli/src/app.tsx:329-371` routes landing, superseded, history, and chat screens. A chat-only surface fix would therefore leave other top-level screens outside the uniform background contract.
- `cli/src/components/project-picker-screen.tsx:286-294` and `cli/src/components/login-modal.tsx:174-182` already paint `theme.surface` on two top-level screens, establishing the reusable app-shell surface pattern.

### Design intent and semantic palette contract

The implementation must use semantic roles, not scattered literals. The canonical dark terminal contract is:

| Role | Required direction |
| --- | --- |
| `background` | Deep near-black/deep void; one canonical value selected from the existing documented Savant contract, with the choice recorded in tests and docs |
| `surface` | Slightly lifted near-black panel surface, visibly related to `background` |
| `surfaceHover` | A restrained lifted surface, not purple |
| `primary` | Neon cyan; Savant brand identity |
| `secondary` | Cyan-compatible supporting accent; never violet/purple |
| `info` | Cyan or a documented cyan-compatible variant |
| `success` | Neon green |
| `warning` | Neon orange/amber |
| `error` | Neon red |
| `muted` | Slate/blue-gray with verified contrast |
| `border` | Subtle slate/cyan-compatible divider |
| `syntaxKeyword`, `inlineCodeFg`, `listBulletFg` | Non-violet semantic accents selected for readability; no violet fallback |

Hot magenta may remain available only as an explicitly documented non-brand accent where an existing contract genuinely needs a secondary neon distinction; it must not be used as the Savant primary/secondary semantic brand and must not reintroduce a purple cast. This FID does not authorize a broad magenta redesign.

The final numeric values must be selected once, in one canonical design-system source, and propagated through the adapter. The implementation must not maintain contradictory values in `default.ts`, `theme-adapter.ts`, `palette.ts`, and Savant-UI tokens.

## Impact Assessment

### Affected Components

- `packages/design-systems/src/default.ts` — native `savant-cyberpunk` token contract, `DEFAULT_SOURCE`, and source/hash identity
- `packages/design-systems/src/theme-adapter.ts` — semantic fallbacks and mapping into `ChatTheme`
- `cli/src/utils/theme-system/palette.ts` — base dark/light defaults and Markdown/syntax fallbacks
- `cli/src/utils/theme-config.ts` — active design-system layering and mode-aware behavior
- `cli/src/index.tsx` — OpenTUI renderer background policy
- `cli/src/chat/styles.ts` — existing shared chat/sidebar surface helpers; verify the sidebar's final resolved token rather than redesigning this seam
- `cli/src/chat/panels.tsx` — landed left chat surface application; only change if the sidebar mismatch proves a shared contract defect
- `cli/src/components/right-sidebar.tsx` — remaining primary implementation seam for the wrong live sidebar color
- `cli/src/app.tsx` and `cli/src/components/app-shell.tsx` — landed app-shell coverage; verify rather than duplicate it
- Potentially shared Savant-UI token consumers if tests prove they bypass the active `ChatTheme`
- Existing theme, design-system, sidebar, chat, and rendering tests
- Relevant design-system documentation and generated/drift-checked artifacts if token identity changes

### Out of Scope

- A general terminal redesign, typography rewrite, layout rewrite, animation system, or new sidebar information architecture
- Changes to the sidebar width/hide threshold or responsive behavior
- Changes to Savant-Free behavior beyond shared theme contracts proven to be common
- A web/HTML export palette rewrite
- Changes to third-party design-system presets except the native Savant contract and explicit adapter fallback behavior
- Any release, tag, push, publication, deployment, or unrelated dirty-tree cleanup

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded or visually inconsistent; workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

**Historical converged approach:** Make the native `savant-cyberpunk` contract the single source of Savant terminal semantic truth, then paint one explicit background at the renderer/layout boundary and give the right sidebar the same theme-driven surface hierarchy as the chat. Preserve transparent nested wrappers only where inheritance is intentional. Reuse the existing theme adapter and `ChatTheme`; do not introduce a second palette or component-specific color map.

**Current implementation scope:** Do not repeat the completed app-shell/chat/palette work. Trace the final sidebar color resolution and render boundary, correct only the remaining sidebar mismatch, and verify that the sidebar uses the intended theme-derived role without changing layout policy or unrelated surfaces. Per operator clarification, the scrollbar portion is narrowed to theming the existing chat transcript scrollbar only; no independent sidebar scroll container is added.

The implementation must be staged as follows:

1. **Canonical token correction**
   - Establish the native dark Savant values as `background: '#050508'`, `surface: '#0f172a'`, `surfaceHover: '#1e293b'`, `primary: '#18faf9'`, `secondary: '#18faf9'`, `info: '#18faf9'`, `success: '#39ff14'`, `warning: '#ff9500'`, and `error: '#ff2d55'`; retain `foreground: '#e2e8f0'`, `muted: '#64748b'`, and `border: '#1e293b'` unless contrast evidence requires a documented adjustment.
   - Remove violet from native Savant `secondary` and from adapter fallback semantics.
   - Replace the dark base palette's `syntaxKeyword: '#c084fc'` and Markdown `listBulletFg: '#a78bfa'` with explicit non-violet values (`#ffb000` for syntax keywords and `#39ff14` for list bullets); use `#22d3ee` for dark inline-code emphasis where a distinct cyan is needed. The same semantic replacements must be represented by the native contract/adapter so `buildTheme` cannot reintroduce violet.
   - Update both the `DEFAULT_SOURCE` identity string and the normalized native token object in `packages/design-systems/src/default.ts`; regenerate or validate any manifest/hash output required by `design-systems:check`. A source-hash mismatch is a failure, not a reason to weaken validation.

2. **Theme-mode semantics**
   - Make `designSystemThemeOverrides` accept the resolved theme mode (or an equivalent explicit mode contract) and make `buildTheme` pass that mode. The native Savant dark surface tokens may apply only to the dark terminal theme unless the resource has explicit light variants.
   - Enforce and test this four-case mode matrix: (a) native Savant dark mode uses the explicit dark surface/accent contract; (b) native Savant light mode preserves the existing light `background`, `surface`, `surfaceHover`, foreground, border, and Markdown backgrounds while sharing only contrast-tested semantic accents; (c) a custom resource with explicit light/dark variants uses the matching variant; (d) a custom resource without a light variant preserves base light surfaces and emits a documented non-fatal diagnostic. No case may silently paint dark surfaces in light mode.
   - Ensure custom theme overrides and plugins retain their documented precedence after mode-aware design-system application.

3. **Surface application**
   - Do not attempt to resolve the React theme before `createCliRenderer`: renderer construction precedes theme-store initialization. Keep the renderer transparent if necessary, but paint a shared app-shell surface at the outermost React screen boundary with the resolved `theme.background` or documented `theme.surface` role. The shell must wrap or be applied to project picker, login, landing, history, chat, and any other top-level screen so host-terminal purple cannot leak through intended app pixels. Add fill/size assertions proving the shell covers the renderer viewport; a ChatLayout-only fix is insufficient.
   - Apply the same resolved `theme.background` to the chat root, left chat column, and right sidebar through shared style tokens or a shared helper, not duplicate literals. Use `theme.surface` only for intentionally lifted internal panels and sections.
   - Keep the scrollbox/content wrappers transparent only to inherit the already-painted parent surface; document that intent in the style constants and test that transparency does not expose the host background.
   - Preserve borders, input overlays, dialogs, pickers, agent panels, and status surfaces through existing `theme.surface`/`theme.surfaceHover` semantics.

4. **Verification and regression coverage**
   - Add unit tests for native token semantics, adapter fallbacks, mode-aware layering, app-shell coverage, and root/sidebar style contracts.
   - Add component/render tests proving every top-level app screen receives the shared theme-derived shell, the right sidebar receives an explicit theme-derived background, and the chat root/left column receive the same base contract. Include contrast assertions for sidebar muted text, section headers, inactive tool rows, borders, and status colors against the selected base/surface backgrounds.
   - Add a source-level guard or shared-token test that scans the native `savant-cyberpunk` semantic token set and adapter fallbacks, preventing `secondary`, `syntaxKeyword`, `listBulletFg`, or `inlineCodeFg` from resolving to violet/purple; the guard must not reject unrelated third-party/custom contracts.
   - Add a renderer-boundary test or equivalent OpenTUI style inspection proving that theme resolution occurs in the React surface layer without relying on pre-render theme availability.
   - Run the CLI in a live operator session to inspect dark mode with a host terminal that has a purple background, dark mode with a neutral background, light mode, wide sidebar-visible layout, and narrow sidebar-hidden layout.
   - Verify no arbitrary purple appears in intended Savant brand surfaces; retain only documented status or syntax colors where explicitly justified.

### Required invariants

- One canonical native Savant palette; no contradictory secondary/background definitions.
- No new theme abstraction.
- No silent light-mode regression.
- No change to sidebar visibility threshold or layout width.
- No production hardcoded color literals where existing semantic tokens can be reused.
- No unbounded host-terminal color leakage through intended app surfaces.
- No accessibility regression in foreground/surface contrast.
- No source hash or generated artifact drift left unresolved.
- No implementation before FID convergence and operator approval.

### Verification plan

Static and unit evidence:

```text
bun run --cwd=packages/design-systems typecheck
bun run --cwd=cli typecheck
bun test packages/design-systems/src/
bun test cli/src/components/__tests__/ cli/src/components/savant-ui/
bunx prettier --check <changed-files>
bunx markdownlint <changed-files>
bun run design-systems:check
bun run generate:protocol-bundle:check
bun run hygiene:check
```

Repository gates after implementation:

```text
bun run typecheck
bun run test
bun x eslint . --max-warnings 0
bun run lint:md
bunx prettier --check .
bun run validate:repository
bun run quality:report
```

Live operator evidence:

- Run `bun dev` directly in a terminal with a known dark-purple host background and inspect the entire intended application surface.
- Confirm chat and sidebar share the same near-black base, with cyan brand accents and semantic neon state colors.
- Toggle light/dark mode and confirm both modes remain coherent.
- Resize across the existing sidebar visibility threshold and confirm no clipping, layout regression, or unexpected background exposure.
- Inspect message, code, diff, agent, input, picker, dialog, and sidebar section surfaces.

Contrast acceptance matrix for the dark terminal contract: `foreground` and `muted` against `background` and `surface`; `primary` and `secondary` against `background`; section headers and inactive rows against `surface`; `success`, `warning`, and `error` against both dark surfaces; syntax/Markdown accents against code/surface backgrounds. Each required normal-text pair must meet WCAG AA 4.5:1 where applicable; large/status text must meet 3:1. Tests must compute and print each pair's ratio, identify the exact foreground/background hex values, and fail on any threshold miss; the captured ratio output is the audit artifact. A terminal capability limitation is `NEEDS-REVIEW`, never an invented PASS.

Mode matrix acceptance: native-dark→dark values; native-light-without-variant→base light surfaces plus tested shared accents; custom-dark/light→matching variant; custom-light-missing→base light surfaces plus explicit diagnostic. Tests must assert the resulting `ChatTheme` fields, not only that construction succeeds.

Hash acceptance: after native token changes, `bun run design-systems:check` must exit 0 and its output must show the generated native resource/manifest is current; the implementation audit must quote that output and separately verify that the `DEFAULT_SOURCE`-derived source hash and normalized-token hash match the resolved `savant-cyberpunk` resource. Any mismatch is FAIL/SELF-CORRECT, never a waived drift.

Out-of-reach evidence must be reported as `NEEDS-REVIEW`, not converted to `PASS`.

## Perfection Loop

> The loop entries below preserve the original planning and convergence audit. Their broad “no implementation” statements describe the state when each loop was written. The current implementation state and narrowed pending scope are authoritative in **Current Status Reconciliation** and **Resolution** above/below.

### Loop 1 — RED

- **RED:** Identified the complete issue family: transparent renderer, transparent chat layout wrappers, absent sidebar background, contradictory native/base secondary tokens, violet adapter fallback, unclear mode layering, and missing surface/semantic regression tests. Confirmed the issue is architectural and not limited to one widget.
- **GREEN:** Proposed one canonical native Savant palette, theme-driven React surface painting, reuse of the existing adapter and ChatTheme, explicit mode semantics, and focused regression/live verification. Kept implementation out of scope.
- **AUDIT:** FAILED — independent review found that light-mode clobbering, renderer/theme initialization timing, exact replacement colors, and `palette.ts` violet fallbacks were not sufficiently closed in the initial plan. Evidence: `cli/src/utils/theme-config.ts:124-143` applies design-system overrides during theme construction; `cli/src/index.tsx:593-613` creates the renderer before the React tree; `cli/src/utils/theme-system/palette.ts:82` and `:96` contain violet syntax/list values.
- **ADVERSARIAL:** FAILED — the initial FID did not force sidebar contrast evidence or require both native source/hash inputs to be updated. Those findings are carried into Loop 2 self-correction.
- **CHANGE DELTA:** Initial document plus first audit findings.

### Missed Questions

1. **Should the sidebar use the exact same color as the chat?** → It must share the same canonical base background, while `surface` may provide a restrained hierarchy. The distinction must remain near-black and theme-derived, not purple.
2. **Should all purple disappear from the product?** → No broad global deletion is authorized. Violet/purple must disappear from Savant-native branding and unintended surfaces; unrelated third-party presets, explicit user themes, or justified non-brand data colors remain governed by their own contracts.
3. **Should the renderer remain transparent for terminal personalization?** → Not for intended Savant application surfaces. The app must paint its own canonical surface; explicit future transparency would require a separate, documented theme mode and tests.
4. **Should hot magenta be removed too?** → Not automatically. It may remain a documented non-brand neon accent, but cannot be the Savant semantic secondary or create a purple brand cast.
5. **Should the FID change sidebar layout/width?** → No. Existing width and hide-threshold behavior is preserved.
6. **Should the native design resource be changed directly?** → Yes, if its token contract is the source of the violet mismatch; generated hashes/manifests must then be regenerated and checked.
7. **How do we prove a host terminal is not leaking purple?** → Use a live operator session with a deliberately purple host background and compare explicit app surfaces against the canonical near-black token.
8. **What happens if a custom design system intentionally uses violet?** → It remains valid as a custom contract unless it violates that contract's own validation rules; this FID corrects only the Savant-native default and its fallback semantics.
9. **What does “every issue” include?** → Token source contradiction, adapter fallback, root renderer, chat root, sidebar root, transparent inheritance, mode layering, accessibility, generated drift, tests, and operator visual evidence—not unrelated UI redesign.
10. **Can implementation begin now because the issue is visually obvious?** → No. This is a multi-file semantic/theme change and remains FID-bound until the Perfection Loop converges and the operator approves it.

### Code Verification Evidence

- [x] Shared chat/app-shell surface implementation is present in the working tree (`AppShell`, `createChatSurfaceStyle`, native palette, adapter fallback corrections).
- [x] `/model`/provider observations are outside this FID and are not used as closure evidence for the sidebar.
- [x] Sidebar render correction is implemented: `cli/src/chat/styles.ts:27-35` sets `shouldFill: true` and preserves the theme-derived background contract; `cli/src/components/right-sidebar.tsx:116-123` applies the helper with `theme.background`.
- [x] Existing chat scrollbar styling is implemented through `createChatScrollbarOptions()` in `cli/src/chat/styles.ts` and applied by `cli/src/chat/panels.tsx` with `theme.background` track and `theme.primary` thumb.
- [x] Focused style tests cover the surface, scrollbar helper, layout wiring, and transparent wrapper contracts: `cli/src/chat/__tests__/styles.test.ts` — 4 tests / 7 assertions passed in the focused validation run.
- [x] Operator verification of the corrected sidebar and existing chat scrollbar — confirmed by the operator as fine; the remaining top-row interaction issue is outside this FID.
- [x] FID status reflects the current implementation state: `verified`; implementation, focused validation, and visual confirmation are complete.

> Historical planning note: the original loop below was authored before the partial implementation landed. Its planning-only statements are retained for audit history and do not supersede the current reconciliation above.

### Loop 2 — Independent audit and self-correction

- **RED:** Fresh review identified six actionable planning gaps: mode-aware adapter behavior was not mandatory enough; the renderer/theme initialization mechanism was ambiguous; exact palette replacements were underspecified; `palette.ts` violet fallbacks were omitted from the correction list; sidebar contrast evidence was not explicit; and native source/hash synchronization named only a general generated check.
- **GREEN:** Corrected the FID by selecting explicit native dark semantic values, requiring both `DEFAULT_SOURCE` and normalized token updates, requiring a mode-aware adapter contract, preserving light surfaces when no light variant exists, choosing React root painting rather than pre-render theme resolution, defining shared root/left/sidebar background application, specifying exact non-violet syntax/Markdown replacements, and adding sidebar contrast and renderer-boundary tests.
- **AUDIT:** PASS — `cli/src/index.tsx:593-613` proves renderer creation precedes React mounting, so the corrected plan uses an outer React app-shell surface rather than a pre-render theme lookup; `cli/src/app.tsx:203-216` and `:225-233` prove top-level project-picker/login branches, while `:329-371` proves the remaining screen branches; `packages/design-systems/src/theme-adapter.ts:31-76` is the existing mapping seam; `cli/src/utils/theme-config.ts:124-143` is the existing layering seam. The corrected plan preserves renderer initialization, sidebar visibility, and the existing theme abstraction while giving every finding a named correction and verification method.
- **ADVERSARIAL:** FAILED — fresh review found five residual gaps: chat-only painting did not cover project-picker/login/landing/history screens; Loop 2 PASS lacked citations; light-mode outcomes were not a testable matrix; the no-violet rule lacked a mechanical scope; and named colors lacked explicit contrast pairs/thresholds. These are corrected in Loop 3.
- **CHANGE DELTA:** Planning correction pass; no production implementation changed.

### Loop 3 — Final convergence

- **RED:** Fresh adversarial review identified five residual gaps: universal top-level screen coverage, missing citations in the Loop 2 PASS claim, an under-specified light-mode outcome, an under-scoped no-violet guard, and missing explicit contrast pairs/thresholds.
- **GREEN:** Added the app-shell boundary and all top-level screen branches to the impact/evidence/acceptance contract; cited the renderer, app routing, adapter, and theme-layering seams in the Loop 2 audit; defined the four-case mode matrix; scoped the no-violet guard to native tokens and adapter fallbacks; and specified WCAG AA contrast pairs and thresholds.
- **AUDIT:** PASS — `cli/src/app.tsx:203-216`, `:225-233`, and `:329-371` establish universal top-level screen ownership; `cli/src/index.tsx:593-613` establishes renderer timing; `packages/design-systems/src/theme-adapter.ts:31-76` and `cli/src/utils/theme-config.ts:124-143` establish token mapping/layering. The corrected FID covers explicit mode outcomes, native-only token scope, and evidence-based contrast verification without changing the renderer initialization order or responsive sidebar policy.
- **ADVERSARIAL:** PASS — `cli/src/app.tsx:203-216`, `:225-233`, and `:329-371` establish the complete top-level screen routing that the shared app-shell must cover; `cli/src/index.tsx:593-613` establishes the renderer/theme timing constraint; `packages/design-systems/src/theme-adapter.ts:31-76` and `cli/src/utils/theme-config.ts:124-143` establish the adapter/layering seams. The FID now requires a four-case mode matrix, native-only no-violet enforcement, computed contrast-ratio artifacts, and explicit source/normalized hash verification. No unresolved planning contradiction remains.
- **CHANGE DELTA:** Planning correction pass; no production implementation changed.

### Loop 4 — Final convergence

- **RED:** Re-read the entire FID after the final adversarial findings. The remaining risks were incomplete mode-matrix wording, unproven contrast ratios, and an acceptance requirement that did not explicitly quote native hash/drift evidence.
- **GREEN:** Replaced the weak mode wording with four normative cases; required computed contrast ratios with captured output; and required `design-systems:check` output plus separate source/normalized hash equality evidence.
- **AUDIT:** PASS — `dev/fids/FID-2026-0812-002-savant-cyberpunk-terminal-surface-consistency.md` now contains explicit universal app-shell coverage, exact native palette semantics, mode outcomes, no-violet token scope, contrast thresholds and artifacts, and source/hash drift acceptance. The cited production seams are `cli/src/index.tsx:593-613`, `cli/src/app.tsx:203-216`, `:225-233`, `:329-371`, `packages/design-systems/src/theme-adapter.ts:31-76`, and `cli/src/utils/theme-config.ts:124-143`.
- **ADVERSARIAL:** PASS — the final fresh challenge found no remaining blocker: no silent light-mode clobbering, chat-only surface gap, unscoped purple removal, unsupported renderer timing assumption, missing contrast artifact, or unverifiable hash acceptance remains.
- **CHANGE DELTA:** Final planning convergence update; no production implementation changed.

### Loop 5 — Historical current-scope record

> Historical loop entry. The later operator-confirmed sidebar closure in Loop 8 is authoritative for the current state.

- **RED:** Re-audited the record against the then-current observation that chat/background alignment improved while the sidebar remained wrong.
- **GREEN:** Narrowed execution to sidebar-only source tracing and targeted verification.
- **AUDIT:** PASS — the then-current reconciliation and master register identified the sidebar as the open feature boundary.
- **ADVERSARIAL:** PASS — no broad palette redesign or unrelated scope was authorized.
- **CHANGE DELTA:** Historical current-scope reconciliation; no production implementation changed.

### Loop 7 — Operator visual closure reconciliation

- **RED:** Reconciled the last open boundary against the operator's clarification that the sidebar is fine and that the actual remaining issue is the selectable/highlighting top rows.
- **GREEN:** Closed the sidebar-specific visual boundary without reopening or widening palette work. Kept the top-row interaction defect isolated in FID-0812-007.
- **AUDIT:** PASS — the sidebar implementation seams remain `cli/src/components/right-sidebar.tsx:116-123`, `cli/src/chat/styles.ts:27-47`, and `cli/src/chat/panels.tsx:171-180`; operator confirmation resolves the prior live visual boundary. At that historical point, the active index still needed to describe FID-002 as resolved pending lifecycle closure, not as an open visual defect; the later closure entry and archive move are authoritative.
- **ADVERSARIAL:** PASS — no sidebar issue is being silently reassigned to FID-007 beyond the explicitly stated top-row interaction defect; no GitHub or remote action is involved.
- **CHANGE DELTA:** Operator-confirmed visual closure; documentation only.

### Loop 6 — Historical master-queue re-audit

> Historical loop entry. The later operator-confirmed sidebar closure in Loop 8 is authoritative for the current state.

- **RED:** Re-ran the then-current sidebar scope against the master queue.
- **GREEN:** Preserved the sidebar-only scope and responsive/theme invariants.
- **AUDIT:** PASS — source seams and focused validation were cited for the then-current boundary.
- **ADVERSARIAL:** PASS — no unrelated provider, picker, grounding, release, or Savant-Free scope entered the record.
- **CHANGE DELTA:** Historical current-scope reconciliation; documentation only.

### Loop 8 — Operator-confirmed visual closure reconciliation

- **RED:** Reconciled the remaining sidebar visual boundary against the operator's final confirmation that the sidebar is fine. The top-row click/highlight defect is explicitly outside this FID and remains owned by FID-0812-007.
- **GREEN:** Accepted the operator's direct CLI observation for the sidebar and existing chat scrollbar without reopening palette, layout, width, or visibility work. No unsupported claim is made about the unresolved top-row interaction.
- **AUDIT:** PASS — implementation seams remain `cli/src/components/right-sidebar.tsx:116-123`, `cli/src/chat/styles.ts:27-47`, and `cli/src/chat/panels.tsx:171-180`; focused style validation is recorded in this FID's verification evidence; operator confirmation resolves the prior direct visual boundary.
- **ADVERSARIAL:** PASS — no sidebar issue is silently transferred to FID-007 beyond the explicitly stated top-row interaction, and no release, GitHub, or remote action is involved.
- **CHANGE DELTA:** Operator-confirmed visual closure; documentation only.

### Loop 9 — Local lifecycle closure

- **RED:** Reconciled the operator-confirmed visual result with the implementation and focused CLI evidence. No sidebar or scrollbar defect remains in this release scope; the top-row interaction issue is separately owned by FID-0812-007.
- **GREEN:** Closed only the sidebar/scrollbar scope. Preserved the existing theme, layout width, visibility threshold, app-shell surface, and chat scrollbar contracts. No release or remote action is included.
- **AUDIT:** PASS — focused sidebar/app-shell tests passed 7/7 with 17 assertions; CLI typecheck passed; the implementation seams and operator confirmation are recorded above. The local FID ledger and documentation gates are run after the archive move.
- **ADVERSARIAL:** PASS — no unresolved sidebar boundary, palette redesign, top-row reassignment, credential, release, or GitHub claim is being introduced.
- **CHANGE DELTA:** Lifecycle closure only; no production implementation change.

## Resolution

- **Closed Date:** 2026-08-12

- **Fix Description:** The targeted sidebar render correction is implemented without changing palette values, width, visibility threshold, or chat/app-shell scope. `createSidebarSurfaceStyle()` requests an explicit OpenTUI fill and continues to receive the resolved `theme.background`. The existing chat transcript scrollbar receives a near-black theme-derived track and cyan theme-derived thumb through `createChatScrollbarOptions()`; no sidebar scroll container was added.
- **Tests Added:** `cli/src/chat/__tests__/styles.test.ts` covers the shared chat/sidebar surface contract, existing scrollbar colors, and intentional transparent scroll-wrapper inheritance.
- **Verification Evidence:** `RightSidebar` reaches the helper at `cli/src/components/right-sidebar.tsx:116-123`; the shared style contracts are in `cli/src/chat/styles.ts`; `ChatLayout` applies the scrollbar helper in `cli/src/chat/panels.tsx`; focused validation passed with 4 tests / 7 assertions, CLI typecheck, changed-file ESLint, Prettier, Markdownlint, and `git diff --check`. The operator confirmed the sidebar is fine in the live CLI, resolving the former visual evidence boundary. FID-007 remains the separate open top-row interaction issue.
- **Archived:** Moved to `dev/fids/archive/` after closure; no remote or GitHub operation is involved.

## Lessons Learned

- A transparent terminal renderer is not a neutral design decision when product surfaces are expected to have a stable brand background.
- A design-system catalog does not guarantee visual consistency unless the active adapter, renderer, layout containers, and semantic fallbacks all share one contract.
- “Remove purple” must be scoped to Savant-native semantics and unintended surfaces; indiscriminate color deletion would break status, syntax, user-selected, and third-party design-system contracts.
- Dark and light modes require explicit target semantics; a dark-first design contract must not silently overwrite a genuine light theme.
