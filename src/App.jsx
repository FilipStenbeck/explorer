import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getGridDistance, isTargetInRange } from './combat.js'
import { generateDungeon, GRID_WIDTH, TILE } from './dungeon.js'
import { advanceMonsters, spawnMonsters } from './monsters.js'
import { findPath, getPathArrow } from './pathfinding.js'

const STEP_DELAY = 150
const MONSTER_STEP_DELAY = 110
const ATTACK_FRAME_DELAY = 130

const CHARACTERS = [
  {
    id: 'warrior',
    name: 'Warrior',
    title: 'The Iron Vanguard',
    description: 'Shield raised, sword ready. Built to face the dark head-on.',
    health: 6,
    moveRange: 7,
    attackRange: 1,
    sprite: '/sprites/warrior.png',
    walkSprite: '/sprites/warrior-walk.png',
    attackSprite: '/sprites/warrior-attack.png',
  },
  {
    id: 'wizard',
    name: 'Wizard',
    title: 'The Arcane Seeker',
    description: 'Ancient words and a bright staff illuminate forgotten paths.',
    health: 3,
    moveRange: 5,
    attackRange: 3,
    sprite: '/sprites/wizard.png',
    walkSprite: '/sprites/wizard-walk.png',
    attackSprite: '/sprites/wizard-attack.png',
  },
  {
    id: 'ranger',
    name: 'Ranger',
    title: 'The Silent Pathfinder',
    description: 'Keen eyes and a steady bow find a way through any ruin.',
    health: 4,
    moveRange: 10,
    attackRange: 5,
    sprite: '/sprites/ranger.png',
    walkSprite: '/sprites/ranger-walk.png',
    attackSprite: '/sprites/ranger-attack.png',
  },
]

const wait = (milliseconds) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

const isSamePosition = (first, second) =>
  first?.x === second?.x && first?.y === second?.y

function HealthHearts({ health, name }) {
  return (
    <div className="health-hearts" aria-label={`${name} health: ${health}`}>
      {Array.from({ length: health }, (_, index) => (
        <span key={index} aria-hidden="true">♥</span>
      ))}
    </div>
  )
}

function StatsBlock({ entity, side }) {
  const isHero = side === 'hero'

  return (
    <aside
      className={`stats-block stats-block--${side}${entity ? '' : ' stats-block--empty'}`}
      aria-label={entity ? `${entity.name} statistics` : 'No monster selected'}
      aria-live={isHero ? undefined : 'polite'}
    >
      <p className="stats-block__eyebrow">{isHero ? 'Hero' : 'Target'}</p>
      {entity ? (
        <>
          <div className={`stats-portrait stats-portrait--${side}`} aria-hidden="true">
            {isHero ? (
              <img src={entity.sprite} alt="" />
            ) : (
              <span
                className="stats-portrait__monster"
                style={{ backgroundImage: `url(${entity.walkSprite})` }}
              />
            )}
          </div>
          <h2>{entity.name}</h2>
          <div className="stats-field">
            <span>Health</span>
            <HealthHearts health={entity.health} name={entity.name} />
          </div>
          <div className="stats-field stats-field--movement">
            <span>Movement speed</span>
            <strong>{entity.moveRange ?? entity.speed}</strong>
          </div>
        </>
      ) : (
        <div className="stats-empty-copy">
          <span aria-hidden="true">?</span>
          <p>Click a monster to inspect it.</p>
        </div>
      )}
    </aside>
  )
}

function App() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [character, setCharacter] = useState(null)
  const [depth, setDepth] = useState(1)
  const [turn, setTurn] = useState(1)
  const [dungeon, setDungeon] = useState(() => generateDungeon())
  const [player, setPlayer] = useState(dungeon.start)
  const [stepFrame, setStepFrame] = useState(0)
  const [facing, setFacing] = useState('right')
  const [movesRemaining, setMovesRemaining] = useState(0)
  const [selectedTarget, setSelectedTarget] = useState(null)
  const [plannedPath, setPlannedPath] = useState([])
  const [isMoving, setIsMoving] = useState(false)
  const [monsters, setMonsters] = useState([])
  const [isEnemyMoving, setIsEnemyMoving] = useState(false)
  const [isAttacking, setIsAttacking] = useState(false)
  const [attackFrame, setAttackFrame] = useState(0)
  const [attackTargetId, setAttackTargetId] = useState(null)
  const [combatMessage, setCombatMessage] = useState(null)
  const [attacksRemaining, setAttacksRemaining] = useState(1)
  const [selectedMonsterId, setSelectedMonsterId] = useState(null)
  const enemyTurnLock = useRef(false)
  const attackLock = useRef(false)

  const enterDungeon = useCallback((nextDepth = 1, moveRange = 0) => {
    const nextDungeon = generateDungeon()
    setDungeon(nextDungeon)
    setPlayer(nextDungeon.start)
    setStepFrame(0)
    setFacing('right')
    setMovesRemaining(moveRange)
    setSelectedTarget(null)
    setPlannedPath([])
    setIsMoving(false)
    setMonsters(spawnMonsters(nextDungeon, nextDepth))
    setIsEnemyMoving(false)
    setIsAttacking(false)
    setAttackFrame(0)
    setAttackTargetId(null)
    setCombatMessage(null)
    setAttacksRemaining(1)
    setSelectedMonsterId(null)
    attackLock.current = false
    enemyTurnLock.current = false
    setTurn(1)
    setDepth(nextDepth)
    setIsPlaying(true)
  }, [])

  const chooseCharacter = (nextCharacter) => {
    setCharacter(nextCharacter)
    enterDungeon(1, nextCharacter.moveRange)
  }

  const beginNewTurn = useCallback(async () => {
    if (
      !character ||
      isMoving ||
      isEnemyMoving ||
      isAttacking ||
      enemyTurnLock.current ||
      attackLock.current
    ) return

    enemyTurnLock.current = true
    setCombatMessage(null)
    setIsEnemyMoving(true)
    let nextMonsters = monsters
    const fastestMonster = Math.max(0, ...monsters.map(({ speed }) => speed))

    for (let step = 0; step < fastestMonster; step += 1) {
      const advancedMonsters = advanceMonsters(
        dungeon.tiles,
        nextMonsters,
        player,
        step,
      )
      const didMove = advancedMonsters.some(
        (monster, index) =>
          !isSamePosition(monster.position, nextMonsters[index].position),
      )

      if (!didMove) break

      await wait(MONSTER_STEP_DELAY)
      nextMonsters = advancedMonsters
      setMonsters(nextMonsters)
    }

    const occupiedPositions = nextMonsters.map(({ position }) => position)
    const targetIsOccupied = occupiedPositions.some((position) =>
      isSamePosition(position, selectedTarget),
    )

    setTurn((currentTurn) => currentTurn + 1)
    setMovesRemaining(character.moveRange)
    setAttacksRemaining(1)

    if (selectedTarget && !targetIsOccupied) {
      setPlannedPath(
        findPath(dungeon.tiles, player, selectedTarget, occupiedPositions),
      )
    } else if (targetIsOccupied) {
      setSelectedTarget(null)
      setPlannedPath([])
    }

    setIsEnemyMoving(false)
    enemyTurnLock.current = false
  }, [
    character,
    dungeon.tiles,
    isEnemyMoving,
    isAttacking,
    isMoving,
    monsters,
    player,
    selectedTarget,
  ])

  useEffect(() => {
    if (!isPlaying) return undefined

    const handleKeyDown = (event) => {
      if (
        event.key !== 'Enter' ||
        (event.target instanceof HTMLButtonElement &&
          event.target.classList.contains('turn-button'))
      ) {
        return
      }

      event.preventDefault()
      beginNewTurn()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [beginNewTurn, isPlaying])

  const walkPlannedPath = useCallback(async () => {
    if (
      isMoving ||
      isEnemyMoving ||
      isAttacking ||
      movesRemaining === 0 ||
      plannedPath.length === 0
    ) return

    const steps = plannedPath.slice(0, movesRemaining)
    setIsMoving(true)
    let lastPosition = player

    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index]
      await wait(STEP_DELAY)

      if (step.x !== lastPosition.x) {
        setFacing(step.x < lastPosition.x ? 'left' : 'right')
      }

      setStepFrame((currentFrame) => (currentFrame === 0 ? 1 : 0))
      setPlayer(step)
      setMovesRemaining(movesRemaining - index - 1)
      setPlannedPath(plannedPath.slice(index + 1))
      lastPosition = step

      if (dungeon.tiles[step.y][step.x] === TILE.EXIT) {
        enterDungeon(depth + 1, character.moveRange)
        return
      }
    }

    if (isSamePosition(lastPosition, selectedTarget)) {
      setSelectedTarget(null)
      setPlannedPath([])
    }

    setIsMoving(false)
  }, [
    character,
    depth,
    dungeon.tiles,
    enterDungeon,
    isEnemyMoving,
    isAttacking,
    isMoving,
    movesRemaining,
    plannedPath,
    player,
    selectedTarget,
  ])

  const performAttack = useCallback(async (monster) => {
    if (
      !character ||
      isMoving ||
      isEnemyMoving ||
      isAttacking ||
      attackLock.current
    ) return

    const distance = getGridDistance(player, monster.position)

    if (attacksRemaining === 0) {
      setCombatMessage('Attack already used. Start a new turn to attack again.')
      return
    }

    if (!isTargetInRange(player, monster.position, character.attackRange)) {
      setCombatMessage(
        `${monster.name} is out of range: ${distance} spaces away, ${character.attackRange} allowed.`,
      )
      return
    }

    attackLock.current = true
    setIsAttacking(true)
    setAttackTargetId(monster.instanceId)
    setAttacksRemaining(0)
    setSelectedTarget(null)
    setPlannedPath([])
    setCombatMessage(`${character.name} attacks ${monster.name}…`)

    if (monster.position.x !== player.x) {
      setFacing(monster.position.x < player.x ? 'left' : 'right')
    }

    setAttackFrame(0)
    await wait(ATTACK_FRAME_DELAY)
    setAttackFrame(1)
    await wait(ATTACK_FRAME_DELAY)
    setAttackFrame(2)
    await wait(ATTACK_FRAME_DELAY * 1.4)

    setIsAttacking(false)
    setAttackTargetId(null)
    setCombatMessage(
      `${character.name} attacked ${monster.name}. Damage is not enabled yet.`,
    )
    attackLock.current = false
  }, [
    attacksRemaining,
    character,
    isAttacking,
    isEnemyMoving,
    isMoving,
    player,
  ])

  const handleTileClick = (position, tile, monster) => {
    if (
      isMoving ||
      isEnemyMoving ||
      isAttacking ||
      tile === TILE.WALL ||
      isSamePosition(position, player)
    ) {
      return
    }

    if (monster) {
      setSelectedTarget(null)
      setPlannedPath([])

      if (selectedMonsterId !== monster.instanceId) {
        const distance = getGridDistance(player, monster.position)
        setSelectedMonsterId(monster.instanceId)
        setCombatMessage(
          isTargetInRange(player, monster.position, character.attackRange)
            ? `${monster.name} selected. Click it again to attack.`
            : `${monster.name} selected at ${distance} spaces. Move within range ${character.attackRange} to attack.`,
        )
        return
      }

      performAttack(monster)
      return
    }

    setCombatMessage(null)

    if (isSamePosition(position, selectedTarget)) {
      walkPlannedPath()
      return
    }

    setSelectedTarget(position)
    setPlannedPath(
      findPath(
        dungeon.tiles,
        player,
        position,
        monsters.map((monster) => monster.position),
      ),
    )
  }

  const pathSteps = useMemo(() => {
    const steps = new Map()

    plannedPath.forEach((position, index) => {
      const previousPosition = index === 0 ? player : plannedPath[index - 1]
      steps.set(`${position.x},${position.y}`, {
        arrow: getPathArrow(previousPosition, position),
        isReachable: index < movesRemaining,
      })
    })

    return steps
  }, [movesRemaining, plannedPath, player])

  const monstersByPosition = useMemo(
    () =>
      new Map(
        monsters.map((monster) => [
          `${monster.position.x},${monster.position.y}`,
          monster,
        ]),
      ),
    [monsters],
  )

  const selectedMonster = useMemo(
    () =>
      monsters.find((monster) => monster.instanceId === selectedMonsterId) ?? null,
    [monsters, selectedMonsterId],
  )

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
                aria-label={`Choose ${option.name}, ${option.title}, ${option.moveRange} spaces per turn, attack range ${option.attackRange}`}
              >
                <span className="character-portrait" aria-hidden="true">
                  <img src={option.sprite} alt="" draggable="false" />
                </span>
                <span className="character-copy">
                  <strong>{option.name}</strong>
                  <small>{option.title}</small>
                  <span>{option.description}</span>
                </span>
                <span className="choose-label">
                  Choose {option.name} · Move {option.moveRange} · Range {option.attackRange}
                </span>
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
          <span>Turn {turn}</span>
          <span className="moves-stat">Moves {movesRemaining} / {character.moveRange}</span>
          <span className="range-stat">Range {character.attackRange}</span>
          <span className={`attack-stat attack-stat--${attacksRemaining ? 'ready' : 'used'}`}>
            Attack {attacksRemaining ? 'Ready' : 'Used'}
          </span>
          <span className="monster-count">Monsters {monsters.length}</span>
        </div>
      </header>

      <section className="battle-layout">
        <StatsBlock entity={selectedMonster} side="monster" />

        <section className="dungeon-panel" aria-label={`Dungeon depth ${depth}`}>
          <div
            className={`dungeon-grid${isMoving || isEnemyMoving || isAttacking ? ' dungeon-grid--moving' : ''}`}
            style={{ '--grid-width': GRID_WIDTH }}
            aria-label={`A dungeon with ${dungeon.rooms.length} connected rooms, ${dungeon.exits.length} exits, and ${monsters.length} monsters. The player is at column ${player.x + 1}, row ${player.y + 1}.`}
          >
          {dungeon.tiles.flatMap((row, y) =>
            row.map((tile, x) => {
              const position = { x, y }
              const hasPlayer = isSamePosition(player, position)
              const isSelected = isSamePosition(selectedTarget, position)
              const pathStep = pathSteps.get(`${x},${y}`)
              const isWall = tile === TILE.WALL
              const monster = monstersByPosition.get(`${x},${y}`)
              const monsterDistance = monster
                ? getGridDistance(player, monster.position)
                : null
              const monsterInRange = monster
                ? isTargetInRange(player, monster.position, character.attackRange)
                : false
              const canAttackMonster = monsterInRange && attacksRemaining > 0
              const isAttackTarget = monster?.instanceId === attackTargetId
              const isSelectedMonster = monster?.instanceId === selectedMonsterId

              return (
                <button
                  className={`tile tile--${tile}${hasPlayer ? ' tile--player' : ''}${monster ? ` tile--monster tile--monster-${canAttackMonster ? 'in-range' : monsterInRange ? 'attack-spent' : 'out-of-range'}` : ''}${isSelectedMonster ? ' tile--monster-selected' : ''}${isAttackTarget ? ' tile--attack-target' : ''}${isSelected ? ' tile--selected' : ''}`}
                  key={`${x}-${y}`}
                  type="button"
                  disabled={isWall || isMoving || isEnemyMoving || isAttacking}
                  onClick={() => handleTileClick(position, tile, monster)}
                  aria-label={
                    isWall
                      ? undefined
                      : monster
                        ? `${monster.name}, speed ${monster.speed}, range ${monster.range}, health ${monster.health}, attack ${monster.attack}, ${isSelectedMonster ? 'selected, click again to attack, ' : 'click to inspect, '}${monsterInRange ? attacksRemaining > 0 ? 'in attack range' : 'in range but attack already used this turn' : `out of attack range at ${monsterDistance} spaces`}, at column ${x + 1}, row ${y + 1}`
                        : `${tile === TILE.EXIT ? 'Exit' : 'Floor'} at column ${x + 1}, row ${y + 1}${isSelected ? ', selected destination' : ''}`
                  }
                  aria-hidden={isWall ? 'true' : undefined}
                >
                  {pathStep && !hasPlayer && (
                    <span
                      className={`path-arrow path-arrow--${pathStep.isReachable ? 'reachable' : 'beyond'}`}
                      aria-hidden="true"
                    >
                      {pathStep.arrow}
                    </span>
                  )}
                  {hasPlayer && (
                    <span
                      className={
                        isAttacking
                          ? `player-sprite player-sprite--attacking player-attack--frame-${attackFrame} player-sprite--${facing}`
                          : `player-sprite player-sprite--frame-${stepFrame} player-sprite--${facing}`
                      }
                      style={{
                        backgroundImage: `url(${isAttacking ? character.attackSprite : character.walkSprite})`,
                      }}
                      aria-hidden="true"
                    />
                  )}
                  {monster && !hasPlayer && (
                    <span
                      className={`monster-sprite monster-sprite--${monster.id} monster-sprite--frame-${monster.frame} monster-sprite--${monster.facing}`}
                      style={{ backgroundImage: `url(${monster.walkSprite})` }}
                      aria-hidden="true"
                    />
                  )}
                  {isAttackTarget && (
                    <span className="attack-impact" aria-hidden="true">×</span>
                  )}
                  {!hasPlayer && !monster && tile === TILE.EXIT && !pathStep && (
                    <span className="exit-marker" aria-hidden="true">◇</span>
                  )}
                </button>
              )
            }),
          )}
          </div>
        </section>

        <StatsBlock entity={character} side="hero" />
      </section>

      <footer className="game-footer">
        <div className="turn-instructions" aria-live="polite">
          <p>
            <span className="legend-arrow legend-arrow--reachable">→</span>
            <span>this turn</span>
            <span className="legend-arrow legend-arrow--beyond">→</span>
            <span>future turn</span>
          </p>
          <p>
            {isEnemyMoving
              ? 'The monsters are advancing…'
              : isAttacking
                ? combatMessage
              : isMoving
                ? 'Walking the planned route…'
                : combatMessage ?? 'Click a floor to move, or an in-range monster to attack.'}
          </p>
        </div>
        <button
          className="secondary-button turn-button"
          type="button"
          onClick={beginNewTurn}
          disabled={isMoving || isEnemyMoving || isAttacking}
        >
          New turn <kbd>Enter</kbd>
        </button>
      </footer>
    </main>
  )
}

export default App
