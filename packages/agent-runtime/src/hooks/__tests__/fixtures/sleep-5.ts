// FID-2026-0814-003 hook test fixture: sleeps 5s (timeout test).
await Bun.sleep(5_000)
process.exit(0)

export {}
