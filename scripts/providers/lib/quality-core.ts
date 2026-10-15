/**
 * FID-2026-0915-001 (W6) — the quality gauntlet core.
 *
 * A FIXED 8-prompt coding rubric (MQ3 ruling) run against ONE host with an
 * OPERATOR-supplied key: deterministic checks (exact match, JSON parse,
 * numeric answer, code-shape greps), per-prompt latency, one score line.
 * The runner is injectable — tests never touch the network; the CLI wrapper
 * (`quality-gauntlet.ts`) supplies the real fetch-based runner.
 *
 * Key handling: the operator's key is read from the environment at
 * invocation, used ONLY in request headers, NEVER written to any file and
 * NEVER logged (pinned). Results land in `quality.json` (gitignored, MQ4
 * posture) so the report can render a Quality section.
 *
 * The gauntlet is NEVER scheduled and NOT a merge gate — operator-run by
 * design; it costs the operator's own quota.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** MQ3 ruling: exactly 8 fixed prompts. */
export const GAUNTLET_PROMPT_COUNT = 8

/** One rubric prompt: the question, its deterministic check, and the label. */
type RubricPrompt = {
  label: string
  prompt: string
  check: (answer: string) => boolean
}

/** The fixed rubric — deliberately basic: operational quality, not a benchmark. */
const RUBRIC: RubricPrompt[] = [
  {
    label: 'exact-string',
    prompt: 'Reply with exactly this string and nothing else: PONG-42',
    check: (a) => a.trim() === 'PONG-42',
  },
  {
    label: 'json-shape',
    prompt:
      'Reply with ONLY a JSON object: {"ok": true} — no markdown, no code fence.',
    check: (a) => {
      try {
        return (JSON.parse(a.trim()) as Record<string, unknown>)['ok'] === true
      } catch {
        return false
      }
    },
  },
  {
    label: 'arithmetic',
    prompt: 'What is 17 * 23? Reply with the number only.',
    check: (a) => a.trim() === '391',
  },
  {
    label: 'code-compile-shape',
    prompt:
      'Write a JavaScript function `add(a, b)` that returns the sum. Code only.',
    check: (a) => /function\s+add\s*\(/.test(a) && /\+/.test(a),
  },
  {
    label: 'reduce-shape',
    prompt:
      'Sum an array `nums` using reduce in one line of JavaScript. Code only.',
    check: (a) => /reduce/i.test(a),
  },
  {
    label: 'sorted-output',
    prompt:
      'Sort these numbers ascending and reply comma-separated only: 3, 1, 5, 2, 4',
    check: (a) => a.replace(/\s/g, '') === '1,2,3,4,5',
  },
  {
    label: 'increment-shape',
    prompt:
      'JavaScript: increment the variable `count` by 1. One statement only.',
    check: (a) => /count\s*(\+=\s*1|=\s*count\s*\+\s*1|\+\+)/.test(a),
  },
  {
    label: 'factual-short',
    prompt: 'Capital of France? One word only.',
    check: (a) => /^paris[.!]?$/i.test(a.trim()),
  },
]

export type GauntletResult = {
  prompt: string
  passed: boolean
  latencyMs: number
  answer: string
}

export type GauntletSummary = {
  score: number
  total: number
  avgLatencyMs: number
  rows: GauntletResult[]
}

/** Aggregate per-prompt results into the score/latency summary. */
export function scoreRuns(rows: GauntletResult[]): GauntletSummary {
  const score = rows.filter((r) => r.passed).length
  const avgLatencyMs =
    rows.length === 0
      ? 0
      : Math.round(rows.reduce((acc, r) => acc + r.latencyMs, 0) / rows.length)
  return { score, total: rows.length, avgLatencyMs, rows }
}

export type RunGauntletParams = {
  host: string
  /** Operator-supplied key — used in headers only, never persisted. */
  apiKey?: string
  /** Injectable runner (tests); the CLI wrapper supplies the real one. */
  runner: (prompt: string) => Promise<{ text: string; latencyMs: number }>
  /** Where quality.json lives (default dev/provider-candidates). */
  stateDir?: string
  /** Injectable clock for the run-date stamp. */
  nowIso?: string
}

/**
 * Run the gauntlet: check the key exists BEFORE any network call, run all
 * rubric prompts, score deterministically, merge into quality.json (one row
 * per host, latest run wins), and return the file path. Throws (before any
 * request) when no key is supplied — the operator must opt in explicitly.
 */
export async function runGauntlet(
  params: RunGauntletParams,
): Promise<GauntletSummary & { outPath: string }> {
  if (!params.apiKey || params.apiKey.trim() === '') {
    throw new Error(
      'Quality gauntlet requires an operator-supplied API key ' +
        '(set the provider key env var, e.g. <HOST>_API_KEY) — ' +
        'the gauntlet is operator-run by design, never scheduled.',
    )
  }
  const rows: GauntletResult[] = []
  for (const item of RUBRIC) {
    const { text, latencyMs } = await params.runner(item.prompt)
    rows.push({
      prompt: item.label,
      passed: item.check(text),
      latencyMs,
      // Store only pass/fail + label in the file; answers never persist.
      answer: '',
    })
  }
  const summary = scoreRuns(rows)

  const stateDir = params.stateDir ?? 'dev/provider-candidates'
  const qualityPath = join(stateDir, 'quality.json')
  const nowIso = params.nowIso ?? new Date().toISOString()
  let list: Array<{
    host: string
    score: string
    latencyMs: number
    runDate: string
  }> = []
  try {
    const parsed: unknown = JSON.parse(readFileSync(qualityPath, 'utf8'))
    if (Array.isArray(parsed)) list = parsed as typeof list
  } catch {
    // First run or corrupt file — start a fresh list.
  }
  const row = {
    host: params.host,
    score: `${summary.score}/${summary.total}`,
    latencyMs: summary.avgLatencyMs,
    runDate: nowIso.slice(0, 10),
  }
  const filtered = list.filter((r) => r.host !== params.host)
  filtered.push(row)
  writeFileSync(qualityPath, JSON.stringify(filtered, null, 2), 'utf8')
  return { ...summary, outPath: qualityPath }
}
