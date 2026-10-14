// Raw-text imports of the .agents/types scaffold sources. These are copied
// verbatim into user projects by `init` (FID-2026-0819-005 Loop 358: the
// agent-definition/tools hubs decomposed into sibling modules — every sibling
// must ship with them or user projects get broken hubs).
//
// FID-2026-1013-012 W3-2: the `with { type: 'text' }` attribute is what makes
// `bun build --compile` embed these files in the standalone binary (the
// sources are NOT on disk in a user project), so it stays. TypeScript resolves
// each specifier to the real `.ts` module — whose exports are types only, so
// nothing survives to runtime — while Bun's text loader hands the file's
// contents over as the module's `default`. `readTextModule` states that shape
// once, which is why this file carries no `@ts-expect-error` suppression.
import * as agentDefinitionModule from '../../../common/src/templates/initial-agents-dir/types/agent-definition' with { type: 'text' }
import * as agentDefinitionSupportModule from '../../../common/src/templates/initial-agents-dir/types/agent-definition-support' with { type: 'text' }
import * as agentModelsModule from '../../../common/src/templates/initial-agents-dir/types/agent-models' with { type: 'text' }
import * as toolParamsCoreModule from '../../../common/src/templates/initial-agents-dir/types/tool-params-core' with { type: 'text' }
import * as toolParamsDiscoveryModule from '../../../common/src/templates/initial-agents-dir/types/tool-params-discovery' with { type: 'text' }
import * as toolParamsResearchModule from '../../../common/src/templates/initial-agents-dir/types/tool-params-research' with { type: 'text' }
import * as toolsModule from '../../../common/src/templates/initial-agents-dir/types/tools' with { type: 'text' }
import * as utilTypesModule from '../../../common/src/templates/initial-agents-dir/types/util-types' with { type: 'text' }

/**
 * Read the raw text Bun's `type: 'text'` loader attaches as a text module's
 * `default` export. The namespace's own type is the resolved `.ts` module
 * (types only), so the callable shape of a text import has to be named here
 * once rather than suppressed at each of the eight import sites.
 */
function readTextModule(textModule: object): string {
  return (textModule as { default: string }).default
}

export const COMMON_TYPE_FILES: { fileName: string; source: string }[] = [
  {
    fileName: 'agent-definition.ts',
    source: readTextModule(agentDefinitionModule),
  },
  {
    fileName: 'agent-definition-support.ts',
    source: readTextModule(agentDefinitionSupportModule),
  },
  { fileName: 'agent-models.ts', source: readTextModule(agentModelsModule) },
  { fileName: 'tools.ts', source: readTextModule(toolsModule) },
  {
    fileName: 'tool-params-core.ts',
    source: readTextModule(toolParamsCoreModule),
  },
  {
    fileName: 'tool-params-discovery.ts',
    source: readTextModule(toolParamsDiscoveryModule),
  },
  {
    fileName: 'tool-params-research.ts',
    source: readTextModule(toolParamsResearchModule),
  },
  { fileName: 'util-types.ts', source: readTextModule(utilTypesModule) },
]
