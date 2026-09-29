# 2026-09-28 — T84-C triage, T67 guard, T61/T63 grounding, and the utility-tier duplication FID

**Governance:** ECHO Protocol v0.1.2-single-agent, `strict_mode: true`, session
autonomy level 3. `ECHO.md` is not this session's governance (boot gate).

**Base commit:** `06967570` on `main`, v0.0.34. Continuation of the T96 session
(same working tree, uncommitted work preserved).

## What was done

1. **T84-C — the triage is filed (`FID-2026-0928-007`, status `analyzed`,
   receipt 3/3).** The `36 errors across 14 files` figure was **reproduced
   exactly** with `bun x tsc --noEmit -p scripts/tsconfig.probe.json` from the
   repo root — the earlier TS5102 failures were a cwd/config-resolution
   artifact of invoking from inside `scripts/`, not a repo defect. The probe
   config (`scripts/tsconfig.probe.json`) is kept for reproducibility and is
   wired into no gate. All 36 errors categorized: class A = 8 real
   production-script defects (notably `scripts/audit-evidence.ts` writes a
   `durationMs` field its own declared type does not carry);
   class B = 8 stale `buildReceipt` calls in `fid-verify.test.ts` that still
   pass at runtime because bun does not arity-check — the suite verifies
   receipts built with `verifiedAt: undefined`; class C = 20 test-fixture
   friction errors (`typeof fetch` doubles need `as unknown as` since
   TS 5.x's `preconnect` member; loose discovery/report fixtures); class D =
   2 errors in `scripts/providers/lib/provider-stamp.ts`, which is
   **production-dead** (sole importer is its own test) and imports
   `DiscoveryStamp`, a type that no longer exists (canonical:
   `ProviderStamp`); its local `writeStamp` also hand-rolls stamp fields the
   canonical `withDiscoveryStamp` already owns (Law 13 rider). Also
   established: the covered `typecheck:scripts` include is narrower than its
   own directory — `fid-verify.test.ts` is not in it, which is why 8 type
   errors coexist with a green covered leg. Three fix shapes offered
   (Option 1 recommended: widen the standing gate); the ruling is the
   operator's. SCOPE T84-C line updated with the reproduced measurement.

2. **T67 — durable guard shipped in `AGENTS.md` (Validation section).** The
   substring-filter foot-gun was reproduced live first: `bun test
   packages/agent-runtime/src/__tests__/spawn-agents-message-history.test.ts`
   from the repo root ran **5 tests across 2 files** (the stale vendored copy
   under `resources/freebuff-main/` still exists and still fails with a
   module-resolution error), and the workspace-root workaround was confirmed
   clean (4 pass, 1 file). The guard documents the cd-to-workspace form in
   the one place agents run tests from. Register line completed and removed.

3. **T61 — grounding + decision record filed (`FID-2026-0928-008`, status
   `analyzed`, receipt 2/2).** Cloudflare is the only registered gateway that
   is fully routed (registry entry, `{ENV_VAR}` mid-path account-id
   resolution, `cf-rewrite` transform, 14-model static catalog, union
   membership — all test-pinned) yet excluded from setup by a single flag.
   The precise blocker: `deriveSetupConfig` yields `{label, envVar,
   baseUrl}` and never reads `credentials.extra`, so flipping
   `setupAvailable: true` today would onboard a token and then throw
   `{CLOUDFLARE_ACCOUNT_ID} not set` at first resolution. Three fix shapes
   (Option A recommended: widen the seam with `extraEnvVars`, then flip);
   surfacing decision is the operator's. Register line completed and removed.

4. **T63 — curated shortlist delivered; it is empty of new work.** The
   2026-09-28 harvest (214 feed records, 70 stage-0 candidates) yields
   exactly **3 measured candidates** (boundary-ok AND probed models > 0):
   `api.ollama.com` (17 models), `bazaarlink.ai` (128), `orcarouter.ai` (202,
   quality gauntlet 8/8 on 2026-09-15) — **all three are already shipped
   registry providers.** The other 68 carry feed text only (probe count 0 or
   none); per the FID-2026-0927-006 method, scaffolding from feed text would
   be the speculative-shape failure. No proposal scaffolds were generated
   because no candidate qualifies. Register line completed and removed.

5. **The idea-shelf find converted to `FID-2026-0928-009` (status
   `analyzed`, receipt 1/1).** The utility-tier duplication report's numbers
   were verified before filing: `asOptionalNumber` ×9 and
   `asOptionalString` ×8 confirmed exactly; `withTimeout` ×3 confirmed with
   the two-homes-in-common detail; `sleep` ×5 (report said 7 — form
   difference); `sha256` ×7 (report said 5); `isRecord` ×4 with **no
   canonical common export** (the report's claim that common already exports
   one is corrected — the only match is a narrower local guard in
   `axiom-only-log.ts:37`). Two substantive corrections carried: the
   canonical `isRecord` home must be created, and the nine `asOptionalNumber`
   copies are not signature-identical (`unknown`-guarding shims vs
   `openrouter.ts`'s numeric form) so consolidation must pick the general
   signature. Fix shape: five parts (custom ESLint rule on the
   `no-unknown-in-signatures.js` precedent, canonical-home registry, the
   standing pre-push eslint leg, one consolidation sweep, harvest-inheritance
   note), sequenced sweep-first so the rule enters with the tree clean.
   Implementation blocked on operator scheduling per the idea-shelf
   activation trigger; registered in SCOPE.md.

## Corrections and incidents (honest record)

- **`fid:verify` rejected my gate sections three times** (`-007`, `-008`,
  `-009`): prose inside the `## Verification Gates` section parses as
  malformed gate declarations — the FID-2026-0927-006 docstring warned the
  rule is positional, and I repeated the offence anyway. All three fixed by
  moving the note above the heading. This is the same repeat-offence pattern
  that record's author confessed; worth a skill note if it recurs.
- **Both `-007` and `-008` were initially written at `converged` with the
  operator-ruling step unchecked**, which `fid.steps.unresolved` correctly
  refused: a record whose deliverable is a pending ruling cannot claim
  `converged`. Both re-statused to `analyzed` with the ruling step in
  explicit `blocked::` form, and the required Perfection Loop sections
  (Missed Questions, Code Verification Evidence, Resolution) added.
- **SCOPE register counts were misstated twice by me** (prose said a count
  the checkboxes did not); fixed by counting the actual checkboxes (13) and
  correcting the prose to the measurement.
- **One transient red gate on `FID-2026-0927-003`** (`test
  scripts/__tests__/fid-gates.test.ts` failed the validate-time live re-run
  once, exit 1): direct re-run passed 12/12 and the next validate passed.
  The suite is spawn-heavy (~10s) with a known flake history in this repo
  (the "named 10s flake" of commit `a3d5e804`); recorded here as observed,
  not diagnosed. If it recurs, it is a FID.
- **Pre-existing hygiene violation fixed in passing:** an earlier keyless
  probe attempt had left `dev/scratchpad/probe/` at the scratchpad root,
  failing `hygiene.scratchpad-clutter`; archived per the gate's prescription
  (its `status.txt` independently corroborates the auth-gated vendor
  pattern: 401 keyless on apinex/bai/kiosapi).

## Gates run this session

`fid:verify --write` on `-007` (3/3), `-008` (2/2), `-009` (1/1);
`bun run lint:md` PASS; `bun run validate:repository` PASS (after the
record fixes above); `quality:report` PASS (via gates). Full typecheck/test
battery was green earlier in this session for the T96 work; the files
touched since are markdown-only plus the probe config (json), covered by
the gates listed here.

## Operator decisions now pending (all filed and receipt-backed)

1. **T84-C fix shape** — Option 1 (extend the standing scripts gate;
   recommended) / 2 (probe as reporting leg) / 3 (class A + D only).
2. **T61 Cloudflare surfacing shape** — Option A (dual-credential seam then
   flip; recommended) / B (env-only documentation) / C (keep absent).
3. **T63 outcome is informational** — the shortlist is empty; no ruling
   needed unless the operator wants unprobed candidates scaffolded anyway.
4. **FID-2026-0928-009 scheduling** — the idea-shelf activation triggers
   stand; the sweep is level 3 once scheduled.
