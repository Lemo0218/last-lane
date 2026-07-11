import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { GameCanvas } from "./game/GameCanvas"
import type { ScoreBreakdown } from "./game/scoring"
import type { Transcript } from "./game/transcript"
import type { createWaveRuntime } from "./game/wave-runtime"
import { createRankingClient, type LeaderboardResult } from "./ranking/client"
import { createRankedRun } from "./ranking/ranked-run"
import { createRetryQueue } from "./ranking/retry-queue"
import { createLocalProgress } from "./storage/local"
import { Leaderboard } from "./ui/Leaderboard"
import { type ResultScore, ResultScreen } from "./ui/ResultScreen"
import { StartScreen } from "./ui/StartScreen"
import { Tutorial } from "./ui/Tutorial"

type Screen = "start" | "playing" | "result" | "leaderboard"
type CompletedRun = Readonly<{ id: number; score: ResultScore; transcript: Transcript }>
type SubmissionState = "idle" | "pending" | "accepted" | "queued" | "failed"

type AppProps = Readonly<{
  rankingClient?: ReturnType<typeof createRankingClient>
  storage?: Storage
  runtimeFactory?: typeof createWaveRuntime
}>

export function App({ rankingClient, storage = localStorage, runtimeFactory }: AppProps = {}) {
  const progress = useMemo(() => createLocalProgress(storage), [storage])
  const client = useMemo(() => rankingClient ?? createRankingClient(), [rankingClient])
  const queue = useMemo(() => createRetryQueue({ storage }), [storage])
  const session = useMemo(
    () =>
      createRankedRun({
        requestTicket: client.requestTicket,
        submit: client.submit,
        enqueue: queue.enqueue,
      }),
    [client, queue],
  )
  const [screen, setScreen] = useState<Screen>("start")
  const [tutorial, setTutorial] = useState(!progress.hasCompletedTutorial())
  const [offline, setOffline] = useState(!navigator.onLine)
  const [run, setRun] = useState<CompletedRun>()
  const [rank, setRank] = useState<number>()
  const [board, setBoard] = useState<LeaderboardResult>()
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle")
  const [submissionMessage, setSubmissionMessage] = useState<string>()
  const [playingRunId, setPlayingRunId] = useState(0)
  const generationRef = useRef(0)
  const submissionNonceRef = useRef(0)
  const visibleSubmissionRef = useRef<string | undefined>(undefined)

  const refreshRanking = useCallback(
    async (acceptedRank?: number, visible = false): Promise<void> => {
      if (visible && acceptedRank !== undefined) {
        setRank(acceptedRank)
        setOffline(false)
        setSubmissionState("accepted")
      }
      const refreshed = await client.leaderboard()
      setBoard(refreshed)
    },
    [client],
  )

  useEffect(() => {
    const retry = (): void => {
      void queue
        .flush(client.submit)
        .then((accepted) => {
          const latest = accepted.at(-1)
          if (latest !== undefined) {
            void refreshRanking(
              latest.rank,
              latest.submission.ticket.token === visibleSubmissionRef.current,
            )
          }
        })
        .catch((error: unknown) => {
          console.warn(
            "랭킹 재전송에 실패했습니다.",
            error instanceof Error ? error.message : error,
          )
        })
    }
    if (navigator.onLine) retry()
    window.addEventListener("online", retry)
    return () => window.removeEventListener("online", retry)
  }, [client, queue, refreshRanking])

  const start = async (): Promise<void> => {
    const generation = generationRef.current + 1
    generationRef.current = generation
    submissionNonceRef.current += 1
    visibleSubmissionRef.current = undefined
    setSubmissionState("idle")
    setSubmissionMessage(undefined)
    const ranked = navigator.onLine && (await session.start())
    if (generation !== generationRef.current) return
    setOffline(!ranked)
    setRank(undefined)
    setPlayingRunId(generation)
    setScreen("playing")
  }
  const finish = useCallback(
    (runId: number, result: Readonly<{ score: ScoreBreakdown; transcript: Transcript }>): void => {
      if (runId !== generationRef.current) return
      const breakdown = {
        distance: result.score.distance,
        basicKills: result.score.basicKills,
        elites: result.score.elites,
        bosses: result.score.bosses,
        closeCalls: result.score.closeCalls,
        survivalBonus: result.score.total - result.score.subtotal,
        total: result.score.total,
      }
      progress.recordBest(result.score.total)
      setRun({ id: runId, score: breakdown, transcript: result.transcript })
      setSubmissionState("idle")
      setSubmissionMessage(undefined)
      setScreen("result")
    },
    [progress],
  )
  const openLeaderboard = async (): Promise<void> => {
    const generation = generationRef.current
    try {
      setBoard(await client.leaderboard())
    } catch (error) {
      if (!(error instanceof Error)) throw error
      setBoard(undefined)
    }
    if (generation !== generationRef.current) return
    setScreen("leaderboard")
  }
  if (screen === "playing")
    return runtimeFactory === undefined ? (
      <GameCanvas onFinish={(result) => finish(playingRunId, result)} />
    ) : (
      <GameCanvas
        runtimeFactory={runtimeFactory}
        onFinish={(result) => finish(playingRunId, result)}
      />
    )
  if (screen === "leaderboard")
    return (
      <Leaderboard
        board={board}
        onClose={() => setScreen(run === undefined ? "start" : "result")}
      />
    )
  if (screen === "result" && run !== undefined)
    return (
      <ResultScreen
        score={run.score}
        personalBest={progress.best()}
        rank={rank}
        offline={offline}
        submissionState={submissionState}
        submissionMessage={submissionMessage}
        onReplay={() => void start()}
        onLeaderboard={() => void openLeaderboard()}
        onSubmit={(nickname) => {
          if (submissionState !== "idle" && submissionState !== "failed") return
          const nonce = submissionNonceRef.current + 1
          submissionNonceRef.current = nonce
          const runId = run.id
          setSubmissionState("pending")
          setSubmissionMessage(undefined)
          void session
            .finish(nickname, run.transcript)
            .then((outcome) => {
              if (runId !== generationRef.current || nonce !== submissionNonceRef.current) return
              if (outcome.kind === "ranked") void refreshRanking(outcome.rank, true)
              if (outcome.kind === "queued") {
                visibleSubmissionRef.current = outcome.token
                setOffline(true)
                setSubmissionState("queued")
              }
              if (outcome.kind === "unranked") {
                setSubmissionState("failed")
                setSubmissionMessage("등록 시간이 만료되었습니다. 다시 시도해 주세요.")
              }
            })
            .catch((error: unknown) => {
              if (runId !== generationRef.current || nonce !== submissionNonceRef.current) return
              setSubmissionState("failed")
              setSubmissionMessage("랭킹 등록에 실패했습니다. 다시 시도해 주세요.")
              console.warn(
                "랭킹 등록에 실패했습니다.",
                error instanceof Error ? error.message : error,
              )
            })
        }}
      />
    )
  return (
    <>
      <div inert={tutorial}>
        <StartScreen offline={!navigator.onLine} onPlay={() => void start()} />
      </div>
      {tutorial ? (
        <Tutorial
          onComplete={() => {
            progress.completeTutorial()
            setTutorial(false)
          }}
        />
      ) : null}
    </>
  )
}
