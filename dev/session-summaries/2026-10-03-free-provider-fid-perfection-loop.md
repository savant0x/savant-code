# Free-provider correction FID — Perfection Loop

## Intent and authority

The operator requested one FID covering all findings, the most robust solutions,
the full Perfection Loop on that FID, and presentation. Expand existing
FID-2026-1003-006; retain the verified picker correction in FID-2026-1003-005.
This session produces the converged plan and its evidence, without implementing
the new routing or notification contracts. Single-agent ECHO, strict mode,
automation level 3. Read source, use direct file edits, and preserve unrelated
working-tree changes.

## Initial review

The SDK selects registry prefixes before the active route; all three prompt
entry points forward only a model string. Runtime child inheritance carries
the model and provider options but no serving-provider identity. CLI picker
selection persists provider and model through separate calls. Catalog attribution
uses only the built-in registry and primary key names. Bootstrap delivery
depends on an empty chat and consumes its attempt before a cancelable timer.
Desktop events already have a validated, sequenced replay transport suitable
for provider notices. Quota readings currently are strings with two credential
headers; proactive thresholds need a declared numeric schema and auth policy.

The initial audit is preserved in
`2026-10-03-free-provider-notification-audit.md`. Baseline test results there
verify existing behavior, not the proposed fixes. The expanded FID was
rebaselined for this newly authorized plan; subsequent loop changes were
measured and audited against that baseline.

## Loop results and exact change measurements

The expanded baseline contains 29,771 characters. Read-only measurements use
LF-normalized text and a line-LCS alignment; changed characters are the sum of
inserted and deleted line lengths (including newlines), divided by the previous
FID length. This is an explicit text-edit metric, not an estimated percentage
or a claim of minimum character-level Levenshtein distance. History, metadata
and resolution changes are included. Each edit was reread from disk before
measurement; none of the measurement scripts writes project files.

| Pass | Previous characters | Result characters | Changed characters | Delta | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 | 29,771 | 31,837 | 2,224 | 7.4704% | Correct explicit migration, configuration/account revisions, episode recurrence and client negotiation |
| 2 | 31,837 | 33,579 | 1,742 | 5.4716% | Correct helper model/route replacement and cover all runtime producers |
| 3 | 33,579 | 34,058 | 479 | 1.4265% | Stable audit; history only |
| 4 | 34,058 | 34,695 | 637 | 1.8703% | Clarify complete-snapshot validation and model expiry dates |
| 5 | 34,695 | 34,984 | 645 | 1.8591% | Final reverse audit; converged metadata and resolution |

All correction passes are below 10%. Passes 4 and 5 are consecutively below
2%; the final reverse audit found no further actionable design correction.
The plan completes RED → GREEN → AUDIT → SELF-CORRECT → re-AUDIT → COMPLETE.
Status is `converged`, not implementation-verified or closed. The initial scope
expansion precedes this baseline and is not disguised as a capped correction.

## Double-audit evidence

Static source reads and production greps trace CLI selection, common contracts,
runtime inheritance and every SDK prompt mode. The follow-up caller grep found
runtime stream/n-response, file-selection, semantic-summary and Gemini fallback
producers, including parameter spreads that replace only the model. The FID now
names these consumers and requires route/budget changes together. Fourteen
specified production insertion paths exist in the current tree.

Independent, read-only Bun probes reproduce the existing defects:

```text
Selected: openrouter / openai/gpt-5
Constructed: openai.responses / gpt-5
Network calls: 0

Three down harvests over 120,000 ms:
classification: lapsed
activeHostRetained: false

Changed model count at same host/classification:
semanticModelChangeSameKey: true
```

Fresh baseline tests, run from their workspace roots:

```text
cli: free-options, provider-quota, settings-provider, fallback-hints
38 pass / 0 fail / 82 assertions / 4 files

scripts: diff-state, discovery-seams, custats-harvest
46 pass / 0 fail / 97 assertions / 3 files
```

These 84 passing tests verify current seams. They do not prove the unimplemented
corrections. The original audit also records the earlier full SDK/typecheck and
picker verification; those results are not relabeled as new implementation
verification for this FID.

The repository gate parser accepts 23 declarations. All 17 promised test paths
are declared; existing paths resolve through the actual gate executor without
errors. Ten suites already exist and seven are prospective. No verification
receipt is stamped, and prospective gates are not run against missing files.
Formatting, repository Markdown lint and scope-register checks pass. The
picker's provider-scoped row key and the existing FID-005 receipt were inspected;
its verified local correction is retained as a dependency.

## Delivered contract and boundaries

The FID selects additive explicit serving identity, canonical provider aliases
and capability labels, profile-local durable notification state, shared CLI and
desktop delivery, semantic episodes, elapsed-time health, eligible alternatives,
declared quota monitoring and dated offer/model expiry. The hosted fallback
adapter explains its outcome while preserving admission policy and the standing
operator-owned feature disposition.

Only the FID, this planning record and the T127 scope entry changed in this
planning turn. Implementation remains pending the presented plan. No commit,
archival, deployed behavior, live provider entitlement or full repository test
pass is claimed; known hosted e2e failures remain recorded under T122.
