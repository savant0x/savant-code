function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4
  if (pad === 2) base64 += '=='
  else if (pad === 3) base64 += '='
  return Buffer.from(base64, 'base64').toString('utf-8')
}

export function extractChatGptAccountId(accessToken: string): string | null {
  try {
    const parts = accessToken.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(base64UrlDecode(parts[1]))
    const auth = payload?.['https://api.openai.com/auth']
    return typeof auth?.chatgpt_account_id === 'string'
      ? auth.chatgpt_account_id
      : null
  } catch {
    return null
  }
}
