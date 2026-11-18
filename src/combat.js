export const getGridDistance = (from, to) =>
  Math.abs(from.x - to.x) + Math.abs(from.y - to.y)

export const isTargetInRange = (attacker, target, range) =>
  getGridDistance(attacker, target) <= range

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
