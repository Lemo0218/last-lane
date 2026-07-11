import { useState } from "react"

import { GameCanvas } from "./game/GameCanvas"

export function App() {
  const [playing, setPlaying] = useState(false)
  if (playing) return <GameCanvas />
  return (
    <main className="start-screen">
      <section className="start-card" aria-labelledby="game-title">
        <p className="eyebrow">끝까지 살아남아라</p>
        <h1 id="game-title">라스트 레인 LAST LANE</h1>
        <p className="subtitle">분대를 이끌고 좀비가 점령한 최후의 도로를 돌파하세요.</p>
        <button className="play-button" type="button" onClick={() => setPlaying(true)}>
          게임 시작
        </button>
      </section>
    </main>
  )
}
