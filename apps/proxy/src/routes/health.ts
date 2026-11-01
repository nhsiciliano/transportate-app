import type { HealthV1 } from '@transportate/contracts';
import { Hono } from 'hono';
import { PROXY_VERSION } from '../lib/version';
import type { AppEnv } from '../app';

export const health = new Hono<AppEnv>().get('/', (c) => {
  c.header('Cache-Control', 'no-store');
  const body: HealthV1 = { ok: true, version: PROXY_VERSION, environment: c.env.ENVIRONMENT };
  return c.json(body);
});
