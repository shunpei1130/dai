import { appendLog } from '../../log.js';
import { clearTrick } from '../../turn.js';

const hasTag = (pattern, tag) => pattern.isSpecial.includes(tag);

export const specialModules = [
  {
    id: 'cut8',
    isEnabled: (config) => config.cutStop.cut8,
    shouldTrigger: ({ pattern }) => hasTag(pattern, 'cut8'),
    apply: ({ state, playerId }) =>
      clearTrick(state, 'cut8', { keepTurnWith: playerId, message: '8切りで場が流れました' }),
  },
  {
    id: 'stop4',
    isEnabled: (config) => config.cutStop.stop4,
    shouldTrigger: ({ pattern }) => hasTag(pattern, 'stop4'),
    apply: ({ state }) =>
      appendLog(state, {
        type: 'ruleTriggered',
        message: '4止めが宣言されました',
      }),
  },
  {
    id: 'back11',
    isEnabled: (config) => config.backAndBan.back11 !== 'off',
    shouldTrigger: ({ pattern }) => hasTag(pattern, 'back11'),
    apply: ({ state }) => {
      const backEnabled = !state.isBack11;
      let nextState = { ...state, isBack11: backEnabled };
      if (state.ruleConfig.backAndBan.back11 === 'strong') {
        nextState = { ...nextState, turnDirection: nextState.turnDirection * -1 };
      }
      return appendLog(nextState, {
        type: backEnabled ? 'back11Started' : 'back11Ended',
        message: '11バックが切り替わりました',
      });
    },
  },
  {
    id: 'reverse9',
    isEnabled: (config) => config.etc.nineReverse,
    shouldTrigger: ({ pattern }) => hasTag(pattern, 'reverse9'),
    apply: ({ state }) => {
      const nextState = { ...state, turnDirection: state.turnDirection * -1 };
      return appendLog(nextState, {
        type: 'ruleTriggered',
        message: '9リバースでターン方向が反転しました',
      });
    },
  },
  {
    id: 'reverse12',
    isEnabled: (config) => config.etc.twelveReverse,
    shouldTrigger: ({ pattern }) => hasTag(pattern, 'reverse12'),
    apply: ({ state }) => {
      const nextState = { ...state, turnDirection: state.turnDirection * -1 };
      return appendLog(nextState, {
        type: 'ruleTriggered',
        message: '12リバースでターン方向が反転しました',
      });
    },
  },
  {
    id: 'skip5',
    isEnabled: (config) => config.etc.fiveSkip,
    shouldTrigger: ({ pattern }) => hasTag(pattern, 'skip5'),
    apply: ({ state }) => ({ ...state, pendingSkips: state.pendingSkips + 1 }),
  },
  {
    id: 'skip13',
    isEnabled: (config) => config.etc.thirteenSkip,
    shouldTrigger: ({ pattern }) => hasTag(pattern, 'skip13'),
    apply: ({ state }) => ({ ...state, pendingSkips: state.pendingSkips + 1 }),
  },
];
