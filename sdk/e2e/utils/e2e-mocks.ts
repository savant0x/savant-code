// FID-2026-0819-005 Loop 273: pure mock-behavior helpers and the mock
// prompt fns extracted to e2e-mocks/mock-behavior.ts and
// e2e-mocks/mock-prompt-fns.ts. This module keeps the mock credentials,
// the mock agent-template builder, and the spy installer that wires the
// mocks over the real LLM module.
// FID-2026-0929-005 (gut the backend): the database-module mocks and the
// checkConnection spy are deleted — there is no database contract and no
// healthz method to mock anymore.
import { spyOn } from 'bun:test'

import {
  promptAiSdkMock,
  promptAiSdkStreamMock,
  promptAiSdkStructuredMock,
} from './e2e-mocks/mock-prompt-fns'
import * as llmModule from '../../src/impl/llm'

export {
  promptAiSdkMock,
  promptAiSdkStreamMock,
  promptAiSdkStructuredMock,
} from './e2e-mocks/mock-prompt-fns'

let mocksApplied = false

export function setupE2eMocks(): void {
  if (mocksApplied) {
    return
  }
  mocksApplied = true

  spyOn(llmModule, 'promptAiSdkStream').mockImplementation(
    promptAiSdkStreamMock,
  )
  spyOn(llmModule, 'promptAiSdk').mockImplementation(promptAiSdkMock)
  spyOn(llmModule, 'promptAiSdkStructured').mockImplementation(
    promptAiSdkStructuredMock as typeof llmModule.promptAiSdkStructured,
  )
}

/** Test isolation: clears the installed-mocks flag so a later test file can
 * install them again — process-lifetime state that `bun test` shares across
 * files (FID-2026-1007-002). */
export function resetE2eMocks(): void {
  mocksApplied = false
}
