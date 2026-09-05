// FID-2026-0819-005 Loop 163: shared makeTask fixture extracted verbatim
// from the original metrics-fsm.test.ts so both split suites build
// identical task definitions.
import type { TaskDefinition, TrajectoryAssertion } from '../src/schema'

export function makeTask(
  trajectoryAssertions: TrajectoryAssertion[] = [],
  expectedPhaseSequence?: string[],
): TaskDefinition {
  return {
    schema_version: '2.0',
    task_id: 'fsm-alignment-001',
    category: 'fsm_compliance',
    difficulty: 'medium',
    environment: { network_disabled: true },
    inputs: { prompt: 'governed run' },
    validation: {
      timeout_seconds: 60,
      deterministic_checks: [],
      trajectory_assertions: trajectoryAssertions,
      ...(expectedPhaseSequence
        ? {
            fsm_assertions: {
              strict_phase_order: true,
              allow_write_in_red: false,
              expected_phase_sequence: expectedPhaseSequence,
            },
          }
        : {}),
    },
  }
}
