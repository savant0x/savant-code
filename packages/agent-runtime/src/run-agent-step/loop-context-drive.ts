// FID-2026-0819-005 Loop 272: drive-directive handling, extracted verbatim
// from loop-context.ts. The CLI serializes <drive-lock> / <drive-control>
// directives in the prompt; this module records the durable drive record on
// the agent state and strips interactive tools from the model-facing set.
import {
  DRIVE_STRIPPED_TOOL_NAMES,
  parseDriveControlDirective,
  parseDriveLockDirective,
} from '@savant-code/common/util/drive-directives'
import { generateCompactId } from '@savant-code/common/util/string'

import { filterToolSet } from '../tools/filter-tool-set'

import type { LoopAgentStepsParams } from './types'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { ToolSet } from 'ai'

/**
 * Apply <drive-lock> and <drive-control> directives from the prompt to the
 * agent state (verbatim from createLoopContext). Returns the effective tool
 * set: the input set minus the interactive tools when a drive locks.
 */
export function applyDriveDirectives(
  loopParams: LoopAgentStepsParams,
  initialAgentState: AgentState,
  tools: ToolSet,
): ToolSet {
  // FID-2026-0818-002: drive-mode lock. The CLI serializes a `<drive-lock>`
  // directive only after the operator Confirms the pre-build plan (Law 2).
  // Parsing it here records the durable drive record and strips the
  // interactive tools (ask_user / suggest_followups / end_turn) from the
  // model-facing set for the rest of the run — the drive then proceeds to
  // completion without asking again. Idempotent: never overwrites an existing
  // drive record mid-run.
  const driveLock = loopParams.prompt
    ? parseDriveLockDirective(loopParams.prompt)
    : null
  const driveControl = loopParams.prompt
    ? parseDriveControlDirective(loopParams.prompt)
    : null
  let effectiveTools = tools
  if (driveLock && !initialAgentState.drive) {
    initialAgentState.drive = {
      driveId: driveLock.driveId ?? generateCompactId(),
      goal: driveLock.goal,
      ...(driveLock.planId ? { planId: driveLock.planId } : {}),
      acceptanceCriteria: driveLock.acceptanceCriteria,
      ...(driveLock.resolutionPolicy
        ? { resolutionPolicy: driveLock.resolutionPolicy }
        : {}),
      status: 'active',
      startedAt: Date.now(),
    }
    const stripped = new Set(DRIVE_STRIPPED_TOOL_NAMES)
    effectiveTools = filterToolSet(
      tools,
      Object.keys(tools).filter((name) => !stripped.has(name)),
    )
    loopParams.logger.info(
      { driveId: initialAgentState.drive.driveId },
      'Drive mode locked via <drive-lock> — interactive tools stripped',
    )
  }

  // FID-2026-0818-007: drive control surface. pause/stop/resume operate on the
  // durable drive record (operator control, never a confirmation). `stop` is
  // terminal and recorded; `resume` restarts a paused drive; a control with no
  // existing drive record is a no-op (fail closed).
  if (driveControl && initialAgentState.drive) {
    const drive = initialAgentState.drive
    if (driveControl.action === 'pause') {
      drive.status = 'paused'
      loopParams.logger.info(
        { driveId: drive.driveId },
        'Drive paused via <drive-control>',
      )
    } else if (driveControl.action === 'resume') {
      drive.status = 'active'
      loopParams.logger.info(
        { driveId: drive.driveId },
        'Drive resumed via <drive-control>',
      )
    } else if (driveControl.action === 'stop') {
      drive.status = 'blocked'
      loopParams.logger.info(
        {
          driveId: drive.driveId,
          reason: driveControl.reason ?? 'operator stop',
        },
        'Drive stopped via <drive-control> (terminal)',
      )
    }
  }

  return effectiveTools
}
