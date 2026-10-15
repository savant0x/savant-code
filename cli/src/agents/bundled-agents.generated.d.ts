/**
 * Type declarations for the auto-generated bundled agents module.
 *
 * The implementation and per-agent data modules are created by
 * cli/scripts/prebuild-agents.ts and are gitignored. This declaration
 * file lets TypeScript resolve the public module before generation.
 */
import type { LocalAgentInfo } from '../utils/local-agent-registry'

import type { AgentDefinition } from '@savant-code/common/templates/initial-agents-dir/types/agent-definition'

export type BundledAgentDefinition = Omit<AgentDefinition, 'handleSteps'> & {
  handleSteps?: string
  [key: string]: unknown
}
export declare const bundledAgents: Record<string, BundledAgentDefinition>
export declare function getBundledAgentsAsLocalInfo(): LocalAgentInfo[]
export declare function getBundledAgentIds(): string[]
export declare function isBundledAgent(agentId: string): boolean
