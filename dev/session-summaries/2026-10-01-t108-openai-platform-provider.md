# Session — 2026-10-01 — T108 OpenAI platform provider (FID-2026-1001-001 implementation)

## What this session was

Continuation of T108 from the approved converged FID: implement FID-2026-1001-001 —
the first-class OpenAI platform provider (`sk-` key → api.openai.com Responses
API) plus the `/provider` picker label sort. The session picked up at unverified
steps 1–2, found and repaired two verification-level defects (one in the plan's
own Loop-2 text, one pre-existing latent bug), ran the full gate battery, closed
the FID with a stamped receipt, and executed the closure ceremony on operator
authorization ("commit locally").

## Delivered

1. **Steps 1–2 verified, with a real defect caught at the seam.** The sdk
   typecheck flagged the Phase-4 call site: `resolveProtocol` returns the full
   `ProviderModelProtocol` union (`'gemini'` included) while
   `createDefaultInferenceModel`'s `options.protocol` accepts only the three
   single-protocol values. Digging further: the FID's Loop-2 text asserted
   "bare ids have no map entry, so the no-map path returns the entry protocol" —
   wrong for map-dispatched providers (tokenrouter/commandcode), whose map keys
   are FULL prefixed ids; a bare slug misses and THROWS. Fix honoring the FID's
   byte-identical promise: exported `resolveEntryProtocol(config)` (the total
   no-map resolver, narrow `'openai'|'anthropic'|'responses'` return) and gated
   the call site on `protocolMap === undefined`. `resolveProtocol` de-exported
   (no other consumer existed; test suites pin behavior via `getModelForRequest`).
   The sdk free-mode family (79 tests) confirmed behavior preservation.
2. **Step 3 — picker sort + live catalog wiring.** `buildProviderPickerEntries`
   extracted into `cli/src/commands/defs/provider-picker-entries.ts` (label sort
   within built-ins and customs segments; add-row sentinel last) and the command
   handler consumes it. `cli/src/utils/openrouter-models/openai.ts` written on
   the apinex template; wired into gateway.ts fan-out + ladder + combined list +
   test reset + roster comments, and the `openrouter-models.ts` barrel.
3. **Pre-existing latent bug fixed en route:** gateway.ts's allSettled
   destructure named `customResult`/`cleanApisResult` swapped relative to the
   promise array (behavior-neutral today because both lists land in `combined`
   regardless, but the cache-fallback ladder was miswired). Fixed while
   inserting the OpenAI leg positionally.
4. **Step 4 — docs.** `generate:provider-docs` updated tables + `.env.example`;
   the 9 flagged hand-maintained surfaces synced by hand (README command list +
   env sentence, zh-CN table + command list + env sentence, release dotenv
   template, sdk-overview prefix list + env table, installation table);
   `Adding New Providers.md` runbook addendum (template enum + suffix
   enumeration + single-protocol-`responses` rule).
5. **Step 5 — four suites, 17 tests.** Registry validation for the openai entry
   (3), SDK OpenAI lane (6: key gating with the templated message, Responses
   URL/Bearer/body, OAuth precedence, skipChatGptOAuth platform lane, bare-slug
   Responses dispatch, byte-identical non-OpenAI leg), provider setup + picker
   sort (4), live-catalog fan-out incl. failure isolation + keyless degrade (4).
6. **Gates forced two more repairs.** (a) `validate:repository`: the
   provider-audit manifest needed the `openai` `live-catalog` exception (owner +
   evidence; the `as const` literal means manifest checks, not type tests).
   (b) Quality's 300-line cap: gateway.ts hit 314 → the fulfilled/cache ladder
   extracted to `gateway-live-results.ts` with a documented positional contract
   (313→266 lines). Also: two pre-existing OAuth-fallback tests broke BY DESIGN
   (the openai entry now owns `openai/` in the registry loop) and were re-armed
   with the platform key — encoding the two-lane contract rather than weakening
   the legs.
7. **FID closure + ceremony.** Evidence/Resolution/Lessons filled, status
   `closed`, YAGNI resolved, receipt stamped via `fid:verify --write` (8/8
   gates), CHANGELOG entry, then on operator authorization: commit `f099ded8`
   (25 files, +929/−110; commit-msg guard accepted — no attribution trailers),
   FID archived with SHA references, T108 removed from SCOPE.md (register
   recount Ten open), CHANGELOG stamped with the SHA. `scope-register-check`,
   `validate:repository`, `lint:md` PASS post-ceremony.

## Frictions worth remembering

- The FID gate parser (`fid-verification-gates`) claims EVERY non-blank line in
  `## Verification Gates` — prose notes inside or directly after the list come
  back as "malformed gate declaration". Notes go ABOVE the section heading.
- `str_replace` batch with malformed JSON replacements silently applied the
  wrong subset (clobbering two type imports); caught by typecheck on the next
  gate. Verify the file after any batch that errors partway.
- `git mv` fails on untracked files — plain `mv` then stage.
- `PROVIDER_REGISTRY` entries are `as const` literals: `('protocolMap' in x)`
  not `.protocolMap === undefined` in tests; the audit manifest needs real
  file paths for owner/evidence.
- Provider-doc sync flags 9 hand surfaces (the generator prints them); run
  `generate:provider-docs:check` after touching any of them.
- `write_file` dropped its `instructions` param again (recurring; retry with it
  present).

## State at end of session

- `main` at `f099ded8` + closure commit; T108 fully closed; working tree clean
  after the ceremony. Local only — no remote push (G2).
- `dev/fids/` active queue: empty. FID-2026-1001-001 archived.
- Register: Ten open, zero checked.
- Outstanding operator item: the live keyed probe (`/v1/models` +
  `/v1/responses`) — declared in the FID's Reproducibility note as
  operator-run at verification.
