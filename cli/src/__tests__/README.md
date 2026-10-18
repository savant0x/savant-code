# CLI Testing

CLI unit, native-render and integration tests. Interactive terminal tests use tmux.

## Test Naming Convention

Use descriptive suite names:

- **Unit tests:** `*.test.ts` (e.g., `cli-args.test.ts`)
- **E2E tests:** `e2e-*.test.ts` (e.g., `e2e-cli.test.ts`)
- **Integration tests:** `integration-*.test.ts` (e.g., `integration-tmux.test.ts`)

Names do not activate a wrapper. Suites explicitly check their prerequisites
through `test-utils.ts` and use `describe.skipIf` where appropriate.

## Quick Start

```bash
cd cli
bun run test
```

## Prerequisites

### For Integration Tests

Install tmux for interactive CLI testing:

```bash
# macOS
brew install tmux

# Ubuntu/Debian
sudo apt-get install tmux

# Windows (via WSL)
wsl --install
sudo apt-get install tmux
```

### For E2E Tests

Build the SDK first:

```bash
cd sdk
bun run build
cd ../cli
```

## Running Tests

### All Tests

```bash
bun test
```

### Specific Test Suites

```bash
# Unit tests
bun test cli-args.test.ts

# E2E tests (requires SDK)
bun test e2e-cli.test.ts

# Integration tests (requires tmux)
bun test integration-tmux.test.ts
```

### Manual tmux POC

```bash
bun run test:tmux-poc
```

## Prerequisite Detection

`test-utils.ts` checks native tmux, then the WSL fallback, and verifies a
temporary session can start. It reports unavailable on CI. The tmux integration
suite skips when tmux or the SDK is unavailable; the E2E CLI suite checks SDK
artifacts separately. There is no project-wide `.bin/bun` wrapper.

`bun run test` applies the CLI package's `NODE_ENV=production` script. Run a
focused `bun test` filter from the CLI workspace; Bun filters are substrings,
so a repository-root filter can accidentally include local reference copies.

## Test Structure

### Unit Tests

Test individual functions in isolation:

```typescript
import { describe, test, expect } from 'bun:test'

describe('CLI Arguments', () => {
  test('parses --agent flag', () => {
    // Test implementation
  })
})
```

### Integration Tests (tmux)

Test interactive CLI with full terminal emulation:

```typescript
import { describe, test, expect } from 'bun:test'
import { isTmuxAvailable } from './test-utils'

const tmuxAvailable = isTmuxAvailable()

describe.skipIf(!tmuxAvailable)('CLI Integration Tests', () => {
  test('handles user input', async () => {
    // Create tmux session
    // Send commands
    // Verify output
  })
})
```

### E2E Tests

Test complete CLI workflows:

```typescript
import { describe, test, expect } from 'bun:test'
import { isSDKBuilt } from './test-utils'

const sdkBuilt = isSDKBuilt()

describe.skipIf(!sdkBuilt)('CLI E2E Tests', () => {
  test('runs --help command', async () => {
    // Test CLI behavior
  })
})
```

## Test Utilities

Shared utilities in `test-utils.ts`:

```typescript
import { isTmuxAvailable, isSDKBuilt, sleep } from './test-utils'

// Check for tmux
if (isTmuxAvailable()) {
  // Run tmux tests
}

// Check for SDK
if (isSDKBuilt()) {
  // Run E2E tests
}

// Async delay
await sleep(1000)
```

## tmux Testing

See the [tmux scripts guide](../../../scripts/tmux/README.md) for:

- Why standard `send-keys` doesn't work (must use bracketed paste mode)
- Helper functions for Bash and TypeScript
- Complete example scripts
- Debugging and troubleshooting tips

**Quick reference:**

```typescript
// ❌ Broken:
await tmux(['send-keys', '-t', session, 'hello'])

// ✅ Works:
await tmux(['send-keys', '-t', session, '-l', '\x1b[200~hello\x1b[201~'])
```

## Debugging Tests

### View Test Output

```bash
# Verbose test output
bun test --verbose

# Watch mode
bun test --watch
```

## Contributing

When adding new tests:

1. **Follow naming convention** (`*integration*.test.ts` or `*e2e*.test.ts`)
2. **Use test-utils.ts** for shared functionality
3. **Add graceful skipping** for missing dependencies
4. **Clean up resources** (tmux sessions, temp files)
5. **Document test purpose** clearly in test descriptions

## Troubleshooting

### tmux Not Found

```text
⚠️  tmux not found but required for integration/E2E tests
```

**Solution:** Install tmux (see Prerequisites above)

### SDK Not Built

```text
✓ Build SDK for E2E tests: cd sdk && bun run build [skip]
```

**Solution:** Build the SDK first (see Prerequisites above)

### Tests Hanging

- Check tmux session isn't waiting for input
- Ensure proper cleanup in `finally` blocks
- Use timeouts for tmux operations

### Session Already Exists

- Use unique session names (e.g., timestamp suffix)
- Clean up sessions in `beforeEach`/`afterEach`

## Timing

Use the actual Bun summary for timings. Native rendering, subprocess and tmux
tests have different costs; old whole-suite timing estimates are not a budget.

## CI/CD

The ordinary CI suite runs unit and native-render tests. The current tmux helper
returns unavailable on CI, so installing tmux alone does not enable interactive
integration tests there. Run live terminal checks in an interactive environment.

```yaml
# Run tests
- name: Run tests
  run: bun run --cwd=cli test
```
