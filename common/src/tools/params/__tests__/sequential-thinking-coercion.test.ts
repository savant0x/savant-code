import { describe, expect, it } from 'bun:test'
import z from 'zod/v4'

import { sequentialThinkingParams } from '../tool/sequential-thinking'

import type { JSONSchema as JSONSchemaNamespace } from 'zod/v4/core'

type JSONSchema = JSONSchemaNamespace.JSONSchema

describe('sequentialthinking permissive coercion (FID-2026-0801-012)', () => {
  it('coerces stringified numbers for thoughtNumber/totalThoughts', () => {
    const result = sequentialThinkingParams.inputSchema.safeParse({
      thought: 'Step one',
      thoughtNumber: '1',
      totalThoughts: '5',
      nextThoughtNeeded: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.thoughtNumber).toBe(1)
      expect(result.data.totalThoughts).toBe(5)
    }
  })

  it('coerces stringified booleans for nextThoughtNeeded', () => {
    const result = sequentialThinkingParams.inputSchema.safeParse({
      thought: 'Step one',
      thoughtNumber: 1,
      totalThoughts: 3,
      nextThoughtNeeded: 'false',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.nextThoughtNeeded).toBe(false)
    }
  })

  it('coerces stringified booleans for optional flags', () => {
    const result = sequentialThinkingParams.inputSchema.safeParse({
      thought: 'Revising',
      thoughtNumber: 2,
      totalThoughts: 3,
      nextThoughtNeeded: 'true',
      isRevision: 'true',
      needsMoreThoughts: 'false',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.isRevision).toBe(true)
      expect(result.data.needsMoreThoughts).toBe(false)
    }
  })

  it('coerces stringified numbers for revision/branch pointers', () => {
    const result = sequentialThinkingParams.inputSchema.safeParse({
      thought: 'Branching',
      thoughtNumber: 3,
      totalThoughts: 4,
      nextThoughtNeeded: true,
      revisesThought: '1',
      branchFromThought: '2',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.revisesThought).toBe(1)
      expect(result.data.branchFromThought).toBe(2)
    }
  })

  it('still rejects non-numeric strings after coercion', () => {
    const result = sequentialThinkingParams.inputSchema.safeParse({
      thought: 'Bad',
      thoughtNumber: 'abc',
      totalThoughts: 3,
      nextThoughtNeeded: true,
    })
    expect(result.success).toBe(false)
  })

  it('still rejects unparseable booleans after coercion', () => {
    const result = sequentialThinkingParams.inputSchema.safeParse({
      thought: 'Bad',
      thoughtNumber: 1,
      totalThoughts: 3,
      nextThoughtNeeded: 'yes',
    })
    expect(result.success).toBe(false)
  })

  it('produces valid JSON schema for the tool definitions pipeline', () => {
    // ensureJsonSchemaCompatible in agent-runtime calls z.toJSONSchema with
    // io: 'input' — coercion must not break tool-definition serialization.
    const jsonSchema = z.toJSONSchema(sequentialThinkingParams.inputSchema, {
      io: 'input',
    }) as JSONSchema
    expect((jsonSchema as JSONSchema & { type?: unknown }).type).toBe('object')
  })
})
