import type { Transcript } from "../game/transcript"
import type { RunTicket, Submission } from "./client"

type RankedOutcome =
  | Readonly<{ kind: "ranked"; rank: number }>
  | Readonly<{ kind: "queued"; token: string }>
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
  let generation = 0
  return {
    start: async (): Promise<boolean> => {
      const currentGeneration = generation + 1
      generation = currentGeneration
      ticket = undefined
      try {
        const requested = await requestTicket()
        if (currentGeneration !== generation) return false
        ticket = requested
        return true
      } catch (error) {
        if (error instanceof Error) return false
        throw error
      }
    },
    finish: async (nickname: string, transcript: Transcript): Promise<RankedOutcome> => {
      if (ticket === undefined) return { kind: "unranked" }
      const consumedTicket = ticket
      ticket = undefined
      if (now() >= consumedTicket.deadlineMs) return { kind: "unranked" }
      const payload = { ticket: consumedTicket, nickname, transcript }
      try {
        const result = await submit(payload)
        return { kind: "ranked", rank: result.rank }
      } catch (error) {
        if (!(error instanceof TypeError)) {
          ticket = consumedTicket
          throw error
        }
        enqueue(payload)
        return { kind: "queued", token: payload.ticket.token }
      }
    },
  }
}
