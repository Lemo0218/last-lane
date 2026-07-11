import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { App } from "../../src/App"
import { createWaveRuntime, type WaveRuntimeDependencies } from "../../src/game/wave-runtime"
import type { WaveSegment, WaveWitness } from "../../src/game/waves"

const segment: WaveSegment = {
  id: "wave-1",
  horizonMs: 6000,
  blockers: [{ fromMs: 0, toMs: 10, minX: 480, maxX: 520, damage: 3 }],
  gates: [],
}
const witness: WaveWitness = {
  frames: [],
  productionInputs: [],
  finalSquad: 3,
  finalX: 500,
  finalVelocity: 0,
  collectedGateIds: [],
}
const dependencies: WaveRuntimeDependencies = {
  candidate: () => segment,
  solve: () => ({ kind: "accepted", segment, witness, elapsedMs: 0 }),
}

describe("App submission failures", () => {
  let frame: FrameRequestCallback
  beforeEach(() => {
    localStorage.setItem("last-lane:tutorial-v1", "complete")
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frame = callback
      return 1
    })
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
  })

  const finishRun = async (): Promise<void> => {
    fireEvent.click(screen.getByRole("button", { name: "게임 시작" }))
    await waitFor(() => expect(screen.getByLabelText("라스트 레인 게임 화면")).toBeInTheDocument())
    frame(performance.now() + 20)
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "생존 기록" })).toBeInTheDocument(),
    )
    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "러너" } })
    fireEvent.click(screen.getByRole("button", { name: "랭킹 등록" }))
  }

  it("leaves pending and explains an expired submission", async () => {
    const requestTicket = vi
      .fn()
      .mockResolvedValueOnce({ token: "expired", deadlineMs: 1 })
      .mockResolvedValueOnce({ token: "fresh", deadlineMs: Date.now() + 60000 })
    const submit = vi.fn()
    render(
      <App
        rankingClient={{
          requestTicket,
          submit,
          leaderboard: vi.fn(),
        }}
        runtimeFactory={() => createWaveRuntime(dependencies)}
      />,
    )
    await finishRun()
    await waitFor(() =>
      expect(
        screen.getByText("랭킹 등록 시간이 만료되었습니다. 새 게임을 시작해 주세요"),
      ).toBeInTheDocument(),
    )
    const expiredButton = screen.getByRole("button", { name: "등록 만료" })
    expect(expiredButton).toBeDisabled()
    fireEvent.click(expiredButton)
    expect(submit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "새 게임 시작" }))
    await waitFor(() => expect(requestTicket).toHaveBeenCalledTimes(2))
    expect(screen.getByLabelText("라스트 레인 게임 화면")).toBeInTheDocument()
  })

  it("catches an unexpected submit rejection and allows retry", async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error("server rejected"))
      .mockResolvedValueOnce({ accepted: true, rank: 6 })
    render(
      <App
        rankingClient={{
          requestTicket: vi
            .fn()
            .mockResolvedValue({ token: "valid", deadlineMs: Date.now() + 60000 }),
          submit,
          leaderboard: vi.fn().mockResolvedValue({ entries: [] }),
        }}
        runtimeFactory={() => createWaveRuntime(dependencies)}
      />,
    )
    await finishRun()
    await waitFor(() =>
      expect(screen.getByText("랭킹 등록에 실패했습니다. 다시 시도해 주세요.")).toBeInTheDocument(),
    )
    expect(screen.getByRole("button", { name: "랭킹 등록" })).toBeEnabled()
    expect(submit).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole("button", { name: "랭킹 등록" }))
    await waitFor(() => expect(screen.getByText("6위")).toBeInTheDocument())
    expect(submit).toHaveBeenCalledTimes(2)
  })
})
