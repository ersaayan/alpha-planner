import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, ScrollView, Pressable, Alert } from 'react-native';
import { Text, Button, Card, Input } from '@ui-kitten/components';
import { Icon } from '@/components/icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useCategoryStore, useSettingsStore } from '@/stores';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const EXTRA_COLORS = ['#E57373', '#81C784', '#64B5F6', '#FFB74D', '#BA68C8', '#4DB6AC'];

export default function CategorySelectionScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const categories = useCategoryStore((state) => state.categories);
  const addCategory = useCategoryStore((state) => state.addCategory);
  const keepOnlyCategories = useCategoryStore((state) => state.keepOnlyCategories);
  const completeOnboarding = useSettingsStore((state) => state.completeOnboarding);

  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    categories.map((c) => c.id)
  );
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customColor, setCustomColor] = useState(EXTRA_COLORS[0]);

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleAddCustom = () => {
    if (!customName.trim()) return;

    const newCategory = addCategory({
      name: customName.trim(),
      color: customColor,
      icon: 'folder-outline',
      order: categories.length,
    });

    setSelectedCategories((prev) => [...prev, newCategory.id]);
    setCustomName('');
    setShowCustomForm(false);
  };

  const handleFinish = () => {
    if (selectedCategories.length === 0) {
      Alert.alert(t('onboarding.categorySelection.selectTitle'), t('onboarding.categorySelection.selectMsg'));
      return;
    }
    keepOnlyCategories(selectedCategories);
    // The root navigator's guard moves to the tabs and clears onboarding from history.
    completeOnboarding();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.lg,
        },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text category="h4">{t('onboarding.categorySelection.title')}</Text>
          <Text category="s1" style={{ color: colors.textSecondary }}>
            {t('onboarding.categorySelection.subtitle')}
          </Text>
        </View>

        {/* Categories Grid */}
        <View style={styles.categoriesGrid}>
          {categories.map((category) => {
            const isSelected = selectedCategories.includes(category.id);
            return (
              <Pressable
                key={category.id}
                style={[
                  styles.categoryCard,
                  {
                    backgroundColor: isSelected ? category.color + '20' : colors.card,
                    borderColor: isSelected ? category.color : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => toggleCategory(category.id)}
              >
                <View style={[styles.categoryIcon, { backgroundColor: category.color }]}>
                  <Icon
                    name={category.icon ?? 'folder-outline'}
                    fill="#fff"
                    style={styles.icon}
                  />
                </View>
                <Text category="s2">{category.name}</Text>
                {isSelected && (
                  <View style={[styles.checkBadge, { backgroundColor: category.color }]}>
                    <Icon name="checkmark-outline" fill="#fff" style={styles.checkIcon} />
                  </View>
                )}
              </Pressable>
            );
          })}

          {/* Add Custom Button */}
          <Pressable
            style={[
              styles.categoryCard,
              styles.addCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => setShowCustomForm(true)}
          >
            <Icon name="plus-outline" fill={colors.primary} style={styles.addIcon} />
            <Text category="s2" style={{ color: colors.primary }}>
              {t('onboarding.categorySelection.addCustom')}
            </Text>
          </Pressable>
        </View>

        {/* Custom Category Form */}
        {showCustomForm && (
          <Card style={[styles.customForm, { backgroundColor: colors.card }]}>
            <Text category="s1" style={{ marginBottom: Spacing.md }}>
              {t('onboarding.categorySelection.createCustom')}
            </Text>

            <Input
              label={t('onboarding.categorySelection.categoryName')}
              placeholder={t('onboarding.categorySelection.categoryPlaceholder')}
              value={customName}
              onChangeText={setCustomName}
              style={{ marginBottom: Spacing.md }}
            />

            <Text category="c1" style={{ marginBottom: Spacing.sm }}>
              {t('onboarding.categorySelection.chooseColor')}
            </Text>
            <View style={styles.colorPicker}>
              {EXTRA_COLORS.map((color) => (
                <Pressable
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    customColor === color && styles.colorSelected,
                  ]}
                  onPress={() => setCustomColor(color)}
                >
                  {customColor === color && (
                    <Icon name="checkmark-outline" fill="#fff" style={styles.colorCheck} />
                  )}
                </Pressable>
              ))}
            </View>

            <View style={styles.formButtons}>
              <Button appearance="ghost" size="small" onPress={() => setShowCustomForm(false)}>
                {t('common.cancel')}
              </Button>
              <Button size="small" onPress={handleAddCustom} disabled={!customName.trim()}>
                {t('onboarding.categorySelection.addCategory')}
              </Button>
            </View>
          </Card>
        )}

        {/* Info */}
        <View style={styles.infoBox}>
          <Icon name="info-outline" fill={colors.textMuted} style={styles.infoIcon} />
          <Text category="c1" style={{ color: colors.textMuted, flex: 1 }}>
            {t('onboarding.categorySelection.info')}
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        <Button
          appearance="ghost"
          onPress={() => router.back()}
          accessoryLeft={(props) => <Icon {...props} name="arrow-back-outline" />}
        >
          {t('onboarding.categorySelection.back')}
        </Button>
        <Button style={styles.finishButton} onPress={handleFinish}>
          {t('onboarding.categorySelection.letsGo')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  categoryCard: {
    width: '31%',
    flexGrow: 1,
    minWidth: 100,
    aspectRatio: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  icon: {
    width: 20,
    height: 20,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIcon: {
    width: 14,
    height: 14,
  },
  addCard: {
    borderStyle: 'dashed',
    borderWidth: 2,
  },
  addIcon: {
    width: 32,
    height: 32,
    marginBottom: Spacing.xs,
  },
  customForm: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  colorPicker: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  colorCheck: {
    width: 18,
    height: 18,
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  infoIcon: {
    width: 20,
    height: 20,
  },
  bottomButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
  },
  finishButton: {
    minWidth: 120,
    borderRadius: BorderRadius.lg,
  },
});
