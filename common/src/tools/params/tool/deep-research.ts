import z from 'zod/v4'

import { $getNativeToolCallExampleString, jsonToolResultSchema } from '../utils'

import type { $ToolParams } from '../../constants'

/**
 * FID-2026-0804-002: `deep_research` — a MECHANICAL executor on the Researcher
 * role (no second LLM; the harness model drives all cognition). The model
 * decomposes the question in its reasoning and supplies `queries[]`; the tool
 * runs each sub-query through the web-search facade, dedups by URL,
 * domain-scores sources, and returns structured findings/citations/gaps. The
 * model reads the findings, iterates with follow-up calls if needed, and
 * synthesizes the final report as its last message.
 *
 * Loop 3 reconciliation (R1): the draft RED MQ-6 depth preset (quick 3 /
 * standard 5 / thorough 10 sub-queries, 10K/25K/50K tokens) survives only as
 * the harness-side instruction preset for `research_depth` — decomposition
 * counts are model behavior, and token budgets were GAP-3'd as unenforceable.
 * The tool schema is the single source of truth: `research_depth` +
 * `max_sources`.
 */
const researchDepthParam = z
  .enum(['quick', 'standard', 'thorough'])
  .optional()
  .default('standard')
  .describe(
    `Research depth preset. 'quick' = fewest sub-queries / fastest; 'standard' = balanced (default); 'thorough' = most sub-queries and widest coverage. Bounds the number of sub-queries the model should decompose the question into (quick 3, standard 5, thorough 10) and the iteration budget (exhaustion returns truncated: true).`,
  )

const deepResearchInputSchema = z
  .object({
    question: z
      .string()
      .min(1)
      .describe(
        `The research question to investigate. Used as the anchor for dedup, domain scoring, and gap reporting.`,
      ),
    queries: z
      .array(z.string().min(1))
      .min(1)
      .max(12)
      .optional()
      .describe(
        `The sub-queries to execute — the model's own decomposition of the question (one aspect per query, 3-10 depending on research_depth). When omitted, the handler derives deterministic depth-based variants of the question as a fallback.`,
      ),
    research_depth: researchDepthParam,
    max_sources: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(10)
      .describe(
        `Maximum number of deduplicated source citations to return (highest domain score first). Default 10.`,
      ),
  })
  .describe(
    `Execute a multi-query web research pass mechanically: each sub-query is searched (capped concurrency, >=1s spacing, 30s timeout), results are deduplicated by URL, domain-scored, and returned as structured findings + citations + gaps for the model to synthesize. No LLM is called inside the tool.`,
  )

const deepResearchOutputSchema = jsonToolResultSchema(
  z.object({
    summary: z
      .string()
      .optional()
      .describe(
        `Absent for the mechanical tool — the model writes the report summary in its final message from findings.`,
      ),
    findings: z
      .array(
        z.object({
          url: z.string(),
          title: z.string().optional(),
          snippet: z.string().optional(),
          domain: z.string(),
          sourceScore: z.number(),
        }),
      )
      .describe(
        `Source-level evidence rows (one per deduplicated search hit). The model synthesizes claims from these and cites the URLs.`,
      ),
    citations: z
      .array(
        z.object({
          url: z.string(),
          domain: z.string(),
          score: z.number(),
        }),
      )
      .describe(
        `Citation list capped at max_sources, highest domain score first.`,
      ),
    gaps: z
      .array(z.string())
      .describe(
        `Aspects the research did not cover (queries that failed/timed out, or depth not reached) — the model decides follow-up queries.`,
      ),
    truncated: z
      .boolean()
      .describe(
        `true when the iteration/query budget was exhausted and only the strongest findings were returned first.`,
      ),
    incomplete: z
      .boolean()
      .describe(
        `true when at least one sub-query failed or timed out; partial results are still returned (never hard-fail, Law 14).`,
      ),
  }),
)

export const deepResearchParams = {
  toolName: 'deep_research',
  endsAgentStep: true,
  description: `
Purpose: Execute a multi-query web research pass mechanically and return structured findings the model synthesizes into a report. The tool NEVER calls a second LLM — the harness model decomposes the question (in its reasoning), passes sub-queries via \`queries[]\`, and reads the returned findings/citations to write the final answer.

Use cases:
- Multi-aspect research questions ("How does X compare to Y for Z?")
- Fact-finding with source citation requirements
- Iterative research: call again with follow-up queries when \`gaps\` or \`incomplete\` are set

Execution contract (adapter-enforced, deterministic code):
- Sub-queries run through the web-search facade: max 3 concurrent, >=1s spacing, 30s timeout per query
- Results deduplicated by URL; sources domain-scored (official docs 1.0, GitHub 0.9, Stack Overflow 0.8, dev.to 0.7, other 0.5)
- Citations capped at \`max_sources\` (default 10), highest score first
- Partial results always returned: failures/timeouts set \`incomplete: true\`; budget exhaustion sets \`truncated: true\` with strongest findings first

Example:
${$getNativeToolCallExampleString({
  toolName: 'deep_research',
  inputSchema: deepResearchInputSchema,
  input: {
    question: 'What are the tradeoffs of Bun vs Node.js for a CLI tool?',
    queries: [
      'Bun vs Node.js CLI tool performance',
      'Bun runtime stability 2026',
      'Node.js ecosystem advantages CLI',
    ],
    research_depth: 'standard',
    max_sources: 10,
  },
  endsAgentStep: true,
})}
`.trim(),
  inputSchema: deepResearchInputSchema,
  outputSchema: deepResearchOutputSchema,
} satisfies $ToolParams<'deep_research'>
