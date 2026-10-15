# 2026-09-05 — Provider FID closures (KiosAPI + OpenCode Zen live-confirmed)

Single-agent ECHO session: the operator live-tested both new providers
("kiosapi works", "zen works as well. both confirmed working via live
test"), discharging the last key-gated boundaries. Both FIDs closed and
archived per the Auto-Archive rule.

## Closure evidence

- **Ground truth (grep, Law 4):** `kiosapi` registry entry
  (`common/src/providers/registry.ts:190-205`), `opencode-zen` entry
  (`:210-229`), 70-entry zen map (`provider-protocols.ts`, grep count 70),
  both fetchers on disk (`cli/src/utils/openrouter-models/kiosapi.ts`,
  `opencode-zen.ts`), `responses`/`gemini` factory branches live
  (`sdk/src/impl/model-provider/model-factories.ts:91-100`).
- **Fresh gate re-runs (Double Audit Method 1):** common provider suites
  24 pass / 0 fail (244 expects); CLI gateway suite 16 pass / 0 fail
  (42 expects); SDK free-mode 4 pass / 0 fail + zen routing 10 pass / 0
  fail (20 expects).
- **Live verification (the acceptance authority):** operator live tests
  2026-09-05 — KiosAPI authed catalog + chat round-trip; Zen per-protocol
  paths incl. Gemini tolerance verdict.

## FID archival log (Auto-Archive rule)

- `dev/fids/FID-2026-0905-002-kiosapi-provider.md` → status `closed`
  (Loop 3 + Resolution + Lessons written), moved to `dev/fids/archive/`.
- `dev/fids/FID-2026-0905-003-opencode-zen-provider.md` → same treatment.
- CHANGELOG.md `## Unreleased` entries appended for both.
- `dev/fids/archive/README.md` + `dev/fids/README.md` ledger entries added.
- SCOPE.md Tasks 8 (K8) and 9 (Z9) marked complete.

## State after this session

- **Active FID queue:** `-0903-001` (desktop packaging, next release cut)
  + `-0905-001` (native.ts decomposition, `created`, Perfection Loop
  pending).
- No key-blocked work remains on the provider track.

## Standing issues (unchanged, carried)

- `common/` typecheck red in untouched `model-config.test.ts` —
  `[OPEN-OUT-OF-SCOPE]`, operator decision pending (also why `fid:verify`
  receipts show 5 PASS / 1 FAIL).
- `assume-unchanged` bits on two barrel files (`model-config/providers.ts`,
  `model-config.ts`) + several untracked test files — pre-commit check
  needed; operator owns git (G1).
- Working tree remains uncommitted (771 changed paths incl. 477 untracked).
