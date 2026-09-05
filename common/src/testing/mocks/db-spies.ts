import { mock, spyOn } from 'bun:test'

import type { CreateMockDbOptions } from './database'
import type { Mock } from 'bun:test'

// FID-2026-0819-005 Loop 153: database spy + query-result helpers, extracted
// verbatim from testing/mocks/database.ts. Re-exported from database.ts —
// the public surface is unchanged.

/**
 * Result of setting up database spies.
 */
export interface DbSpies {
  /** Spy on insert operations */
  insert: ReturnType<typeof spyOn>
  /** Spy on update operations */
  update: ReturnType<typeof spyOn>
  /** Restore all spies */
  restore: () => void
  /** Clear all spy call history */
  clear: () => void
}

/**
 * Sets up spies on a database module for insert and update operations.
 * This is the most common pattern used in tests.
 *
 * @param db - The database module to spy on
 * @param options - Configuration options
 * @returns Object containing the spies and cleanup utilities
 *
 * @example
 * ```typescript
 * const db = createMockDbOperations()
 *
 * describe('my test', () => {
 *   let dbSpies: DbSpies
 *
 *   beforeEach(() => {
 *     dbSpies = setupDbSpies(db)
 *   })
 *
 *   afterEach(() => {
 *     dbSpies.restore()
 *   })
 *
 *   it('inserts data', async () => {
 *     await createUser({ name: 'Test' })
 *     expect(dbSpies.insert).toHaveBeenCalled()
 *   })
 * })
 * ```
 */

/**
 * Sets up spies on a database module for insert and update operations.
 * Accepts any object with insert and update methods.
 */
export function setupDbSpies(
  db: { insert: unknown; update: unknown },
  options: CreateMockDbOptions = {},
): DbSpies {
  const { defaultInsertId = 'test-run-id' } = options

  const mockInsertResult = {
    values: mock(() => Promise.resolve({ id: defaultInsertId })),
  }

  const mockUpdateResult = {
    set: mock(() => ({
      where: mock(() => Promise.resolve()),
    })),
  }

  // Cast db to a spyable type - the actual db module has complex types that
  // don't play well with spyOn's inference, but the spy still works at runtime
  const spyableDb = db as { insert: () => unknown; update: () => unknown }
  const insertSpy = spyOn(spyableDb, 'insert').mockReturnValue(mockInsertResult)
  const updateSpy = spyOn(spyableDb, 'update').mockReturnValue(mockUpdateResult)

  return {
    insert: insertSpy,
    update: updateSpy,
    restore: () => {
      insertSpy.mockRestore()
      updateSpy.mockRestore()
    },
    clear: () => {
      insertSpy.mockClear()
      updateSpy.mockClear()
    },
  }
}

/**
 * Creates a mock for a database query builder chain that returns specific data.
 *
 * @param data - The data to return from the query
 * @returns A thenable mock that resolves to the data
 *
 * @example
 * ```typescript
 * const mockQuery = createMockQueryResult([
 *   { id: '1', name: 'User 1' },
 *   { id: '2', name: 'User 2' },
 * ])
 *
 * spyOn(userService, 'findAll').mockReturnValue(mockQuery)
 * ```
 */
export function createMockQueryResult<T>(data: T[]): Promise<T[]> & {
  where: Mock<() => Promise<T[]>>
  orderBy: Mock<() => Promise<T[]>>
  limit: Mock<() => Promise<T[]>>
} {
  const promise = Promise.resolve(data) as Promise<T[]> & {
    where: Mock<() => Promise<T[]>>
    orderBy: Mock<() => Promise<T[]>>
    limit: Mock<() => Promise<T[]>>
  }

  promise.where = mock(() => promise)
  promise.orderBy = mock(() => promise)
  promise.limit = mock(() => promise)

  return promise
}
