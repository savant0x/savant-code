# SavantFree E2E Tests

End-to-end tests for the SavantFree CLI binary. Tests verify that the compiled binary works correctly by interacting with it via tmux.

## Architecture

Two testing approaches are supported:

### 1. Direct tmux tests (fast, deterministic)

Use the `SavantFreeModel` class to start the binary in tmux, send commands, capture output, and assert directly.

```typescript
import { describe, test, expect, afterEach } from 'bun:test'
import { SavantFreeModel, requireSavantFreeBinary } from '../utils'

describe('My Feature', () => {
  let session: SavantFreeModel | null = null

  afterEach(async () => {
    if (session) await session.stop()
    session = null
  })

  test('works correctly', async () => {
    const binary = requireSavantFreeBinary()
    session = await SavantFreeModel.start(binary)

    await session.send('/help')
    const output = await session.capture(2)

    expect(output).toContain('Shortcuts')
  }, 60_000)
})
```

### 2. SDK agent-driven tests (AI-powered verification)

Use the SavantCode SDK to run a testing agent that interacts with SavantFree via custom tmux tools. The agent reasons about the CLI output and verifies complex behaviors.

```typescript
import { describe, test, expect, afterEach } from 'bun:test'
import { SavantCodeClient } from '@savant-code/sdk'
import { savant-free$1 } from '../agent/savant-free-tester'
import { createSavantFreeTmuxTools, requireSavantFreeBinary } from '../utils'

describe('Agent Test', () => {
  let cleanup: (() => Promise<void>) | null = null

  afterEach(async () => {
    if (cleanup) await cleanup()
    cleanup = null
  })

  test('verifies startup', async () => {
    const apiKey = process.env.SAVANT_API_KEY
    if (!apiKey) return // Skip if no API key

    const binary = requireSavantFreeBinary()
    const tmuxTools = createSavantFreeTmuxTools(binary)
    cleanup = tmuxTools.cleanup

    const client = new SavantCodeClient({ apiKey })
    const result = await client.run({
      agent: savant-free$1.id,
      prompt: 'Start SavantFree and verify the branding is correct.',
      agentDefinitions: [savant-free$1],
      customToolDefinitions: tmuxTools.tools,
      handleEvent: () => {},
    })

    expect(result.output.type).not.toBe('error')
  }, 180_000)
})
```

## Prerequisites

- **tmux** must be installed: `brew install tmux` (macOS) or `sudo apt-get install tmux` (Ubuntu)
- **SavantFree binary** must be built: `bun savant-free/cli/build.ts 0.0.0-dev`
- **SDK built** (for agent tests): `cd sdk && bun run build`
- **SAVANT_API_KEY** (for agent tests only): Set this environment variable

## Running Tests

### Build the binary first

```bash
bun savant-free/cli/build.ts 0.0.0-dev
```

### Run all tests

```bash
bun test savant-free/e2e/tests/
```

### Run a specific test

```bash
bun test savant-free/e2e/tests/version.e2e.test.ts
bun test savant-free/e2e/tests/startup.e2e.test.ts
bun test savant-free/e2e/tests/help-command.e2e.test.ts
bun test savant-free/e2e/tests/agent-startup.e2e.test.ts
```

### Use a custom binary path

```bash
SAVANT_FREE_BINARY=/path/to/savant-free bun test savant-free/e2e/tests/
```

## Adding New Tests

1. Create a new file in `savant-free/e2e/tests/` with the naming convention `<feature>.e2e.test.ts`
2. Add the test name to `.github/workflows/savant-free-e2e.yml` matrix:

```yaml
matrix:
  test:
    - version
    - startup
    - help-command
    - agent-startup
    - your-new-test    # <-- add here
```

3. The test will automatically run in parallel with other tests in CI.

## CI Workflow

The `.github/workflows/savant-free-e2e.yml` workflow:

1. **Builds** the SavantFree binary once (linux-x64)
2. **Runs each test file in parallel** via GitHub Actions matrix strategy
3. **Uploads tmux session logs** on failure for debugging

Triggers:
- **Nightly** at 6:00 AM PT
- **Manual** via workflow_dispatch

## Utilities Reference

### `SavantFreeModel`

| Method | Description |
|--------|-------------|
| `SavantFreeModel.start(binaryPath)` | Start binary in tmux, returns session |
| `session.send(text)` | Send text input (presses Enter) |
| `session.sendKey(key)` | Send special key (e.g. `'C-c'`, `'Escape'`) |
| `session.capture(waitSec?)` | Capture terminal output |
| `session.captureLabeled(label, waitSec?)` | Capture and save to session logs |
| `session.waitForText(pattern, timeoutMs?)` | Poll until text appears |
| `session.stop()` | Stop session and clean up |

### `createSavantFreeTmuxTools(binaryPath)`

Creates SDK custom tools for agent-driven testing:
- `start_savant_free` - Launch the CLI
- `send_to_savant_free` - Send text input
- `capture_savant_free_output` - Capture terminal output
- `stop_savant_free` - Stop and clean up

### Helper functions

| Function | Description |
|----------|-------------|
| `requireSavantFreeBinary()` | Get binary path, throws if not found |
| `getSavantFreeBinaryPath()` | Get binary path (may not exist) |
