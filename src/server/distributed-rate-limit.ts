import { createHmac } from "node:crypto"
import { isIP } from "node:net"
import type { BlobAdapter } from "./blob-store"
import { BlobConflictError } from "./blob-store"

export type DistributedLimit = Readonly<{
  kind: "ticket" | "submit"
  windowMs: number
  slots: number
}>

const firstAddress = (value: string | null): string | undefined => {
  const candidate = value?.split(",")[0]?.trim().toLowerCase()
  if (candidate === undefined || isIP(candidate) === 0) return undefined
  return candidate
}

export const trustedClientIp = (headers: Headers): string =>
  firstAddress(headers.get("x-vercel-forwarded-for")) ??
  firstAddress(headers.get("x-real-ip")) ??
  firstAddress(headers.get("x-forwarded-for")) ??
  "unknown"

export class DistributedRateLimiter {
  constructor(
    readonly adapter: BlobAdapter,
    readonly secret: string,
    readonly limit: DistributedLimit,
    readonly now: () => number = Date.now,
  ) {}

  async allow(headers: Headers): Promise<boolean> {
    const now = this.now()
    const window = Math.floor(now / this.limit.windowMs)
    const hash = createHmac("sha256", this.secret).update(trustedClientIp(headers)).digest("hex")
    const prefix = `ratelimit/${this.limit.kind}/${window}/${hash}/`
    for (let slot = 0; slot < this.limit.slots; slot += 1) {
      try {
        await this.adapter.put(`${prefix}${slot}`, String(now), { allowOverwrite: false })
        await this.cleanup(window)
        return true
      } catch (error) {
        if (!(error instanceof BlobConflictError)) throw error
      }
    }
    await this.cleanup(window)
    return false
  }

  private async cleanup(currentWindow: number): Promise<void> {
    const objects = await this.adapter.list(`ratelimit/${this.limit.kind}/`, 100)
    const expired = objects.filter((item) => {
      const storedWindow = Number(item.pathname.split("/")[2])
      return Number.isInteger(storedWindow) && storedWindow < currentWindow - 1
    })
    await Promise.all(expired.map((item) => this.adapter.delete(item.pathname)))
  }
}
