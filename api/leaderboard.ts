import { RankingStore, VercelBlobAdapter } from "../src/server/blob-store"

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET")
    return Response.json({ error: "method not allowed" }, { status: 405 })
  if (process.env["BLOB_READ_WRITE_TOKEN"] === undefined)
    return Response.json({ error: "ranked service unavailable" }, { status: 503 })
  try {
    const entries = (await new RankingStore(new VercelBlobAdapter()).leaderboard()).map(
      (entry, index) => ({
        rank: index + 1,
        nickname: entry.nickname,
        score: entry.score,
        survivalTicks: entry.survivalTicks,
      }),
    )
    return Response.json({ entries })
  } catch (error) {
    if (error instanceof Error)
      return Response.json({ error: "ranked service unavailable" }, { status: 503 })
    throw error
  }
}
