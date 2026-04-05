import {
  calculateLevel,
  getLevelTitle,
  getLevelTier,
  getXpForNextLevel,
  getCurrentLevelXp,
  LEVELS,
  ACHIEVEMENTS,
} from '@/constants/gamification';

describe('LEVELS array', () => {
  it('has exactly 50 entries', () => {
    expect(LEVELS).toHaveLength(50);
  });

  it('starts at level 1 with xpRequired 0', () => {
    expect(LEVELS[0].level).toBe(1);
    expect(LEVELS[0].xpRequired).toBe(0);
  });

  it('ends at level 50', () => {
    expect(LEVELS[49].level).toBe(50);
  });

  it('has strictly increasing xpRequired values after level 1', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].xpRequired).toBeGreaterThan(LEVELS[i - 1].xpRequired);
    }
  });
});

describe('ACHIEVEMENTS array', () => {
  it('has 81 entries', () => {
    expect(ACHIEVEMENTS).toHaveLength(81);
  });

  it('has all unique IDs', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('every achievement has required fields', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.id).toBeTruthy();
      expect(a.name).toBeTruthy();
      expect(a.category).toBeTruthy();
      expect(a.xpReward).toBeGreaterThan(0);
    }
  });
});

describe('calculateLevel', () => {
  it('returns 1 for 0 XP', () => {
    expect(calculateLevel(0)).toBe(1);
  });

  it('returns 1 for 50 XP (below level 2 threshold)', () => {
    expect(calculateLevel(50)).toBe(1);
  });

  it('returns 2 when XP equals level 2 threshold exactly', () => {
    expect(calculateLevel(LEVELS[1].xpRequired)).toBe(2);
  });

  it('returns 50 for very high XP', () => {
    expect(calculateLevel(999_999_999)).toBe(50);
  });

  it('returns the correct level just below the next threshold', () => {
    // XP just below level 3 threshold should still be level 2
    expect(calculateLevel(LEVELS[2].xpRequired - 1)).toBe(2);
  });
});

describe('getLevelTitle', () => {
  it('returns "Seed" for level 1', () => {
    expect(getLevelTitle(1)).toBe('Seed');
  });

  it('returns a string for level 25', () => {
    const title = getLevelTitle(25);
    expect(typeof title).toBe('string');
    expect(title.length).toBeGreaterThan(0);
  });

  it('returns "Forest Master" for level 50', () => {
    expect(getLevelTitle(50)).toBe('Forest Master');
  });

  it('falls back to "Seed" for out-of-range level', () => {
    expect(getLevelTitle(0)).toBe('Seed');
    expect(getLevelTitle(99)).toBe('Seed');
  });
});

describe('getLevelTier', () => {
  it('returns "Seedling" for level 1', () => {
    expect(getLevelTier(1)).toBe('Seedling');
  });

  it('returns "Seedling" for level 10', () => {
    expect(getLevelTier(10)).toBe('Seedling');
  });

  it('returns "Sapling" for level 15', () => {
    expect(getLevelTier(15)).toBe('Sapling');
  });

  it('returns "Tree" for level 25', () => {
    expect(getLevelTier(25)).toBe('Tree');
  });

  it('returns "Forest" for level 35', () => {
    expect(getLevelTier(35)).toBe('Forest');
  });

  it('returns "Ancient" for level 45', () => {
    expect(getLevelTier(45)).toBe('Ancient');
  });
});

describe('getXpForNextLevel', () => {
  it('returns level 2 xpRequired for level 1', () => {
    expect(getXpForNextLevel(1)).toBe(LEVELS[1].xpRequired);
  });

  it('returns Infinity for level 50 (max level)', () => {
    expect(getXpForNextLevel(50)).toBe(Infinity);
  });

  it('returns a positive number for mid-range levels', () => {
    expect(getXpForNextLevel(25)).toBeGreaterThan(0);
  });
});

describe('getCurrentLevelXp', () => {
  it('returns 0 for level 1', () => {
    expect(getCurrentLevelXp(1)).toBe(0);
  });

  it('returns the xpRequired for level 50', () => {
    expect(getCurrentLevelXp(50)).toBe(LEVELS[49].xpRequired);
  });

  it('falls back to 0 for out-of-range level', () => {
    expect(getCurrentLevelXp(0)).toBe(0);
    expect(getCurrentLevelXp(99)).toBe(0);
  });
});
