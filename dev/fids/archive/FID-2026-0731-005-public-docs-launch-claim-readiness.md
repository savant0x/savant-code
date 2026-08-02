# FID: Public Documentation and Launch-Claim Readiness

<!-- markdownlint-disable MD013 -->

**Filename:** `FID-2026-0731-005-public-docs-launch-claim-readiness.md`
**ID:** FID-2026-0731-005
**Severity:** high
**Status:** fixed
**Launch gate:** unresolved; Savant-Code local interactive and cross-platform evidence remains. A future first-party backend for the later free product is explicitly post-launch and non-blocking for the initial Savant-Code release; no external FreeBuff hosting or partnership is assumed. Repository markdownlint is green and telemetry policy is implemented and closed under FID-2026-0731-006.
**Created:** 2026-07-31 00:00
**Author:** Buffy

<!-- markdownlint-enable MD013 -->

<!-- prettier-ignore -->

---

## Summary

Public-facing documentation contained stale and placeholder material that could
mislead first users. The root README had a demo placeholder and referenced an
undefined root `bun run build:binary` command. The landing page displayed v0.0.9
and contained a demo placeholder and `#` Discord link. Launch social drafts
contained Discord invite placeholders, and support/security contact guidance was
inconsistent. This FID reconciles claims against verified code and the fresh A–Z
report while consuming the separately verified telemetry-policy decision from
FID-2026-0731-006. The privacy document’s telemetry/analytics wording is now
backed by the closed FID-006 control-surface decision; broader promotion claims
remain qualified by the master gate.

## Environment

- **OS:** Cross-platform public documentation
- **Language/Runtime:** Markdown, static HTML, npm/Bun command documentation
- **Tool Versions:** Published `savant-code@0.0.11`
- **Commit/State:** Existing working-tree changes preserved

## Detailed Description

### Problem

A new visitor can encounter stale version numbers, commands that do not work
from the documented directory, missing demo assets, placeholder links, and
unclear support/rollback ownership. These issues reduce trust and increase
launch support load even if core code works.

### Expected Behavior

- README and landing page show the current audited version and only executable
  install/build commands.
- Every launch artifact contains verified claims or clearly labeled beta
  limitations.
- No placeholder demo, invite, or URL is presented as a real resource.
- Support, security reporting, rollback, and incident channels are consistent
  and actionable.
- Privacy/telemetry claims are limited to the implemented and verified
  FID-2026-0731-006 control surface; broader launch certification remains
  subject to the master gate.

### Root Cause

Launch artifacts were prepared around v0.0.9 and retained placeholders while the
package advanced to v0.0.11.

### Evidence

```text
Pre-change evidence:
- README.md showed v0.0.11 but contained a demo placeholder and root `bun run build:binary` reference.
- docs/launch/landing/index.html showed v0.0.9, a demo placeholder, and href="#" for Discord.
- docs/launch/twitter-thread.md and mastodon-thread.md contained Discord invite placeholders.
- docs/privacy.md was labeled v0.0.8; telemetry policy is separately tracked and excluded here.
- SECURITY.md and release docs used different support addresses.

Post-change claim table:

| Public claim/surface | Evidence or limitation | Disposition |
|---|---|---|
| v0.0.11 release identity | `VERSION`, package manifests, npm latest, FID-003 | Updated current landing/launch copy |
| Public install | `npm install -g savant-code`, release wrapper/package evidence | Retained |
| Development binary build | `cli/package.json` script `build:binary` | README now identifies `--cwd=cli` |
| Local Ollama detection/health | `packages/llm-providers/src/ollama/detect.ts`, CLI health/onboarding sources and tests | Retained with current evidence qualification |
| Permission modes/sandbox | CLI registry/args/settings and agent-runtime sandbox sources/tests | Retained |
| Demo asset | No verified GIF/video asset exists | Removed as an implied asset; marked unavailable |
| Discord community | No verified public invite/server exists | Removed placeholder; GitHub Issues is the current feedback path |
| Security/support contact | `SECURITY.md` uses `support@savant-code.com` | Release README aligned to existing address |
| Telemetry/privacy behavior | FID-2026-0731-006 is closed with runtime controls, focused tests, and workspace validation | Claims remain limited to the verified control surface; no broader promotion certification is implied |
| Cross-platform behavior | Only Windows evidence in this run | Savant-Code behavior must remain qualified/deferred; future first-party free-product backend work is outside this release gate |

```

## Impact Assessment

### Affected Components

- `README.md`
- `docs/launch/landing/index.html`
- `docs/launch/*.md`
- `cli/release/README.md`
- `SECURITY.md`
- `docs/privacy.md` version label only, if approved as documentation
  synchronization

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Create a source-of-truth claim table mapping each public statement to code,
test, package evidence, or an explicit limitation. Update only claims that are
verified by FID-003 and the release contract. Replace placeholders only with
real assets/links or honest “not yet available” wording; never fabricate a
Discord invite, demo, or deployment URL. Keep telemetry policy text unchanged
except for an approved version label correction that does not alter its meaning.

### Steps

1. Inventory all public docs and links, distinguishing current, historical, and
   draft content.
2. Reconcile install, upgrade, uninstall, build, binary, and npm commands
   against actual scripts.
3. Update current version references after FID-003 selects the authoritative
   version.
4. Replace or qualify placeholders and align support/security/incident contacts.
5. Run Markdown lint, static HTML/link checks where available, and documentation
   spot checks.
6. Re-read all changed public docs 0–EOF.

### Verification

- No current public page displays an old release version as current.
- Every documented command exists or identifies its working directory.
- No placeholder is presented as a usable resource.
- Claims about Ollama, permissions, BYOK, ECHO, and release behavior match
  verified evidence or are explicitly qualified.
- The privacy document’s telemetry/analytics policy wording is supported by the
  closed FID-006 runtime control surface; broader promotion certification
  remains outside this FID.
- Telemetry policy is not changed under this FID.

## Perfection Loop

### Loop 1

- **RED:** Found stale landing version, demo/link placeholders, root
  build-command mismatch, support-address inconsistency, and stale privacy
  version label.
- **GREEN:** Updated current version/commands, removed or qualified unavailable
  assets, aligned support guidance, added a claim table, and preserved the
  separate FID-006 telemetry-policy boundary.
- **AUDIT:** Re-read the changed public files and checked claims against FID-003
  and the now-closed FID-006 evidence. No fabricated demo, Discord invite, or
  stronger unsupported claim was introduced; launch drafts distinguish local
  Ollama from remote-provider traffic. Savant-Code local interactive and
  cross-platform limits stay qualified; a future first-party backend,
  auth/model-selection, and recurrence validation for the later free product is
  explicitly post-launch and does not block the initial Savant-Code release. No
  external FreeBuff hosting or partnership is assumed.
- **CHANGE DELTA:** Documentation-only; no runtime code or telemetry behavior
  changed.
- **Result:** `fixed` for the bounded documentation edits; the Savant-Code
  launch gate remains unresolved because local interactive and cross-platform
  evidence remain deferred. Future first-party free-product backend,
  auth/model-selection, and recurrence evidence is explicitly deferred until
  after Savant-Code gains users and is not an immediate blocker. No external
  FreeBuff hosting or partnership is assumed.

### Missed Questions

1. **Should placeholder demos be removed or replaced now?** → Remove or label
   honestly unless a real verified asset exists.
2. **Can a `#` link remain in launch copy?** → No; it is not an actionable
   public destination.
3. **Should docs claim “privacy by design” beyond verified telemetry controls?**
   → Only to the extent directly supported; broader promotion claims remain
   gated by the master.
4. **Should historical launch drafts be rewritten?** → Preserve historical
   drafts where appropriate; distinguish active copy from archival material.
5. **Which support address is authoritative?** → Confirm with the operator
   before changing public docs; do not guess.

### Code Verification Evidence

- [x] Public files and documented mismatches identified.
- [x] Telemetry behavior explicitly excluded from this FID.
- [x] Claim table completed.
- [x] Current public docs re-read after edits.
- [x] Targeted claim/version/link scans and repository markdownlint pass.
- [~] Public privacy policy wording matches the closed FID-006 control surface,
  but broader Savant-Code promotion certification remains blocked by local
  interactive/cross-platform evidence and the master gate; future first-party
  free-product backend validation is explicitly post-launch and outside this
  gate.

## Resolution

- **Fixed By:** Buffy, documentation-only launch-claim reconciliation
- **Fixed Date:** 2026-07-31
- **Fix Description:** Updated current public version and executable command
  guidance, removed/qualified unavailable demo and Discord assets, aligned
  support guidance, and reconciled privacy wording against the closed FID-006
  telemetry control surface without implying broader promotion approval.
- **Tests Added:** Documentation claim/link scans, repository markdownlint, and targeted validation.
- **Verified By:** Targeted public-claim scan, repository markdownlint,
  independent review, privacy wording reconciliation against FID-006, and
  explicit Savant-Code local/cross-platform qualification plus separation of
  the future first-party free-product backend scope
- **Commit/PR:** Working tree documentation pass (uncommitted; no commit
  authorized)
- **Archived:** Pending final master Go/No-Go and Savant-Code local/cross-platform
  evidence; future first-party free-product backend validation is a later
  post-launch track

> Status note: `fixed` records completed bounded edits only. It does not
> authorize promotion; broader launch certification remains governed by the
> master FID.

## Lessons Learned

- Placeholder content is a launch defect when users can mistake it for a real
  resource.
- Marketing copy must be treated as a tested interface: every command and link
  needs a reachable target.
- Deferred privacy decisions must constrain copy instead of being hidden by
  optimistic wording.
