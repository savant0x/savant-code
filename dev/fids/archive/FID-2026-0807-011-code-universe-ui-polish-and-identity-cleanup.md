# FID-2026-0807-011 — Code Universe UI polish + Savant identity cleanup

**Phase:** RED → GREEN → AUDIT → ADVERSARIAL → COMPLETE
**Date:** 2026-08-07
**Status:** closed (pre-cutoff historical record — operator bulk-close ruling, 2026-10-03)
**YAGNI-Compliance:** All items operator-requested; no speculative scope.

## RED — Issue catalog

### Part A — Code Universe UI (operator feedback)

- **A1 — Watermark too visible.** `.center-focus::after` renders the
  character watermark at `opacity:.25` (`template.ts` CSS). Operator: "about
  half the opacity of what it is."
- **A2 — Close button is a floating chip.** `.center-focus-close` and
  `.sidebar-close` are circular chips floating 10–14 px inside the panels,
  hovering over toolbar/browser content. Operator: the × must sit in the top
  right corner "like a regular min/max button", not hovering.
- **A3 — Misleading oversized message + no limit knobs.** `eslint.config.js`
  (7 KB) reports "FILE TOO LARGE FOR EXPORT" because the 8 MB
  `DEFAULT_DOCUMENT_TOTAL_TEXT_BYTES` budget is consumed cumulatively before
  that file is reached (`export-serializer.ts:244-248, 443-450`). The card
  says "Re-run /graph-export with a larger document limit" but no such knob
  exists — `serializeGraphForExport` accepts `documentBytes`/
  `documentTotalTextBytes`/etc. yet `buildGraphExportHtml` never passes them.

### Part B — Savant identity cleanup (feature request)

Past-session feature request `dev/scratchpad/2026-08-07-savant-identity-
cleanup.md` (content pasted by operator): remove Savant/Savant identity
priming from active config. Already done by the prior session:
`ECHO-single-agent.md` + `echo-v0.1.2-single-agent.md` created,
`FREEREADME.md` rewritten, `protocol-summary.ts` line 26 already says
"single-agent", and `docs/gravity-integration-starter.md` lines 5–7 already
carry the rebrand note. Still outstanding:

- **B1** `protocol.config.yaml:93-99` — `single_agent:` namespace → `single_agent:`
  (version `0.1.2-single-agent` → `0.1.2-single-agent`).
- **B2** `common/src/util/protocol-config.ts:177-190` — legacy-prefixed
  parser identifiers + `'savant'` section key → `singleAgentLines`/
  `singleAgentProtocolLines` + `'single_agent'`.
- **B3** `common/src/util/__tests__/protocol-config.test.ts` — tests 2/3 YAML
  + version strings.
- **B4** `packages/agent-runtime/src/echo/__tests__/enforcement.test.ts:163,167`
  — `echo-v0.1.2-single-agent.md` → `echo-v0.1.2-single-agent.md`.
- **B5** Delete `ECHO-single-agent.md` (no active references; grep-verified).
- **B6** Delete `dev/nova/specs/echo-v0.1.2-single-agent.md`.

Explicit non-goals: `.env.example` / `env-schema.ts` / `login/constants.ts`
legacy env aliases, `.gitignore` `.savant/`, `NOTICE`/`LICENSE` legal
attribution, `CHANGELOG.md`/`LEARNINGS.md` history — all retained.

## GREEN — Converged design

- **A1** Watermark `opacity:.25` → `.12` (≈ half).
- **A2** Both close buttons become square window controls flush to the panel
  corner (`right:0;top:0;border-radius:0`, border-left/bottom only). Content
  clearance: `.document-toolbar`, `.browser-heading`, `.graph-sidebar h2`,
  `.graph-sidebar .eyebrow` gain `padding-right` so nothing slides under the
  ×. `.center-focus>*:not(...)` positioning rule unchanged.
- **A3** `buildGraphExportHtml` parses optional env knobs
  (`SAVANT_GRAPH_EXPORT_DOCUMENT_LINES` / `_DOCUMENT_BYTES` /
  `_DOCUMENT_IMAGE_BYTES` / `_TOTAL_TEXT_BYTES` / `_TOTAL_MEDIA_BYTES`) and
  forwards them to the `documents:true` serialize call (undefined → serializer
  defaults). The oversized card gains the real file size (`formatBytes`) and
  an actionable hint naming the env vars.
- **B1–B4** Straight namespace/identifier renames per the feature request.
- **B5–B6** `git rm` both files.

## AUDIT — Verification evidence

- Typecheck ×3 exit 0 (common, agent-runtime, cli).
- `graph-export.test.ts` 31/31 (287 expects) incl. new env-cap behavioral
  test (`SAVANT_GRAPH_EXPORT_DOCUMENT_LINES=1` truncates the fixture's
  two-line files: no `"lineCount":2` in the export, baseline keeps it);
  `protocol-config.test.ts` 6/6; `enforcement.test.ts` 13/13.
- ESLint `--max-warnings 0`; Prettier clean; FID markdownlint clean; live E2E
  harness 19/19 PASS.
- Regenerated artifact deterministic (13.77 MB). Headless-Chrome probe:
  `WATERMARK_OPACITY=0.12`, `CLOSE_RIGHT=0px/TOP=0px/RADIUS=0px` for both
  close buttons, `TOOLBAR_PADDING_RIGHT=36px`, document opens.
- Grep audit: active source contains only the explicitly retained legacy env
  aliases (`env-schema.ts`, `login/constants.ts`), template LICENSE legal
  attribution, and the documented rebrand note in
  `docs/gravity-integration-starter.md`. `ECHO-single-agent.md` +
  `echo-v0.1.2-single-agent.md` deleted via `git rm`; zero references remain.

## COMPLETE — Close

FID archived; CHANGELOG entry added.
