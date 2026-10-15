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

## Quality Overrides

These override the defaults in `protocol.config.yaml` when Go is the configured language.

| Setting | Default | Go Override | Reason |
|---------|---------|-------------|--------|
| `max_file_lines` | 300 | 350 | Go files with interfaces and tests can be slightly longer |
| `max_function_lines` | 50 | 50 | — |
| `max_line_length` | 100 | 120 | Go convention allows longer lines for readability |
