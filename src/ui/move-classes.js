// Labels and badge glyphs for review move classes (see MOVE_CLASSES in services/game-review.js).
export const MOVE_CLASS_LABELS = {
  best: { label: 'Лучший', icon: '★' },
  excellent: { label: 'Отличный', icon: '!' },
  good: { label: 'Хороший', icon: '✓' },
  inaccuracy: { label: 'Неточность', icon: '?!' },
  mistake: { label: 'Ошибка', icon: '?' },
  blunder: { label: 'Зевок', icon: '??' }
};

// Classes worth pointing at the engine's alternative for.
export const CLASSES_WITH_BETTER_MOVE = new Set(['good', 'inaccuracy', 'mistake', 'blunder']);
