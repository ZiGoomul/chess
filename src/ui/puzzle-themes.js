// Russian names for Lichess puzzle themes; unknown themes are left out of the description.
const THEME_NAMES = {
  mate: 'Мат', mateIn1: 'Мат в 1 ход', mateIn2: 'Мат в 2 хода', mateIn3: 'Мат в 3 хода', mateIn4: 'Мат в 4 хода', mateIn5: 'Мат в 5+ ходов',
  backRankMate: 'Мат по последней горизонтали', smotheredMate: 'Спёртый мат', anastasiaMate: 'Мат Анастасии', arabianMate: 'Арабский мат',
  hookMate: 'Мат крюком', bodenMate: 'Мат Бодена', doubleBishopMate: 'Мат двумя слонами', dovetailMate: 'Мат «ласточкин хвост»',
  fork: 'Вилка', pin: 'Связка', skewer: 'Сквозной удар', discoveredAttack: 'Вскрытое нападение', doubleCheck: 'Двойной шах',
  sacrifice: 'Жертва', deflection: 'Отвлечение', attraction: 'Завлечение', clearance: 'Освобождение поля', interference: 'Перекрытие',
  intermezzo: 'Промежуточный ход', xRayAttack: 'Рентген', zugzwang: 'Цугцванг', quietMove: 'Тихий ход', defensiveMove: 'Защитный ход',
  hangingPiece: 'Незащищённая фигура', trappedPiece: 'Ловля фигуры', capturingDefender: 'Уничтожение защиты',
  exposedKing: 'Открытый король', kingsideAttack: 'Атака на королевском фланге', queensideAttack: 'Атака на ферзевом фланге',
  advancedPawn: 'Продвинутая пешка', promotion: 'Превращение', underPromotion: 'Слабое превращение', enPassant: 'Взятие на проходе',
  castling: 'Рокировка', attackingF2F7: 'Атака на f2/f7',
  opening: 'Дебют', middlegame: 'Миттельшпиль', endgame: 'Эндшпиль', rookEndgame: 'Ладейный эндшпиль', bishopEndgame: 'Слоновый эндшпиль',
  pawnEndgame: 'Пешечный эндшпиль', knightEndgame: 'Коневой эндшпиль', queenEndgame: 'Ферзевый эндшпиль', queenRookEndgame: 'Ферзь и ладья',
  advantage: 'Перевес', crushing: 'Решающий перевес', equality: 'Уравнивание',
  oneMove: 'В один ход', short: 'Короткая', long: 'Длинная', veryLong: 'Очень длинная'
};

// Background tags go after the tactical motif: game phase, then evaluation, then length.
const PHASE_THEMES = new Set(['opening', 'middlegame', 'endgame', 'rookEndgame', 'bishopEndgame', 'pawnEndgame', 'knightEndgame', 'queenEndgame', 'queenRookEndgame']);
const EVALUATION_THEMES = new Set(['advantage', 'crushing', 'equality']);
const LENGTH_THEMES = new Set(['oneMove', 'short', 'long', 'veryLong']);

function rank(theme) {
  if (LENGTH_THEMES.has(theme)) return 3;
  if (EVALUATION_THEMES.has(theme)) return 2;
  if (PHASE_THEMES.has(theme)) return 1;
  return 0;
}

/** Up to `limit` known themes, the tactical motif first. */
export function describePuzzleThemes(themes = [], limit = 3) {
  return themes
    .filter(theme => THEME_NAMES[theme])
    .map((theme, index) => ({ theme, index }))
    .sort((a, b) => rank(a.theme) - rank(b.theme) || a.index - b.index)
    .slice(0, limit)
    .map(({ theme }) => THEME_NAMES[theme])
    .join(' · ');
}
