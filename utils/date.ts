import { format } from 'date-fns';
import type { AppSettings } from '@/types';

export function getDateKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatDate(date: Date, dateFormat: AppSettings['dateFormat']): string {
  if (isNaN(date.getTime())) return '';
  switch (dateFormat) {
    case 'MM/DD/YYYY':
      return format(date, 'MM/dd/yyyy');
    case 'YYYY-MM-DD':
      return format(date, 'yyyy-MM-dd');
    case 'DD/MM/YYYY':
    default:
      return format(date, 'dd/MM/yyyy');
  }
}
