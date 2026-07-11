import { createHmac } from "node:crypto"

type Limits = Readonly<{ burst: number; sustained: number }>
type Bucket = { second: number; minute: number; burst: number; sustained: number }

export class LayeredRateLimiter {
  readonly #buckets = new Map<string, Bucket>()
  constructor(
    readonly salt: string,
    readonly limits: Limits,
  ) {}
  allow(ip: string, now = Date.now()): boolean {
    const key = createHmac("sha256", this.salt).update(ip).digest("hex")
    const second = Math.floor(now / 1_000)
    const minute = Math.floor(now / 60_000)
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
