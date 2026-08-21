/**
 * Docset schema. The FTS5 table is external-content (`content='docs'`): text
 * lives in `docs`, and the FTS index is built once after the bulk insert with
 * `INSERT INTO docs_fts(docs_fts) VALUES('rebuild')` — a build-once, then
 * read-only docset needs no per-row triggers.
 */
export const DOCSET_SCHEMA = `
  CREATE TABLE IF NOT EXISTS docs (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT,
    content TEXT NOT NULL
  );
  CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
    title, content,
    content='docs',
    content_rowid='id',
    tokenize='unicode61'
  );
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`

/**
 * Build a safe FTS5 MATCH expression from free-text input. Each word is
 * double-quoted (phrase tokens), special characters are neutralized, and
 * tokens are AND-joined so results must mention every term. Returns null when
 * the input has no usable tokens.
 */
export function buildMatchExpression(query: string): string | null {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
  if (tokens.length === 0) return null
  return tokens.map((token) => `"${token.replace(/"/g, '""')}"`).join(' AND ')
}
