import {
  QUEST_TEMPLATES,
  getQuestTemplate,
  pickQuests,
  planQuests,
  type OpenTaskInfo,
  type QuestContext,
  type QuestEvent,
} from '@/constants/daily-quests';
import type { DailyQuest } from '@/types';

const at = (hour: number, minute = 0) => new Date(2026, 9, 14, hour, minute);

function context(overrides: Partial<QuestContext> = {}): QuestContext {
  return {
    now: at(8),
    focusMinutes: 25,
    shortBreakMinutes: 5,
    openTasks: [],
    recent: { pomodoros: 0, tasks: 0, focusMinutes: 0 },
    random: () => 0,
    ...overrides,
  };
}

const task = (overrides: Partial<OpenTaskInfo> = {}): OpenTaskInfo => ({
  priority: 'medium',
  categoryId: null,
  isOverdue: false,
  openSubtasks: 0,
  ...overrides,
});

function quest(type: string, targetValue: number, questParams: Record<string, unknown> = {}): DailyQuest {
  return {
    id: type,
    date: '2026-10-14',
    questType: type,
    questParams,
    targetValue,
    currentValue: 0,
    isCompleted: false,
    xpReward: 20,
  };
}

const focus = (overrides: Partial<Extract<QuestEvent, { type: 'focus_completed' }>> = {}): QuestEvent => ({
  type: 'focus_completed',
  at: at(10, 25),
  startedAt: at(10),
  seconds: 25 * 60,
  pausedMs: 0,
  ...overrides,
});

const completed = (overrides: Partial<Extract<QuestEvent, { type: 'task_completed' }>> = {}): QuestEvent => ({
  type: 'task_completed',
  at: at(10),
  priority: 'medium',
  categoryId: null,
  wasOverdue: false,
  ...overrides,
});

function planFor(type: string, ctx: QuestContext) {
  return getQuestTemplate(type)!.plan(ctx);
}

describe('every quest type progresses', () => {
  const events: Record<string, { quest: DailyQuest; event: QuestEvent }> = {
    complete_pomodoros: { quest: quest('complete_pomodoros', 2), event: focus() },
    complete_tasks: { quest: quest('complete_tasks', 2), event: completed() },
    complete_subtasks: { quest: quest('complete_subtasks', 2), event: { type: 'subtask_completed', at: at(10) } },
    focus_time: { quest: quest('focus_time', 50), event: focus() },
    complete_urgent_task: { quest: quest('complete_urgent_task', 1), event: completed({ priority: 'urgent' }) },
    complete_high_priority: { quest: quest('complete_high_priority', 1), event: completed({ priority: 'high' }) },
    uninterrupted_focus: { quest: quest('uninterrupted_focus', 1), event: focus() },
    complete_in_category: {
      quest: quest('complete_in_category', 1, { categoryId: 'work' }),
      event: completed({ categoryId: 'work' }),
    },
    create_tasks: { quest: quest('create_tasks', 2), event: { type: 'task_created', at: at(10) } },
    complete_before_noon: { quest: quest('complete_before_noon', 1), event: focus() },
    no_skip_break: { quest: quest('no_skip_break', 2), event: { type: 'break_completed', at: at(10) } },
    start_early: { quest: quest('start_early', 1, { beforeHour: 9 }), event: focus({ startedAt: at(8, 30) }) },
    evening_session: { quest: quest('evening_session', 1), event: focus({ at: at(19), startedAt: at(18, 35) }) },
    clear_overdue: { quest: quest('clear_overdue', 1), event: completed({ wasOverdue: true }) },
    long_focus: { quest: quest('long_focus', 1, { minutes: 45 }), event: focus({ seconds: 45 * 60 }) },
  };

  it('covers all 15 templates', () => {
    expect(Object.keys(events).sort()).toEqual(QUEST_TEMPLATES.map((t) => t.type).sort());
  });

  it.each(Object.keys(events))('%s moves forward on its event', (type) => {
    const { quest: q, event } = events[type];
    const progress = getQuestTemplate(type)!.progress(q, event);
    expect(typeof progress === 'number' && progress > 0).toBe(true);
  });

  it('focus_time adds whole minutes', () => {
    expect(getQuestTemplate('focus_time')!.progress(quest('focus_time', 50), focus({ seconds: 25 * 60 + 59 }))).toBe(25);
  });

  it('a paused session does not count as uninterrupted', () => {
    expect(getQuestTemplate('uninterrupted_focus')!.progress(quest('uninterrupted_focus', 1), focus({ pausedMs: 60_000 }))).toBe(0);
  });

  it('long_focus counts one long session, not a short one', () => {
    const q = quest('long_focus', 1, { minutes: 45 });
    expect(getQuestTemplate('long_focus')!.progress(q, focus({ seconds: 25 * 60 }))).toBe(0);
  });

  it('a skipped break starts no_skip_break over', () => {
    expect(getQuestTemplate('no_skip_break')!.progress(quest('no_skip_break', 3), { type: 'break_skipped', at: at(10) })).toBe('reset');
  });

  it('only tasks in the chosen category count', () => {
    const q = quest('complete_in_category', 1, { categoryId: 'work' });
    expect(getQuestTemplate('complete_in_category')!.progress(q, completed({ categoryId: 'home' }))).toBe(0);
  });

  it('start_early needs the session to start before the hour', () => {
    const q = quest('start_early', 1, { beforeHour: 9 });
    expect(getQuestTemplate('start_early')!.progress(q, focus({ startedAt: at(9, 5) }))).toBe(0);
  });
});

describe('quests are only generated when they can be finished today', () => {
  it('pomodoro quests fit in the time left before midnight', () => {
    const late = context({ now: at(23, 0) });
    // 60 minutes left: two 25-minute sessions with a 5-minute break.
    expect(planFor('complete_pomodoros', late)?.targetValue).toBe(2);
    expect(planFor('focus_time', late)?.targetValue).toBe(50);
    expect(planFor('complete_pomodoros', context({ now: at(23, 40) }))).toBeNull();
    expect(planFor('focus_time', context({ now: at(23, 40) }))).toBeNull();
  });

  it('before-noon and start-early quests disappear once the morning is over', () => {
    expect(planFor('complete_before_noon', context({ now: at(11, 40) }))).toBeNull();
    expect(planFor('complete_before_noon', context({ now: at(11, 20) }))?.targetValue).toBe(1);
    expect(planFor('complete_before_noon', context({ now: at(11, 0) }))?.targetValue).toBe(2);
    expect(planFor('start_early', context({ now: at(6, 0) }))).toEqual({ targetValue: 1, params: { beforeHour: 7 } });
    expect(planFor('start_early', context({ now: at(8, 45) }))).toBeNull();
  });

  it('evening quests stop being offered late at night', () => {
    expect(planFor('evening_session', context({ now: at(23, 40) }))).toBeNull();
    expect(planFor('evening_session', context({ now: at(9) }))?.targetValue).toBeGreaterThanOrEqual(1);
  });

  it('task quests need matching open tasks', () => {
    const none = context();
    expect(planFor('clear_overdue', none)).toBeNull();
    expect(planFor('complete_urgent_task', none)).toBeNull();
    expect(planFor('complete_high_priority', none)).toBeNull();
    expect(planFor('complete_in_category', none)).toBeNull();
    expect(planFor('complete_subtasks', none)).toBeNull();

    const busy = context({
      openTasks: [
        task({ priority: 'urgent', isOverdue: true, categoryId: 'work', openSubtasks: 3 }),
        task({ priority: 'high', categoryId: 'work' }),
      ],
    });
    expect(planFor('clear_overdue', busy)?.targetValue).toBe(1);
    expect(planFor('complete_urgent_task', busy)?.targetValue).toBe(1);
    expect(planFor('complete_high_priority', busy)?.targetValue).toBe(2);
    expect(planFor('complete_in_category', busy)).toEqual({ targetValue: 2, params: { categoryId: 'work' } });
    expect(planFor('complete_subtasks', busy)?.targetValue).toBe(3);
  });

  it('long_focus is only offered to users with long sessions', () => {
    expect(planFor('long_focus', context())).toBeNull();
    expect(planFor('long_focus', context({ focusMinutes: 50 }))).toEqual({ targetValue: 1, params: { minutes: 50 } });
  });

  it('at least three quests are available on an ordinary morning', () => {
    expect(planQuests(context()).length).toBeGreaterThanOrEqual(3);
  });

  it('task quests are still offered right before midnight', () => {
    const picked = pickQuests(context({ now: at(23, 50) }));
    expect(picked.length).toBeGreaterThanOrEqual(2);
    expect(picked.map((p) => p.template.type)).toEqual(expect.arrayContaining(['create_tasks']));
  });

  it('picks distinct quests', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 20; i++) {
      const types = pickQuests(context({ random })).map((p) => p.template.type);
      expect(new Set(types).size).toBe(types.length);
      expect(types).toHaveLength(3);
    }
  });
});
