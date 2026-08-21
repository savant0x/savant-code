import {
  DEFAULT_DOCUMENT_IMAGE_BYTES,
  DEFAULT_DOCUMENT_TOTAL_MEDIA_BYTES,
  GOLDEN_ANGLE,
  REGION_COLORS,
} from './constants'
import { fileDocument, readFilePreview } from './read-preview'
import {
  buildHierarchy,
  folderId,
  regionId,
  regionPath,
  relaxRegions,
  stableHash,
} from './universe-helpers'

import type { EdgeType } from '../types'
import type { DocumentBudget } from './constants'
import type {
  GraphPosition,
  GraphUniverse,
  UniverseCorridor,
  UniverseEdge,
  UniverseFile,
  UniverseRegion,
  UniverseDocument,
} from './types'

export function buildUniverse(
  fileRows: Array<{ id: number; path: string; cluster_id: number | null }>,
  edgeRows: Array<{
    source_id: number
    target_id: number
    type: EdgeType
    weight: number
  }>,
  projectRoot?: string,
  documentsEnabled = false,
  documentLines: number | undefined = undefined,
  documentBytes: number | undefined = undefined,
  documentImageBytes = DEFAULT_DOCUMENT_IMAGE_BYTES,
  documentTotalTextBytes: number | undefined = undefined,
  documentTotalMediaBytes = DEFAULT_DOCUMENT_TOTAL_MEDIA_BYTES,
  previewsEnabled = false,
  previewLines = 20,
  previewChars = 2000,
): GraphUniverse {
  const regionByFile = new Map<number, string>()
  const regionFiles = new Map<string, typeof fileRows>()
  for (const file of fileRows) {
    const key = regionPath(file.path)
    regionByFile.set(file.id, key)
    const files = regionFiles.get(key) ?? []
    files.push(file)
    regionFiles.set(key, files)
  }

  const regionKeyById = new Map(
    [...regionFiles.keys()].map((key) => [regionId(key), key]),
  )
  const regionEdgeCounts = new Map<string, number>()
  const degreeByFile = new Map<number, number>()
  for (const edge of edgeRows) {
    degreeByFile.set(
      edge.source_id,
      (degreeByFile.get(edge.source_id) ?? 0) + 1,
    )
    degreeByFile.set(
      edge.target_id,
      (degreeByFile.get(edge.target_id) ?? 0) + 1,
    )
    const sourceRegion = regionByFile.get(edge.source_id)
    const targetRegion = regionByFile.get(edge.target_id)
    if (sourceRegion)
      regionEdgeCounts.set(
        sourceRegion,
        (regionEdgeCounts.get(sourceRegion) ?? 0) + 1,
      )
    if (targetRegion && targetRegion !== sourceRegion)
      regionEdgeCounts.set(
        targetRegion,
        (regionEdgeCounts.get(targetRegion) ?? 0) + 1,
      )
  }

  const corridorMap = new Map<string, UniverseCorridor>()
  const universeEdges: UniverseEdge[] = edgeRows.map((edge) => ({
    id: `edge-${edge.source_id}-${edge.target_id}-${edge.type}`,
    source: `file-${edge.source_id}`,
    target: `file-${edge.target_id}`,
    type: edge.type,
    weight: edge.weight,
  }))
  for (const edge of edgeRows) {
    const sourceRegion = regionByFile.get(edge.source_id)
    const targetRegion = regionByFile.get(edge.target_id)
    if (!sourceRegion || !targetRegion || sourceRegion === targetRegion)
      continue
    const key = `${sourceRegion}->${targetRegion}`
    const current = corridorMap.get(key) ?? {
      id: `corridor-${stableHash(key).toString(16)}`,
      source: regionId(sourceRegion),
      target: regionId(targetRegion),
      edgeCount: 0,
      totalWeight: 0,
      typeCounts: {},
      underlyingEdgeIds: [],
    }
    current.edgeCount += 1
    current.totalWeight += edge.weight
    current.typeCounts[edge.type] = (current.typeCounts[edge.type] ?? 0) + 1
    current.underlyingEdgeIds.push(
      `edge-${edge.source_id}-${edge.target_id}-${edge.type}`,
    )
    corridorMap.set(key, current)
  }

  // ROOT first (the repository-level system), then deterministic path order.
  const regionKeys = [...regionFiles.keys()].sort((a, b) =>
    a === 'root' ? -1 : b === 'root' ? 1 : a.localeCompare(b),
  )
  const regionPositions = new Map<string, GraphPosition>()
  const regionCount = Math.max(1, regionKeys.length)
  const radius = Math.max(520, regionCount * 95)
  for (let i = 0; i < regionKeys.length; i++) {
    const angle = (i / regionCount) * Math.PI * 2 - Math.PI / 2
    regionPositions.set(regionKeys[i], {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    })
  }

  // Bounded export-time relaxation: aggregate corridors pull systems together,
  // while repulsion keeps the universe spatially legible.
  relaxRegions(regionKeys, regionKeyById, corridorMap, regionPositions)

  const regions: UniverseRegion[] = regionKeys.map((key, index) => {
    const files = regionFiles.get(key) ?? []
    const edgeCount = regionEdgeCounts.get(key) ?? 0
    const clusters = files
      .map((file) => file.cluster_id)
      .filter((cluster): cluster is number => cluster !== null)
    const cluster =
      clusters.length > 0 ? clusters.sort((a, b) => a - b)[0] : null
    return {
      id: regionId(key),
      label: key === 'root' ? 'ROOT / repository' : key,
      path: key,
      fileCount: files.length,
      edgeCount,
      position: regionPositions.get(key) as GraphPosition,
      size: 18 + Math.sqrt(files.length) * 5,
      color: REGION_COLORS[index % REGION_COLORS.length],
      cluster,
      // The ROOT region aggregates the repository itself; it is never
      // "isolated" even when its root-level files carry no edges.
      disconnected: edgeCount === 0 && key !== 'root',
    }
  })

  const files: UniverseFile[] = []
  for (const key of regionKeys) {
    const entries = regionFiles.get(key) ?? []
    const center = regionPositions.get(key) as GraphPosition
    const maxDegree = Math.max(
      1,
      ...entries.map((file) => degreeByFile.get(file.id) ?? 0),
    )
    const localRadius = Math.max(90, Math.sqrt(entries.length) * 28)
    entries
      .sort((a, b) => a.path.localeCompare(b.path))
      .forEach((file, index) => {
        const degree = degreeByFile.get(file.id) ?? 0
        const angle = index * GOLDEN_ANGLE + (stableHash(file.path) % 37) / 37
        const distance = Math.min(
          localRadius,
          18 +
            Math.sqrt(index + 1) *
              (localRadius / Math.sqrt(Math.max(1, entries.length))),
        )
        const universeFile: UniverseFile = {
          id: `file-${file.id}`,
          label: file.path.split('/').pop() ?? file.path,
          path: file.path,
          regionId: regionId(key),
          cluster: file.cluster_id,
          position: {
            x: center.x + Math.cos(angle) * distance,
            y: center.y + Math.sin(angle) * distance,
          },
          size: 3 + (degree / maxDegree) * 6,
          importance: degree / maxDegree,
        }
        if (previewsEnabled && projectRoot) {
          const preview = readFilePreview(
            projectRoot,
            file.path,
            previewLines,
            previewChars,
          )
          if (preview !== undefined) universeFile.preview = preview
        }
        files.push(universeFile)
      })
  }

  const folders = buildHierarchy(fileRows)
  const documents: Record<string, UniverseDocument> = {}
  if (documentsEnabled && projectRoot) {
    const budget: DocumentBudget = {
      textBytes: 0,
      mediaBytes: 0,
      maxTotalTextBytes: documentTotalTextBytes,
      maxTotalMediaBytes: documentTotalMediaBytes,
    }
    for (const file of fileRows) {
      documents[`file-${file.id}`] = fileDocument(
        projectRoot,
        file.path,
        documentLines,
        documentBytes,
        documentImageBytes,
        budget,
      )
    }
  }
  const searchIndex: GraphUniverse['searchIndex'] = [
    ...regionKeys.map((key) => ({
      id: regionId(key),
      kind: 'system' as const,
      label: key === 'root' ? 'ROOT / repository' : key,
      path: key,
    })),
    ...buildHierarchy(fileRows).map((folder) => ({
      id: folder.id,
      kind: 'folder' as const,
      label: folder.label,
      path: folder.path,
    })),
    ...fileRows.map((file) => ({
      id: `file-${file.id}`,
      kind: 'file' as const,
      label: file.path.split('/').pop() ?? file.path,
      path: file.path,
    })),
  ]
  return {
    regions,
    files,
    edges: universeEdges,
    corridors: [...corridorMap.values()].map((corridor) => ({
      ...corridor,
      underlyingEdgeIds: corridor.underlyingEdgeIds.sort(),
    })),
    folders,
    rootFolderId: folderId(''),
    documents,
    searchIndex,
    documentPolicy: {
      enabled: documentsEnabled,
      maxTextLines: documentLines ?? null,
      maxTextBytes: documentBytes ?? null,
      maxImageBytes: documentImageBytes,
      maxTotalTextBytes: documentTotalTextBytes ?? null,
      maxTotalMediaBytes: documentTotalMediaBytes,
      headBytes: null,
      headTotalBytes: null,
    },
  }
}
