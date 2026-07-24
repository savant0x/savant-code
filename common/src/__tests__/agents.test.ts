import { describe, expect, it } from 'bun:test'
import { ECHO_PROTOCOL_INSTRUCTIONS } from '../constants/agents'

describe('ECHO_PROTOCOL_INSTRUCTIONS', () => {
  it('contains FID authoring rules', () => {
    expect(ECHO_PROTOCOL_INSTRUCTIONS).toContain('## FID Authoring Rules')
    expect(ECHO_PROTOCOL_INSTRUCTIONS).toContain('dev/fids/')
    expect(ECHO_PROTOCOL_INSTRUCTIONS).toContain('FID-YYYY-MMDD-NNN')
    expect(ECHO_PROTOCOL_INSTRUCTIONS).toContain('templates/FID-TEMPLATE.md')
    expect(ECHO_PROTOCOL_INSTRUCTIONS).toContain('Only the Recorder')
    expect(ECHO_PROTOCOL_INSTRUCTIONS).toContain(
      'created | analyzed | fixed | verified | closed',
    )
  })
})
