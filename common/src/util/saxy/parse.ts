import { isWhitespace } from '../string'

/**
 * Expand a piece of XML text by replacing all XML entities by
 * their canonical value. Ignore invalid and unknown entities.
 *
 * @param input A string of XML text
 * @return The input string, expanded
 */
export const parseEntities = (input: string): string => {
  let position = 0
  let next = 0
  const parts = []

  while ((next = input.indexOf('&', position)) !== -1) {
    if (next > position) {
      const beforeEntity = input.slice(position, next)
      parts.push(beforeEntity)
    }

    const semiColonPos = input.indexOf(';', next)

    if (semiColonPos === -1) {
      const remaining = input.slice(next)
      parts.push(remaining)
      position = input.length
      break
    }

    const entityName = input.slice(next + 1, semiColonPos)

    // If entityName contains invalid characters (space, &, <, >) or is empty,
    // treat the initial & as a literal character
    if (/[ &<>]/.test(entityName) || entityName.length === 0) {
      parts.push('&')
      position = next + 1
      continue
    }

    if (entityName === 'quot') {
      parts.push('"')
    } else if (entityName === 'amp') {
      parts.push('&')
    } else if (entityName === 'apos') {
      parts.push("'")
    } else if (entityName === 'lt') {
      parts.push('<')
    } else if (entityName === 'gt') {
      parts.push('>')
    } else if (entityName.startsWith('#')) {
      let value
      if (entityName[1] === 'x' || entityName[1] === 'X') {
        value = parseInt(entityName.slice(2), 16)
      } else {
        value = parseInt(entityName.slice(1), 10)
      }

      if (isNaN(value)) {
        parts.push('&' + entityName + ';')
      } else {
        parts.push(String.fromCharCode(value))
      }
    } else {
      // Unrecognized named entity, pass through
      parts.push('&' + entityName + ';')
    }
    position = semiColonPos + 1
  }

  if (position < input.length) {
    const remaining = input.slice(position)
    parts.push(remaining)
  }

  const result = parts.join('')
  return result
}

/**
 * Parse a string of XML attributes to a map of attribute names to their values.
 *
 * @param input A string of XML attributes
 * @throws If the string is malformed
 * @return A map of attribute names to their values
 */
export const parseAttrs = (
  input: string,
): { attrs: Record<string, string>; errors: string[] } => {
  const attrs = {} as Record<string, string>
  const end = input.length
  let position = 0
  const errors: string[] = []

  const seekNextWhitespace = (pos: number): number => {
    pos += 1
    while (pos < end && !isWhitespace(input[pos])) {
      pos += 1
    }
    return pos
  }

  attrLoop: while (position < end) {
    // Skip all whitespace
    if (isWhitespace(input[position])) {
      position += 1
      continue
    }

    // Check that the attribute name contains valid chars
    let startName = position

    while (input[position] !== '=' && position < end) {
      if (isWhitespace(input[position])) {
        errors.push(
          `Attribute names may not contain whitespace: ${input.slice(startName, position)}`,
        )
        continue attrLoop
      }

      position += 1
    }

    // This is XML, so we need a value for the attribute
    if (position === end) {
      errors.push(
        `Expected a value for the attribute: ${input.slice(startName, position)}`,
      )
      break
    }

    const attrName = input.slice(startName, position)
    position += 1
    const startQuote = input[position]
    position += 1

    if (startQuote !== '"' && startQuote !== "'") {
      position = seekNextWhitespace(position)
      errors.push(
        `Attribute values should be quoted: ${input.slice(startName, position)}`,
      )
      continue
    }

    const endQuote = input.indexOf(startQuote, position)

    if (endQuote === -1) {
      position = seekNextWhitespace(position)
      errors.push(
        `Unclosed attribute value: ${input.slice(startName, position)}`,
      )
      continue
    }

    const attrValue = input.slice(position, endQuote)

    attrs[attrName] = attrValue
    position = endQuote + 1
  }

  return { attrs, errors }
}

/**
 * Find the first character in a string that matches a predicate
 * while being outside the given delimiters.
 *
 * @param haystack String to search in
 * @param predicate Checks whether a character is permissible
 * @param [delim=''] Delimiter inside which no match should be
 * returned. If empty, all characters are considered.
 * @param [fromIndex=0] Start the search from this index
 * @return Index of the first match, or -1 if no match
 */
export const findIndexOutside = (
  haystack: string,
  predicate: (char: string) => boolean,
  delim = '',
  fromIndex = 0,
) => {
  const length = haystack.length
  let index = fromIndex
  let inDelim = false

  while (index < length && (inDelim || !predicate(haystack[index]))) {
    if (haystack[index] === delim) {
      inDelim = !inDelim
    }

    ++index
  }

  return index === length ? -1 : index
}
