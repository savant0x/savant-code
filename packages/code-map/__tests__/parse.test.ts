// code-map parse module — constants and exported interface contracts.
// Parent of the Loop 324 decomposition (parseTokens, internal-logic, and
// integration suites live in sibling files).

import { describe, it, expect } from 'bun:test'

import {
  DEBUG_PARSING,
  type TokenCallerMap,
  type FileTokenData,
} from '../src/parse'

describe('parse module', () => {
  describe('constants', () => {
    it('should have DEBUG_PARSING set to false by default', () => {
      expect(DEBUG_PARSING).toBe(false)
    })
  })

  describe('interfaces', () => {
    it('should define TokenCallerMap properly', () => {
      const callerMap: TokenCallerMap = {
        'file1.ts': {
          token1: ['caller1.ts', 'caller2.ts'],
        },
      }

      expect(callerMap['file1.ts']['token1']).toEqual([
        'caller1.ts',
        'caller2.ts',
      ])
    })

    it('should define FileTokenData properly', () => {
      const tokenData: FileTokenData = {
        tokenScores: {
          'file1.ts': { token1: 1.0 },
        },
        tokenCallers: {
          'file1.ts': { token1: ['caller.ts'] },
        },
      }

      expect(tokenData.tokenScores['file1.ts']['token1']).toBe(1.0)
      expect(tokenData.tokenCallers['file1.ts']['token1']).toEqual([
        'caller.ts',
      ])
    })
  })
})
