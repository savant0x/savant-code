// FID-2026-1012-017 (Loop 8): the SECOND half of the incomplete-arguments
// family — the provider-side rejection — pinned at the runtime seam where the
// steering is composed. Split out of `error-chunk-steering.test.ts` (which keeps
// the 0909-007 map/wrap pins) so both suites stay inside the 300-line ceiling,
// the same repair discipline the record's earlier loops applied to source.
//
// The measured shape (Loop 5, 2026-10-13T05:08Z): one response contributed 20
// rows, every one `errorClass: native-incomplete` carrying the SDK's rejection
// body — "the provider rejected the call's arguments and nothing observed
// indicates truncation. Correct the argument values…" — a provider finish reason
// of `tool-calls` (the response completed normally) and NO `argumentsTruncated`
// marker. The runtime then appended its payload steering on top: "Your read_files
// arguments were rejected because the file list is too large" — advice about a cut
// that was never observed, and the lever the model pulled again.
//
// Steering is now selected by the SAME discriminator the SDK's message uses
// (truncation evidence on the chunk): evidence present ⇒ the tool's size
// steering, an observed rejection ⇒ the correction steering. One cause, one
// wording, at both ends of the seam (Law 13), instead of the runtime asserting
// size unconditionally over a message that says the opposite.
import { describe, expect, it } from 'bun:test'

import {
  getTemplate,
  registerLoopAgentStepsPartFLifecycle,
} from '../../../__tests__/loop-agent-steps-part-f-test-harness'
import { handleStreamErrorChunk } from '../error-chunk'
import { buildNativeFailureInput } from '../native-failure-capture'

import type { Message } from '@savant-code/common/types/messages/savant-code-message'

function errorContentOf(message: Message | undefined): string {
  if (message === undefined) return ''
  return typeof message.content === 'string'
    ? message.content
    : JSON.stringify(message.content)
}

describe('provider-side rejection of the arguments (FID-2026-1012-017)', () => {
  registerLoopAgentStepsPartFLifecycle()

  const REJECTION_BODY =
    'Incomplete arguments for tool read_files: the provider rejected the ' +
    "call's arguments and nothing observed indicates truncation. Correct the " +
    'argument values so they satisfy the tool schema, then re-emit the call ' +
    'once. If the arguments are large, divide the work across calls instead ' +
    'of sending the same payload again.'

  it('(k) steers the rejection by cause instead of asserting a size problem', () => {
    const errorMessages: Message[] = []
    const result = handleStreamErrorChunk({
      chunk: {
        type: 'error',
        message: REJECTION_BODY,
        errorClass: 'native-incomplete',
        toolName: 'read_files',
        // The measured row: the provider finished the response normally, so
        // no output-cap cut and no structural truncation marker exist.
        finishReason: 'tool-calls',
      },
      errorMessages,
      loggerWarn: () => {},
      agentTemplate: { ...getTemplate(), toolNames: ['read_files'] },
      runId: 'test-run',
    })

    expect(result.hasNativeIncompleteToolCall).toBe(true)
    expect(result.lastIncompleteToolName).toBe('read_files')
    const content = errorContentOf(errorMessages[0])
    // The cause the SDK observed, and its corrective advice, survive intact.
    expect(content).toContain("the provider rejected the call's arguments")
    expect(content).toContain('Correct the argument values')
    // ...and no size lever is offered for a cut that was never observed.
    expect(content).not.toContain('read fewer files at a time')
    expect(content).not.toContain('file list is too large')
    expect(content).not.toContain('split the work into multiple smaller')
    expect(content).toContain(
      'No truncation was observed for this call, so a different payload size will not help',
    )
    // The capture class is the SDK's, unreclassified by the steering choice.
    const capture =
      result.captureChunk &&
      buildNativeFailureInput(result.captureChunk, 'session', '/project')
    expect(capture?.error_class).toBe('native-incomplete')
  })

  it('(l) keeps the tool size steering when the output cap cut the payload', () => {
    const errorMessages: Message[] = []
    handleStreamErrorChunk({
      chunk: {
        type: 'error',
        message:
          'Incomplete arguments for tool read_files: the output token limit ' +
          'was reached before the arguments finished.',
        errorClass: 'native-incomplete',
        toolName: 'read_files',
        // A cut the provider DID report: the size lever is the right one.
        finishReason: 'length',
      },
      errorMessages,
      loggerWarn: () => {},
      agentTemplate: { ...getTemplate(), toolNames: ['read_files'] },
      runId: 'test-run',
    })

    const content = errorContentOf(errorMessages[0])
    expect(content).toContain('read fewer files at a time')
    expect(content).not.toContain('No truncation was observed for this call')
  })

  it('(n) steers a readable schema failure by cause even with no finish reason', () => {
    const errorMessages: Message[] = []
    handleStreamErrorChunk({
      chunk: {
        type: 'error',
        message:
          'Incomplete arguments for tool suggest_followups: the provider ' +
          "rejected the call's arguments and nothing observed indicates " +
          'truncation. The arguments failed the tool schema at: ' +
          'followups[0].prompt — invalid_type (expected string). Correct the ' +
          'argument values so they satisfy the tool schema, then re-emit the ' +
          'call once.',
        errorClass: 'native-incomplete',
        toolName: 'suggest_followups',
        // The vendor-SDK path has no finish reason to offer; the classifier's
        // readable schema failure is the evidence of a rejection.
        schemaIssue: 'followups[0].prompt — invalid_type (expected string)',
      },
      errorMessages,
      loggerWarn: () => {},
      agentTemplate: {
        ...getTemplate(),
        toolNames: [...getTemplate().toolNames, 'suggest_followups'],
      },
      runId: 'test-run',
    })

    const content = errorContentOf(errorMessages[0])
    // The field the model must fix survives, and no size advice is appended.
    expect(content).toContain('followups[0].prompt')
    expect(content).not.toContain('split the work into multiple smaller')
    expect(content).not.toContain('If the tool call arguments are large')
    expect(content).toContain(
      'No truncation was observed for this call, so a different payload size will not help',
    )
  })

  it('(m) steers an unmapped tool by cause, not with the generic size fallback', () => {
    const errorMessages: Message[] = []
    handleStreamErrorChunk({
      chunk: {
        type: 'error',
        message: REJECTION_BODY.replaceAll('read_files', 'code_search'),
        errorClass: 'native-incomplete',
        toolName: 'code_search',
        finishReason: 'tool-calls',
      },
      errorMessages,
      loggerWarn: () => {},
      agentTemplate: {
        ...getTemplate(),
        toolNames: [...getTemplate().toolNames, 'code_search'],
      },
      runId: 'test-run',
    })

    const content = errorContentOf(errorMessages[0])
    expect(content).not.toContain('split the work into multiple smaller')
    expect(content).not.toContain('If the tool call arguments are large')
    expect(content).toContain(
      'No truncation was observed for this call, so a different payload size will not help',
    )
  })
})
