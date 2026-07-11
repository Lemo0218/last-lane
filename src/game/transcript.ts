import { z } from "zod"

export const transcriptEntrySchema = z.object({
  tick: z.number().int().nonnegative().max(60_000),
  move: z.enum(["L", "N", "R"]),
})
export const transcriptSchema = z.array(transcriptEntrySchema).max(2_400)
export type TranscriptEntry = z.infer<typeof transcriptEntrySchema>
export type Transcript = z.infer<typeof transcriptSchema>

const movementCode = (movement: -1 | 0 | 1): TranscriptEntry["move"] => {
  if (movement === -1) return "L"
  if (movement === 1) return "R"
  return "N"
}

export const createTranscriptRecorder = () => {
  let previous: TranscriptEntry["move"] = "N"
  const entries: TranscriptEntry[] = []
  return {
    record: (tick: number, movement: -1 | 0 | 1): void => {
      const move = movementCode(movement)
      if (move === previous) return
      entries.push(transcriptEntrySchema.parse({ tick, move }))
      previous = move
    },
    snapshot: (): Transcript => transcriptSchema.parse(entries),
  }
}
