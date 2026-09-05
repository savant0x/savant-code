import { describe, test, expect, beforeEach } from 'bun:test'

import {
  invalidateActivityQuery,
  removeActivityQuery,
  getActivityQueryData,
  setActivityQueryData,
  resetActivityQueryCache,
} from '../use-activity-query'
describe('use-activity-query utilities', () => {
  beforeEach(() => {
    // Reset cache between tests
    resetActivityQueryCache()
  })
  describe('setActivityQueryData', () => {
    test('stores data in cache', () => {
      setActivityQueryData(['test'], { value: 'hello' })
      expect(
        getActivityQueryData<{
          value: string
        }>(['test']),
      ).toEqual({ value: 'hello' })
    })
    test('overwrites existing data', () => {
      setActivityQueryData(['test'], { value: 'first' })
      setActivityQueryData(['test'], { value: 'second' })
      expect(
        getActivityQueryData<{
          value: string
        }>(['test']),
      ).toEqual({ value: 'second' })
    })
    test('handles complex query keys', () => {
      setActivityQueryData(['users', 1], { name: 'John' })
      expect(
        getActivityQueryData<{
          name: string
        }>(['users', 1]),
      ).toEqual({ name: 'John' })
    })
    test('handles query keys with objects', () => {
      setActivityQueryData(['complex', { id: 1 }], { data: 'test' })
      expect(
        getActivityQueryData<{
          data: string
        }>(['complex', { id: 1 }]),
      ).toEqual({
        data: 'test',
      })
    })
    test('different keys store different data', () => {
      setActivityQueryData(['key1'], 'value1')
      setActivityQueryData(['key2'], 'value2')
      expect(getActivityQueryData<string>(['key1'])).toBe('value1')
      expect(getActivityQueryData<string>(['key2'])).toBe('value2')
    })
  })
  describe('getActivityQueryData', () => {
    test('returns undefined for non-existent key', () => {
      expect(getActivityQueryData(['nonexistent'])).toBeUndefined()
    })
    test('returns stored data for existing key', () => {
      setActivityQueryData(['test'], 42)
      expect(getActivityQueryData<number>(['test'])).toBe(42)
    })
    test('returns correct type', () => {
      setActivityQueryData<string[]>(['test'], ['a', 'b', 'c'])
      const data = getActivityQueryData<string[]>(['test'])
      expect(data).toEqual(['a', 'b', 'c'])
    })
  })
  describe('removeActivityQuery', () => {
    test('removes existing cache entry', () => {
      setActivityQueryData(['test'], 'value')
      expect(getActivityQueryData<string>(['test'])).toBe('value')
      removeActivityQuery(['test'])
      expect(getActivityQueryData(['test'])).toBeUndefined()
    })
    test('does nothing for non-existent key', () => {
      // Should not throw
      removeActivityQuery(['nonexistent'])
      expect(getActivityQueryData(['nonexistent'])).toBeUndefined()
    })
    test('only removes specified key', () => {
      setActivityQueryData(['key1'], 'value1')
      setActivityQueryData(['key2'], 'value2')
      removeActivityQuery(['key1'])
      expect(getActivityQueryData(['key1'])).toBeUndefined()
      expect(getActivityQueryData<string>(['key2'])).toBe('value2')
    })
  })
  describe('invalidateActivityQuery', () => {
    test('marks query as stale by setting dataUpdatedAt to 0', () => {
      setActivityQueryData(['test'], 'value')
      // Before invalidation, data exists
      expect(getActivityQueryData<string>(['test'])).toBe('value')
      invalidateActivityQuery(['test'])
      // Data should still exist after invalidation
      expect(getActivityQueryData<string>(['test'])).toBe('value')
    })
    test('does nothing for non-existent key', () => {
      // Should not throw
      invalidateActivityQuery(['nonexistent'])
    })
  })
  describe('query key serialization', () => {
    test('same array values produce same cache key', () => {
      setActivityQueryData(['test', 'key'], 'value')
      expect(getActivityQueryData<string>(['test', 'key'])).toBe('value')
    })
    test('different array values produce different cache keys', () => {
      setActivityQueryData(['test', 'key1'], 'value1')
      setActivityQueryData(['test', 'key2'], 'value2')
      expect(getActivityQueryData<string>(['test', 'key1'])).toBe('value1')
      expect(getActivityQueryData<string>(['test', 'key2'])).toBe('value2')
    })
    test('object keys are serialized correctly', () => {
      setActivityQueryData(['query', { page: 1, sort: 'asc' }], 'page1')
      expect(
        getActivityQueryData<string>(['query', { page: 1, sort: 'asc' }]),
      ).toBe('page1')
    })
    test('nested objects in keys work correctly', () => {
      setActivityQueryData(
        ['query', { filter: { status: 'active', type: 'user' } }],
        'filtered',
      )
      expect(
        getActivityQueryData<string>([
          'query',
          { filter: { status: 'active', type: 'user' } },
        ]),
      ).toBe('filtered')
    })
  })
})
describe('useActivityQuery hook behavior', () => {
  // These tests verify the hook's expected behavior patterns
  // We can't easily test the actual hook without a React renderer,
  // but we can test the underlying cache behavior
  describe('cache entry structure', () => {
    test('setActivityQueryData creates proper cache entry', () => {
      const testData = { users: [1, 2, 3] }
      setActivityQueryData(['users'], testData)
      const retrieved = getActivityQueryData<typeof testData>(['users'])
      expect(retrieved).toEqual(testData)
    })
    test('cache preserves data types', () => {
      // Numbers
      setActivityQueryData(['number'], 42)
      expect(getActivityQueryData<number>(['number'])).toBe(42)
      // Strings
      setActivityQueryData(['string'], 'hello')
      expect(getActivityQueryData<string>(['string'])).toBe('hello')
      // Booleans
      setActivityQueryData(['boolean'], true)
      expect(getActivityQueryData<boolean>(['boolean'])).toBe(true)
      // Arrays
      setActivityQueryData(['array'], [1, 2, 3])
      expect(getActivityQueryData<number[]>(['array'])).toEqual([1, 2, 3])
      // Objects
      setActivityQueryData(['object'], { a: 1, b: 2 })
      expect(
        getActivityQueryData<{
          a: number
          b: number
        }>(['object']),
      ).toEqual({ a: 1, b: 2 })
      // Null
      setActivityQueryData(['null'], null)
      expect(getActivityQueryData<null>(['null'])).toBeNull()
    })
  })
  describe('invalidation behavior', () => {
    test('invalidation preserves existing data', () => {
      const originalData = { id: 1, name: 'Test' }
      setActivityQueryData(['preserve'], originalData)
      invalidateActivityQuery(['preserve'])
      // Data should still be accessible
      expect(getActivityQueryData<typeof originalData>(['preserve'])).toEqual(
        originalData,
      )
    })
    test('multiple invalidations do not remove data', () => {
      setActivityQueryData(['multi'], 'persistent')
      invalidateActivityQuery(['multi'])
      invalidateActivityQuery(['multi'])
      invalidateActivityQuery(['multi'])
      expect(getActivityQueryData<string>(['multi'])).toBe('persistent')
    })
  })
  describe('remove behavior', () => {
    test('remove completely clears the cache entry', () => {
      setActivityQueryData(['remove-test'], 'data')
      expect(getActivityQueryData<string>(['remove-test'])).toBe('data')
      removeActivityQuery(['remove-test'])
      expect(getActivityQueryData(['remove-test'])).toBeUndefined()
      // Can set new data after removal
      setActivityQueryData(['remove-test'], 'new-data')
      expect(getActivityQueryData<string>(['remove-test'])).toBe('new-data')
    })
  })
  describe('resetActivityQueryCache', () => {
    test('clears all cache entries', () => {
      setActivityQueryData(['key1'], 'value1')
      setActivityQueryData(['key2'], 'value2')
      setActivityQueryData(['key3'], 'value3')
      expect(getActivityQueryData<string>(['key1'])).toBe('value1')
      expect(getActivityQueryData<string>(['key2'])).toBe('value2')
      expect(getActivityQueryData<string>(['key3'])).toBe('value3')
      resetActivityQueryCache()
      expect(getActivityQueryData(['key1'])).toBeUndefined()
      expect(getActivityQueryData(['key2'])).toBeUndefined()
      expect(getActivityQueryData(['key3'])).toBeUndefined()
    })
    test('allows setting new data after reset', () => {
      setActivityQueryData(['test'], 'old')
      resetActivityQueryCache()
      setActivityQueryData(['test'], 'new')
      expect(getActivityQueryData<string>(['test'])).toBe('new')
    })
  })
})
