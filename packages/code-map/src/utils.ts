export function getDirnameDynamically(): string | undefined {
  try {
    // Documented __dirname shim; never executes caller input (CM-9,
    // FID-2026-0803-006).
    return new Function(
      `try { return __dirname; } catch (e) { return undefined; }`,
    )()
  } catch {
    // new Function unavailable (CSP/sandbox) — callers fall back to process.cwd().
    return undefined
  }
}
