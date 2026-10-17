import type { TFunction } from 'i18next';
import { getLevelTierId, getLevelTitle } from '@/constants/gamification';

/**
 * Translated labels for the gamification domain. The constants keep English names for
 * tests and logs; screens show these.
 */

export function levelTitle(t: TFunction, level: number): string {
  return t(`levels.${level}`, { defaultValue: getLevelTitle(level) });
}

export function levelTierName(t: TFunction, level: number): string {
  return t(`gamification.tier.${getLevelTierId(level)}`);
}
