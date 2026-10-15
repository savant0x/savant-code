/**
 * Code Universe renderer-neutral payload types (FID-2026-0807-002).
 * Extracted from export-serializer.ts by FID-2026-0809-011 Phase A.
 * No behavior change — pure module split.
 */
export interface GraphPosition {
  x: number
  y: number
}

export interface UniverseRegion {
  id: string
  label: string
  path: string
  fileCount: number
  edgeCount: number
  position: GraphPosition
  size: number
  color: string
  cluster: number | null
  disconnected: boolean
}

export interface UniverseFile {
  id: string
  label: string
  path: string
  regionId: string
  cluster: number | null
  position: GraphPosition
  size: number
  importance: number
  /** Optional sidebar preview, present only when previews are explicitly enabled. */
  preview?: string
}

export interface UniverseFolder {
  id: string
  label: string
  path: string
  parentId: string | null
  childIds: string[]
}

export interface UniverseTextDocument {
  kind: 'text'
  text: string
  lineCount: number
  byteCount: number
  truncated: boolean
  /** True when an explicit positive document option capped the text. */
  explicitlyCapped?: boolean
  /** @deprecated Retained for consumers compiled against the preview-era shape. */
  preview?: boolean
}

export interface UniverseImageDocument {
  kind: 'image'
  mime: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'
  dataUri: string
  byteCount: number
  truncated: false
}

export interface UniverseUnavailableDocument {
  kind: 'unavailable'
  // A null byte count means containment/readability prevented a safe stat/read.
  byteCount: number | null
  unavailableReason:
    | 'binary'
    | 'unsupported-image'
    | 'malformed-image'
    | 'oversized'
    | 'unreadable'
    | 'outside-root'
}

export type UniverseDocument =
  UniverseTextDocument | UniverseImageDocument | UniverseUnavailableDocument

export interface UniverseDocumentPolicy {
  enabled: boolean
  /** `null` means unlimited by default; positive values are explicit caps. */
  maxTextLines: number | null
  maxTextBytes: number | null
  maxImageBytes: number
  maxTotalTextBytes: number | null
  maxTotalMediaBytes: number
  /** @deprecated Head previews were removed from the default text path. */
  headBytes: number | null
  /** @deprecated Head previews were removed from the default text path. */
  headTotalBytes: number | null
}

export interface UniverseEdge {
  id: string
  source: string
  target: string
  type: string
  weight: number
}

export interface UniverseCorridor {
  id: string
  source: string
  target: string
  edgeCount: number
  totalWeight: number
  typeCounts: Record<string, number>
  underlyingEdgeIds: string[]
}

export interface GraphUniverse {
  regions: UniverseRegion[]
  files: UniverseFile[]
  edges: UniverseEdge[]
  corridors: UniverseCorridor[]
  folders: UniverseFolder[]
  rootFolderId: string
  documents: Record<string, UniverseDocument>
  documentPolicy: UniverseDocumentPolicy
  /**
   * Precomputed search index (FID-2026-0807-020): systems, folders, and files
   * with scored metadata. Built at export time so the browser performs zero
   * index construction on load.
   */
  searchIndex: Array<{
    id: string
    kind: 'system' | 'folder' | 'file'
    label: string
    path: string
  }>
}

export interface GraphExportElement {
  data: {
    id: string
    label: string
    path?: string
    type?: string
    cluster?: number | null
    weight?: number
    source?: string
    target?: string
    preview?: string
    containerId?: string
    parent?: string
    container?: boolean
    /**
     * FID-2026-0806-018: compact overview center for container atoms and
     * ungrouped root files (the initially visible set). Present only on
     * overview-level elements; child nodes instead carry `childOffset`.
     */
    overviewPosition?: GraphPosition
    /**
     * FID-2026-0806-018: stable expansion anchor for a container — its compact
     * overview center (the same point as its collapsed position). The browser
     * positions children at `anchor + childOffset` on expand so they center on
     * the container, and never trusts the live parent position (compound
     * bounds shift when children become visible).
     */
    overviewAnchor?: GraphPosition
    /**
     * FID-2026-0806-018: center-frame offset of this child relative to its
     * container's `overviewAnchor`. Present only on container child nodes.
     */
    childOffset?: GraphPosition
  }
  /** Export-time precomputed position (FID-2026-0806-017); absent for edges. */
  position?: GraphPosition
}

export interface GraphExport {
  /** ISO timestamp of serialization. */
  generatedAt: string
  /** Top-level dirs count (for the meta grid). */
  meta: {
    files: number
    nodes: number
    edges: number
    clusters: number
  }
  /**
   * Internal layout view consumed by `computeGraphLayout` at export time only
   * (FID-2026-0807-020). Not part of the serialized artifact payload — the
   * template strips it before embedding so the shipped HTML carries only
   * `universe`.
   */
  elements: GraphExportElement[]
  /** Renderer-neutral Code Universe payload. */
  universe: GraphUniverse
}

export interface GraphExportOptions {
  /** Project root used to resolve relative file paths for previews. */
  projectRoot?: string
  /** Max preview lines per file (default 20). */
  previewLines?: number
  /** Max preview characters per file (default 2,000). */
  previewChars?: number
  /** Enable document bodies in the offline browser. */
  documents?: boolean
  /** Positive cap; omitted/invalid values leave text unlimited. */
  documentLines?: number
  /** Positive cap; omitted/invalid values leave text unlimited. */
  documentBytes?: number
  /** Max source bytes for a single embedded raster image (default 2 MiB). */
  documentImageBytes?: number
  /** Positive aggregate cap; omitted/invalid values leave text unlimited. */
  documentTotalTextBytes?: number
  /** Max aggregate embedded raster bytes (default 16 MiB). */
  documentTotalMediaBytes?: number
  /** @deprecated Accepted for source compatibility; no default head pool remains. */
  documentHeadBytes?: number
  /** @deprecated Accepted for source compatibility; no default head pool remains. */
  documentHeadTotalBytes?: number
  /**
   * Export-time precomputed positions, keyed by node element id
   * (FID-2026-0806-017). When provided, each node carries a `position` so the
   * browser runs Cytoscape's zero-math `preset` layout.
   */
  positions?: Record<string, GraphPosition>
  /**
   * Export-time container assignments, keyed by node element id
   * (FID-2026-0806-017, container-based drill-down).
   */
  containerIds?: Record<string, string>
  /**
   * Container atoms to emit as compound parent nodes (drill-down). Carries
   * id + label; `position` is read from `positions` like file nodes.
   */
  containers?: Array<{ id: string; label: string }>
  /**
   * FID-2026-0806-018: compact overview centers keyed by element id
   * (container atoms + ungrouped root files). Emitted as `overviewPosition`
   * on the overview-level elements so the collapsed overview is compact by
   * construction.
   */
  overviewPositions?: Record<string, GraphPosition>
  /**
   * FID-2026-0806-018: stable container expansion anchors keyed by container
   * element id; emitted as `overviewAnchor` on container atoms.
   */
  overviewAnchors?: Record<string, GraphPosition>
  /**
   * FID-2026-0806-018: per-container child center-frame offsets keyed by
   * container id then child element id; emitted as `childOffset` on children.
   */
  childOffsets?: Record<string, Record<string, GraphPosition>>
}
