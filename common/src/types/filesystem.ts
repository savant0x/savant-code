import type fs from 'fs'

/** File system used for SavantCode SDK.
 *
 * Compatible with `fs.promises` from the `'fs'` module.
 */
export type SavantCodeFileSystem = Pick<
  typeof fs.promises,
  'mkdir' | 'readdir' | 'readFile' | 'stat' | 'unlink' | 'writeFile'
>
