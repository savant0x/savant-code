import { isAbsolute, normalize } from 'path'

export const validateFilePaths = (filePaths: string[]) => {
  return filePaths
    .map((p) => p.trim())
    .filter((p) => {
      if (p.length === 0) return false
      if (p.includes(' ')) return false
      if (isAbsolute(p)) return false
      if (p.includes('..')) return false
      try {
        normalize(p)
        return true
      } catch {
        return false
      }
    })
    .map((p) => (p.startsWith('/') ? p.slice(1) : p))
}
