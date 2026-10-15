// Agent Registry test family — agent-ID edge cases.
// Sibling of the Loop-341 decomposition (shared lifecycle in
// ./agent-registry-test-harness).
import { describe, expect, it } from 'bun:test'

import { getAgentTemplate } from '../agent-registry'
import {
  getImpl,
  registerAgentRegistryLifecycle,
} from './agent-registry-test-harness'

describe('Agent Registry', () => {
  registerAgentRegistryLifecycle()

  describe('edge cases', () => {
    it('should handle empty agent ID', async () => {
      const result = await getAgentTemplate({
        ...getImpl(),
        agentId: '',
        localAgentTemplates: {},
      })
      expect(result).toBeNull()
    })

    it('should handle agent ID with multiple @ symbols', async () => {
      const result = await getAgentTemplate({
        ...getImpl(),
        agentId: 'publisher/agent@1.0.0@extra',
        localAgentTemplates: {},
      })
      expect(result).toBeNull()
    })

    it('should handle agent ID with only @ symbol', async () => {
      const result = await getAgentTemplate({
        ...getImpl(),
        agentId: 'publisher/agent@',
        localAgentTemplates: {},
      })
      expect(result).toBeNull()
    })
  })
})
