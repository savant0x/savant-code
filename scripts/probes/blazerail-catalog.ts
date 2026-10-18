/** Public catalog census only: never reads credentials or invokes inference. */
import { parseBlazerailModels } from '../../cli/src/utils/openrouter-models/blazerail'
import { catalogRows } from '../../cli/src/utils/openrouter-models/catalog-values'
import { deriveLiveCatalogUrl } from '../../common/src/providers/derive'
import { PROVIDER_REGISTRY } from '../../common/src/providers/registry'

const url = deriveLiveCatalogUrl(PROVIDER_REGISTRY, 'blazerail')
if (!url) throw new Error('BlazeRail catalog missing')
const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
if (!response.ok) throw new Error(`Public catalog HTTP ${response.status}`)
const body: unknown = await response.json()
const models = parseBlazerailModels(body)
console.log(
  JSON.stringify(
    {
      status: response.status,
      observedAt: new Date().toISOString(),
      rawRows: catalogRows(body).length,
      retainedRows: models.length,
      publishedWindows: models.filter(
        (model) => model.contextLength !== undefined,
      ).length,
      missingWindowIds: models
        .filter((model) => model.contextLength === undefined)
        .map((model) => model.id),
      freeRows: models.filter((model) => model.id.endsWith(':free')).length,
      inference: 'not attempted: operator instruction',
    },
    null,
    2,
  ),
)
