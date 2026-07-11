import type { Transcript } from "../game/transcript"
import type { RunTicket, Submission } from "./client"

type RankedOutcome =
  | Readonly<{ kind: "ranked"; rank: number }>
  | Readonly<{ kind: "queued" }>
  | Readonly<{ kind: "unranked" }>
type Dependencies = Readonly<{
  requestTicket: () => Promise<RunTicket>
  submit: (submission: Submission) => Promise<Readonly<{ accepted: true; rank: number }>>
  enqueue: (submission: Submission) => void
  now?: () => number
}>

export const createRankedRun = ({
  requestTicket,
  submit,
  enqueue,
  now = Date.now,
}: Dependencies) => {
  let ticket: RunTicket | undefined
  return {
    start: async (): Promise<boolean> => {
      try {
        ticket = await requestTicket()
        return true
      } catch (error) {
        if (error instanceof Error) return false
        throw error
      }
    },
    finish: async (nickname: string, transcript: Transcript): Promise<RankedOutcome> => {
      if (ticket === undefined || now() >= ticket.deadlineMs) return { kind: "unranked" }
      const payload = { ticket, nickname, transcript }
      try {
        const result = await submit(payload)
        return { kind: "ranked", rank: result.rank }
      } catch (error) {
        if (!(error instanceof TypeError)) throw error
        enqueue(payload)
        return { kind: "queued" }
      }
    },
  }
}
