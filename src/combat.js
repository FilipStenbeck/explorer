import { TILE } from './dungeon.js'

export const getGridDistance = (from, to) =>
  Math.abs(from.x - to.x) + Math.abs(from.y - to.y)

export const isTargetInRange = (attacker, target, range) =>
  getGridDistance(attacker, target) <= range

export function hasLineOfSight(tiles, from, to) {
  const deltaX = to.x - from.x
  const deltaY = to.y - from.y
  const stepsX = Math.abs(deltaX)
  const stepsY = Math.abs(deltaY)
  const directionX = Math.sign(deltaX)
  const directionY = Math.sign(deltaY)
  let x = from.x
  let y = from.y
  let crossedX = 0
  let crossedY = 0

  const isWall = (positionX, positionY) =>
    tiles[positionY]?.[positionX] === TILE.WALL

  while (crossedX < stepsX || crossedY < stepsY) {
    const decision = (1 + 2 * crossedX) * stepsY
      - (1 + 2 * crossedY) * stepsX

    if (decision === 0) {
      if (
        isWall(x + directionX, y) ||
        isWall(x, y + directionY)
      ) {
        return false
      }

      x += directionX
      y += directionY
      crossedX += 1
      crossedY += 1
    } else if (decision < 0) {
      x += directionX
      crossedX += 1
    } else {
      y += directionY
      crossedY += 1
    }

    if (isWall(x, y)) {
      return false
    }
  }

  return true
}

export function rollAttack(attacker, random = Math.random) {
  const hit = random() < attacker.hitChance

  if (!hit) {
    return { hit: false, damage: 0 }
  }

  const [minimumDamage, maximumDamage] = attacker.damageRange
  const damage = Math.floor(random() * (maximumDamage - minimumDamage + 1))
    + minimumDamage

  return { hit: true, damage }
}
