/* eslint-disable no-console -- example script: intentional console output */
import { SavantCodeClient } from '@savant-code/sdk'

async function main() {
  const client = new SavantCodeClient({
    // You need to pass in your own API key here.
    // Get one here: https://www.savant-code.com/api-keys
    apiKey: process.env.SAVANT_CODE_API_KEY,
    cwd: process.cwd(),
  })

  // First run
  const runState1 = await client.run({
    // The agent id. Any agent on the store (https://savant-code.com/store)
    agent: 'savant-code/base@0.0.16',
    prompt: 'Create a simple calculator class',
    handleEvent: (event) => {
      // All events that happen during the run: agent start/finish, tool calls/results, text responses, errors.
      console.log('SavantCode Event', JSON.stringify(event))
    },
  })

  // Continue the same session with a follow-up
  const _runOrError2 = await client.run({
    agent: 'savant-code/base@0.0.16',
    prompt: 'Add unit tests for the calculator',
    previousRun: runState1, // <-- this is where your next run differs from the previous run
    handleEvent: (event) => {
      console.log('SavantCode Event', JSON.stringify(event))
    },
  })
}

main()
