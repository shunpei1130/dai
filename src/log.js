import { randomUUID } from 'crypto';

export function appendLog(state, entry) {
  const logEntry = {
    id: entry.id ?? randomUUID(),
    type: entry.type,
    message: entry.message,
    payload: entry.payload ?? null,
    createdAt: Date.now(),
  };
  return {
    ...state,
    logs: [...state.logs, logEntry],
  };
}
