import { TILE } from './dungeon.js'
import { findPath } from './pathfinding.js'

export const MONSTER_TYPES = [
  {
    id: 'bat',
    name: 'Bat',
    speed: 12,
    range: 1,
    health: 1,
    experienceReward: 1,
    hitChance: 0.55,
    damageRange: [1, 2],
    walkSprite: '/sprites/bat-walk.png',
  },
  {
    id: 'skeleton',
    name: 'Skeleton',
    speed: 6,
    range: 1,
    health: 4,
    experienceReward: 2,
    hitChance: 0.65,
    damageRange: [1, 4],
    walkSprite: '/sprites/skeleton-walk.png',
  },
  {
    id: 'zombie',
    name: 'Zombie',
    speed: 4,
    range: 1,
    health: 5,
    experienceReward: 3,
    hitChance: 0.5,
    damageRange: [1, 5],
    walkSprite: '/sprites/zombie-walk.png',
  },
  {
    id: 'orc',
    name: 'Orc',
    speed: 7,
    range: 1,
    health: 10,
    experienceReward: 4,
    hitChance: 0.65,
    damageRange: [3, 6],
    walkSprite: '/sprites/orc-walk.png',
  },
  {
    id: 'cultist',
    name: 'Cultist',
    speed: 8,
    range: 1,
    health: 4,
    experienceReward: 2,
    hitChance: 0.65,
    damageRange: [1, 3],
    walkSprite: '/sprites/cultist-walk.png',
  },
]

const positionKey = ({ x, y }) => `${x},${y}`
const samePosition = (first, second) =>
  first.x === second.x && first.y === second.y

export function getMonsterCount(depth, random = Math.random) {
  const progression = Math.min(Math.max((depth - 1) / 12, 0), 1)
  const twoMonsterChance = 0.62 - progression * 0.47
  const threeMonsterChance = 0.27 - progression * 0.02
  const fourMonsterChance = 0.09 + progression * 0.21
  const roll = random()

  if (roll < twoMonsterChance) return 2
  if (roll < twoMonsterChance + threeMonsterChance) return 3
  if (roll < twoMonsterChance + threeMonsterChance + fourMonsterChance) return 4
  return 5
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
      currentHealth: type.health,
      isDead: false,
      frame: 0,
      facing: 'left',
    }
  })
}

export function advanceMonsters(tiles, monsters, player, stepNumber) {
  const occupied = new Set(monsters.map(({ position }) => positionKey(position)))

  return monsters.map((monster) => {
    if (monster.isDead || stepNumber >= monster.speed) return monster

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
