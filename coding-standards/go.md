# Go Coding Standards

<!-- Load this when protocol.config.yaml has language: "go" -->

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Structs | PascalCase (exported), camelCase (unexported) | `UserProfile`, `userProfile` |
| Interfaces | PascalCase (er suffix preferred) | `Reader`, `Renderer` |
| Functions | PascalCase (exported), camelCase (unexported) | `CalculateDistance`, `calculateDistance` |
| Variables | camelCase | `playerCount`, `isValid` |
| Constants | PascalCase (exported), camelCase (unexported) | `MaxPlayers`, `maxRetries` |
| Packages | lowercase, single word | `playermanager`, `worldgen` |
| Files | snake_case | `player_manager.go`, `world_gen.go` |
| Receivers | short, 1-2 letter abbreviation | `(p *Player)`, `(s *Server)` |

## Patterns

### Error Handling

- Return `error` as the last return value
- Use `fmt.Errorf` with `%w` for error wrapping
- Check errors immediately, never ignore with `_`
- Define sentinel errors with `var ErrNotFound = errors.New("not found")`

### Concurrency

- Prefer channels for communication between goroutines
- Use `sync.Mutex` for protecting shared state
- Always use `defer` for unlock/cleanup
- Context propagation for cancellation

### Imports

- Group: stdlib → external → internal
- One blank line between groups
- Use `goimports` for automatic formatting

## File Structure

```text
cmd/
├── main.go              # Entry point
internal/
├── config.go            # Configuration
├── errors.go            # Error types
├── [module]/
│   ├── models.go        # Data structures
│   ├── service.go       # Business logic
│   └── service_test.go  # Tests
```

## Anti-Patterns to Flag

- [ ] Ignoring errors with `_`
- [ ] Goroutine leaks (no cancellation)
- [ ] Global mutable state
- [ ] `panic()` in library code
- [ ] Circular imports
- [ ] Naked returns in long functions

## Quality Limits

`protocol.config.yaml` owns the file-length ceiling, and `scripts/quality-report.ts`
enforces it against every project-owned source file: `max_file_lines` (400 today).
There is no per-language override mechanism — no Go-specific ceiling is enforced
anywhere — so the rows below are style guidance, not gates.

| Setting | Limit | Reason |
|---------|-------|--------|
| `max_file_lines` | 400 | One ceiling for every language; enforced by `bun run quality:report` |
| `max_function_lines` | 50 | — (advisory) |
| `max_line_length` | 120 | Go convention allows longer lines for readability — advisory |
