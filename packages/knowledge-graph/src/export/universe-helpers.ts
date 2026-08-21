import type { GraphPosition, UniverseCorridor, UniverseFolder } from './types'

export function stableHash(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function regionPath(filePath: string): string {
  const parts = filePath.split('/').filter(Boolean)
  if (parts.length === 0) return 'root'
  // Root-level files are files, not systems. Grouping them into the ROOT
  // region keeps the systems list honest: a root file must never appear as
  // its own 1-file "system" (clicking one opened the root directory instead
  // of the file's document).
  if (parts.length === 1) return 'root'
  if (parts[0] === 'packages' && parts[1]) {
    // packages/<file> directly (e.g. packages/package.json) belongs to the
    // packages system; only a real nested subtree (packages/<sub>/…) is its
    // own system.
    return parts.length === 2 ? 'packages' : `packages/${parts[1]}`
  }
  return parts[0]
}

export function regionId(region: string): string {
  return `region-${region.replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

export function folderId(folderPath: string): string {
  return folderPath
    ? `folder-${stableHash(folderPath).toString(16)}`
    : 'folder-root'
}

export function buildHierarchy(
  fileRows: Array<{ id: number; path: string }>,
): UniverseFolder[] {
  const folders = new Map<string, Set<string>>()
  folders.set('', new Set())
  for (const file of fileRows) {
    const parts = file.path.split('/').filter(Boolean)
    const fileId = `file-${file.id}`
    const folderParts = parts.slice(0, -1)
    for (let index = 0; index <= folderParts.length; index++) {
      const currentPath = folderParts.slice(0, index).join('/')
      const parentPath = folderParts.slice(0, index - 1).join('/')
      if (!folders.has(currentPath)) folders.set(currentPath, new Set())
      if (index > 0) folders.get(parentPath)?.add(folderId(currentPath))
    }
    folders.get(folderParts.join('/'))?.add(fileId)
  }
  return [...folders.keys()].sort().map((currentPath) => {
    const parts = currentPath.split('/').filter(Boolean)
    const parentPath = parts.slice(0, -1).join('/')
    const children = [...(folders.get(currentPath) ?? [])].sort((a, b) => {
      const aFolder = a.startsWith('folder-')
      const bFolder = b.startsWith('folder-')
      if (aFolder !== bFolder) return aFolder ? -1 : 1
      return a.localeCompare(b)
    })
    return {
      id: folderId(currentPath),
      label: currentPath ? parts[parts.length - 1] : 'ROOT / repository',
      path: currentPath,
      parentId: currentPath ? folderId(parentPath) : null,
      childIds: children,
    }
  })
}

/**
 * Bounded export-time relaxation: aggregate corridors pull systems together,
 * while repulsion keeps the universe spatially legible. Mutates
 * `regionPositions` in place (same semantics as the original loop).
 */
export function relaxRegions(
  regionKeys: string[],
  regionKeyById: Map<string, string>,
  corridorMap: Map<string, UniverseCorridor>,
  regionPositions: Map<string, GraphPosition>,
): void {
  for (let iteration = 0; iteration < 90; iteration++) {
    const delta = new Map(regionKeys.map((key) => [key, { x: 0, y: 0 }]))
    for (let i = 0; i < regionKeys.length; i++) {
      for (let j = i + 1; j < regionKeys.length; j++) {
        const a = regionKeys[i]
        const b = regionKeys[j]
        const pa = regionPositions.get(a) as GraphPosition
        const pb = regionPositions.get(b) as GraphPosition
        const dx = pa.x - pb.x
        const dy = pa.y - pb.y
        const distance = Math.max(80, Math.hypot(dx, dy))
        const force = 18000 / (distance * distance)
        const ax = (dx / distance) * force
        const ay = (dy / distance) * force
        delta.get(a)!.x += ax
        delta.get(a)!.y += ay
        delta.get(b)!.x -= ax
        delta.get(b)!.y -= ay
      }
    }
    for (const corridor of corridorMap.values()) {
      const source = regionKeyById.get(corridor.source)
      const target = regionKeyById.get(corridor.target)
      if (!source || !target) continue
      const a = regionPositions.get(source) as GraphPosition
      const b = regionPositions.get(target) as GraphPosition
      const dx = b.x - a.x
      const dy = b.y - a.y
      const distance = Math.max(1, Math.hypot(dx, dy))
      const force = Math.min(18, corridor.totalWeight / distance)
      delta.get(source)!.x += (dx / distance) * force
      delta.get(source)!.y += (dy / distance) * force
      delta.get(target)!.x -= (dx / distance) * force
      delta.get(target)!.y -= (dy / distance) * force
    }
    for (const key of regionKeys) {
      const position = regionPositions.get(key) as GraphPosition
      const movement = delta.get(key)!
      position.x += movement.x * 0.8
      position.y += movement.y * 0.8
    }
  }
}
