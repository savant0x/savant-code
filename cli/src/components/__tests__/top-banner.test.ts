import { describe, expect, test } from 'bun:test'

describe('TopBanner interaction contract', () => {
  test('keeps the banner control contract explicit in source', async () => {
    const source = await Bun.file(`${import.meta.dir}/../top-banner.tsx`).text()

    expect(source).toContain('<Button onClick={handleClose}>')
    expect(source).toContain('<TerminalLink')
    expect(source).not.toContain('selectable={false}')
  })
})
