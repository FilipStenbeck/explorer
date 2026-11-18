import { useCallback, useEffect, useState } from 'react'
import { generateDungeon, GRID_WIDTH, TILE } from './dungeon.js'

const DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
}

const CHARACTERS = [
  {
    id: 'warrior',
    name: 'Warrior',
    title: 'The Iron Vanguard',
    description: 'Shield raised, sword ready. Built to face the dark head-on.',
    sprite: '/sprites/warrior.png',
    walkSprite: '/sprites/warrior-walk.png',
  },
  {
    id: 'wizard',
    name: 'Wizard',
    title: 'The Arcane Seeker',
    description: 'Ancient words and a bright staff illuminate forgotten paths.',
    sprite: '/sprites/wizard.png',
    walkSprite: '/sprites/wizard-walk.png',
  },
  {
    id: 'ranger',
    name: 'Ranger',
    title: 'The Silent Pathfinder',
    description: 'Keen eyes and a steady bow find a way through any ruin.',
    sprite: '/sprites/ranger.png',
    walkSprite: '/sprites/ranger-walk.png',
  },
]

function App() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [character, setCharacter] = useState(null)
  const [depth, setDepth] = useState(1)
  const [dungeon, setDungeon] = useState(() => generateDungeon())
  const [player, setPlayer] = useState(dungeon.start)
  const [stepFrame, setStepFrame] = useState(0)
  const [facing, setFacing] = useState('right')

  const enterDungeon = useCallback((nextDepth = 1) => {
    const nextDungeon = generateDungeon()
    setDungeon(nextDungeon)
    setPlayer(nextDungeon.start)
    setStepFrame(0)
    setFacing('right')
    setDepth(nextDepth)
    setIsPlaying(true)
  }, [])

  const chooseCharacter = (nextCharacter) => {
    setCharacter(nextCharacter)
    enterDungeon(1)
  }

  const movePlayer = useCallback(
    ({ x, y }) => {
      const destination = { x: player.x + x, y: player.y + y }
      const destinationTile = dungeon.tiles[destination.y]?.[destination.x]

      if (!destinationTile || destinationTile === TILE.WALL) {
        return
      }

      if (destinationTile === TILE.EXIT) {
        enterDungeon(depth + 1)
        return
      }

      if (x !== 0) {
        setFacing(x < 0 ? 'left' : 'right')
      }

      setStepFrame((currentFrame) => (currentFrame === 0 ? 1 : 0))
      setPlayer(destination)
    },
    [depth, dungeon.tiles, enterDungeon, player],
  )

  useEffect(() => {
    if (!isPlaying) return undefined

    const handleKeyDown = (event) => {
      const direction = DIRECTIONS[event.key]
      if (!direction) return

      event.preventDefault()
      movePlayer(direction)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlaying, movePlayer])

  if (!isPlaying) {
    return (
      <main className="game-shell">
        <section className="title-card title-card--select" aria-labelledby="game-title">
          <p className="eyebrow">An old-school dungeon adventure</p>
          <h1 id="game-title">Explorer</h1>
          <p className="intro">
            Beyond the gate, forgotten passages wait to be mapped. Choose who
            will enter the dark.
          </p>
          <div className="character-grid" aria-label="Choose your character">
            {CHARACTERS.map((option) => (
              <button
                className={`character-card character-card--${option.id}`}
                key={option.id}
                type="button"
                onClick={() => chooseCharacter(option)}
                aria-label={`Choose ${option.name}, ${option.title}`}
              >
                <span className="character-portrait" aria-hidden="true">
                  <img src={option.sprite} alt="" draggable="false" />
                </span>
                <span className="character-copy">
                  <strong>{option.name}</strong>
                  <small>{option.title}</small>
                  <span>{option.description}</span>
                </span>
                <span className="choose-label">Choose {option.name}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="game-screen">
      <header className="game-header">
        <div>
          <p className="eyebrow">The forgotten passages</p>
          <h1>Explorer</h1>
        </div>
        <div className="game-stats" aria-label="Dungeon status">
          <span className="character-stat">
            <img src={character.sprite} alt="" aria-hidden="true" />
            {character.name}
          </span>
          <span>Depth {depth}</span>
          <span>{dungeon.rooms.length} rooms</span>
          <span>{dungeon.exits.length} exits</span>
        </div>
      </header>

      <section className="dungeon-panel" aria-label={`Dungeon depth ${depth}`}>
        <div
          className="dungeon-grid"
          style={{ '--grid-width': GRID_WIDTH }}
          role="img"
          aria-label={`A dungeon with ${dungeon.rooms.length} connected rooms and ${dungeon.exits.length} exits. The player is at column ${player.x + 1}, row ${player.y + 1}.`}
        >
          {dungeon.tiles.flatMap((row, y) =>
            row.map((tile, x) => {
              const hasPlayer = player.x === x && player.y === y

              return (
                <span
                  className={`tile tile--${tile}${hasPlayer ? ' tile--player' : ''}`}
                  key={`${x}-${y}`}
                  aria-hidden="true"
                >
                  {hasPlayer && (
                    <span
                      className={`player-sprite player-sprite--frame-${stepFrame} player-sprite--${facing}`}
                      style={{ backgroundImage: `url(${character.walkSprite})` }}
                    />
                  )}
                  {!hasPlayer && tile === TILE.EXIT && (
                    <span className="exit-marker">◇</span>
                  )}
                </span>
              )
            }),
          )}
        </div>
      </section>

      <footer className="game-footer">
        <p>
          <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd>
          <span>Move through the dungeon. Step onto a glowing diamond to descend.</span>
        </p>
        <button className="secondary-button" type="button" onClick={() => enterDungeon(depth)}>
          New grid
        </button>
      </footer>
    </main>
  )
}

export default App
