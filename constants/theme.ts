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

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
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
