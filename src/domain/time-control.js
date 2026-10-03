/**
 * Pure helpers for time-control labels.
 */

export function getTimeCategory(baseMinutes) {
  if (baseMinutes <= 2) return 'Пуля';
  if (baseMinutes <= 5) return 'Блиц';
  if (baseMinutes <= 30) return 'Рапид';
  return 'Классика';
}

export function describeTimeControl({ enabled, baseMinutes, incrementSeconds }) {
  if (!enabled) return { text: 'Без часов', icon: 'infinity' };
  const category = getTimeCategory(baseMinutes);
  const icon = category === 'Пуля' || category === 'Блиц' ? 'lightning' : 'clock';
  return { text: `${baseMinutes} + ${incrementSeconds > 0 ? incrementSeconds : 0} (${category})`, icon };
}

export function describeCorrespondence(baseMinutes) {
  const days = Math.round(baseMinutes / 1440);
  const word = days === 1 ? 'день' : days < 5 ? 'дня' : 'дней';
  return { text: `${days} ${word} (Заочная)`, icon: 'gear' };
}
