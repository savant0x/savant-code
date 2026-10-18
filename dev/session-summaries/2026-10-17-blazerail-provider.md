# BlazeRail provider integration

Read `docs/adding-a-provider.md` in full. Operator requests a built-in BlazeRail
provider and explicitly excludes API-key probes and live inference. Scope and
converged plan: FID-2026-1017-013. Use the current BearerAuth contract, public
catalog metadata and existing registry/generic-factory seams. No key material
was accessed. Initial public catalog: HTTP 200, 302 rows including media.

The public keyless catalog census returned HTTP 200: 302 raw rows, 183 retained
chat/coding models, 179 with positive published context windows, four unknown,
and 30 `:free` variants. No API key was read or sent; no inference was attempted.

Verification passed: all 9 FID gates, full repository typecheck, full repository
test chain, ESLint (zero warnings), Markdown lint, Prettier, repository validation,
provider-doc drift and the quality report. Focused SDK behavior was tested with
a mock fetch, including Bearer headers, exact upstream model IDs and missing-key
failure. Authentication and inference remain unverified by operator instruction.

Implementation commit and closure commit evidence will be added after committing.
