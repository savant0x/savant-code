export interface ListTablesParams {
  databaseUrl?: string
  outputFormat?: 'simple' | 'detailed'
}

export interface DescribeTableParams {
  databaseUrl?: string
  table: string
}

export interface ExecuteQueryParams {
  databaseUrl?: string
  query: string
  allowWrite?: boolean
}

export interface AnalyzeQueryParams {
  databaseUrl?: string
  query: string
}
