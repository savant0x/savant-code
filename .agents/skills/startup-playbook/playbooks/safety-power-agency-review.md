# Safety, Power, and Agency Review Playbook

## When to use

Use this playbook for an early design review of an AI product, model application, or startup. It is an application process derived from the video's principles, not a formal governance framework demonstrated in the source.

## Prerequisites

First describe the product's capabilities, users, potential harms, controlling entities, critical dependencies, and exit mechanisms.

## Procedure

1. **Bound incident and risk claims:** Separate incident reports, speaker characterizations, speculation, and independent evidence. Do not use the video's alleged incident as a verified technical case study. `claim-apply-governance-1`
2. **Define minimum safety requirements:** Propose observable safety states that the current product must satisfy. State that these thresholds are project inferences because the source gives no operational standard. `claim-apply-governance-2`
3. **Map concentrations of power:** Identify who controls access, data, model behavior, economic returns, rules, and appeals. Evaluate the consequences of a single-entity failure or imposed values. `claim-apply-governance-3`
4. **Check user agency:** Observe whether users retain meaningful choice, control over time, exit, reversibility, and long-term fulfillment—not merely greater output or comfort. `claim-apply-governance-4`
5. **Validate jointly:** Report that the "dual constraint is temporarily satisfied" only when both the safety floor and the power/agency checks pass. Record a failure on either side as a deviation. `claim-apply-governance-5`

## Expected state

A review sheet that separates fact from inference and records the minimum safety state, concentration points, user-agency state, evidence, and unresolved deviations.

## Recovery

- If incident details are insufficient, stop technical attribution and retain only questions that still require verification.
- If a safety threshold is not observable, rewrite the abstract requirement as a state, test, or accountable owner.
- If power is highly concentrated, propose portability, decentralization, alternative providers, transparency, or appeal mechanisms as candidate adaptations, and label them as extrapolations.
- If convenience rises while agency falls, do not use output growth to offset the deviation.

## Limitations

This process does not replace safety engineering, red teaming, legal compliance, threat modeling, or an independent governance audit.
