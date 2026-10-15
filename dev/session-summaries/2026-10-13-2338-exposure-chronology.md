# Master continuation — exposure chronology (2026-10-13)

Program: `FID-2026-1012-022`; instrument repair: `FID-2026-1012-024` Loop 8.
Operator instruction: resume at automation level 3.

The proof reader accepted a receipt naming a descendant revision committed after
the receipt's exposure timestamp. A temporary-git control reproduced the gap:
the old reader returned no issues. The reader now validates the named revision's
committer date and rejects contradictory chronology. An unknown revision gets
an explicit unresolved-date issue. Existing ancestry, class/session binding,
path containment and duplicate-evidence checks remain active.

The valid descendant control stamps its exposure after that commit. No real
ledger, boundary or receipt was changed. Git dates are repository evidence;
the check does not authenticate history or prove that all failure paths ran.

Validation:

- Initial proof control: eight PASS / one FAIL before implementation.
- Initial proof/horizon run after implementation: 25 PASS / zero FAIL.
- Final 11 instrument gates PASS, including the added unknown-revision control,
  class summary, runtime result/capture suites and scripts typecheck.
- Full root typecheck, root ESLint, Markdown lint, touched-file Prettier and
  quality PASS. The FID now declares actual instrument gates and carries a
  receipt; its production class claims remain open with status `converged`.
- `bun run validate:repository`: PASS, exit 0. Live census: 589 rows / 58
  stable classes / zero issues. The real boundary manifest remains empty.

Keep the prior FID-021 count-reporting source and FID-024 timing interpretation
changes uncommitted under their existing hold. Stage only this correction and
its gate/record changes. No push, release or production repair is claimed.
