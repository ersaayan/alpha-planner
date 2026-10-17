/**
 * WCAG 2.1 AA contrast for the theme tokens, in both color schemes:
 * - text: 4.5:1 (body and caption text);
 * - large text and UI components (icons, tracks, progress rings, focus): 3:1.
 * Ratios are checked on every surface a token is drawn on, including the 12%
 * tints used behind pills and badges (`color + '20'`).
 */
import { Colors, GamificationColors, Palette } from '@/constants/theme';
import { alphaDarkTheme, alphaTheme } from '@/constants/eva-theme';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `color` at `alpha` over `background` (what `color + '20'` renders as). */
function tint(color: string, background: string, alpha = 0x20 / 0xff): string {
  const mix = [1, 3, 5].map((i) => {
    const c = parseInt(color.slice(i, i + 2), 16);
    const bg = parseInt(background.slice(i, i + 2), 16);
    return Math.round(c * alpha + bg * (1 - alpha))
      .toString(16)
      .padStart(2, '0');
  });
  return `#${mix.join('')}`;
}

const TEXT = 4.5;
const UI = 3;

describe.each(['light', 'dark'] as const)('%s theme contrast', (scheme) => {
  const c = Colors[scheme];
  const surfaces = { background: c.background, backgroundSecondary: c.backgroundSecondary, card: c.card };

  const textTokens = [
    'text',
    'textSecondary',
    'textMuted',
    'primary',
    'success',
    'warning',
    'error',
    'priorityLow',
    'priorityMedium',
    'priorityHigh',
    'priorityUrgent',
    'xp',
    'streak',
    'rarityCommon',
    'rarityRare',
    'rarityEpic',
    'rarityLegendary',
  ] as const;

  it.each(textTokens)('%s is readable as text on every surface', (token) => {
    for (const [name, surface] of Object.entries(surfaces)) {
      expect({ token, name, ratio: contrast(c[token], surface) >= TEXT }).toEqual({ token, name, ratio: true });
    }
  });

  // Colored text on its own tint: selected pills, priority/status badges, XP badges.
  it.each(['primary', 'success', 'warning', 'error', 'priorityLow', 'priorityMedium', 'priorityHigh', 'priorityUrgent', 'xp', 'streak', 'rarityCommon', 'rarityRare', 'rarityEpic', 'rarityLegendary'] as const)(
    '%s is readable on its own tint',
    (token) => {
      for (const surface of Object.values(surfaces)) {
        expect(contrast(c[token], tint(c[token], surface))).toBeGreaterThanOrEqual(TEXT);
      }
    }
  );

  it('text and icons on primary and error fills (buttons, badges) are readable', () => {
    expect(contrast(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(TEXT);
    expect(contrast(c.onError, c.error)).toBeGreaterThanOrEqual(TEXT);
  });

  it.each(['secondary', 'tabIconDefault', 'tabIconSelected', 'timerFocus', 'timerBreak', 'timerIdle'] as const)(
    '%s is visible as a UI component',
    (token) => {
      for (const surface of Object.values(surfaces)) {
        expect(contrast(c[token], surface)).toBeGreaterThanOrEqual(UI);
      }
    }
  );

  it('the floating tab bar icons are visible on the bar', () => {
    // The bar is white (light) or slate (dark) at 85% over the screen.
    const bar = scheme === 'light' ? tint(Palette.white, c.background, 0.85) : tint(Palette.slate, c.background, 0.85);
    expect(contrast(c.tabIconDefault, bar)).toBeGreaterThanOrEqual(UI);
    expect(contrast(c.tabIconSelected, tint(c.tabIconSelected, bar))).toBeGreaterThanOrEqual(UI);
  });
});

describe('UI Kitten (Eva) theme contrast', () => {
  it('filled primary buttons: control text on the primary fill', () => {
    for (const theme of [alphaTheme, alphaDarkTheme]) {
      expect(contrast(theme['text-control-color'], theme['color-primary-500'])).toBeGreaterThanOrEqual(TEXT);
      expect(contrast(theme['text-control-color'], theme['color-danger-500'])).toBeGreaterThanOrEqual(TEXT);
    }
  });

  it('text, hints and text-colored buttons on the backgrounds', () => {
    const light = alphaTheme as Record<string, string>;
    const dark = alphaDarkTheme as Record<string, string>;
    for (const [theme, primaryText, dangerText] of [
      [light, light['color-primary-500'], light['color-danger-500']],
      [dark, dark['text-primary-color'], dark['text-danger-color']],
    ] as const) {
      for (const bg of ['background-basic-color-1', 'background-basic-color-2', 'background-basic-color-3']) {
        for (const fg of [theme['text-basic-color'], theme['text-hint-color'], primaryText, dangerText]) {
          expect(contrast(fg, theme[bg])).toBeGreaterThanOrEqual(TEXT);
        }
      }
    }
  });

  it('app and Eva surfaces stay in sync', () => {
    expect(alphaTheme['background-basic-color-1']).toBe(Colors.light.background);
    expect(alphaDarkTheme['background-basic-color-1']).toBe(Colors.dark.background);
    expect(alphaDarkTheme['background-basic-color-3']).toBe(Colors.dark.card);
    expect(alphaTheme['color-primary-500']).toBe(Colors.light.primary);
  });
});

describe('decorative gamification colors', () => {
  it('are never the only cue: their readable text versions exist per theme', () => {
    expect(contrast(Colors.light.xp, Colors.light.card)).toBeGreaterThan(contrast(GamificationColors.xp, Colors.light.card));
  });
});
