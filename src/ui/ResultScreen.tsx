import { useEffect, useRef, useState } from "react"

export type ResultScore = Readonly<{
  distance: number
  basicKills: number
  elites: number
  bosses: number
  closeCalls: number
  survivalBonus: number
  total: number
}>
type Props = Readonly<{
  score: ResultScore
  personalBest: number
  rank?: number | undefined
  offline?: boolean
  submissionState?: "idle" | "pending" | "accepted" | "queued"
  onReplay: () => void
  onSubmit?: (nickname: string) => void
  onLeaderboard?: () => void
}>

export const ResultScreen = ({
  score,
  personalBest,
  rank,
  offline = false,
  submissionState = "idle",
  onReplay,
  onSubmit,
  onLeaderboard,
}: Props) => {
  const replayRef = useRef<HTMLButtonElement>(null)
  const [nickname, setNickname] = useState("")
  const locked = submissionState !== "idle"
  const submitLabel =
    submissionState === "pending"
      ? "등록 중"
      : submissionState === "accepted"
        ? "등록 완료"
        : submissionState === "queued"
          ? "전송 대기 중"
          : "랭킹 등록"
  useEffect(() => replayRef.current?.focus(), [])
  return (
    <main className="panel-screen">
      <section className="result-card" aria-labelledby="result-title">
        <p className="eyebrow">런 종료</p>
        <h2 id="result-title">생존 기록</h2>
        {offline ? <p className="status-pill">오프라인 · 랭킹 미반영</p> : null}
        <strong className="total-score">{score.total.toLocaleString("ko-KR")}</strong>
        <p className="personal-best">개인 최고 {personalBest.toLocaleString("ko-KR")}</p>
        {rank === undefined ? null : <p className="rank-badge">{rank}위</p>}
        <dl className="score-breakdown">
          <div>
            <dt>거리</dt>
            <dd>{score.distance}</dd>
          </div>
          <div>
            <dt>일반 처치</dt>
            <dd>{score.basicKills}</dd>
          </div>
          <div>
            <dt>엘리트</dt>
            <dd>{score.elites}</dd>
          </div>
          <div>
            <dt>보스</dt>
            <dd>{score.bosses}</dd>
          </div>
          <div>
            <dt>아슬아슬</dt>
            <dd>{score.closeCalls}</dd>
          </div>
          <div>
            <dt>생존 보너스</dt>
            <dd>{score.survivalBonus}</dd>
          </div>
        </dl>
        <label className="nickname-field">
          닉네임
          <input
            aria-label="닉네임"
            maxLength={16}
            value={nickname}
            disabled={locked}
            onChange={(event) => setNickname(event.currentTarget.value)}
          />
        </label>
        <button
          className="primary-action"
          type="button"
          disabled={locked || offline || nickname.trim().length === 0}
          onClick={() => onSubmit?.(nickname.trim())}
        >
          {submitLabel}
        </button>
        <button ref={replayRef} className="secondary-action" type="button" onClick={onReplay}>
          다시 달리기
        </button>
        <button className="text-action" type="button" onClick={onLeaderboard}>
          리더보드 보기
        </button>
      </section>
    </main>
  )
}
