/**
 * Package root barrel (FID-2026-0930-003): `package.json` exports `.` →
 * this file. The tool-facing surface is the runtime entry; the compiler and
 * testing harnesses stay explicit subpath exports (`./compiler`, `./testing`)
 * so a root import cannot drag the `typescript`-importing compiler into a
 * runtime consumer's graph.
 */
export * from './runtime.ts'
