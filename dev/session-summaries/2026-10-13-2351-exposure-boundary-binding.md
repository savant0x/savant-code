# Master continuation — exposure boundary binding (2026-10-13)

Program: `FID-2026-1012-022`; instrument repair: `FID-2026-1012-024` Loop 10.
Operator instruction: resume at automation level 3.

Receipts previously identified class/session only. A renewed repair boundary
could not earn a separate receipt in that session, and the proof reader could
reuse evidence issued under another boundary. Both defects were reproduced:
the writer retained one file instead of three; the reader returned no issues
for a receipt naming a different boundary.

The common experience module now owns the receipt schema, consumed by the
runtime producer and scripts reader. Receipt contents and filename identity
include the boundary commit and timestamp. The reader requires exact agreement;
the writer ignores invalid or future timestamps. Earlier files remain immutable,
and older unbound receipts cannot qualify a current repair.

Validation:

- Producer/engine suites: 15 PASS / zero FAIL. Proof/horizon suites: 29 PASS
  / zero FAIL, including mismatched commits, timestamp-only changes, legacy
  unbound receipts, future boundaries and repeat immutability.
- Full runtime: 2,123 PASS / zero FAIL. Full root typecheck PASS.
- All 13 instrument gates PASS with a refreshed receipt. Root ESLint,
  touched-file Prettier and quality PASS. Runtime log:
  `dev/scratchpad/active/2026-10-13-exposure-boundary-runtime.log`.
- A prior fixture revision was 41 characters long and produced no receipt;
  corrected it to a valid hash before reproducing the renewal defect.
- Markdown lint, receipt freshness and repository validation PASS, exit 0.
  Live census remains 589 rows / 58 stable classes / zero issues; the real
  boundary manifest remains empty.

No real boundary, exposure receipt or historical capture row was changed.
Production observation remains open. Preserve held count-reporting work and
unrelated artifacts. No push or release was performed.
