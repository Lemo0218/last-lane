import { difficultyAt, WORLD_MAX_X } from "./config"
import type { SimulationState } from "./types"
import type { ActiveWave } from "./wave-runtime"

export type CanvasMetrics = Readonly<{
  cssWidth: number
  cssHeight: number
  width: number
  height: number
  dpr: number
}>

export const canvasMetrics = (
  cssWidth: number,
  cssHeight: number,
  rawDpr: number,
): CanvasMetrics => {
  const dpr = Math.max(1, Math.min(2, rawDpr))
  return {
    cssWidth,
    cssHeight,
    width: Math.round(cssWidth * dpr),
    height: Math.round(cssHeight * dpr),
    dpr,
  }
}

export const resizeCanvas = (canvas: HTMLCanvasElement): CanvasMetrics => {
  const bounds = canvas.getBoundingClientRect()
  const metrics = canvasMetrics(bounds.width, bounds.height, window.devicePixelRatio)
  if (canvas.width !== metrics.width) canvas.width = metrics.width
  if (canvas.height !== metrics.height) canvas.height = metrics.height
  return metrics
}

export const motionPulse = (elapsedMs: number, reducedMotion: boolean): number =>
  reducedMotion ? 0 : Math.sin(elapsedMs / 90) * 3

const circle = (context: CanvasRenderingContext2D, x: number, y: number, radius: number): void => {
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fill()
}

export const renderGame = (
  context: CanvasRenderingContext2D,
  state: SimulationState,
  metrics: CanvasMetrics,
  reducedMotion: boolean,
  active?: ActiveWave,
): void => {
  const { cssWidth: width, cssHeight: height, dpr } = metrics
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  const roadLeft = width * 0.12
  const roadWidth = width * 0.76
  const toX = (worldX: number): number => roadLeft + (worldX / WORLD_MAX_X) * roadWidth
  context.fillStyle = "#071216"
  context.fillRect(0, 0, width, height)
  context.fillStyle = "#20292a"
  context.fillRect(roadLeft, 0, roadWidth, height)
  context.strokeStyle = "#d2b55b"
  context.lineWidth = 2
  context.setLineDash([18, 24])
  for (let lane = 1; lane < 3; lane += 1) {
    context.beginPath()
    context.moveTo(roadLeft + (roadWidth * lane) / 3, -(Number(state.elapsedMs) / 10) % 42)
    context.lineTo(roadLeft + (roadWidth * lane) / 3, height)
    context.stroke()
  }
  context.setLineDash([])
  if (active !== undefined) {
    context.fillStyle = active.segment.horizonMs === 12_000 ? "#ff776f" : "#d5ebed"
    context.font = "900 13px sans-serif"
    context.textAlign = "left"
    context.fillText(
      active.segment.horizonMs === 12_000
        ? `보스 웨이브 ${active.index + 1}`
        : `웨이브 ${active.index + 1}`,
      roadLeft + 8,
      72,
    )
    for (const gate of active.segment.gates) {
      if (
        active.production.collectedGateIds.has(gate.id) ||
        active.production.atMs > gate.atMs + 500
      )
        continue
      const approach = Math.max(0, Math.min(1, 1 - (gate.atMs - active.production.atMs) / 2_000))
      const x = toX(gate.x)
      const y = height * (0.18 + approach * 0.52)
      const halfWidth = Math.max(18, (gate.radius / WORLD_MAX_X) * roadWidth)
      context.fillStyle = "rgba(40,220,210,.28)"
      context.fillRect(x - halfWidth, y - 20, halfWidth * 2, 40)
      context.strokeStyle = "#71fff5"
      context.strokeRect(x - halfWidth, y - 20, halfWidth * 2, 40)
      context.fillStyle = "#fff"
      context.font = "700 11px sans-serif"
      context.textAlign = "center"
      context.fillText(`${gate.kind.toUpperCase()} +${gate.level}`, x, y + 4)
    }
    for (const blocker of active.segment.blockers) {
      if (blocker.fromMs - active.production.atMs > 900 || blocker.toMs < active.production.atMs)
        continue
      const left = toX(blocker.minX)
      const right = toX(blocker.maxX)
      const pulse = reducedMotion ? 0.28 : 0.2 + motionPulse(active.production.atMs, false) * 0.025
      context.fillStyle = `rgba(255,75,65,${pulse})`
      context.fillRect(left, height * 0.24, right - left, height * 0.48)
      context.strokeStyle = "#ff766d"
      context.strokeRect(left, height * 0.24, right - left, height * 0.48)
      const hordeSize = active.segment.horizonMs === 12_000 ? 5 : 3
      context.fillStyle = active.segment.horizonMs === 12_000 ? "#d14a43" : "#7fb646"
      for (let index = 0; index < hordeSize; index += 1)
        circle(
          context,
          left + ((index + 1) * (right - left)) / (hordeSize + 1),
          height * 0.32,
          active.segment.horizonMs === 12_000 && index === 2 ? 16 : 8,
        )
    }
  }
  for (let index = 0; index < 16; index += 1) {
    const y = (index * 83 + (reducedMotion ? 0 : Number(state.elapsedMs) / 14)) % height
    context.fillStyle = index % 2 === 0 ? "#152022" : "#303738"
    context.fillRect(index % 2 === 0 ? 0 : roadLeft + roadWidth, y, roadLeft, 9)
  }
  for (const gate of state.gates) {
    const x = toX(gate.x)
    context.fillStyle = "rgba(40,220,210,.28)"
    context.fillRect(x - 24, height * 0.34, 48, 42)
    context.strokeStyle = "#71fff5"
    context.strokeRect(x - 24, height * 0.34, 48, 42)
    context.fillStyle = "#fff"
    context.font = "700 12px sans-serif"
    context.textAlign = "center"
    context.fillText(`${gate.kind.toUpperCase()} +${gate.level}`, x, height * 0.34 + 25)
  }
  for (const projectile of state.projectiles) {
    context.fillStyle = "#ffe87a"
    context.fillRect(toX(projectile.x) - 2, height * 0.57, 4, 15)
  }
  const shotFeedback = state.events.some((event) => event.kind === "shot-fired")
  if (shotFeedback) {
    context.fillStyle = "#fff3a3"
    circle(context, toX(state.playerX), height * 0.77, reducedMotion ? 5 : 8)
  }
  for (const zombie of state.zombies) {
    const x = toX(zombie.x)
    const progress = 1 - zombie.x / WORLD_MAX_X
    const y = height * (0.14 + progress * 0.56)
    const radius = zombie.kind === "boss" ? 21 : zombie.kind === "elite" ? 13 : 9
    context.fillStyle = "rgba(0,0,0,.4)"
    context.beginPath()
    context.ellipse(x, y + radius, radius * 1.3, radius * 0.45, 0, 0, Math.PI * 2)
    context.fill()
    context.fillStyle =
      zombie.kind === "boss" ? "#d14a43" : zombie.kind === "elite" ? "#b665df" : "#7fb646"
    circle(context, x, y, radius)
    if (zombie.kind !== "basic") {
      context.strokeStyle = zombie.kind === "boss" ? "#ff776f" : "#dc92ff"
      context.lineWidth = 2
      context.beginPath()
      context.arc(
        x,
        y,
        radius + 6 + motionPulse(Number(state.elapsedMs), reducedMotion),
        0,
        Math.PI * 2,
      )
      context.stroke()
    }
    context.fillStyle = "#fff"
    context.font = "800 10px sans-serif"
    context.fillText(
      zombie.kind === "boss" ? "BOSS" : zombie.kind === "elite" ? "ELITE" : "Z",
      x,
      y + 3,
    )
  }
  const playerX = toX(state.playerX)
  context.fillStyle = "rgba(0,0,0,.45)"
  context.beginPath()
  context.ellipse(playerX, height * 0.84, 27, 9, 0, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = "#65f5e9"
  circle(context, playerX, height * 0.82, 16)
  const hit = state.events.some((event) => event.kind === "squad-damaged")
  if (hit) {
    context.fillStyle = "rgba(255,85,70,.7)"
    const particles = reducedMotion ? 2 : 6
    for (let index = 0; index < particles; index += 1) {
      const angle = (Math.PI * 2 * index) / particles
      circle(context, playerX + Math.cos(angle) * 24, height * 0.82 + Math.sin(angle) * 24, 3)
    }
  }
  context.fillStyle = "#071216"
  context.font = "900 12px sans-serif"
  context.fillText(String(state.squad), playerX, height * 0.82 + 4)
  const tier = difficultyAt(Number(state.elapsedMs)).tier + 1
  context.fillStyle = "rgba(0,0,0,.5)"
  context.fillRect(width - 62, height - 34, 54, 24)
  context.fillStyle = "#f2c85b"
  context.fillText(`위협 ${tier}`, width - 35, height - 17)
}
