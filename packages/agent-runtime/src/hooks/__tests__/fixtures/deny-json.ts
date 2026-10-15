// FID-2026-0814-003 hook test fixture: JSON deny decision with exit 0.
process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      permissionDecision: 'deny',
      permissionDecisionReason: 'secrets/ is off-limits',
    },
  }),
)
process.exit(0)
