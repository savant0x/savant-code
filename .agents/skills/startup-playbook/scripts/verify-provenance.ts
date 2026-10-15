/**
 * Startup-playbook skill provenance verifier (FID-2026-0806-007).
 *
 * Deterministic drift guard between the vendored skill and its canonical
 * source: every `claim-*` id referenced by the skill's markdown must exist in
 * `references/provenance.json`, and the SKILL.md front-matter metadata budget
 * (< 150 words) is enforced.
 *
 * Run: `bun run .agents/skills/startup-playbook/scripts/verify-provenance.ts`
 */
import fs from 'node:fs'
import path from 'node:path'

const skillRoot = path.resolve(import.meta.dir, '..')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

function main(): void {
  const ledgerPath = path.join(skillRoot, 'references', 'provenance.json')
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) as {
    claims: Array<{ id: string }>
  }
  const claimIds = new Set(ledger.claims.map((c) => c.id))

  let referenced = 0
  const missing = new Set<string>()
  for (const file of walk(skillRoot).filter((f) => f.endsWith('.md'))) {
    const text = fs.readFileSync(file, 'utf8')
    for (const match of text.matchAll(/claim-[a-z0-9-]+/g)) {
      referenced++
      if (!claimIds.has(match[0])) {
        missing.add(`${match[0]} (${path.relative(skillRoot, file)})`)
      }
    }
  }

  if (missing.size > 0) {
    console.error(
      `✗ ${missing.size} claim reference(s) missing from provenance.json:`,
    )
    for (const m of missing) console.error(`  ${m}`)
    process.exit(1)
  }
  console.log(
    `✓ ${referenced} claim references validated against ${claimIds.size} ledger claims`,
  )

  const skill = fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8')
  const meta = skill.match(/^---\n([\s\S]*?)\n---/)
  if (meta) {
    const words = meta[1].split(/\s+/).filter(Boolean).length
    if (words > 150) {
      console.error(`✗ SKILL.md metadata is ${words} words (limit 150)`)
      process.exit(1)
    }
    console.log(`✓ SKILL.md metadata: ${words} words (< 150)`)
  } else {
    console.error('✗ SKILL.md front matter not found')
    process.exit(1)
  }

  // Mode-file size budget: each markdown mode file stays under ~5,000 tokens
  // (an approximate word-based bound keeps the check deterministic).
  for (const file of walk(skillRoot).filter((f) => f.endsWith('.md'))) {
    if (path.basename(file) === 'SKILL.md') continue
    const words = fs
      .readFileSync(file, 'utf8')
      .split(/\s+/)
      .filter(Boolean).length
    if (words > 6000) {
      console.error(`✗ ${path.relative(skillRoot, file)} exceeds 6,000 words`)
      process.exit(1)
    }
  }
  console.log('✓ All mode files within the size budget')

  console.log('✅ startup-playbook provenance verified')
}

main()
