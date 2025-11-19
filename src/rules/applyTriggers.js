import { RULE_MODULES } from './modules/index.js';

export function applyTriggers(state, playerId, pattern) {
  const ctx = { state, playerId, pattern };
  let workingState = state;
  for (const mod of RULE_MODULES) {
    if (!mod.isEnabled(workingState.ruleConfig)) continue;
    if (!mod.shouldTrigger({ ...ctx, state: workingState })) continue;
    workingState = mod.apply({ ...ctx, state: workingState });
  }
  return workingState;
}
