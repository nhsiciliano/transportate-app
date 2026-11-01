// Secrets que no figuran en wrangler.jsonc (van por `.dev.vars` o `wrangler secret put`).
// Se suman por declaration merging a la interfaz generada por `wrangler types`.
interface CloudflareBindings {
  GCBA_CLIENT_ID: string;
  GCBA_CLIENT_SECRET: string;
}
