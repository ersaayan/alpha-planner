/**
 * Performance guards that are easiest to check in the source:
 * - only the Pomodoro screen and the Dashboard's live-time text subscribe to the
 *   per-second clock (a subscription in a screen re-renders the whole screen every
 *   second while the timer runs);
 * - no component sends animation values back to React on every frame (runOnJS /
 *   scheduleOnRN inside an animated reaction or a completion callback).
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');

function sources(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(rel);
    return /\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

const files = ['app', 'components', 'hooks'].flatMap(sources);
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

it('only the timer views subscribe to the per-second clock', () => {
  const subscribers = files.filter((file) => /usePomodoroClock\(/.test(read(file)));
  expect(subscribers.sort()).toEqual(['app/(tabs)/pomodoro.tsx', 'components/dashboard/timer-status-card.tsx']);
});

it('no component hands animation frames or completion callbacks to the JS thread', () => {
  const offenders = files.filter((file) => /\brunOnJS\(|\bscheduleOnRN\(/.test(read(file)));
  expect(offenders).toEqual([]);
});
