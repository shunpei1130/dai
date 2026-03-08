const ruleDefinitions = require("../data/rules-config.json");

function getDefaultSettings() {
  return ruleDefinitions.reduce((settings, rule) => {
    settings[rule.key] = rule.default;
    return settings;
  }, {});
}

function normalizeSettings(input = {}) {
  const defaults = getDefaultSettings();

  for (const rule of ruleDefinitions) {
    const value = input[rule.key];

    if (value === undefined || value === null) {
      continue;
    }

    if (rule.type === "boolean") {
      defaults[rule.key] = Boolean(value);
      continue;
    }

    if (rule.type === "select") {
      const allowed = new Set(rule.options.map((option) => option.value));
      if (allowed.has(value)) {
        defaults[rule.key] = value;
      }
    }
  }

  return defaults;
}

module.exports = {
  ruleDefinitions,
  getDefaultSettings,
  normalizeSettings
};
