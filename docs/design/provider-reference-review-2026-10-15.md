# Provider comparison references — operator review

Authority: `dev/fids/answers.md`, 2026-10-15: "agree" to drafting a
trusted-reference table. This is a proposed control selection, not a report
of measured identity or approved spending. No network requests were made.

## Proposed table

Use the same exact requested model revision on the target and its reference.
An alias or different revision does not establish a same-model control.
Endpoint URLs and currently available model IDs must be verified at the time
of an authorized run; this table supplies no asserted live catalog values.

| Target family | Proposed same-model reference | Proposed different-model reference | Admission evidence |
| --- | --- | --- | --- |
| OpenAI models | Operator's direct OpenAI account, exact model revision | Operator's direct Google account, exact distinct model | Operator verifies endpoint ownership, exact ID and credentials |
| Anthropic models | Operator's direct Anthropic account, exact model revision | Operator's direct OpenAI account, exact distinct model | Same evidence; native transport support must be confirmed |
| Google models | Operator's direct Google account, exact model revision | Operator's direct OpenAI account, exact distinct model | Same evidence; native transport support must be confirmed |
| Open-weight models | Operator-approved reference serving the exact checkpoint and configuration | Approved different checkpoint through a separately identified route | Checkpoint provenance and serving configuration must be recorded |
| Family without an approved exact reference | None | None | Report `no-reference`; never infer identity from self-description |

These are candidates for operator selection, not an automatically trusted
provider allowlist. The existing sweep manifest uses `<provider>/<family>`
keys with `sameModel` and `differentModel` endpoint records in
`scripts/providers/lib/identity-controls.ts`. Do not put keys or tokens in it.

## Execution policy proposed for approval

- Keep paid probing disabled: this answer supplies no spending ceiling.
- Make zero live probe calls during preparation. A later live run requires
  the operator's selected providers, quota authorization and numeric call cap.
- Check endpoint terms before a scaled run. "agree" to a draft does not
  establish provider consent or authorize scaled paid probing.
- `no-reference` means no admissible reference pair was supplied.
  `inconclusive` means an admissible comparison ran without decisive evidence.
  Availability and returned-label observations remain separate from identity.
- Credential changes invalidate comparisons. Proposed source: an explicit
  operator-managed opaque epoch per target and reference provider; advancing
  an epoch invalidates earlier samples and requires new controls. Do not
  persist raw keys or secret-derived fingerprints as an epoch.

## Current implementation and review boundary

The existing loader validates `capturedAt` but does not enforce credential
epochs. Existing reports use `inconclusive` for uncontrolled rows. The new
labels and epoch enforcement above are a proposal for review, not a claim
that runtime behavior changed. No control-armed results are fabricated.

The reviewable draft is complete. Before a live comparison, supply the
approved exact references, a numeric call cap and any paid spending ceiling,
and approve the epoch source. Existing no-funding instructions still apply.
