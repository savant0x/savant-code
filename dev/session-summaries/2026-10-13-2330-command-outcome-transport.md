# Master continuation — command outcome transport (2026-10-13)

Program: `FID-2026-1012-022`; repair: `FID-2026-1012-023` Loop 5.
Operator instruction: resume work at automation level 3.

The SDK dispatcher discarded the terminal runner's structured timeout identity
when converting its exception to a result. Its pre-aborted branch also returned
a success-shaped message. Both terminal error paths omitted the command field
required by the public output schema.

The dispatcher now carries allowlisted execution metadata alongside the error,
retains the terminal command field, and reports pre-start cancellation through
the error channel. It skips execution on cancellation, preserves pause errors,
and never replays commands. Invalid metadata and unrelated exception fields
are omitted; no expectedness label is inferred from a timeout.

Verification evidence:

- Two dispatch controls fail against the prior envelopes and pass after repair.
  A third proves malformed host metadata and unrelated exception fields are
  excluded. The command contract suite passes all 11 tests.
- Full SDK: 696 PASS / one POSIX-only SKIP / zero FAIL. Full root typecheck PASS.
- Manual review confirms runtime result inspection consumes the same fields
  from the SDK result that the capture hook validates. Existing lifecycle and
  capture pins are included in the FID's complete declared gate battery.
- Initial static checks found an optional-field JSON typing issue and import
  ordering warning. The result now uses the existing JSON validator after
  filtering undefined metadata fields; imports follow the repository order.
- Final FID gate run: all 11 PASS, receipt stamped and freshness check PASS.
  Root ESLint, Markdown lint, touched-file Prettier and quality PASS.
- Live recurrence census remains 589 rows / 58 stable classes / zero issues.

No historical capture row, repair boundary or exposure receipt was written.
Production repair remains unproved. The FID-021 count-reporting hold and all
unrelated working-tree artifacts are preserved. Nothing was pushed or released.
