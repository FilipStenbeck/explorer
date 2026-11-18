export const getGridDistance = (from, to) =>
  Math.abs(from.x - to.x) + Math.abs(from.y - to.y)

export const isTargetInRange = (attacker, target, range) =>
  getGridDistance(attacker, target) <= range
