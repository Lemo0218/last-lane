import { z } from "zod"
import { type Submission, submissionSchema } from "./client"

const queueKey = "last-lane:ranking-retry-v1"
const queueSchema = z.array(submissionSchema).max(8)
type AcceptedRetry = Readonly<{ submission: Submission; rank: number }>

export const createRetryQueue = ({
  storage,
  now = Date.now,
}: Readonly<{ storage: Storage; now?: () => number }>) => {
  const read = (): Submission[] => {
    const serialized = storage.getItem(queueKey)
    if (serialized === null) return []
    try {
      return queueSchema.catch([]).parse(JSON.parse(serialized))
    } catch (error) {
      if (error instanceof SyntaxError) return []
      throw error
    }
  }
  const write = (items: readonly Submission[]): void =>
    storage.setItem(queueKey, JSON.stringify(items))
  let activeFlush: Promise<readonly AcceptedRetry[]> | undefined
  const removeToken = (token: string): void =>
    write(read().filter((item) => item.ticket.token !== token))
  const flushItems = async (
    submit: (value: Submission) => Promise<Readonly<{ accepted: true; rank: number }>>,
  ): Promise<readonly AcceptedRetry[]> => {
    const accepted: AcceptedRetry[] = []
    for (const item of read()) {
      if (now() >= item.ticket.deadlineMs) {
        removeToken(item.ticket.token)
        continue
      }
      try {
        const result = await submit(item)
        accepted.push({ submission: item, rank: result.rank })
        removeToken(item.ticket.token)
      } catch (error) {
        if (!(error instanceof TypeError)) throw error
      }
    }
    return accepted
  }
  return {
    enqueue: (submission: Submission): void =>
      write(
        [
          ...read().filter((item) => item.ticket.token !== submission.ticket.token),
          submission,
        ].slice(-8),
      ),
    size: (): number => read().length,
    flush: (
      submit: (value: Submission) => Promise<Readonly<{ accepted: true; rank: number }>>,
    ): Promise<readonly AcceptedRetry[]> => {
      if (activeFlush !== undefined) return activeFlush
      activeFlush = flushItems(submit).finally(() => {
        activeFlush = undefined
      })
      return activeFlush
    },
  }
}
