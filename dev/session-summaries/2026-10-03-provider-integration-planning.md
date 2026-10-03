# Provider integration planning — 2026-10-03

The operator requested a FID after reading the entire single-agent ECHO
protocol, provider runbook, and root conversation export (`old-chat.txt`).
Create the plan for CodeCraft API and xKiro, include CleanAPIs, prepare
missing dummy key entries, and follow the runbook's integration recipe.

Created `FID-2026-1003-001-codecraft-xkiro-cleanapis-providers.md`, status
`analyzed`, and registered T119 in `SCOPE.md`. Retained the previous
live-catalog choice, xKiro multi-protocol map, and `/provider` setup
requirement. CleanAPIs already has a registry entry and catalog wrapper;
the plan revalidates that integration and tracks the mismatch between
current documented price/capability fields and its existing parser.

Added missing empty `CODECRAFT_API_KEY=` and `XKIRO_API_KEY=` entries in
`.env.local`; the existing `CLEANAPIS_API_KEY` entry was preserved. Provider
implementation remains planned in the FID, including the unresolved xKiro
live-catalog protocol-map coverage decision. No credentials are reproduced
in these records.

Fresh keyless catalog probes: CodeCraft 401 `missing_api_key`; xKiro 200
with 129 chat rows; CleanAPIs 401 `missing_api_key`. Official model/API
documentation was checked. Authenticated catalogs and inference have not
been tested in this planning task. No source implementation, commit, push,
or archival occurred.

The operator clarified that the scope contains three or possibly four
providers. Three services are confirmed in the FID: CodeCraft API, xKiro,
and CleanAPIs. Rechecking every user message in `old-chat.txt` found only
the first two names; the fourth name or URL is awaiting clarification.

Validation: `bun run lint:md` exited 0; scope completeness and disposition
checks each reported PASS with zero issues; `validateActiveFidLedger`
returned `[]` and exited 0. Comparison of `.env.local` before and after the
insertion confirmed every original line and existing credential unchanged
(ignoring the final newline), exactly one occurrence of each of the three
requested variables, and empty values for the two added entries.

Review corrected a draft gate to the canonical `packages/agent-runtime`
workspace and replaced a module-only probe with the runnable provider-doc
drift test. Implementation gates remain planned and unstamped.

The actual gate parser rejected explanatory prose inside the gate section.
Moved that prose into Verification, leaving only bare declarations under
Verification Gates. Final validation exited 0: 17 parsed, allowlisted gates;
zero ledger issues, parse errors, or unsafe gates; scope-register and
scope-guard each PASS with zero issues; Markdown lint exited 0.

## Operator-supplied keys and catalog downloads — 00:53 local

The operator filled the missing keys and requested endpoint pings and live
model lists. Downloaded the full JSON responses directly from each provider
using its own credential, supplied to curl through stdin rather than argv.
Initial sandbox attempts failed with Windows TLS `SEC_E_NO_CREDENTIALS`;
the approved retries succeeded: CodeCraft 200, 33 models, 29,672 bytes;
xKiro 200, 129 models, 52,698 bytes; CleanAPIs 200, 33 models, 29,573 bytes.

Raw JSON, SHA-256 hashes, and every model ID are available in
`dev/scratchpad/active/provider-catalogs-2026-10-03/README.md` and its sibling
JSON files. Parsed counts match unique IDs, and a credential check confirmed
none of the three supplied keys appears in the snapshots. xKiro's catalog
is public, so that endpoint does not prove key validity or tier entitlement.
No inference calls were made.

Authenticated evidence corrects the earlier documentation-only price
concern: CodeCraft/CleanAPIs both carry old per-token price strings and new
per-1,000-token fields; all alias pairs agree. Existing CleanAPIs pricing
mapping therefore remains supported. Their 33 IDs match; context limits
are present, separate output caps are null, capabilities are string arrays,
and creation times are numeric. xKiro has 55 free, 63 paid, 11 premium rows;
all 129 include context/output limits. Updated the analyzed FID and T119
with these findings. Source integration remains tracked, unimplemented work.
