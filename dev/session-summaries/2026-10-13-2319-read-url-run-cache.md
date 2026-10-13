# Master continuation — isolated URL memos (2026-10-13)

Program: `FID-2026-1012-022`; repair: `FID-2026-1012-018` Loop 4.
Operator instruction: resume at automation level 3.

The former negative cache was process-wide. Production code never reset it,
so one SDK run's 404 could prevent another run from fetching a recovered URL.
Each runtime assembly now owns its bounded cache and supplies it through the
existing dispatcher. Direct readers have independent state unless given a cache.
Children sharing a runtime callback reuse its memo. A fresh invocation, including
resume, starts fresh without clearing another invocation's memo.

Two controls failed before implementation and pass after it. The dispatcher
control verifies a repeat in one run, a fresh success in another runtime, and
a late repeat in the first runtime. The direct-reader control verifies recovery
on an independent call. No network request escaped the fetch spy/fixtures.

Validation evidence:

- Four URL suites: 37 PASS / zero FAIL. Full SDK: 693 PASS / one platform SKIP
  / zero FAIL. Full root typecheck PASS; root ESLint PASS.
- All seven expanded FID gates PASS and the receipt is stamped. Manual re-read
  confirms production wiring, override precedence and unchanged SSRF validation.
- Markdown lint, touched-file Prettier, quality and receipt freshness PASS.
  `bun run validate:repository` reports PASS.
- The first typecheck found the test fetch stub lacked Bun's `preconnect` member;
  the typed fixture now preserves it. The subsequent full typecheck passed.
- Logs: `dev/scratchpad/active/2026-10-13-read-url-*.log`.
- Live recurrence census: 589 rows / 58 stable classes / zero issues. All eleven
  fetch classes remain unresolved. No historical rows, boundaries or exposure
  receipts were edited, and no production repair assertion was made.

The count-reporting work remains uncommitted under FID-021's recorded hold.
Unrelated provider, wiki, idea-shelf and capture artifacts remain intact.
No push or release is authorized by this continuation.
