import fs from 'node:fs'
import path from 'node:path'

import {
  renderConsolidationInventory,
  reviewLearningConsolidation,
} from './learnings-consolidation'

if (import.meta.main) {
  const root = path.resolve(import.meta.dir, '..')
  const inventory = reviewLearningConsolidation(root)
  if (process.argv.includes('--write'))
    fs.writeFileSync(
      path.join(
        root,
        'docs/design/learnings-consolidation-inventory-2026-10-13.md',
      ),
      renderConsolidationInventory(inventory),
    )
  console.log(
    `learning consolidation: ${inventory.issues.length ? 'FAIL' : 'PASS'} (${inventory.entries.length} unique titles; ${inventory.proposals.length} exact proposals; ${inventory.digestCharacters} boot characters; zero mutation)`,
  )
  for (const issue of inventory.issues) console.error(issue)
  if (inventory.proposals.length)
    console.error(
      'Concrete supersession requires the recorded level-1 operator ruling.',
    )
  process.exitCode =
    inventory.issues.length || inventory.proposals.length ? 1 : 0
}
