import { useEffect, useRef } from "react"

export const Tutorial = ({ onComplete }: Readonly<{ onComplete: () => void }>) => {
  const buttonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => buttonRef.current?.focus(), [])
  return (
    <section className="tutorial" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <p className="eyebrow">첫 생존 브리핑</p>
      <h2 id="tutorial-title">좌우로 길을 선택하세요</h2>
      <ol>
        <li>조이스틱이나 방향키로 이동</li>
        <li>안전한 게이트로 분대 강화</li>
        <li>오프라인 기록은 로컬 전용</li>
      </ol>
      <button ref={buttonRef} className="primary-action" type="button" onClick={onComplete}>
        확인
      </button>
    </section>
  )
}
