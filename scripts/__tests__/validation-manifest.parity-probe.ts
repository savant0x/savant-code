/**
 * Parity probe (FID-2026-0930-002 gate): asserts `packages/connectors` is
 * registered in ALL FOUR surfaces — root `workspaces`, the root `typecheck`
 * chain, the root `test` chain, and `VALIDATION_WORKSPACE_POLICY` — plus the
 * protocol.config.yaml mirror. Exit 0 clean, 1 with issues. Reads the files
 * directly; never invokes `validate:repository` (no FID-verification
 * re-entry, per the template's gate rule).
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dir, '..', '..')
const issues: string[] = []

const pkg = JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
) as {
  workspaces?: string[]
  scripts?: Record<string, string>
}

if (!pkg.workspaces?.includes('packages/connectors')) {
  issues.push('root package.json: workspaces missing "packages/connectors"')
}
const typecheck = pkg.scripts?.typecheck ?? ''
if (!typecheck.includes('bun run --cwd=packages/connectors typecheck')) {
  issues.push('root package.json: typecheck chain missing connectors leg')
}
const test = pkg.scripts?.test ?? ''
if (!test.includes('bun run --cwd=packages/connectors test')) {
  issues.push('root package.json: test chain missing connectors leg')
}

const gatesPath = path.join(root, 'scripts', 'validation-gates.ts')
const gates = fs.readFileSync(gatesPath, 'utf8')
if (!gates.includes("workspace: 'packages/connectors'")) {
  issues.push('scripts/validation-gates.ts: policy missing packages/connectors')
}

const protocolPath = path.join(root, 'protocol.config.yaml')
const protocol = fs.readFileSync(protocolPath, 'utf8')
if (!protocol.includes('--cwd=packages/connectors typecheck')) {
  issues.push('protocol.config.yaml: type_check mirror missing connectors leg')
}

if (issues.length > 0) {
  for (const issue of issues) console.error(`- ${issue}`)
  console.error(`parity-probe: FAIL (${issues.length} issue(s))`)
  process.exit(1)
}
console.log(
  'parity-probe: PASS — packages/connectors registered in all surfaces',
)
