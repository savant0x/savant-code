# Dependency security maintenance

Install from the repository root with the pinned Bun version and committed lockfile:

```bash
bun install --frozen-lockfile
bun audit
bun scripts/probes/dependency-security.ts
```

The 2026-10-18 release audit removed unused authentication, PostgreSQL, Stripe
and native SQLite packages, updated vulnerable direct dependencies and pinned
fixed transitive versions in the root manifest. Zod remains at 4.4.3 because
the JSON-schema adapter is incompatible with the newer type definitions.

Two Bun patches are required and checked into `patches/`:

- `gray-matter@4.0.3` uses YAML 4's `load`/`dump` APIs with the root override
  to `js-yaml@4.3.2`. This preserves safe YAML parsing and removes the old
  argparse/sprintf dependency chain. Do not remove the patch while retaining
  the YAML override: gray-matter's original `safeLoad` API was removed in YAML 4.
- `braces@3.0.3` rejects parser nesting at 128 stack entries for curly groups
  and parentheses, before its recursive AST walkers receive the tree.
  Normal patterns remain supported. Excessive nesting throws a `SyntaxError`.

The registry still reports
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
against the patched braces version because the advisory has no published fixed
release. `bun audit` therefore still exits nonzero. This is a locally mitigated
advisory, not a zero-advisory result. The durable probe checks the actual loaded
dependency: frontmatter parsing/stringifying, rejection of executable YAML tags,
normal glob expansion and bounded brace/parenthesis nesting.
The pristine CLI bundle gate runs this probe against its freshly installed
dependency tree before building the SDK and CLI.

Root overrides and patches apply to this monorepo installation and the CLI
builds produced from it. They do not propagate into another project's package
manager merely because it installs the SDK. The SDK remains unpublished; an
SDK publication requires its own isolated consumer dependency audit and a
distribution strategy that carries these fixes. The default release scope
is CLI-only; see [the release procedure](public-release.md).

When an upstream fixed braces version becomes available, replace the patch
with that version and retain the behavior probe. After dependency changes,
run the full typecheck, workspace tests, SDK build and desktop renderer build.
