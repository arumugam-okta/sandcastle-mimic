// One-off: vendor the Bearded Icons theme from the installed VS Code extension.
// Usage: node scripts/vendor-bearded-icons.mjs <path to beardedbear.beardedicons-x.y.z>
// Bearded Icons is GPL-3.0 (https://github.com/BeardedBear/bearded-icons); its LICENSE is copied alongside.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const src = process.argv[2];
if (!src) throw new Error("pass the extension directory");
const theme = JSON.parse(readFileSync(path.join(src, "icons.json"), "utf8"));
const file = (id) => path.basename(theme.iconDefinitions[id].iconPath, ".svg");

const out = "public/bearded-icons";
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(path.join(src, "icons"), out, { recursive: true });
cpSync(path.join(src, "LICENSE.txt"), path.join(out, "LICENSE.txt"));

// Some entries name icon ids the theme never defines; drop them.
const map = (o) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => theme.iconDefinitions[v]).map(([k, v]) => [k, file(v)]));
writeFileSync(
  "src/lib/bearded-icons.json",
  JSON.stringify({
    file: file(theme.file),
    folder: file(theme.folder),
    folderExpanded: file(theme.folderExpanded),
    fileExtensions: map(theme.fileExtensions),
    fileNames: map(theme.fileNames),
    languageIds: map(theme.languageIds),
    folderNames: map(theme.folderNames ?? {}),
    folderNamesExpanded: map(theme.folderNamesExpanded ?? {}),
  })
);
