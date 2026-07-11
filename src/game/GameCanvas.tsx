import { useEffect, useRef, useState } from "react"
import { Hud } from "../ui/Hud"
import { PauseMenu } from "../ui/PauseMenu"
import { createGameAudio } from "./audio"
import { captureE2EGolden } from "./e2e-golden"
import { advanceFrame, type FrameClock } from "./frame-clock"
import { GAME_E2E_ENABLED, INITIAL_GAME_TELEMETRY, reportAudioFailure } from "./game-canvas-support"
import { createInputController } from "./input"
import { renderGame, resizeCanvas } from "./renderer"
import { accumulateRunScore, finalRunScore, INITIAL_RUN_SCORE } from "./run-score"
import { INITIAL_STATS, statsOf } from "./run-summary"
import type { ScoreBreakdown } from "./scoring"
import { generateWaveCandidate } from "./segment-generator"
import { solveWave } from "./solver"
import { createTranscriptRecorder, type Transcript } from "./transcript"
import { createWaveRuntime, type WaveRuntimeDependencies } from "./wave-runtime"

export const GameCanvas = ({
  audioFactory = createGameAudio,
  runtimeFactory = createWaveRuntime,
  seed = 0,
  onFinish,
}: Readonly<{
  audioFactory?: typeof createGameAudio
  runtimeFactory?: typeof createWaveRuntime
  seed?: number
  onFinish?: (result: Readonly<{ score: ScoreBreakdown; transcript: Transcript }>) => void
}>) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const joystickRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<ReturnType<typeof createGameAudio> | null>(null)
  const pausedRef = useRef(false)
  const focusBeforePauseRef = useRef<HTMLElement | null>(null)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(false)
  const [stats, setStats] = useState(INITIAL_STATS)
  const [telemetry, setTelemetry] = useState(INITIAL_GAME_TELEMETRY)

  useEffect(() => {
    const canvas = canvasRef.current
    const joystick = joystickRef.current
    if (canvas === null || joystick === null) return
    const context = canvas.getContext("2d")
    const input = createInputController(joystick)
    const audio = audioFactory()
    audioRef.current = audio
    const testMode = GAME_E2E_ENABLED
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
    let runtime = runtimeFactory(forcedTimeout, deterministicBoss ? 4 : 0, seed)
    let frame = 0
    let clock: FrameClock = { previous: performance.now(), accumulator: 0 }
    let scoreCounters = INITIAL_RUN_SCORE
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
        const previousDistance = Number(runtime.active.production.simulation.distance)
        const currentInput = input.current()
        transcript.record(tick, currentInput.moveX)
        tick += 1
        runtime = runtime.step(currentInput)
        const state = runtime.active.production.simulation
        const distanceDelta = Math.max(0, Number(state.distance) - previousDistance)
        scoreCounters = accumulateRunScore(scoreCounters, distanceDelta, state.events)
        audio.play(state.events)
        if (state.status !== "running") break
      }
      const state = runtime.active.production.simulation
      if (!finished && state.status !== "running") {
        finished = true
        const elapsedMs = runtime.active.elapsedBeforeMs + runtime.active.production.atMs
        const completedTranscript = transcript.snapshot(tick)
        const completedScore = finalRunScore(scoreCounters, elapsedMs)
        captureE2EGolden(
          GAME_E2E_ENABLED,
          seed,
          completedTranscript,
          completedScore,
          state,
          runtime.active.index,
        )
        onFinish?.({
          score: completedScore,
          transcript: completedTranscript,
        })
      }
      if (context !== null) renderGame(context, state, metrics, reducedMotion, runtime.active)
      if (advanced.steps > 0) {
        const elapsedMs = runtime.active.elapsedBeforeMs + runtime.active.production.atMs
        const currentScore = finalRunScore(scoreCounters, elapsedMs)
        setStats(statsOf(state, currentScore.total, runtime.active))
        setTelemetry({
          playerX: state.playerX,
          wave: runtime.active.index + 1,
          zombies: state.zombies.length,
          projectiles: state.projectiles.length,
          boss: state.zombies.some((zombie) => zombie.kind === "boss"),
          kills: scoreCounters.basicKills + scoreCounters.eliteKills + scoreCounters.bosses,
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
  }, [audioFactory, onFinish, runtimeFactory, seed])

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
      data-player-x={GAME_E2E_ENABLED ? telemetry.playerX : undefined}
      data-wave={GAME_E2E_ENABLED ? telemetry.wave : undefined}
      data-zombies={GAME_E2E_ENABLED ? telemetry.zombies : undefined}
      data-projectiles={GAME_E2E_ENABLED ? telemetry.projectiles : undefined}
      data-boss={GAME_E2E_ENABLED ? telemetry.boss : undefined}
      data-kills={GAME_E2E_ENABLED ? telemetry.kills : undefined}
      data-score={GAME_E2E_ENABLED ? stats.score : undefined}
      data-gates={GAME_E2E_ENABLED ? telemetry.gates : undefined}
      data-collected-gates={GAME_E2E_ENABLED ? telemetry.collectedGates : undefined}
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
