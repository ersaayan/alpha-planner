/**
 * Session Combo: consecutive pomodoros without stopping.
 * Multiplier applies only to pomodoro base XP.
 */
export const SESSION_COMBO_MULTIPLIERS: Record<number, number> = {
  0: 1,
  1: 1,
  2: 1.5,
  3: 2,
  4: 2.5,
};
export const SESSION_COMBO_MAX_MULTIPLIER = 3; // 5+ sessions

export function getSessionComboMultiplier(combo: number): number {
  if (combo >= 5) return SESSION_COMBO_MAX_MULTIPLIER;
  return SESSION_COMBO_MULTIPLIERS[combo] ?? 1;
}

/**
 * Daily Combo: consecutive days with both pomodoro AND task completion.
 * Multiplier applies to all base XP (pomodoro + task + subtask).
 */
export const DAILY_COMBO_TIERS = [
  { days: 3, multiplier: 1.5 },
  { days: 7, multiplier: 2 },
  { days: 14, multiplier: 2.5 },
  { days: 30, multiplier: 3 },
] as const;

export function getDailyComboMultiplier(streak: number): number {
  let multiplier = 1;
  for (const tier of DAILY_COMBO_TIERS) {
    if (streak >= tier.days) multiplier = tier.multiplier;
  }
  return multiplier;
}

/**
 * Calculate final XP with combo multipliers.
 * Session combo only applies to pomodoro XP.
 * Daily combo applies to all base XP.
 * They stack multiplicatively.
 * Achievement/quest/goal XP is NEVER multiplied.
 */
export function calculateComboXp(
  baseXp: number,
  sessionCombo: number,
  dailyComboStreak: number,
  isPomodoro: boolean,
): number {
  const dailyMult = getDailyComboMultiplier(dailyComboStreak);
  const sessionMult = isPomodoro ? getSessionComboMultiplier(sessionCombo) : 1;
  return Math.round(baseXp * sessionMult * dailyMult);
}
