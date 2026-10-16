import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

// Map Eva icon names to Feather/MaterialCommunity icons
type IconEntry = { pack: 'feather' | 'material'; name: string };

// Navigation & UI
const NAVIGATION_ICONS: Record<string, IconEntry> = {
  'home': { pack: 'feather', name: 'home' },
  'home-outline': { pack: 'feather', name: 'home' },
  'list': { pack: 'feather', name: 'list' },
  'list-outline': { pack: 'feather', name: 'list' },
  'clock': { pack: 'feather', name: 'clock' },
  'clock-outline': { pack: 'feather', name: 'clock' },
  'bar-chart': { pack: 'feather', name: 'bar-chart-2' },
  'bar-chart-outline': { pack: 'feather', name: 'bar-chart-2' },
  'settings': { pack: 'feather', name: 'settings' },
  'settings-outline': { pack: 'feather', name: 'settings' },
  'settings-2': { pack: 'feather', name: 'settings' },
  'settings-2-outline': { pack: 'feather', name: 'settings' },
  'plus': { pack: 'feather', name: 'plus' },
  'plus-outline': { pack: 'feather', name: 'plus' },
  'plus-circle': { pack: 'feather', name: 'plus-circle' },
  'plus-circle-outline': { pack: 'feather', name: 'plus-circle' },
  'close': { pack: 'feather', name: 'x' },
  'close-outline': { pack: 'feather', name: 'x' },
  'close-circle': { pack: 'feather', name: 'x-circle' },
  'close-circle-outline': { pack: 'feather', name: 'x-circle' },
  'checkmark': { pack: 'feather', name: 'check' },
  'checkmark-outline': { pack: 'feather', name: 'check' },
  'checkmark-circle': { pack: 'feather', name: 'check-circle' },
  'checkmark-circle-outline': { pack: 'feather', name: 'check-circle' },
  'checkmark-circle-2': { pack: 'feather', name: 'check-circle' },
  'checkmark-circle-2-outline': { pack: 'feather', name: 'check-circle' },
  'checkmark-square-2': { pack: 'feather', name: 'check-square' },
  'checkmark-square-2-outline': { pack: 'feather', name: 'check-square' },
  'arrow-back': { pack: 'feather', name: 'arrow-left' },
  'arrow-back-outline': { pack: 'feather', name: 'arrow-left' },
  'arrow-forward': { pack: 'feather', name: 'arrow-right' },
  'arrow-forward-outline': { pack: 'feather', name: 'arrow-right' },
  'chevron-right': { pack: 'feather', name: 'chevron-right' },
  'chevron-right-outline': { pack: 'feather', name: 'chevron-right' },
  'chevron-down': { pack: 'feather', name: 'chevron-down' },
  'chevron-down-outline': { pack: 'feather', name: 'chevron-down' },
  'chevron-left': { pack: 'feather', name: 'chevron-left' },
  'chevron-up': { pack: 'feather', name: 'chevron-up' },
  'more-vertical': { pack: 'feather', name: 'more-vertical' },
  'more-vertical-outline': { pack: 'feather', name: 'more-vertical' },
  'menu': { pack: 'feather', name: 'menu' },
  'menu-outline': { pack: 'feather', name: 'menu' },
  'search': { pack: 'feather', name: 'search' },
  'search-outline': { pack: 'feather', name: 'search' },
  'filter': { pack: 'feather', name: 'filter' },
  'filter-outline': { pack: 'feather', name: 'filter' },
  'clipboard-outline': { pack: 'feather', name: 'clipboard' },
  'clipboard': { pack: 'feather', name: 'clipboard' },
  'grid': { pack: 'feather', name: 'grid' },
  'grid-outline': { pack: 'feather', name: 'grid' },
  'layers': { pack: 'feather', name: 'layers' },
  'layers-outline': { pack: 'feather', name: 'layers' },
  'activity': { pack: 'feather', name: 'activity' },
  'activity-outline': { pack: 'feather', name: 'activity' },
};

// Actions
const ACTION_ICONS: Record<string, IconEntry> = {
  'edit': { pack: 'feather', name: 'edit-2' },
  'edit-outline': { pack: 'feather', name: 'edit-2' },
  'edit-2': { pack: 'feather', name: 'edit-2' },
  'edit-2-outline': { pack: 'feather', name: 'edit-2' },
  'trash': { pack: 'feather', name: 'trash' },
  'trash-outline': { pack: 'feather', name: 'trash' },
  'trash-2': { pack: 'feather', name: 'trash-2' },
  'trash-2-outline': { pack: 'feather', name: 'trash-2' },
  'link': { pack: 'feather', name: 'link' },
  'link-outline': { pack: 'feather', name: 'link' },
  'link-2': { pack: 'feather', name: 'link-2' },
  'link-2-outline': { pack: 'feather', name: 'link-2' },
  'share': { pack: 'feather', name: 'share' },
  'share-outline': { pack: 'feather', name: 'share' },
  'download': { pack: 'feather', name: 'download' },
  'download-outline': { pack: 'feather', name: 'download' },
  'upload': { pack: 'feather', name: 'upload' },
  'upload-outline': { pack: 'feather', name: 'upload' },
  'refresh': { pack: 'feather', name: 'refresh-cw' },
  'refresh-outline': { pack: 'feather', name: 'refresh-cw' },
  'repeat': { pack: 'feather', name: 'repeat' },
  'repeat-outline': { pack: 'feather', name: 'repeat' },
  'sync': { pack: 'feather', name: 'refresh-cw' },
  'sync-outline': { pack: 'feather', name: 'refresh-cw' },
};

// Media controls
const MEDIA_ICONS: Record<string, IconEntry> = {
  'play': { pack: 'feather', name: 'play' },
  'play-outline': { pack: 'feather', name: 'play' },
  'play-circle': { pack: 'feather', name: 'play-circle' },
  'play-circle-outline': { pack: 'feather', name: 'play-circle' },
  'pause': { pack: 'feather', name: 'pause' },
  'pause-outline': { pack: 'feather', name: 'pause' },
  'pause-circle': { pack: 'feather', name: 'pause-circle' },
  'pause-circle-outline': { pack: 'feather', name: 'pause-circle' },
  'stop-circle': { pack: 'feather', name: 'stop-circle' },
  'stop-circle-outline': { pack: 'feather', name: 'stop-circle' },
  'skip-forward': { pack: 'feather', name: 'skip-forward' },
  'skip-forward-outline': { pack: 'feather', name: 'skip-forward' },
  'skip-back': { pack: 'feather', name: 'skip-back' },
  'skip-back-outline': { pack: 'feather', name: 'skip-back' },
  'volume-up': { pack: 'feather', name: 'volume-2' },
  'volume-up-outline': { pack: 'feather', name: 'volume-2' },
  'volume-off': { pack: 'feather', name: 'volume-x' },
  'volume-off-outline': { pack: 'feather', name: 'volume-x' },
};

// Categories & folders
const CATEGORY_ICONS: Record<string, IconEntry> = {
  'folder-outline': { pack: 'feather', name: 'folder' },
  'file-outline': { pack: 'feather', name: 'file' },
  'file-text-outline': { pack: 'feather', name: 'file-text' },
  'book-outline': { pack: 'feather', name: 'book' },
  'book-open-outline': { pack: 'feather', name: 'book-open' },
  'briefcase-outline': { pack: 'feather', name: 'briefcase' },
  'shopping-bag-outline': { pack: 'feather', name: 'shopping-bag' },
  'shopping-cart-outline': { pack: 'feather', name: 'shopping-cart' },
};

// Time & calendar
const TIME_ICONS: Record<string, IconEntry> = {
  'calendar': { pack: 'feather', name: 'calendar' },
  'calendar-outline': { pack: 'feather', name: 'calendar' },
  'bell': { pack: 'feather', name: 'bell' },
  'bell-outline': { pack: 'feather', name: 'bell' },
  'bell-off': { pack: 'feather', name: 'bell-off' },
  'bell-off-outline': { pack: 'feather', name: 'bell-off' },
  'sun': { pack: 'feather', name: 'sun' },
  'sun-outline': { pack: 'feather', name: 'sun' },
  'moon': { pack: 'feather', name: 'moon' },
  'moon-outline': { pack: 'feather', name: 'moon' },
  'coffee': { pack: 'feather', name: 'coffee' },
  'coffee-outline': { pack: 'feather', name: 'coffee' },
};

// Status & info
const STATUS_ICONS: Record<string, IconEntry> = {
  'info': { pack: 'feather', name: 'info' },
  'info-outline': { pack: 'feather', name: 'info' },
  'alert-circle': { pack: 'feather', name: 'alert-circle' },
  'alert-circle-outline': { pack: 'feather', name: 'alert-circle' },
  'alert-triangle': { pack: 'feather', name: 'alert-triangle' },
  'alert-triangle-outline': { pack: 'feather', name: 'alert-triangle' },
  'help-circle': { pack: 'feather', name: 'help-circle' },
  'help-circle-outline': { pack: 'feather', name: 'help-circle' },
  'question-mark-circle': { pack: 'feather', name: 'help-circle' },
  'question-mark-circle-outline': { pack: 'feather', name: 'help-circle' },
};

// People & social
const PEOPLE_ICONS: Record<string, IconEntry> = {
  'person': { pack: 'feather', name: 'user' },
  'person-outline': { pack: 'feather', name: 'user' },
  'log-out': { pack: 'feather', name: 'log-out' },
  'log-out-outline': { pack: 'feather', name: 'log-out' },
  'people': { pack: 'feather', name: 'users' },
  'people-outline': { pack: 'feather', name: 'users' },
  'heart': { pack: 'feather', name: 'heart' },
  'heart-outline': { pack: 'feather', name: 'heart' },
  'star': { pack: 'feather', name: 'star' },
  'star-outline': { pack: 'feather', name: 'star' },
  'award': { pack: 'feather', name: 'award' },
  'award-outline': { pack: 'feather', name: 'award' },
  'gift': { pack: 'feather', name: 'gift' },
  'gift-outline': { pack: 'feather', name: 'gift' },
};

// Misc
const MISC_ICONS: Record<string, IconEntry> = {
  'flash': { pack: 'feather', name: 'zap' },
  'flash-outline': { pack: 'feather', name: 'zap' },
  'bulb': { pack: 'feather', name: 'sun' },
  'bulb-outline': { pack: 'feather', name: 'sun' },
  'flag': { pack: 'feather', name: 'flag' },
  'flag-outline': { pack: 'feather', name: 'flag' },
  'hash': { pack: 'feather', name: 'hash' },
  'hash-outline': { pack: 'feather', name: 'hash' },
  'layout': { pack: 'feather', name: 'layout' },
  'layout-outline': { pack: 'feather', name: 'layout' },
  'map': { pack: 'feather', name: 'map' },
  'map-outline': { pack: 'feather', name: 'map' },
  'globe': { pack: 'feather', name: 'globe' },
  'globe-outline': { pack: 'feather', name: 'globe' },
  'trending-up': { pack: 'feather', name: 'trending-up' },
  'trending-up-outline': { pack: 'feather', name: 'trending-up' },
  'inbox-outline': { pack: 'feather', name: 'inbox' },
  'inbox': { pack: 'feather', name: 'inbox' },
  'lock': { pack: 'feather', name: 'lock' },
  'lock-outline': { pack: 'feather', name: 'lock' },
  'unlock': { pack: 'feather', name: 'unlock' },
  'unlock-outline': { pack: 'feather', name: 'unlock' },
  'eye': { pack: 'feather', name: 'eye' },
  'eye-outline': { pack: 'feather', name: 'eye' },
  'eye-off': { pack: 'feather', name: 'eye-off' },
  'eye-off-outline': { pack: 'feather', name: 'eye-off' },
  'external-link': { pack: 'feather', name: 'external-link' },
  'external-link-outline': { pack: 'feather', name: 'external-link' },
};

// Material icons for ones not in Feather
const MATERIAL_ICONS: Record<string, IconEntry> = {
  'timer-outline': { pack: 'material', name: 'timer-outline' },
  'target': { pack: 'material', name: 'target' },
  'trophy-outline': { pack: 'material', name: 'trophy-outline' },
  'medal-outline': { pack: 'material', name: 'medal-outline' },
  'fire': { pack: 'material', name: 'fire' },
  'leaf-outline': { pack: 'material', name: 'leaf' },
  'leaf': { pack: 'material', name: 'leaf' },
  'hourglass-outline': { pack: 'material', name: 'timer-sand' },
  'hourglass': { pack: 'material', name: 'timer-sand' },
};

const ICON_MAP: Record<string, IconEntry> = {
  ...NAVIGATION_ICONS,
  ...ACTION_ICONS,
  ...MEDIA_ICONS,
  ...CATEGORY_ICONS,
  ...TIME_ICONS,
  ...STATUS_ICONS,
  ...PEOPLE_ICONS,
  ...MISC_ICONS,
  ...MATERIAL_ICONS,
};

interface IconProps {
  name: string;
  fill?: ColorValue;
  style?: StyleProp<ViewStyle>;
  size?: number;
}

export function Icon({ name, fill = '#8F9BB3', style, size }: IconProps) {
  // Extract size from style if provided
  const styleObj = style as { width?: number; height?: number } | undefined;
  const iconSize = size || styleObj?.width || styleObj?.height || 24;
  // RN's ColorValue also allows null and processed (numeric) colors, which vector icons don't accept
  const color = fill === null || typeof fill === 'number' ? undefined : fill;

  const mapping = ICON_MAP[name];

  if (!mapping) {
    // Default to Feather with a fallback icon
    console.warn(`Icon "${name}" not found in mapping, using default`);
    return <Feather name="circle" size={iconSize} color={color} />;
  }

  if (mapping.pack === 'feather') {
    return <Feather name={mapping.name as keyof typeof Feather.glyphMap} size={iconSize} color={color} />;
  }

  return <MaterialCommunityIcons name={mapping.name as keyof typeof MaterialCommunityIcons.glyphMap} size={iconSize} color={color} />;
}

export default Icon;
