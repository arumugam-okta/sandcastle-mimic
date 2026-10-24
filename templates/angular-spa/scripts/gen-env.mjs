// Angular's build does not read .env, so turn it into a TS file before `ng serve`.
// (Okta settings are injected as environment variables by the container runtime.)
import fs from 'node:fs';

const env = {
  issuer: process.env.OKTA_ISSUER ?? '',
  clientId: process.env.OKTA_CLIENT_ID ?? '',
};
fs.writeFileSync(
  new URL('../src/env.generated.ts', import.meta.url),
  `// generated from .env by scripts/gen-env.mjs — do not edit\nexport const env = ${JSON.stringify(env, null, 2)};\n`
);


// Hand the configured base path to index.html, which only uses it when the page is served under it.
const base = (process.env.BASE_PATH ?? '').replace(/\/$/, '');
const html = new URL('../src/index.html', import.meta.url);
fs.writeFileSync(html, fs.readFileSync(html, 'utf8').replace(/data-base-path="[^"]*"/, `data-base-path="${base}"`));
