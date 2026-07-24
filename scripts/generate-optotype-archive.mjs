import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outputDir = new URL('../public/optotypes/', import.meta.url)
const directions = ['up', 'right', 'down', 'left']
const baseGrid = [
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0],
  [1, 1, 1, 1, 1],
]

function rotate(grid) {
  return grid.map((_, row) => grid.map((_, column) => grid[4 - column][row]))
}

function gridFor(direction) {
  const rotations = { right: 0, down: 1, left: 2, up: 3 }
  let grid = baseGrid.map((row) => [...row])
  for (let index = 0; index < rotations[direction]; index += 1) grid = rotate(grid)
  return grid
}

function metrics(level) {
  const angle = (5 / 60) * (Math.PI / 180)
  const outerMm = 2 * 2000 * Math.tan(angle / 2) * 10 ** (5 - level)
  const nativePx = (outerMm * 224) / 25.4
  return {
    level,
    outerMm: Number(outerMm.toFixed(6)),
    nativePx: Number(nativePx.toFixed(4)),
    archivePx: Math.round(nativePx),
    strokeNativePx: Number((nativePx / 5).toFixed(4)),
  }
}

await mkdir(outputDir, { recursive: true })
const manifest = []
for (let step = 0; step <= 13; step += 1) {
  const level = Number((4 + step / 10).toFixed(1))
  const size = metrics(level)
  for (const direction of directions) {
    const rects = gridFor(direction)
      .flatMap((row, y) =>
        row.map((filled, x) =>
          filled ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : '',
        ),
      )
      .join('')
    const file = `e-${level.toFixed(1)}-${direction}-${size.archivePx}px.svg`
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.archivePx}" height="${size.archivePx}" viewBox="0 0 5 5" shape-rendering="crispEdges" role="img" aria-label="${level.toFixed(1)} ${direction}"><g fill="#000">${rects}</g></svg>\n`
    await writeFile(new URL(file, outputDir), svg, 'utf8')
    manifest.push({ ...size, direction, file })
  }
}
await writeFile(
  join(fileURLToPath(outputDir), 'manifest.json'),
  `${JSON.stringify({ device: 'MacBook Air 13.6 2560x1664 224ppi', distanceMm: 2000, items: manifest }, null, 2)}\n`,
  'utf8',
)
