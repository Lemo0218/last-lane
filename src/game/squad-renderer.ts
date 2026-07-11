export const VISIBLE_SOLDIER_CAP = 24

export type SoldierMember = Readonly<{
  x: number
  y: number
  scale: number
  phase: number
}>

export type SoldierFormation = Readonly<{
  members: readonly SoldierMember[]
  overflow: number
}>

export const soldierFormation = (squad: number, viewportWidth: number): SoldierFormation => {
  const visible = Math.min(VISIBLE_SOLDIER_CAP, Math.max(0, squad))
  const columns = Math.min(6, Math.max(2, Math.ceil(Math.sqrt(visible * 1.35))))
  const spacingX = Math.min(22, (viewportWidth * 0.58) / Math.max(1, columns - 1))
  const rows = Math.ceil(visible / columns)
  const members: SoldierMember[] = []
  for (let index = 0; index < visible; index += 1) {
    const row = Math.floor(index / columns)
    const membersInRow = Math.min(columns, visible - row * columns)
    const column = index - row * columns
    members.push({
      x: (column - (membersInRow - 1) / 2) * spacingX,
      y: (row - (rows - 1) / 2) * 20,
      scale: 1 - row * 0.035,
      phase: index % 4,
    })
  }
  return { members, overflow: Math.max(0, squad - visible) }
}

const circle = (context: CanvasRenderingContext2D, x: number, y: number, radius: number): void => {
  context.beginPath()
  context.arc(x, y, radius, 0, Math.PI * 2)
  context.fill()
}

export const renderSquad = (
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  squad: number,
  viewportWidth: number,
  elapsedMs: number,
  reducedMotion: boolean,
  firing: boolean,
): number => {
  const formation = soldierFormation(squad, viewportWidth)
  for (const member of formation.members) {
    const bob = reducedMotion ? 0 : Math.sin(elapsedMs / 120 + member.phase) * 1.3
    const x = centerX + member.x
    const y = centerY + member.y + bob
    const scale = member.scale
    context.fillStyle = "rgba(0,0,0,.42)"
    context.beginPath()
    context.ellipse(x, y + 10 * scale, 8 * scale, 3 * scale, 0, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = "#74fff4"
    context.fillRect(x - 4 * scale, y - 2 * scale, 8 * scale, 12 * scale)
    circle(context, x, y - 6 * scale, 4.5 * scale)
    context.strokeStyle = "#c8fffb"
    context.lineWidth = Math.max(1, 2 * scale)
    context.beginPath()
    context.moveTo(x + 2 * scale, y)
    context.lineTo(x + 9 * scale, y - 7 * scale)
    context.stroke()
    context.fillStyle = "#d7f8f5"
    context.fillRect(x + 7 * scale, y - 9 * scale, 8 * scale, 2 * scale)
    if (firing && member.phase === Math.floor(elapsedMs / 70) % 4) {
      context.fillStyle = "#fff3a3"
      circle(context, x + 17 * scale, y - 8 * scale, reducedMotion ? 2 : 3.5)
    }
  }
  if (formation.overflow > 0) {
    context.fillStyle = "rgba(7,18,22,.88)"
    circle(context, centerX, centerY + 32, 13)
    context.strokeStyle = "#74fff4"
    context.stroke()
    context.fillStyle = "#fff"
    context.font = "800 10px sans-serif"
    context.textAlign = "center"
    context.fillText(`+${formation.overflow}`, centerX, centerY + 35)
  }
  return formation.members.length
}
