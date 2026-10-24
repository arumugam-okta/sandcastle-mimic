import { cpSync, rmSync, mkdirSync } from "node:fs";

// Mimic runtime + workers: it locates its assets relative to its own entry URL.
const mimic = "node_modules/@mimic-js/runtime/dist";
rmSync("public/mimic", { recursive: true, force: true });
mkdirSync("public/mimic", { recursive: true });
cpSync(mimic + "/mimic.js", "public/mimic/mimic.js");
cpSync(mimic + "/assets", "public/mimic/assets", { recursive: true });

// Monaco is served same-origin: a CDN copy would be blocked by COEP require-corp.
rmSync("public/monaco", { recursive: true, force: true });
mkdirSync("public/monaco", { recursive: true });
cpSync("node_modules/monaco-editor/min/vs", "public/monaco/vs", { recursive: true });
