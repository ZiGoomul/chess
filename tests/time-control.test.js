import test from 'node:test';
import assert from 'node:assert/strict';
import { getTimeCategory, describeTimeControl, describeCorrespondence } from '../src/domain/time-control.js';

test('categories follow base minutes', () => {
  assert.equal(getTimeCategory(1), 'Пуля');
  assert.equal(getTimeCategory(3), 'Блиц');
  assert.equal(getTimeCategory(10), 'Рапид');
  assert.equal(getTimeCategory(60), 'Классика');
});

test('describeTimeControl labels timed and untimed games', () => {
  assert.deepEqual(describeTimeControl({ enabled: true, baseMinutes: 10, incrementSeconds: 5 }), { text: '10 + 5 (Рапид)', icon: 'clock' });
  assert.deepEqual(describeTimeControl({ enabled: true, baseMinutes: 3, incrementSeconds: 0 }), { text: '3 + 0 (Блиц)', icon: 'lightning' });
  assert.deepEqual(describeTimeControl({ enabled: false, baseMinutes: 10, incrementSeconds: 5 }), { text: 'Без часов', icon: 'infinity' });
});

test('describeCorrespondence pluralises days', () => {
  assert.equal(describeCorrespondence(1440).text, '1 день (Заочная)');
  assert.equal(describeCorrespondence(3 * 1440).text, '3 дня (Заочная)');
  assert.equal(describeCorrespondence(7 * 1440).text, '7 дней (Заочная)');
});
