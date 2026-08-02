declare module '@opentui/core' {
  interface BoxOptions {
    /**
     * Whether the box can be selected by pointer events.
     * Mirrors the public `selectable` field on the underlying Renderable.
     */
    selectable?: boolean
  }
}

export {}
