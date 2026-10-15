# 2026-09-05 — Provider integrations closeout (KiosAPI, OpenCode Zen, recursive-schema fix)

Single-agent ECHO session: two new providers integrated, one shared
OpenCode credential merged, one runtime rejection root-caused and fixed.

## What shipped

- **KiosAPI** (`@savant-code` registry `kiosapi`, FID-2026-0905-002,
  status `fixed`): OpenAI-compatible gateway, `KIOSAPI_API_KEY`
  (`.env.local` + `/provider` CLI), `strip` routing, authenticated live
  catalog in the `/model` picker. Live GLM-5.3 acceptance still needs
  the operator key.
- **OpenCode Zen, full** (`opencode-zen`, FID-2026-0905-003, status
  `fixed`): 70 models across four wire formats. New `multi` protocol,
  `OPENCODE_ZEN_PROTOCOLS` map, shared `PROVIDER_PROTOCOL_MAPS` record,
  Responses branch (`@ai-sdk/openai@2.0.50`), Gemini branch
  (`@ai-sdk/google@2`, suffix-tolerance smoke-pending), public live
  catalog. Per-protocol live smoke needs the operator key.
- **Key merge** (operator-ordered): Go + Zen share `OPENCODE_API_KEY`
  via the `opencode` resolver chain (legacy `OPENCODE_GO_API_KEY`
  fallback); docs regenerated (`generate:provider-docs --check` green).
- **Recursive-schema fix** (FID-2026-0905-004, **closed + archived**
  2026-09-05): five tools emitted `$defs`-cyclic schemas that strict
  upstreams rejected on SDK-native paths. Shared cycle-cut
  (`schema-sanitize.ts`) + factory fetch middleware. Operator
  live-confirmed ("it works").

## FID archival log (Auto-Archive rule)

- `dev/fids/FID-2026-0905-004-zen-recursive-tool-schemas.md` → moved to
  `dev/fids/archive/` 2026-09-05; verified absent from `dev/fids/`.
- CHANGELOG.md `## Unreleased` entry appended (ID, severity high,
  description, resolution summary).
- Closure basis: static gates (Loop 2 AUDIT) + operator live
  confirmation; `fid:verify` receipt unstamped (pre-existing
  `model-config.test.ts` red tree, out-of-scope) — closed by explicit
  operator ship directive per Termination Criteria.
- Still open (`fixed`, key-blocked): FID-2026-0905-002 (KiosAPI live +
  GLM), FID-2026-0905-003 (Zen smoke + Gemini verdict).

## Standing issues for next session

- `common/` typecheck red in untouched `model-config.test.ts`
  (missing `bun:test` globals) — SCOPE `[OPEN-OUT-OF-SCOPE]`, needs an
  operator decision (authorize fix or leave).
- Two barrel files carry `assume-unchanged` git bits; several on-disk
  test files are untracked — pre-commit check needed at commit time
  (operator owns git).
- Nous isolation test env leak (pre-existing twin of the fixed KiosAPI
  one) — flagged out-of-scope.
- `set_messages` fails `asSchema` conversion ("Custom types cannot be
  represented") — observed during triage, different symptom, untouched.
