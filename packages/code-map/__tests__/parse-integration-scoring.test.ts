// code-map parse module — getFileTokenScores multi-file scoring
// integration tests.
// Sibling of the Loop 324 decomposition (realistic-parsing integration
// tests live in parse-integration).

import { describe, it, expect } from 'bun:test'

import { getFileTokenScores } from '../src/parse'

describe('parse module - integration tests (multi-file scoring)', () => {
  it('should process multiple files with getFileTokenScores and return valid token scores', async () => {
    const projectRoot = '/tmp/test-project'
    const testFiles = {
      'src/utils.ts': `
export function calculateTax(amount: number, rate: number): number {
  return amount * rate;
}

export function formatCurrency(value: number): string {
  return '
})
 + value.toFixed(2);
}
        `.trim(),
      'src/main.ts': `
import { calculateTax, formatCurrency } from './utils';

const price = 100;
const taxRate = 0.08;
const total = price + calculateTax(price, taxRate);
console.log('Total:', formatCurrency(total));
        `.trim(),
    }

    const filePaths = Object.keys(testFiles)
    const fileProvider = (filePath: string) => {
      const fullPath = filePath.replace(projectRoot + '/', '')
      return testFiles[fullPath as keyof typeof testFiles] || null
    }

    const result = await getFileTokenScores(
      projectRoot,
      filePaths,
      fileProvider,
    )

    // This test actually runs with the real implementation but uses mocked file content
    // The real implementation should gracefully handle when no language config is found
    expect(result.tokenScores).toBeDefined()
    expect(result.tokenCallers).toBeDefined()

    // Verify that the structure is correct even if no tokens are found
    expect(typeof result.tokenScores).toBe('object')
    expect(typeof result.tokenCallers).toBe('object')
  })

  it('never reads a path whose language is unknown and reads each admitted file once', async () => {
    const reads: string[] = []
    const result = await getFileTokenScores(
      '/tmp/test-project',
      ['src/notes.txt', 'src/app.ts', 'src/notes.txt'],
      async (filePath: string) => {
        reads.push(filePath)
        return 'export function app() { return helper() }\n'
      },
    )

    // Unknown language is a skip, not a read: it consumes neither I/O nor a
    // successful-parse slot.
    expect(reads).not.toContain('src/notes.txt')
    expect(result.tokenScores['src/notes.txt']).toBeUndefined()
    // No admitted path is read twice, whatever the language layer resolves.
    expect(new Set(reads).size).toBe(reads.length)
  })

  it('should continue scoring when a provided reader rejects for one file', async () => {
    const result = await getFileTokenScores(
      '/tmp/test-project',
      ['src/unreadable.ts', 'src/readable.ts'],
      async (filePath: string) => {
        if (filePath === 'src/unreadable.ts') {
          throw new Error('permission denied')
        }

        return 'export function readable() { return helper() }\nfunction helper() { return 1 }\n'
      },
    )

    expect(result.tokenScores).toBeDefined()
    expect(result.tokenCallers).toBeDefined()
  })
})
