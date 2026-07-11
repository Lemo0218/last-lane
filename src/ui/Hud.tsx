export type HudStats = Readonly<{
  score: number
  elapsedMs: number
  squad: number
  maximumSquad: number
  combo: number
  difficulty: number
}>

export const Hud = ({ stats }: Readonly<{ stats: HudStats }>) => (
  <aside className="hud" aria-label="게임 현황">
    <div>
      <span>점수</span>
      <strong>{stats.score.toLocaleString("ko-KR")}</strong>
    </div>
    <div>
      <span>시간</span>
      <strong>{Math.floor(stats.elapsedMs / 1000)}초</strong>
    </div>
    <div>
      <span>분대</span>
      <strong>
        {stats.squad}/{stats.maximumSquad}
      </strong>
    </div>
    <div>
      <span>콤보</span>
      <strong>×{Math.max(1, stats.combo)}</strong>
    </div>
    <div>
      <span>위협</span>
      <strong>{stats.difficulty}</strong>
    </div>
  </aside>
)
