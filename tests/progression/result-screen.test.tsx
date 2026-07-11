import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ResultScreen } from "../../src/ui/ResultScreen"

describe("ResultScreen", () => {
  it("shows breakdown, PB, rank, nickname, replay, and leaderboard actions", () => {
    // Given
    const replay = vi.fn()
    render(
      <ResultScreen
        score={{ distance: 100, kills: 500, survival: 200, total: 800 }}
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
    expect(replay).toHaveBeenCalledOnce()
  })

  it("labels offline results as unranked", () => {
    // Given / When
    render(
      <ResultScreen
        score={{ distance: 1, kills: 2, survival: 3, total: 6 }}
        personalBest={6}
        offline
        onReplay={vi.fn()}
      />,
    )
    // Then
    expect(screen.getByText("오프라인 · 랭킹 미반영")).toBeInTheDocument()
  })
})
