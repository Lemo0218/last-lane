import { expect, it } from "vitest"
import { LayeredRateLimiter } from "../../src/server/rate-limit"

it("throttles a burst without retaining raw IP addresses", () => {
  const limiter = new LayeredRateLimiter("salt", { burst: 2, sustained: 3 })
  expect(limiter.allow("203.0.113.1", 0)).toBe(true)
  expect(limiter.allow("203.0.113.1", 1)).toBe(true)
  expect(limiter.allow("203.0.113.1", 2)).toBe(false)
  expect(JSON.stringify(limiter)).not.toContain("203.0.113.1")
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
