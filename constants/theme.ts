/**
 * Alpha Planner Theme Configuration
 * Color palette: https://colorhunt.co/palette/ebf4dd90ab8b5a78683b4953
 */

// Main color palette
export const Palette = {
  cream: '#EBF4DD',
  sage: '#90AB8B',
  forest: '#5A7868',
  slate: '#3B4953',
  white: '#FFFFFF',
  black: '#000000',
} as const;

/**
 * Theme tokens. Every text token meets WCAG AA (4.5:1) on `background`,
 * `backgroundSecondary` and `card`, and on its own 12% tint (pills, badges);
 * UI tokens (icons, tracks, rings) meet 3:1. `onPrimary` is the text/icon color on a
 * `primary` fill. __tests__/constants/contrast.test.ts checks all of it, in both modes.
 *
 * The palette's sage (#90AB8B) is too light for text on cream and white, so text and
 * controls use darker shades of the same greens; sage stays for decoration.
 */
export const Colors = {
  light: {
    // Core colors
    text: Palette.slate,
    textSecondary: '#4D6759',
    textMuted: '#616F65',
    background: Palette.cream,
    backgroundSecondary: '#F7F9F5',
    card: Palette.white,
    cardBorder: '#DDE8D5',

    // Brand colors
    primary: '#4D6759',
    onPrimary: Palette.white,
    primaryLight: Palette.sage, // decorative only (not for text)
    secondary: '#72946C',
    accent: Palette.slate,

    // Semantic colors
    success: '#306F33',
    warning: '#8E5400',
    error: '#B72A2A',
    info: '#4D6759',

    // UI elements
    tint: '#4D6759',
    icon: '#4D6759',
    tabIconDefault: '#616F65',
    tabIconSelected: '#4D6759',
    border: '#DDE8D5',
    separator: '#E8F0E6',

    // Pomodoro specific
    timerFocus: '#4D6759',
    timerBreak: '#72946C',
    timerIdle: Palette.slate,

    // Priority colors
    priorityLow: '#51694C',
    priorityMedium: '#6E6233',
    priorityHigh: '#A04919',
    priorityUrgent: '#B72A2A',

    // Text/icons on an `error` fill (destructive buttons, badges)
    onError: Palette.white,

    // Gamification text (readable versions of GamificationColors)
    xp: '#765607',
    streak: '#B22F00',
    rarityCommon: '#895521',
    rarityRare: '#586370',
    rarityEpic: '#736100',
    rarityLegendary: '#8646A0',
  },
  dark: {
    // Core colors
    text: Palette.cream,
    textSecondary: Palette.sage,
    textMuted: '#8CA095',
    background: '#1A2024',
    backgroundSecondary: '#222A30',
    card: '#2A353C',
    cardBorder: '#3B4953',

    // Brand colors
    primary: '#9EB69A',
    onPrimary: '#1A2024',
    primaryLight: '#B5CAB1',
    secondary: '#638472',
    accent: Palette.cream,

    // Semantic colors
    success: '#71C075',
    warning: '#F99400',
    error: '#F69593',
    info: Palette.sage,

    // UI elements
    tint: '#9EB69A',
    icon: '#9EB69A',
    tabIconDefault: '#8CA095',
    tabIconSelected: '#9EB69A',
    border: '#3B4953',
    separator: '#3B4953',

    // Pomodoro specific
    timerFocus: '#9EB69A',
    timerBreak: '#638472',
    timerIdle: '#8CA095',

    // Priority colors
    priorityLow: '#9EB69A',
    priorityMedium: '#BEAE6E',
    priorityHigh: '#EF9863',
    priorityUrgent: '#F29494',

    // Text/icons on an `error` fill (destructive buttons, badges)
    onError: '#1A2024',

    // Gamification text (readable versions of GamificationColors)
    xp: '#DDBA00',
    streak: '#FF8E65',
    rarityCommon: '#DCA46D',
    rarityRare: '#A9B2BC',
    rarityEpic: '#CDAD00',
    rarityLegendary: '#C8A3D6',
  },
} as const;

/** The tokens of one color scheme. */
export type ThemeColors = (typeof Colors)['light'] | (typeof Colors)['dark'];

// Inter font family names (loaded via expo-google-fonts)
export const InterFonts = {
  light: 'Inter_300Light',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

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
  xxs: 2,
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
