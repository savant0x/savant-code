// FID-2026-0814-003 hook test fixture: allow decision with exit 0.
process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { permissionDecision: 'allow' },
  }),
)
process.exit(0)
