# FID: Code Universe — contrast, type floor, focus rings, and token routing

**Filename:** `FID-2026-0928-004-file-universe-contrast-type-focus-tokens.md`
**ID:** FID-2026-0928-004
**Severity:** medium
**Status:** closed
**Created:** 2026-09-28 19:05
**Automation level:** 3
**YAGNI-Compliance:** Verified
**Parent:** FID-2026-0928-003 (the audit that found D1–D4)

---

## Summary

Fixes the four measured defects in the Code Universe stylesheet
(`cli/src/commands/graph-export/universe-css.ts`), all of them mechanical:

| | Defect | Result |
|---|---|---|
| **D1** | six text pairs below WCAG AA 1.4.3 | all six now ≥ 4.62:1 |
| **D2** | 122 hardcoded hex in the body, 57 distinct | 52 hex, 40 distinct; `var()` 58 → 130 |
| **D3** | 29 of 38 font-size declarations under 11px (floor 8px) | floor is now 10px |
| **D4** | three focus rules for ~15 control groups | one shared ring across 10 groups |

No layout, markup, or behaviour change. The visual identity is untouched.

## Environment

- **OS:** Windows 11, Git Bash. **Runtime:** Bun 1.3.14.
- **Surface:** `cli/src/commands/graph-export/universe-css.ts` (single template
  literal, `UNIVERSE_CSS`) — the stylesheet of the offline HTML export.
- **Governance:** ECHO v0.1.2-single-agent, `strict_mode: true`, level 3.

## Detailed Description

### Presentation (Law 2, recorded before implementation)

Delivered in-session before any edit, as the FID-2026-0928-003 audit: the
measured table of failing pairs, the token-usage count, the type-scale tally,
and the focus-rule enumeration, with the proposed fix shape for each. This
record is the approval surface; the operator's intervention right is preserved.

### Root cause

None of the four is a logic defect. They are four *absences* — a contrast check
that was never applied, a palette declared and then bypassed, a type scale
nobody floored, and a focus language extended to only the two controls that
happened to get roving focus.

### Evidence — before

```text
D1  .document-line-number  #3f6681  3.24      FAIL AA (needs 4.5)
    .document-breadcrumb-sep #3f6681 3.24      FAIL   ← found during implementation
    .region-file small     #4d6a86  3.34      FAIL
    .region-more           #607899  4.17      FAIL
    .center-focus-hint     #607899  4.17      FAIL
    .universe-footer       #607899  4.21      FAIL
D2  body: 122 six-digit hex literals, 57 distinct | var() refs 58
D3  font-size: 17×9px, 9×10px, 3×8px  → 29 of 38 below 11px
D4  focus rules in the whole stylesheet: 3
```

The audit had reported **five** D1 pairs. Implementation found a sixth:
`.document-breadcrumb-sep` shares `#3f6681` and is used for the path separator
between breadcrumb segments. The count was corrected rather than inherited.

## Impact Assessment

- [x] Medium: a shipped, user-facing artifact with measurable accessibility
      shortfalls in its text layer and an ungoverned palette. No data loss, no
      functional breakage, no behavioural change.

## Proposed Solution

**D1 — lift the six colours to ≥4.5:1, preserving hue.** Each replacement was
computed by scaling the original RGB channels uniformly until the ratio cleared
**4.6** (a margin over 4.5, so a future background nudge does not immediately
re-break it), then verified:

| Selector | Before | After | Ratio |
|---|---|---|---|
| `.document-line-number` | `#3f6681` | `#4f80a1` | 4.66 |
| `.document-breadcrumb-sep` | `#3f6681` | `#4f80a1` | 4.66 |
| `.region-file small` | `#4d6a86` | `#5e81a3` | 4.62 |
| `.region-more` | `#607899` | `#6780a4` | 4.67 |
| `.center-focus-hint` | `#607899` | `#6780a4` | 4.67 |
| `.universe-footer` | `#607899` | `#667fa2` | 4.64 |

`#607899` needed **two** replacements, not one: `.region-more` and
`.center-focus-hint` sit on the panel while `.universe-footer` sits on the
header, and the two backgrounds composite differently. A single global replace
would have fixed two and left one failing — the regression suite proves it.

**D2 — route the duplicated families through tokens.** Eight tokens added to
`:root` (`--edge --label --label-2 --btn --btn-edge --chip --rule
--accent-soft`), and ten families routed, including the two that were *already
declared and then re-typed as literals*: `--muted` (`#7183a8`, 9 occurrences)
and `--line` (`#1a3150`, 5). That is 14 occurrences of pure duplication, and the
clearest Law 13 win in the file.

The global replace also rewrote the `:root` block itself into self-references;
that was detected by an explicit self-reference check and repaired before any
test ran.

**D3 — floor the type scale at 10px.** `font-size:8px` and `font-size:9px` both
→ `10px` (20 declarations). No selector-specific exceptions: the rule is a
floor, so it is expressed as a floor.

**D4 — one focus ring for every remaining control.** A single rule covering ten
selector groups (`.universe-actions button`, `.copy-path`, `.window-btn`,
`.document-copy`, `.browser-back`, `.search-row`, `.sound-panel button`,
`.region-nav-actions button`, `.document-wrap-btn`,
`.document-breadcrumb-folder`), reusing the exact `1px solid var(--cyan)` +
`0 0 14px #18faf977` treatment the region nav and browser cards already use, so
keyboard focus looks the same everywhere.

### Rejected

- **A wholesale token collapse.** 57 distinct literals include many
  one-off alpha variants; a full collapse is a redesign, not a fix. The
  bounded version removes 70 of 122 literals and touches only families that
  were already repeated 4–10 times.
- **A restyle.** Gate 2 and FIDs 0807-002…0807-024 show the identity is
  deliberate. Every change here is a value lift or a routing change; no
  gradient, glow, or composition was altered.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/commands/graph-export/__tests__/universe-css-a11y.test.ts
- gate: test cli/src/commands/__tests__/graph-export.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:a8aaf75bfac33d757f9c183c79ca2aaea4e9360b84e2bc48a363e4a64d5f76aa
- verified: 2026-09-28T14:46:10.018Z
- typecheck cli: exit 0
- test cli/src/commands/graph-export/__tests__/universe-css-a11y.test.ts: exit 0
- test cli/src/commands/__tests__/graph-export.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** A new suite was written before any stylesheet edit, and it reads the
  real declaration out of the shipped CSS rather than restating a literal — so
  reverting a value re-breaks the leg. **13 of 14 legs failed** on the
  pre-fix stylesheet (1 pass: the guard that `--muted` was never broken, which
  must keep passing so a fix cannot "pass" by wrecking the shared token).
- **GREEN:** D1–D4 as specified above.
- **AUDIT:** 14/14; `graph-export.test.ts` green (the deterministic-artifact
  gate); full `cli` suite 3830 legs / 0 fail; `typecheck cli` exit 0.
- **ADVERSARIAL:** four attempts to break it, below.
- **CHANGE DELTA:** ~60 lines of one template literal, plus one new test file.

### Missed Questions

1. *Would raising the type floor break the fixed-height containers?* → Cannot be
   settled by reading CSS; the containers are flex/grid with `overflow:auto`
   (`browser-grid`, `center-focus ul`, `document-surface`, `search-results`), so
   larger text truncates-and-scrolls rather than clips. **NEEDS-REVIEW by
   rendering** — carried as R2. The honest position is that the leg is
   unverified, not that it is safe.
2. *Is a 4.6 margin enough?* → It survives a small background nudge but is not
   proof against a large one. A `contrast` re-check belongs in the suite rather
   than in a comment; the suite does exactly that.
3. *Should the alpha-suffixed literals (`#18faf955`) be tokenised too?* → Not
   now. `color-mix()` would be needed and changes browser support. Recorded as
   a known remainder, not silently dropped.

### Adversarial review

- **Refuted: "the replace corrupted `:root`."** It did — the global replace
  turned the token definitions into `var(--muted)` self-references. Caught by
  an explicit `--x:var(--` self-reference scan, repaired, and that check is now
  a standing assertion in the measurements.
- **Refuted: "one `#607899` fix covers all three."** The three sit on two
  different composited backgrounds. A single value would have left
  `.universe-footer` at 4.17 and the suite would have caught it — which is the
  point of computing per pair.
- **Refuted: "the audit's five D1 pairs are complete."** A sixth
  (`.document-breadcrumb-sep`) shares the failing colour. Found by locating every
  occurrence rather than trusting the audit's list.
- **Attempted: break the focus legs by deleting the new rule.** `.region-row`,
  `.region-file` and `.region-tree-folder` are deliberately **absent** from the
  D4 list — they already get a ring from the JS-applied `.nav-key-focus` class
  (roving focus, `universe-app-script-f.ts:176-178`). The test accepts either
  mechanism rather than demanding one, so a removal of the class would be caught
  without blocking a legitimate implementation.

### Code Verification Evidence

- [x] Files referenced exist
- [x] Implementation matches the spec
- [x] Gates pass — receipt below, all live
- [x] Call-graph: `UNIVERSE_CSS` is consumed only by `assembleUniverseShell`
      (`html-sections.ts:5,64`) and is asserted directly by the new suite, so
      the change is proven consumed rather than merely compiling
- [x] Deterministic-artifact gate still green (`graph-export.test.ts`)

### Loop 2 — measurements after

```text
body six-digit hex literals : 122 → 52   (distinct 57 → 40)
var() references            :  58 → 130
tokens declared in :root    :  16 → 24
font-size below 10px        :  20 →  0
focus rules                 :   3 →  4  (one of which covers 10 selector groups)
self-referential tokens     :  none
cli suite                   : 3830 pass / 0 fail
```

## Resolution

- **Closed Date:** 2026-09-28 19:40
- **Fix Description:** D1 six colour lifts computed per background to ≥4.62:1;
  D2 ten literal families routed through eight new plus two existing tokens;
  D3 type floor raised to 10px; D4 one shared cyan focus ring across ten
  selector groups. All in `UNIVERSE_CSS`. No markup, layout or behaviour
  change.
- **Tests Added:** Yes —
  `cli/src/commands/graph-export/__tests__/universe-css-a11y.test.ts`, 14 legs
  (6 contrast, 1 token-integrity guard, 1 type floor, 6 focus). 13 red before
  the change.
- **Verification Evidence:** receipt below (4/4, all gates live). `typecheck
  cli` exit 0; `cli` suite 3830 pass / 0 fail.
- **Archived:** 2026-09-28 19:40

## Open Remediation

- **R1 (Gate 7, operator ruling).** The draggable OS-window metaphor plus the
  comet, starfield, watermark and SFX. Dual-natured: the windows carry real
  panel state, the atmosphere does not. A product-identity decision; the agent
  does not make it. Level 1.
- **R2 (Gate 6, NEEDS-REVIEW).** `body{overflow:hidden}` +
  `.universe-shell{height:100vh}` may clip short viewports, and the D3 type
  lift makes tight one-line headers more likely to wrap. Settleable only by
  rendering, which this session cannot do. Level 1.
- **R3.** 40 distinct literals remain in the body, many one-off alpha variants.
  Tokenising them needs `color-mix()` and a browser-support decision. Level 3
  once that decision is made.
