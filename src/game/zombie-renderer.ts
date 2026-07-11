import type { Zombie, ZombieKind } from "./types"

const radiusOf = (kind: ZombieKind): number => (kind === "boss" ? 21 : kind === "elite" ? 13 : 9)

const circle = (context: CanvasRenderingContext2D, x: number, y: number, radius: number): void => {
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fill()
}

export const renderZombie = (
  context: CanvasRenderingContext2D,
  zombie: Zombie,
  x: number,
  y: number,
  elapsedMs: number,
  reducedMotion: boolean,
): void => {
  const radius = radiusOf(zombie.kind)
  const sway = reducedMotion ? 0 : Math.sin(elapsedMs / 150 + zombie.id) * 2
  context.fillStyle = "rgba(0,0,0,.4)"
  context.beginPath()
  context.ellipse(x, y + radius * 1.5, radius * 1.25, radius * 0.42, 0, 0, Math.PI * 2)
  context.fill()
  context.strokeStyle = zombie.kind === "boss" ? "#7d211f" : "#263d1f"
  context.lineWidth = zombie.kind === "boss" ? 6 : 3
  context.beginPath()
  context.moveTo(x - radius * 0.45, y + radius * 0.65)
  context.lineTo(x - radius * 0.7 + sway, y + radius * 1.4)
  context.moveTo(x + radius * 0.45, y + radius * 0.65)
  context.lineTo(x + radius * 0.7 - sway, y + radius * 1.4)
  context.stroke()
  context.fillStyle =
    zombie.kind === "boss" ? "#d14a43" : zombie.kind === "elite" ? "#9c54c8" : "#6f9e40"
  context.fillRect(x - radius * 0.72, y - radius * 0.1, radius * 1.44, radius * 1.12)
  circle(context, x + sway * 0.3, y - radius * 0.42, radius * 0.7)
  context.strokeStyle = zombie.kind === "boss" ? "#e25b53" : "#83b853"
  context.lineWidth = zombie.kind === "boss" ? 7 : 3
  context.beginPath()
  context.moveTo(x - radius * 0.65, y + radius * 0.1)
  context.lineTo(x - radius * 1.15 - sway, y + radius * 0.55)
  context.moveTo(x + radius * 0.65, y + radius * 0.1)
  context.lineTo(x + radius * 1.15 + sway, y + radius * 0.45)
  context.stroke()
  context.fillStyle = zombie.kind === "elite" ? "#ffdc69" : "#ff625c"
  circle(context, x - radius * 0.22, y - radius * 0.52, Math.max(1.5, radius * 0.1))
  circle(context, x + radius * 0.22, y - radius * 0.52, Math.max(1.5, radius * 0.1))
  if (zombie.kind !== "basic") {
    context.strokeStyle = zombie.kind === "boss" ? "#ff776f" : "#dc92ff"
    context.lineWidth = 2
    context.beginPath()
    context.arc(x, y, radius + 7, 0, Math.PI * 2)
    context.stroke()
  }
}
