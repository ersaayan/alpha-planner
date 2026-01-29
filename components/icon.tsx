import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { StyleProp, ViewStyle } from 'react-native';

// Map Eva icon names to Feather/MaterialCommunity icons
const ICON_MAP: Record<string, { pack: 'feather' | 'material'; name: string }> = {
  // Navigation & UI (with and without -outline suffix)
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
  'plus-outline': { pack: 'feather', name: 'plus' },
  'plus-circle-outline': { pack: 'feather', name: 'plus-circle' },
  'close-outline': { pack: 'feather', name: 'x' },
  'checkmark-outline': { pack: 'feather', name: 'check' },
  'checkmark-circle-outline': { pack: 'feather', name: 'check-circle' },
  'checkmark-circle-2-outline': { pack: 'feather', name: 'check-circle' },
  'checkmark-square-2': { pack: 'feather', name: 'check-square' },
  'checkmark-square-2-outline': { pack: 'feather', name: 'check-square' },
  'arrow-back-outline': { pack: 'feather', name: 'arrow-left' },
  'arrow-forward-outline': { pack: 'feather', name: 'arrow-right' },
  'chevron-right-outline': { pack: 'feather', name: 'chevron-right' },
  'chevron-down-outline': { pack: 'feather', name: 'chevron-down' },
  'more-vertical-outline': { pack: 'feather', name: 'more-vertical' },
  'menu-outline': { pack: 'feather', name: 'menu' },
  'search-outline': { pack: 'feather', name: 'search' },
  'filter-outline': { pack: 'feather', name: 'filter' },
  'clipboard-outline': { pack: 'feather', name: 'clipboard' },
  'clipboard': { pack: 'feather', name: 'clipboard' },

  // Actions
  'edit-outline': { pack: 'feather', name: 'edit-2' },
  'edit-2-outline': { pack: 'feather', name: 'edit-2' },
  'trash-outline': { pack: 'feather', name: 'trash' },
  'trash-2-outline': { pack: 'feather', name: 'trash-2' },
  'link-outline': { pack: 'feather', name: 'link' },
  'link-2-outline': { pack: 'feather', name: 'link-2' },
  'share-outline': { pack: 'feather', name: 'share' },
  'download-outline': { pack: 'feather', name: 'download' },
  'upload-outline': { pack: 'feather', name: 'upload' },
  'refresh-outline': { pack: 'feather', name: 'refresh-cw' },
  'repeat-outline': { pack: 'feather', name: 'repeat' },
  'sync-outline': { pack: 'feather', name: 'refresh-cw' },

  // Media controls
  'play-circle-outline': { pack: 'feather', name: 'play-circle' },
  'pause-circle-outline': { pack: 'feather', name: 'pause-circle' },
  'stop-circle-outline': { pack: 'feather', name: 'stop-circle' },
  'skip-forward-outline': { pack: 'feather', name: 'skip-forward' },
  'skip-back-outline': { pack: 'feather', name: 'skip-back' },
  'volume-up-outline': { pack: 'feather', name: 'volume-2' },
  'volume-off-outline': { pack: 'feather', name: 'volume-x' },

  // Categories & folders
  'folder-outline': { pack: 'feather', name: 'folder' },
  'file-outline': { pack: 'feather', name: 'file' },
  'file-text-outline': { pack: 'feather', name: 'file-text' },
  'book-outline': { pack: 'feather', name: 'book' },
  'book-open-outline': { pack: 'feather', name: 'book-open' },
  'briefcase-outline': { pack: 'feather', name: 'briefcase' },
  'shopping-bag-outline': { pack: 'feather', name: 'shopping-bag' },
  'shopping-cart-outline': { pack: 'feather', name: 'shopping-cart' },

  // Time & calendar
  'calendar-outline': { pack: 'feather', name: 'calendar' },
  'bell-outline': { pack: 'feather', name: 'bell' },
  'bell-off-outline': { pack: 'feather', name: 'bell-off' },
  'sun-outline': { pack: 'feather', name: 'sun' },
  'moon-outline': { pack: 'feather', name: 'moon' },
  'coffee-outline': { pack: 'feather', name: 'coffee' },

  // Status & info
  'info-outline': { pack: 'feather', name: 'info' },
  'alert-circle-outline': { pack: 'feather', name: 'alert-circle' },
  'alert-triangle-outline': { pack: 'feather', name: 'alert-triangle' },
  'help-circle-outline': { pack: 'feather', name: 'help-circle' },
  'question-mark-circle-outline': { pack: 'feather', name: 'help-circle' },

  // People & social
  'person-outline': { pack: 'feather', name: 'user' },
  'people-outline': { pack: 'feather', name: 'users' },
  'heart-outline': { pack: 'feather', name: 'heart' },
  'star-outline': { pack: 'feather', name: 'star' },
  'award-outline': { pack: 'feather', name: 'award' },
  'gift-outline': { pack: 'feather', name: 'gift' },

  // Misc
  'flash-outline': { pack: 'feather', name: 'zap' },
  'bulb-outline': { pack: 'feather', name: 'sun' },
  'flag-outline': { pack: 'feather', name: 'flag' },
  'hash-outline': { pack: 'feather', name: 'hash' },
  'grid-outline': { pack: 'feather', name: 'grid' },
  'layers-outline': { pack: 'feather', name: 'layers' },
  'layout-outline': { pack: 'feather', name: 'layout' },
  'map-outline': { pack: 'feather', name: 'map' },
  'globe-outline': { pack: 'feather', name: 'globe' },
  'trending-up-outline': { pack: 'feather', name: 'trending-up' },
  'activity-outline': { pack: 'feather', name: 'activity' },
  'inbox-outline': { pack: 'feather', name: 'inbox' },
  'inbox': { pack: 'feather', name: 'inbox' },

  // Material icons for ones not in Feather
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

interface IconProps {
  name: string;
  fill?: string;
  style?: StyleProp<ViewStyle>;
  size?: number;
}

export function Icon({ name, fill = '#8F9BB3', style, size }: IconProps) {
  // Extract size from style if provided
  const styleObj = style as { width?: number; height?: number } | undefined;
  const iconSize = size || styleObj?.width || styleObj?.height || 24;

  const mapping = ICON_MAP[name];

  if (!mapping) {
    // Default to Feather with a fallback icon
    console.warn(`Icon "${name}" not found in mapping, using default`);
    return <Feather name="circle" size={iconSize} color={fill} />;
  }

  if (mapping.pack === 'feather') {
    return <Feather name={mapping.name as keyof typeof Feather.glyphMap} size={iconSize} color={fill} />;
  }

  return <MaterialCommunityIcons name={mapping.name as keyof typeof MaterialCommunityIcons.glyphMap} size={iconSize} color={fill} />;
}

export default Icon;
