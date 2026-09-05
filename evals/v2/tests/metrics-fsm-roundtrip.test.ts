import { describe, expect, it } from 'bun:test'

import { makeTask } from './metrics-fsm-fixtures'
import { taskDefinitionSchema } from '../src/schema'

// FID-2026-0819-005 Loop 163: schema round-trip suite split verbatim from
// metrics-fsm.test.ts (makeTask via the shared fixtures module).

describe('additive schema round-trip (FID-2026-0824-014)', () => {
  it('parses a task carrying trajectory_assertions without bumping schema_version', () => {
    const candidate = {
      ...makeTask([
        {
          agent_type: 'forge',
          denied_tools: ['run_terminal_command'],
          required_tools: ['write_file'],
        },
      ]),
    }

    // zod enforces minItems 1 on deterministic_checks at parse time — makeTask's
    // empty array satisfies the TS type but not the schema.
    const parseCandidate = {
      ...candidate,
      validation: {
        ...candidate.validation,
        deterministic_checks: [{ command: 'echo ok' }],
      },
    }

    const parsed = taskDefinitionSchema.safeParse(parseCandidate)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(
        parsed.data.validation.trajectory_assertions?.[0]?.agent_type,
      ).toBe('forge')
      expect(parsed.data.schema_version).toBe('2.0')
    }
  })

  it('rejects assertion entries without agent_type', () => {
    const candidate = {
      ...makeTask([{ agent_type: '', denied_tools: [], required_tools: [] }]),
    }

    const parsed = taskDefinitionSchema.safeParse(candidate)
    expect(parsed.success).toBe(false)
  })

  it('keeps pre-existing tasks parsing unchanged (back-compat boundary)', () => {
    const legacy = makeTask([])
    const { trajectory_assertions: _omitted, ...validationWithoutChannel } =
      legacy.validation

    const parsed = taskDefinitionSchema.safeParse({
      ...legacy,
      validation: {
        ...validationWithoutChannel,
        deterministic_checks: [{ command: 'echo ok' }],
      },
    })
    expect(parsed.success).toBe(true)
  })
})
