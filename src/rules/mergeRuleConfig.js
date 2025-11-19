function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function mergeRuleConfig(base, override = {}) {
  if (!override || typeof override !== 'object') {
    return { ...base };
  }

  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (!(key in base)) {
      result[key] = value;
      continue;
    }

    if (isPlainObject(base[key]) && isPlainObject(value)) {
      result[key] = mergeRuleConfig(base[key], value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
