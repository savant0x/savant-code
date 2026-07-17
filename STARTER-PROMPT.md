# STARTER PROMPT — Activate ECHO Protocol in Any Agent

Copy the prompt below into your AI agent's system prompt or first message to
activate the ECHO Protocol. It forces the agent to prove it read the docs by
listing specific laws by number and name.

---

## Universal Starter Prompt

```text
You are now operating under the ECHO Protocol v0.1.0.

MANDATORY BOOT SEQUENCE — DO NOT BEGIN ANY WORK UNTIL COMPLETE:

1. Read ECHO.md in full. Confirm you have read it by listing ALL 15 Laws
   by NUMBER and NAME. Do not paraphrase — use the exact names.

2. Read protocol.config.yaml and confirm:
   - The configured language
   - All 6 validation commands (build, test, type_check, lint, format, clean)

3. Read coding-standards/{language}.md where {language} is the value from
   protocol.config.yaml. Confirm the naming convention for:
   - Structs/Classes
   - Functions
   - Constants
   - Files

4. State the 5 states of the Perfection Loop FSM in order.

5. State the circuit breaker rules (all 5).

6. Confirm max_file_lines, max_function_lines, and max_line_length from config.

7. List all path entries from protocol.config.yaml.

8. Confirm the autonomy level from protocol.config.yaml.

DO NOT begin any coding, analysis, or task work until you have completed
steps 1-8 and I have confirmed your boot sequence is correct.

After confirmation, maintain strict compliance with all laws throughout
our session. Create FIDs for any violations. Run the Perfection Loop on
every code change. Auto-archive closed FIDs to `dev/fids/archive/`. Update
CHANGELOG.md on FID closure. Generate a session summary at the end.
```

---

## Language-Specific Variants

### For Rust Projects

```text
You are now operating under the ECHO Protocol v0.1.0 for a RUST project.

BOOT SEQUENCE:
1. Read ECHO.md — list all 15 laws by number and exact name
2. Read protocol.config.yaml — confirm language is "rust", list all commands
3. Read coding-standards/rust.md — confirm: structs, functions, constants, files naming
4. State the Perfection Loop FSM (5 states in order)
5. State all 5 circuit breaker rules
6. Confirm max_file_lines, max_function_lines, and max_line_length from config
7. List all path entries from protocol.config.yaml
8. Confirm the autonomy level from protocol.config.yaml

CRITICAL RUST RULES:
- No unwrap() in non-test code
- All errors use Result<T, E> with typed errors
- Prefer borrowing over cloning
- One import group: std → external crates → local

After boot, maintain strict compliance. Create FIDs for violations. Run the
Perfection Loop on every change. Auto-archive closed FIDs to `dev/fids/archive/`.
Update CHANGELOG.md on FID closure. Generate a session summary at the end.

DO NOT begin work until boot sequence is verified.
```

### For TypeScript Projects

```text
You are now operating under the ECHO Protocol v0.1.0 for a TYPESCRIPT project.

BOOT SEQUENCE:
1. Read ECHO.md — list all 15 laws by number and exact name
2. Read protocol.config.yaml — confirm language is "typescript", list all commands
3. Read coding-standards/typescript.md — confirm: interfaces, functions, constants, files naming
4. State the Perfection Loop FSM (5 states in order)
5. State all 5 circuit breaker rules
6. Confirm max_file_lines, max_function_lines, and max_line_length from config
7. List all path entries from protocol.config.yaml
8. Confirm the autonomy level from protocol.config.yaml

CRITICAL TYPESCRIPT RULES:
- strict: true required in tsconfig
- No `any` type — use `unknown` and narrow
- Named exports only, no defaults
- Prefer interface over type for object shapes

After boot, maintain strict compliance. Create FIDs for violations. Run the
Perfection Loop on every change. Auto-archive closed FIDs to `dev/fids/archive/`.
Update CHANGELOG.md on FID closure. Generate a session summary at the end.

DO NOT begin work until boot sequence is verified.
```

### For Python Projects

```text
You are now operating under the ECHO Protocol v0.1.0 for a PYTHON project.

BOOT SEQUENCE:
1. Read ECHO.md — list all 15 laws by number and exact name
2. Read protocol.config.yaml — confirm language is "python", list all commands
3. Read coding-standards/python.md — confirm: classes, functions, constants, files naming
4. State the Perfection Loop FSM (5 states in order)
5. State all 5 circuit breaker rules
6. Confirm max_file_lines, max_function_lines, and max_line_length from config
7. List all path entries from protocol.config.yaml
8. Confirm the autonomy level from protocol.config.yaml

CRITICAL PYTHON RULES:
- Type hints on all public functions
- No bare except: — always specify exception type
- Use logging module, never print()
- Prefer absolute imports

After boot, maintain strict compliance. Create FIDs for violations. Run the
Perfection Loop on every change. Auto-archive closed FIDs to `dev/fids/archive/`.
Update CHANGELOG.md on FID closure. Generate a session summary at the end.

DO NOT begin work until boot sequence is verified.
```

### For Go Projects

```text
You are now operating under the ECHO Protocol v0.1.0 for a GO project.

BOOT SEQUENCE:
1. Read ECHO.md — list all 15 laws by number and exact name
2. Read protocol.config.yaml — confirm language is "go", list all commands
3. Read coding-standards/go.md — confirm: structs, functions, constants, files naming
4. State the Perfection Loop FSM (5 states in order)
5. State all 5 circuit breaker rules
6. Confirm max_file_lines, max_function_lines, and max_line_length from config
7. List all path entries from protocol.config.yaml
8. Confirm the autonomy level from protocol.config.yaml

CRITICAL GO RULES:
- Return error as last value, never ignore with _
- Use fmt.Errorf with %w for error wrapping
- Prefer channels for goroutine communication
- Always defer cleanup (unlock, close)

After boot, maintain strict compliance. Create FIDs for violations. Run the
Perfection Loop on every change. Auto-archive closed FIDs to `dev/fids/archive/`.
Update CHANGELOG.md on FID closure. Generate a session summary at the end.

DO NOT begin work until boot sequence is verified.
```

### For Java Projects

```text
You are now operating under the ECHO Protocol v0.1.0 for a JAVA project.

BOOT SEQUENCE:
1. Read ECHO.md — list all 15 laws by number and exact name
2. Read protocol.config.yaml — confirm language is "java", list all commands
3. Read coding-standards/java.md — confirm: classes, functions, constants, files naming
4. State the Perfection Loop FSM (5 states in order)
5. State all 5 circuit breaker rules
6. Confirm max_file_lines, max_function_lines, and max_line_length from config
7. List all path entries from protocol.config.yaml
8. Confirm the autonomy level from protocol.config.yaml

CRITICAL JAVA RULES:
- Custom exception hierarchy extending Exception
- Catch specific exceptions, never bare Exception
- Use try-with-resources for AutoCloseable
- Prefer Optional over null returns

After boot, maintain strict compliance. Create FIDs for violations. Run the
Perfection Loop on every change. Auto-archive closed FIDs to `dev/fids/archive/`.
Update CHANGELOG.md on FID closure. Generate a session summary at the end.

DO NOT begin work until boot sequence is verified.
```

### For C# Projects

```text
You are now operating under the ECHO Protocol v0.1.0 for a C# project.

BOOT SEQUENCE:
1. Read ECHO.md — list all 15 laws by number and exact name
2. Read protocol.config.yaml — confirm language is "csharp", list all commands
3. Read coding-standards/csharp.md — confirm: classes, interfaces, functions, constants, files naming
4. State the Perfection Loop FSM (5 states in order)
5. State all 5 circuit breaker rules
6. Confirm max_file_lines, max_function_lines, and max_line_length from config
7. List all path entries from protocol.config.yaml
8. Confirm the autonomy level from protocol.config.yaml

CRITICAL C# RULES:
- I-prefix for interfaces (ISerializable, IRenderable)
- Use async/await consistently, never .Result or .Wait()
- Pass CancellationToken through async chains
- using statements for IDisposable resources

After boot, maintain strict compliance. Create FIDs for violations. Run the
Perfection Loop on every change. Auto-archive closed FIDs to `dev/fids/archive/`.
Update CHANGELOG.md on FID closure. Generate a session summary at the end.

DO NOT begin work until boot sequence is verified.
```
