import { useEffect, useRef, useState } from "react"
import { Hud } from "../ui/Hud"
import { PauseMenu } from "../ui/PauseMenu"
import { createGameAudio } from "./audio"
import { advanceFrame, type FrameClock } from "./frame-clock"
import { createInputController } from "./input"
import { renderGame, resizeCanvas } from "./renderer"
import { INITIAL_STATS, scoreForCombat, statsOf } from "./run-summary"
import { generateWaveCandidate } from "./segment-generator"
import { solveWave } from "./solver"
import { createTranscriptRecorder, type Transcript } from "./transcript"
import { createWaveRuntime, type WaveRuntimeDependencies } from "./wave-runtime"

type Telemetry = Readonly<{
  playerX: number
  wave: number
  zombies: number
  projectiles: number
  boss: boolean
  kills: number
  gates: number
  collectedGates: number
}>
const INITIAL_TELEMETRY: Telemetry = {
  playerX: 500,
  wave: 1,
  zombies: 0,
  projectiles: 0,
  boss: false,
  kills: 0,
  gates: 0,
  collectedGates: 0,
}
const E2E_ENABLED = import.meta.env.VITE_E2E === "true"
const reportAudioFailure = (error: unknown): void => {
  console.warn("게임 오디오를 사용할 수 없습니다.", error instanceof Error ? error.message : error)
}

export const GameCanvas = ({
  audioFactory = createGameAudio,
  onFinish,
}: Readonly<{
  audioFactory?: typeof createGameAudio
  onFinish?: (
    result: Readonly<{ score: number; kills: number; elapsedMs: number; transcript: Transcript }>,
  ) => void
}>) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const joystickRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<ReturnType<typeof createGameAudio> | null>(null)
  const pausedRef = useRef(false)
  const focusBeforePauseRef = useRef<HTMLElement | null>(null)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [stats, setStats] = useState(INITIAL_STATS)
  const [telemetry, setTelemetry] = useState(INITIAL_TELEMETRY)

  useEffect(() => {
    const canvas = canvasRef.current
    const joystick = joystickRef.current
    if (canvas === null || joystick === null) return
    const context = canvas.getContext("2d")
    const input = createInputController(joystick)
    const audio = audioFactory()
    audioRef.current = audio
    const testMode = E2E_ENABLED
      ? new URLSearchParams(window.location.search).get("testMode")
      : null
    const deterministicBoss = testMode === "boss" || testMode === "timeout-boss"
    const forcedTimeout: WaveRuntimeDependencies | undefined = testMode?.startsWith("timeout")
      ? {
          candidate: generateWaveCandidate,
          solve: (entry, segment) =>
            solveWave(entry, segment, { budgetMs: 0, clock: { now: () => 0 } }),
        }
      : undefined
    let runtime = createWaveRuntime(forcedTimeout, deterministicBoss ? 4 : 0)
    let frame = 0
    let clock: FrameClock = { previous: performance.now(), accumulator: 0 }
    let kills = 0
    let tick = 0
    let finished = false
    const transcript = createTranscriptRecorder()
    let visible = !document.hidden
    let metrics = resizeCanvas(canvas)
    const resize = (): void => {
      metrics = resizeCanvas(canvas)
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const draw = (now: number): void => {
      const advanced = advanceFrame(clock, now, visible && !pausedRef.current)
      clock = advanced.clock
      for (let step = 0; step < advanced.steps; step += 1) {
        const currentInput = input.current()
        transcript.record(tick, currentInput.moveX)
        tick += 1
        runtime = runtime.step(currentInput)
        const state = runtime.active.production.simulation
        kills += state.events.filter((event) => event.kind === "zombie-killed").length
        audio.play(state.events)
      }
      const state = runtime.active.production.simulation
      if (!finished && state.status !== "running") {
        finished = true
        onFinish?.({
          score: scoreForCombat(state, kills),
          kills,
          elapsedMs: runtime.active.elapsedBeforeMs + runtime.active.production.atMs,
          transcript: transcript.snapshot(),
        })
      }
      if (context !== null) renderGame(context, state, metrics, reducedMotion, runtime.active)
      if (advanced.steps > 0) {
        setStats(statsOf(state, kills, runtime.active))
        setTelemetry({
          playerX: state.playerX,
          wave: runtime.active.index + 1,
          zombies: state.zombies.length,
          projectiles: state.projectiles.length,
          boss: state.zombies.some((zombie) => zombie.kind === "boss"),
          kills,
          gates: runtime.active.segment.gates.filter(
            (gate) => !runtime.active.production.collectedGateIds.has(gate.id),
          ).length,
          collectedGates: runtime.active.production.collectedGateIds.size,
        })
      }
      frame = requestAnimationFrame(draw)
    }
    const visibility = (): void => {
      visible = !document.hidden
      clock = { previous: performance.now(), accumulator: 0 }
    }
    let audioUnlocked = false
    let audioUnlocking = false
    const unlock = (): void => {
      if (audioUnlocked || audioUnlocking) return
      audioUnlocking = true
      void audio
        .unlock()
        .then(() => {
          audioUnlocked = true
          joystick.removeEventListener("pointerdown", unlock)
        })
        .catch(reportAudioFailure)
        .finally(() => {
          audioUnlocking = false
        })
    }
    document.addEventListener("visibilitychange", visibility)
    window.addEventListener("resize", resize)
    joystick.addEventListener("pointerdown", unlock)
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      input.dispose()
      document.removeEventListener("visibilitychange", visibility)
      window.removeEventListener("resize", resize)
      joystick.removeEventListener("pointerdown", unlock)
      void audio.close().catch(reportAudioFailure)
      audioRef.current = null
    }
  }, [audioFactory, onFinish])

  const togglePause = (): void => {
    if (!pausedRef.current && document.activeElement instanceof HTMLElement)
      focusBeforePauseRef.current = document.activeElement
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
    if (!pausedRef.current)
      queueMicrotask(() => {
        focusBeforePauseRef.current?.focus()
      })
  }

  return (
    <main
      className="game-shell"
      data-player-x={E2E_ENABLED ? telemetry.playerX : undefined}
      data-wave={E2E_ENABLED ? telemetry.wave : undefined}
      data-zombies={E2E_ENABLED ? telemetry.zombies : undefined}
      data-projectiles={E2E_ENABLED ? telemetry.projectiles : undefined}
      data-boss={E2E_ENABLED ? telemetry.boss : undefined}
      data-kills={E2E_ENABLED ? telemetry.kills : undefined}
      data-score={E2E_ENABLED ? stats.score : undefined}
      data-gates={E2E_ENABLED ? telemetry.gates : undefined}
      data-collected-gates={E2E_ENABLED ? telemetry.collectedGates : undefined}
    >
      <output className="sr-only" aria-live="polite">
        웨이브 {telemetry.wave}, 좀비 {telemetry.zombies}, 탄환 {telemetry.projectiles}
      </output>
      <Hud stats={stats} />
      <canvas
        ref={canvasRef}
        className="game-canvas"
        aria-label="라스트 레인 게임 화면"
        tabIndex={paused ? -1 : 0}
        inert={paused}
      />
      <div className="game-controls" inert={paused}>
        <button
          type="button"
          aria-label={paused ? "게임 계속" : "게임 일시정지"}
          onClick={togglePause}
          disabled={paused}
        >
          {paused ? "▶" : "Ⅱ"}
        </button>
        <button
          type="button"
          aria-label={muted ? "소리 켜기" : "소리 끄기"}
          disabled={paused}
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
      <div
        ref={joystickRef}
        className="joystick"
        role="slider"
        aria-label="이동 조이스틱"
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-valuenow={0}
        aria-valuetext="중립"
        aria-describedby="joystick-help"
        tabIndex={paused ? -1 : 0}
        inert={paused}
      >
        <span className="joystick-knob" />
      </div>
      <span id="joystick-help" className="sr-only">
        좌우로 드래그하거나 방향키 또는 A D 키를 사용하세요.
      </span>
      {paused ? <PauseMenu onResume={togglePause} /> : null}
    </main>
  )
}
