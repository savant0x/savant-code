// FID-2026-0905-007 — public-release decomposition: GitHub REST client.
//
// The token-authenticated API primitive with a 30s timeout and
// fail-closed error handling, plus the tag/release assertions built on it.
// Verbatim moves from scripts/public-release.ts.

import { PUBLIC_REPOSITORY_SLUG } from './catalog'
import { fail } from './fail'

type GitHubApiOptions = {
  token: string
  fetchImpl?: typeof fetch
}

export async function githubApiRequest<T>(
  endpoint: string,
  options: GitHubApiOptions & {
    method?: string
    body?: Record<string, unknown>
    expectedStatuses?: number[]
  },
): Promise<{ status: number; body: T | undefined }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await (options.fetchImpl ?? fetch)(
      `https://api.github.com${endpoint}`,
      {
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${options.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      },
    )
    const text = await response.text()
    const expected = options.expectedStatuses ?? [200]
    if (!expected.includes(response.status)) {
      if (response.status === 404 && expected.includes(404)) {
        return { status: response.status, body: undefined }
      }
      fail(`GitHub API request failed with HTTP ${response.status}.`)
    }

    let body: T | undefined
    if (text) {
      try {
        body = JSON.parse(text) as T
      } catch {
        fail(`GitHub API returned invalid JSON (${response.status}).`)
      }
    }
    return { status: response.status, body }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('GitHub API'))
      throw error
    fail('GitHub API request failed without exposing response details.')
  } finally {
    clearTimeout(timeout)
  }
}

export async function assertGitHubToken(token: string): Promise<void> {
  await githubApiRequest<{ login?: string }>('/user', {
    token,
    expectedStatuses: [200],
  })
}

export async function verifyGitHubTagHeadApi(
  version: string,
  expectedHead: string,
  token: string,
): Promise<void> {
  const reference = await githubApiRequest<{
    object?: { type?: string; sha?: string }
  }>(`/repos/${PUBLIC_REPOSITORY_SLUG}/git/ref/tags/v${version}`, {
    token,
    expectedStatuses: [200],
  })
  const object = reference.body?.object
  if (object?.type === 'commit' && object.sha === expectedHead) return
  if (object?.type !== 'tag' || !object.sha) {
    fail(`GitHub tag v${version} is not bound to release HEAD.`)
  }
  const annotated = await githubApiRequest<{ object?: { sha?: string } }>(
    `/repos/${PUBLIC_REPOSITORY_SLUG}/git/tags/${object.sha}`,
    { token, expectedStatuses: [200] },
  )
  if (annotated.body?.object?.sha !== expectedHead) {
    fail(`GitHub annotated tag v${version} is not bound to release HEAD.`)
  }
}

export async function assertNoExistingReleaseApi(
  version: string,
  token: string,
): Promise<void> {
  const result = await githubApiRequest(
    `/repos/${PUBLIC_REPOSITORY_SLUG}/releases/tags/v${version}`,
    {
      token,
      expectedStatuses: [200, 404],
    },
  )
  if (result.status !== 404) {
    fail(`GitHub release v${version} already exists; use --resume.`)
  }
}

export async function createGitHubReleaseApi(
  version: string,
  notes: string,
  token: string,
): Promise<void> {
  await githubApiRequest(`/repos/${PUBLIC_REPOSITORY_SLUG}/releases`, {
    token,
    method: 'POST',
    expectedStatuses: [201],
    body: {
      tag_name: `v${version}`,
      target_commitish: 'main',
      name: `v${version}`,
      body: notes,
      draft: false,
      prerelease: false,
    },
  })
}
