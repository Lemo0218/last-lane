import { useCallback, useEffect, useMemo, useState } from "react"

import { GameCanvas } from "./game/GameCanvas"
import type { Transcript } from "./game/transcript"
import { createRankingClient, type LeaderboardResult } from "./ranking/client"
import { createRankedRun } from "./ranking/ranked-run"
import { createRetryQueue } from "./ranking/retry-queue"
import { createLocalProgress } from "./storage/local"
import { Leaderboard } from "./ui/Leaderboard"
import { type ResultScore, ResultScreen } from "./ui/ResultScreen"
import { StartScreen } from "./ui/StartScreen"
import { Tutorial } from "./ui/Tutorial"

type Screen = "start" | "playing" | "result" | "leaderboard"
type CompletedRun = Readonly<{ score: ResultScore; transcript: Transcript }>

export function App() {
  const progress = useMemo(() => createLocalProgress(localStorage), [])
  const client = useMemo(() => createRankingClient(), [])
  const queue = useMemo(() => createRetryQueue({ storage: localStorage }), [])
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

  useEffect(() => {
    const retry = (): void => {
      void queue.flush(client.submit).catch((error: unknown) => {
        console.warn("랭킹 재전송에 실패했습니다.", error instanceof Error ? error.message : error)
      })
    }
    if (navigator.onLine) retry()
    window.addEventListener("online", retry)
    return () => window.removeEventListener("online", retry)
  }, [client, queue])

  const start = async (): Promise<void> => {
    const ranked = navigator.onLine && (await session.start())
    setOffline(!ranked)
    setRank(undefined)
    setScreen("playing")
  }
  const finish = useCallback(
    (
      result: Readonly<{ score: number; kills: number; elapsedMs: number; transcript: Transcript }>,
    ): void => {
      const breakdown = {
        distance: Math.max(0, result.score - result.kills * 100),
        kills: result.kills * 100,
        survival: Math.floor(result.elapsedMs / 1000) * 10,
        total: result.score,
      }
      progress.recordBest(result.score)
      setRun({ score: breakdown, transcript: result.transcript })
      setScreen("result")
    },
    [progress],
  )
  const openLeaderboard = async (): Promise<void> => {
    try {
      setBoard(await client.leaderboard())
    } catch (error) {
      if (!(error instanceof Error)) throw error
      setBoard(undefined)
    }
    setScreen("leaderboard")
  }
  if (screen === "playing") return <GameCanvas onFinish={finish} />
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
        onReplay={() => void start()}
        onLeaderboard={() => void openLeaderboard()}
        onSubmit={(nickname) =>
          void session.finish(nickname, run.transcript).then((outcome) => {
            if (outcome.kind === "ranked") setRank(outcome.rank)
            if (outcome.kind !== "ranked") setOffline(true)
          })
        }
      />
    )
  return (
    <>
      <StartScreen offline={!navigator.onLine} onPlay={() => void start()} />
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
