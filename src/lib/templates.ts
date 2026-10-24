import "server-only";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type TemplateEnv = {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
};

export type Template = {
  id: string;
  name: string;
  description: string;
  port: number;
  redirectPath: string;
  env: TemplateEnv[];
  /** Project files by relative path. */
  files: Record<string, string>;
  /** File opened first in the editor. */
  entry: string;
};

const ROOT = path.join(process.cwd(), "templates");
const SKIP = new Set(["node_modules", "dist", ".angular", "template.json"]);

function readFiles(dir: string, prefix = "", out: Record<string, string> = {}) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    const rel = prefix + name;
    if (statSync(full).isDirectory()) readFiles(full, rel + "/", out);
    else out[rel] = readFileSync(full, "utf8");
  }
  return out;
}

const ENTRIES = ["server.js", "src/main.jsx", "src/app/app.config.ts"];

export function loadTemplates(): Template[] {
  return readdirSync(ROOT)
    .filter((d) => statSync(path.join(ROOT, d)).isDirectory())
    .map((d) => {
      const dir = path.join(ROOT, d);
      const files = readFiles(dir);
      const meta = JSON.parse(readFileSync(path.join(dir, "template.json"), "utf8"));
      return {
        id: meta.id,
        name: meta.name,
        description: meta.description,
        port: meta.port,
        redirectPath: new URL(meta.redirectUri).pathname,
        env: meta.env,
        files,
        entry: ENTRIES.find((e) => e in files) ?? Object.keys(files)[0],
      };
    });
}
