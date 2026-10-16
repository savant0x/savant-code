/** Preserve every ancestor restriction; each child can only narrow authority. */
export function clampWriteScope(
  parent: readonly (readonly string[])[] | undefined,
  child: readonly string[] | undefined,
): readonly (readonly string[])[] | undefined {
  if (parent === undefined && child === undefined) return undefined
  return [
    ...(parent ?? []).map((layer) => [...layer]),
    ...(child === undefined ? [] : [[...child]]),
  ]
}
