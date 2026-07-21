/* eslint-disable no-console -- SDK example: intentional console output */
/**
 * Example: SDK Lint
 *
 * An AI-powered linter that finds issues in code.
 * Run with: bun run sdk/e2e/examples/sdk-lint.example.ts
 */

import { SavantCodeClient } from '../../src/client'

const CODE_TO_LINT = `
class Calculator {
  result = 0;
  
  add(n) {
    this.result += n;
  }
  
  divide(n) {
    this.result /= n; // Bug: division by zero not handled
  }
  
  getResult() {
    return this.result;
  }
}
`.trim()

async function main() {
  const apiKey = process.env.SAVANT_CODE_API_KEY
  if (!apiKey) {
    console.error('SAVANT_CODE_API_KEY environment variable is required')
    process.exit(1)
  }

  const client = new SavantCodeClient({ apiKey })

  console.log('🔎 Linting code...\n')
  console.log('Code:')
  console.log('```')
  console.log(CODE_TO_LINT)
  console.log('```\n')
  console.log('Lint results:\n')

  const result = await client.run({
    agent: 'savant-code/savant@latest',
    prompt: `Act as a linter. Find issues in this code and provide specific feedback:\n\n${CODE_TO_LINT}`,
    handleStreamChunk: (chunk) => {
      if (typeof chunk === 'string') {
        process.stdout.write(chunk)
      }
    },
  })

  console.log('\n')

  if (result.output.type === 'error') {
    console.error('Error:', result.output.message)
    process.exit(1)
  }

  console.log('✅ Linting complete!')
}

main().catch(console.error)
