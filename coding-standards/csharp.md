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
- [ ] God classes (one class dominating a file near the 400-line ceiling)
- [ ] Magic numbers (extract to constants)
- [ ] `var` when type is not obvious from context

## Quality Limits

`protocol.config.yaml` owns the file-length ceiling, and `scripts/quality-report.ts`
enforces it against every project-owned source file: `max_file_lines` (400 today).
There is no per-language override mechanism — no C#-specific ceiling is enforced
anywhere — so the rows below are style guidance, not gates.

| Setting | Limit | Reason |
|---------|-------|--------|
| `max_file_lines` | 400 | One ceiling for every language; enforced by `bun run quality:report` |
| `max_function_lines` | 50 | — (advisory) |
| `max_line_length` | 120 | Standard C# convention — advisory |
