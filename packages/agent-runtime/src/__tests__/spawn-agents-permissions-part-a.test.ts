import { describe, expect, it } from 'bun:test'

import { getMatchingSpawn } from '../tools/handlers/tool/spawn-agent-utils'

describe('Spawn Agents Permissions', () => {
  describe('getMatchingSpawn function', () => {
    describe('exact matches with publisher/agent@version format', () => {
      it('should match exact publisher/agent@version', () => {
        const spawnableAgents = [
          'savant-code/thinker@1.0.0',
          'savant-code/verifier@2.1.0',
        ]
        const result = getMatchingSpawn(
          spawnableAgents,
          'savant-code/thinker@1.0.0',
        )
        expect(result).toBe('savant-code/thinker@1.0.0')
      })

      it('should not match different versions', () => {
        const spawnableAgents = ['savant-code/thinker@1.0.0']
        const result = getMatchingSpawn(
          spawnableAgents,
          'savant-code/thinker@2.0.0',
        )
        expect(result).toBeNull()
      })

      it('should not match different publishers', () => {
        const spawnableAgents = ['savant-code/thinker@1.0.0']
        const result = getMatchingSpawn(spawnableAgents, 'acme/thinker@1.0.0')
        expect(result).toBeNull()
      })

      it('should not match different agent names', () => {
        const spawnableAgents = ['savant-code/thinker@1.0.0']
        const result = getMatchingSpawn(
          spawnableAgents,
          'savant-code/verifier@1.0.0',
        )
        expect(result).toBeNull()
      })
    })

    describe('publisher/agent format without version', () => {
      it('should match publisher/agent when child has no version', () => {
        const spawnableAgents = ['savant-code/thinker@1.0.0', 'acme/verifier']
        const result = getMatchingSpawn(spawnableAgents, 'savant-code/thinker')
        expect(result).toBe('savant-code/thinker@1.0.0')
      })

      it('should match exact publisher/agent without version', () => {
        const spawnableAgents = ['savant-code/thinker', 'acme/verifier']
        const result = getMatchingSpawn(spawnableAgents, 'savant-code/thinker')
        expect(result).toBe('savant-code/thinker')
      })

      it('should not match when publisher differs', () => {
        const spawnableAgents = ['savant-code/thinker@1.0.0']
        const result = getMatchingSpawn(spawnableAgents, 'acme/thinker')
        expect(result).toBeNull()
      })
    })

    describe('agent@version format without publisher', () => {
      it('should match agent@version when spawnable has no publisher', () => {
        const spawnableAgents = ['thinker@1.0.0', 'verifier@2.0.0']
        const result = getMatchingSpawn(spawnableAgents, 'thinker@1.0.0')
        expect(result).toBe('thinker@1.0.0')
      })

      it('should match agent@version when spawnable has publisher but child does not', () => {
        const spawnableAgents = ['savant-code/thinker@1.0.0', 'verifier@2.0.0']
        const result = getMatchingSpawn(spawnableAgents, 'thinker@1.0.0')
        expect(result).toBe('savant-code/thinker@1.0.0')
      })

      it('should not match when versions differ', () => {
        const spawnableAgents = ['thinker@1.0.0']
        const result = getMatchingSpawn(spawnableAgents, 'thinker@2.0.0')
        expect(result).toBeNull()
      })
    })

    describe('simple agent name format', () => {
      it('should match simple agent name', () => {
        const spawnableAgents = ['thinker', 'verifier', 'scout']
        const result = getMatchingSpawn(spawnableAgents, 'thinker')
        expect(result).toBe('thinker')
      })

      it('should match underscored agent name to hyphenated spawnable agent', () => {
        const spawnableAgents = ['thinker', 'verifier', 'scout']
        const result = getMatchingSpawn(spawnableAgents, 'scout')
        expect(result).toBe('scout')
      })

      it('should match simple agent name when spawnable has publisher', () => {
        const spawnableAgents = ['savant-code/thinker@1.0.0', 'verifier']
        const result = getMatchingSpawn(spawnableAgents, 'thinker')
        expect(result).toBe('savant-code/thinker@1.0.0')
      })

      it('should match underscored agent name when spawnable has publisher and version', () => {
        const spawnableAgents = ['savant-code/scout@1.0.0', 'verifier']
        const result = getMatchingSpawn(spawnableAgents, 'scout')
        expect(result).toBe('savant-code/scout@1.0.0')
      })

      it('should match underscored published agent ID to hyphenated spawnable agent', () => {
        const spawnableAgents = ['savant-code/scout@1.0.0']
        const result = getMatchingSpawn(
          spawnableAgents,
          'savant-code/scout@1.0.0',
        )
        expect(result).toBe('savant-code/scout@1.0.0')
      })

      it('should match simple agent name when spawnable has version', () => {
        const spawnableAgents = ['thinker@1.0.0', 'verifier']
        const result = getMatchingSpawn(spawnableAgents, 'thinker')
        expect(result).toBe('thinker@1.0.0')
      })

      it('should not match when agent name differs', () => {
        const spawnableAgents = ['thinker', 'verifier']
        const result = getMatchingSpawn(spawnableAgents, 'scout')
        expect(result).toBeNull()
      })
    })

    describe('edge cases', () => {
      it('should return null for empty agent ID', () => {
        const spawnableAgents = ['thinker', 'verifier']
        const result = getMatchingSpawn(spawnableAgents, '')
        expect(result).toBeNull()
      })

      it('should return null for malformed agent ID', () => {
        const spawnableAgents = ['thinker', 'verifier']
        const result = getMatchingSpawn(
          spawnableAgents,
          'invalid/agent/format/too/many/slashes',
        )
        expect(result).toBeNull()
      })

      it('should return null when spawnableAgents is empty', () => {
        const spawnableAgents: string[] = []
        const result = getMatchingSpawn(spawnableAgents, 'thinker')
        expect(result).toBeNull()
      })

      it('should handle malformed spawnable agent IDs gracefully', () => {
        const spawnableAgents = ['', 'invalid/agent/too/many/parts', 'thinker']
        const result = getMatchingSpawn(spawnableAgents, 'thinker')
        expect(result).toBe('thinker')
      })

      it('should prioritize exact matches over partial matches', () => {
        const spawnableAgents = ['thinker', 'savant-code/thinker@1.0.0']
        const result = getMatchingSpawn(spawnableAgents, 'thinker')
        expect(result).toBe('thinker') // First match wins
      })
    })
  })
})
