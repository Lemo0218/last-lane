import { z } from "zod"

const tutorialKey = "last-lane:tutorial-v1"
const bestKey = "last-lane:best-v1"
const bestSchema = z.coerce.number().int().nonnegative().catch(0)

export const createLocalProgress = (storage: Storage) => ({
  hasCompletedTutorial: (): boolean => storage.getItem(tutorialKey) === "complete",
  completeTutorial: (): void => storage.setItem(tutorialKey, "complete"),
  best: (): number => bestSchema.parse(storage.getItem(bestKey) ?? 0),
  recordBest: (score: number): number => {
    const next = Math.max(bestSchema.parse(score), bestSchema.parse(storage.getItem(bestKey) ?? 0))
    storage.setItem(bestKey, String(next))
    return next
  },
})
