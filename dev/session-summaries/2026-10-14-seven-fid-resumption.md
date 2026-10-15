<!-- markdownlint-disable MD013 -->

# Seven-FID remediation resumption — 2026-10-14

## Intent

Resume the approved level-3 completion directive for the seven active FIDs:
re-measure the current tree, implement remaining automatable work in dependency
order, run declared gates after each coherent change, and close/archive records
only after ground-truth evidence and local commits exist. No push, release,
credential placement, or fabricated production observation is authorized.

## Dependency plan

1. FID-2026-1012-024 — taxonomy, expectedness, capture coverage and observation
   instrument; this is the dependency root for the class lanes.
2. FID-2026-1012-023 — execution reliability, then FID-2026-1012-017 — emission.
3. FID-2026-1012-021 — recurrence-to-fix machinery and current allocation.
4. FID-2026-1012-022 — master closure after every child and allocation pass.
5. FID-2026-1013-005 — public-document/provider boundary already established;
   no personal account is required.
6. FID-2026-1014-002 — active artifact census and the operator-owned Q24 archive
   history boundary.

## Initial constraints

- Preserve unrelated tracked and untracked working-tree changes.
- No scripted project-file edits; every changed file is read 0-EOF and edited
  directly.
- Production class closure requires qualified observation; deterministic green
  tests alone do not close a class lane.
- Cloudflare's public model catalog is keyless evidence; account-scoped REST
  probing remains provider-credential dependent and is not a release blocker.
- Q24 historical archive triage and any other operator-owned action remain
  blocked unless the current instruction explicitly supplies the required ruling.

## Verification contract

The declared project gates are `bun run ci`, `bun run test`, the full workspace
typecheck chain, zero-warning ESLint, Markdown lint, full Prettier check,
`validate:repository`, FID verification, scope checks, and each FID's declared
test/probe gates. Each implementation pass gets static and runtime/manual audit
evidence before the next dependency begins.

## Current pass evidence

- Baseline recurrence census: `589` records, `58` stable classes, `0` issues,
  `0` expected classes, and an empty `dev/experiences/fix-boundaries.json`.
- `FID-2026-1014-002`: active-record artifact census implemented in commit
  `1d60b9a8`; FID and scope evidence recorded in `e3ea54ef`. The focused test,
  active census, scripts-tree typecheck, FID receipt verification, scope
  register, and scope guard all pass: `7` records, `34` named paths, `0` missing.
  The Q24 historical archive triage remains blocked on its operator ruling.
- `FID-2026-1012-024`: `--assert-repaired` reports `9` unproved issues; the
  instrument and expectedness producer are implemented, but no class has
  qualified production observation.
- `FID-2026-1012-023`: `--assert-repaired` reports `5` unproved timeout or
  cancellation classes. The deterministic execution contract is implemented,
  but the post-fix observation window is not complete.
- `FID-2026-1012-017`: `--assert-repaired` reports `19` unproved incomplete-
  argument classes. Four classes have post-fix provider-side rejection rows;
  the remaining classes are unobserved rather than clean.
- `FID-2026-1013-005`: Ollama and public Cloudflare catalog evidence pass;
  account-scoped Cloudflare probing remains blocked because no Account ID or
  API token is configured.

## Closure boundary

No production repair boundary, exposure receipt, class closure, lesson, FID
archive move, or changelog entry was fabricated. The remaining class-lane
claims require qualified observation; the provider and Q24 claims require their
external/operator inputs. `validate:repository` still passes because no
unsupported repair boundary has been declared.
