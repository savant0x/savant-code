// T62-followup(1) RED probe — commandcode live roster (keyless, read-only).
// Re-verifies the 2026-09-18 findings: fail-open boundary (keyless /models 200)
// + GLM case-drift vs static catalog.
//
// Moved out of the (gitignored) scratchpad into the typechecked scripts tree
// by FID-2026-1012-006 step 5, so the top-level `await` below needs module
// scope: this file has no imports of its own — hence the empty export
// (TS1375). Keep it.
export {}

const r = await fetch('https://api.commandcode.ai/provider/v1/models', {
  signal: AbortSignal.timeout(30_000),
})
console.log('keyless /models → HTTP', r.status)
const j = (await r.json()) as {
  data?: Array<{ id?: string }>
  models?: Array<{ id?: string }>
}
const raw = j.data ?? j.models ?? []
const ids = raw
  .map((m) => (typeof m === 'string' ? m : m.id))
  .filter((x): x is string => !!x)
console.log('roster count:', ids.length)
console.log('glm ids on live roster:')
for (const id of ids.filter((i) => /glm/i.test(i))) console.log('  ', id)
console.log('static catalog expectations:')
console.log(
  '   commandcode/zai-org/glm-5.2  and  commandcode/zai-org/glm-5.3  (lowercase)',
)
console.log('roster has zai-org/GLM-5.2:', ids.includes('zai-org/GLM-5.2'))
console.log('roster has zai-org/GLM-5.3:', ids.includes('zai-org/GLM-5.3'))
console.log('roster has zai-org/glm-5.2:', ids.includes('zai-org/glm-5.2'))
console.log('roster has zai-org/glm-5.3:', ids.includes('zai-org/glm-5.3'))
// kimi + qwen casing cross-check (context for the drift pattern)
for (const probe of [
  'moonshotai/Kimi-K3',
  'moonshotai/kimi-k3',
  'Qwen/Qwen3.8-Max',
  'qwen/qwen3.8-max',
  'deepseek/deepseek-v4-pro',
  'deepseek/DeepSeek-V4-Pro',
]) {
  console.log(`roster has ${probe}:`, ids.includes(probe))
}
