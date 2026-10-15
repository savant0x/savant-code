/**
 * Minimal static file server for motion build verification.
 *
 * The savant-motion engine fetches video/sequence assets as blobs, which
 * `file://` origins block. The harness serves the build directory over
 * localhost instead. One truth: verify/index.ts embeds this — no separate
 * serve script exists.
 */
import { readFile } from 'node:fs/promises'
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'
import path from 'node:path'

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
}

export interface RunningServer {
  port: number
  close(): Promise<void>
}

function safeJoin(root: string, urlPath: string): string | undefined {
  const decoded = decodeURIComponent(urlPath.split('?')[0] ?? '/')
  const relative = decoded.replace(/^\/+/, '')
  const target = path.resolve(root, relative)
  const normalizedRoot = path.resolve(root)
  if (
    target !== normalizedRoot &&
    !target.startsWith(normalizedRoot + path.sep)
  )
    return undefined
  return target
}

async function respond(
  res: ServerResponse,
  root: string,
  req: IncomingMessage,
): Promise<void> {
  const target = safeJoin(root, req.url ?? '/')
  if (target === undefined) {
    res.writeHead(403).end('forbidden')
    return
  }
  try {
    let filePath = target
    if (req.url === undefined || req.url === '/' || req.url.startsWith('/?')) {
      filePath = path.join(target, 'index.html')
    }
    const body = await readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, {
      'content-type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
}

/** Start serving `root` on an ephemeral port; resolves once listening. */
export function startStaticServer(root: string): Promise<RunningServer> {
  return new Promise((resolve, reject) => {
    const server: Server = createServer((req, res) => {
      respond(res, root, req).catch(() => {
        res.writeHead(500).end('internal error')
      })
    })
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port =
        address !== null && typeof address === 'object' ? address.port : 0
      resolve({
        port,
        close: () =>
          new Promise<void>((resolveClose) => {
            server.close(() => resolveClose())
          }),
      })
    })
  })
}
