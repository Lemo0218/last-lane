import { randomUUID } from "node:crypto"
import { z } from "zod"
import {
  type BlobAdapter,
  BlobConflictError,
  RankingLeaseError,
  type Stored,
} from "./blob-contract"

const leaseSchema = z.object({
  status: z.enum(["held", "released"]),
  owner: z.string().uuid(),
  acquiredAt: z.number().int(),
  expiresAt: z.number().int(),
})

export const withPublicationLease = async <T>(
  adapter: BlobAdapter,
  now: () => number,
  nonce: string,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> => {
  const path = `locks/${nonce}`
  const owner = randomUUID()
  let acquired: Stored | undefined
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const acquiredAt = now()
    const record = { status: "held" as const, owner, acquiredAt, expiresAt: acquiredAt + 30_000 }
    try {
      await adapter.put(path, JSON.stringify(record), { allowOverwrite: false })
      acquired = await adapter.get(path)
      break
    } catch (error) {
      if (!(error instanceof BlobConflictError)) throw error
      const current = await adapter.get(path)
      const parsed =
        current === undefined ? undefined : leaseSchema.safeParse(JSON.parse(current.body))
      if (
        current !== undefined &&
        parsed?.success === true &&
        (parsed.data.status === "released" || parsed.data.expiresAt <= now())
      ) {
        try {
          await adapter.put(path, JSON.stringify(record), {
            allowOverwrite: true,
            ifMatch: current.etag,
          })
          acquired = await adapter.get(path)
          break
        } catch (takeoverError) {
          if (!(takeoverError instanceof BlobConflictError)) throw takeoverError
        }
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 5))
    }
  }
  if (acquired === undefined) throw new RankingLeaseError()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 9_000)
  let outcome: Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: unknown }>
  try {
    const value = await operation(controller.signal)
    if (controller.signal.aborted) throw new RankingLeaseError()
    outcome = { ok: true, value }
  } catch (error) {
    outcome = { ok: false, error }
  }
  clearTimeout(timeout)
  const current = await adapter.get(path)
  const parsed = current === undefined ? undefined : leaseSchema.safeParse(JSON.parse(current.body))
  if (
    current !== undefined &&
    parsed?.success === true &&
    parsed.data.status === "held" &&
    parsed.data.owner === owner
  ) {
    try {
      await adapter.put(path, JSON.stringify({ ...parsed.data, status: "released" as const }), {
        allowOverwrite: true,
        ifMatch: current.etag,
      })
    } catch (error) {
      if (!(error instanceof BlobConflictError)) throw error
    }
  }
  if (!outcome.ok) throw outcome.error
  return outcome.value
}
