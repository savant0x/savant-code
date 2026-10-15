<!-- markdownlint-disable MD013 -->

# Independent Implementation and Documentation Sign-off Request — Design-System Library

**Date:** 2026-08-11
**To:** Independent third-party ECHO auditor
**Scope:** Implemented `FID-2026-0811-030` and `docs/design/design-system-library.md`
**Status:** AWAITING INDEPENDENT REVIEW
**Priority:** High

> This request contains no signature or agent-attribution fields. It follows the
> no-signature policy in `ECHO-single-agent.md` and `dev/echo-v0.1.2-single-agent.md`.

## 1. Purpose

Please independently audit the implemented Savant design-system library and
its new extensive product/architecture documentation against the live working
tree. This is an implementation-and-documentation sign-off request, not a
planning request.

The feature is intended to be a complete offline loadable design-system
capability rather than a prompt-only skill. It includes the 74-resource catalog,
selection, custom creation and editing, import, drafts, persistence, headless
authoring, active grounding, target adapters, EHEL enforcement, and packaging
support.

The implementation and documentation were produced in the current working tree.
No commit, push, tag, release, publication, deployment, or remote mutation was
performed. Evidence must be classified as working-tree evidence, not clean-release
certification.

## 2. Files under review

Implementation and generated resources:

- `.agents/skills/savant-design-systems/SKILL.md`
- `.agents/skills/savant-design-systems/manifest.json`
- `.agents/skills/savant-design-systems/resources/`
- `packages/design-systems/src/`
- `cli/src/commands/design.ts`
- `cli/src/utils/design-system-service.ts`
- `packages/agent-runtime/src/echo/design-contract.ts`
- `cli/src/hooks/helpers/send-message-run-config.ts`
- `cli/src/utils/theme-config.ts`
- `cli/src/__tests__/release/wrapper-safety.test.ts`

Documentation and tracking:

- `docs/design/design-system-library.md`
- `README.md`
- `README.zh-CN.md`
- `CHANGELOG.md`
- `dev/fids/archive/FID-2026-0811-030-loadable-design-system-skill-library.md`
- `dev/fids/README.md`
- `dev/fids/archive/README.md`

## 3. Requested live verification

Please verify every claim against the live files and commands rather than relying
on this request. Report each domain as `PASS`, `FAIL`, or `NEEDS-REVIEW`, with
exact `path:line` evidence. A timeout, unavailable environment, or inability to
rerun a gate is `NEEDS-REVIEW`, never `PASS`.

### A. Product contract and catalog

- Confirm the `savant-design-systems` skill is distinct from the governance-only
  `savant-design` skill.
- Confirm the manifest is schema-valid and admits exactly 74 resources.
- Confirm the default is `savant-cyberpunk` and the catalog is offline/loadable.
- Confirm resource IDs, hashes, provenance, and normalized metadata are checked.
- Confirm the packaged/resource source boundary is accurately documented and the
  documentation does not claim raw input is the runtime source.

### B. User workflows

Verify the documented and implemented behavior for:

```text
/design list
/design use <id|path>
/design current
/design create
/design edit <id|path>
/design import <path>
/design validate [id|path]
/design drafts
/design resume <draft-id>
/design discard <draft-id>
/design reset
/design reset --all
```

Also verify:

- natural-language create intent is narrow and confirmation-gated;
- ordinary design discussion does not write files;
- interactive authoring validates before save;
- built-in editing clones before mutation;
- headless `--design-input <path|->` uses the shared versioned schema; and
- malformed or incomplete headless input produces a structured error without a
  partial save.

### C. Persistence and security

- Verify project/user approved roots and path containment.
- Verify canonicalization, regular-file checks, and reparse-point/symlink
  protections where the platform permits.
- Verify custom manifest/version hash checks and invalid-selection fail-closed
  behavior.
- Verify atomic temporary-write/version/manifest sequencing and preservation of
  the prior valid selection on failure.
- Verify bounded draft age/count/size and non-active draft behavior.
- Verify provenance and font claims are conservative and do not imply legal
  ownership, endorsement, or redistribution rights beyond the recorded evidence.

### D. Grounding, adapters, and EHEL

- Trace active design metadata from CLI run configuration into runtime state and
  the shared EHEL enforcement lifecycle.
- Confirm only the active contract is injected into agent context.
- Confirm reference prose remains data and cannot override ECHO, tools,
  permissions, or project policy.
- Verify target distinctions for terminal, React, and web consumers.
- Verify supported visual writes scan final proposed content, including patch
  reconstruction where applicable.
- Verify CSS/React/OpenTUI colors, typography, spacing, radius, unitless and
  camelCase OpenTUI values, and dynamic expressions are classified as intended.
- Confirm receipts use `DESIGN_CONTRACT_BLOCK` and
  `DESIGN_CONTRACT_NEEDS_REVIEW`, not an incorrect Law 15 classification.
- Confirm unavailable content fails closed or is explicit `NEEDS-REVIEW`.

### E. Packaging and verification evidence

- Verify full CLI, staging, and Savant-Free wrappers include the skill manifest
  and all 74 resources after pack/extract.
- Verify the production catalog validator is exercised against extracted
  artifacts, not only source directories.
- Re-run or inspect the focused parser, authoring, selection, draft, service,
  scanner, and wrapper tests.
- Check the recorded typecheck, Prettier, ESLint, drift, hygiene, and relevant
  repository gate evidence. Keep broad dirty-tree quality/Markdownlint results
  separate from feature-specific results.
- Confirm no clean-release certification is claimed while the working tree is
  dirty.

### F. Documentation correctness

Review `docs/design/design-system-library.md` for:

- alignment with the actual implementation and FID acceptance contract;
- complete user-facing workflows and command grammar;
- accurate selection, persistence, security, provenance, font, adapter, and
  enforcement descriptions;
- explicit scope/non-goals and working-tree evidence boundaries;
- no unsupported implementation or release claims;
- no stale build-order assumptions, duplicate feature descriptions, or
  contradictory README/changelog references; and
- no forbidden signature or agent-attribution fields under the single-agent
  policy.

## 4. Required response

Return a new inbox response with:

1. A verdict for each domain A–F and each material FAIL/NEEDS-REVIEW item.
2. Exact `path:line` evidence for every verdict.
3. Confirmation that the documentation matches the implementation or a precise
   list of corrections required.
4. Confirmation that the working-tree/release boundary is preserved.
5. Confirmation that no-signature/no-attribution policy is followed.
6. An overall verdict using exactly one of:

```text
PASS — implementation and documentation approved for closure
FAIL — implementation or documentation correction required
NEEDS-REVIEW — named evidence remains outstanding
```

If corrections are required, identify the smallest correction set and do not
expand scope without evidence.

No source modification is requested during this audit. Please place the response
in the independent-audit inbox and archive this request after responding.
