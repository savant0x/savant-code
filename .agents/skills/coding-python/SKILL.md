---
name: coding-python
description: Python naming conventions, type hints, import patterns, and quality overrides for ECHO Protocol.
---

# Python Coding Standards

<!-- Load this when protocol.config.yaml has language: "python" -->

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Classes | PascalCase | `UserProfile`, `GameState` |
| Functions | snake_case | `calculate_distance`, `spawn_unit` |
| Variables | snake_case | `player_count`, `is_valid` |
| Constants | UPPER_SNAKE_CASE | `MAX_PLAYERS`, `TILE_SIZE` |
| Modules | snake_case | `player_manager.py` |
| Packages | snake_case (no hyphens) | `game_engine/` |
| Private | leading underscore | `_internal_method` |
| Dunder | double underscore | `__init__`, `__repr__` |
| Type aliases | PascalCase | `PlayerId = str` |
| Enums | PascalCase (class) | `class TileType(Enum)` |

## Patterns

### Type Hints

- Use type hints on all public functions
- Use `from __future__ import annotations` for forward refs
- Prefer `list[int]` over `List[int]` (3.9+)
- Use `Optional[X]` or `X | None` for nullable
- Use Protocol for structural typing

### Error Handling

- Define custom exception hierarchy
- Use specific exceptions, never bare `except:`
- Use context managers for resource cleanup
- Log exceptions with traceback at catch points

### Imports

- Group: stdlib → third-party → local
- One blank line between groups
- Prefer absolute imports
- Use `__all__` to control public API

## File Structure

```text
src/
├── __init__.py
├── __main__.py           # Entry point
├── config.py             # Configuration
├── exceptions.py         # Custom exceptions
├── types.py              # Type aliases and protocols
├── [module]/
│   ├── __init__.py
│   ├── models.py         # Data classes / Pydantic models
│   ├── service.py        # Business logic
│   └── tests/
│       ├── __init__.py
│       └── test_[module].py
```

## Anti-Patterns to Flag

- [ ] Bare `except:` without specific exception
- [ ] Mutable default arguments (`def f(x=[])`)
- [ ] `type: ignore` without justification
- [ ] Wildcard imports (`from x import *`)
- [ ] Global mutable state
- [ ] `print()` in production code (use `logging`)
- [ ] Magic numbers (extract to constants)
- [ ] God classes (>300 lines)
- [ ] Circular imports

## Quality Overrides

These override the defaults in `protocol.config.yaml` when Python is the configured language.

| Setting | Default | Python Override | Reason |
|---------|---------|-----------------|--------|
| `max_file_lines` | 300 | 400 | Python modules with dataclasses and type hints tend to be longer |
| `max_function_lines` | 50 | 50 | — |
| `max_line_length` | 100 | 120 | PEP 8 allows 120 for pragmatic readability |
