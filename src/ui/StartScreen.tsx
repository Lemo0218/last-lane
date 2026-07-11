export const StartScreen = ({
  onPlay,
  offline,
}: Readonly<{ onPlay: () => void; offline: boolean }>) => (
  <main className="start-screen">
    <section className="start-card" aria-labelledby="game-title">
      <p className="eyebrow">끝까지 살아남아라</p>
      <h1 id="game-title">라스트 레인 LAST LANE</h1>
      <p className="subtitle">분대를 이끌고 좀비가 점령한 최후의 도로를 돌파하세요.</p>
      {offline ? (
        <p className="status-pill">오프라인 · 랭킹 미반영</p>
      ) : (
        <p className="status-pill online">온라인 랭킹 도전</p>
      )}
      <button className="play-button" type="button" onClick={onPlay}>
        게임 시작
      </button>
    </section>
  </main>
)
