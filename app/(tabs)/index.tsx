import { Icon } from '@/components/icon';
import { Text } from '@ui-kitten/components';
import { useIsFocused, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontSize, GamificationColors, InterFonts, Spacing } from '@/constants/theme';
import { priorityColor } from '@/constants/todo-options';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { useAuthStore, useGamificationStore, useSettingsStore, useTodoStore } from '@/stores';
import { formatDue } from '@/utils/todo-dates';

import { SectionHeader } from '@/components/common';
import { LevelBadge } from '@/components/animated/animated-badge';
import { AnimatedButton } from '@/components/animated/animated-button';
import { AnimatedCard } from '@/components/animated/animated-card';
import { AnimatedCounter } from '@/components/animated/animated-counter';
import { AnimatedProgressBar } from '@/components/animated/animated-progress-bar';
import { ComboIndicator } from '@/components/gamification/combo-indicator';
import { TimerStatusCard } from '@/components/dashboard/timer-status-card';
import { DailyQuestsCard } from '@/components/gamification/daily-quests-card';
import { SeasonCard } from '@/components/gamification/season-card';
import { WeeklyGoalsCard } from '@/components/gamification/weekly-goals-card';
import { levelTierName, levelTitle } from '@/services/gamification/display';

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const bottomInset = useTabBarInset();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const todos = useTodoStore((state) => state.todos);
  const stats = useGamificationStore((state) => state.stats);
  const getXpProgress = useGamificationStore((state) => state.getXpProgress);
  const dateFormat = useSettingsStore((state) => state.settings.dateFormat);
  const timeFormat = useSettingsStore((state) => state.settings.timeFormat);
  const profile = useAuthStore((state) => state.profile);

  // Decorative loops (timer pulse, level glow, XP shimmer) run only while this tab is visible.
  const isFocused = useIsFocused();

  const pendingTodos = useMemo(
    () => todos.filter((t) => t.status === 'pending' || t.status === 'in_progress'),
    [todos]
  );

  const todayCompleted = useMemo(() => {
    const todayString = new Date().toDateString();
    return todos.filter(
      (t) =>
        t.status === 'completed' &&
        t.completedAt &&
        new Date(t.completedAt).toDateString() === todayString
    ).length;
  }, [todos]);

  const xpProgress = getXpProgress();

  return (
    <>
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.md, paddingBottom: bottomInset }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header with Level Badge */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={[styles.appTitle, { color: colors.text }]}>
            {profile?.displayName ? t('dashboard.greeting', { name: profile.displayName }) : t('dashboard.greetingDefault')}
          </Text>
          <Text style={[styles.levelSubtitle, { color: colors.textSecondary }]}>
            {levelTierName(t, stats.level)} · {levelTitle(t, stats.level)}
          </Text>
        </View>
        <LevelBadge
          level={stats.level}
          size="sm"
          showGlow={isFocused && stats.level >= 5}
        />
      </View>

      {/* The running timer (the only per-second part of the Dashboard) */}
      <TimerStatusCard active={isFocused} />

      {/* XP Progress Card */}
      <AnimatedCard
        variant="elevated"
        style={styles.xpCard}
        contentStyle={styles.xpCardContent}
      >
        <View style={styles.xpHeader}>
          <View style={styles.xpTitleRow}>
            <Icon
              name="star"
              fill={GamificationColors.xp}
              style={styles.xpIcon}
            />
            <Text style={[styles.xpTitle, { color: colors.text }]}>
              {t('dashboard.experience')}
            </Text>
          </View>
          <View style={styles.xpValues}>
            <AnimatedCounter
              value={xpProgress.current}
              category="body"
              color={colors.primary}
            />
            {!xpProgress.isMaxLevel && (
              <>
                <Text style={[styles.xpSeparator, { color: colors.textMuted }]}>
                  {' / '}
                </Text>
                <Text style={[styles.xpTotal, { color: colors.textMuted }]}>
                  {t('dashboard.xpOfLevel', { xp: xpProgress.required })}
                </Text>
              </>
            )}
          </View>
        </View>
        <AnimatedProgressBar
          progress={xpProgress.percentage / 100}
          height={14}
          showShimmer={isFocused}
          gradientColors={[GamificationColors.progressStart, GamificationColors.progressEnd]}
          backgroundColor={colors.backgroundSecondary}
        />
        <Text style={[styles.nextLevelText, { color: colors.textMuted }]}>
          {xpProgress.isMaxLevel
            ? `✨ ${t('dashboard.maxLevelReached')}`
            : t('dashboard.xpToNextLevel', { xp: xpProgress.required - xpProgress.current, level: stats.level + 1 })}
        </Text>
      </AnimatedCard>

      {/* Quick Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          icon="flash"
          value={stats.currentStreak}
          label={t('dashboard.dayStreak')}
          color={GamificationColors.streak}
          onPress={() => router.push('/(tabs)/stats')}
        />
        <StatCard
          icon="checkmark-circle-2"
          value={todayCompleted}
          label={t('dashboard.doneToday')}
          color={colors.success}
          onPress={() => router.push('/(tabs)/todos')}
        />
        <StatCard
          icon="clock"
          value={stats.totalPomodoros}
          label={t('dashboard.pomodoros')}
          color={colors.primary}
          onPress={() => router.push('/(tabs)/pomodoro')}
        />
      </View>

      {/* Quick actions: the two things people come here to start */}
      <View style={styles.actionsRow}>
        <AnimatedButton
          title={t('dashboard.newTask')}
          icon="plus"
          variant="outline"
          size="md"
          style={styles.actionButton}
          onPress={() => router.push('/todo/create')}
        />
        <AnimatedButton
          title={t('dashboard.startFocus')}
          icon="play"
          variant="primary"
          size="md"
          style={styles.actionButton}
          onPress={() => router.push('/(tabs)/pomodoro')}
        />
      </View>

      {/* Session and daily combos */}
      <ComboIndicator />

      {/* Active Tasks Section */}
      <View style={styles.section}>
        <SectionHeader
          title={t('dashboard.activeTasks')}
          action={
            <Pressable
              onPress={() => router.push('/(tabs)/todos')}
              style={styles.seeAllButton}
              hitSlop={12}
              accessibilityRole="button"
            >
              <Text style={[styles.seeAllText, { color: colors.primary }]}>
                {t('dashboard.seeAll')}
              </Text>
              <Icon
                name="arrow-forward"
                fill={colors.primary}
                style={styles.seeAllIcon}
              />
            </Pressable>
          }
        />

        {pendingTodos.length === 0 ? (
          <AnimatedCard
            variant="outlined"
            style={styles.emptyCard}
            contentStyle={styles.emptyContent}
          >
            <View style={[styles.emptyIconContainer, { backgroundColor: colors.success + '20' }]}>
              <Icon
                name="checkmark-circle-2"
                fill={colors.success}
                style={styles.emptyIcon}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t('dashboard.allCaughtUp')}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              {t('dashboard.allTasksCompleted')}
            </Text>
            <AnimatedButton
              title={t('dashboard.addTask')}
              icon="plus"
              variant="outline"
              size="sm"
              onPress={() => router.push('/todo/create')}
              style={styles.emptyButton}
            />
          </AnimatedCard>
        ) : (
          <View style={styles.todosList}>
            {pendingTodos.slice(0, 3).map((todo, index) => (
              <AnimatedCard
                key={todo.id}
                variant="default"
                style={styles.todoCard}
                contentStyle={styles.todoCardContent}
                accentColor={priorityColor(todo.priority, colors)}
                accentPosition="left"
                onPress={() => router.push(`/todo/${todo.id}`)}
              >
                <View style={styles.todoContent}>
                  <Text
                    style={[styles.todoTitle, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {todo.title}
                  </Text>
                  {todo.dueDate && (
                    <View style={styles.dueDateRow}>
                      <Icon
                        name="calendar"
                        fill={colors.textMuted}
                        style={styles.dueDateIcon}
                      />
                      <Text style={[styles.dueDateText, { color: colors.textMuted }]}>
                        {formatDue(todo.dueDate, todo.dueTime, dateFormat, timeFormat, i18n.language)}
                      </Text>
                    </View>
                  )}
                </View>
                <Icon
                  name="chevron-right"
                  fill={colors.textMuted}
                  style={styles.chevron}
                />
              </AnimatedCard>
            ))}
          </View>
        )}
      </View>

      {/* Today's quests, this week's goals and the monthly season fold to one line each */}
      <DailyQuestsCard />
      <WeeklyGoalsCard />
      <SeasonCard />
    </ScrollView>

    </>
  );
}

// Helper component for stat cards
interface StatCardProps {
  icon: string;
  value: number;
  label: string;
  color: string;
  onPress?: () => void;
}

function StatCard({ icon, value, label, color, onPress }: StatCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <AnimatedCard
      variant="default"
      style={styles.statCard}
      contentStyle={styles.statCardContent}
      onPress={onPress}
    >
      <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
        <Icon name={icon} fill={color} style={styles.statIcon} />
      </View>
      <AnimatedCounter
        value={value}
        category="h3"
        color={colors.text}
        style={styles.statValue}
      />
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
    </AnimatedCard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerContent: {
    flex: 1,
  },
  appTitle: {
    fontFamily: InterFonts.bold,
    fontSize: FontSize.xxl,
  },
  levelSubtitle: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.md,
    marginTop: 2,
  },
  xpCard: {
    marginBottom: Spacing.lg,
  },
  xpCardContent: {
    padding: Spacing.lg,
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  xpTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  xpIcon: {
    width: 20,
    height: 20,
    marginRight: Spacing.sm,
  },
  xpTitle: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.md,
  },
  xpValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  xpSeparator: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
  },
  xpTotal: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.sm,
  },
  nextLevelText: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.xs,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
  },
  statCardContent: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  statIcon: {
    width: 22,
    height: 22,
  },
  statValue: {
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.xs,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.sm,
  },
  seeAllIcon: {
    width: 16,
    height: 16,
    marginLeft: 4,
  },
  emptyCard: {
    marginTop: Spacing.sm,
  },
  emptyContent: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyIcon: {
    width: 32,
    height: 32,
  },
  emptyTitle: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.lg,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
    marginBottom: Spacing.lg,
  },
  emptyButton: {
    marginTop: Spacing.sm,
  },
  todosList: {
    gap: Spacing.sm,
  },
  todoCard: {
    marginBottom: 0,
  },
  todoCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingLeft: Spacing.lg,
  },
  todoContent: {
    flex: 1,
  },
  todoTitle: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.md,
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dueDateIcon: {
    width: 12,
    height: 12,
    marginRight: 4,
  },
  dueDateText: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.xs,
  },
  chevron: {
    width: 20,
    height: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  actionButton: {
    flex: 1,
  },
});
