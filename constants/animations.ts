/**
 * Animation Presets for Alpha Planner
 * Consistent, performant animations using Reanimated 3
 */

import { Easing } from 'react-native-reanimated';

// Easing presets for different animation types
export const AnimationEasing = {
  // Standard easing for most UI transitions
  standard: Easing.bezier(0.4, 0.0, 0.2, 1),

  // Emphasized easing for important state changes
  emphasized: Easing.bezier(0.2, 0.0, 0.0, 1),

  // Decelerate for elements entering the screen
  decelerate: Easing.out(Easing.cubic),

  // Accelerate for elements leaving the screen
  accelerate: Easing.in(Easing.cubic),

  // Bounce for playful interactions
  bounce: Easing.bezier(0.34, 1.56, 0.64, 1),

  // Elastic for achievement unlocks
  elastic: Easing.bezier(0.68, -0.55, 0.265, 1.55),

  // Smooth for progress bars
  smooth: Easing.bezier(0.25, 0.1, 0.25, 1),

  // Sharp for quick responses
  sharp: Easing.bezier(0.4, 0.0, 0.6, 1),
} as const;

// Duration constants (in milliseconds)
export const AnimationDuration = {
  instant: 100,
  fast: 150,
  normal: 200,
  medium: 300,
  slow: 400,
  verySlow: 600,
  xpFill: 800,
  levelUp: 1000,
  achievement: 700,
  shimmer: 2000,
} as const;

// Spring configurations for different effects
export const SpringConfig = {
  // Default spring for most animations
  default: {
    damping: 15,
    stiffness: 150,
    mass: 1,
  },

  // Gentle spring for subtle movements
  gentle: {
    damping: 20,
    stiffness: 100,
    mass: 1,
  },

  // Snappy spring for quick feedback
  snappy: {
    damping: 12,
    stiffness: 200,
    mass: 0.8,
  },

  // Bouncy spring for playful elements
  bouncy: {
    damping: 8,
    stiffness: 180,
    mass: 1,
  },

  // Wobbly spring for achievements
  wobbly: {
    damping: 6,
    stiffness: 120,
    mass: 1.2,
  },

  // Stiff spring for precise control
  stiff: {
    damping: 20,
    stiffness: 300,
    mass: 0.8,
  },
} as const;

// Preset animation values for common use cases
export const AnimationPresets = {
  // Button press scale
  buttonPress: {
    scale: 0.97,
    duration: AnimationDuration.fast,
  },

  // Card press scale
  cardPress: {
    scale: 0.98,
    duration: AnimationDuration.fast,
  },

  // Tab icon scale when active
  tabIconActive: {
    scale: 1.15,
    duration: AnimationDuration.normal,
  },

  // Achievement unlock
  achievementUnlock: {
    scale: [1, 1.2, 1],
    duration: AnimationDuration.achievement,
  },

  // XP bar shimmer
  xpShimmer: {
    translateX: [-100, 100],
    duration: AnimationDuration.shimmer,
  },

  // Checkbox check animation
  checkbox: {
    scale: [0.8, 1.1, 1],
    duration: AnimationDuration.medium,
  },

  // Timer pulse when running
  timerPulse: {
    opacity: [1, 0.7, 1],
    scale: [1, 1.02, 1],
    duration: 2000,
  },

  // Level up celebration
  levelUp: {
    scale: [0.5, 1.3, 1],
    opacity: [0, 1, 1],
    duration: AnimationDuration.levelUp,
  },

  // Fade in animation
  fadeIn: {
    opacity: [0, 1],
    duration: AnimationDuration.normal,
  },

  // Slide up animation
  slideUp: {
    translateY: [20, 0],
    opacity: [0, 1],
    duration: AnimationDuration.medium,
  },

  // Counter increment
  counterIncrement: {
    duration: AnimationDuration.slow,
  },

  // Ripple effect
  ripple: {
    scale: [0, 2],
    opacity: [0.3, 0],
    duration: AnimationDuration.slow,
  },
} as const;

// Gesture thresholds
export const GestureThresholds = {
  // Swipe distance to trigger action
  swipeThreshold: 80,

  // Velocity threshold for quick swipes
  swipeVelocity: 500,

  // Long press duration
  longPressDuration: 500,

  // Pull to refresh distance
  pullToRefresh: 100,
} as const;

// Shared value helper types
export type AnimationConfig = {
  duration?: number;
  easing?: typeof AnimationEasing[keyof typeof AnimationEasing];
};

export type SpringConfigType = typeof SpringConfig[keyof typeof SpringConfig];
