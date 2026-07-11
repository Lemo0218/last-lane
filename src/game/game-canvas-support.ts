export type GameTelemetry = Readonly<{
  playerX: number
  wave: number
  zombies: number
  projectiles: number
  boss: boolean
  kills: number
  gates: number
  collectedGates: number
}>

export const INITIAL_GAME_TELEMETRY: GameTelemetry = {
  playerX: 500,
  wave: 1,
  zombies: 0,
  projectiles: 0,
  boss: false,
  kills: 0,
  gates: 0,
  collectedGates: 0,
}

export const GAME_E2E_ENABLED = import.meta.env.VITE_E2E === "true"

export const reportAudioFailure = (error: unknown): void => {
  console.warn("게임 오디오를 사용할 수 없습니다.", error instanceof Error ? error.message : error)
}
