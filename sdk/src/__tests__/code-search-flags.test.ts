import { describe, expect, it } from 'bun:test'

import { parseSearchFlags } from '../tools/code-search/flags'

/**
 * FID-2026-1012-019: the caller appends its own `--` terminator before the
 * pattern, so two structural shapes must never reach ripgrep from the model's
 * `flags` parameter — a duplicate terminator (which shifts the pattern and
 * exits 2) and a trailing value-taking flag with no value (whose value would
 * silently become the caller's terminator).
 */
describe('parseSearchFlags — structural guard', () => {
  it('drops a model-supplied `--` terminator', () => {
    expect(parseSearchFlags('--')).toEqual({
      flagsArray: [],
      extraSearchPaths: [],
    })
  })

  it('keeps the flags around a dropped terminator', () => {
    expect(parseSearchFlags('-n -- -i').flagsArray).toEqual(['-n', '-i'])
  })

  it('drops a trailing value-taking flag that was given no value', () => {
    expect(parseSearchFlags('-g *.ts -A').flagsArray).toEqual(['-g', '*.ts'])
  })

  it('leaves boolean flags and their values untouched', () => {
    expect(parseSearchFlags('-n -i --hidden').flagsArray).toEqual([
      '-n',
      '-i',
      '--hidden',
    ])
  })

  it('still moves non-flag arguments to the search paths', () => {
    const parsed = parseSearchFlags("cli/src -g '*.ts'")
    expect(parsed.flagsArray).toEqual(['-g', '*.ts'])
    expect(parsed.extraSearchPaths).toEqual(['cli/src'])
  })

  it('does not forward a second terminator to the caller', () => {
    const { flagsArray } = parseSearchFlags('-n -- --hidden')
    expect(flagsArray.filter((token) => token === '--')).toEqual([])
  })
})
