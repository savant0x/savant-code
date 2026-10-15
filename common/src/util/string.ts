import { sumBy } from 'lodash'

import { pluralize } from './string/pluralize'

import type { JSONValue } from '../types/json'

export { pluralize }

export const truncateString = (str: string, maxLength: number) => {
  if (str.length <= maxLength) {
    return str
  }
  return str.slice(0, maxLength) + '...'
}

export const truncateStringWithMessage = ({
  str,
  maxLength,
  message = 'TRUNCATED DUE TO LENGTH',
  remove = 'END',
}: {
  str: string
  maxLength: number
  message?: string
  remove?: 'END' | 'START' | 'MIDDLE'
}) => {
  if (str.length <= maxLength) {
    return str
  }

  if (remove === 'END') {
    const suffix = `\n[${message}...]`
    return str.slice(0, maxLength - suffix.length) + suffix
  }
  if (remove === 'START') {
    const prefix = `[...${message}]\n`
    return prefix + str.slice(str.length - maxLength + prefix.length)
  }

  const middle = `\n[...${message}...]\n`
  const length = Math.floor((maxLength - middle.length) / 2)
  return str.slice(0, length) + middle + str.slice(-length)
}

/**
 * Check if a character is a whitespace character according
 * to the XML spec (space, carriage return, line feed or tab)
 *
 * @param character Character to check
 * @return Whether the character is whitespace or not
 */
export const isWhitespace = (character: string) => /\s/.test(character)

export const randBoolFromStr = (str: string) => {
  return sumBy(str.split(''), (char) => char.charCodeAt(0)) % 2 === 0
}

/**
 * Safely replaces all occurrences of a search string with a replacement string,
 * escaping special replacement patterns (like $) in the replacement string.
 */
export const capitalize = (str: string): string => {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Converts a snake_case string to Title Case
 * Example: "add_subgoal" -> "Add Subgoal"
 */
export const snakeToTitleCase = (str: string): string => {
  return str
    .split('_')
    .map((word) => capitalize(word))
    .join(' ')
}

/**
 * Ensures a URL has the appropriate protocol (http:// or https://)
 * Uses http:// for localhost and local IPs, https:// for all other domains
 */
export const ensureUrlProtocol = (url: string): string => {
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('file://')
  ) {
    return url
  }

  if (url.startsWith('localhost') || url.match(/^127\.\d+\.\d+\.\d+/)) {
    return `http://${url}`
  }

  if (url.startsWith('/')) {
    return `file://${url}`
  }

  return `https://${url}`
}

/**
 * Extracts a JSON field from a string, transforms it, and puts it back.
 * Handles both array and object JSON values.
 * @param content The string containing JSON-like content
 * @param field The field name to find and transform
 * @param transform Function to transform the parsed JSON value
 * @param fallback String to use if parsing fails
 * @returns The content string with the transformed JSON field
 */
export function transformJsonInString<T extends JSONValue = JSONValue>(
  content: string,
  field: string,
  transform: (json: T) => JSONValue,
  fallback: string,
): string {
  // Use a non-greedy match for objects/arrays to prevent over-matching
  const pattern = new RegExp(`"${field}"\\s*:\\s*(\\{[^}]*?\\}|\\[[^\\]]*?\\])`)
  const match = content.match(pattern)

  if (!match) {
    return content
  }

  try {
    const json = JSON.parse(match[1])
    const transformed = transform(json)

    // Important: Only replace the exact matched portion to prevent duplicates
    return content.replace(
      match[0],
      `"${field}":${JSON.stringify(transformed)}`,
    )
  } catch (error) {
    // Only replace the exact matched portion even in error case
    return content.replace(match[0], `"${field}":${fallback}`)
  }
}

/**
 * Generates a compact unique identifier by combining timestamp bits with random bits.
 * Uses 40 bits of timestamp (enough for ~34 years) and 24 random bits for exactly 64 total bits.
 * Encodes in base64url for compact, URL-safe strings (~11 chars).
 * @param prefix Optional prefix to add to the ID
 * @returns A unique string ID
 * @example
 * generateCompactId()      // => "1a2b3c4d5e6"
 * generateCompactId('msg-') // => "msg-1a2b3c4d5e6"
 */
export const generateCompactId = (prefix?: string): string => {
  // Get the last 32 bits of the timestamp
  const timestamp = (Date.now() & 0xffffffff) >>> 0
  // Generate a 32-bit random number
  const random = Math.floor(Math.random() * 0x100000000) >>> 0

  // Combine them into a 64-bit representation as two 32-bit numbers
  const high = timestamp
  const low = random

  // Convert to a hex string, pad if necessary, and combine
  const highHex = high.toString(16).padStart(8, '0')
  const lowHex = low.toString(16).padStart(8, '0')

  const combinedHex = highHex + lowHex

  // Convert hex to a Buffer and then to base64url
  const bytes = Buffer.from(combinedHex, 'hex')
  const str = bytes.toString('base64url').replace(/=/g, '')

  return prefix ? `${prefix}${str}` : str
}

/**
 * Removes null characters from a string
 */
export const stripNullChars = (str: string): string => {
  return str.replace(/\u0000/g, '')
}

const ansiColorsRegex = /\x1B\[[0-9;]*m/g
export function stripColors(str: string): string {
  return str.replace(ansiColorsRegex, '')
}

const ansiRegex = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x1B]*\x1B\\?)/g
export function stripAnsi(str: string): string {
  return str.replace(ansiRegex, '')
}

export function includesMatch(
  array: (string | RegExp)[],
  value: string,
): boolean {
  return array.some((p) => {
    if (typeof p === 'string') {
      return p === value
    }
    return p.test(value)
  })
}

/**
 * Finds the longest substring that is **both** a suffix of `source`
 * **and** a prefix of `next`.
 * Useful when concatenating strings while avoiding duplicate overlap.
 *
 * @example
 * ```ts
 * suffixPrefixOverlap('foobar', 'barbaz'); // ➜ 'bar'
 * suffixPrefixOverlap('abc', 'def');       // ➜ ''
 * ```
 *
 * @param source  The string whose **suffix** is inspected.
 * @param next    The string whose **prefix** is inspected.
 * @returns       The longest overlapping edge, or an empty string if none exists.
 */
export function suffixPrefixOverlap(source: string, next: string): string {
  for (let len = next.length; len >= 0; len--) {
    const prefix = next.slice(0, len)
    if (source.endsWith(prefix)) {
      return prefix
    }
  }

  return ''
}

export const escapeString = (str: string) => {
  return JSON.stringify(str).slice(1, -1)
}
