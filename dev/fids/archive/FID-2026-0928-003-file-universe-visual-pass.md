# FID: Visual pass over the Code Universe (file universe) system

**Filename:** `FID-2026-0928-003-file-universe-visual-pass.md`
**ID:** FID-2026-0928-003
**Severity:** medium
**Status:** closed
**Created:** 2026-09-28 18:20
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Implementation:** FID-2026-0928-004 (D1–D4, closed 2026-09-28)

---

## Summary

A design audit of the offline Code Universe export — the self-contained HTML
graph explorer in `cli/src/commands/graph-export/` (22 files, 2937 lines) and
its renderer-neutral payload in `packages/knowledge-graph/src/export/`. Reviewed
against the agent design constitution's nine hard gates. **The system is
substantially stronger than a typical generated artifact** — real state
coverage, real keyboard work, honest content, reduced-motion support. The
measured defects were concentrated: **five text colours failed WCAG AA at the
8–10px sizes they are actually used at**, and the declared colour palette was
bypassed almost everywhere.

> **Closure note.** D1–D4 were implemented the same day under
> **FID-2026-0928-004** (receipt 4/4). The D1 count below said five;
> implementation found a **sixth** (`.document-breadcrumb-sep`, sharing
> `#3f6681`). The record is corrected rather than inherited. **R1 and R2 remain
> open operator rulings** and are carried in *Open Remediation*.

## Environment

- **Platform:** web — a single self-contained `.html` file opened over `file://`
- **Surface:** `cli/src/commands/graph-export/` (styles `universe-css.ts`,
  markup `html-sections.ts`, app `universe-app-script*.ts` a–h)
- **Renderer:** Sigma.js (WebGL) + ELK layout, both inlined
- **Governance:** ECHO v0.1.2-single-agent, `strict_mode: true`, level 3

## Detailed Description

### Intent (Gate 1)

Offline, self-contained exploration of a codebase as a spatial graph: pan/zoom a
force-directed region map, drill into a system, read file documents inline, and
search by path or system. Audience is a developer reviewing an unfamiliar repo
with no network and no server.

### What passes, with evidence

- **Gate 2 (existing system).** 16 CSS custom properties were declared in
  `:root` (`--void #030611`, `--ink #dce7ff`, `--muted #7183a8`, `--cyan
  #18faf9`, `--blue #4fa8ff`, `--line #1a3150`, `--panel #081224e8`, plus seven
  `--scroll-*` tokens) and referenced 58 times.
- **Gate 3 (honest content).** Every number is real data, not decoration:
  `html-sections.ts:75` renders `graph.meta.files`,
  `graph.universe.regions.length`, `graph.meta.edges`. The empty-preview state
  says so outright — "No preview (previews are opt-in at export time)"
  (`html-sections.ts:135`) rather than faking one.
- **Gate 5 (state completeness) — the strongest part.** Loading
  (`#graph-loading`, `html-sections.ts:98`), empty (`.browser-empty`,
  `.search-empty`), error (`.document-unavailable` with glyph + copy), total
  failure (`.graph-fallback`), truncation/preview (`.document-preview-banner`,
  `.large-document-note`), and disabled (`.browser-back:disabled,
  .document-copy:disabled`). Six distinct non-happy states, all real.
- **Gate 4 (accessibility) — partially passing at audit time.** Semantic
  `header/main/section/aside/nav/footer`; `lang="en"`; `role="combobox"` with
  `aria-expanded`/`aria-controls`; `role="tooltip"` with `aria-live="polite"`;
  `aria-pressed` on the SFX toggle; decorative layers correctly `aria-hidden`
  (`html-sections.ts:47,97`). `prefers-reduced-motion` is honoured globally
  (`universe-css.ts:13`) and a `.motion-off` class exists. Keyboard work is
  real: roving focus with Arrow/Home/End over the region nav
  (`universe-app-script-h.ts:46-49`, applied by `navKeyFocusRow` at
  `universe-app-script-f.ts:176-178`) and **staged Escape dismissal** so the
  first Escape leaves the selection and the second clears it
  (`universe-app-script-h.ts:87-90`).

### Measured defects (all fixed by FID-2026-0928-004)

**D1 — text pairs failing WCAG AA (1.4.3) at the size they are used.**
Computed from the literal token values with alpha composited over their real
backgrounds. Audit found five; implementation found a sixth.

| Selector | Colour | Ratio | AA (needs 4.5) |
|---|---|---|---|
| `.document-line-number` | `#3f6681` | **3.24** | FAIL |
| `.document-breadcrumb-sep` | `#3f6681` | **3.24** | FAIL |
| `.region-file small` | `#4d6a86` | **3.34** | FAIL |
| `.region-more` | `#607899` | **4.17** | FAIL |
| `.center-focus-hint` | `#607899` | **4.17** | FAIL |
| `.universe-footer` | `#607899` | **4.21** | FAIL |

All sit at **8–9px**, far below the 24px/18.66px-bold "large text" bar, so the
3:1 allowance does not apply. `.document-line-number` was the worst and the most
consequential: the gutter for every line of code in the document reader. Passing
pairs for contrast: `--cyan` 15.49, document body `#c4e8ff` 15.43, `--muted` on
void 5.31, sidebar `pre` 11.87.

**D2 — the palette declared and then bypassed.** 16 tokens declared, 58
`var()` references, **185 hardcoded hex literals, 104 distinct**. Notably
`--muted` and `--line` were *already declared* and still re-typed as literals
in 14 places.

**D3 — type scale bottoms out at 8px.** Of 38 `font-size` declarations, 17 at
9px, 9 at 10px, 3 at 8px — 29 below 11px, in a tool whose job is reading code.

**D4 — no designed focus ring on most controls.** Only three focus rules existed
(`input:focus`, `.region-nav button:focus-visible`,
`.browser-card:focus-visible`). **Mitigated:** there is no global `outline:none`
reset, so the browser default focus ring still rendered — an inconsistency, not
an absent indicator.

## Impact Assessment

- [x] Medium: a shipped, user-facing artifact with measurable accessibility
      shortfalls in its text layer, and a token system that did not govern the
      code that used it. No data loss, no functional breakage.

## Proposed Solution

Executed in FID-2026-0928-004. Lifted each colour per background to ≥4.62:1;
routed ten literal families through eight new plus two existing tokens; raised
the type floor to 10px; added one shared cyan focus ring across ten selector
groups. No layout, markup or behaviour change.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/commands/graph-export/__tests__/universe-css-a11y.test.ts
- gate: quality

## Perfection Loop

### Loop 1 — RED

- **RED:** Contrast measured on 16 real token/background pairs; token usage
  counted; type scale tallied; focus rules enumerated. Six pairs fail AA.
- **GREEN:** Findings recorded with reproducible selectors and numbers; the four
  mechanical fixes specified; the two judgment calls routed to the operator.
- **ADVERSARIAL:** Deliberate refutation passes, both of which changed the
  report:
  1. **"The status is `undefined`"** — no. Every one of the 12 bullet-form
     records reads `closed`, and 11 are outside the contract anyway. Reported
     as a *parser* gap, not a 12-record contract hole.
  2. **"Many controls have no focus indicator"** — refuted. A first pass read
     the tail of `.region-nav button:focus-visible` as a bare global
     `button:focus-visible` rule. There is no such rule; but there is also no
     global `outline:none` reset, so the UA focus ring survives on unstyled
     buttons. Downgraded from a Gate-4 failure to a consistency gap (D4).
  - Also checked and cleared: `Escape` is handled with staged dismissal; the
    region nav does have real roving focus.
- **CHANGE DELTA:** n/a — converged, no code written in this record.

### Missed Questions

1. *Is the dark sci-fi palette inherently low-contrast?* → No. `--cyan` scores
   15.49 and the document body 15.43 on the same background. The failures are
   specific muted greys chosen for hierarchy, not a palette-wide problem — so
   the fix is local and the identity survives.
2. *One token sweep or a redesign?* → One token sweep, bounded to families
   already repeated 4–10 times.
3. *Is the window metaphor load-bearing or decorative?* → Both, and that is why
   it is the operator's call (R1) rather than an agent finding.
4. *Is the D1 list complete?* → **No — this is the question that mattered.**
   Auditing the list instead of the file hid a sixth occurrence. Now every
   occurrence of each failing colour is located by search, and the regression
   suite reads the live value rather than a restated literal.

### Code Verification Evidence

- [x] Files referenced exist
- [x] Findings are measurements, reproduced from the shipped literals
- [x] Typecheck/tests/lint pass
- [x] Call-graph: `template.ts` → `build-graph-export.ts` → `html-sections.ts` →
      `universe-css.ts` / `universe-app-script.ts`; read end to end
- [x] No PASS claimed without a quoted selector or number

### Loop 2 — closure

D1–D4 implemented and verified under **FID-2026-0928-004** (receipt 4/4, all
gates live). Final measurements:

```text
D1  six failing pairs        →  0    (all now ≥ 4.62:1)
D2  body hex 122 / 57 dist.  →  52 / 40     var() 58 → 130
    tokens in :root 16       →  24
D3  font-size under 10px     →  0    (floor raised from 8px to 10px)
D4  focus rules 3            →  4    (one of which covers 10 selector groups)
cli suite                    →  3830 pass / 0 fail
```

**R1 and R2 were not addressed and are not the agent's to address.** They are
restated verbatim under *Open Remediation* so they cannot be lost.

## Resolution

- **Closed Date:** 2026-09-28 19:45
- **Fix Description:** Audit complete; all four mechanical findings implemented
  under FID-2026-0928-004. R1/R2 remain open rulings.
- **Tests Added:** Yes (under FID-2026-0928-004) —
  `cli/src/commands/graph-export/__tests__/universe-css-a11y.test.ts`, 14 legs
- **Verification Evidence:** FID-2026-0928-004 receipt 4/4; `cli` suite 3830/0;
  `typecheck cli` exit 0
- **Archived:** 2026-09-28 19:45

## Open Remediation

- **R1 (Gate 7, authentic interface) — open, operator ruling.** The panels are
  draggable OS-style windows with title bars, minimize/maximize/close,
  corner-bracket framing (`.center-focus::before` clip-path), a
  comet-character watermark, a starfield with shooting stars, and sound effects.
  The constitution's Gate 7 warns against "decorative scaffolding that does not
  serve the product". Genuinely dual-natured: the windows do carry real panel
  state (the sidebar docks, and the stacked-taskbar arithmetic at
  `universe-css.ts:12` is load-bearing), but the comets, starfield and watermark
  are pure atmosphere. **A product-identity decision, not a defect, and the
  agent does not make it.** Level 1.
- **R2 (Gate 6, responsive safety) — open, NEEDS-REVIEW.** `body{overflow:hidden}`
  plus `.universe-shell{height:100vh;overflow:hidden}` means a viewport shorter
  than the content is clipped rather than scrolled. Two breakpoints (1100px,
  800px) are reasonably thorough, but the short-viewport case cannot be settled
  by reading the stylesheet — only by rendering. **The D3 type lift makes this
  more likely to matter**, since one-line headers may now wrap. Rendering is out
  of reach for this session. Level 1.
