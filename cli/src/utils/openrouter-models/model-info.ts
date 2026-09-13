import type { OpenRouterModel } from './types'

/**
 * The markdown model-info block used in agent system prompts
 * (FID-2026-0913-002 split from lookup.ts — presentational formatting,
 * separate from the matching/resolution concerns that stay there).
 */

/** Infer a display provider from a model id like "openai/gpt-5". */
export function getProviderFromModelId(modelId: string): string {
  const [provider] = modelId.split('/')
  return provider ?? modelId
}

/**
 * Format a markdown block describing a model for injection into the agent
 * system prompt. Unknown fields are omitted. When no metadata is available,
 * a minimal fallback using the model id is produced.
 */
export function formatModelInfo(
  modelId: string,
  model?: OpenRouterModel,
  resolvedContextWindow?: number,
): string {
  if (!model) {
    return `# Model Information

You are running on **${modelId}**.

Full metadata unavailable; the model was not found in the cached OpenRouter catalog.`
  }

  const lines: string[] = []
  lines.push(`# Model Information`)
  lines.push(``)
  lines.push(`You are running on **${model.name}** (\`${model.id}\`).`)
  lines.push(``)
  const provider = model.provider ?? getProviderFromModelId(modelId)
  if (provider) {
    lines.push(`- **Provider:** ${provider}`)
  }
  if (model.description) {
    lines.push(`- **Description:** ${model.description}`)
  }
  const contextLength =
    typeof resolvedContextWindow === 'number'
      ? resolvedContextWindow
      : model.contextLength
  if (typeof contextLength === 'number') {
    lines.push(`- **Context window:** ${contextLength.toLocaleString()} tokens`)
  }
  if (typeof model.maxCompletionTokens === 'number') {
    lines.push(
      `- **Max completion tokens:** ${model.maxCompletionTokens.toLocaleString()}`,
    )
  }
  if (typeof model.promptPricePerToken === 'number') {
    lines.push(
      `- **Input price:** $${(model.promptPricePerToken * 1_000_000).toFixed(2)} per 1M tokens`,
    )
  }
  if (typeof model.completionPricePerToken === 'number') {
    lines.push(
      `- **Output price:** $${(model.completionPricePerToken * 1_000_000).toFixed(2)} per 1M tokens`,
    )
  }
  if (model.modality) {
    lines.push(`- **Modalities:** ${model.modality}`)
  }
  if (model.knowledgeCutoff) {
    lines.push(`- **Knowledge cutoff:** ${model.knowledgeCutoff}`)
  }
  if (model.tokenizer) {
    lines.push(`- **Tokenizer:** ${model.tokenizer}`)
  }
  if (model.instructType) {
    lines.push(`- **Instruct type:** ${model.instructType}`)
  }
  if (model.created) {
    lines.push(`- **Created:** ${model.created}`)
  }

  return lines.join('\n')
}
