"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function CopyField({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1">
        <Input readOnly value={value ?? ""} placeholder="Available once the app is running" className="font-mono text-xs" />
        <Button size="icon" variant="outline" aria-label={`Copy ${label}`} disabled={!value} onClick={copy}>
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** URLs Mimic assigned to the running app, as Okta needs them. */
export function EndpointInfo({ previewUrl, redirectUri }: { previewUrl: string | null; redirectUri: string | null }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mimic URLs</h3>
      <CopyField label="Preview URL" value={previewUrl} />
      <CopyField
        label="Sign-in redirect URI"
        value={redirectUri}
        hint="Register this on your test-tenant app. It changes every time the app boots."
      />
      <CopyField
        label="Trusted origin (CORS and redirect)"
        value={previewUrl ? new URL(previewUrl).origin : null}
        hint="Add under Security > API > Trusted Origins for the SPA samples."
      />
    </section>
  );
}
