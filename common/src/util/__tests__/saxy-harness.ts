// Saxy XML Parser test family — shared harness.
// Sibling of the Loop 322 decomposition (saxy.test.ts and its themed
// siblings all import this helper).

import { Saxy } from '../saxy'

/**
 * Process XML and collect the emitted events (text / tagopen / tagclose).
 */
export const processXML = (
  xml: string,
  schema?: Record<string, string[]>,
  shouldParseEntities = true,
) => {
  const events: Array<{ type: string; data: any }> = []
  const parser = new Saxy(schema, shouldParseEntities)

  parser.on('text', (data) => events.push({ type: 'text', data }))
  parser.on('tagopen', (data) => events.push({ type: 'tagopen', data }))
  parser.on('tagclose', (data) => events.push({ type: 'tagclose', data }))

  parser.write(xml)
  parser.end()

  return events
}
