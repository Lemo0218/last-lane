import { RankingStore, VercelBlobAdapter } from "../src/server/blob-store"

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST" && request.method !== "GET")
    return Response.json({ error: "method not allowed" }, { status: 405 })
  const secret = process.env["CRON_SECRET"]
  if (secret === undefined)
    return Response.json({ error: "reconciliation unavailable" }, { status: 503 })
  if (request.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ error: "unauthorized" }, { status: 401 })
  if (process.env["BLOB_READ_WRITE_TOKEN"] === undefined)
    return Response.json({ error: "ranked service unavailable" }, { status: 503 })
  return Response.json(await new RankingStore(new VercelBlobAdapter()).reconcile())
}
