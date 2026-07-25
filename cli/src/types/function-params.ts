import type { Prettify } from './utils'
import type { UnionToIntersection } from 'bun-types/vendor/expect-type'

type StripExact<T> = T extends infer U & { [x: string]: never } ? U : T

type ParamsOfFunction<T> = T extends (params: infer C) => unknown ? StripExact<C> : never

type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : false
type ParamsOfArray<T> = UnionToIntersection<
  T extends [infer fn, ...infer rest]
    ? ParamsOfFunction<fn> | ParamsOfArray<rest>
    : {}
>
type ParamsOfUnion<T> = IsUnion<T> extends true
  ? UnionToIntersection<ParamsOfFunction<T>>
  : ParamsOfFunction<T>

export type ParamsOf<T> = Prettify<
  T extends readonly unknown[] ? ParamsOfArray<T> : ParamsOfUnion<T>
>

export type OptionalFields<T, K extends keyof T> = Prettify<
  Omit<T, K> & Partial<Pick<T, K>>
>

export type ParamsExcluding<T, K extends keyof ParamsOf<T>> = Prettify<
  Omit<ParamsOf<T>, K>
>
