import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ResultScreen } from "../../src/ui/ResultScreen"

describe("ResultScreen", () => {
  it("shows breakdown, PB, rank, nickname, replay, and leaderboard actions", () => {
    // Given
    const replay = vi.fn()
    render(
      <ResultScreen
        score={{
          distance: 100,
          basicKills: 300,
          elites: 100,
          bosses: 0,
          closeCalls: 50,
          survivalBonus: 250,
          total: 800,
        }}
        personalBest={900}
        rank={7}
        onReplay={replay}
      />,
    )
    // When
    fireEvent.click(screen.getByRole("button", { name: "다시 달리기" }))
    // Then
    expect(screen.getByText("개인 최고 900")).toBeInTheDocument()
    expect(screen.getByText("7위")).toBeInTheDocument()
    expect(screen.getByLabelText("닉네임")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "랭킹 등록" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "리더보드 보기" })).toBeInTheDocument()
    expect(screen.getByText("생존 보너스")).toBeInTheDocument()
    const displayedParts = [100, 300, 100, 0, 50, 250]
    expect(displayedParts.reduce((total, part) => total + part, 0)).toBe(800)
    expect(replay).toHaveBeenCalledOnce()
  })

  it("labels offline results as unranked", () => {
    // Given / When
    render(
      <ResultScreen
        score={{
          distance: 1,
          basicKills: 2,
          elites: 0,
          bosses: 0,
          closeCalls: 0,
          survivalBonus: 3,
          total: 6,
        }}
        personalBest={6}
        offline
        onReplay={vi.fn()}
      />,
    )
    // Then
    expect(screen.getByText("오프라인 · 랭킹 미반영")).toBeInTheDocument()
  })

  it("locks submission while pending and after it is queued", () => {
    const submit = vi.fn()
    const { rerender } = render(
      <ResultScreen
        score={{
          distance: 1,
          basicKills: 0,
          elites: 0,
          bosses: 0,
          closeCalls: 0,
          survivalBonus: 0,
          total: 1,
        }}
        personalBest={1}
        submissionState="pending"
        onReplay={vi.fn()}
        onSubmit={submit}
      />,
    )
    fireEvent.change(screen.getByLabelText("닉네임"), { target: { value: "러너" } })
    const button = screen.getByRole("button", { name: "등록 중" })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(submit).not.toHaveBeenCalled()
    rerender(
      <ResultScreen
        score={{
          distance: 1,
          basicKills: 0,
          elites: 0,
          bosses: 0,
          closeCalls: 0,
          survivalBonus: 0,
          total: 1,
        }}
        personalBest={1}
        submissionState="queued"
        onReplay={vi.fn()}
        onSubmit={submit}
      />,
    )
    expect(screen.getByRole("button", { name: "전송 대기 중" })).toBeDisabled()
  })
})
