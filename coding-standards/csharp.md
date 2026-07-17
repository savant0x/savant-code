# C# Coding Standards

<!-- Load this when protocol.config.yaml has language: "csharp" -->

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Classes | PascalCase | `UserProfile`, `GameState` |
| Interfaces | PascalCase (I prefix) | `ISerializable`, `IRenderable` |
| Methods | PascalCase | `CalculateDistance`, `SpawnUnit` |
| Variables (public) | PascalCase | `PlayerCount`, `IsValid` |
| Variables (private) | camelCase | `playerCount`, `isValid` |
| Constants | PascalCase | `MaxPlayers`, `TileSize` |
| Static fields | s_ prefix (private), PascalCase (public) | `s_instance`, `Config` |
| Enums | PascalCase (type), PascalCase (values) | `TileType.Grassland` |
| Namespaces | PascalCase | `GameEngine.WorldGen` |
| Files | PascalCase.cs (match class name) | `UserProfile.cs` |

## Patterns

### Error Handling

- Use custom exception hierarchy extending `Exception`
- Catch specific exceptions, never bare `Exception`
- Use `IDisposable` with `using` statements
- Prefer `Result<T>` pattern over exceptions for expected failures

### Async/Await

- Use `async/await` consistently, avoid `.Result` or `.Wait()`
- Pass `CancellationToken` through async chains
- Use `ConfigureAwait(false)` in library code
- Avoid `async void` except for event handlers

### Imports

- Group: System → external → internal
- Use `using` directives at file top
- Prefer `using static` for utility methods

## File Structure

```text
src/
├── Program.cs               # Entry point
├── Config/
│   └── AppConfig.cs         # Configuration
├── Exceptions/
│   └── AppException.cs      # Custom exceptions
├── Models/
│   └── [Domain].cs          # Data classes
├── Services/
│   └── [Domain]Service.cs   # Business logic
tests/
└── [Mirror structure]
```

## Anti-Patterns to Flag

- [ ] `catch (Exception e)` without rethrow
- [ ] `async void` methods
- [ ] `.Result` or `.Wait()` on tasks
- [ ] Mutable static state
- [ ] God classes (>300 lines)
- [ ] Magic numbers (extract to constants)
- [ ] `var` when type is not obvious from context

## Quality Overrides

These override the defaults in `protocol.config.yaml` when C# is the configured language.

| Setting | Default | C# Override | Reason |
|---------|---------|-------------|--------|
| `max_file_lines` | 300 | 350 | C# properties and attributes add lines |
| `max_function_lines` | 50 | 50 | — |
| `max_line_length` | 100 | 120 | Standard C# convention |
