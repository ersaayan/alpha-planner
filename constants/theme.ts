/**
 * Alpha Planner Theme Configuration
 * Color palette: https://colorhunt.co/palette/ebf4dd90ab8b5a78683b4953
 */

import { Platform } from 'react-native';

// Main color palette
export const Palette = {
  cream: '#EBF4DD',
  sage: '#90AB8B',
  forest: '#5A7868',
  slate: '#3B4953',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const Colors = {
  light: {
    // Core colors
    text: Palette.slate,
    textSecondary: Palette.forest,
    textMuted: Palette.sage,
    background: Palette.cream,
    backgroundSecondary: '#F7F9F5',
    card: Palette.white,
    cardBorder: '#DDE8D5',

    // Brand colors
    primary: Palette.forest,
    primaryLight: Palette.sage,
    secondary: Palette.sage,
    accent: Palette.slate,

    // Semantic colors
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    info: Palette.forest,

    // UI elements
    tint: Palette.forest,
    icon: Palette.forest,
    tabIconDefault: Palette.sage,
    tabIconSelected: Palette.forest,
    border: '#DDE8D5',
    separator: '#E8F0E6',

    // Pomodoro specific
    timerFocus: Palette.forest,
    timerBreak: Palette.sage,
    timerIdle: Palette.slate,

    // Priority colors
    priorityLow: Palette.sage,
    priorityMedium: '#B5A45E',
    priorityHigh: '#E47F7F',
    priorityUrgent: '#D85656',
  },
  dark: {
    // Core colors
    text: Palette.cream,
    textSecondary: Palette.sage,
    textMuted: '#6B8878',
    background: '#1A2024',
    backgroundSecondary: '#2A3338',
    card: Palette.slate,
    cardBorder: '#4A5A63',

    // Brand colors
    primary: Palette.sage,
    primaryLight: '#A8C1A3',
    secondary: Palette.forest,
    accent: Palette.cream,

    // Semantic colors
    success: '#66BB6A',
    warning: '#FFA726',
    error: '#EF5350',
    info: Palette.sage,

    // UI elements
    tint: Palette.sage,
    icon: Palette.sage,
    tabIconDefault: '#6B8878',
    tabIconSelected: Palette.sage,
    border: '#4A5A63',
    separator: '#3B4953',

    // Pomodoro specific
    timerFocus: Palette.sage,
    timerBreak: Palette.forest,
    timerIdle: '#6B8878',

    // Priority colors
    priorityLow: Palette.sage,
    priorityMedium: '#C9BC87',
    priorityHigh: '#F0A8A8',
    priorityUrgent: '#E47F7F',
  },
} as const;

// Inter font family names (loaded via expo-google-fonts)
export const InterFonts = {
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

// Legacy font definitions (fallback if Inter not loaded)
export const Fonts = Platform.select({
  ios: {
    sans: 'Inter_400Regular',
    serif: 'ui-serif',
    rounded: 'Inter_500Medium',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'Inter_400Regular',
    serif: 'serif',
    rounded: 'Inter_500Medium',
    mono: 'monospace',
  },
  web: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "Inter, 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// Typography presets for consistent text styling
export const Typography = {
  // Headings
  h1: {
    fontFamily: InterFonts.bold,
    fontSize: FontSize.xxxl,
    lineHeight: FontSize.xxxl * 1.2,
  },
  h2: {
    fontFamily: InterFonts.bold,
    fontSize: FontSize.xxl,
    lineHeight: FontSize.xxl * 1.2,
  },
  h3: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.xl,
    lineHeight: FontSize.xl * 1.3,
  },
  h4: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.lg,
    lineHeight: FontSize.lg * 1.3,
  },

  // Body text
  body: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.md,
    lineHeight: FontSize.md * 1.5,
  },
  bodySmall: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.5,
  },
  bodyLarge: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.lg,
    lineHeight: FontSize.lg * 1.5,
  },

  // Captions and labels
  caption: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * 1.4,
  },
  label: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.4,
  },

  // Special
  timer: {
    fontFamily: InterFonts.light,
    fontSize: 72,
    lineHeight: 72 * 1.1,
  },
  timerSmall: {
    fontFamily: InterFonts.light,
    fontSize: 48,
    lineHeight: 48 * 1.1,
  },
  stat: {
    fontFamily: InterFonts.bold,
    fontSize: FontSize.xxl,
    lineHeight: FontSize.xxl * 1.1,
  },
  badge: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * 1.2,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,  // Updated: more compact (was 16)
  lg: 20,  // Updated: balanced (was 24)
  xl: 32,
  xxl: 48,
  xxxl: 64, // New: for larger sections
} as const;

export const BorderRadius = {
  xs: 4,   // New: very subtle rounding
  sm: 8,   // Updated (was 4)
  md: 12,  // Updated (was 8)
  lg: 16,  // Updated: more rounded (was 12)
  xl: 24,  // Updated: playful rounding (was 16)
  xxl: 32, // New: large rounded corners
  full: 9999,
} as const;

// Font weights for Inter font
export const FontWeight = {
  light: '300',
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

// Shadow presets for depth and elevation
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 16,
    elevation: 12,
  },
  // Glow effect for achievements and level up
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  }),
  // Subtle inner shadow simulation (use with overlay)
  inner: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 0,
  },
} as const;

// Gamification-specific colors for XP, achievements, etc.
export const GamificationColors = {
  // XP and progression
  xp: '#FFD700',           // Gold for XP
  xpGlow: '#FFC107',       // Warm glow
  xpGradientStart: '#FFD700',
  xpGradientEnd: '#FFA000',

  // Level system
  levelUp: Palette.sage,    // Level up celebration
  levelBadge: '#B8860B',    // Badge color (dark gold)

  // Achievements
  achievementGold: '#FFD700',
  achievementSilver: '#C0C0C0',
  achievementBronze: '#CD7F32',
  achievementLocked: '#9E9E9E',

  // Streaks
  streak: '#FF6B35',        // Fire orange for streaks
  streakGlow: '#FF8F00',

  // Progress gradients (forest to sage)
  progressStart: Palette.forest,
  progressEnd: Palette.sage,

  // Celebration particles
  confettiColors: ['#FFD700', '#FF6B35', '#90AB8B', '#5A7868', '#E8B4BC'],
} as const;

// Animation timing constants
export const AnimationDurations = {
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,
  xpBar: 800,
  levelUp: 1000,
  achievement: 600,
} as const;
