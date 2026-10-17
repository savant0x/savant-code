---
name: release-workflow
description: Release cycle conventions for Savant-Code pipeline releases
version: 0.3.0
metadata:
    origin: agent
---

# Release Workflow Standards (Savant-Code)

## When to Use

<!-- Load this for all projects — defines the mandatory release cycle -->

For any version bump, release, resume, or release-readiness check in
Savant-Code. Releases flow exclusively through the public-release pipeline
(`scripts/public-release.ts`; docs: `docs/public-release.md`).

## Procedure

1. **Open the version heading at bump time** — when the version bump lands
   (`bun run version:bump`), open `## <version> — <YYYY-MM-DD>` in
   `CHANGELOG.md` and write release notes directly beneath it as each change
   closes. **Never accumulate an `## Unreleased` section** — the release
   engine (`extractChangelogSection`) requires exactly one version heading
   matching the release version; Unreleased content never ships in notes.
2. **Audit phase before push** — run the gate battery and fix everything red:
   `bun run typecheck` (all workspaces), `bun run test`,
   `bun x eslint . --max-warnings 0`, `bun run lint:md`,
   `bun run validate:repository`, `bun run version:check`, plus the
   generated-doc drift checks (`generate:provider-docs:check`,
   `generate:protocol-bundle:check`).
3. **Preview** — `bun run release:public:preview` (read-only plan: identity,
   version metadata, CHANGELOG section extraction; never mutates).
4. **Diagnose** — `bun run release:public:diagnose` (read-only full gate
   manifest with evidence; investigate failures here).
5. **Release** — `SAVANT_CODE_RELEASE_AUTOMATION=1 bun run release:public`
   (automation) or interactive `bun run release:public`. The engine commits,
   tags, pushes main + tag, creates the GitHub release from the extracted
   changelog section, and publishes the scoped npm packages (default
   CLI-only; SDK opt-in via `SAVANT_CODE_RELEASE_PACKAGES`).
6. Failure mid-transaction → fix the cause, then
   `bun run release:public:resume` with the same package scope.

**Never push code without the version heading + notes in CHANGELOG.md and the
README checked against the release. Never release outside the pipeline.**

### CHANGELOG format

One reverse-chronological heading per released version — no brackets, no
Keep-a-Changelog category scaffolding, no `## Unreleased`:

    ## 0.0.30 — 2026-09-08

    ### <Area heading> (closed YYYY-MM-DD)

    - **FID-2026-0907-00X — severity — summary.** Details with file references.

Group entries by FID when applicable. Include file references in parentheses.

### Version bumping

- **Patch** (0.0.29 → 0.0.30): fixes, small improvements
- **Minor** (0.0.x → 0.1.0): new features, non-breaking changes
- **Major** (0.x → 1.0.0): breaking changes, architecture shifts

Run `bun run version:bump` — it updates `VERSION` and propagates to every
manifest (verify with `bun run version:check`). Open the matching CHANGELOG
version heading in the same change.

## Pitfalls

- Accumulating an `## Unreleased` section — the engine requires exactly one
  version heading matching the release, so it never ships.
- Bumping without opening the CHANGELOG heading in the same change.
- Running the release without the audit phase, or pushing first and auditing
  after: `release:preaudit:check` treats a dirty worktree as blocking.
- Bumping the version token and hand-editing the `> **vX.Y.Z**` release callout
  in `README.md` / `README.zh-CN.md`. Only the token is single-sourced; the
  callout body is hand-written and drifts.

## Verification

On every release, verify:

- [ ] Version references match `VERSION` (single-sourced via `version:bump`)
- [ ] Test counts and provider/feature lists match the tree
- [ ] FID references resolve (active queue + archive)
- [ ] No stale links or descriptions

Then confirm the read-only legs agree before mutating anything:
`bun run release:public:preview` and `bun run release:public:diagnose` must
both report the extracted CHANGELOG section matching the bumped version.

The repository root carries `AGENTS.md` with project-specific overrides
(release workflow, build/test commands, protocol version, conventions).
