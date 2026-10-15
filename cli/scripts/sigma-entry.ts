import Graph from 'graphology'
import Sigma from 'sigma'

const browserGlobal = globalThis as unknown as Record<string, unknown>
browserGlobal.Sigma = Sigma
browserGlobal.Graphology = Graph
