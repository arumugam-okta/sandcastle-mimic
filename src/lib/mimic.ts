import type { Mimic } from "@mimic-js/runtime";

type MimicModule = { Mimic: typeof Mimic };

// Loaded from /public at runtime: Mimic finds its worker assets relative to
// its own entry URL, so it must not be bundled. No previewOrigin: endpoints are
// served from this origin under /mimic/assets/__mimic__/<id>/..., which a new
// tab reaches through the service worker the container registered here.
export async function bootMimic() {
  const mod: MimicModule = await import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ "/mimic/mimic.js" as string
  );
  return mod.Mimic.boot();
}
