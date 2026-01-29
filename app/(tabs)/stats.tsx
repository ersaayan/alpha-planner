import { useMemo } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, Card, ProgressBar, Button } from '@ui-kitten/components';
import { Icon } from '@/components/icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { startOfDay, isSameDay } from 'date-fns';

import { useGamificationStore, usePomodoroStore, useTodoStore } from '@/stores';
import { ACHIEVEMENTS, getLevelTitle } from '@/constants/gamification';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { WeeklyChart, DistributionChart } from '@/components/charts';

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const stats = useGamificationStore((state) => state.stats);
  const unlockedAchievements = useGamificationStore((state) => state.unlockedAchievements);
  const getXpProgress = useGamificationStore((state) => state.getXpProgress);
  const isAchievementUnlocked = useGamificationStore((state) => state.isAchievementUnlocked);

  const xpProgress = getXpProgress();

  // Get pomodoro sessions for charts
  const sessions = usePomodoroStore((state) => state.sessions);
  const todos = useTodoStore((state) => state.todos);

  // Check if user is new (no activity yet)
  const isNewUser = stats.totalPomodoros === 0 && stats.totalTasksCompleted === 0;

  // Prepare weekly activity data - completed focus sessions by day
  const weeklyActivityData = useMemo(() => {
    const focusSessions = sessions.filter(
      (s) => s.phase === 'focus' && s.wasCompleted
    );

    // Group by date
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

  // Prepare focus time distribution by phase
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
      { label: 'Focus', value: focusTime, color: '#5A7868' },
      { label: 'Short Break', value: shortBreakTime, color: '#90AB8B' },
      { label: 'Long Break', value: longBreakTime, color: '#B5A45E' },
    ];
  }, [sessions]);

  // Prepare tasks completed this week
  const weeklyTasksData = useMemo(() => {
    const completedTodos = todos.filter(
      (t) => t.status === 'completed' && t.completedAt
    );

    // Group by date
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
    >
      {/* Header */}
      <View style={styles.header}>
        <Text category="h5">Statistics</Text>
      </View>

      {/* Empty State for New Users */}
      {isNewUser && (
        <Card style={[styles.emptyCard, { backgroundColor: colors.card }]}>
          <View style={styles.emptyContent}>
            <View style={[styles.emptyIconContainer, { backgroundColor: colors.primary + '15' }]}>
              <Icon name="bar-chart-outline" fill={colors.primary} style={styles.emptyIcon} />
            </View>
            <Text category="h6" style={{ marginTop: Spacing.md, textAlign: 'center' }}>
              Start Your Journey!
            </Text>
            <Text
              category="p2"
              style={{ color: colors.textMuted, textAlign: 'center', marginTop: Spacing.xs }}
            >
              Complete pomodoro sessions and tasks to see your progress here.
            </Text>
            <View style={styles.emptyActions}>
              <Button
                size="small"
                appearance="outline"
                style={styles.emptyButton}
                accessoryLeft={(props) => <Icon {...props} name="plus-outline" />}
                onPress={() => router.push('/todo/create')}
              >
                Create Task
              </Button>
              <Button
                size="small"
                style={styles.emptyButton}
                accessoryLeft={(props) => <Icon {...props} name="play-circle-outline" />}
                onPress={() => router.push('/(tabs)/pomodoro')}
              >
                Start Focus
              </Button>
            </View>
          </View>
        </Card>
      )}

      {/* Level Card */}
      <Card style={[styles.levelCard, { backgroundColor: colors.card }]}>
        <View style={styles.levelHeader}>
          <View style={[styles.levelBadge, { backgroundColor: colors.primary }]}>
            <Text category="h6" style={{ color: '#fff' }}>
              {stats.level}
            </Text>
          </View>
          <View style={styles.levelInfo}>
            <Text category="h6">{getLevelTitle(stats.level)}</Text>
            <Text category="c1" style={{ color: colors.textMuted }}>
              {xpProgress.current} / {xpProgress.required} XP to next level
            </Text>
          </View>
        </View>
        <ProgressBar
          style={styles.xpBar}
          progress={xpProgress.percentage / 100}
          status="primary"
        />
      </Card>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <Card style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Icon name="clock-outline" fill={colors.primary} style={styles.statIcon} />
          <Text category="h5">{stats.totalPomodoros}</Text>
          <Text category="c1" style={{ color: colors.textMuted }}>
            Pomodoros
          </Text>
        </Card>

        <Card style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Icon name="hourglass-outline" fill={colors.primary} style={styles.statIcon} />
          <Text category="h5">{formatTime(stats.totalFocusTime)}</Text>
          <Text category="c1" style={{ color: colors.textMuted }}>
            Focus Time
          </Text>
        </Card>

        <Card style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Icon name="checkmark-circle-outline" fill={colors.primary} style={styles.statIcon} />
          <Text category="h5">{stats.totalTasksCompleted}</Text>
          <Text category="c1" style={{ color: colors.textMuted }}>
            Tasks Done
          </Text>
        </Card>

        <Card style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Icon name="flash-outline" fill={colors.primary} style={styles.statIcon} />
          <Text category="h5">{stats.currentStreak}</Text>
          <Text category="c1" style={{ color: colors.textMuted }}>
            Day Streak
          </Text>
        </Card>
      </View>

      {/* Streak Info */}
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.streakInfo}>
          <View>
            <Text category="s1">Current Streak</Text>
            <Text category="h4" style={{ color: colors.primary }}>
              {stats.currentStreak} days
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text category="c1" style={{ color: colors.textMuted }}>
              Best Streak
            </Text>
            <Text category="s1">{stats.longestStreak} days</Text>
          </View>
        </View>
      </Card>

      {/* Weekly Activity Charts */}
      {!isNewUser && (
        <>
          <Card style={[styles.card, { backgroundColor: colors.card }]}>
            <WeeklyChart
              data={weeklyActivityData}
              title="Focus Sessions"
              valueLabel="sessions"
              barColor={colors.primary}
            />
          </Card>

          <Card style={[styles.card, { backgroundColor: colors.card }]}>
            <WeeklyChart
              data={weeklyTasksData}
              title="Tasks Completed"
              valueLabel="tasks"
              barColor="#90AB8B"
            />
          </Card>

          <Card style={[styles.card, { backgroundColor: colors.card }]}>
            <DistributionChart
              data={timeDistributionData}
              title="Time Distribution"
            />
          </Card>
        </>
      )}

      {/* Achievements Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text category="h6">Achievements</Text>
          <Text category="c1" style={{ color: colors.textMuted }}>
            {unlockedAchievements.length} / {ACHIEVEMENTS.filter((a) => !a.isSecret).length}
          </Text>
        </View>

        <View style={styles.achievementsGrid}>
          {ACHIEVEMENTS.filter((a) => !a.isSecret || isAchievementUnlocked(a.id)).map((achievement) => {
            const unlocked = isAchievementUnlocked(achievement.id);
            return (
              <Card
                key={achievement.id}
                style={[
                  styles.achievementCard,
                  {
                    backgroundColor: unlocked ? colors.card : colors.backgroundSecondary,
                    opacity: unlocked ? 1 : 0.6,
                  },
                ]}
              >
                <View style={styles.achievementContent}>
                  <View
                    style={[
                      styles.achievementIcon,
                      {
                        backgroundColor: unlocked ? colors.primary + '20' : colors.border,
                      },
                    ]}
                  >
                    <Icon
                      name={achievement.icon}
                      fill={unlocked ? colors.primary : colors.textMuted}
                      style={{ width: 24, height: 24 }}
                    />
                  </View>
                  <Text category="s2" numberOfLines={1}>
                    {achievement.name}
                  </Text>
                  <Text
                    category="c1"
                    style={{ color: colors.textMuted, textAlign: 'center' }}
                    numberOfLines={2}
                  >
                    {achievement.description}
                  </Text>
                  {unlocked && (
                    <View style={styles.xpBadge}>
                      <Text category="c2" style={{ color: colors.primary }}>
                        +{achievement.xpReward} XP
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            );
          })}
        </View>
      </View>
    </ScrollView>
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
  levelCard: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  levelBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  levelInfo: {
    flex: 1,
  },
  xpBar: {
    borderRadius: BorderRadius.full,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  statIcon: {
    width: 32,
    height: 32,
    marginBottom: Spacing.xs,
  },
  card: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  streakInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  achievementCard: {
    width: '31%',
    flexGrow: 1,
    borderRadius: BorderRadius.md,
  },
  achievementContent: {
    alignItems: 'center',
    padding: Spacing.xs,
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  xpBadge: {
    marginTop: Spacing.xs,
  },
  emptyCard: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
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
  emptyActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  emptyButton: {
    minWidth: 120,
  },
});
