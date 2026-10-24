"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, ExternalLink, FolderTree, Loader2, Maximize2, Minimize2, Play, RefreshCw, RotateCcw, RotateCw, Settings2, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CodeEditor } from "@/components/code-editor";
import { ConfigPanel } from "@/components/config-panel";
import { FileIcon } from "@/components/file-icon";
import { FileTree } from "@/components/file-tree";
import { bootMimic } from "@/lib/mimic";
import { clearEdits, loadSession, saveEdits, saveSession, withEdits } from "@/lib/session";
import { cacheKey, getCached, putCached } from "@/lib/dep-cache";
import { toNodes, toTree } from "@/lib/files";
import { loadConfig, saveConfig, toEnv, type AppConfig } from "@/lib/app-config";
import { cn } from "@/lib/utils";
import type { Template } from "@/lib/templates";

type Container = Awaited<ReturnType<typeof bootMimic>>;
type Status = "idle" | "booting" | "mounting" | "installing" | "starting" | "running" | "error";

const STEPS: { key: Status; label: string }[] = [
  { key: "booting", label: "Boot container" },
  { key: "mounting", label: "Write project files" },
  { key: "installing", label: "Install dependencies" },
  { key: "starting", label: "Start dev server" },
];
type Panel = "files" | "config";
type ConsoleEntry = { level: "log" | "info" | "warn" | "error" | "debug"; text: string };


const dec = new TextDecoder();

export function Workbench({ templates }: { templates: Template[] }) {
  const [id, setId] = useState(templates[0].id);
  const template = templates.find((t) => t.id === id)!;

  const [files, setFiles] = useState<Record<string, string>>(template.files);
  const [open, setOpen] = useState<string[]>([template.entry]);
  const [active, setActive] = useState(template.entry);
  const [config, setConfig] = useState<AppConfig>({ env: {}, extra: [], basePath: "" });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panel, setPanel] = useState<Panel>("config");
  const [status, setStatus] = useState<Status>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [packages, setPackages] = useState(0);
  const [previewKey, setPreviewKey] = useState(0);
  const [showCode, setShowCode] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [showConsole, setShowConsole] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([]);
  const [autoStart, setAutoStart] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const container = useRef<Container | null>(null);
  const logEnd = useRef<HTMLDivElement>(null);
  const idle = status === "idle" || status === "error";

  // Switching templates resets the project and loads that app's saved config.
  function selectTemplate(next: string) {
    const t = templates.find((x) => x.id === next)!;
    setId(next);
    saveSession({ templateId: next });
    setFiles(withEdits(next, t.files));
    setOpen([t.entry]);
    setActive(t.entry);
    setConfig(loadConfig(next));
    setLogs("");
  }

  // localStorage is client-only, so the saved session loads after mount and may resume the app.
  useEffect(() => {
    const saved = loadSession();
    const t = templates.find((x) => x.id === saved.templateId) ?? templates[0];
    /* eslint-disable react-hooks/set-state-in-effect */
    setId(t.id);
    setFiles(withEdits(t.id, t.files));
    setOpen([t.entry]);
    setActive(t.entry);
    setConfig(loadConfig(t.id));
    setAutoStart(saved.autoStart);
    setAutoRun(saved.autoStart && saved.wasRunning);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [templates]);
  // Resume after a reload, once the restored files and config have rendered.
  useEffect(() => {
    if (!autoRun) return;
    setAutoRun(false); // eslint-disable-line react-hooks/set-state-in-effect
    if (template.env.some((e) => !config.env[e.key])) {
      append("Auto-start skipped: fill in the Okta settings (secrets are not saved), then press Run.\n");
      return;
    }
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun]);
  // The container lives in this tab's memory: a reload or close stops every server in it.
  useEffect(() => {
    if (status === "idle" || status === "error") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);
  // While installing, tick a timer and count packages written to node_modules.
  useEffect(() => {
    if (status !== "installing") return;
    const started = Date.now();
    const tick = setInterval(async () => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
      const c = container.current;
      if (!c) return;
      try {
        const names = (await c.fs.readdir("node_modules")) as string[];
        let n = 0;
        for (const name of names) {
          if (name.startsWith(".")) continue;
          n += name.startsWith("@") ? ((await c.fs.readdir(`node_modules/${name}`)) as string[]).length : 1;
        }
        setPackages(n);
      } catch {
        // node_modules does not exist until npm starts writing
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [status]);
  useEffect(() => {
    logEnd.current?.scrollIntoView();
  }, [logs]);

  // Secrets stay in memory; everything else persists per app.
  function updateConfig(next: AppConfig) {
    setConfig(next);
    const secrets = new Set(template.env.filter((e) => e.secret).map((e) => e.key));
    const env = Object.fromEntries(Object.entries(next.env).filter(([k]) => !secrets.has(k)));
    saveConfig(id, { ...next, env });
  }

  const append = (s: string) => setLogs((l) => (l + s).slice(-30000));
  const pipe = (p: { stdout: ReadableStream<Uint8Array>; stderr: ReadableStream<Uint8Array> }) => {
    const sink = () => new WritableStream<Uint8Array>({ write: (c) => append(dec.decode(c)) });
    p.stdout.pipeTo(sink());
    p.stderr.pipeTo(sink());
  };

  async function stop() {
    saveSession({ wasRunning: false });
    await container.current?.teardown();
    container.current = null;
    setUrl(null);
    setStatus("idle");
  }

  async function start() {
    saveSession({ wasRunning: true });
    setLogs("");
    setConsoleLogs([]);
    setElapsed(0);
    setPackages(0);
    setStatus("booting");
    try {
      const c = await bootMimic();
      container.current = c;
      setStatus("mounting");
      await c.fs.mount(toTree(files));
      c.endpoints.on("published", (e) => {
        setUrl(e.url);
        setStatus("running");
      });
      setStatus("installing");
      // Restore node_modules from a previous run with the same package.json.
      const key = await cacheKey(files["package.json"] ?? "");
      let restored = false;
      try {
        const cached = await getCached(key);
        if (cached) {
          append("Restoring cached node_modules…\n");
          await c.fs.mount(cached, { mountPoint: "node_modules" });
          restored = true;
        }
      } catch (e) {
        append(`Cache restore failed, installing normally: ${String(e)}\n`);
      }
      // loglevel http prints every registry request, so the terminal shows progress.
      const install = await c.spawn("npm", ["install", "--no-audit", "--no-fund", "--loglevel", "http"]);
      pipe(install);
      if ((await install.exit) !== 0) throw new Error("npm install failed");
      if (!restored) {
        try {
          await putCached(key, (await c.fs.export("node_modules", { format: "tar" })) as Uint8Array);
        } catch (e) {
          append(`Could not cache node_modules: ${String(e)}\n`);
        }
      }
      setStatus("starting");
      const env = { ...toEnv(config), PORT: String(template.port), HOST: "0.0.0.0" };
      pipe(await c.spawn("npm", ["start"], { env }));
    } catch (e) {
      append(`\n${String(e)}\n`);
      setStatus("error");
    }
  }

  async function restart() {
    await stop();
    await start();
  }

  // Edits reach the running container so dev servers can hot-reload.
  const pending = useRef<ReturnType<typeof setTimeout>>(undefined);
  function edit(path: string, value: string) {
    setFiles((f) => ({ ...f, [path]: value }));
    clearTimeout(pending.current);
    pending.current = setTimeout(() => {
      saveEdits(id, template.files, { ...files, [path]: value });
      container.current?.fs.writeFile(path, value).catch(() => {});
    }, 300);
  }

  function downloadLogs() {
    const text = logs.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = `${id}-terminal-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // The preview is same-origin with the workbench, so its console can be wrapped from here.
  // Hooks go in on each load, so output before the page finishes loading is not captured.
  function captureConsole(frame: HTMLIFrameElement) {
    try {
      const w = frame.contentWindow as (Window & { console: Console; __captured?: boolean }) | null;
      if (!w || w.__captured) return;
      w.__captured = true;
      const add = (level: ConsoleEntry["level"], args: unknown[]) =>
        setConsoleLogs((l) => [...l, { level, text: args.map(format).join(" ") }].slice(-500));
      for (const level of ["log", "info", "warn", "error", "debug"] as const) {
        const orig = w.console[level].bind(w.console);
        w.console[level] = (...args: unknown[]) => {
          add(level, args);
          orig(...args);
        };
      }
      w.addEventListener("error", (e) => add("error", [e.message]));
      w.addEventListener("unhandledrejection", (e) => add("error", ["Unhandled rejection:", e.reason]));
    } catch {
      setConsoleLogs((l) => [...l, { level: "warn", text: "Preview console is not accessible from here." }]);
    }
  }

  function resetFiles() {
    clearEdits(id);
    setFiles(template.files);
    setOpen([template.entry]);
    setActive(template.entry);
  }

  function openFile(path: string) {
    setOpen((o) => (o.includes(path) ? o : [...o, path]));
    setActive(path);
  }

  function closeFile(path: string) {
    const rest = open.filter((p) => p !== path);
    setOpen(rest);
    if (active === path) setActive(rest[rest.length - 1] ?? "");
  }

  const nodes = useMemo(() => toNodes(Object.keys(files)), [files]);
  // Mimic serves the app under a path prefix, so the callback path is joined to that prefix.
  const redirectUri = url ? new URL(template.redirectPath.replace(/^\//, ""), url.endsWith("/") ? url : `${url}/`).href : null;
  const missing = template.env.some((e) => !config.env[e.key]);

  // Code and preview are both shown by default; either can be hidden, or expanded to fill the area.
  const editorVisible = showCode;
  const previewVisible = showPreview;
  const bottomVisible = showTerminal || showConsole;
  const bottomTools = [showTerminal && "terminal", showConsole && "console"].filter(Boolean) as string[];

  const expanded = showCode && !showPreview ? "code" : showPreview && !showCode ? "preview" : null;
  // Expand hides the other pane; Restore brings both back.
  const expandButton = (pane: "code" | "preview") => (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={expanded === pane ? "Restore" : "Expand"}
            onClick={() => {
              if (expanded === pane) { setShowCode(true); setShowPreview(true); }
              else { setShowCode(pane === "code"); setShowPreview(pane === "preview"); }
            }}
          />
        }
      >
        {expanded === pane ? <Minimize2 /> : <Maximize2 />}
      </TooltipTrigger>
      <TooltipContent>{expanded === pane ? "Restore" : `Expand ${pane}`}</TooltipContent>
    </Tooltip>
  );

  const editor = (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex shrink-0 items-center border-b">
      <Tabs value={active} onValueChange={(v) => setActive(String(v))} className="min-w-0 flex-1 gap-0">
        <TabsList variant="line" className="h-9 w-full justify-start overflow-x-auto overflow-y-hidden rounded-none p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {open.map((p) => (
            <TabsTrigger key={p} value={p} className="h-full gap-2 rounded-none group-data-horizontal/tabs:after:bottom-0">
              <FileIcon name={p.split("/").pop()!} />
              {p.split("/").pop()}
              <span
                role="button"
                aria-label={`Close ${p}`}
                className="rounded-sm hover:bg-accent"
                onClick={(e) => { e.stopPropagation(); closeFile(p); }}
              >
                <X className="size-3" />
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {expandButton("code")}
      </div>
      <div className="min-h-0 flex-1">
        {active ? (
          <CodeEditor path={active} value={files[active] ?? ""} onChange={(v) => edit(active, v)} />
        ) : (
          <p className="p-6 text-sm text-muted-foreground">Open a file from the explorer.</p>
        )}
      </div>
    </div>
  );

  const preview = (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b px-3 text-sm">
        <span className="truncate text-muted-foreground">{url ?? "Preview"}</span>
        <div className="flex shrink-0 items-center">
          <Button variant="ghost" size="sm" disabled={!url} onClick={() => setPreviewKey((k) => k + 1)}>
            <RefreshCw /> Refresh
          </Button>
          <Button variant="ghost" size="sm" disabled={!url} onClick={() => window.open(url!, "_blank", "noopener")}>
            <ExternalLink /> Open in new tab
          </Button>
          {expandButton("preview")}
        </div>
      </div>
      {url ? (
        <iframe key={previewKey} onLoad={(e) => captureConsole(e.currentTarget)} src={url} title="preview" className="min-h-0 flex-1 bg-white" />
      ) : (
        <Progress status={status} elapsed={elapsed} packages={packages} />
      )}
    </div>
  );

  const empty = (
    <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
      Show the code or preview pane from the toggles below.
    </div>
  );

  const top = editorVisible && previewVisible ? (
    <ResizablePanelGroup key="both" orientation="horizontal">
      <ResizablePanel id="editor" defaultSize="60%" minSize="20%">{editor}</ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel id="preview" defaultSize="40%" minSize="20%">{preview}</ResizablePanel>
    </ResizablePanelGroup>
  ) : editorVisible ? editor : previewVisible ? preview : empty;

  const terminal = (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex h-8 shrink-0 items-center justify-between border-b px-3 text-xs font-medium text-muted-foreground">
        Terminal
        <Tooltip>
          <TooltipTrigger render={<Button size="icon-xs" variant="ghost" aria-label="Download terminal logs" disabled={!logs} onClick={downloadLogs} />}>
            <Download />
          </TooltipTrigger>
          <TooltipContent>Download logs</TooltipContent>
        </Tooltip>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <pre className="p-3 font-mono text-xs whitespace-pre-wrap">
          {logs || "No output yet"}
          <div ref={logEnd} />
        </pre>
      </ScrollArea>
    </div>
  );

  const consolePane = (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex h-8 shrink-0 items-center justify-between border-b px-3 text-xs font-medium text-muted-foreground">
        Preview console
        <Button size="xs" variant="ghost" onClick={() => setConsoleLogs([])}>Clear</Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="font-mono text-xs">
          {consoleLogs.length === 0 && <p className="p-3 text-muted-foreground">No console output yet</p>}
          {consoleLogs.map((l, i) => (
            <div key={i} className={cn("border-b px-3 py-1 whitespace-pre-wrap", l.level === "error" && "bg-destructive/10 text-destructive", l.level === "warn" && "bg-yellow-500/10 text-yellow-600")}>
              {l.text}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  const bottom = showTerminal && showConsole ? (
    <ResizablePanelGroup key="logs" orientation="horizontal">
      <ResizablePanel id="terminal" defaultSize="50%" minSize="20%">{terminal}</ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel id="console" defaultSize="50%" minSize="20%">{consolePane}</ResizablePanel>
    </ResizablePanelGroup>
  ) : showTerminal ? terminal : consolePane;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <span className="font-semibold">SandCastle</span>
        <Select value={id} onValueChange={(v) => v && selectTemplate(v)} disabled={!idle}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="secondary">{status}</Badge>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex items-center gap-2">
          <Switch
            id="resume"
            size="sm"
            checked={autoStart}
            onCheckedChange={(v) => { setAutoStart(v); saveSession({ autoStart: v }); }}
          />
          <Label htmlFor="resume" className="text-xs text-muted-foreground" title="After a reload, restore your files and start the app again if it was running">
            Resume on reload
          </Label>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {status === "running" && (
            <Button variant="outline" size="sm" onClick={restart}><RotateCw /> Restart</Button>
          )}
          {idle ? (
            <Button size="sm" onClick={start} disabled={missing} title={missing ? "Fill in the Okta settings first" : undefined}>
              <Play /> Run
            </Button>
          ) : (
            <Button size="sm" variant="destructive" onClick={stop}><Square /> Stop</Button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-12 shrink-0 flex-col items-center border-r py-2">
          {/* The active icon is pressed while the panel is open; pressing it again collapses the panel. */}
          <ToggleGroup
            orientation="vertical"
            value={sidebarOpen ? [panel] : []}
            onValueChange={(v) => {
              if (v[0]) {
                setPanel(v[0] as Panel);
                setSidebarOpen(true);
              } else {
                setSidebarOpen(false);
              }
            }}
          >
            {([["files", "Explorer", FolderTree], ["config", "App configuration", Settings2]] as const).map(([key, label, Icon]) => (
              <Tooltip key={key}>
                <TooltipTrigger render={<ToggleGroupItem value={key} aria-label={label} />}>
                  <Icon />
                </TooltipTrigger>
                <TooltipContent side="right">{sidebarOpen && panel === key ? `Hide ${label}` : label}</TooltipContent>
              </Tooltip>
            ))}
          </ToggleGroup>
        </nav>

        {sidebarOpen && (
          <aside className="flex w-72 shrink-0 flex-col border-r">
            <div className="flex h-9 shrink-0 items-center justify-between border-b px-3 text-xs font-medium text-muted-foreground">
              {panel === "files" ? "Explorer" : "App configuration"}
              {panel === "files" && (
                <Tooltip>
                  <TooltipTrigger render={<Button variant="ghost" size="icon-xs" aria-label="Reset files to the template" disabled={!idle} onClick={resetFiles} />}>
                    <RotateCcw />
                  </TooltipTrigger>
                  <TooltipContent>Reset files to the template</TooltipContent>
                </Tooltip>
              )}
            </div>
            <ScrollArea className="min-h-0 flex-1">
              {panel === "files" ? (
                <FileTree nodes={nodes} active={active} onOpen={openFile} />
              ) : (
                <ConfigPanel template={template} config={config} onChange={updateConfig} disabled={!idle} previewUrl={url} redirectUri={redirectUri} />
              )}
            </ScrollArea>
          </aside>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            {bottomVisible ? (
              <ResizablePanelGroup key={`main-${bottomTools.join("-")}`} orientation="vertical">
                <ResizablePanel id="top" defaultSize="70%" minSize="20%">{top}</ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel id="bottom" defaultSize="30%" minSize="10%">{bottom}</ResizablePanel>
              </ResizablePanelGroup>
            ) : (
              top
            )}
          </div>
          <div className="flex h-9 shrink-0 items-center gap-2 border-t px-2">
            <ToggleGroup
              multiple
              size="sm"
              value={[showCode && "code", showPreview && "preview"].filter(Boolean) as string[]}
              onValueChange={(v) => {
                // At least one pane stays visible.
                if (v.length === 0) return;
                setShowCode(v.includes("code"));
                setShowPreview(v.includes("preview"));
              }}
            >
              <ToggleGroupItem value="code">Code</ToggleGroupItem>
              <ToggleGroupItem value="preview">Preview</ToggleGroupItem>
            </ToggleGroup>
            <Separator orientation="vertical" className="h-5" />
            <ToggleGroup
              multiple
              size="sm"
              value={bottomTools}
              onValueChange={(v) => {
                setShowTerminal(v.includes("terminal"));
                setShowConsole(v.includes("console"));
              }}
            >
              <ToggleGroupItem value="terminal">Terminal</ToggleGroupItem>
              <ToggleGroupItem value="console">
                Preview console{consoleLogs.length > 0 && ` (${consoleLogs.length})`}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </main>
      </div>
    </div>
  );
}

function Progress({ status, elapsed, packages }: { status: Status; elapsed: number; packages: number }) {
  const current = STEPS.findIndex((x) => x.key === status);
  if (current < 0) {
    return <p className="p-6 text-sm text-muted-foreground">Run the app to see a preview.</p>;
  }
  return (
    <ol className="space-y-3 p-6 text-sm">
      {STEPS.map((step, i) => (
        <li key={step.key} className={cn("flex items-center gap-2", i > current && "text-muted-foreground")}>
          {i < current ? <Check className="size-4 text-green-500" /> : i === current ? <Loader2 className="size-4 animate-spin" /> : <span className="size-4" />}
          <span>{step.label}</span>
          {step.key === "installing" && i <= current && (
            <span className="text-xs text-muted-foreground">
              {packages > 0 ? `${packages} packages` : "resolving…"}
              {i === current && ` · ${elapsed}s`}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function format(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Error) return v.stack ?? v.message;
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
}
