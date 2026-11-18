import { TILE } from './dungeon.js'

const DIRECTIONS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
]

const positionKey = ({ x, y }) => `${x},${y}`

export function findPath(tiles, start, target, blockedPositions = []) {
  if (
    !tiles[target.y]?.[target.x] ||
    tiles[target.y][target.x] === TILE.WALL
  ) {
    return []
  }

  const startKey = positionKey(start)
  const targetKey = positionKey(target)
  const blocked = new Set(blockedPositions.map(positionKey))
  blocked.delete(startKey)

  if (blocked.has(targetKey)) {
    return []
  }

  const queue = [start]
  const previous = new Map([[startKey, null]])

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]

    if (positionKey(current) === targetKey) {
      break
    }

    for (const direction of DIRECTIONS) {
      const next = {
        x: current.x + direction.x,
        y: current.y + direction.y,
      }
      const nextKey = positionKey(next)

      if (
        previous.has(nextKey) ||
        blocked.has(nextKey) ||
        !tiles[next.y]?.[next.x] ||
        tiles[next.y][next.x] === TILE.WALL
      ) {
        continue
      }

      previous.set(nextKey, current)
      queue.push(next)
    }
  }

  if (!previous.has(targetKey)) {
    return []
  }

  const path = []
  let current = target

  while (positionKey(current) !== startKey) {
    path.unshift(current)
    current = previous.get(positionKey(current))
  }

  return path
}

export function getPathArrow(from, to) {
  if (to.x > from.x) return '→'
  if (to.x < from.x) return '←'
  if (to.y > from.y) return '↓'
  return '↑'
}
