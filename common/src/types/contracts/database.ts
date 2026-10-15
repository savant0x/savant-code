import type { AgentTemplate } from '@savant-code/common/types/agent-template'

/**
 * FID-2026-0929-005 (gut the backend): the backend database contract is
 * deleted — there is no backend to fetch users, agent templates, or run
 * records from. `DatabaseAgentCache` survives because the local-template
 * resolution path (templates/agent-registry) still uses a bounded cache.
 */
export type DatabaseAgentCache = Map<string, AgentTemplate | null>
