import { Icon } from '@/components/icon';
import { Text } from '@ui-kitten/components';
import { startOfDay } from 'date-fns';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DistributionChart, WeeklyChart } from '@/components/charts';
import { ACHIEVEMENTS, getLevelTitle, getLevelTier } from '@/constants/gamification';
import { BorderRadius, Colors, FontSize, GamificationColors, InterFonts, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore, useGamificationStore, usePomodoroStore, useTodoStore } from '@/stores';

import { SectionHeader } from '@/components/common';
import { AchievementBadge, LevelBadge } from '@/components/animated/animated-badge';
import { AnimatedButton } from '@/components/animated/animated-button';
import { AnimatedCard } from '@/components/animated/animated-card';
import { AnimatedCounter } from '@/components/animated/animated-counter';
import { AnimatedProgressBar } from '@/components/animated/animated-progress-bar';

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const stats = useGamificationStore((state) => state.stats);
  const unlockedAchievements = useGamificationStore((state) => state.unlockedAchievements);
  const combo = useGamificationStore((state) => state.combo);
  const prestige = useGamificationStore((state) => state.prestige);
  const getXpProgress = useGamificationStore((state) => state.getXpProgress);
  const isAchievementUnlocked = useGamificationStore((state) => state.isAchievementUnlocked);

  const xpProgress = getXpProgress();

  const sessions = usePomodoroStore((state) => state.sessions);
  const todos = useTodoStore((state) => state.todos);

  const isNewUser = stats.totalPomodoros === 0 && stats.totalTasksCompleted === 0;

  // Prepare weekly activity data
  const weeklyActivityData = useMemo(() => {
    const focusSessions = sessions.filter(
      (s) => s.phase === 'focus' && s.wasCompleted
    );

    const dateMap = new Map<string, number>();
    focusSessions.forEach((session) => {
      const dateKey = startOfDay(new Date(session.startedAt)).toISOString();
      dateMap.set(dateKey, (dateMap.get(dateKey) ?? 0) + 1);
    });

    return Array.from(dateMap.entries()).map(([dateStr, count]) => ({
      date: new Date(dateStr),
      value: count,
    }));
  }, [sessions]);

  // Prepare focus time distribution
  const timeDistributionData = useMemo(() => {
    const focusTime = sessions
      .filter((s) => s.phase === 'focus' && s.wasCompleted)
      .reduce((sum, s) => sum + s.duration, 0);

    const shortBreakTime = sessions
      .filter((s) => s.phase === 'short_break' && s.wasCompleted)
      .reduce((sum, s) => sum + s.duration, 0);

    const longBreakTime = sessions
      .filter((s) => s.phase === 'long_break' && s.wasCompleted)
      .reduce((sum, s) => sum + s.duration, 0);

    return [
      { label: 'Focus', value: focusTime, color: colors.timerFocus },
      { label: 'Short Break', value: shortBreakTime, color: colors.timerBreak },
      { label: 'Long Break', value: longBreakTime, color: '#B5A45E' },
    ];
  }, [sessions, colors]);

  // Prepare weekly tasks data
  const weeklyTasksData = useMemo(() => {
    const completedTodos = todos.filter(
      (t) => t.status === 'completed' && t.completedAt
    );

    const dateMap = new Map<string, number>();
    completedTodos.forEach((todo) => {
      const dateKey = startOfDay(new Date(todo.completedAt!)).toISOString();
      dateMap.set(dateKey, (dateMap.get(dateKey) ?? 0) + 1);
    });

    return Array.from(dateMap.entries()).map(([dateStr, count]) => ({
      date: new Date(dateStr),
      value: count,
    }));
  }, [todos]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.md,
        paddingBottom: insets.bottom + 100,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Statistics
        </Text>
      </View>

      {/* Empty State for New Users */}
      {isNewUser && (
        <AnimatedCard
          variant="elevated"
          style={styles.emptyCard}
          contentStyle={styles.emptyContent}
        >
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.primary + '20' }]}>
            <Icon name="bar-chart" fill={colors.primary} style={styles.emptyIcon} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Start Your Journey!
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Complete pomodoro sessions and tasks to see your progress here.
          </Text>
          <View style={styles.emptyActions}>
            <AnimatedButton
              title="Create Task"
              icon="plus"
              variant="outline"
              size="sm"
              onPress={() => router.push('/todo/create')}
            />
            <AnimatedButton
              title="Start Focus"
              icon="play"
              variant="primary"
              size="sm"
              onPress={() => router.push('/(tabs)/pomodoro')}
            />
          </View>
        </AnimatedCard>
      )}

      {/* Level Card */}
      <AnimatedCard
        variant="elevated"
        style={styles.levelCard}
        contentStyle={styles.levelCardContent}
      >
        <View style={styles.levelHeader}>
          <LevelBadge
            level={stats.level}
            size="md"
            showGlow={stats.level >= 5}
          />
          <View style={styles.levelInfo}>
            <Text style={[styles.levelTitle, { color: colors.text }]}>
              {getLevelTier(stats.level)} · {getLevelTitle(stats.level)}
            </Text>
            <Text style={[styles.levelSubtitle, { color: colors.textMuted }]}>
              Level {stats.level} / 50
            </Text>
          </View>
          <View style={styles.xpInfo}>
            <View style={[styles.xpBadge, { backgroundColor: GamificationColors.xp + '20' }]}>
              <Icon name="star" fill={GamificationColors.xp} style={styles.xpIcon} />
              <Text style={[styles.xpValue, { color: GamificationColors.xp }]}>
                {stats.totalXp} XP
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
              {stats.level >= 10 ? '✨ Max Level!' : `Progress to Level ${stats.level + 1}`}
            </Text>
            <Text style={[styles.progressValue, { color: colors.text }]}>
              {stats.level >= 10 ? `${stats.totalXp} XP` : `${xpProgress.current} / ${xpProgress.required} XP`}
            </Text>
          </View>
          <AnimatedProgressBar
            progress={xpProgress.percentage / 100}
            height={12}
            showShimmer={true}
            gradientColors={[GamificationColors.progressStart, GamificationColors.progressEnd]}
            backgroundColor={colors.backgroundSecondary}
          />
        </View>
      </AnimatedCard>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatGridCard
          icon="clock"
          value={stats.totalPomodoros}
          label="Pomodoros"
          color={colors.primary}
        />
        <StatGridCard
          icon="hourglass"
          value={formatTime(stats.totalFocusTime)}
          label="Focus Time"
          color={colors.info}
          isString
        />
        <StatGridCard
          icon="checkmark-circle-2"
          value={stats.totalTasksCompleted}
          label="Tasks Done"
          color={colors.success}
        />
        <StatGridCard
          icon="flash"
          value={stats.currentStreak}
          label="Day Streak"
          color={GamificationColors.streak}
        />
      </View>

      {/* Streak Card */}
      <AnimatedCard
        variant="default"
        style={styles.streakCard}
        contentStyle={styles.streakCardContent}
      >
        <View style={styles.streakRow}>
          <View style={styles.streakItem}>
            <View style={[styles.streakIconContainer, { backgroundColor: GamificationColors.streak + '20' }]}>
              <Icon name="flash" fill={GamificationColors.streak} style={styles.streakIcon} />
            </View>
            <View>
              <Text style={[styles.streakLabel, { color: colors.textMuted }]}>
                Current Streak
              </Text>
              <AnimatedCounter
                value={stats.currentStreak}
                suffix=" days"
                category="h3"
                color={colors.text}
              />
            </View>
          </View>
          <View style={[styles.streakDivider, { backgroundColor: colors.border }]} />
          <View style={styles.streakItem}>
            <View style={[styles.streakIconContainer, { backgroundColor: GamificationColors.achievementGold + '20' }]}>
              <Icon name="award" fill={GamificationColors.achievementGold} style={styles.streakIcon} />
            </View>
            <View>
              <Text style={[styles.streakLabel, { color: colors.textMuted }]}>
                Best Streak
              </Text>
              <Text style={[styles.streakValue, { color: colors.text }]}>
                {stats.longestStreak} days
              </Text>
            </View>
          </View>
        </View>
      </AnimatedCard>

      {/* Weekly Activity Charts */}
      {!isNewUser && (
        <>
          <AnimatedCard
            variant="default"
            style={styles.chartCard}
            contentStyle={styles.chartCardContent}
          >
            <WeeklyChart
              data={weeklyActivityData}
              title="Focus Sessions"
              valueLabel="sessions"
              barColor={colors.primary}
            />
          </AnimatedCard>

          <AnimatedCard
            variant="default"
            style={styles.chartCard}
            contentStyle={styles.chartCardContent}
          >
            <WeeklyChart
              data={weeklyTasksData}
              title="Tasks Completed"
              valueLabel="tasks"
              barColor={colors.success}
            />
          </AnimatedCard>

          <AnimatedCard
            variant="default"
            style={styles.chartCard}
            contentStyle={styles.chartCardContent}
          >
            <DistributionChart
              data={timeDistributionData}
              title="Time Distribution"
            />
          </AnimatedCard>
        </>
      )}

      {/* Achievements Section */}
      <View style={styles.section}>
        <SectionHeader
          title="Achievements"
          action={
            <View style={[styles.achievementCount, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.achievementCountText, { color: colors.primary }]}>
                {unlockedAchievements.length} / {ACHIEVEMENTS.filter((a) => !a.isSecret).length}
              </Text>
            </View>
          }
        />

        <View style={styles.achievementsGrid}>
          {ACHIEVEMENTS.filter((a) => !a.isSecret || isAchievementUnlocked(a.id)).map((achievement) => {
            const unlocked = isAchievementUnlocked(achievement.id);
            return (
              <AnimatedCard
                key={achievement.id}
                variant={unlocked ? 'default' : 'outlined'}
                style={styles.achievementCard}
                contentStyle={styles.achievementCardContent}
              >
                <AchievementBadge
                  icon={achievement.icon}
                  title={achievement.name}
                  isUnlocked={unlocked}
                  rarity={
                    achievement.xpReward >= 200
                      ? 'legendary'
                      : achievement.xpReward >= 150
                        ? 'epic'
                        : achievement.xpReward >= 100
                          ? 'rare'
                          : 'common'
                  }
                  size="sm"
                />
                <Text
                  style={[
                    styles.achievementDescription,
                    { color: unlocked ? colors.textSecondary : colors.textMuted },
                  ]}
                  numberOfLines={2}
                >
                  {achievement.description}
                </Text>
                {unlocked && (
                  <View style={[styles.achievementXp, { backgroundColor: GamificationColors.xp + '20' }]}>
                    <Text style={[styles.achievementXpText, { color: GamificationColors.xp }]}>
                      +{achievement.xpReward} XP
                    </Text>
                  </View>
                )}
              </AnimatedCard>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

// Stat grid card component
interface StatGridCardProps {
  icon: string;
  value: number | string;
  label: string;
  color: string;
  isString?: boolean;
}

function StatGridCard({ icon, value, label, color, isString }: StatGridCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <AnimatedCard
      variant="default"
      style={styles.statCard}
      contentStyle={styles.statCardContent}
    >
      <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
        <Icon name={icon} fill={color} style={styles.statIcon} />
      </View>
      {isString ? (
        <Text style={[styles.statValue, { color: colors.text }]}>
          {value}
        </Text>
      ) : (
        <AnimatedCounter
          value={value as number}
          category="h3"
          color={colors.text}
        />
      )}
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
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    fontFamily: InterFonts.bold,
    fontSize: FontSize.xxl,
  },
  emptyCard: {
    marginBottom: Spacing.lg,
  },
  emptyContent: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    width: 40,
    height: 40,
  },
  emptyTitle: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.lg,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
    textAlign: 'center',
    lineHeight: FontSize.sm * 1.5,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  levelCard: {
    marginBottom: Spacing.lg,
  },
  levelCardContent: {
    padding: Spacing.lg,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  levelInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  levelTitle: {
    fontFamily: InterFonts.bold,
    fontSize: FontSize.lg,
  },
  levelSubtitle: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  xpInfo: {
    alignItems: 'flex-end',
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  xpIcon: {
    width: 14,
    height: 14,
    marginRight: 4,
  },
  xpValue: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.sm,
  },
  progressSection: {
    marginTop: Spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  progressLabel: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.sm,
  },
  progressValue: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    width: '47%',
    flexGrow: 1,
  },
  statCardContent: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statIcon: {
    width: 24,
    height: 24,
  },
  statValue: {
    fontFamily: InterFonts.bold,
    fontSize: FontSize.xl,
  },
  statLabel: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.xs,
    marginTop: 4,
  },
  streakCard: {
    marginBottom: Spacing.lg,
  },
  streakCardContent: {
    padding: Spacing.lg,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  streakIcon: {
    width: 22,
    height: 22,
  },
  streakLabel: {
    fontFamily: InterFonts.medium,
    fontSize: FontSize.xs,
  },
  streakValue: {
    fontFamily: InterFonts.bold,
    fontSize: FontSize.lg,
  },
  streakDivider: {
    width: 1,
    height: 40,
    marginHorizontal: Spacing.lg,
  },
  chartCard: {
    marginBottom: Spacing.md,
  },
  chartCardContent: {
    padding: Spacing.md,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.lg,
  },
  achievementCount: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  achievementCountText: {
    fontFamily: InterFonts.semibold,
    fontSize: FontSize.xs,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  achievementCard: {
    width: '47%',
    flexGrow: 1,
  },
  achievementCardContent: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  achievementDescription: {
    fontFamily: InterFonts.regular,
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: FontSize.xs * 1.4,
  },
  achievementXp: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  achievementXpText: {
    fontFamily: InterFonts.semibold,
    fontSize: 10,
  },
});
