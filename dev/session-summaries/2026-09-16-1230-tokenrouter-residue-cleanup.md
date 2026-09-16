# Session Summary — 2026-09-16 1230 — tokenrouter dead-id residue cleanup

**Operator directive (Task 56):** "Clean up the inert glm-5.3-free residue
in the two tokenrouter cli maps."

## 1. Ground truth — the residue was in three maps, not two

- `cli/src/utils/openrouter-models/static-catalogs.ts`
  - `TOKENROUTER_NAMES` — dead `'tokenrouter/z-ai/glm-5.3-free'` entry
    removed.
  - `TOKENROUTER_MAX_OUTPUT` — the dead pin entry removed; map renamed to
    `PINNED_MAX_OUTPUT_TOKENS` (intentionally empty, documented) with a
    `PinnedMaxOutputTokens` type export. The pin mechanism stays wired for
    the next wrong-catalog cap (FID-2026-0909-008 Step 4 mandate).
- `common/src/constants/model-config/providers.ts` — a THIRD stale map
  discovered during the sweep: common's own `TOKENROUTER_NAMES` export,
  whose sole content was the dead id and which had zero live-code
  consumers (vestige of the FID-2026-0809-001 cli→common catalog
  migration). Removed along with its re-export in
  `common/src/constants/model-config.ts`.

## 2. Mechanism preservation (Law 13)

`resolveMaxOutputTokensForModel(modelId)` gains an optional injectable
`pinnedMaxOutput` param (default = the production map). Zero behavior
change for the three production callers (`send-message-run-config.ts`,
`default-run-prompt.ts`, the cli barrel). DI for the pin, per repo
convention — which also let the pin test get stronger:

- Old test: resolved the dead id through the dead pin (passed because the
  id was absent from all catalogs — never proved pin > live-catalog).
- New test: injects a pin for an id the live catalog DOES report and
  proves the priority-1 leg wins; then asserts the production map is
  empty and the live-catalog fallback answers (seeded mock; hermetic via
  the family lifecycle).

## 3. Gates

- typecheck ×4 exit 0 (common, cli, sdk, agent-runtime).
- openrouter-models test family: 69 pass / 916 expect / 0 fail (8 files).
- max-output suite 7/0; common model-config 13/0.
- eslint `--max-warnings 0` on touched files (import-order fix applied);
  prettier clean; static-catalogs.ts 298/300 (cap respected).

## 4. [OPEN-OUT-OF-SCOPE] recorded (SCOPE Task 56)

`bun run quality:report` FAILs on a pre-existing violation NOT caused by
this task: `scripts/providers/lib/probe-endpoint.ts` measures 305 lines
(ceiling 300). Last modified by FID-2026-0916-001's implementation
(`7d1446d0`), whose declared gates did not include quality:report; the
last recorded quality PASS (FID-2026-0915-002) predates that growth.
Proposed fix: split along the static-checks/runner seam
(FID-2026-0913-002 discipline) — on operator approval.
