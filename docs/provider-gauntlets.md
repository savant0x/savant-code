# Provider gauntlets

Two operator-run checks evaluate third-party provider endpoints. Both are
advisory. Neither is a merge gate, neither is scheduled, and neither runs at
startup or during a user turn. Both spend the operator's own provider quota.

## Identity gauntlet

Checks whether a served route is what its catalog claims. Source:
`scripts/providers/identity-gauntlet.ts` and the `lib/identity-*.ts` modules.
FID: `dev/fids/archive/FID-2026-1007-008-provider-identity-gauntlet.md`.

```bash
bun run providers:identity -- --provider <id> --model <model> [--json]
bun run providers:identity -- --provider <id> --all [--deep] [--json]
bun run providers:identity -- --provider <id> --models a,b,c
```

- `--all` sweeps every checked-in catalog route for the provider with one
  handshake probe each. `--deep` runs all five vectors.
- `--models` sweeps an explicit list.
- A single route failing does not fail the provider. A route can return 500
  while a sibling route returns 200 in the same minute.
- Every run writes a dated report (`identity-report.md` and `.json`) to
  `dev/provider-identity/`. Use `--report-dir` to override.
- Key: `<SLUG>_API_KEY` or `IDENTITY_API_KEY`, read at invocation, sent in
  request headers only, never written to disk. A missing key is refused before
  any request is sent.
- A mismatch forces human review and a separate FID. It never changes routing
  automatically.

## Quality gauntlet

Runs a coding rubric against one discovery candidate. Source:
`scripts/providers/quality-gauntlet.ts` and `lib/quality-core.ts`. FID:
`dev/fids/archive/FID-2026-0915-001-free-compute-intelligence-layer.md`.

```bash
bun run providers:quality -- <host>
```

- The endpoint comes from `dev/provider-candidates/candidates.json` for that
  host.
- Key: `<SLUG>_API_KEY` or `QUALITY_API_KEY`, read at invocation, sent in
  request headers only, never written to disk or logged.
- Request timeout is 60 seconds per call.

## Tests

The offline suites are `scripts/providers/__tests__/identity-gauntlet.test.ts`,
`identity-gauntlet-invariants.test.ts`, and `quality-gauntlet.test.ts`. They
make no network calls.
