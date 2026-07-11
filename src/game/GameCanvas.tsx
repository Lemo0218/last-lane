import { useEffect, useRef, useState } from "react"
import { Hud, type HudStats } from "../ui/Hud"
import { PauseMenu } from "../ui/PauseMenu"
import { createGameAudio } from "./audio"
import { advanceFrame, type FrameClock } from "./frame-clock"
import { createInputController } from "./input"
import { renderGame, resizeCanvas } from "./renderer"
import type { SimulationState } from "./types"
import { type ActiveWave, createWaveRuntime } from "./wave-runtime"

const INITIAL_STATS: HudStats = {
  score: 0,
  elapsedMs: 0,
  squad: 3,
  maximumSquad: 3,
  combo: 0,
  difficulty: 1,
}
const statsOf = (state: SimulationState, kills: number, active: ActiveWave): HudStats => ({
  score: Math.floor(Number(state.distance) / 8) + kills * 100 + state.combo * 25,
  elapsedMs: active.elapsedBeforeMs + active.production.atMs,
  squad: state.squad,
  maximumSquad: state.maximumSquad,
  combo: state.combo,
  difficulty: active.index + 1,
})

export const GameCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const joystickRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<ReturnType<typeof createGameAudio> | null>(null)
  const pausedRef = useRef(false)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [stats, setStats] = useState(INITIAL_STATS)

  useEffect(() => {
    const canvas = canvasRef.current
    const joystick = joystickRef.current
    if (canvas === null || joystick === null) return
    const context = canvas.getContext("2d")
    if (context === null) return
    const input = createInputController(joystick)
    const audio = createGameAudio()
    audioRef.current = audio
    let runtime = createWaveRuntime()
    let frame = 0
    let clock: FrameClock = { previous: performance.now(), accumulator: 0 }
    let kills = 0
    let visible = !document.hidden
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const draw = (now: number): void => {
      const advanced = advanceFrame(clock, now, visible && !pausedRef.current)
      clock = advanced.clock
      for (let step = 0; step < advanced.steps; step += 1) {
        runtime = runtime.step(input.current())
        const state = runtime.active.production.simulation
        kills += state.events.filter((event) => event.kind === "zombie-killed").length
        audio.play(state.events)
      }
      const state = runtime.active.production.simulation
      renderGame(context, state, resizeCanvas(canvas), reducedMotion, runtime.active)
      if (advanced.steps > 0) setStats(statsOf(state, kills, runtime.active))
      frame = requestAnimationFrame(draw)
    }
    const visibility = (): void => {
      visible = !document.hidden
      clock = { previous: performance.now(), accumulator: 0 }
    }
    const unlock = (): void => {
      void audio.unlock()
    }
    document.addEventListener("visibilitychange", visibility)
    joystick.addEventListener("pointerdown", unlock, { once: true })
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      input.dispose()
      document.removeEventListener("visibilitychange", visibility)
      joystick.removeEventListener("pointerdown", unlock)
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
      <div ref={joystickRef} className="joystick" role="application" aria-label="이동 조이스틱">
        <span className="joystick-knob" />
      </div>
      {paused ? <PauseMenu onResume={togglePause} /> : null}
    </main>
  )
}
