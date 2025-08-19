(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.chinchiro = factory();
  }
}(this, function () {
  function rollDice() {
    return Array.from({ length: 3 }, () => Math.floor(Math.random() * 6) + 1);
  }

  function evaluateRoll(dice) {
    const sorted = [...dice].sort();
    const [a, b, c] = sorted;
    if (a === 1 && b === 2 && c === 3) return { type: 'lose', value: '1-2-3' };
    if (a === 4 && b === 5 && c === 6) return { type: 'win', value: '4-5-6' };
    if (a === b && b === c) return { type: 'triple', value: a };
    if (a === b) return { type: 'point', value: c };
    if (b === c) return { type: 'point', value: a };
    if (a === c) return { type: 'point', value: b };
    return { type: 'none', value: null };
  }

  return { rollDice, evaluateRoll };
}));
