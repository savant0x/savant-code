<!-- markdownlint-disable MD013 -->

# Nova Planning Sign-off Request — Loadable Design-System Skill Library

**Date:** 2026-08-11
**To:** Nova — independent third-party ECHO auditor
**Scope:** Planning review of `FID-2026-0811-030-loadable-design-system-skill-library.md`
**Status:** AWAITING NOVA PLANNING AUDIT
**Priority:** High

> This request contains no signature or agent-attribution fields. It follows the no-signature policy in `ECHO-single-agent.md` and `dev/echo-v0.1.2-single-agent.md`.

---

## 1. Purpose

Please independently audit the converged planning FID for completeness, internal consistency, implementation readiness, and adherence to the stated approval boundary.

The requested product is a complete, shippable, offline loadable design-system skill—not a prompt-only proof of concept. It must provide the existing approximately 2 MB catalog of 74 built-in presets, custom design-system creation and editing, selection and persistence, active grounding, theme adapters, and mechanical design-contract enforcement.

This is a planning review only. No implementation, release, commit, push, publication, deployment, or archival is authorized by this request.

---

## 2. Planning and governance state

| Gate | Current state | Evidence |
|---|---|---|
| FID creation and initial RED/GREEN | PASS | `dev/fids/FID-2026-0811-030-loadable-design-system-skill-library.md` — Loop 1 |
| Independent planning reviews and self-correction | PASS | FID Loops 2–4; corrections recorded in the FID |
| Final post-Loop-5 review | PASS | FID Loop 5; fresh independent review and document validation recorded after Loop 5 |
| Operator implementation approval | **PENDING** | No implementation approval has been supplied |
| Nova planning sign-off | **REQUESTED** | This request |
| Implementation | **NOT AUTHORIZED** | Must remain untouched pending operator approval |
| FID closure/archive | **NOT AUTHORIZED** | FID remains `analyzed` in `dev/fids/` |

Nova should not treat the FID's planning PASS as implementation evidence. Runtime claims are acceptance criteria for a future approved implementation, not completed work.

---

## 3. Product contract under review

### Built-in skill library

- Ship the `savant-design-systems` loadable skill with exactly 74 admitted baseline preset resources.
- Treat `packages/design-systems/library/` as raw staged input only.
- Generate deterministic normalized/admitted output under the skill resource boundary.
- Keep generated output as the runtime/shipped source of truth; raw input must not load directly at runtime.
- Require raw count = 74, admitted count = 74, duplicate IDs = 0, complete required roles, matching hashes, provenance, and license/notice evidence.
- Preserve source/reference names without implying official brand ownership, endorsement, or affiliation.
- Keep font names as metadata with fallbacks; bundle font binaries only with explicit redistribution evidence.
- Reject or quarantine future/custom malformed or unsafe inputs; do not silently admit them.

### Resource and skill loading

- Extend the existing skill loader and skill handler to resolve child resources safely from source, packaged, global, and project-local contexts.
- Prevent path traversal, absolute-path escape, symlink/junction/reparse-point escape, duplicate IDs, manifest mismatch, executable content, unbounded input, and unsafe declarative payloads.
- Keep the existing governance-only `savant-design` skill separate from the product library.

### Selection and CLI UX

The exact command grammar under review is:

```text
/design list
/design use <id|path>
/design current
/design create [id]
/design edit <id|path>
/design import <path>
/design validate [id|path]
/design drafts
/design resume <draft-id>
/design discard <draft-id>
/design reset
/design reset --all
```

Selection precedence is:

```text
session override > project selection > user selection > savant-cyberpunk default
```

Invalid, missing, changed-hash, unreadable, or unsafe custom systems must fail with actionable errors and must never silently fall back. `/design reset --all` requires explicit confirmation and permits recovery from an invalid higher-priority selection.

The interactive creator/editor must share one service implementation with headless mode and return structured success, cancellation, validation-error, and persistence-error results.

### Interactive creation and editing

`/design create` launches a cancellable staged wizard:

```text
identity/scope
→ targets
→ semantic palette
→ typography and fallbacks
→ spacing/radius
→ component/state guidance
→ accessibility/contrast review
→ generated contract preview
→ validation summary
→ explicit save-and-activate confirmation
```

The creator must not write until confirmation. Cancellation returns without mutation.

`/design edit` reopens a validated custom design. Built-in presets are immutable and must be cloned into the selected project/user scope before editing. Field editing and any raw-content escape use the same declarative parser, security, and validation gates.

Saved systems must:

- reload across sessions;
- verify stable ID and source/normalized hashes;
- retain provenance and revision records;
- preserve the last valid version on validation or persistence failure;
- update active selection only after validation and manifest commit succeed.

Interrupted drafts are bounded, non-active, and managed by `/design drafts`, `/design resume`, and `/design discard`. Drafts never enter the active manifest.

The supported natural-language trigger is bounded and confirmation-gated. Normative positive examples are:

- `create a custom design`
- `make my design system`
- `start a custom design`

Matching is case-insensitive, allows terminal punctuation and documented polite prefixes, and rejects ordinary design discussion. No natural-language request writes without explicit confirmation.

### Headless authoring

Headless authoring uses:

```text
--design-input <path|->
```

The path or stdin supplies versioned `DesignAuthoringInputV1` JSON containing the required identity, scope, targets, token, typography, spacing/radius, component, accessibility, and explicit `activate` fields.

Malformed JSON, unknown schema versions, missing required fields, or omitted `activate` must return a non-zero exit and machine-readable `INTERACTIVE_INPUT_REQUIRED` or `DESIGN_INPUT_INVALID`, with no partial file.

### Persistence and active-contract safety

Custom systems use immutable version files and an atomically committed manifest/pointer. The prior valid version is not overwritten before successful commit. Startup/reload reconciles orphan temporary/version files and incomplete commits using journal/commit markers.

If platform durability cannot be verified, the result must be classified as `DURABILITY_UNVERIFIED` and `NEEDS-REVIEW` rather than claiming crash durability.

The active-contract resolver is the sole owner of the in-memory normalized contract. Successful use/create/edit/reset/reload/manifest commit swaps an immutable resolved record atomically. Failed validation, persistence failure, or stale-hash detection leaves the prior record untouched. EHEL receives only the resolver's current record.

### Grounding, adapters, and enforcement

- Inject only the selected design contract and relevant target adapter into agent context.
- Treat external/reference prose as design data, never as ECHO instructions or permission policy.
- Adapt tokens into existing `ChatTheme`, Markdown, syntax/diff, and Savant-UI surfaces.
- Distinguish OpenTUI/terminal from React/CSS/web targets and produce explicit unsupported-role diagnostics.
- Scan complete final proposed visual-file content at the existing EHEL/tool-executor boundary.
- Reconstruct final content for patches; do not scan only replacement fragments.
- Fail closed or emit `DESIGN_CONTRACT_NEEDS_REVIEW` for unavailable content or parser ambiguity.
- Emit dedicated `DESIGN_CONTRACT_BLOCK` and `DESIGN_CONTRACT_NEEDS_REVIEW` receipts, never mislabeling design failures as Law 15 violations.
- Prove bounded escalation and actual SELF-CORRECT reachability.

---

## 4. Requested independent Nova audit

Please review the live FID and return a new inbox response with:

1. A verdict for each planning domain:
   - skill/resource packaging;
   - exactly-74 baseline and raw → normalized → packaged pipeline;
   - provenance/license/font policy;
   - resource/path security;
   - selection precedence and reset recovery;
   - exact CLI command grammar;
   - interactive create/edit wizard;
   - natural-language trigger and confirmation boundary;
   - headless `DesignAuthoringInputV1` transport;
   - drafts, resume, discard, and crash recovery;
   - immutable-version/manifest persistence;
   - active-contract resolver/cache ownership;
   - grounding and prompt/data boundary;
   - theme adapters;
   - EHEL enforcement and receipts;
   - packaging, testing, and release evidence.
2. Exact `path:line` evidence for every PASS, FAIL, or NEEDS-REVIEW claim.
3. Confirmation that the plan remains implementation-free and does not authorize code, commit, push, release, publication, deployment, or archival.
4. Confirmation that the no-signature/no-attribution policy is followed.
5. Identification of any remaining contradiction, missing acceptance gate, unsafe fallback, or scope overreach.
6. An overall verdict using exactly one of:
   - `PASS — planning approved for operator implementation decision`;
   - `FAIL — planning correction required`;
   - `NEEDS-REVIEW — named evidence remains outstanding`.

If a command or durability detail is considered implementation-level rather than planning-level, classify it as an acceptance-gate clarification rather than assuming it is implemented.

No source modification is requested during this audit. If a planning defect is found, identify the smallest correction and stop before expanding scope.
