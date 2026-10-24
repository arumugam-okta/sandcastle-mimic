export type AppConfig = {
  /** Values for the template's declared env vars. */
  env: Record<string, string>;
  /** Extra env vars for this app. */
  extra: { key: string; value: string }[];
  /** Router base path, e.g. /app. Empty detects the Mimic preview path automatically. */
  basePath: string;
};

const key = (id: string) => `sandcastle:config:${id}`;

export function loadConfig(id: string): AppConfig {
  try {
    const raw = localStorage.getItem(key(id));
    if (raw) return { basePath: "", ...JSON.parse(raw) };
  } catch {}
  return { env: {}, extra: [], basePath: "" };
}

export function saveConfig(id: string, config: AppConfig) {
  localStorage.setItem(key(id), JSON.stringify(config));
}

export function toEnv(config: AppConfig): Record<string, string> {
  const env = { ...config.env };
  const base = config.basePath.trim().replace(/\/$/, "");
  if (base) {
    env.BASE_PATH = base;
    env.VITE_BASE_PATH = base;
  }
  for (const { key, value } of config.extra) if (key.trim()) env[key.trim()] = value;
  return env;
}
