import fs from 'fs'
import path from 'path'

import { readStdin } from './utils/read-stdin'

/**
 * `--design-input <file|->` authoring path (FID-2026-0819-005 Loop 133):
 * validate + persist a custom design system, print machine-readable JSON,
 * and exit. Moved verbatim from the CLI entrypoint; every path terminates
 * the process.
 */
export async function handleDesignInput(designInput: string): Promise<void> {
  try {
    const source =
      designInput === '-'
        ? await readStdin()
        : await fs.promises.readFile(path.resolve(designInput), 'utf8')
    const parsed = JSON.parse(source) as unknown
    const { saveCustomDesignSystem, validateDesignInput } =
      await import('./utils/design-system-service')
    const validation = validateDesignInput(parsed)
    if (!validation.ok) {
      throw new Error(`${validation.code}: ${validation.message}`)
    }
    const result = saveCustomDesignSystem(
      parsed as Parameters<typeof saveCustomDesignSystem>[0],
    )
    // eslint-disable-next-line no-console -- machine-readable authoring result
    console.log(JSON.stringify({ ok: true, resource: result }))
    process.exit(0)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const code = message.startsWith('INTERACTIVE_INPUT_REQUIRED')
      ? 'INTERACTIVE_INPUT_REQUIRED'
      : 'DESIGN_INPUT_INVALID'
    // eslint-disable-next-line no-console -- machine-readable authoring error
    console.error(JSON.stringify({ ok: false, code, message }))
    process.exit(2)
  }
}
