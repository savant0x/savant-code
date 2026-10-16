import { expect, test } from 'bun:test'

import { readUrl } from '../tools/read-url'

test('a recommendation article cannot replace the primary heading and body', async () => {
  const output = await readUrl({
    url: 'https://example.com/git-worktrees',
    fetch: async () =>
      new Response(
        `
      <html><title>Git Worktrees</title><main>
        <h1>Git Worktrees</h1><div>Worktrees provide separate working directories.</div>
        <aside><article><h2>Design tokens</h2><p>Unrelated recommendation.</p></article></aside>
      </main></html>`,
        { headers: { 'content-type': 'text/html' } },
      ),
  })
  const value = output[0].value
  expect('errorMessage' in value).toBe(false)
  if ('errorMessage' in value) return
  expect(value.text).toContain('Git Worktrees')
  expect(value.text).toContain('separate working directories')
})

test('an actual headed article still wins over surrounding file-list boilerplate', async () => {
  const output = await readUrl({
    url: 'https://example.com/repo',
    fetch: async () =>
      new Response(
        `
      <main><section>Folders and files</section>
      <article><h1>README</h1><p>Actual documentation.</p></article></main>`,
        { headers: { 'content-type': 'text/html' } },
      ),
  })
  const value = output[0].value
  expect('errorMessage' in value).toBe(false)
  if ('errorMessage' in value) return
  expect(value.text).toContain('Actual documentation')
  expect(value.text).not.toContain('Folders and files')
})
