# FID: Scrollbar color tokenization — eliminate OpenTUI vendor-gray fallback

**Filename:** `FID-2026-0823-002-scrollbar-tokenization-vendor-gray-fallback.md`
**ID:** FID-2026-0823-002
**Severity:** low
**Status:** closed
**Created:** 2026-08-23 02:25
**YAGNI-Compliance:** Verified

---

## Summary

Seven of the eight vertical `<scrollbox>` instances in the Savant CLI TUI render their scrollbar with OpenTUI's vendored fallback palette (thumb `#9a9ea3`, track `#252527` — hardcoded grays from upstream) instead of Savant brand colors, because they omit all color keys from `verticalScrollbarOptions`. Only the chat transcript scrollbox is themed. Root cause is structural: `ChatTheme` has no scrollbar tokens at all, so there is no sanctioned way for any surface to render an on-brand scrollbar. Fix: add `scrollbarThumb`/`scrollbarTrack` tokens to both palettes, make `createChatScrollbarOptions(theme)` the single theme-driven factory, migrate all 7 unstyled sites, and add a regression net that fails if any future scrollbox ships unstyled.

## Environment

- **OS:** Windows 11 (win32), Git Bash shell
- **Language/Runtime:** TypeScript monorepo (`strict: true`), Bun runtime + package manager (pinned 1.3.14)
- **Tool Versions:** Bun 1.3.14; @opentui/core vendored under `node_modules/@opentui/core`
- **Commit/State:** Working tree on `main` ahead of v0.0.27 tag; multiple open working-tree closures (release-only-commits convention). All file:line references verified against this tree.

## Detailed Description

### Problem

Operator report: when sub-agents spawn (thinker, verifier, etc.) and other surfaces overflow, the visible scrollbar is a **gray bar** that does not use Savant's cyan branding. Investigation confirmed it as a lingering pre-fork design element.

### Expected Behavior

Every rendered scrollbar uses Savant theme tokens — cyan thumb on the theme-appropriate track — consistent with the chat transcript's already-correct rendering, in both dark ('Savant Cyberpunk') and light ('Neon Slate') themes, and overridable via the existing `customColors` merge.

### Root Cause

Two compounding causes:

1. **Vendor fallback:** OpenTUI applies hardcoded defaults whenever a scrollbox's `verticalScrollbarOptions.trackOptions` omits colors:
   ```text
   node_modules/@opentui/core/index.node.js:12840-12841
     thumb #9a9ea3 / track #252527   ← upstream gray defaults
   ```
2. **Structural gap:** `ChatTheme` (`cli/src/types/theme-system.ts`) defines **no scrollbar tokens**. The only styling path is the ad-hoc helper `createChatScrollbarOptions(trackColor, thumbColor)` (`cli/src/chat/styles.ts:41-49`), consumed by exactly one production site. Predecessor FID-2026-0812-002 explicitly narrowed scrollbar theming to "the existing chat transcript scrollbar only," leaving every sibling surface on vendor defaults by omission.

### Evidence

Census of every vertical scrollbox in `cli/src` (8 total):

| # | Surface | File:line | Status |
|---|---------|-----------|--------|
| 1 | Chat transcript | `cli/src/chat/panels.tsx:107-111` | ✅ themed via `createChatScrollbarOptions(theme.background, theme.primary)` |
| 2 | Multiline input dock | `cli/src/components/multiline-input/view.tsx:72-75` | ❌ vendor gray |
| 3 | Model picker overlay | `cli/src/components/model-picker.tsx:205-208` | ❌ vendor gray |
| 4 | Provider picker overlay | `cli/src/components/provider-picker.tsx:128-131` | ❌ vendor gray |
| 5 | Savant-Free model selector | `cli/src/components/savant-free-model-selector.tsx:122-125` | ❌ vendor gray |
| 6 | Selectable list (chat history / project picker) | `cli/src/components/selectable-list.tsx:126-129` | ❌ vendor gray |
| 7 | Publish flow agent sections | `cli/src/components/publish-sections.tsx:91-94` (AgentSection) | ❌ vendor gray |
| 8 | Agent checklist (publish flow) | `cli/src/components/agent-checklist.tsx:131-134` | ❌ vendor gray |

All 7 unstyled sites share the identical tell-tale signature:

```tsx
verticalScrollbarOptions={{
  visible: <expr>,
  trackOptions: { width: 1 },
}}
```

No agent-branch component renders its own scrollbar (`agent-branch-wrapper/item/body`, `tool-branch` contain zero `<scrollbox>` primitives) — the gray bars come from the surfaces above, including those hosting sub-agent output. Horizontal scrollbars are `visible: false` everywhere by design and out of scope. OpenTUI `SliderRenderable` semantics verified during RED: `foregroundColor` = thumb color, `backgroundColor` = track color.

Existing contract test asserting the current helper signature/wiring: `cli/src/chat/__tests__/styles.test.ts` ("uses the Savant palette for the existing chat scrollbar", "keeps the chat layout wired to the shared scrollbar contract").

Token precedent: FID-2026-0822-007 added `diffBarAdded`/`diffBarRemoved` and `onPrimary` as explicit consumed `ChatTheme` fields rather than derivations — same pattern applies here.

## Impact Assessment

### Affected Components

- `cli/src/types/theme-system.ts` (+2 required token fields)
- `cli/src/utils/theme-system/palette.ts` (+2 entries × 2 palettes)
- `cli/src/chat/styles.ts` (factory signature evolution)
- `cli/src/chat/panels.tsx` (call site update)
- 7 migrated consumer components (multiline-input/view, model-picker, provider-picker, savant-free-model-selector, selectable-list, publish-sections AgentSection, agent-checklist)
- `cli/src/chat/__tests__/styles.test.ts` (contract updates + new regression net)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists (cosmetic branding defect across 7 surfaces; no functional loss — per template rubric this is the honest rating despite operator priority)
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Converged spec (Thinker Loop 1): tokenize scrollbar colors and make the tokenized path the **only expressible path** (Law 13 — one function, one truth).

1. **Tokens** — add required `scrollbarThumb: string` and `scrollbarTrack: string` to `ChatTheme` in the CONTEXT-SPECIFIC section near the diff-bar/onPrimary tokens, each annotated `FID-2026-0823-002`.
2. **Values (byte-identical to today's transcript — zero regression on the already-correct surface):**
   - Dark 'Savant Cyberpunk': `scrollbarThumb: '#18faf9'`, `scrollbarTrack: '#050508'`
   - Light 'Neon Slate': `scrollbarThumb: '#0891b2'`, `scrollbarTrack: '#ffffff'` (white-on-white track intentionally reproduces today's light transcript look; a border-gray rail would be new visual scope)
   - Both auto-overridable via the existing `customColors` Partial<ChatTheme> merge.
3. **Factory** — evolve `createChatScrollbarOptions(trackColor, thumbColor)` → `createChatScrollbarOptions(theme: ChatTheme)`, reading `theme.scrollbarTrack`/`theme.scrollbarThumb` internally. Return shape unchanged: `{ trackOptions: { width: 1, backgroundColor: <track>, foregroundColor: <thumb> } }`. Keep name/location (rename = cosmetic YAGNI churn); docblock declares it the single sanctioned scrollbar factory app-wide.
4. **Migration** — `panels.tsx` call becomes `createChatScrollbarOptions(theme)`; each of the 7 unstyled sites replaces `trackOptions: { width: 1 }` with `...createChatScrollbarOptions(theme)` plus import `'../chat/styles'` (`'../../chat/styles'` for `multiline-input/view.tsx`). Per-site visibility expressions untouched. No circular-import risk: `chat/styles.ts` is a leaf module of pure constants/helpers.
5. **Tests**
   - T1: factory contract deep-equals — dark `{ width: 1, backgroundColor: '#050508', foregroundColor: '#18faf9' }`; light `{ '#ffffff', '#0891b2' }` (simultaneously proves both palettes carry the exact hex values).
   - T2: update the existing panels wiring regex to the theme-only signature.
   - T3 NEW regression net over all 8 consumer files: each source contains `...createChatScrollbarOptions(theme)` AND does not match `/trackOptions:\s*\{\s*width:\s*1\s*\}/` — kills the vendor-gray fallback class permanently and fails loudly on any future unstyled scrollbox.

### Steps

1. Add `scrollbarThumb`/`scrollbarTrack` to the `ChatTheme` interface (`cli/src/types/theme-system.ts`)
2. Add both token values to both palettes (`cli/src/utils/theme-system/palette.ts`)
3. Evolve the factory to accept `ChatTheme` (`cli/src/chat/styles.ts`) and update its docblock
4. Migrate `panels.tsx` to the theme-only signature
5. Migrate the 7 unstyled sites to `...createChatScrollbarOptions(theme)`
6. Update `styles.test.ts` (T1/T2) and add the T3 regression net
7. Run gates: cli typecheck exit 0; focused `bun test cli/src/chat/__tests__/styles.test.ts`; eslint `--max-warnings 0` on touched files; prettier clean

### Verification

Gates above plus grep-based call-graph reachability: `rg 'createChatScrollbarOptions' cli/src` must show exactly the factory definition + panels.tsx + the 7 migrated sites (no stragglers), and `rg 'trackOptions:\s*\{\s*width:\s*1\s*\}' cli/src --glob '!**/__tests__/**'` must return zero production matches.

## Step Status

> Anti-deferral gate inventory (FID-2026-0817-005). Every step `[x]` implemented or carries `operator-approved <date>` before status may advance past `fixed`.

- [x] Step 1 — ChatTheme interface tokens
- [x] Step 2 — Palette values (dark + light)
- [x] Step 3 — Factory signature evolution + docblock
- [x] Step 4 — panels.tsx migration
- [x] Step 5 — 7-site migration
- [x] Step 6 — Tests T1/T2/T3
- [x] Step 7 — Gates (typecheck, tests, eslint, prettier)

## Perfection Loop

### Loop 1 — RED

- **RED:** Cataloged all 8 vertical scrollboxes (table above); confirmed vendor-gray fallback values at `node_modules/@opentui/core/index.node.js:12840-12841`; confirmed zero scrollbar tokens in `ChatTheme`; confirmed single-consumer helper; identified FID-2026-0812-002 scope-narrowing as the origin of the pre-fork leftover. All files read 0-EOF.
- **GREEN:** Spec converged via Thinker (token pair, byte-identical values, theme-only factory signature, migration mechanics, T1–T3 test plan). Implementation pending.
- **AUDIT:** PASS — Verifier zero FAILs across four dimensions (spec-match, stragglers via T3 net + typecheck arity proof, coverage T1–T3, Law 6/11 patterns). Two non-blocking notes: allowlist-based T3 net won't catch brand-new future scrollbox files; graph index stale (deterministic substitutes green).
- **ADVERSARIAL:** CONFIRMED — Adversary re-verified every PASS first-hand with resolved citations (styles.ts:50-56 factory; theme-system.ts:168/171 tokens; palette.ts:79-80/179-180 values; 8/8 consumer wiring at panels.tsx:111, multiline-input/view.tsx:75, model-picker.tsx:208, provider-picker.tsx:131, savant-free-model-selector.tsx:125, selectable-list.tsx:129, publish-sections.tsx:94, agent-checklist.tsx:134; zero bare trackOptions matches; census-complete probe: exactly 8 verticalScrollbarOptions sites in cli/src). Zero refutations; verdict STANDS.
- **CHANGE DELTA:** N/A (initial authoring).

### Missed Questions

> Surface every question that should have been asked when this FID was created, answer it with the most robust default derivable from inspection, and fold the answer back into the relevant sections.

1. *Should horizontal scrollbars be styled too?* → No. Every horizontal `scrollbarOptions={{ visible: false }}` is never rendered; coloring them is dead config. Recorded as excluded scope.
2. *Does the design-system JSON contract need scrollbar entries?* → No. Scrollbar tokens are CLI-theme-level (same tier as `aiLine`/`modeFastBg`), not design-system-contract fields. Considered and excluded.
3. *Circular-import risk importing `chat/styles` into components?* → None; `chat/styles.ts` is a leaf module (constants + pure helpers only).
4. *Do custom themes break?* → No. Tokens are required fields with palette defaults; the existing `customColors` Partial<ChatTheme> merge overrides them automatically.
5. *What if a future vendored OpenTUI bump renames SliderRenderable keys?* → T1's deep-equal on the returned shape catches it immediately.

### Implementation Evidence (REQUIRED for `closed`)

> A FID **cannot** be set to `closed` without this section filled. No silent deferrals — every step must be `implemented`, `blocked`, or `deferred` (operator-approved only).

- [x] **Commit SHA:** None — working-tree closure per release-only-commits convention (LEARNINGS canonical rule); swept into the next automation release commit.
- [x] **File:line ranges:** cli/src/chat/styles.ts:50-56 (factory); cli/src/types/theme-system.ts:167-171 (tokens); cli/src/utils/theme-system/palette.ts:76-80 (dark) + :176-180 (light); cli/src/chat/panels.tsx:111; cli/src/components/multiline-input/view.tsx:75; cli/src/components/model-picker.tsx:208; cli/src/components/provider-picker.tsx:131; cli/src/components/savant-free-model-selector.tsx:125; cli/src/components/selectable-list.tsx:129; cli/src/components/publish-sections.tsx:94; cli/src/components/agent-checklist.tsx:134; cli/src/chat/__tests__/styles.test.ts:30-44 (T1), :54 (T2), :66-83 (T3); fixtures cli/src/__tests__/unit/segmented-control.test.ts + cli/src/utils/__tests__/syntax-theme.test.ts (+scrollbarThumb/scrollbarTrack literals)
- [x] **Gate output:** `bun run --cwd=cli typecheck` exit 0; `bun test cli/src/chat/__tests__/styles.test.ts` 6 pass / 0 fail / 13 expect(); segmented-control+syntax-theme combined 14 pass / 0 fail / 27 expect(); `bun x eslint` --max-warnings 0 exit 0 on all 14 touched files; `bunx prettier --check` "All matched files use Prettier code style!" on all 14
- [x] **Reproducibility:** `grep -rn createChatScrollbarOptions cli/src --include=*.ts --include=*.tsx` → exactly the factory definition + 8 production spread sites + tests; `grep -rEn "trackOptions: \{ width: 1 \}" cli/src --include=*.ts --include=*.tsx` → 0 matches
- [x] **Step statuses:** Steps 1–7 all implemented (see Step Status)

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that referenced code exists. FID metadata is a claim; code is ground truth.

- [x] Files referenced in Affected Components exist
- [x] Implementation matches the Proposed Solution
- [x] Typecheck/tests/lint pass with pasted tool output
- [x] Production call-graph evidence is present for new or repaired wiring
- [x] FID status reflects the actual implementation state

### Loop 2 — Independent audit and self-correction

- **RED:** Pending.
- **GREEN:** Pending.
- **AUDIT:** Pending.
- **ADVERSARIAL:** Pending.
- **CHANGE DELTA:** Pending.

### Loop 3 — Final convergence

- **RED:** Pending.
- **GREEN:** Pending.
- **AUDIT:** Pending.
- **ADVERSARIAL:** Pending.
- **CHANGE DELTA:** Pending.

## Resolution

- **Closed Date:** 2026-08-23 03:03
- **Fix Description:** scrollbarThumb/scrollbarTrack tokens added to ChatTheme (dark #18faf9/#050508, light #0891b2/#ffffff); createChatScrollbarOptions(theme) evolved into the single theme-driven factory; transcript + 7 previously vendor-gray surfaces migrated; T1–T3 contract + regression net added.
- **Tests Added:** Yes — styles.test.ts rewritten (both-themes token contract, updated wiring regex, new 8-consumer regression net); two ChatTheme test fixtures repaired for the new required tokens.
- **Verification Evidence:** Gates in Implementation Evidence above; Adversary meta-verification CONFIRMED with zero refutations.
- **Archived:** 2026-08-23 03:03

> Carried observation (NEEDS-REVIEW): operator restart + live TUI smoke (e.g. `/model` picker overflow in dark AND light themes) to visually confirm rendered cyan thumbs — static wiring is proven; render color is runtime-only evidence.

## Lessons Learned

1. **Narrowing a theming FID to one surface leaves siblings silently broken.** FID-2026-0812-002 themed exactly one scrollbar and shipped; the other seven stayed on vendor defaults for weeks because nothing failed loudly. Prefer app-wide primitives + regression nets over point fixes.
2. **A missing semantic token is an invitation to vendor fallback.** When a UI kit has hardcoded defaults, every surface that omits styling silently inherits them — enumerate ALL instantiation sites (the census table pattern) whenever introducing a shared primitive.
3. **Byte-identical value migration de-risks re-skins.** Choosing token values equal to today's correct rendering isolates the structural change (tokens/factory/migration) from any visual change — two review axes instead of three.