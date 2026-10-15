<!-- markdownlint-disable MD013 -->

# FID: Offline Graph Initialization and Loader Failure

**Filename:** `FID-2026-0807-005-offline-graph-initialization-and-loader-failure.md`
**ID:** FID-2026-0807-005
**Severity:** high
**Status:** closed (pre-cutoff historical record — operator bulk-close ruling, 2026-10-03)
**Created:** 2026-08-07
**Author:** Savant 
**YAGNI-Compliance:** Verified

## Summary

The generated offline graph export remains on `INITIALIZING UNIVERSE`. Header controls report `resetUniverse is not defined` and
`fitUniverse is not defined`. The first failure is a syntax error in the inline application script, not the `file://` unique-origin
message:

```text
graph-app.js:303
  doc.text.split('
                 ^
SyntaxError: Invalid or unexpected token
```

The TypeScript template literal converted the intended JavaScript newline escape into a literal newline inside a single-quoted
string. The application IIFE therefore never parses, so it never installs global controls or reaches the loader-clearing code.

## RED

- **Confirmed:** The generated app script is invalid at its document rendering `doc.text.split()` expression.
- **Confirmed:** `window.resetUniverse` and `window.fitUniverse` are assigned only near the end of the app IIFE; a parse failure prevents both assignments.
- **Confirmed:** The loader is hidden only after successful `buildGraph()` or inside the runtime fallback catch, neither of which can run when parsing fails.
- **Confirmed:** The jumpy loader ring uses a combined `rotate()` plus `translateX()` transform, which changes the transform origin during animation and produces an unstable visual motion.
- **Not root cause:** Chrome's `file:` unique-origin notice is expected for local files and is not itself a fatal error.

Evidence:

```text
Generated artifact: dev/exports/graph/savant-graph.html
Script index 2 syntax failure: line 303, doc.text.split(' followed by a raw newline
Header controls: onclick="resetUniverse()" and onclick="fitUniverse()"
SIGMA bundle: syntax-valid and exposes globalThis.Sigma / globalThis.Graphology
```

## GREEN

1. Avoid template-literal newline ambiguity by splitting documents with `String.fromCharCode(10)` in the generated app.
2. Keep the existing runtime `try/catch` fallback, but add explicit startup status/loader handling so runtime renderer failures do not
   leave the page appearing frozen.
3. Replace the loader's compound transform animation with a simple `rotate(360deg)` linear animation for smooth motion.
4. Add static generated-HTML contracts and a script syntax check to prevent another invalid inline application script.
5. Regenerate the real export and verify the app script parses, controls exist, the loader/fallback paths are present, and the
   `file:` artifact remains self-contained.

## AUDIT

- Required evidence: `template.ts` source escape, generated app-script syntax check, focused graph-export tests, typecheck, ESLint,
  Prettier, and real artifact probe.
- Runtime Chrome interaction is a separate gate. If browser navigation is unavailable, report `NEEDS-REVIEW`; do not infer browser
  success from static HTML.

## ADVERSARIAL

- **Refuted:** Treating the `file:` unique-origin message as the primary defect.
- **Confirmed:** A syntax error before IIFE execution explains all downstream undefined-control errors and the stuck loader.
- **Adjusted:** The spinner fix is cosmetic but required because the user explicitly reports unstable motion; it must not be used as
  evidence that initialization succeeded.
- **Omission check:** Covers syntax escaping, global controls, loader failure behavior, smooth animation, static checks, artifact
  regeneration, and browser-verification honesty.

## Resolution

- **Fix:** Replaced the template-literal newline escape with `String.fromCharCode(10)`, added deterministic loader hiding and fallback handling, and changed the loader ring to linear rotation.
- **Verification:** Focused tests **17 pass / 0 fail** with 134 expectations; live harness **18 pass / 0 fail**; CLI typecheck passed; ESLint passed; Prettier passed; markdownlint passed; exactly one app script matched the stable `function buildGraph()` marker and `vm.Script` syntax passed; `resetUniverse` and `fitUniverse` markers passed; smooth animation marker passed; real export regenerated at `C:\\Users\\spenc\\dev\\savant-code\\dev\\exports\\graph\\savant-graph.html` (**3,340,680 bytes**).
- **Browser runtime:** NEEDS-REVIEW at closeout; subsequently covered by the
  FID-2026-0807-019/020 Playwright `file://` zero-network suite and Chrome
  probes (zero console errors, interactive contract green).
- **Commit/PR:** Pending operator push
- **Archived:** Yes — moved to `dev/fids/archive/` on close
