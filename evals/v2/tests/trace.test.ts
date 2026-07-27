import { describe, it, expect } from 'bun:test'
import { TraceCollector } from '../src/trace'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

describe('TraceCollector', () => {
  it('starts with an empty trace', () => {
    const collector = new TraceCollector('task-001', 'run-001')
    const trace = collector.finalize()
    expect(trace.task_id).toBe('task-001')
    expect(trace.run_id).toBe('run-001')
    expect(trace.events).toEqual([])
    expect(trace.current_phase).toBe('idle')
    expect(trace.metadata.final_phase).toBe('idle')
  })

  it('records print events', () => {
    const collector = new TraceCollector('task-001', 'run-001')
    collector.recordPrintEvent({ type: 'text', text: 'hello' })
    const trace = collector.finalize()
    expect(trace.events.length).toBe(1)
    expect(trace.events[0]).toEqual({
      type: 'print',
      raw: { type: 'text', text: 'hello' },
    })
    expect(trace.metadata.total_steps).toBe(1)
  })

  it('derives phase transitions from transition_phase tool calls', () => {
    const collector = new TraceCollector('task-001', 'run-001')
    collector.recordPrintEvent({
      type: 'tool_call',
      toolCallId: 'tc-1',
      toolName: 'transition_phase',
      input: { phase: 'red' },
    } as PrintModeEvent)

    const trace = collector.finalize()
    expect(trace.events.length).toBe(2)
    expect(trace.current_phase).toBe('red')
    expect(trace.metadata.phase_transition_count).toBe(1)
  })

  it('records stream chunks', () => {
    const collector = new TraceCollector('task-001', 'run-001')
    collector.recordStreamChunk({
      type: 'subagent_chunk',
      agentId: 'agent-1',
      agentType: 'forge',
      chunk: 'working...',
    })
    collector.recordStreamChunk({
      type: 'reasoning_chunk',
      agentId: 'agent-2',
      ancestorRunIds: [],
      chunk: 'because...',
    })

    const trace = collector.finalize()
    expect(trace.events.some((e) => e.type === 'subagent_chunk')).toBe(true)
    expect(trace.events.some((e) => e.type === 'reasoning_chunk')).toBe(true)
  })

  it('records faults', () => {
    const collector = new TraceCollector('task-001', 'run-001')
    collector.recordFault({
      type: 'tool_failure',
      message: 'boom',
      targetTool: 'write_file',
    })

    const trace = collector.finalize()
    expect(trace.events.some((e) => e.type === 'fault_injected')).toBe(true)
  })
})
