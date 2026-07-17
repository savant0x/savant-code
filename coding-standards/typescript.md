# TypeScript Coding Standards

<!-- Load this when protocol.config.yaml has language: "typescript" -->

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Interfaces | PascalCase (no I prefix) | `UserProfile`, `GameState` |
| Types | PascalCase | `PlayerId`, `TileGrid` |
| Classes | PascalCase | `GameEngine`, `WorldManager` |
| Functions | camelCase | `calculateDistance`, `spawnUnit` |
| Variables | camelCase | `playerCount`, `isValid` |
| Constants | UPPER_SNAKE_CASE | `MAX_PLAYERS`, `TILE_SIZE` |
| Enums | PascalCase | `PlayerAction`, `TileType` |
| Enum members | PascalCase | `TileType.Grassland` |
| React Components | PascalCase | `GameBoard`, `PlayerCard` |
| Hooks | camelCase (use prefix) | `useGameState`, `usePlayer` |
| Files (components) | PascalCase.tsx | `GameBoard.tsx` |
| Files (utilities) | camelCase.ts | `calculateDistance.ts` |
| Files (types) | PascalCase.ts | `GameState.ts` |

## Patterns

### Type Safety

- Enable `strict: true` in tsconfig.json
- Prefer `interface` over `type` for object shapes
- Use `type` for unions, intersections, and computed types
- Never use `any` — use `unknown` and narrow with type guards
- Use branded types for IDs: `type PlayerId = string & { __brand: 'PlayerId' }`

### Error Handling

- Use Result pattern or typed error objects
- Never throw strings — throw Error instances
- Handle all promise rejections
- Use try/catch at boundaries only

### Imports

- Group: react → external → internal → relative
- One blank line between groups
- Prefer named exports over default exports
- Use path aliases (@/components, @/utils)

## File Structure

```text
src/
├── index.ts              # Entry point
├── types/                # Shared types
│   ├── index.ts          # Re-exports
│   └── [domain].ts       # Domain types
├── utils/                # Pure utility functions
├── components/           # React components
│   └── [ComponentName]/
│       ├── index.tsx
│       ├── [ComponentName].tsx
│       └── [ComponentName].test.tsx
├── hooks/                # Custom hooks
├── services/             # API and external services
└── constants/            # App-wide constants
```

## Anti-Patterns to Flag

- [ ] `any` type usage
- [ ] `@ts-ignore` or `@ts-expect-error` without justification
- [ ] Default exports (prefer named)
- [ ] Non-null assertion (`!`) without type guard
- [ ] `console.log` in production code (use structured logger)
- [ ] Magic numbers or strings (extract to constants)
- [ ] Component files over 200 lines
- [ ] Inline styles (use CSS modules or Tailwind)

## Quality Overrides

These override the defaults in `protocol.config.yaml` when TypeScript is the configured language.

| Setting | Default | TS Override | Reason |
|---------|---------|-------------|--------|
| `max_file_lines` | 300 | 400 | React components and service files tend to be longer |
| `max_function_lines` | 50 | 60 | Component render logic can be slightly longer |
| `max_line_length` | 100 | 100 | — |
