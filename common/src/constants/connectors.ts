/**
 * Connector meta-tool family (FID-2026-0930-003): the fixed-size surface over
 * the in-repo `@savant-code/connectors` catalog (launch: tinyfish, exa,
 * firecrawl). Four names, like composio — safety metadata is PER TOOL
 * (catalog reads `allow`, vendor egress `prompt`), which a single action-enum
 * tool could not express.
 */

export const CONNECTOR_TOOL_NAMES = [
  'connector_search',
  'connector_describe',
  'connector_invoke',
  'connector_credentials',
] as const

export type ConnectorMetaToolName = (typeof CONNECTOR_TOOL_NAMES)[number]

const CONNECTOR_TOOL_NAME_SET = new Set<string>(CONNECTOR_TOOL_NAMES)

export function isConnectorMetaToolName(
  toolName: string,
): toolName is ConnectorMetaToolName {
  return CONNECTOR_TOOL_NAME_SET.has(toolName)
}
