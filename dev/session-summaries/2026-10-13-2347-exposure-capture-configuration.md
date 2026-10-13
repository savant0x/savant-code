# Master continuation — exposure configuration (2026-10-13)

Program: `FID-2026-1012-022`; instrument repair: `FID-2026-1012-024` Loop 9.
Operator instruction: resume at automation level 3.

The exposure sink could report capture verified with the failure hook disabled.
The hook engine also deduplicated different builtins by their absent command
fields, allowing one action to suppress another. Real-engine controls reproduced
both defects before implementation: zero PASS / two FAIL.

The engine now confirms that the same tool matches an experience-capture action
on the failure event before allowing an exposure receipt. Direct calls default
to unconfirmed, and failure events cannot produce exposure receipts. Deduplication
keeps distinct builtin actions while retaining command/cwd duplicate suppression.
The producer explicitly documents that configuration confirmation still needs
separate persistence and class-coverage evidence.

Validation:

- Focused engine/receipt suites: 23 PASS / zero FAIL, including absent capture,
  mismatched and invalid matchers, matching capture, distinct actions, duplicate
  actions and the miswired failure event.
- Full runtime suite: 2,121 PASS / zero FAIL. Full root typecheck PASS.
- All 13 declared instrument gates PASS and the receipt is stamped. Root ESLint,
  touched-file Prettier and quality PASS. Runtime log:
  `dev/scratchpad/active/2026-10-13-exposure-config-runtime.log`.
- Markdown lint, receipt freshness and repository validation PASS, exit 0.
  Live census remains 589 rows / 58 stable classes / zero issues.

No real boundary, exposure receipt or historical capture row was written.
The instrument remains open on production class claims. Preserve all held
count-reporting changes and unrelated artifacts. No push or release was performed.
