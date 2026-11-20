import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CHARACTERS } from './characters.js'
import {
  getGridDistance,
  hasLineOfSight,
  isTargetInRange,
  rollAttack,
} from './combat.js'
import { generateDungeon, GRID_WIDTH, TILE } from './dungeon.js'
import { advanceMonsters, spawnMonsters } from './monsters.js'
import { findPath, getPathArrow } from './pathfinding.js'
import { experienceForLevel, getLevelForExperience } from './progression.js'

const STEP_DELAY = 150
const MONSTER_STEP_DELAY = 110
const ATTACK_FRAME_DELAY = 130
const ENEMY_ATTACK_DELAY = 900
const ATTACK_RESULT_DURATION = 2200

const wait = (milliseconds) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

const isSamePosition = (first, second) =>
  first?.x === second?.x && first?.y === second?.y

const WALL_EDGE_DIRECTIONS = [
  { side: 'top', x: 0, y: -1, seed: 0 },
  { side: 'right', x: 1, y: 0, seed: 11 },
  { side: 'bottom', x: 0, y: 1, seed: 23 },
  { side: 'left', x: -1, y: 0, seed: 37 },
]

function HealthHearts({ health, name }) {
  return (
    <div className="health-hearts" aria-label={`${name} health: ${health}`}>
      {health > 0 ? (
        Array.from({ length: health }, (_, index) => (
          <span key={index} aria-hidden="true">♥</span>
        ))
      ) : (
        <span className="health-hearts__empty" aria-hidden="true">0</span>
      )}
    </div>
  )
}

function Tombstone({ portrait = false }) {
  return (
    <span
      className={`tombstone${portrait ? ' tombstone--portrait' : ''}`}
      aria-hidden="true"
    >
      <span>RIP</span>
    </span>
  )
}

function StatsBlock({ entity, side }) {
  const isHero = side === 'hero'
  const currentHealth = entity?.currentHealth ?? entity?.health

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
            {entity.isDead ? (
              <Tombstone portrait />
            ) : isHero ? (
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
            <HealthHearts health={currentHealth} name={entity.name} />
          </div>
          <div className="stats-field stats-field--number">
            <span>Movement speed</span>
            <strong>{entity.moveRange ?? entity.speed}</strong>
          </div>
          <div className="stats-field stats-field--number">
            <span>Attack range</span>
            <strong>{entity.attackRange ?? entity.range}</strong>
          </div>
          <div className="stats-field stats-field--number">
            <span>Chance to hit</span>
            <strong>{Math.round(entity.hitChance * 100)}%</strong>
          </div>
          <div className="stats-field stats-field--number">
            <span>Base damage</span>
            <strong>{entity.damageRange[0]}–{entity.damageRange[1]}</strong>
          </div>
          {isHero && (
            <>
              <div className="stats-field stats-field--number stats-field--level">
                <span>Level</span>
                <strong>{entity.level}</strong>
              </div>
              <div className="stats-field stats-field--number stats-field--experience">
                <span>Experience</span>
                <strong>
                  {entity.experience} / {entity.nextLevelExperience}
                </strong>
              </div>
            </>
          )}
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
  const [heroHealth, setHeroHealth] = useState(0)
  const [heroExperience, setHeroExperience] = useState(0)
  const [gameOver, setGameOver] = useState(false)
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
  const [isEnemyAttacking, setIsEnemyAttacking] = useState(false)
  const [isAttacking, setIsAttacking] = useState(false)
  const [attackFrame, setAttackFrame] = useState(0)
  const [attackTargetId, setAttackTargetId] = useState(null)
  const [monsterAttackId, setMonsterAttackId] = useState(null)
  const [isHeroHit, setIsHeroHit] = useState(false)
  const [attackResult, setAttackResult] = useState(null)
  const [combatMessage, setCombatMessage] = useState(null)
  const [attacksRemaining, setAttacksRemaining] = useState(1)
  const [selectedMonsterId, setSelectedMonsterId] = useState(null)
  const enemyTurnLock = useRef(false)
  const attackLock = useRef(false)
  const attackResultTimer = useRef(null)
  const attackResultId = useRef(0)

  const clearAttackResult = useCallback(() => {
    window.clearTimeout(attackResultTimer.current)
    attackResultTimer.current = null
    setAttackResult(null)
  }, [])

  const showAttackResult = useCallback((hit, message) => {
    window.clearTimeout(attackResultTimer.current)
    attackResultId.current += 1
    setAttackResult({ id: attackResultId.current, hit, message })
    attackResultTimer.current = window.setTimeout(() => {
      setAttackResult(null)
      attackResultTimer.current = null
    }, ATTACK_RESULT_DURATION)
  }, [])

  useEffect(() => () => window.clearTimeout(attackResultTimer.current), [])

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
    setIsEnemyAttacking(false)
    setIsAttacking(false)
    setAttackFrame(0)
    setAttackTargetId(null)
    setMonsterAttackId(null)
    setIsHeroHit(false)
    clearAttackResult()
    setCombatMessage(null)
    setAttacksRemaining(1)
    setSelectedMonsterId(null)
    setGameOver(false)
    attackLock.current = false
    enemyTurnLock.current = false
    setTurn(1)
    setDepth(nextDepth)
    setIsPlaying(true)
  }, [clearAttackResult])

  const chooseCharacter = (nextCharacter) => {
    setCharacter(nextCharacter)
    setHeroHealth(nextCharacter.health)
    setHeroExperience(0)
    enterDungeon(1, nextCharacter.moveRange)
  }

  const beginNewTurn = useCallback(async () => {
    if (
      !character ||
      gameOver ||
      isMoving ||
      isEnemyMoving ||
      isEnemyAttacking ||
      isAttacking ||
      enemyTurnLock.current ||
      attackLock.current
    ) return

    enemyTurnLock.current = true
    clearAttackResult()
    setCombatMessage(null)
    setIsEnemyMoving(true)
    let nextMonsters = monsters
    const fastestMonster = Math.max(
      0,
      ...monsters.filter(({ isDead }) => !isDead).map(({ speed }) => speed),
    )

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

    setIsEnemyMoving(false)
    setIsEnemyAttacking(true)
    let remainingHeroHealth = heroHealth

    for (const monster of nextMonsters) {
      if (
        monster.isDead ||
        !isTargetInRange(monster.position, player, monster.range) ||
        !hasLineOfSight(dungeon.tiles, monster.position, player)
      ) {
        continue
      }

      setMonsterAttackId(monster.instanceId)
      setCombatMessage(`${monster.name} attacks ${character.name}…`)
      await wait(ATTACK_FRAME_DELAY * 2)

      const attack = rollAttack(monster)

      if (attack.hit) {
        remainingHeroHealth = Math.max(0, remainingHeroHealth - attack.damage)
        setHeroHealth(remainingHeroHealth)
        setIsHeroHit(true)
        const resultMessage = `${monster.name} hits ${character.name} for ${attack.damage} damage.`
        showAttackResult(true, resultMessage)
      } else {
        const resultMessage = `${monster.name} misses ${character.name}.`
        showAttackResult(false, resultMessage)
      }

      setCombatMessage(null)
      await wait(ENEMY_ATTACK_DELAY)
      setIsHeroHit(false)

      if (remainingHeroHealth === 0) {
        break
      }
    }

    setMonsterAttackId(null)
    setIsHeroHit(false)
    setIsEnemyAttacking(false)

    if (remainingHeroHealth === 0) {
      setGameOver(true)
      setMovesRemaining(0)
      setAttacksRemaining(0)
      setSelectedTarget(null)
      setPlannedPath([])
      setCombatMessage(
        `${character.name} has fallen.`,
      )
      enemyTurnLock.current = false
      return
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

    enemyTurnLock.current = false
  }, [
    character,
    clearAttackResult,
    dungeon.tiles,
    gameOver,
    heroHealth,
    isEnemyAttacking,
    isEnemyMoving,
    isAttacking,
    isMoving,
    monsters,
    player,
    selectedTarget,
    showAttackResult,
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
      gameOver ||
      isMoving ||
      isEnemyMoving ||
      isEnemyAttacking ||
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
    gameOver,
    isEnemyAttacking,
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
      gameOver ||
      isMoving ||
      isEnemyMoving ||
      isEnemyAttacking ||
      isAttacking ||
      attackLock.current
    ) return

    if (monster.isDead) {
      setCombatMessage(`${monster.name} has already fallen.`)
      return
    }

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

    if (!hasLineOfSight(dungeon.tiles, player, monster.position)) {
      setCombatMessage(`${monster.name} is behind a wall. No clear line of sight.`)
      return
    }

    attackLock.current = true
    setIsAttacking(true)
    setAttackTargetId(monster.instanceId)
    setAttacksRemaining(0)
    setSelectedTarget(null)
    setPlannedPath([])
    setCombatMessage(`${character.name} attacks ${monster.name}…`)
    clearAttackResult()
    const attack = rollAttack(character)

    if (monster.position.x !== player.x) {
      setFacing(monster.position.x < player.x ? 'left' : 'right')
    }

    setAttackFrame(0)
    await wait(ATTACK_FRAME_DELAY)
    setAttackFrame(1)
    await wait(ATTACK_FRAME_DELAY)
    setAttackFrame(2)
    await wait(ATTACK_FRAME_DELAY * 1.4)

    if (attack.hit) {
      const nextHealth = Math.max(
        0,
        (monster.currentHealth ?? monster.health) - attack.damage,
      )
      const wasKilled = nextHealth === 0

      setMonsters((currentMonsters) =>
        currentMonsters.map((currentMonster) =>
          currentMonster.instanceId === monster.instanceId
            ? { ...currentMonster, currentHealth: nextHealth, isDead: wasKilled }
            : currentMonster,
        ),
      )
      if (wasKilled) {
        const nextExperience = heroExperience + monster.experienceReward
        const currentLevel = getLevelForExperience(heroExperience)
        const nextLevel = getLevelForExperience(nextExperience)

        setHeroExperience(nextExperience)

        if (nextLevel > currentLevel) {
          setHeroHealth(character.health)
        }

        const levelUpMessage = nextLevel > currentLevel
          ? ` Level ${nextLevel} reached! Health restored.`
          : ''
        const resultMessage = `${character.name} hits ${monster.name} for ${attack.damage} damage. ${monster.name} is slain. +${monster.experienceReward} EXP.${levelUpMessage}`
        setCombatMessage(null)
        showAttackResult(true, resultMessage)
      } else {
        const resultMessage = `${character.name} hits ${monster.name} for ${attack.damage} damage.`
        setCombatMessage(null)
        showAttackResult(true, resultMessage)
      }
    } else {
      const resultMessage = `${character.name} misses ${monster.name}.`
      setCombatMessage(null)
      showAttackResult(false, resultMessage)
    }

    setIsAttacking(false)
    setAttackTargetId(null)
    attackLock.current = false
  }, [
    attacksRemaining,
    character,
    clearAttackResult,
    gameOver,
    isAttacking,
    isEnemyAttacking,
    isEnemyMoving,
    isMoving,
    dungeon.tiles,
    heroExperience,
    player,
    showAttackResult,
  ])

  const handleTileClick = (position, tile, monster) => {
    if (
      gameOver ||
      isMoving ||
      isEnemyMoving ||
      isEnemyAttacking ||
      isAttacking ||
      tile === TILE.WALL ||
      isSamePosition(position, player)
    ) {
      return
    }

    if (monster) {
      setSelectedTarget(null)
      setPlannedPath([])

      if (monster.isDead) {
        setSelectedMonsterId(monster.instanceId)
        setCombatMessage(`${monster.name} lies defeated.`)
        return
      }

      if (selectedMonsterId !== monster.instanceId) {
        const distance = getGridDistance(player, monster.position)
        const isWithinRange = isTargetInRange(
          player,
          monster.position,
          character.attackRange,
        )
        const hasClearShot = hasLineOfSight(
          dungeon.tiles,
          player,
          monster.position,
        )
        setSelectedMonsterId(monster.instanceId)
        setCombatMessage(
          !isWithinRange
            ? `${monster.name} selected at ${distance} spaces. Move within range ${character.attackRange} to attack.`
            : hasClearShot
              ? `${monster.name} selected. Click it again to attack.`
              : `${monster.name} selected, but a wall blocks line of sight.`,
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

  const aliveMonsterCount = useMemo(
    () => monsters.filter(({ isDead }) => !isDead).length,
    [monsters],
  )
  const heroLevel = getLevelForExperience(heroExperience)
  const heroStats = character
    ? {
        ...character,
        currentHealth: heroHealth,
        experience: heroExperience,
        level: heroLevel,
        nextLevelExperience: experienceForLevel(heroLevel + 1),
        isDead: gameOver,
      }
    : null

  const returnToCharacterSelect = () => {
    clearAttackResult()
    setIsPlaying(false)
    setCharacter(null)
    setCombatMessage(null)
  }

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
          <span className="monster-count">Monsters {aliveMonsterCount}</span>
        </div>
      </header>

      <section className="battle-layout">
        <StatsBlock entity={selectedMonster} side="monster" />

        <section className="dungeon-panel" aria-label={`Dungeon depth ${depth}`}>
          <div
            className={`dungeon-grid${isMoving || isEnemyMoving || isEnemyAttacking || isAttacking ? ' dungeon-grid--moving' : ''}`}
            style={{ '--grid-width': GRID_WIDTH }}
            aria-label={`A dungeon with ${dungeon.rooms.length} connected rooms, ${dungeon.exits.length} exits, and ${aliveMonsterCount} living monsters. The player is at column ${player.x + 1}, row ${player.y + 1}.`}
          >
          {dungeon.tiles.flatMap((row, y) =>
            row.map((tile, x) => {
              const position = { x, y }
              const hasPlayer = isSamePosition(player, position)
              const isSelected = isSamePosition(selectedTarget, position)
              const pathStep = pathSteps.get(`${x},${y}`)
              const isWall = tile === TILE.WALL
              const wallVariant = (x * 13 + y * 7) % 6
              const wallEdges = isWall
                ? WALL_EDGE_DIRECTIONS
                    .filter(({ x: offsetX, y: offsetY }) => {
                      const neighboringTile = dungeon.tiles[y + offsetY]?.[x + offsetX]
                      return neighboringTile && neighboringTile !== TILE.WALL
                    })
                    .map((edge) => ({
                      ...edge,
                      variant: (x * 17 + y * 29 + edge.seed) % 6,
                    }))
                : []
              const monster = monstersByPosition.get(`${x},${y}`)
              const monsterDistance = monster
                ? getGridDistance(player, monster.position)
                : null
              const monsterWithinRange = monster && !monster.isDead
                ? isTargetInRange(player, monster.position, character.attackRange)
                : false
              const monsterHasLineOfSight = monster && !monster.isDead
                ? hasLineOfSight(dungeon.tiles, player, monster.position)
                : false
              const monsterInRange = monsterWithinRange && monsterHasLineOfSight
              const canAttackMonster = monsterInRange && attacksRemaining > 0 && !gameOver
              const isAttackTarget = monster?.instanceId === attackTargetId
              const isMonsterAttacking = monster?.instanceId === monsterAttackId
              const isSelectedMonster = monster?.instanceId === selectedMonsterId

              return (
                <button
                  className={`tile tile--${tile}${isWall ? ` tile--wall-variant-${wallVariant}${wallEdges.length ? ' tile--wall-boundary' : ''}` : ''}${hasPlayer ? ' tile--player' : ''}${monster ? ` tile--monster${monster.isDead ? ' tile--monster-dead' : ` tile--monster-${canAttackMonster ? 'in-range' : monsterInRange ? 'attack-spent' : 'out-of-range'}`}` : ''}${isSelectedMonster ? ' tile--monster-selected' : ''}${isAttackTarget ? ' tile--attack-target' : ''}${isMonsterAttacking ? ' tile--monster-attacking' : ''}${isHeroHit && hasPlayer ? ' tile--hero-hit' : ''}${isSelected ? ' tile--selected' : ''}`}
                  key={`${x}-${y}`}
                  type="button"
                  disabled={isWall || gameOver || isMoving || isEnemyMoving || isEnemyAttacking || isAttacking}
                  onClick={() => handleTileClick(position, tile, monster)}
                  aria-label={
                    isWall
                      ? undefined
                      : monster
                        ? `${monster.name}, speed ${monster.speed}, range ${monster.range}, health ${monster.currentHealth} of ${monster.health}, ${monster.isDead ? 'defeated' : `${Math.round(monster.hitChance * 100)} percent chance to hit, damage ${monster.damageRange[0]} to ${monster.damageRange[1]}, ${isSelectedMonster ? 'selected, click again to attack, ' : 'click to inspect, '}${!monsterWithinRange ? `out of attack range at ${monsterDistance} spaces` : !monsterHasLineOfSight ? 'within range but blocked by a wall' : attacksRemaining > 0 ? 'in attack range' : 'in range but attack already used this turn'}`}, at column ${x + 1}, row ${y + 1}`
                        : `${tile === TILE.EXIT ? 'Exit' : 'Floor'} at column ${x + 1}, row ${y + 1}${isSelected ? ', selected destination' : ''}`
                  }
                  aria-hidden={isWall ? 'true' : undefined}
                >
                  {wallEdges.map(({ side, variant }) => (
                    <span
                      className={`wall-edge wall-edge--${side} wall-edge--variant-${variant}`}
                      key={side}
                      aria-hidden="true"
                    />
                  ))}
                  {pathStep && !hasPlayer && (
                    <span
                      className={`path-arrow path-arrow--${pathStep.isReachable ? 'reachable' : 'beyond'}`}
                      aria-hidden="true"
                    >
                      {pathStep.arrow}
                    </span>
                  )}
                  {hasPlayer && (gameOver ? (
                    <Tombstone />
                  ) : (
                    <span
                      className={
                        isAttacking
                          ? `player-sprite player-sprite--attacking player-attack--frame-${attackFrame} player-sprite--${facing}`
                          : `player-sprite player-sprite--frame-${stepFrame} player-sprite--${facing}${isHeroHit ? ' player-sprite--hit' : ''}`
                      }
                      style={{
                        backgroundImage: `url(${isAttacking ? character.attackSprite : character.walkSprite})`,
                      }}
                      aria-hidden="true"
                    />
                  ))}
                  {monster && !hasPlayer && (monster.isDead ? (
                    <Tombstone />
                  ) : (
                    <span
                      className={`monster-sprite monster-sprite--${monster.id} monster-sprite--frame-${monster.frame} monster-sprite--${monster.facing}${isMonsterAttacking ? ' monster-sprite--attacking' : ''}`}
                      style={{ backgroundImage: `url(${monster.walkSprite})` }}
                      aria-hidden="true"
                    />
                  ))}
                  {(isAttackTarget || (hasPlayer && isHeroHit)) && (
                    <span className="attack-impact" aria-hidden="true">×</span>
                  )}
                  {!hasPlayer && !monster && tile === TILE.EXIT && !pathStep && (
                    <span className="exit-stairs" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                    </span>
                  )}
                </button>
              )
            }),
          )}
          </div>
          {attackResult && (
            <div
              className={`combat-result combat-result--${attackResult.hit ? 'hit' : 'miss'}`}
              key={attackResult.id}
              role="status"
              aria-live="assertive"
            >
              <strong>{attackResult.hit ? 'Hit!' : 'Miss!'}</strong>
              <span>{attackResult.message}</span>
            </div>
          )}
          {gameOver && (
            <section className="game-over" role="alert" aria-labelledby="game-over-title">
              <p>The dungeon claims another explorer</p>
              <h2 id="game-over-title">Game Over</h2>
              <button type="button" onClick={returnToCharacterSelect}>
                Choose another hero
              </button>
            </section>
          )}
        </section>

        <StatsBlock entity={heroStats} side="hero" />
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
              : isEnemyAttacking
                ? combatMessage
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
          disabled={gameOver || isMoving || isEnemyMoving || isEnemyAttacking || isAttacking}
        >
          New turn <kbd>Enter</kbd>
        </button>
      </footer>
    </main>
  )
}

export default App
