import path from 'path'

import { runBenchmark } from './run-benchmark'

async function main() {
  const saveTraces = process.argv.includes('--save-traces')

  await runBenchmark({
    evalDataPaths: [path.join(__dirname, 'eval-codebuff.json')],
    agents: ['savant'],
    taskIds: ['filter-system-history'],
    saveTraces,
  })

  process.exit(0)
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('Error running benchmark:', error)
    process.exit(1)
  })
}
