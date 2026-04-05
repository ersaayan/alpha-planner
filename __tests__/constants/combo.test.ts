import {
  getSessionComboMultiplier,
  getDailyComboMultiplier,
  calculateComboXp,
} from '@/constants/combo';

describe('getSessionComboMultiplier', () => {
  it('returns 1 for combo 0', () => {
    expect(getSessionComboMultiplier(0)).toBe(1);
  });

  it('returns 1 for combo 1', () => {
    expect(getSessionComboMultiplier(1)).toBe(1);
  });

  it('returns 1.5 for combo 2', () => {
    expect(getSessionComboMultiplier(2)).toBe(1.5);
  });

  it('returns 2 for combo 3', () => {
    expect(getSessionComboMultiplier(3)).toBe(2);
  });

  it('returns 2.5 for combo 4', () => {
    expect(getSessionComboMultiplier(4)).toBe(2.5);
  });

  it('returns max multiplier (3) for combo 5', () => {
    expect(getSessionComboMultiplier(5)).toBe(3);
  });

  it('returns max multiplier (3) for combo 10 (well above cap)', () => {
    expect(getSessionComboMultiplier(10)).toBe(3);
  });
});

describe('getDailyComboMultiplier', () => {
  it('returns 1 for streak 0 (no streak)', () => {
    expect(getDailyComboMultiplier(0)).toBe(1);
  });

  it('returns 1 for streak 2 (below first tier)', () => {
    expect(getDailyComboMultiplier(2)).toBe(1);
  });

  it('returns 1.5 for streak 3 (first tier)', () => {
    expect(getDailyComboMultiplier(3)).toBe(1.5);
  });

  it('returns 2 for streak 7 (second tier)', () => {
    expect(getDailyComboMultiplier(7)).toBe(2);
  });

  it('returns 2.5 for streak 14 (third tier)', () => {
    expect(getDailyComboMultiplier(14)).toBe(2.5);
  });

  it('returns 3 for streak 30 (max tier)', () => {
    expect(getDailyComboMultiplier(30)).toBe(3);
  });

  it('returns 3 for streak 100 (well above max)', () => {
    expect(getDailyComboMultiplier(100)).toBe(3);
  });
});

describe('calculateComboXp', () => {
  const BASE = 15;

  it('returns base XP with no combos (non-pomodoro)', () => {
    // session mult ignored for non-pomodoro, daily streak 0 => mult 1
    expect(calculateComboXp(BASE, 0, 0, false)).toBe(15);
  });

  it('returns base XP with no combos (pomodoro)', () => {
    // session combo 0 => mult 1, daily streak 0 => mult 1
    expect(calculateComboXp(BASE, 0, 0, true)).toBe(15);
  });

  it('applies session combo multiplier for pomodoro', () => {
    // session combo 3 => mult 2, daily streak 0 => mult 1
    expect(calculateComboXp(BASE, 3, 0, true)).toBe(Math.round(15 * 2));
  });

  it('ignores session combo for non-pomodoro tasks', () => {
    // session combo 3 would be 2x, but isPomodoro=false => session mult = 1
    expect(calculateComboXp(BASE, 3, 0, false)).toBe(15);
  });

  it('applies daily combo multiplier', () => {
    // session combo 0 => mult 1, daily streak 7 => mult 2
    expect(calculateComboXp(BASE, 0, 7, false)).toBe(Math.round(15 * 2));
  });

  it('stacks session and daily combos multiplicatively for pomodoro', () => {
    // session combo 5 => mult 3, daily streak 30 => mult 3 => 15 * 3 * 3 = 135
    expect(calculateComboXp(BASE, 5, 30, true)).toBe(Math.round(15 * 3 * 3));
  });

  it('rounds the result to nearest integer', () => {
    // session combo 2 => mult 1.5, daily streak 3 => mult 1.5 => 15 * 1.5 * 1.5 = 33.75 => 34
    expect(calculateComboXp(BASE, 2, 3, true)).toBe(Math.round(15 * 1.5 * 1.5));
  });
});
