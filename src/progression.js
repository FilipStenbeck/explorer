export const experienceForLevel = (level) => {
  const normalizedLevel = Math.max(1, Math.floor(level))
  return (3 * (normalizedLevel - 1) * (normalizedLevel + 2)) / 2
}

export const getLevelForExperience = (experience) => {
  const normalizedExperience = Math.max(0, Math.floor(experience))
  let level = 1

  while (normalizedExperience >= experienceForLevel(level + 1)) {
    level += 1
  }

  return level
}
