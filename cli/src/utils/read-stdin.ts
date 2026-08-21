/**
 * FID-2026-0806-011: read all piped stdin (used as the headless prompt when
 * a script pipes into the CLI without a positional prompt). Never rejects —
 * a read failure resolves with whatever was captured. Moved verbatim from
 * the CLI entrypoint (FID-2026-0819-005 Loop 133).
 */
export function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    try {
      process.stdin.setEncoding('utf8')
      process.stdin.on('data', (chunk: string) => {
        data += chunk
      })
      process.stdin.on('end', () => resolve(data))
      process.stdin.on('error', () => resolve(data))
      process.stdin.resume()
    } catch {
      resolve(data)
    }
  })
}
