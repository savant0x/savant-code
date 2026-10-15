# Savant-Code Benchmark v2

Deterministic-first, ECHO-native evaluation system for Savant-Code.

## Design

- **Deterministic-first:** tests, typechecks, builds, and lints are the primary signals.
- **ECHO-native:** secondary metrics capture FSM phase compliance, subagent delegation, and tool-permission respect.
- **Cross-platform:** temp-dir sandbox on Windows; Docker sandbox on Linux/macOS and CI.
- **Comparable:** unified `AgentRunner` interface for Savant SDK and external CLI agents.

## Directory Layout

```text
evals/v2/
├── src/
│   ├── schema.ts      # Zod schemas for task definitions
│   ├── registry.ts    # Task registry loader
│   ├── runner.ts      # AgentRunner interface and trace types
│   ├── sandbox.ts     # Sandbox interface
│   ├── runners/
│   │   └── savant.ts  # Savant SDK runner
│   └── sandboxes/
│       ├── tempdir.ts # Windows-compatible temp-dir sandbox
│       └── docker.ts  # Docker sandbox stub for Linux/CI
├── schema/
│   └── task.schema.json
├── tasks/
│   └── ...
├── golden/
│   └── ...
├── tests/
│   ├── schema.test.ts
│   └── registry.test.ts
└── README.md
```

## Task Schema

See `schema/task.schema.json`. A minimal task:

```yaml
schema_version: "2.0"
task_id: "savant-v2-auth-jwt-001"
category: "multi_agent_orchestration"
difficulty: "medium"
environment:
  setup_files:
    - "package.json"
    - "src"
  setup_script: "bun install"
inputs:
  prompt: "Migrate auth.ts to use the Jose library."
validation:
  timeout_seconds: 300
  deterministic_checks:
    - command: "bun run build"
      expected_exit_code: 0
```

## Usage

Load a task registry:

```typescript
import { loadTaskRegistry } from './src/registry'

const registry = await loadTaskRegistry('./tasks')
```

Run deterministic verification after an agent run:

```typescript
import { TempDirSandbox } from './src/sandboxes/tempdir'
import { DeterministicVerifier } from './src/verify'

const sandbox = new TempDirSandbox()
await sandbox.prepare()
const verifier = new DeterministicVerifier(sandbox)
const result = await verifier.verify(registry['savant-v2-test-001'])
// result.status === 'PASS' | 'FAIL' | 'FLAKY'
```

Apply a golden patch to a sandbox (useful for validating tasks or generating a baseline):

```typescript
import { applyGoldenPatch } from './src/golden'

await applyGoldenPatch(sandbox, './tasks/pure_coding/001/golden.patch')
```

Run a task with the Savant SDK runner:

```typescript
import { SavantAgentRunner } from './src/runners/savant'
import { TempDirSandbox } from './src/sandboxes/tempdir'
import { MetricAggregator } from './src/metrics'

const sandbox = new TempDirSandbox()
const runner = new SavantAgentRunner()
await runner.initialize({
  task: registry['savant-v2-test-001'],
  sandbox,
  apiKey: process.env.SAVANT_CODE_API_KEY,
})
const runState = await runner.executePrompt('Fix the bug in src/index.ts')
const trace = runner.collectTrace()
const metrics = MetricAggregator.aggregate(trace, registry['savant-v2-test-001'])
```

## CLI Usage

Run the full baseline:

```bash
cd evals
bun run harness:v2
```

Filter by category or difficulty:

```bash
cd evals
bun run v2/src/cli.ts --tasks-dir v2/tasks --output-dir v2/reports --mode baseline --category pure_coding
bun run v2/src/cli.ts --tasks-dir v2/tasks --output-dir v2/reports --mode baseline --difficulty medium
```

## Scripts

- `bun test` — run harness unit tests
- `bun run typecheck` — typecheck the workspace

## Task Files

Tasks can ship files in their own directory. The `environment.setup_files` list
specifies which files (or directories) should be copied from the task directory
into the sandbox before the setup script runs. This is the preferred way to seed
initial code, tests, or fixtures, because it avoids brittle shell escaping.

```yaml
environment:
  setup_files:
    - "add.js"
    - "add.test.js"
  setup_script: "bun add.test.js"
```

Relative paths are resolved against the task directory; paths that escape the
task directory are rejected.
