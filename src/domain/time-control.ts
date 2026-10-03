/**
 * Pure helpers for time-control labels.
 */

export type TimeControlIcon = 'clock' | 'lightning' | 'infinity' | 'gear';

export interface TimeControlLabel {
  text: string;
  icon: TimeControlIcon;
}

export function getTimeCategory(baseMinutes: number): string {
  if (baseMinutes <= 2) return 'Пуля';
  if (baseMinutes <= 5) return 'Блиц';
  if (baseMinutes <= 30) return 'Рапид';
  return 'Классика';
}

export function describeTimeControl(
  { enabled, baseMinutes, incrementSeconds }: { enabled: boolean; baseMinutes: number; incrementSeconds: number }
): TimeControlLabel {
  if (!enabled) return { text: 'Без часов', icon: 'infinity' };
  const category = getTimeCategory(baseMinutes);
  const icon = category === 'Пуля' || category === 'Блиц' ? 'lightning' : 'clock';
  return { text: `${baseMinutes} + ${incrementSeconds > 0 ? incrementSeconds : 0} (${category})`, icon };
}

export function describeCorrespondence(baseMinutes: number): TimeControlLabel {
  const days = Math.round(baseMinutes / 1440);
  const word = days === 1 ? 'день' : days < 5 ? 'дня' : 'дней';
  return { text: `${days} ${word} (Заочная)`, icon: 'gear' };
}
