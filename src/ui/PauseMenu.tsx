export const PauseMenu = ({ onResume }: Readonly<{ onResume: () => void }>) => (
  <section className="pause-menu" role="dialog" aria-modal="true" aria-label="일시정지">
    <p>작전 일시정지</p>
    <button type="button" onClick={onResume}>
      계속하기
    </button>
    <small>화면을 좌우로 끌거나 ← → / A D 키로 이동</small>
  </section>
)
