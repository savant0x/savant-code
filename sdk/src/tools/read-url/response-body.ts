/**
 * read-url — bounded response-body reading (FID-2026-1012-018 split: extracted
 * from `fetch.ts` so the orchestrator stays inside the 300-line quality
 * ceiling). The size refusals raised here are classified by the caller's
 * taxonomy; the messages keep their original shape.
 */

function getHeader(headers: Headers, name: string): string | undefined {
  return headers.get(name) ?? undefined
}

export async function readResponseBody(
  response: Response,
  maxBytes: number,
): Promise<string> {
  const contentLength = getHeader(response.headers, 'content-length')
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new Error(`Response is too large (${contentLength} bytes)`)
  }

  if (!response.body) {
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > maxBytes) {
      throw new Error(`Response is too large (${buffer.byteLength} bytes)`)
    }
    return new TextDecoder().decode(buffer)
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue

    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel()
      throw new Error(`Response exceeded ${maxBytes} bytes`)
    }
    chunks.push(value)
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  return new TextDecoder().decode(body)
}
