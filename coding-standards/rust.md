# Rust Coding Standards

<!-- Load this when protocol.config.yaml has language: "rust" -->

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Structs | PascalCase | `UserProfile`, `GameState` |
| Enums | PascalCase | `PlayerAction`, `TileType` |
| Enum variants | PascalCase | `TileType::Grassland` |
| Functions | snake_case | `calculate_distance`, `spawn_unit` |
| Variables | snake_case | `player_count`, `is_valid` |
| Constants | UPPER_SNAKE_CASE | `MAX_PLAYERS`, `TILE_SIZE` |
| Statics | UPPER_SNAKE_CASE | `GLOBAL_CONFIG` |
| Modules | snake_case | `player_manager`, `world_gen` |
| Files | snake_case.rs | `player_manager.rs`, `world_gen.rs` |
| Traits | PascalCase (noun/adjective) | `Serializable`, `Renderable` |
| Type aliases | PascalCase | `PlayerId`, `TileGrid` |
| Lifetimes | short lowercase | `'a`, `'ctx`, `'de` |

## Patterns

### Error Handling

- Use `Result<T, E>` for all fallible operations
- Never use `unwrap()` or `expect()` in non-test code — use `?` operator, `match`, or explicit error types
- `.expect("reason")` is acceptable only in tests, examples, and `main.rs` where panicking is the intended behavior
- Define project-specific error types using `thiserror`
- Use `anyhow` for application-level error propagation

### Ownership

- Prefer borrowing (`&T`) over cloning
- Use `Arc<Mutex<T>>` for shared mutable state
- Use `Rc<T>` for single-threaded shared ownership
- Document lifetime elision decisions in complex cases

### Imports

- Group: std → external crates → local modules
- One blank line between groups
- Prefer explicit imports over glob (`use module::*`)
- Re-export public types at module boundaries

## File Structure

```text
src/
├── main.rs          # Entry point only
├── lib.rs           # Public API surface
├── config.rs        # Configuration types
├── error.rs         # Error types
├── [module]/
│   ├── mod.rs       # Module re-exports
│   ├── types.rs     # Data structures
│   ├── logic.rs     # Business logic
│   └── tests.rs     # Unit tests (or inline)
```

## Anti-Patterns to Flag

- [ ] `unwrap()` in non-test code
- [ ] `clone()` without justification
- [ ] `unsafe` blocks without safety comments
- [ ] `Box<dyn Error>` instead of typed errors
- [ ] Dead code (unused functions/imports)
- [ ] `todo!()` or `unimplemented!()` without FID reference

## Quality Overrides

These override the defaults in `protocol.config.yaml` when Rust is the configured language.

| Setting | Default | Rust Override | Reason |
|---------|---------|---------------|--------|
| `max_file_lines` | 300 | 300 | — |
| `max_function_lines` | 50 | 50 | — |
| `max_line_length` | 100 | 100 | — |
