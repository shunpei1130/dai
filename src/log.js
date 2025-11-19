function createLogId() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `log-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

export function appendLog(state, entry) {
  const logEntry = {
    id: entry.id ?? createLogId(),
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
