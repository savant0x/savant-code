# FID-2026-0817-003 — Linux-arm64 release binary missing (OpenTUI 0.5.3 native-bundle variant) (closed)

**Severity:** high (release-blocking, found during v0.0.25 publish)
**Status:** closed
**Created:** 2026-08-17
**Closed + archived:** 2026-08-17

## Background

The v0.0.25 public release (run 2026-08-17) published npm `savant-code@0.0.25`
and created the GitHub release, but the `Build and Publish Release Binaries`
workflow's `linux-arm64` job failed at the compile step:

```
error: Could not resolve: "@opentui/core-linux-arm64-musl". Maybe you need to
"bun install"?
```

The release therefore carried 4 of 5 binary tarballs, and the release
script's fail-closed post-release asset verification
(`verifyReleaseAssets`, `scripts/public-release.ts:2214`) held the pipeline
in its retry window — the transaction could not finalize until all five
binaries existed.

## Root cause

OpenTUI 0.5.3 split its native bundles into per-platform optional
dependencies (glibc `@opentui/core-linux-{arch}` and musl
`@opentui/core-linux-{arch}-musl`). `ensureOpenTuiNativeBundle` in
`cli/scripts/build-binary.ts` fetched only the unsuffixed (glibc) bundle for
every linux target from the host install. Bun's cross-target libc selection
is host-dependent:

- on the ubuntu (glibc) CI runner, `--target=bun-linux-arm64` resolves the
  **musl** bundle → `Could not resolve: "@opentui/core-linux-arm64-musl"`;
- on a Windows host, the same target resolves the **glibc** bundle.

Installing only one variant fails on the other host. The x64 builds were
unaffected because bun-linux-x64 defaults to glibc, which `bun install`
provides on the ubuntu runner.

Two latent defects in the same function were also fixed:

1. a half-extracted/stub package directory was treated as "installed"
   (`existsSync`), so a failed fetch left an empty dir that permanently
   skipped re-fetching;
2. on Git Bash for Windows, `tar -xzf C:/...` parsed the drive-letter path as
   a remote host (`Cannot connect to C: resolve failed`).

## Fix (cli/scripts/build-binary.ts)

- New exported `getOpenTuiNativePackageNames(targetInfo)` — every **linux**
  target installs **both** the glibc and musl bundles of its arch; darwin/
  win32 targets install their single variant. Whichever bundle Bun resolves,
  it is present.
- `ensureOpenTuiNativeBundle` now loops per variant, treats empty/stub
  directories as missing (re-fetches and cleans them), and passes
  `--force-local` to `tar` so Git Bash on Windows stops parsing `C:/` paths
  as remote hosts. Extraction sanity: the install is refused if no
  `package.json` emerges.
- 7 unit tests pin the variant mapping against the declared
  `@opentui/core@0.5.3` optionalDependencies set
  (`cli/src/__tests__/unit/build-binary-env.test.ts`).

## Verification

- Local full cross-compile on Windows: `OVERRIDE_TARGET=bun-linux-arm64 …`
  `scripts/build-binary.ts` → `✅ Built savant-code (linux-arm64)` (exit 0).
- CI re-dispatch (`release_tag: v0.0.25`, `source_ref: fix/…` branch): the
  5-target matrix rebuilt from the fix and the workflow
  `verify-release-assets` job passed — all five tarballs present on the
  GitHub release.
- `cli` typecheck exit 0; unit suite 17 pass / 0 fail; pre-push gate
  (credential scan + ESLint + markdownlint + typecheck + tests + prettier)
  passed on the fix commit and on the merge to main.

## Resolution

The release finalized: `POST_RELEASE_VERIFY` stage marked on the release
receipt, `restored: true` (operator settings restored to
`nous/meituan/longcat-2.0:free`), receipt finalized, and the release shows
5/5 binaries + npm `savant-code@0.0.25`. The fix is merged to `main`
(`18fec3a` + style commit `8ee1883`, pushed) so future releases build every
linux variant on any host.

Gate evidence: `cli` typecheck exit 0; `build-binary-env.test.ts` 17 pass /
0 fail; full arm64 cross-compile locally exit 0; CI matrix build success +
asset verify pass; changelog entry added below.

## Root-cause class follow-up

This is the second consecutive release blocked on the binary-asset path (the
v0.0.24 incident shipped zero binaries; this one shipped 4/5). Both were
caught by the fail-closed `verifyReleaseAssets`/`verify-release-assets` job.
The fix removes the variant-resolution failure class entirely; the CI
`Build linux-arm64` job now compiles the same way on any host.