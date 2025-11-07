// Placeholder for future versions
export function migrateConfig(cfg) {
  if (cfg.version === 1) return cfg;
  throw new Error("Unsupported config version: " + cfg.version);
}
