import { describe, expect, test } from 'bun:test'

import { isTextBlock } from '../../types/chat'
import {
  markAgentComplete,
  markRunningAgentsAsCancelled,
} from '../block-operations/agent-lifecycle'
import { appendTextToAgentBlock } from '../block-operations/agent-updates'
import { appendTextToRootStream } from '../block-operations/root-stream'
import { finalizeThinkingBlocks } from '../block-operations/think-parsing'
import {
  createBatchedMessageUpdater,
  createMessageUpdater,
} from '../message-updater'

import type {
  AgentContentBlock,
  ContentBlock,
  ChatMessage,
} from '../../types/chat'

const AGENT: AgentContentBlock = {
  type: 'agent',
  agentId: 'audit',
  agentName: 'Verifier',
  agentType: 'verifier',
  content: '',
  status: 'running',
  blocks: [],
}
const SOURCE =
  '<think>Audit notes ▄▀</think>\nFAIL logo-sidebar-s.svg:15 — <rect x="0" /> ξ 🙂'

function projection(blocks: ContentBlock[]) {
  return blocks
    .filter(isTextBlock)
    .filter((block) => block.content)
    .map((block) => ({
      content: block.content,
      textType: block.textType,
      thinkingOpen: block.thinkingOpen,
    }))
}

function replay(chunks: string[]) {
  let root: ContentBlock[] = []
  let agents: ContentBlock[] = [AGENT]
  for (const text of chunks) {
    root = appendTextToRootStream(root, { type: 'text', text })
    agents = appendTextToAgentBlock(agents, 'audit', text)
  }
  const agent = agents[0]
  if (agent.type !== 'agent') throw new Error('Missing agent')
  return { root: projection(root), agent: projection(agent.blocks ?? []) }
}

describe('FID-2026-1010-002: shared thinking stream parser', () => {
  const expected: ReturnType<typeof projection> = [
    { content: 'Audit notes ▄▀', textType: 'reasoning', thinkingOpen: false },
    {
      content: '\nFAIL logo-sidebar-s.svg:15 — <rect x="0" /> ξ 🙂',
      textType: 'text',
      thinkingOpen: undefined,
    },
  ]

  test('whole input, every split position and individual characters produce the same root and agent display', () => {
    const deliveries = [
      [SOURCE],
      SOURCE.split(''),
      ['<think>', 'Audit notes ▄▀', '</think>', SOURCE.split('</think>')[1]],
    ]
    for (let split = 1; split < SOURCE.length; split++)
      deliveries.push([SOURCE.slice(0, split), SOURCE.slice(split)])
    for (const chunks of deliveries) {
      const { root, agent } = replay(chunks)
      expect(root).toEqual(expected)
      expect(agent).toEqual(expected)
    }
  })

  test('completion and cancellation close unfinished reasoning and discard an incomplete delimiter', () => {
    const streamed = appendTextToAgentBlock(
      [AGENT],
      'audit',
      '<think>Audit notes</think',
    )
    for (const result of [
      markAgentComplete(streamed, 'audit'),
      markRunningAgentsAsCancelled(streamed),
    ]) {
      const agent = result[0]
      if (agent.type !== 'agent') throw new Error('Missing agent')
      expect(projection(agent.blocks ?? [])).toEqual([
        { content: 'Audit notes', textType: 'reasoning', thinkingOpen: false },
      ])
      expect(agent.status).not.toBe('running')
    }
  })

  test('root completion and errors finalize tagged reasoning with either updater', () => {
    for (const batched of [false, true]) {
      for (const error of [false, true]) {
        let messages: ChatMessage[] = [
          {
            id: 'root',
            variant: 'ai',
            content: '',
            timestamp: 'now',
            blocks: appendTextToRootStream([], {
              type: 'text',
              text: '<think>Audit notes</think',
            }),
          },
        ]
        const factory = batched
          ? createBatchedMessageUpdater
          : createMessageUpdater
        const updater = factory('root', (update) => {
          messages = update(messages)
        })
        if (error) updater.setError('Cancelled')
        else updater.markComplete()
        expect(projection(messages[0].blocks ?? [])).toEqual([
          {
            content: 'Audit notes',
            textType: 'reasoning',
            thinkingOpen: false,
          },
        ])
      }
    }
  })

  test('ordinary XML, native reasoning and literal less-than signs retain their channels and content', () => {
    const xml = '<svg><rect x="0" y="15" /></svg> ▄▀ <'
    let blocks = appendTextToRootStream([], {
      type: 'reasoning',
      text: 'Native notes',
    })
    for (const text of xml.split(''))
      blocks = appendTextToRootStream(blocks, { type: 'text', text })
    expect(projection(finalizeThinkingBlocks(blocks))).toEqual([
      { content: 'Native notes', textType: 'reasoning', thinkingOpen: false },
      { content: xml, textType: 'text', thinkingOpen: undefined },
    ])
  })
})
