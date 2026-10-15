import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { FollowupCards, parseFollowups } from '../FollowupCards'

function html(node: React.ReactElement): string {
  return renderToStaticMarkup(node)
}

describe('parseFollowups (suggest_followups parity, FID-2026-0901-006)', () => {
  test('returns empty for missing/malformed input', () => {
    expect(parseFollowups(null)).toEqual([])
    expect(parseFollowups('{}')).toEqual([])
    expect(parseFollowups('not json')).toEqual([])
  })

  test('parses the followups array and keeps only prompt-bearing entries', () => {
    const input = JSON.stringify({
      followups: [
        { prompt: 'explain the architecture' },
        { prompt: 'run the tests', label: 'Run tests' },
        { label: 'no prompt — dropped' },
        'garbage',
      ],
    })
    const result = parseFollowups(input)
    expect(result).toHaveLength(2)
    expect(result[0]?.prompt).toBe('explain the architecture')
    expect(result[1]?.prompt).toBe('run the tests')
    expect(result[1]?.label).toBe('Run tests')
  })
})

describe('FollowupCards P25 CSS tooltip', () => {
  test('the full prompt rides in data-tip (WebView2 suppresses native title)', () => {
    const out = html(
      <FollowupCards
        inputJson={JSON.stringify({ followups: [{ prompt: 'run the tests' }] })}
        onSend={() => {}}
      />,
    )
    expect(out).toContain('data-tip="run the tests"')
    // The native title is gone — it never surfaced in WebView2.
    expect(out).not.toContain('title=')
  })
})
