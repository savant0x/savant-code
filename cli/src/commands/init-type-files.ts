// Raw-text imports of the .agents/types scaffold sources. These are copied
// verbatim into user projects by `init` (FID-2026-0819-005 Loop 358: the
// agent-definition/tools hubs decomposed into sibling modules — every sibling
// must ship with them or user projects get broken hubs).
// @ts-expect-error - Bun text import attribute not supported by TypeScript
import agentDefinitionSource from '../../../common/src/templates/initial-agents-dir/types/agent-definition' with { type: 'text' }
// @ts-expect-error - Bun text import attribute not supported by TypeScript
import agentDefinitionSupportSource from '../../../common/src/templates/initial-agents-dir/types/agent-definition-support' with { type: 'text' }
// @ts-expect-error - Bun text import attribute not supported by TypeScript
import agentModelsSource from '../../../common/src/templates/initial-agents-dir/types/agent-models' with { type: 'text' }
// @ts-expect-error - Bun text import attribute not supported by TypeScript
import toolParamsCoreSource from '../../../common/src/templates/initial-agents-dir/types/tool-params-core' with { type: 'text' }
// @ts-expect-error - Bun text import attribute not supported by TypeScript
import toolParamsDiscoverySource from '../../../common/src/templates/initial-agents-dir/types/tool-params-discovery' with { type: 'text' }
// @ts-expect-error - Bun text import attribute not supported by TypeScript
import toolParamsResearchSource from '../../../common/src/templates/initial-agents-dir/types/tool-params-research' with { type: 'text' }
// @ts-expect-error - Bun text import attribute not supported by TypeScript
import toolsSource from '../../../common/src/templates/initial-agents-dir/types/tools' with { type: 'text' }
// @ts-expect-error - Bun text import attribute not supported by TypeScript
import utilTypesSource from '../../../common/src/templates/initial-agents-dir/types/util-types' with { type: 'text' }

export const COMMON_TYPE_FILES: { fileName: string; source: string }[] = [
  { fileName: 'agent-definition.ts', source: agentDefinitionSource },
  {
    fileName: 'agent-definition-support.ts',
    source: agentDefinitionSupportSource,
  },
  { fileName: 'agent-models.ts', source: agentModelsSource },
  { fileName: 'tools.ts', source: toolsSource },
  { fileName: 'tool-params-core.ts', source: toolParamsCoreSource },
  {
    fileName: 'tool-params-discovery.ts',
    source: toolParamsDiscoverySource,
  },
  {
    fileName: 'tool-params-research.ts',
    source: toolParamsResearchSource,
  },
  { fileName: 'util-types.ts', source: utilTypesSource },
]
