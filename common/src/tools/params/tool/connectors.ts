import z from 'zod/v4'

import { jsonToolResultSchema } from '../utils'

import type { CONNECTOR_TOOL_NAMES } from '../../../constants/connectors'
import type { $ToolParams } from '../../constants'

/**
 * Connector meta-tool params (FID-2026-0930-003): the model browses the
 * in-repo catalog (`connector_search`), reads an endpoint's contract
 * (`connector_describe`), executes it through the engine
 * (`connector_invoke` — the only network/prompt entry), and checks which
 * vendor env key NAMES are present (`connector_credentials` — never values).
 *
 * `provider`/`endpoint` are the catalog's ids — exactly what
 * `connector_search` returns ("firecrawl", "firecrawl#scrape").
 */

const connectorCatalogOutput = jsonToolResultSchema(
  z.union([
    z.object({
      providers: z.array(
        z.object({
          name: z.string(),
          displayName: z.string(),
          summary: z.string(),
          endpointCount: z.number().int(),
        }),
      ),
    }),
    z.object({
      endpoints: z.array(
        z.object({
          id: z.string(),
          displayName: z.string(),
          summary: z.string(),
          categories: z.array(z.string()),
        }),
      ),
    }),
    z.object({ errorMessage: z.string() }),
  ]),
)

const connectorDescribeOutput = jsonToolResultSchema(
  z.union([
    // The endpoint doc IS the contract — returned as-is (catalog invariant).
    z.object({ endpoint: z.json() }),
    z.object({ errorMessage: z.string() }),
  ]),
)

const connectorInvokeOutput = jsonToolResultSchema(
  z.union([
    z.object({
      httpStatus: z.number().int(),
      output: z.json(),
      usage: z.json(),
      isProviderError: z.boolean(),
    }),
    z.object({ errorMessage: z.string() }),
  ]),
)

const connectorCredentialsOutput = jsonToolResultSchema(
  z.union([
    z.object({
      provider: z.string(),
      // NAMES + presence only — a credential VALUE never crosses this
      // boundary (Law 12: resolved values are never logged or echoed).
      credentials: z.array(
        z.object({
          field: z.string(),
          envVar: z.string(),
          aliasEnvVar: z.string().optional(),
          present: z.boolean(),
        }),
      ),
      ready: z.boolean(),
    }),
    z.object({ errorMessage: z.string() }),
  ]),
)

export const connectorMetaToolParams = {
  connector_search: {
    toolName: 'connector_search',
    endsAgentStep: true,
    description:
      'Browse the built-in connector catalog of third-party web APIs ' +
      '(launch: tinyfish, exa, firecrawl). Returns providers or endpoints ' +
      'matching the optional filters. Use connector_describe next for the ' +
      'exact contract of an endpoint you want to call.',
    inputSchema: z
      .object({
        provider: z
          .string()
          .optional()
          .describe('Filter endpoints to one provider, e.g. "firecrawl".'),
        category: z
          .string()
          .optional()
          .describe('Filter endpoints by category, e.g. "web-search".'),
        query: z
          .string()
          .optional()
          .describe(
            'Free-text filter over endpoint id/display name/summary. ' +
              'Omit every field to list all providers.',
          ),
      })
      .describe(
        'With no arguments, lists providers; with provider or category, ' +
          'lists the matching endpoints.',
      ),
    outputSchema: connectorCatalogOutput,
  },
  connector_describe: {
    toolName: 'connector_describe',
    endsAgentStep: true,
    description:
      'Get the full contract of one catalog endpoint — request shape, ' +
      'input schema (the exact `input` object connector_invoke expects), ' +
      'credential fields, and usage model. Always describe before the ' +
      'first invoke of an endpoint.',
    inputSchema: z
      .object({
        provider: z.string().min(1).describe('Provider id, e.g. "firecrawl".'),
        endpoint: z
          .string()
          .min(1)
          .describe(
            'Endpoint id as returned by connector_search, ' +
              'e.g. "firecrawl#scrape".',
          ),
      })
      .describe('Identifies one catalog endpoint.'),
    outputSchema: connectorDescribeOutput,
  },
  connector_invoke: {
    toolName: 'connector_invoke',
    endsAgentStep: true,
    description:
      'Execute a catalog endpoint against its vendor API. Credentials ' +
      'come from env vars named in connector_credentials/connector_describe ' +
      'and never appear in results. This call has network effect and may ' +
      'consume vendor credits — describe first, and prefer the smallest ' +
      'input that answers the question. mode "replay" serves recorded ' +
      'fixtures offline (test/integration path only).',
    inputSchema: z
      .object({
        provider: z.string().min(1).describe('Provider id, e.g. "firecrawl".'),
        endpoint: z
          .string()
          .min(1)
          .describe(
            'Endpoint id as returned by connector_search, ' +
              'e.g. "firecrawl#scrape".',
          ),
        input: z
          .record(z.string(), z.json())
          .describe(
            'The endpoint input object — the schema connector_describe ' +
              'returns under input.schema (body/queryParams/pathParams ' +
              'sections as the schema declares).',
          ),
        mode: z
          .enum(['live', 'replay'])
          .optional()
          .default('live')
          .describe(
            '"live" calls the vendor (default); "replay" serves the ' +
              'recorded fixture chain and requires the caller-supplied ' +
              'fixture source.',
          ),
      })
      .describe('One endpoint execution request.'),
    outputSchema: connectorInvokeOutput,
  },
  connector_credentials: {
    toolName: 'connector_credentials',
    endsAgentStep: true,
    description:
      'Report which environment variables a provider needs and whether ' +
      'they are currently SET. Names and presence only — credential ' +
      'values are never returned. Use it to explain a missing-credential ' +
      'error before retrying.',
    inputSchema: z
      .object({
        provider: z.string().min(1).describe('Provider id, e.g. "exa".'),
      })
      .describe('Identifies one catalog provider.'),
    outputSchema: connectorCredentialsOutput,
  },
} satisfies {
  [K in (typeof CONNECTOR_TOOL_NAMES)[number]]: $ToolParams<K>
}
