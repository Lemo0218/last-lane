import { randomUUID } from "node:crypto"
import { del, get, list, put } from "@vercel/blob"
import { z } from "zod"
import { type RankedRun, rankedRunSchema } from "../api/contracts"

export type PutOptions = Readonly<{ allowOverwrite: boolean }>
export type Stored = Readonly<{ pathname: string; uploadedAt: number; body: string }>
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

export class InMemoryBlobAdapter implements BlobAdapter {
  readonly #objects = new Map<string, Stored>()
  constructor(readonly now: () => number = Date.now) {}
  async put(path: string, body: string, options: PutOptions): Promise<void> {
    if (!options.allowOverwrite && this.#objects.has(path)) throw new BlobConflictError()
    this.#objects.set(path, { pathname: path, uploadedAt: this.now(), body })
  }
  async get(path: string): Promise<Stored | undefined> {
    return this.#objects.get(path)
  }
  async list(prefix: string, limit: number): Promise<readonly Stored[]> {
    return [...this.#objects.values()]
      .filter((item) => item.pathname.startsWith(prefix))
      .sort((a, b) => a.pathname.localeCompare(b.pathname))
      .slice(0, limit)
  }
  async delete(path: string): Promise<void> {
    this.#objects.delete(path)
  }
}

export class VercelBlobAdapter implements BlobAdapter {
  async put(path: string, body: string, options: PutOptions): Promise<void> {
    try {
      await put(path, body, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: options.allowOverwrite,
      })
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("exist"))
        throw new BlobConflictError()
      throw error
    }
  }
  async get(path: string): Promise<Stored | undefined> {
    const result = await get(path, { access: "public" })
    if (result?.statusCode !== 200) return undefined
    return {
      pathname: path,
      uploadedAt: Date.now(),
      body: await new Response(result.stream).text(),
    }
  }
  async list(prefix: string, limit: number): Promise<readonly Stored[]> {
    const result = await list({ prefix, limit })
    return Promise.all(
      result.blobs.map(async (blob) => {
        const item = await this.get(blob.pathname)
        if (item === undefined) throw new Error(`missing blob ${blob.pathname}`)
        return { ...item, uploadedAt: blob.uploadedAt.getTime() }
      }),
    )
  }
  async delete(path: string): Promise<void> {
    await del(path)
  }
}

const MAX_SCORE = 9_999_999_999_999_999_999n
const canonical = (run: RankedRun): string => JSON.stringify(run)
const same = (stored: Stored, run: RankedRun): boolean => stored.body === canonical(run)
const sameResult = (left: RankedRun, right: RankedRun): boolean =>
  left.nonce === right.nonce &&
  left.ticketDigest === right.ticketDigest &&
  left.nickname === right.nickname &&
  left.score === right.score &&
  left.survivalTicks === right.survivalTicks
export const scorePath = (
  run: Pick<RankedRun, "score" | "survivalTicks" | "submittedAt" | "nonce">,
): string => {
  const invertedScore = (MAX_SCORE - BigInt(run.score)).toString().padStart(20, "0")
  const invertedTicks = (9_999_999_999 - run.survivalTicks).toString().padStart(10, "0")
  return `scores/${invertedScore}/${invertedTicks}/${run.submittedAt}/${run.nonce}.json`
}

export class RankingStore {
  constructor(
    readonly adapter: BlobAdapter,
    readonly now: () => number = Date.now,
  ) {}
  async repairExisting(run: RankedRun): Promise<RankedRun | undefined> {
    return this.withLease(run.nonce, () => this.repairExistingLocked(run))
  }
  private async repairExistingLocked(run: RankedRun): Promise<RankedRun | undefined> {
    const completed = await this.adapter.get(`runs/${run.nonce}.json`)
    if (completed !== undefined) {
      const storedRun = rankedRunSchema.parse(JSON.parse(completed.body))
      if (!sameResult(storedRun, run)) throw new RankingConflictError()
      return storedRun
    }
    const pendingPath = `pending/${run.nonce}.json`
    const pending = await this.adapter.get(pendingPath)
    if (pending === undefined) return undefined
    const storedRun = rankedRunSchema.parse(JSON.parse(pending.body))
    if (!sameResult(storedRun, run)) throw new RankingConflictError()
    await this.project(storedRun, pendingPath)
    return storedRun
  }
  async publish(run: RankedRun): Promise<RankedRun> {
    return this.withLease(run.nonce, () => this.publishLocked(run))
  }
  private async publishLocked(run: RankedRun): Promise<RankedRun> {
    const runPath = `runs/${run.nonce}.json`
    const existing = await this.adapter.get(runPath)
    if (existing !== undefined) {
      const storedRun = rankedRunSchema.parse(JSON.parse(existing.body))
      if (!sameResult(storedRun, run)) throw new RankingConflictError()
      return storedRun
    }
    const pendingPath = `pending/${run.nonce}.json`
    try {
      await this.adapter.put(pendingPath, canonical(run), { allowOverwrite: false })
    } catch (error) {
      if (!(error instanceof BlobConflictError)) throw error
      const pending = await this.adapter.get(pendingPath)
      if (pending === undefined) {
        const completed = await this.adapter.get(runPath)
        if (completed === undefined) throw new RankingConflictError()
        const storedRun = rankedRunSchema.parse(JSON.parse(completed.body))
        if (!sameResult(storedRun, run)) throw new RankingConflictError()
        return storedRun
      }
      const storedRun = rankedRunSchema.parse(JSON.parse(pending.body))
      if (!sameResult(storedRun, run)) throw new RankingConflictError()
      await this.project(storedRun, pendingPath)
      return storedRun
    }
    await this.project(run, pendingPath)
    return run
  }
  async project(run: RankedRun, pendingPath = `pending/${run.nonce}.json`): Promise<void> {
    await this.putMatching(scorePath(run), run)
    await this.putMatching(`runs/${run.nonce}.json`, run)
    await this.adapter.delete(pendingPath)
  }
  async leaderboard(): Promise<readonly RankedRun[]> {
    return (await this.adapter.list("scores/", 100)).map((item) =>
      rankedRunSchema.parse(JSON.parse(item.body)),
    )
  }
  async reconcile(now = Date.now()): Promise<{ repaired: number; failed: number }> {
    let repaired = 0,
      failed = 0
    for (const item of await this.adapter.list("pending/", 100)) {
      const candidate = rankedRunSchema.parse(JSON.parse(item.body))
      const result = await this.withLease(candidate.nonce, async () => {
        const current = await this.adapter.get(item.pathname)
        if (current === undefined) return "missing" as const
        const run = rankedRunSchema.parse(JSON.parse(current.body))
        if (now - current.uploadedAt > 24 * 60 * 60 * 1_000) {
          await this.putMatching(`failed/${run.nonce}.json`, run)
          await this.adapter.delete(item.pathname)
          return "failed" as const
        }
        await this.project(run, item.pathname)
        return "repaired" as const
      })
      if (result === "failed") failed += 1
      if (result === "repaired") repaired += 1
    }
    return { repaired, failed }
  }
  private async putMatching(path: string, run: RankedRun): Promise<void> {
    try {
      await this.adapter.put(path, canonical(run), { allowOverwrite: false })
    } catch (error) {
      if (!(error instanceof BlobConflictError)) throw error
      const existing = await this.adapter.get(path)
      if (existing === undefined || !same(existing, run)) throw new RankingConflictError()
    }
  }
  private async withLease<T>(nonce: string, operation: () => Promise<T>): Promise<T> {
    const path = `locks/${nonce}`
    const owner = randomUUID()
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const expiresAt = this.now() + 5_000
      try {
        await this.adapter.put(path, JSON.stringify({ owner, expiresAt }), {
          allowOverwrite: false,
        })
        try {
          return await operation()
        } finally {
          const held = await this.adapter.get(path)
          const parsed =
            held === undefined ? undefined : leaseSchema.safeParse(JSON.parse(held.body))
          if (parsed?.success === true && parsed.data.owner === owner)
            await this.adapter.delete(path)
        }
      } catch (error) {
        if (!(error instanceof BlobConflictError)) throw error
        const held = await this.adapter.get(path)
        const parsed = held === undefined ? undefined : leaseSchema.safeParse(JSON.parse(held.body))
        if (parsed?.success === true && parsed.data.expiresAt < this.now())
          await this.adapter.delete(path)
        await new Promise<void>((resolve) => setTimeout(resolve, 5))
      }
    }
    throw new RankingLeaseError()
  }
}

const leaseSchema = z.object({ owner: z.string().uuid(), expiresAt: z.number().int() })
