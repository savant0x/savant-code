// FID-2026-0820-008 — stdin-close watchdog (primary cross-platform shutdown).
//
// Extracted from server-command.ts so lightweight consumers — and the
// integration test that boots a fresh Bun process — can import it without
// pulling the gateway import graph (that chain is CPU-contended under
// full-suite parallel load and was blowing the test's poll deadline).

/**
 * Install the stdin-close watchdog — the PRIMARY cross-platform shutdown path
 * (SIGTERM graceful termination is POSIX-only; Windows relies on this). When
 * the parent process dies its pipe closes and this process self-terminates.
 *
 * Armed only when stdin is a pipe we can read (never a TTY; and never when
 * stdin is already closed at startup — e.g. `</dev/null`, which would kill a
 * manually-started server instantly rather than detecting parent death).
 */
export function installStdinWatchdog(
  onExit: () => void = () => process.exit(0),
): void {
  const stdin = process.stdin
  if (stdin.isTTY) return
  if (stdin.readableEnded || stdin.destroyed) return

  const teardown = (): void => {
    stdin.removeListener('end', teardown)
    stdin.removeListener('close', teardown)
    stdin.removeListener('error', teardown)
    onExit()
  }
  stdin.on('end', teardown)
  stdin.on('close', teardown)
  stdin.on('error', teardown)
  // Resume so 'end'/'close' actually fire for a pipe we never read.
  stdin.resume()
}
