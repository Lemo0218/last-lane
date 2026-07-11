export type PutOptions = Readonly<{ allowOverwrite: boolean; ifMatch?: string }>
export type Stored = Readonly<{
  pathname: string
  uploadedAt: number
  body: string
  etag: string
}>

export interface BlobAdapter {
  put(path: string, body: string, options: PutOptions): Promise<void>
  get(path: string): Promise<Stored | undefined>
  list(prefix: string, limit: number): Promise<readonly Stored[]>
  delete(path: string): Promise<void>
}

export class BlobConflictError extends Error {
  constructor() {
    super("blob conflict")
    this.name = "BlobConflictError"
  }
}

export class RankingConflictError extends Error {
  constructor() {
    super("nonce conflict")
    this.name = "RankingConflictError"
  }
}

export class RankingLeaseError extends Error {
  constructor() {
    super("ranking lease unavailable")
    this.name = "RankingLeaseError"
  }
}
