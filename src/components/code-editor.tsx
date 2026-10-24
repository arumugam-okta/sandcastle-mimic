"use client";

import Editor, { loader, type BeforeMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { languageOf } from "@/lib/files";

// Same-origin copy (see scripts/copy-mimic.mjs): a CDN load is blocked by COEP.
loader.config({ paths: { vs: "/monaco/vs" } });

// Monaco's TypeScript worker cannot see the sample's node_modules (they live in the Mimic container),
// so type checking would flag every import as an error. Keep syntax errors, drop semantic ones.
const beforeMount: BeforeMount = (monaco) => {
  const ts = monaco.languages.typescript;
  const diagnostics = { noSemanticValidation: true, noSuggestionDiagnostics: true, noSyntaxValidation: false };
  ts.typescriptDefaults.setDiagnosticsOptions(diagnostics);
  ts.javascriptDefaults.setDiagnosticsOptions(diagnostics);
  const options = {
    allowJs: true,
    allowNonTsExtensions: true,
    jsx: ts.JsxEmit.Preserve,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    experimentalDecorators: true,
  };
  ts.typescriptDefaults.setCompilerOptions(options);
  ts.javascriptDefaults.setCompilerOptions(options);
};

export function CodeEditor({
  path,
  value,
  onChange,
}: {
  path: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { resolvedTheme } = useTheme();
  return (
    <Editor
      path={path}
      beforeMount={beforeMount}
      language={languageOf(path)}
      value={value}
      theme={resolvedTheme === "light" ? "vs" : "vs-dark"}
      onChange={(v) => onChange(v ?? "")}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        tabSize: 2,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
      }}
    />
  );
}
