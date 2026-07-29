import { describe, expect, test } from 'bun:test'

import { detectOllama, resolveOllamaHost } from '../detect'

describe('resolveOllamaHost', () => {
  test('returns localhost by default', () => {
    const original = process.env.OLLAMA_HOST
    delete process.env.OLLAMA_HOST
    expect(resolveOllamaHost()).toBe('http://localhost:11434')
    process.env.OLLAMA_HOST = original
  })

  test('honors OLLAMA_HOST', () => {
    const original = process.env.OLLAMA_HOST
    process.env.OLLAMA_HOST = 'http://ollama.example.com:11434'
    expect(resolveOllamaHost()).toBe('http://ollama.example.com:11434')
    process.env.OLLAMA_HOST = original
  })
})

describe('detectOllama', () => {
  test('returns unavailable when server cannot be reached', async () => {
    const result = await detectOllama('http://127.0.0.1:1')
    expect(result.available).toBe(false)
    expect(result.host).toBe('http://127.0.0.1:1')
    expect(result.models).toEqual([])
    expect(result.error).toBeDefined()
  })

  test('returns available when /api/tags responds', async () => {
    // Minimal mock server
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        const url = new URL(request.url)
        if (url.pathname === '/api/version') {
          return new Response(JSON.stringify({ version: '0.1.0' }))
        }
        if (url.pathname === '/api/tags') {
          return new Response(
            JSON.stringify({
              models: [
                { name: 'llama3.1:latest' },
                { name: 'qwen2:0.5b' },
              ],
            }),
          )
        }
        return new Response('not found', { status: 404 })
      },
    })

    try {
      const result = await detectOllama(`http://localhost:${server.port}`)
      expect(result.available).toBe(true)
      expect(result.version).toBe('0.1.0')
      expect(result.models).toEqual(['llama3.1:latest', 'qwen2:0.5b'])
    } finally {
      server.stop()
    }
  })
})
