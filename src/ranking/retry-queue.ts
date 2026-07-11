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
  return {
    enqueue: (submission: Submission): void =>
      write(
        [
          ...read().filter((item) => item.ticket.token !== submission.ticket.token),
          submission,
        ].slice(-8),
      ),
    size: (): number => read().length,
    flush: async (
      submit: (value: Submission) => Promise<Readonly<{ accepted: true; rank: number }>>,
    ): Promise<readonly AcceptedRetry[]> => {
      const pending = read()
      const retained: Submission[] = []
      const accepted: AcceptedRetry[] = []
      for (const item of pending) {
        if (now() >= item.ticket.deadlineMs) continue
        try {
          const result = await submit(item)
          accepted.push({ submission: item, rank: result.rank })
        } catch (error) {
          if (error instanceof TypeError) retained.push(item)
          else throw error
        }
      }
      write(retained)
      return accepted
    },
  }
}
