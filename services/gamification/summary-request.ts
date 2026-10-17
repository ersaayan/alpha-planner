import { create } from 'zustand';

/**
 * A daily summary the user asked for (by tapping the 23:00 notification). Not persisted:
 * CelebrationHost shows it and clears it.
 */
export const useSummaryRequest = create<{ dateKey: string | null }>(() => ({ dateKey: null }));

export function requestDailySummary(dateKey: string): void {
  useSummaryRequest.setState({ dateKey });
}

export function clearDailySummaryRequest(): void {
  useSummaryRequest.setState({ dateKey: null });
}
