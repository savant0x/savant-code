/**
 * Deterministic before-tool steering rules (FID-2026-1006-002 WP1) —
 * engine, config source, and gate behaviour.
 *
 * Pins the three claims the FID makes for this work package:
 *   1. a rule blocks a violation with a visible, actionable error;
 *   2. the audited escape hatch (`# steering-override: <id> — <reason>`)
 *      passes ONLY the rule it names, and is audited when it does;
 *   3. a malformed rule can never brick a session and can never silently
 *      disable a guard (it is dropped AND reported).
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { readProtocolConfig } from '@savant-code/common/util/protocol-config'
import { describe, expect, it } from 'bun:test'

import {
  createBaseParams,
  makeAgentTemplate,
  type ChunkRecord,
} from './tool-executor-gate-order-fixtures'
import { getOrCreateEnforcement } from '../echo/enforcement'
import { getSteeringRules } from '../steering/rules-source'
import { createSteeringGate } from '../tools/tool-executor/steering-rule-gate'
import {
  compileSteeringRules,
  evaluateSteeringRules,
  parseSteeringOverride,
  steeringTextSurface,
} from '../tools/tool-executor/steering-rules'

import type { GateContext } from '../tools/tool-executor/gate-context'
import type { SteeringOverrideAudit } from '../tools/tool-executor/steering-rule-gate'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { JSONValue } from '@savant-code/common/types/json'
import type { SteeringRuleSpec } from '@savant-code/common/types/steering'

const repoRoot = path.resolve(import.meta.dir, '../../../..')

const FORCE_PUSH: SteeringRuleSpec = {
  id: 'no-force-push-main',
  tool: '^run_terminal_command$',
  match: 'git\\s+push\\b[^#]*--force',
  reason: 'force-pushing main is forbidden',
}

function makeContext(params: {
  projectRoot: string
  toolName: ToolName
  input: Record<string, JSONValue>
  chunks: ChunkRecord[]
}) {
  const base = createBaseParams(
    params.projectRoot,
    params.chunks,
    makeAgentTemplate([params.toolName]),
  )
  const ctx: GateContext<ToolName> = {
    params: base,
    toolCall: {
      toolName: params.toolName,
      input: params.input,
    } as unknown as SavantCodeToolCall<ToolName>,
    toolCallId: 'call-1',
    toolName: params.toolName,
    logger: base.logger,
    onResponseChunk: base.onResponseChunk,
    executionPolicy: {
      allowCapabilityOverride: false,
      allowFsmOverride: false,
      allowSandboxOverride: false,
    },
    hookProjectRoot: params.projectRoot,
    enforcement: getOrCreateEnforcement(base.agentState),
    resolvedWritePath: undefined,
    writeLawChecks: [],
    effectiveInput: params.input,
  }
  return ctx
}

function runGate(params: {
  rules: readonly SteeringRuleSpec[]
  toolName: ToolName
  input: Record<string, JSONValue>
  overrides?: (record: SteeringOverrideAudit) => void
}) {
  const chunks: ChunkRecord[] = []
  const audits: SteeringOverrideAudit[] = []
  const ctx = makeContext({
    projectRoot: path.join(os.tmpdir(), 'steering-gate'),
    toolName: params.toolName,
    input: params.input,
    chunks,
  })
  const gate = createSteeringGate<ToolName>({
    logger: ctx.logger,
    onResponseChunk: ctx.onResponseChunk,
    getRules: () => params.rules,
    auditOverride: (record) => {
      audits.push(record)
      params.overrides?.(record)
    },
  })
  return { verdict: gate(ctx), chunks, audits }
}

describe('steering rules — engine', () => {
  it('joins the call text surface from every string input field', () => {
    expect(
      steeringTextSurface({ path: 'a.ts', content: 'x', n: 3 as never }),
    ).toBe('a.ts\nx')
    expect(steeringTextSurface(undefined)).toBe('')
  })

  it('parses the override marker, and refuses one with no reason', () => {
    expect(parseSteeringOverride('git push --force main')).toBeUndefined()
    expect(
      parseSteeringOverride(
        'git push -f main # steering-override: r1 — shipped hotfix',
      ),
    ).toEqual({ ruleId: 'r1', reason: 'shipped hotfix' })
    expect(
      parseSteeringOverride('git push -f main # steering-override: r1 — '),
    ).toBeUndefined()
  })

  it('drops an invalid regex and reports it, instead of throwing', () => {
    const { rules, errors } = compileSteeringRules([
      FORCE_PUSH,
      { ...FORCE_PUSH, id: 'broken', match: 'git (push' },
    ])
    expect(rules.map((rule) => rule.id)).toEqual(['no-force-push-main'])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('broken')
  })

  it('honors requires/unless conjunctions', () => {
    const { rules } = compileSteeringRules([
      {
        id: 'aws-requires-profile',
        tool: '^run_terminal_command$',
        match: '\\baws\\b',
        requires: ['\\baws\\b'],
        unless: ['AWS_PROFILE'],
        reason: 'aws calls must name a profile',
      },
    ])
    const fire = (text: string) =>
      evaluateSteeringRules(rules, { toolName: 'run_terminal_command', text })
        .kind
    expect(fire('aws s3 ls')).toBe('block')
    expect(fire('AWS_PROFILE=prod aws s3 ls')).toBe('allow')
    expect(fire('echo hi')).toBe('allow')
  })

  it('lets the first matching rule decide, so noOverride cannot be shadowed', () => {
    const { rules } = compileSteeringRules([
      { ...FORCE_PUSH, id: 'hard', noOverride: true },
      FORCE_PUSH,
    ])
    const decision = evaluateSteeringRules(rules, {
      toolName: 'run_terminal_command',
      text: 'git push --force main # steering-override: hard — please',
    })
    expect(decision.kind).toBe('block')
  })
})

describe('steering rules — gate', () => {
  it('blocks a violation with a visible error and halts dispatch', async () => {
    const { verdict, chunks, audits } = runGate({
      rules: [FORCE_PUSH],
      toolName: 'run_terminal_command',
      input: { command: 'git push --force origin main' },
    })
    await expect(await verdict).toEqual({ halt: true, status: 'failed' })
    expect(chunks.find((chunk) => chunk.type === 'error')?.message).toContain(
      '[Steering] BLOCKED run_terminal_command by rule "no-force-push-main"',
    )
    expect(audits).toEqual([])
  })

  it('passes an overridden call and audits the override', async () => {
    const { verdict, audits } = runGate({
      rules: [FORCE_PUSH],
      toolName: 'run_terminal_command',
      input: {
        command:
          'git push --force origin main # steering-override: no-force-push-main — operator-authorized history fix',
      },
    })
    await expect(await verdict).toEqual({ halt: false })
    expect(audits).toEqual([
      {
        ruleId: 'no-force-push-main',
        reason: 'operator-authorized history fix',
        toolName: 'run_terminal_command',
        agentId: 'gate-order-agent',
      },
    ])
  })

  it('does not honor a marker naming a different rule', async () => {
    const { verdict, audits } = runGate({
      rules: [FORCE_PUSH],
      toolName: 'run_terminal_command',
      input: {
        command:
          'git push --force main # steering-override: some-other-rule — nope',
      },
    })
    await expect(await verdict).toEqual({ halt: true, status: 'failed' })
    expect(audits).toEqual([])
  })

  it('is inert when no rules are configured (fail-safe, never fatal)', async () => {
    const { verdict, chunks } = runGate({
      rules: [],
      toolName: 'run_terminal_command',
      input: { command: 'git push --force origin main' },
    })
    await expect(await verdict).toEqual({ halt: false })
    expect(chunks).toEqual([])
  })
})

describe('steering rules — config source', () => {
  it('loads rules from a project protocol.config.yaml', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'steering-config-'))
    fs.writeFileSync(
      path.join(cwd, 'protocol.config.yaml'),
      [
        'steering:',
        '  - id: no-force-push-main',
        "    tool: '^run_terminal_command$'",
        "    match: 'git\\s+push\\s+--force'",
        '    reason: force push is forbidden',
        '    noOverride: true',
        '',
      ].join('\n'),
    )
    const rules = getSteeringRules(cwd, { refresh: true })
    expect(rules).toHaveLength(1)
    expect(rules[0]).toEqual({
      id: 'no-force-push-main',
      tool: '^run_terminal_command$',
      match: 'git\\s+push\\s+--force',
      reason: 'force push is forbidden',
      noOverride: true,
    })
    fs.rmSync(cwd, { recursive: true, force: true })
  })

  it('drops a rule missing a required field (fail-safe shape validation)', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'steering-config-'))
    fs.writeFileSync(
      path.join(cwd, 'protocol.config.yaml'),
      ['steering:', '  - id: incomplete', "    tool: 'x'", ''].join('\n'),
    )
    expect(getSteeringRules(cwd, { refresh: true })).toEqual([])
    fs.rmSync(cwd, { recursive: true, force: true })
  })

  it("the repository's own steering: block parses and every rule compiles", () => {
    const rules = readProtocolConfig(repoRoot).steering
    expect(rules.length).toBeGreaterThanOrEqual(3)
    expect(rules.map((rule) => rule.id)).toContain('no-force-push-main')
    const { rules: compiled, errors } = compileSteeringRules(rules)
    expect(errors).toEqual([])
    expect(compiled).toHaveLength(rules.length)
  })
})
