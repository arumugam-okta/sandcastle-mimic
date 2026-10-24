import type { FileSystemTree } from "@mimic-js/runtime";

export function toTree(files: Record<string, string>): FileSystemTree {
  const root: FileSystemTree = {};
  for (const [file, contents] of Object.entries(files)) {
    const parts = file.split("/");
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      const node = (dir[part] ??= { directory: {} });
      dir = (node as { directory: FileSystemTree }).directory;
    }
    dir[parts[parts.length - 1]] = { file: { contents } };
  }
  return root;
}

export type TreeNode = { name: string; path: string; children?: TreeNode[] };

export function toNodes(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", children: [] };
  for (const p of paths.sort()) {
    let cur = root;
    p.split("/").forEach((name, i, arr) => {
      const full = arr.slice(0, i + 1).join("/");
      const isFile = i === arr.length - 1;
      let next = cur.children!.find((c) => c.name === name);
      if (!next) {
        next = isFile ? { name, path: full } : { name, path: full, children: [] };
        cur.children!.push(next);
      }
      cur = next;
    });
  }
  const order = (n: TreeNode) => {
    n.children?.sort((a, b) => Number(!!b.children) - Number(!!a.children) || a.name.localeCompare(b.name));
    n.children?.forEach(order);
  };
  order(root);
  return root.children!;
}

const LANGS: Record<string, string> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", json: "json", html: "html",
  css: "css", md: "markdown",
};

export const languageOf = (p: string) => LANGS[p.split(".").pop() ?? ""] ?? "plaintext";
