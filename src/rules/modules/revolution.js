import { appendLog } from '../../log.js';

function toggleRevolution(state, enabled) {
  const nextValue = enabled ?? !state.isRevolution;
  return appendLog(
    { ...state, isRevolution: nextValue },
    {
      type: nextValue ? 'revolutionStarted' : 'revolutionEnded',
      message: nextValue ? '革命が発生しました' : '革命が終了しました',
    }
  );
}

export const revolutionModules = [
  {
    id: 'revolution.normal',
    isEnabled: (config) => config.revolution.enabled && config.revolution.normal,
    shouldTrigger: ({ pattern }) => pattern.type === 'quad' && pattern.isRevolutionTrigger,
    apply: ({ state }) => toggleRevolution(state),
  },
  {
    id: 'revolution.stair',
    isEnabled: (config) => config.revolution.enabled && config.revolution.stair,
    shouldTrigger: ({ pattern }) => pattern.type === 'stair' && pattern.isRevolutionTrigger,
    apply: ({ state }) => toggleRevolution(state),
  },
];
