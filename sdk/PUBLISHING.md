# SDK packaging and publication

The SDK is an unpublished workspace package. The normal public release
publishes the `savant-code` CLI only. SDK publication requires an explicit
operator decision and uses the repository's canonical release pipeline.

## Local verification

From the repository root:

```bash
bun install --frozen-lockfile
bun run build:sdk
bun run --cwd=sdk verify:skip-build
```

From `sdk/`, inspect a package without publishing:

```bash
npm pack --dry-run
```

`prepack` builds the SDK and verifies vendored ripgrep. The package includes
dual ESM/CJS bundles, declarations, WASM/query assets and native search binaries
under `dist/`, plus its manifest and documentation. The manifest's `files`
list and the dry-run output are authoritative for the exact contents.

## Explicit SDK release scope

After version parity, changelog, clean-tree and all release gates pass, the
operator may select both packages through `SAVANT_CODE_RELEASE_PACKAGES`:

```bash
SAVANT_CODE_RELEASE_PACKAGES=@savant-code/sdk,savant-code bun run release:public:preview
SAVANT_CODE_RELEASE_PACKAGES=@savant-code/sdk,savant-code bun run release:public:diagnose
```

Actual publication uses `bun run release:public` from the root with the same
scope and explicit release authority. The SDK publishes before the CLI when
both are selected. Do not use a nonexistent workspace `release` script or
publish directly around the pipeline. See [public-release.md](../docs/public-release.md)
for authentication, confirmation, receipts, recovery and post-publication checks.
