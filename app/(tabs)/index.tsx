import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, Card, Button } from '@ui-kitten/components';
import { Icon } from '@/components/icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTodoStore, usePomodoroStore, useGamificationStore, useSettingsStore } from '@/stores';
import { getLevelTitle } from '@/constants/gamification';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatDate } from '@/utils/date';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const todos = useTodoStore((state) => state.todos);
  // Select primitive values to ensure re-renders
  const timerState = usePomodoroStore((state) => state.timer.state);
  const timerPhase = usePomodoroStore((state) => state.timer.phase);
  const remainingTime = usePomodoroStore((state) => state.timer.remainingTime);
  const stats = useGamificationStore((state) => state.stats);
  const getXpProgress = useGamificationStore((state) => state.getXpProgress);
  const dateFormat = useSettingsStore((state) => state.settings.dateFormat);

  // Calculate formatted time locally instead of using store function
  const formatTime = () => {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const pendingTodos = todos.filter((t) => t.status === 'pending' || t.status === 'in_progress');
  const todayCompleted = todos.filter(
    (t) =>
      t.status === 'completed' &&
      t.completedAt &&
      new Date(t.completedAt).toDateString() === new Date().toDateString()
  ).length;

  const xpProgress = getXpProgress();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 100 }}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text category="h4" style={{ color: colors.text }}>
          Alpha Planner
        </Text>
        <Text category="s1" style={{ color: colors.textSecondary }}>
          Level {stats.level} - {getLevelTitle(stats.level)}
        </Text>
      </View>

      {/* XP Progress */}
      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.xpContainer}>
          <View style={styles.xpHeader}>
            <Text category="s1">Experience</Text>
            <Text category="c1">
              {xpProgress.current} / {xpProgress.required} XP
            </Text>
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.backgroundSecondary }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(xpProgress.percentage, 100)}%`,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>
        </View>
      </Card>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <Card style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Icon name="flash-outline" fill={colors.primary} style={styles.statIcon} />
          <Text category="h6">{stats.currentStreak}</Text>
          <Text category="c1" style={{ color: colors.textMuted }}>
            Day Streak
          </Text>
        </Card>
        <Card style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Icon name="checkmark-circle-outline" fill={colors.primary} style={styles.statIcon} />
          <Text category="h6">{todayCompleted}</Text>
          <Text category="c1" style={{ color: colors.textMuted }}>
            Done Today
          </Text>
        </Card>
        <Card style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Icon name="clock-outline" fill={colors.primary} style={styles.statIcon} />
          <Text category="h6">{stats.totalPomodoros}</Text>
          <Text category="c1" style={{ color: colors.textMuted }}>
            Pomodoros
          </Text>
        </Card>
      </View>

      {/* Timer Status */}
      {timerState !== 'stopped' && (
        <Card
          style={[styles.card, { backgroundColor: colors.card }]}
          onPress={() => router.push('/(tabs)/pomodoro')}
        >
          <View style={styles.timerCard}>
            <View>
              <Text category="s1">
                {timerPhase === 'focus' ? 'Focus Time' : 'Break Time'}
              </Text>
              <Text category="h4" style={{ color: colors.primary }}>
                {formatTime()}
              </Text>
            </View>
            <Icon
              name={timerState === 'running' ? 'pause-circle-outline' : 'play-circle-outline'}
              fill={colors.primary}
              style={{ width: 48, height: 48 }}
            />
          </View>
        </Card>
      )}

      {/* Upcoming Tasks */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text category="h6">Upcoming Tasks</Text>
          <Button
            size="tiny"
            appearance="ghost"
            onPress={() => router.push('/(tabs)/todos')}
          >
            See All
          </Button>
        </View>

        {pendingTodos.length === 0 ? (
          <Card style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.emptyState}>
              <Icon name="checkmark-circle-2-outline" fill={colors.textMuted} style={styles.emptyIcon} />
              <Text category="s1" style={{ color: colors.textMuted }}>
                All caught up!
              </Text>
              <Button
                size="small"
                appearance="outline"
                style={{ marginTop: Spacing.md }}
                onPress={() => router.push('/todo/create')}
              >
                Add a Task
              </Button>
            </View>
          </Card>
        ) : (
          pendingTodos.slice(0, 3).map((todo) => (
            <Card
              key={todo.id}
              style={[styles.todoCard, { backgroundColor: colors.card }]}
              onPress={() => router.push(`/todo/${todo.id}`)}
            >
              <View style={styles.todoItem}>
                <View style={styles.todoContent}>
                  <Text category="s1" numberOfLines={1}>
                    {todo.title}
                  </Text>
                  {todo.dueDate && (
                    <Text category="c1" style={{ color: colors.textMuted }}>
                      Due: {formatDate(new Date(todo.dueDate), dateFormat)}
                    </Text>
                  )}
                </View>
                <Icon name="chevron-right-outline" fill={colors.textMuted} style={styles.chevron} />
              </View>
            </Card>
          ))
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text category="h6" style={{ marginBottom: Spacing.sm }}>
          Quick Actions
        </Text>
        <View style={styles.actionsRow}>
          <Button
            style={styles.actionButton}
            appearance="outline"
            accessoryLeft={(props) => <Icon {...props} name="plus-outline" />}
            onPress={() => router.push('/todo/create')}
          >
            New Task
          </Button>
          <Button
            style={styles.actionButton}
            accessoryLeft={(props) => <Icon {...props} name="play-circle-outline" />}
            onPress={() => router.push('/(tabs)/pomodoro')}
          >
            Start Focus
          </Button>
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
  card: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  xpContainer: {
    padding: Spacing.sm,
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  progressBar: {
    height: 8,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  statIcon: {
    width: 24,
    height: 24,
    marginBottom: Spacing.xs,
  },
  timerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.sm,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    marginBottom: Spacing.sm,
  },
  todoCard: {
    marginBottom: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todoContent: {
    flex: 1,
  },
  chevron: {
    width: 20,
    height: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});
