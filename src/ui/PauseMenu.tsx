import { useEffect, useRef } from "react"

export const PauseMenu = ({ onResume }: Readonly<{ onResume: () => void }>) => {
  const resumeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    resumeRef.current?.focus()
  }, [])
  return (
    <section
      className="pause-menu"
      role="dialog"
      aria-modal="true"
      aria-label="일시정지"
      onKeyDown={(event) => {
        if (event.key === "Escape") onResume()
      }}
    >
      <p>작전 일시정지</p>
      <button ref={resumeRef} type="button" onClick={onResume}>
        계속하기
      </button>
      <small>화면을 좌우로 끌거나 ← → / A D 키로 이동</small>
    </section>
  )
}
