"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EndpointInfo } from "@/components/endpoint-info";
import type { AppConfig } from "@/lib/app-config";
import type { Template } from "@/lib/templates";

export function ConfigPanel({ template, config, onChange, disabled, previewUrl, redirectUri }: {
  template: Template;
  config: AppConfig;
  onChange: (c: AppConfig) => void;
  disabled: boolean;
  previewUrl: string | null;
  redirectUri: string | null;
}) {
  const setExtra = (i: number, patch: Partial<AppConfig["extra"][number]>) =>
    onChange({ ...config, extra: config.extra.map((e, j) => (j === i ? { ...e, ...patch } : e)) });

  return (
    <div className="space-y-4 p-3">
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Okta settings</h3>
        {template.env.map((e) => (
          <div key={e.key} className="space-y-1">
            <Label htmlFor={e.key} className="text-xs">{e.label}</Label>
            <Input
              id={e.key}
              type={e.secret ? "password" : "text"}
              placeholder={e.placeholder}
              value={config.env[e.key] ?? ""}
              disabled={disabled}
              onChange={(ev) => onChange({ ...config, env: { ...config.env, [e.key]: ev.target.value } })}
            />
            {e.secret && <p className="text-[11px] text-muted-foreground">Kept in memory only, never saved.</p>}
          </div>
        ))}
      </section>
      <section className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Router base path</h3>
        <Input
          placeholder="Auto-detect (Mimic preview path)"
          value={config.basePath}
          disabled={disabled}
          onChange={(e) => onChange({ ...config, basePath: e.target.value })}
        />
        <p className="text-[11px] text-muted-foreground">
          Mimic chooses the URL the app is served from. This value is only used when the page URL starts with it; otherwise the app uses the Mimic path automatically.
        </p>
      </section>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Extra env vars</h3>
          <Button size="icon-xs" variant="ghost" disabled={disabled}
            onClick={() => onChange({ ...config, extra: [...config.extra, { key: "", value: "" }] })}>
            <Plus />
          </Button>
        </div>
        {config.extra.map((x, i) => (
          <div key={i} className="flex gap-1">
            <Input placeholder="KEY" value={x.key} disabled={disabled} onChange={(e) => setExtra(i, { key: e.target.value })} />
            <Input placeholder="value" value={x.value} disabled={disabled} onChange={(e) => setExtra(i, { value: e.target.value })} />
            <Button size="icon" variant="ghost" disabled={disabled}
              onClick={() => onChange({ ...config, extra: config.extra.filter((_, j) => j !== i) })}>
              <Trash2 />
            </Button>
          </div>
        ))}
      </section>
      <EndpointInfo previewUrl={previewUrl} redirectUri={redirectUri} />
    </div>
  );
}
