import { Text } from '@ui-kitten/components';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BorderRadius, Colors, FontSize, InterFonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface SheetModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Buttons at the bottom (a close button is not added automatically). */
  footer?: ReactNode;
  testID?: string;
}

/** A centered card over a dimmed backdrop: used for explanations and small editors. */
export function SheetModal({ visible, title, onClose, children, footer, testID }: SheetModalProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} testID={testID}>
      <View style={styles.backdrop}>
        {/* Tapping outside closes; VoiceOver users close with the escape gesture (Z), TalkBack users with Back. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View
          style={[styles.card, { backgroundColor: colors.card }]}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
        >
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {title}
          </Text>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '85%',
  },
  title: {
    fontFamily: InterFonts.bold,
    fontSize: FontSize.lg,
    marginBottom: Spacing.md,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    gap: Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
});
