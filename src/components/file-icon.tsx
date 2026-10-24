import icons from "@/lib/bearded-icons.json";

// Bearded Icons (GPL-3.0), vendored by scripts/vendor-bearded-icons.mjs.
const t = icons as {
  file: string;
  folder: string;
  folderExpanded: string;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  languageIds: Record<string, string>;
  folderNames: Record<string, string>;
  folderNamesExpanded: Record<string, string>;
};

// The theme resolves these through VS Code language ids rather than extensions.
const LANGUAGE_BY_EXT: Record<string, string> = {
  json: "json", ts: "typescript", tsx: "typescriptreact", js: "javascript", mjs: "javascript",
  cjs: "javascript", jsx: "javascriptreact", html: "html", css: "css", md: "markdown",
  yml: "yaml", yaml: "yaml", sh: "shellscript",
};

function fileIcon(name: string) {
  const lower = name.toLowerCase();
  if (t.fileNames[lower]) return t.fileNames[lower];
  // Longest matching extension wins (d.ts before ts).
  const parts = lower.split(".");
  for (let i = 1; i < parts.length; i++) {
    const hit = t.fileExtensions[parts.slice(i).join(".")];
    if (hit) return hit;
  }
  const lang = LANGUAGE_BY_EXT[parts[parts.length - 1]];
  return (lang && t.languageIds[lang]) || t.file;
}

function folderIcon(name: string, open: boolean) {
  const lower = name.toLowerCase();
  return (open ? t.folderNamesExpanded[lower] : t.folderNames[lower]) ?? (open ? t.folderExpanded : t.folder);
}

export function FileIcon({ name, folder, open = false }: { name: string; folder?: boolean; open?: boolean }) {
  const icon = folder ? folderIcon(name, open) : fileIcon(name);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/bearded-icons/${icon}.svg`} alt="" width={16} height={16} className="size-4 shrink-0" />;
}
