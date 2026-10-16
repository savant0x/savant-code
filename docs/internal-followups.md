# Internal follow-ups

Implementation FIDs close after code verification, move into the local archive,
and enter CHANGELOG.md. Track production observation and live comparisons
separately in the local `dev/tracking/internal-followups.json` store. The ignored
`dev/` directory remains local; a fresh clone does not require this store.

Create the directory and store when follow-up work exists. This complete example
tracks a comparison without requiring any historical FID or experience ledger:

```json
{
  "version": 1,
  "followups": [
    {
      "id": "LIVE-001",
      "kind": "live-comparison",
      "status": "open",
      "owner": "Operator",
      "summary": "Measure provider comparisons independently of implementation closure.",
      "nextAction": "Select references and numeric call/spending limits before a paid run.",
      "evidence": ["docs/provider-gauntlets.md"],
      "completionEvidence": [],
      "sourceFids": []
    }
  ]
}
```

Run `bun scripts/internal-followup-check.ts` after changes. The same check runs
in `bun run validate:repository`. Run `bun run session-end:review` to refresh
the agenda and print all open follow-ups with owners and next actions.

Retain completed records with `status: "completed"` and existing repository
paths in `completionEvidence`. Evidence paths must resolve inside the workspace.
Link actual historical FIDs in `sourceFids` when available; an empty array is
valid for a new comparison. Paid runs need their own authorization and limits.

Observation entries use `kind: "observation"`, an `OBS-NNN` identifier and
`classes` instead of `sourceFids`. Each class entry names its exact `classKey`,
`implementationFid` and `predecessorFid`. Ownership must match the local
`dev/experiences/class-owners.json`, the implementation FID must contain verified
implementation evidence, and predecessor transfers must match its provenance.

Recording an observation never certifies repair. Declare honest fix boundaries
and capture evidence in the existing experience system, collect real exposure,
and run `bun scripts/experiences-recurrence.ts --assert-repaired=FID-YYYY-MMDD-NNN`.
Completing an observation requires the existing proof checks and at least
14 days and three qualified sessions. New recurrence remains a failure requiring
investigation; new implementation defects receive their own FID.
