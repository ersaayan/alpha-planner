import { Text } from '@ui-kitten/components';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { BorderRadius, Colors, FontSize, InterFonts, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface SheetModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Buttons at the bottom (a close button is not added automatically). */
  footer?: ReactNode;
  /** An icon above the title (e.g. the season summary's award). */
  icon?: string;
  iconColor?: string;
  testID?: string;
}

/**
 * A centered dialog card over a dimmed backdrop: explanations and small editors. It has
 * a labelled close button, closes on a tap outside, the Android Back button and the iOS
 * escape gesture, scrolls long content, and stays inside the safe area.
 */
export function SheetModal({ visible, title, onClose, children, footer, icon, iconColor, testID }: SheetModalProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent testID={testID}>
      <View
        style={[
          styles.backdrop,
          {
            backgroundColor: scheme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(26,32,36,0.45)',
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.lg,
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }, Shadows.xl]}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
        >
          <View style={styles.header}>
            {icon ? (
              <View style={[styles.iconBubble, { backgroundColor: (iconColor ?? colors.primary) + '20' }]}>
                <Icon name={icon} fill={iconColor ?? colors.primary} size={22} />
              </View>
            ) : null}
            <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Icon name="close" fill={colors.textMuted} size={20} />
            </Pressable>
          </View>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {children}
          </ScrollView>
          {footer ? <View style={[styles.footer, { borderTopColor: colors.separator }]}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '100%',
    alignSelf: 'center',
    borderRadius: BorderRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.xs,
    paddingTop: Spacing.sm,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: InterFonts.bold,
    fontSize: FontSize.lg,
    paddingVertical: Spacing.sm,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
