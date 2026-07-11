import { useEffect, useRef, useState } from "react"
import { Hud, type HudStats } from "../ui/Hud"
import { PauseMenu } from "../ui/PauseMenu"
import { createGameAudio } from "./audio"
import { STEP_MS } from "./config"
import { createInputController } from "./input"
import { renderGame, resizeCanvas } from "./renderer"
import { createSimulation, stepSimulation } from "./simulation"
import type { Gate, GateKind, SimulationState } from "./types"
import { position, tick } from "./types"

const INITIAL_STATS: HudStats = {
  score: 0,
  elapsedMs: 0,
  squad: 3,
  maximumSquad: 3,
  combo: 0,
  difficulty: 1,
}
const GATE_KINDS = [
  "troop",
  "damage",
  "fire-rate",
  "recovery",
] as const satisfies readonly GateKind[]

const generatedGates = (state: SimulationState): SimulationState => {
  const segment = Math.floor(Number(state.elapsedMs) / 6000)
  if (segment === 0 || Number(state.elapsedMs) % 6000 !== 0 || state.gates.length > 0) return state
  const kind = GATE_KINDS[segment % GATE_KINDS.length] ?? "troop"
  const lane = segment % 3
  const gate: Gate = { id: state.nextEntityId, kind, x: position(250 + lane * 250), level: 1 }
  return { ...state, gates: [gate], nextEntityId: state.nextEntityId + 1 }
}

const statsOf = (state: SimulationState, kills: number): HudStats => ({
  score: Math.floor(Number(state.distance) / 8) + kills * 100 + state.combo * 25,
  elapsedMs: Number(state.elapsedMs),
  squad: state.squad,
  maximumSquad: state.maximumSquad,
  combo: state.combo,
  difficulty: Math.floor(Number(state.elapsedMs) / 30000) + 1,
})

export const GameCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<ReturnType<typeof createGameAudio> | null>(null)
  const pausedRef = useRef(false)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [stats, setStats] = useState(INITIAL_STATS)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const context = canvas.getContext("2d")
    if (context === null) return
    const input = createInputController(canvas)
    const audio = createGameAudio()
    audioRef.current = audio
    let state = createSimulation(
      0x1a57_1a9e,
      { troop: 0, damage: 0, fireRate: 0, recovery: 0 },
      { playerX: 500 },
    )
    let frame = 0
    let previous = performance.now()
    let accumulator = 0
    let kills = 0
    let visible = !document.hidden
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const draw = (now: number): void => {
      const delta = Math.min(100, Math.max(0, now - previous))
      previous = now
      if (visible && !pausedRef.current) accumulator += delta
      let steps = 0
      while (accumulator >= STEP_MS && steps < 8) {
        state = generatedGates(stepSimulation(state, input.current(), tick(STEP_MS)))
        kills += state.events.filter((event) => event.kind === "zombie-killed").length
        audio.play(state.events)
        accumulator -= STEP_MS
        steps += 1
      }
      if (steps === 8) accumulator = 0
      renderGame(context, state, resizeCanvas(canvas), reducedMotion)
      if (steps > 0) setStats(statsOf(state, kills))
      frame = requestAnimationFrame(draw)
    }
    const visibility = (): void => {
      visible = !document.hidden
      previous = performance.now()
      accumulator = 0
    }
    const unlock = (): void => {
      void audio.unlock()
    }
    document.addEventListener("visibilitychange", visibility)
    canvas.addEventListener("pointerdown", unlock, { once: true })
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      input.dispose()
      document.removeEventListener("visibilitychange", visibility)
      canvas.removeEventListener("pointerdown", unlock)
      void audio.close()
      audioRef.current = null
    }
  }, [])

  const togglePause = (): void => {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
  }

  return (
    <main className="game-shell">
      <Hud stats={stats} />
      <canvas
        ref={canvasRef}
        className="game-canvas"
        aria-label="라스트 레인 게임 화면"
        tabIndex={0}
      />
      <div className="game-controls">
        <button
          type="button"
          aria-label={paused ? "게임 계속" : "게임 일시정지"}
          onClick={togglePause}
        >
          {paused ? "▶" : "Ⅱ"}
        </button>
        <button
          type="button"
          aria-label={muted ? "소리 켜기" : "소리 끄기"}
          onClick={() =>
            setMuted((value) => {
              audioRef.current?.setMuted(!value)
              return !value
            })
          }
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </div>
      {paused ? <PauseMenu onResume={togglePause} /> : null}
    </main>
  )
}
