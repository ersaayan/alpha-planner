import { useReducedMotion } from 'react-native-reanimated';

/**
 * Whether decorative, endlessly repeating animations (pulse, glow, shimmer) may run:
 * never when the system's Reduce Motion / Remove animations setting is on, and only
 * while `active` (pass the screen's focus state so hidden tabs stop animating).
 */
export function useAmbientMotion(active = true): boolean {
  const reduceMotion = useReducedMotion();
  return active && !reduceMotion;
}
