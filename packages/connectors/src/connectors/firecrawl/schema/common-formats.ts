import { z } from 'zod'

export const zParser = z.union([
  z.literal('pdf'),
  z.object({
    type: z.literal('pdf'),
    mode: z
      .enum(['fast', 'auto', 'ocr'])
      .optional()
      .describe(
        "'fast': embedded text only. 'auto' (default): fast with OCR " +
          "fallback. 'ocr': force OCR on every page.",
      ),
    maxPages: z
      .number()
      .int()
      .min(1)
      .max(10_000)
      .optional()
      .describe('Cap the number of PDF pages parsed.'),
    pages: z
      .boolean()
      .optional()
      .describe(
        'Also return per-page markdown in `pages`. No additional cost.',
      ),
    blocks: z
      .boolean()
      .optional()
      .describe(
        'Also return per-page typed layout blocks. No additional cost.',
      ),
    pageMarkers: z
      .boolean()
      .optional()
      .describe('Annotate page breaks in the markdown. No additional cost.'),
  }),
])

/** OpenAPI `ScrapeOptions.actions` item — browser steps run before scraping. */
export const zAction = z.union([
  z
    .object({
      type: z.literal('wait'),
      milliseconds: z.number().int().min(1).optional(),
      selector: z.string().optional(),
    })
    .describe('Wait for a duration OR for an element — provide one.'),
  z.object({
    type: z.literal('screenshot'),
    fullPage: z.boolean().optional(),
    quality: z.number().int().min(1).max(100).optional(),
    viewport: z
      .object({
        width: z.number().int(),
        height: z.number().int(),
      })
      .optional(),
  }),
  z.object({
    type: z.literal('click'),
    selector: z.string(),
    all: z.boolean().optional(),
  }),
  z.object({ type: z.literal('write'), text: z.string() }),
  z.object({ type: z.literal('press'), key: z.string() }),
  z.object({
    type: z.literal('scroll'),
    direction: z.enum(['up', 'down']).optional(),
    selector: z.string().optional(),
  }),
  z.object({ type: z.literal('scrape') }),
  z.object({ type: z.literal('executeJavascript'), script: z.string() }),
  z.object({
    type: z.literal('pdf'),
    format: z
      .enum([
        'A0',
        'A1',
        'A2',
        'A3',
        'A4',
        'A5',
        'A6',
        'Letter',
        'Legal',
        'Tabloid',
        'Ledger',
      ])
      .optional(),
    landscape: z.boolean().optional(),
    scale: z.number().optional(),
  }),
])

/**
 * OpenAPI `Formats` item. The spec declares object variants only, but the API
 * accepts the bare string spelling for every option-less format (verified
 * live 2026-09-16: `formats: ["markdown"]` returns 200) and every official
 * example uses it — so the mirror is the honest superset of both spellings.
 *
 * Four variants carry a per-page LLM surcharge (`json`, `question`,
 * `highlights`, and the `audio` / `video` extractors); `usage.estimate` reads
 * this array directly, which is why no scalar flattening is needed.
 */
export const zScrapeFormat = z.union([
  z.enum([
    'markdown',
    'summary',
    'html',
    'rawHtml',
    'rawBase64',
    'links',
    'images',
    'screenshot',
    'branding',
    'product',
    'menu',
    'audio',
    'video',
  ]),
  z.object({
    type: z.enum([
      'markdown',
      'summary',
      'html',
      'rawHtml',
      'rawBase64',
      'links',
      'images',
      'branding',
      'product',
      'menu',
      'audio',
      'video',
    ]),
  }),
  z.object({
    type: z.literal('screenshot'),
    fullPage: z.boolean().optional(),
    quality: z.number().int().min(1).max(100).optional(),
    viewport: z
      .object({
        width: z.number().int(),
        height: z.number().int(),
      })
      .optional(),
  }),
  z.object({
    type: z.literal('json'),
    schema: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('JSON Schema the extracted object must conform to.'),
    prompt: z.string().optional().describe('What to extract from the page.'),
    checkPromptInjection: z
      .boolean()
      .optional()
      .describe(
        'Scan the page for prompt-injection attempts before extracting. ' +
          'Adds 4 credits when the check runs; a detection fails the ' +
          'request with 403 SCRAPE_PROMPT_INJECTION_DETECTED.',
      ),
  }),
  z
    .object({
      type: z.literal('changeTracking'),
      modes: z.array(z.enum(['git-diff', 'json'])).optional(),
      schema: z.record(z.string(), z.unknown()).optional(),
      prompt: z.string().optional(),
      tag: z.string().nullable().optional(),
    })
    .describe("Requires 'markdown' to also be in the formats array."),
  z.object({
    type: z.literal('question'),
    question: z
      .string()
      .max(10_000)
      .describe(
        'Natural-language question about the page; the answer lands in ' +
          "the response's `answer` field.",
      ),
  }),
  z.object({
    type: z.literal('highlights'),
    query: z
      .string()
      .max(10_000)
      .describe(
        'Source-text selection request; the selection lands in the ' +
          "response's `highlights` field.",
      ),
  }),
])

/**
 * OpenAPI `ScrapeOptions` — the per-page option set shared by `/scrape`,
 * `/batch/scrape` (top level), and `/crawl` + `/search` (nested under
 * `scrapeOptions`).
 */
