# 2026-09-28 — T96-followup probe: nested-shape reconciliation closes null

**Governance:** ECHO Protocol v0.1.2-single-agent
(`dev/echo-v0.1.2-single-agent.md`), `strict_mode: true`, session autonomy
level 3. `ECHO.md` (v0.2.0 harness protocol) is **not** this session's
governance — the `ECHO-single-agent.md` boot gate applies.

**Base commit:** `06967570` on `main`, v0.0.34. Tree carried the 13:30
session's uncommitted work (FID-2026-0928-001…005 and their surfaces); that
work was staged by that session and left untouched here.

**Intent:** run the T96-followup per-vendor live probe to unblock
`FID-2026-0927-006` (operator-selected from the register).

## What was done, in order

1. **RED.** Read all nine parser files 0-EOF (`openrouter`, `cleanapis`,
   `nous`, `apinex`, `bai`, `custom-catalog`, `kiosapi`, `nvidia`,
   `orcarouter`, `vercel`), `types.ts`, `model-info.ts`,
   FID-2026-0927-005's Open Remediation (the established probe method), and
   the registry partitions for the endpoints. Confirmed: nested reads exist
   in exactly 3 parsers; the other 7 live parsers read neither shape;
   `.env.local` carries keys by name for the auth-gated vendors (values never
   read or printed).
2. **Probe.** `dev/scratchpad/active/t96-vendor-probe.ts` (gitignored) fetched
   all eight live endpoints — every one HTTP 200. Counts: openrouter 459
   models, nous 418, apinex 34, kiosapi 36, bai 57, orcarouter 204, nvidia 81,
   vercel 389. Full table in `dev/fids/archive/FID-2026-0928-006`.
3. **Verdict: null result, no parser change.** Nested fields are populated
   only on the three vendors already mapped. The six unmapped serve nothing in
   either position; orcarouter's `architecture` object is an empty shell
   (present 182/204, every field null). Mapping would assert facts no catalog
   carries.
4. **GREEN (test surface only).** Negative contract pins added to apinex, bai,
   orcarouter, vercel, kiosapi (gateway suite) — each asserting
   `modality`/`tokenizer`/`instructType` stay `undefined` when a nested object
   is present, citing the probe date. New nvidia seam
   (`parseNvidiaModelsForTest`, last parser without one — Law 11) and new
   `openrouter-models-nvidia.test.ts` (3 legs).
5. **AUDIT/CLOSURE.** `bun run fid:verify dev/fids/FID-2026-0928-006… --write`
   → 8/8 gates exit 0, receipt stamped. Status `fixed` → `closed`; archived
   per Auto-Archive. `FID-2026-0927-006` closed on the completed precondition
   (closure addendum + measurement table) and archived. SCOPE.md register
   updated (17 → 15 open items, both completed lines removed per the
   open-items-only ruling). CHANGELOG entry written under 0.0.34. This
   summary.

## What the probe settled

- **The reconciliation is a completed verification with a null result, not an
  open fix.** Nothing further is owed on T96-followup.
- **FID-2026-0927-006 is closed.** Its ruling (no `capabilities` field) was
  final; the only reason it stayed open was the deferred probe, now done.
- **Durable enforcement:** the negative pins fail if any vendor payload would
  populate a mapped field, forcing the next shape change back through a FID.

## Honest boundaries

- The receipt on `FID-2026-0928-006` was stamped while its status was `fixed`;
  the subsequent status flip to `closed` and the archive move edit the
  document, so the stored fingerprint is stale by design (the protocol's
  documented closure behavior — the receipt records the verification that
  earned the status, not the current bytes; C3 re-verifies live at
  `validate:repository`).
- `-006`'s Resolution cites its closure commit hash as pending (G1 — the
  agent does not execute git). The operator commit completes that citation.
- `custom-catalog.ts` is operator-configured, not a fixed vendor — no
  endpoint, not probeable, correctly out of the probe's scope.
- T61, T63, T67 and the other open register items were not touched this
  session.

## Gates run this session

`bun test` on the five touched suites (31 pass) and the new nvidia suite
(3 pass); `fid:verify --write` (8/8, includes `typecheck cli` and
`quality:report`). Full battery + `validate:repository` before operator
commit, as the pre-push hook will demand.
