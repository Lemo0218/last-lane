import { expect, it } from "vitest"
import { InMemoryBlobAdapter } from "../../src/server/blob-store"
import { DistributedRateLimiter, trustedClientIp } from "../../src/server/distributed-rate-limit"
import { LayeredRateLimiter } from "../../src/server/rate-limit"

it("throttles a burst without retaining raw IP addresses", () => {
  const limiter = new LayeredRateLimiter("salt", { burst: 2, sustained: 3 })
  expect(limiter.allow("203.0.113.1", 0)).toBe(true)
  expect(limiter.allow("203.0.113.1", 1)).toBe(true)
  expect(limiter.allow("203.0.113.1", 2)).toBe(false)
  expect(JSON.stringify(limiter)).not.toContain("203.0.113.1")
})

it("shares concurrent slot claims across limiter instances", async () => {
  const adapter = new InMemoryBlobAdapter()
  const options = { kind: "submit" as const, windowMs: 60_000, slots: 2 }
  const headers = new Headers({ "x-real-ip": "203.0.113.7" })
  const limiters = [1, 2, 3].map(
    () => new DistributedRateLimiter(adapter, "secret", options, () => 1),
  )
  const decisions = await Promise.all(limiters.map((limiter) => limiter.allow(headers)))
  expect(decisions.filter(Boolean)).toHaveLength(2)
})

it("prefers Vercel trusted IP headers over spoofed forwarded-for", () => {
  const headers = new Headers({
    "x-vercel-forwarded-for": "2001:db8::1",
    "x-real-ip": "203.0.113.2",
    "x-forwarded-for": "198.51.100.99",
  })
  expect(trustedClientIp(headers)).toBe("2001:db8::1")
})

it("cleans expired distributed windows without retaining raw IPs", async () => {
  let now = 1
  const adapter = new InMemoryBlobAdapter()
  const limiter = new DistributedRateLimiter(
    adapter,
    "secret",
    { kind: "ticket", windowMs: 1_000, slots: 1 },
    () => now,
  )
  await limiter.allow(new Headers({ "x-real-ip": "203.0.113.8" }))
  now = 3_001
  await limiter.allow(new Headers({ "x-real-ip": "203.0.113.8" }))
  const stored = await adapter.list("ratelimit/ticket/", 100)
  expect(stored.some((item) => item.pathname.startsWith("ratelimit/ticket/0/"))).toBe(false)
  expect(JSON.stringify(stored)).not.toContain("203.0.113.8")
})

it("prunes expired buckets and bounds retained hashes", () => {
  const limiter = new LayeredRateLimiter("salt", { burst: 2, sustained: 3 }, 2)
  limiter.allow("one", 0)
  limiter.allow("two", 0)
  limiter.allow("three", 0)
  expect(JSON.stringify(limiter)).toContain('"size":2')
  limiter.allow("fresh", 180_000)
  expect(JSON.stringify(limiter)).toContain('"size":1')
})
