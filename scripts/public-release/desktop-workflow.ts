// FID-2026-0903-001 — desktop packaging integration: workflow dispatch.
//
// DESKTOP_BUNDLES dispatches desktop-release.yml for the cut's tag and
// watches the run fail-closed; DESKTOP_RELEASE locates the successful run,
// downloads the bundle artifacts, re-runs the fail-closed manifest
// generator locally, and attaches everything to the GitHub release. Both
// run only when SAVANT_CODE_RELEASE_DESKTOP=1 (opt-in for the first
// integrated cut; see catalog.isDesktopPackagingEnabled). GitHub REST
// calls are injectable via fetchImpl; artifact download/upload use `gh`
// behind injectable runners so the suite pins behavior without network.

import { PUBLIC_REPOSITORY_SLUG } from './catalog'
import { run } from './command-runner'
import { fail } from './fail'
import { githubApiRequest } from './github-api'

const WORKFLOW_NAME = 'desktop-release.yml'

export type WorkflowRun = {
  id: number
  status: string
  conclusion: string | null
  head_sha: string
}

/**
 * Dispatches the desktop release workflow for the cut's tag.
 * `source_ref` is omitted so the workflow defaults it to `release_tag`
 * (builds the tagged commit — the release contract).
 */
export async function dispatchDesktopRelease(
  version: string,
  token: string,
  fetchImpl?: typeof fetch,
): Promise<void> {
  await githubApiRequest(
    `/repos/${PUBLIC_REPOSITORY_SLUG}/actions/workflows/${WORKFLOW_NAME}/dispatches`,
    {
      token,
      method: 'POST',
      expectedStatuses: [204],
      fetchImpl,
      body: { ref: `v${version}`, inputs: { release_tag: `v${version}` } },
    },
  )
}

type WorkflowRunsResponse = {
  workflow_runs?: Array<{
    id?: number
    status?: string
    conclusion?: string | null
    head_sha?: string
  }>
}

/**
 * Lists workflow runs for desktop-release.yml on the cut's tag, newest
 * first (created desc). Injectable fetch + a now() source so the poll
 * window is testable without real waiting.
 */
export async function listDesktopRuns(
  version: string,
  token: string,
  fetchImpl?: typeof fetch,
): Promise<WorkflowRun[]> {
  const result = await githubApiRequest<WorkflowRunsResponse>(
    `/repos/${PUBLIC_REPOSITORY_SLUG}/actions/workflows/${WORKFLOW_NAME}/runs?branch=v${version}&per_page=10`,
    { token, expectedStatuses: [200], fetchImpl },
  )
  return (result.body?.workflow_runs ?? []).map((entry, index) => ({
    id: entry.id ?? -1 - index,
    status: entry.status ?? 'unknown',
    conclusion: entry.conclusion ?? null,
    head_sha: entry.head_sha ?? '',
  }))
}

export type DesktopRunPoller = {
  listRuns: () => Promise<WorkflowRun[]>
  nowMs: () => number
  sleepMs: (ms: number) => Promise<void>
}

export const DEFAULT_POLL_TIMEOUT_MS = 45 * 60 * 1_000
export const DEFAULT_POLL_INTERVAL_MS = 30 * 1_000

/**
 * Bounded fail-closed poll for a completed run created after dispatch:
 * waits for the newest run on the tag to reach a completed status, then
 * requires conclusion === 'success'. Timeout or failure aborts the cut
 * with the remediation commands.
 */
export async function watchDesktopRun(
  poller: DesktopRunPoller,
  version: string,
): Promise<WorkflowRun> {
  const deadline = poller.nowMs() + DEFAULT_POLL_TIMEOUT_MS
  let seen = false
  let lastRun: WorkflowRun | undefined
  for (;;) {
    const runs = await poller.listRuns()
    lastRun = runs[0]
    if (lastRun !== undefined) {
      seen = true
      if (lastRun.status === 'completed' && lastRun.conclusion !== 'success') {
        fail(
          `Desktop release workflow run ${lastRun.id} for v${version} concluded '${lastRun.conclusion}' — inspect the Actions run, fix, and re-run 'bun run release:public:resume'.`,
        )
      }
      if (lastRun.status === 'completed' && lastRun.conclusion === 'success') {
        return lastRun
      }
    }
    if (poller.nowMs() >= deadline) {
      fail(
        seen
          ? `Desktop release workflow run for v${version} did not complete within the poll window — inspect the Actions run, then re-run 'bun run release:public:resume'.`
          : `No desktop-release.yml run appeared for v${version} within the poll window — confirm the dispatch under Actions, then re-run 'bun run release:public:resume'.`,
      )
    }
    await poller.sleepMs(DEFAULT_POLL_INTERVAL_MS)
  }
}

/**
 * Locates the successful run for the cut's tag (resume path): re-derives
 * it from the Actions run list — never persisted in the receipt (Loop 2
 * correction 4). Ambiguity fails closed with the exact remediation.
 */
export async function locateSuccessfulDesktopRun(
  version: string,
  token: string,
  fetchImpl?: typeof fetch,
): Promise<WorkflowRun> {
  const runs = await listDesktopRuns(version, token, fetchImpl)
  const successful = runs.filter(
    (candidate) =>
      candidate.status === 'completed' && candidate.conclusion === 'success',
  )
  if (successful.length === 0) {
    fail(
      `No successful desktop-release.yml run found for v${version} — dispatch it manually with release_tag: v${version}, then re-run 'bun run release:public:resume'.`,
    )
  }
  if (successful.length > 1) {
    fail(
      `Multiple successful desktop-release.yml runs for v${version} (${successful.map((candidate) => candidate.id).join(', ')}) — delete the stale runs or download/upload manually, then re-run 'bun run release:public:resume'.`,
    )
  }
  return successful[0] as WorkflowRun
}

/**
 * Downloads the workflow run's bundle artifacts into destinationDir via
 * `gh run download` (runner injectable for tests). Returns destinationDir
 * so callers can chain into flattenDownloadedArtifacts.
 */
export function downloadDesktopArtifacts(
  runId: number,
  destinationDir: string,
  root: string,
  runner: (command: string, args: string[]) => unknown = (command, args) =>
    run(command, args, root, true),
): string {
  const result = runner('gh', [
    'run',
    'download',
    String(runId),
    '--repo',
    PUBLIC_REPOSITORY_SLUG,
    '--dir',
    destinationDir,
  ]) as { status: number; stderr?: string }
  if (result.status !== 0) {
    fail(
      `Failed to download desktop artifacts for run ${runId}: ${result.stderr ?? 'no stderr'}`,
    )
  }
  return destinationDir
}

/**
 * Attaches files to the cut's release via `gh release upload --clobber`
 * (runner injectable for tests).
 */
export function uploadDesktopAssets(
  version: string,
  files: readonly string[],
  root: string,
  runner: (command: string, args: string[]) => unknown = (command, args) =>
    run(command, args, root, true),
): void {
  const result = runner('gh', [
    'release',
    'upload',
    `v${version}`,
    ...files,
    '--repo',
    PUBLIC_REPOSITORY_SLUG,
    '--clobber',
  ]) as { status: number; stderr?: string }
  if (result.status !== 0) {
    fail(
      `Failed to upload desktop artifacts to release v${version}: ${result.stderr ?? 'no stderr'}`,
    )
  }
}
