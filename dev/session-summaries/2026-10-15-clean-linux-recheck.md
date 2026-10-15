# Clean Linux rebuild recheck — 2026-10-15

## Authorized work and impact

Check the eight reproducibility requirements against committed source, fix
remaining gaps, verify, and create a local path-scoped commit. Preserve the
unrelated staged retirement work. No push is requested.

The initial documentation/infrastructure review expanded when isolated Linux
tests exposed dependencies hidden by the workstation. Each repair was added to
FID-2026-1015-003 before implementation. The existing code and test contracts
were extended; no test assertion was removed or newly skipped.

## Verification plan

- Build an archive of HEAD in Docker without host dependencies or settings.
- Build the final Docker context, run the root test command and CLI smoke check.
- Run typecheck and lint; inspect the final scoped diff.
- Check runtime pins, tracked environment files, and active workstation paths.

## Results

| Requirement | Checked result |
| --- | --- |
| Git repository and commits | Existing history retained; scoped local implementation commits recorded below |
| Dependency lockfile | bun.lock committed; CLI tar test dependency declared and locked |
| Runtime pin | Bun 1.3.14 in .bun-version, package.json and Docker; image digests pinned |
| Docker build/run | Isolated Git-tree builds pass; CLI reports 0.0.36 as UID 1000 |
| One test command | bun run test; desktop builds its native sidecar automatically |
| README | Native prerequisites, pinned setup, build/test/run and Docker commands documented |
| Environment and secrets | Required public app URL restored; ignored local settings; 2,239 production/template files scanned with no flags |
| Workstation paths | Active build/runtime paths are portable; old paths quoted in historical audit documents are preserved |

The final Linux root command passed **9,213 tests / 17 skips / zero failures**
on isolated committed source with the corrected executable modes. The working
checkout run passed **9,162 / 17 skips / zero failures**; the count differs
because unrelated staged Savant-Free retirement work was preserved and excluded
from this task's commits. All seventeen declared FID gates pass, including the
native desktop build and live integration tests. Full root typecheck, ESLint,
Markdown lint and scoped formatting passed.

Docker uses Bun 1.3.14, Node 22.20.0 and npm 10.9.3, with tini for child reaping.
The fresh Git-tree image's vendor modes are checked independently from the
Windows filesystem context. No host node_modules or private .env files are
needed. The Windows bootstrap fixture also passes after switching to a file URL
and the absolute runtime executable.

## Repairs and audit trail

- Replaced synthetic search directories and developer-owned environment fixtures.
- Reused the existing shared environment bootstrap in six workspace preloads.
- Declared tar; added Node/npm for real package-boundary tests.
- Repaired normalized path resolution, dangling/looping symlinks and sibling-prefix
  containment. Existing production callers remain wired.
- Made desktop tests compile the native sidecar before their live regressions.
- Recorded executable Git modes for four Unix ripgrep binaries; bytes unchanged.
- Expanded Docker exclusions for credentials, nested environment files and backups.
- Used the existing top-entry-only CHANGELOG exception recorded in SCOPE and the
  usage-limit handoff; its historical entries were preserved.

Implementation: `d94e30c7`. An empty temporary index accidentally produced local
commit `a1b5e7d2`; working files were intact. Corrective commit `a707aa89` restores
the verified source tree plus the four executable modes. Commit `7c1af232` fixes
the cross-host bootstrap fixture. History is preserved; no push was performed.

One Windows timeout assertion failed under concurrent load (4,284 ms versus
4,000 ms), then passed unchanged in its focused suite (14 tests, zero failures;
the timeout case took 1,034 ms). The full Linux suites pass. One intermediate
Docker install encountered a tarball extraction failure; fresh builds succeeded.

FID-2026-1015-003 is closed and archived with actual implementation evidence.
SCOPE removes this task's completed items and write targets. Other staged work,
the concurrent push-policy edits, and all unrelated untracked files are preserved.

## Commands from the checkout

```bash
bun install --frozen-lockfile
bun run ci
bun run test
cp .env.example .env.local
# Configure only the chosen provider in .env.local, then:
bun run dev

docker build --tag savant-code:local .
docker run --rm savant-code:local bun run test
docker run --rm --interactive --tty --env-file .env.local savant-code:local
```
