import { jcsCanonicalize } from '@savant-code/common/crypto/jcs'

import type { EnforcementState } from '../types'
import type { JSONValue } from '@savant-code/common/types/json'

const TEST_COMMAND =
  /\b(?:bun|npm|pnpm|yarn|cargo|go)\s+(?:(?:run|--cwd(?:=|\s+)\S+)\s+)*test\b|\b(?:vitest|jest|mocha|pytest)\b/i
const ZERO_TESTS =
  /\b0\s+pass(?:ing|ed)?\b|\bno\s+tests?\s+(?:found|matched|to\s+run|executed)\b|\bcollected\s+0\s+items\b|\[no\s+test\s+files\]|\b0\s+specs?,\s+0\s+failures?\b/i
const REAL_TESTS =
  /\b[1-9]\d*\s+(?:pass(?:ing|ed)?|tests?\s+passed)\b|\bok\s+\S+\s+\d+(?:\.\d+)?s\b/i

/** Explicit empty test runs earn no credit; silent static checks are valid. */
export function detectVacuousVerification(
  command: string,
  output: string,
): {
  vacuous: boolean
  reason?: string
} {
  if (!TEST_COMMAND.test(command) || REAL_TESTS.test(output))
    return { vacuous: false }
  const match = output.match(ZERO_TESTS)
  return match ? { vacuous: true, reason: match[0] } : { vacuous: false }
}

/** Track consecutive identical checks within one turn and write epoch. */
export function evaluateSettledStateCheck(params: {
  state: EnforcementState
  toolName: string
  input: JSONValue
}): { status: 'fresh' | 'warn' | 'block'; reason?: string } {
  const { state, toolName, input } = params
  if (!['run_readonly_command', 'code_search', 'glob'].includes(toolName)) {
    state.settledChecks.clear()
    return { status: 'fresh' }
  }
  const key = `${toolName}|${jcsCanonicalize(input)}`
  const previous = state.settledChecks.get(key)
  const repeatCount =
    previous?.writeCount === state.writeCount ? previous.repeatCount + 1 : 1
  state.settledChecks.clear()
  state.settledChecks.set(key, { writeCount: state.writeCount, repeatCount })
  if (repeatCount === 1) return { status: 'fresh' }
  return {
    status: repeatCount >= 3 ? 'block' : 'warn',
    reason: `Bridge crossed: worktree state (writeCount=${state.writeCount}) is unchanged since this exact ${toolName} check ran. Advance to the next step instead of re-proving settled state.`,
  }
}
