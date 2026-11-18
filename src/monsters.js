import { TILE } from './dungeon.js'
import { findPath } from './pathfinding.js'

export const MONSTER_TYPES = [
  {
    id: 'bat',
    name: 'Bat',
    speed: 12,
    range: 1,
    health: 1,
    attack: 1,
    walkSprite: '/sprites/bat-walk.png',
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    speed: 6,
    range: 1,
    health: 2,
    attack: 3,
    walkSprite: '/sprites/skeleton-walk.png',
  },
  {
    id: 'zombie',
    name: 'Zombie',
    speed: 4,
    range: 1,
    health: 3,
    attack: 4,
    walkSprite: '/sprites/zombie-walk.png',
  },
  {
    id: 'orc',
    name: 'Orc',
    speed: 7,
    range: 1,
    health: 4,
    attack: 6,
    walkSprite: '/sprites/orc-walk.png',
  },
  {
    id: 'cultist',
    name: 'Cultist',
    speed: 8,
    range: 1,
    health: 2,
    attack: 5,
    walkSprite: '/sprites/cultist-walk.png',
  },
]

const positionKey = ({ x, y }) => `${x},${y}`
const samePosition = (first, second) =>
  first.x === second.x && first.y === second.y

export function getMonsterCount(depth, random = Math.random) {
  const progression = Math.min(Math.max((depth - 1) / 12, 0), 1)
  const oneMonsterChance = 0.72 - progression * 0.52
  const twoMonsterChance = 0.24 + progression * 0.11
  const roll = random()

  if (roll < oneMonsterChance) return 1
  if (roll < oneMonsterChance + twoMonsterChance) return 2
  return 3
}

const shuffle = (items, random) => {
  const result = [...items]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const item = result[index]
    result[index] = result[swapIndex]
    result[swapIndex] = item
  }

  return result
}

export function spawnMonsters(dungeon, depth, random = Math.random) {
  const allFloorTiles = dungeon.tiles.flatMap((row, y) =>
    row.flatMap((tile, x) =>
      tile === TILE.FLOOR && (x !== dungeon.start.x || y !== dungeon.start.y)
        ? [{ x, y }]
        : [],
    ),
  )
  const distantTiles = allFloorTiles.filter(
    ({ x, y }) =>
      Math.abs(x - dungeon.start.x) + Math.abs(y - dungeon.start.y) >= 6,
  )
  const candidates = shuffle(
    distantTiles.length >= 3 ? distantTiles : allFloorTiles,
    random,
  )
  const count = Math.min(getMonsterCount(depth, random), candidates.length)

  return candidates.slice(0, count).map((position, index) => {
    const type = MONSTER_TYPES[Math.floor(random() * MONSTER_TYPES.length)]

    return {
      ...type,
      instanceId: `${depth}-${index}-${type.id}`,
      position,
      frame: 0,
      facing: 'left',
    }
  })
}

export function advanceMonsters(tiles, monsters, player, stepNumber) {
  const occupied = new Set(monsters.map(({ position }) => positionKey(position)))

  return monsters.map((monster) => {
    if (stepNumber >= monster.speed) return monster

    occupied.delete(positionKey(monster.position))
    const blockers = [...occupied].map((key) => {
      const [x, y] = key.split(',').map(Number)
      return { x, y }
    })
    const [nextPosition] = findPath(tiles, monster.position, player, blockers)
    const canMove = nextPosition && !samePosition(nextPosition, player)
    const position = canMove ? nextPosition : monster.position

    occupied.add(positionKey(position))

    if (!canMove) return monster

    return {
      ...monster,
      position,
      frame: monster.frame === 0 ? 1 : 0,
      facing:
        position.x === monster.position.x
          ? monster.facing
          : position.x < monster.position.x
            ? 'left'
            : 'right',
    }
  })
}
