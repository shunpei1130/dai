const test = require('node:test');
const assert = require('node:assert');
const { evaluateRoll } = require('../public/chinchiro');

test('4-5-6 is win', () => {
  assert.deepStrictEqual(evaluateRoll([4, 5, 6]), { type: 'win', value: '4-5-6' });
});

test('1-2-3 is lose', () => {
  assert.deepStrictEqual(evaluateRoll([1, 2, 3]), { type: 'lose', value: '1-2-3' });
});

test('double and single returns point', () => {
  assert.deepStrictEqual(evaluateRoll([2, 2, 5]), { type: 'point', value: 5 });
});

test('triple detection', () => {
  assert.deepStrictEqual(evaluateRoll([3, 3, 3]), { type: 'triple', value: 3 });
});
