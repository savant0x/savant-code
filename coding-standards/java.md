# Java Coding Standards

<!-- Load this when protocol.config.yaml has language: "java" -->

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Classes | PascalCase | `UserProfile`, `GameState` |
| Interfaces | PascalCase | `Serializable`, `Renderable` |
| Methods | camelCase | `calculateDistance`, `spawnUnit` |
| Variables | camelCase | `playerCount`, `isValid` |
| Constants | UPPER_SNAKE_CASE | `MAX_PLAYERS`, `TILE_SIZE` |
| Enums | PascalCase (class), UPPER_SNAKE_CASE (values) | `TileType.GRASSLAND` |
| Packages | lowercase, reversed domain | `com.example.gameengine` |
| Files | PascalCase.java (match class name) | `UserProfile.java` |

## Patterns

### Error Handling

- Use custom exception hierarchy extending `Exception`
- Catch specific exceptions, never bare `Exception`
- Use try-with-resources for AutoCloseable
- Log at catch points with context

### Concurrency

- Prefer `ExecutorService` over raw threads
- Use `synchronized` or `ReentrantLock` for shared state
- Immutable objects preferred over synchronization
- Use `CompletableFuture` for async composition

### Imports

- Group: java → javax → external → internal
- No wildcard imports
- Use IDE auto-import management

## File Structure

```text
src/main/java/com/example/
├── Application.java         # Entry point
├── config/
│   └── AppConfig.java       # Configuration
├── exception/
│   └── AppException.java    # Custom exceptions
├── model/
│   └── [Domain].java        # Data classes
├── service/
│   └── [Domain]Service.java # Business logic
src/test/java/
└── [Mirror structure]
```

## Anti-Patterns to Flag

- [ ] Bare `catch (Exception e)`
- [ ] Mutable static fields
- [ ] God classes (>300 lines)
- [ ] Deep inheritance hierarchies (>3 levels)
- [ ] `null` returns instead of Optional
- [ ] Magic numbers (extract to constants)

## Quality Overrides

These override the defaults in `protocol.config.yaml` when Java is the configured language.

| Setting | Default | Java Override | Reason |
|---------|---------|---------------|--------|
| `max_file_lines` | 300 | 350 | Java boilerplate (imports, generics) adds lines |
| `max_function_lines` | 50 | 40 | Java methods should be shorter due to verbosity |
| `max_line_length` | 100 | 120 | Standard Java convention |
