# Model picker scroll review — 2026-10-03

Operator request: review `/model` movement after the OpenAI addition.
Clarification: "it's the scroll that seems to have issues". T120 and
`FID-2026-1003-004-model-picker-scroll-geometry.md` track the correction.

Intent before implementation: enforce the picker's one-terminal-row
geometry for model and header rows, retain full model IDs in callbacks,
and prove keyboard/mouse/filter/resize behavior with native OpenTUI tests.

Native reproduction at 60×24 with long model names: one header plus 30
models rendered as 91 physical lines. Model rows were three lines tall;
after 20 Down presses the selected row was at y=47 outside a viewport
covering y=2–14. Source independently shows logical item indices assigned
as physical scroll offsets. The OpenAI integration commit changes catalog
aggregation, not picker row layout. The design converged before code edits.

Implemented fixed one-line height and no shrinking for header/model rows,
plus nonwrapping display names in `model-picker-rows.tsx`. Complete IDs and
selection callbacks retain their existing behavior. Before correction,
the mixed-provider native fixture rendered 122 rows rather than 32; the
resize test also failed its physical row-height assertions.

Native regression results: 3 pass, 0 fail, 149 assertions. Coverage includes
keyboard traversal across headers and wraparound; wheel and scrollbar
movement; rerender stability; resizing 100×24 to 40×18; filter shrink and
full-ID selection. Related viewport, provider activation, and dialog suites:
14 pass, 0 fail. The renderer is OpenTUI's actual native headless renderer;
a full interactive chat-session smoke was not performed.

Full root typecheck passed across all workspaces and scripts. ESLint
`--max-warnings 0`, Markdown lint, changed-file formatting, and quality
checks pass. Full SDK suite: 570 pass, 1 POSIX-only skip, 0 fail after an
approved retry outside the sandbox. Its initial Windows process-tree
cancellation failure was sandbox-specific. Review also corrected test
assumptions: a new `root.render` remounts content, so rerender stability
uses React state; a short scrollbox's content height can include viewport
fill, so the filtered check asserts its two physical item rows instead.

FID verification is recorded on the current final tree. No provider source
integration, commit, push, or archive was performed in this scroll correction.

All six declared gates were executed through the repository's gate runner
and exited 0. The receipt was generated with repository fingerprint/stamp
helpers and inserted using a direct patch; structural receipt validation
passed. FID status is verified and remains active pending commit authority.
The novelty-path scanner falsely matched a `.tsx` suite as `.ts` when its
prose line began "New"; the final document names the same actual `.tsx`
artifact and retains its executed gate, removing only that redundant adjective.

During provider integration final ledger validation, another active task also
used FID-2026-1003-002 for gateway reconnect replay. The scroll record was
renumbered to the unused FID-2026-1003-004; SCOPE and this summary were updated.
Its receipt fingerprint was regenerated for the metadata change using the
same six executed results and original verification timestamp. No source
behavior changed. Subsequent live provider terminal checks also confirmed
selection visibility after twenty Down presses and a 100×28 to 60×24 resize;
those results are in the provider integration summary.
