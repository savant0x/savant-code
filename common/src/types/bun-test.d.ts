/* eslint-disable @typescript-eslint/no-explicit-any -- type declaration file for bun:test module */
declare module 'bun:test' {
  export const describe: (name: string, fn: () => void) => void
  export const it: (name: string, fn: () => void | Promise<void>) => void
  export const expect: any
}
