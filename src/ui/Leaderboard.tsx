import type { LeaderboardResult } from "../ranking/client"

export const Leaderboard = ({
  board,
  onClose,
}: Readonly<{ board: LeaderboardResult | undefined; onClose: () => void }>) => (
  <section className="panel-screen" aria-labelledby="leaderboard-title">
    <div className="result-card">
      <p className="eyebrow">생존자 기록</p>
      <h2 id="leaderboard-title">리더보드</h2>
      {board === undefined ? (
        <p className="muted-copy">랭킹 서버에 연결할 수 없습니다. 가짜 순위는 표시하지 않습니다.</p>
      ) : (
        <ol className="leaderboard-list">
          {board.entries.map((entry) => (
            <li key={`${entry.rank}-${entry.nickname}`}>
              <strong>{entry.rank}위</strong>
              <span>{entry.nickname}</span>
              <b>{entry.score.toLocaleString("ko-KR")}</b>
            </li>
          ))}
        </ol>
      )}
      <button className="secondary-action" type="button" onClick={onClose}>
        돌아가기
      </button>
    </div>
  </section>
)
