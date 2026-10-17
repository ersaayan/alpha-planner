/** Todo editing with the real stores: dates, order, subtasks, categories and the timer link. */
import { useCategoryStore } from '@/stores/category-store';
import { usePomodoroStore, stopPomodoroEngine } from '@/stores/pomodoro-store';
import { migrateTodoState, useTodoStore } from '@/stores/todo-store';
import { INITIAL_TIMER_STATE, type Todo } from '@/types';

function add(overrides: Partial<Todo> = {}): Todo {
  return useTodoStore.getState().addTodo({
    title: 'Task',
    description: null,
    dueDate: null,
    status: 'pending',
    categoryId: null,
    priority: 'medium',
    estimatedPomodoros: null,
    ...overrides,
  });
}
const get = (id: string) => useTodoStore.getState().todos.find((t) => t.id === id)!;

beforeEach(() => {
  useTodoStore.setState({ todos: [], filter: {}, sortBy: 'manual' });
  useCategoryStore.setState({
    categories: [
      { id: 'work', name: 'Work', color: '#111', icon: null, isDefault: true, order: 0, createdAt: '' },
      { id: 'side', name: 'Side', color: '#222', icon: null, isDefault: false, order: 1, createdAt: '' },
    ],
    isInitialized: true,
  });
  usePomodoroStore.setState({ timer: { ...INITIAL_TIMER_STATE }, sessions: [], currentSession: null });
});
afterEach(() => stopPomodoroEngine());

it('a new todo goes after every other one, also after a delete', () => {
  const a = add();
  const b = add();
  useTodoStore.getState().deleteTodo(a.id);
  const c = add();
  expect(get(c.id).order).toBeGreaterThan(get(b.id).order);
  expect(new Set(useTodoStore.getState().todos.map((t) => t.order)).size).toBe(2);
});

it('reorderTodos numbers todos 0..n-1 without collisions', () => {
  const [a, b, c] = [add(), add(), add()];
  useTodoStore.getState().reorderTodos([c.id, a.id]);
  expect([get(c.id).order, get(a.id).order, get(b.id).order]).toEqual([0, 1, 2]);
});

it('stores the due date as a local day and the time only with a date', () => {
  const t = add({ dueDate: new Date(2026, 9, 14).toISOString(), dueTime: '09:30' });
  expect(get(t.id)).toMatchObject({ dueDate: '2026-10-14', dueTime: '09:30' });
  useTodoStore.getState().updateTodo(t.id, { dueTime: 'nope' });
  expect(get(t.id).dueTime).toBeNull();
  useTodoStore.getState().updateTodo(t.id, { dueTime: '18:00' });
  // Clearing the date clears the time too.
  useTodoStore.getState().updateTodo(t.id, { dueDate: null });
  expect(get(t.id)).toMatchObject({ dueDate: null, dueTime: null });
});

it('the category can be removed from a todo', () => {
  const t = add({ categoryId: 'work' });
  useTodoStore.getState().updateTodo(t.id, { categoryId: null });
  expect(get(t.id).categoryId).toBeNull();
});

it('subtasks can be renamed, but not to an empty title or completed through updateSubtask', () => {
  const t = add();
  useTodoStore.getState().addSubtask(t.id, '  Outline  ');
  const [subtask] = get(t.id).subtasks;
  expect(subtask.title).toBe('Outline');
  useTodoStore.getState().updateSubtask(t.id, subtask.id, { title: 'Outline v2' });
  useTodoStore.getState().updateSubtask(t.id, subtask.id, { title: '   ' });
  useTodoStore.getState().updateSubtask(t.id, subtask.id, { isCompleted: true } as never);
  expect(get(t.id).subtasks[0]).toMatchObject({ title: 'Outline v2', isCompleted: false });
});

it('deleting the task linked to the timer unlinks it', () => {
  const t = add();
  usePomodoroStore.getState().linkTodo(t.id);
  useTodoStore.getState().deleteTodo(t.id);
  expect(usePomodoroStore.getState().timer.linkedTodoId).toBeNull();
});

it('categories removed in onboarding or settings are removed from todos and the filter', () => {
  const a = add({ categoryId: 'work' });
  const b = add({ categoryId: 'side' });
  useTodoStore.getState().setFilter({ categoryId: 'side' });

  useCategoryStore.getState().deleteCategory('side');
  expect(get(b.id).categoryId).toBeNull();
  expect(useTodoStore.getState().filter.categoryId).toBeUndefined();

  useCategoryStore.getState().keepOnlyCategories([]);
  expect(get(a.id).categoryId).toBeNull();
});

it('todo store v2 → v3: ISO due dates become local days', () => {
  const { todos } = migrateTodoState(
    { todos: [{ id: 'x', title: 'X', dueDate: new Date(2026, 9, 14).toISOString() }, { id: 'y', title: 'Y', dueDate: 'bad' }] },
    2
  );
  expect(todos[0]).toMatchObject({ dueDate: '2026-10-14', dueTime: null });
  expect(todos[1].dueDate).toBeNull();
});
