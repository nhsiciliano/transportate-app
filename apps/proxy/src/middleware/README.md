# middleware

- `errors.ts`: manejador global que responde el sobre `ErrorV1` sin stack ni URLs.
- `envelope.ts`: `sendEnvelope()` con Cache-Control por TTL, ETag débil, 304 y headers `X-Transportate-*`.
- `rate-limit.ts`: binding `RATE_LIMITER` con clave hasheada; excluye health y estáticos.
- `adapters.ts`: arma los adaptadores por request y los deja en `c.var`.
