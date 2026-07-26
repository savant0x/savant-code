import path from 'path'

import { runBenchmark } from './run-benchmark'

async function main() {
  const saveTraces = process.argv.includes('--save-traces')

  await runBenchmark({
    evalDataPaths: [path.join(__dirname, 'eval-savant-code.json')],
    agents: ['savant'],
    taskIds: ['server-agent-validation'],
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
