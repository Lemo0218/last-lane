import { createHmac } from "node:crypto"

type Limits = Readonly<{ burst: number; sustained: number }>
type Bucket = { second: number; minute: number; burst: number; sustained: number }

export class LayeredRateLimiter {
  readonly #buckets = new Map<string, Bucket>()
  constructor(
    readonly salt: string,
    readonly limits: Limits,
    readonly maxBuckets = 10_000,
  ) {}
  allow(ip: string, now = Date.now()): boolean {
    const key = createHmac("sha256", this.salt).update(ip).digest("hex")
    const second = Math.floor(now / 1_000)
    const minute = Math.floor(now / 60_000)
    for (const [storedKey, stored] of this.#buckets) {
      if (stored.minute < minute - 1) this.#buckets.delete(storedKey)
    }
    if (!this.#buckets.has(key) && this.#buckets.size >= this.maxBuckets) {
      const oldest = this.#buckets.keys().next().value
      if (oldest !== undefined) this.#buckets.delete(oldest)
    }
    const prior = this.#buckets.get(key)
    const bucket: Bucket = {
      second,
      minute,
      burst: prior?.second === second ? prior.burst + 1 : 1,
      sustained: prior?.minute === minute ? prior.sustained + 1 : 1,
    }
    this.#buckets.set(key, bucket)
    return bucket.burst <= this.limits.burst && bucket.sustained <= this.limits.sustained
  }
  toJSON(): Readonly<{ size: number }> {
    return { size: this.#buckets.size }
  }
}
