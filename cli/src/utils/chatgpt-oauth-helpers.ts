import crypto from 'crypto'

export function parseOAuthTokenResponse(data: unknown): {
  accessToken: string
  refreshToken: string
  expiresInMs: number
} {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid token response format from ChatGPT OAuth.')
  }

  const tokenData = data as {
    access_token?: unknown
    refresh_token?: unknown
    expires_in?: unknown
  }

  if (
    typeof tokenData.access_token !== 'string' ||
    tokenData.access_token.trim().length === 0
  ) {
    throw new Error('Token exchange did not return a valid access token.')
  }

  const refreshToken =
    typeof tokenData.refresh_token === 'string' ? tokenData.refresh_token : ''
  const expiresInMs =
    typeof tokenData.expires_in === 'number' &&
    Number.isFinite(tokenData.expires_in) &&
    tokenData.expires_in > 0
      ? tokenData.expires_in * 1000
      : 3600 * 1000

  return {
    accessToken: tokenData.access_token,
    refreshToken,
    expiresInMs,
  }
}

export function toBase64Url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

export function generateCodeVerifier(): string {
  return toBase64Url(crypto.randomBytes(32))
}

export function generateCodeChallenge(verifier: string): string {
  return toBase64Url(crypto.createHash('sha256').update(verifier).digest())
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function callbackPageHtml(
  success: boolean,
  errorMessage?: string,
): string {
  const title = success
    ? 'Connected — SavantCode'
    : 'Connection Failed — SavantCode'
  const heading = success ? '✓ Connected to ChatGPT' : 'Connection Failed'
  const headingColor = success ? '#4ade80' : '#f87171'
  const body = success
    ? 'You can close this tab and return to SavantCode.'
    : `${escapeHtml(errorMessage ?? 'Unknown error')}. Return to SavantCode and try /connect:chatgpt again.`
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0a0a0a;color:#e5e5e5">
<div style="text-align:center;padding:2rem">
<h1 style="color:${headingColor};margin-bottom:0.5rem">${heading}</h1>
<p style="color:#a3a3a3">${body}</p>
</div></body></html>`
}

export function parseAuthCodeInput(input: string): {
  code: string
  state?: string
} {
  const trimmed = input.trim()

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const callback = new URL(trimmed)
    const code = callback.searchParams.get('code')
    const state = callback.searchParams.get('state') ?? undefined

    if (!code) {
      throw new Error('No authorization code found in callback URL.')
    }

    return { code, state }
  }

  return { code: trimmed }
}
