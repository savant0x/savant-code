# Session Summary — 2026-09-16 1700 — quality gate added to the FID closure battery (Task 58)

**Operator directive:** "Add quality:report to the standard closure gate
battery so ceiling breaches can't recur."

## 1. The mechanism change

A first-class `quality` gate kind now exists in the FID-2026-0823-009
verification contract, and it is **mandatory for `fixed`/`verified`** —
a closure that omits it is rejected at every enforcement point:

- **Pure contract** (`packages/agent-runtime/src/echo/fid-verification-gates.ts`):
  kind union + `GATE_LINE`/`RESULT_LINE` grammars admit a no-arg
  `- gate: quality` (receipt line `- quality: exit 0`);
  `validateFidVerification` errors with `quality gate not declared` when
  a fixed/verified FID omits it. Because the EHEL pre-write tripwire
  (`pre-write-gates-fid.ts:105`) and the `validate:repository` C1+C2 scan
  both call this validator, the mandate binds at write-time AND at the
  repo gate — a fixed-flip without the gate is impossible to land.
- **Executor** (`scripts/fid-verify.ts`): `resolveGate('quality', '')` →
  allowlisted `bun run quality:report`; an argument is rejected
  (repo-wide, singular). C3 live re-run + cross-FID dedup in
  `fid-gates.ts` work through it generically.
- **Template** (`templates/FID-TEMPLATE.md`): gate documented as
  mandatory in the blockquote + the example declares it and stamps its
  receipt line.

## 2. Ceiling discipline — the task split its own targets first

Both edit targets sat at the 296/299-line edge of the 300 ceiling, so the
additions required two verbatim-move sub-splits (FID-2026-0913-002
discipline, zero behavior change):

- `fid-verification-gates-locators.ts` (73 lines) — the fence/section/
  receipt-span locators out of the contract module (now 271).
- `fid-receipt-stamp.ts` (48 lines) — `findHeadingLine`/`stampReceipt`
  out of the executor (now 286; `stampReceipt` facade re-exported from
  `fid-verify.ts` so the import surface is unchanged).

## 3. RED-first + the pin that caught a real defect

- RED observed: contract 19 pass / 5 fail, executor 21 pass / 2 fail —
  all new pins, zero pre-existing breakage.
- The C3 fixture legs then caught a genuine defect in my GREEN draft:
  `fid-gates.ts` built C3 labels as `` `${kind} ${arg}` `` while
  `resolveGate` emitted `quality` bare — the lookup key `\"quality \"`
  never matched `\"quality\"` and the live re-run reported `exit no-run`.
  Fixed with one shared `gateLabel(kind, arg)` helper (Law 13) used by
  both modules.

## 4. Gates

- 4-suite battery: **60 pass / 0 fail** (95 expect) — fid-gates,
  fid-verify, fid-verification-gates, pre-write-gates-receipt-tripwire;
  the C3 legs LIVE-run `quality:report` through the real spawn path.
- typecheck ×4 (common, cli, sdk, agent-runtime) exit 0;
  `quality:report` PASS (1498 files); eslint `--max-warnings 0` on all
  touched files; prettier + lint:md clean.
- LIVE end-to-end, both legs (throwaway fixtures, destroyed after):
  - Positive: a `fixed` FID declaring `- gate: quality` stamped via the
    real `fid:verify --write` — `[PASS] quality (exit 0)` in the
    receipt; repo-wide `--check` PASS.
  - Negative: a fully-stamped `fixed` FID omitting the gate fails
    `fid:verify --check` (exit 1) with exactly
    `quality gate not declared — add `- gate: quality``.
- Observed edge (pre-existing, benign, fail-closed): stamping a document
  whose `## Verification Gates` section runs to EOF leaves the hashed
  view one newline apart from the stamped view → the receipt reads
  stale. Never occurs on template-shaped FIDs (a `## ` section always
  follows); recorded here, not silently absorbed.

## 5. Effect

Every future FID closure must declare and pass `bun run quality:report`
— the probe-endpoint.ts class of ceiling breach (implemented FID-2026-0916-001
growth that never met the quality gate) cannot recur silently.

## Erratum — pre-push hook context

Commit landed as `d9719817`, amended (unpushed) to `108458dd` after the
pre-push drift guard correctly caught the stale embedded protocol bundle
(the generated bundle embeds templates/FID-TEMPLATE.md; regenerated and
amended — one atomic change with its bundle regen, the FID-2026-0910-002
convention). The first push attempt after the amend failed at the hook's
test gate; the immediate re-run with ZERO changes passed every gate
(scan, eslint, markdownlint, bundle check, fid:verify --check,
evals:smoke, typecheck ×12, 421/0 test chain, prettier) and landed. The
failure is un-reproduced — consistent with the known
passes-standalone-fails-under-hook-load class (the hook spawns the full
typecheck ×12 immediately before the test chain). Recorded for
recurrence tracking per the experience-capture ≥3× rule; no code change.
