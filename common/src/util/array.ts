import { isEqual } from 'lodash'

export function filterDefined<T>(array: (T | null | undefined)[]): T[] {
  return array.filter(isDefined)
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

type Falsey = false | undefined | null | 0 | ''
type FalseyValueArray<T> = T | Falsey | FalseyValueArray<T>[]

export function buildArray<T>(...params: FalseyValueArray<T>[]): T[] {
  const collected: (T | Falsey)[] = []
  collectValues(params, collected)
  return collected.filter(isNotFalsey)
}

function collectValues<T>(values: FalseyValueArray<T>[], result: (T | Falsey)[]): void {
  for (const value of values) {
    if (Array.isArray(value)) {
      collectValues(value, result)
    } else {
      result.push(value)
    }
  }
}

function isNotFalsey<T>(value: T | Falsey): value is T {
  return value !== false && value !== undefined && value !== null && value !== 0 && value !== ''
}

export function groupConsecutive<T, U>(xs: T[], key: (x: T) => U): Array<{ key: U; items: T[] }> {
  if (!xs.length) {
    return []
  }
  const result: Array<{ key: U; items: T[] }> = []
  let curr = { key: key(xs[0]), items: [xs[0]] }
  for (const x of xs.slice(1)) {
    const k = key(x)
    if (!isEqual(k, curr.key)) {
      result.push(curr)
      curr = { key: k, items: [x] }
    } else {
      curr.items.push(x)
    }
  }
  result.push(curr)
  return result
}
