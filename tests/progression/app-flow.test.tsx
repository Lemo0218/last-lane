import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { App } from "../../src/App"
import { createWaveRuntime, type WaveRuntimeDependencies } from "../../src/game/wave-runtime"
import type { WaveSegment, WaveWitness } from "../../src/game/waves"

const lethalSegment: WaveSegment = {
  id: "wave-1",
  horizonMs: 6_000,
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
const runtimeDependencies: WaveRuntimeDependencies = {
  candidate: () => lethalSegment,
  solve: () => ({ kind: "accepted", segment: lethalSegment, witness, elapsedMs: 0 }),
}

describe("App ranked run integration", () => {
  it("refreshes rank and leaderboard after immediate and queued GameCanvas submissions", async () => {
    // Given: a completed tutorial, a lethal production wave, and an accepting ranking service
    localStorage.setItem("last-lane:tutorial-v1", "complete")
    let frame: FrameRequestCallback = () => undefined
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frame = callback
      return 1
    })
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    const rankingClient = {
      requestTicket: vi.fn().mockResolvedValue({
        token: "run",
        deadlineMs: Date.now() + 60_000,
        seed: 1,
        ruleset: "last-lane-v1",
      }),
      submit: vi
        .fn()
        .mockResolvedValueOnce({ accepted: true, rank: 2 })
        .mockRejectedValueOnce(new TypeError("offline"))
        .mockResolvedValueOnce({ accepted: true, rank: 3 }),
      leaderboard: vi.fn().mockResolvedValue({
        entries: [{ rank: 2, nickname: "러너", score: 0 }],
      }),
    }
    render(
      <App
        rankingClient={rankingClient}
        runtimeFactory={() => createWaveRuntime(runtimeDependencies)}
      />,
    )

    // When: the player starts, GameCanvas completes the run, and the result is submitted
    fireEvent.click(screen.getByRole("button", { name: "게임 시작" }))
    await waitFor(() => expect(screen.getByLabelText("라스트 레인 게임 화면")).toBeInTheDocument())
    frame(performance.now() + 20)
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "생존 기록" })).toBeInTheDocument(),
    )
    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "러너" } })
    fireEvent.click(screen.getByRole("button", { name: "랭킹 등록" }))

    // Then: the accepted rank is visible and the authoritative leaderboard was refreshed
    await waitFor(() => expect(screen.getByText("2위")).toBeInTheDocument())
    expect(rankingClient.leaderboard).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole("button", { name: "다시 달리기" }))
    await waitFor(() => expect(screen.getByLabelText("라스트 레인 게임 화면")).toBeInTheDocument())
    frame(performance.now() + 20)
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "생존 기록" })).toBeInTheDocument(),
    )
    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "재도전" } })
    fireEvent.click(screen.getByRole("button", { name: "랭킹 등록" }))
    await waitFor(() => expect(screen.getByText("오프라인 · 랭킹 미반영")).toBeInTheDocument())
    window.dispatchEvent(new Event("online"))

    await waitFor(() => expect(screen.getByText("3위")).toBeInTheDocument())
    expect(rankingClient.submit).toHaveBeenCalledTimes(3)
    expect(rankingClient.leaderboard).toHaveBeenCalledTimes(2)
  })
})
