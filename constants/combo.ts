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

/**
 * Longest gap between the end of one focus session and the start of the next that keeps
 * the session combo going: an hour, or the long break plus 15 minutes if that is longer.
 */
export function sessionComboMaxGapMs(longBreakSeconds = 0): number {
  return Math.max(60 * 60_000, (longBreakSeconds + 15 * 60) * 1000);
}

/** The session combo that still counts at `atMs` (0 once the gap is too long). */
export function liveSessionCombo(
  combo: { sessionCombo: number; lastSessionAt?: string | null },
  atMs: number,
  maxGapMs = sessionComboMaxGapMs()
): number {
  if (!combo.lastSessionAt) return 0;
  const last = Date.parse(combo.lastSessionAt);
  return Number.isFinite(last) && atMs - last <= maxGapMs ? combo.sessionCombo : 0;
}

/** The day before a `yyyy-MM-dd` key (local calendar, DST-safe). */
function previousDateKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, (day || 1) - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * The daily combo streak that still applies on `dateKey`. A combo day keeps its
 * multiplier until the end of the next day; after a day without one it lapses.
 */
export function effectiveDailyCombo(
  combo: { dailyComboStreak: number; lastDailyComboDate: string | null },
  dateKey: string
): number {
  const last = combo.lastDailyComboDate;
  if (!last || last < previousDateKey(dateKey)) return 0;
  return combo.dailyComboStreak;
}

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
