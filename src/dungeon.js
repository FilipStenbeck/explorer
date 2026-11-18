export const GRID_WIDTH = 31
export const GRID_HEIGHT = 21

export const TILE = {
  WALL: 'wall',
  FLOOR: 'floor',
  EXIT: 'exit',
}

const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const roomCenter = (room) => ({
  x: Math.floor(room.x + room.width / 2),
  y: Math.floor(room.y + room.height / 2),
})

const overlaps = (candidate, room) =>
  candidate.x - 1 < room.x + room.width &&
  candidate.x + candidate.width + 1 > room.x &&
  candidate.y - 1 < room.y + room.height &&
  candidate.y + candidate.height + 1 > room.y

const carveRoom = (tiles, room) => {
  for (let y = room.y; y < room.y + room.height; y += 1) {
    for (let x = room.x; x < room.x + room.width; x += 1) {
      tiles[y][x] = TILE.FLOOR
    }
  }
}

const carveHorizontal = (tiles, fromX, toX, y) => {
  const start = Math.min(fromX, toX)
  const end = Math.max(fromX, toX)

  for (let x = start; x <= end; x += 1) {
    tiles[y][x] = TILE.FLOOR
  }
}

const carveVertical = (tiles, fromY, toY, x) => {
  const start = Math.min(fromY, toY)
  const end = Math.max(fromY, toY)

  for (let y = start; y <= end; y += 1) {
    tiles[y][x] = TILE.FLOOR
  }
}

const connectRooms = (tiles, fromRoom, toRoom) => {
  const from = roomCenter(fromRoom)
  const to = roomCenter(toRoom)

  if (Math.random() > 0.5) {
    carveHorizontal(tiles, from.x, to.x, from.y)
    carveVertical(tiles, from.y, to.y, to.x)
  } else {
    carveVertical(tiles, from.y, to.y, from.x)
    carveHorizontal(tiles, from.x, to.x, to.y)
  }
}

const createRoom = () => {
  const width = randomInt(4, 8)
  const height = randomInt(4, 7)

  return {
    x: randomInt(2, GRID_WIDTH - width - 3),
    y: randomInt(2, GRID_HEIGHT - height - 3),
    width,
    height,
  }
}

const addExits = (tiles, rooms, start) => {
  const exitCount = randomInt(1, Math.min(3, rooms.length))
  const roomPool = rooms.length > 1 ? rooms.slice(1) : rooms
  const candidates = [...roomPool].sort(() => Math.random() - 0.5)
  const exits = []

  for (let index = 0; index < exitCount; index += 1) {
    const room = candidates[index % candidates.length]
    let exit

    do {
      exit = {
        x: randomInt(room.x, room.x + room.width - 1),
        y: randomInt(room.y, room.y + room.height - 1),
      }
    } while (
      (exit.x === start.x && exit.y === start.y) ||
      exits.some(({ x, y }) => x === exit.x && y === exit.y)
    )

    tiles[exit.y][exit.x] = TILE.EXIT
    exits.push(exit)
  }

  return exits
}

export function generateDungeon() {
  const tiles = Array.from({ length: GRID_HEIGHT }, () =>
    Array(GRID_WIDTH).fill(TILE.WALL),
  )
  const rooms = []
  const desiredRooms = randomInt(5, 8)

  for (let attempt = 0; attempt < 180 && rooms.length < desiredRooms; attempt += 1) {
    const room = createRoom()

    if (rooms.some((existingRoom) => overlaps(room, existingRoom))) {
      continue
    }

    carveRoom(tiles, room)

    if (rooms.length > 0) {
      connectRooms(tiles, rooms.at(-1), room)
    }

    rooms.push(room)
  }

  const start = roomCenter(rooms[0])
  const exits = addExits(tiles, rooms, start)

  return { tiles, rooms, start, exits }
}
