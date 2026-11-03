// Licencias de software de terceros: el JSON lo genera `scripts/licencias.mjs` (`pnpm licencias`)
// y se valida al cargar, así un archivo mal generado falla con un mensaje claro en vez de
// romper la pantalla.
import { z } from 'zod';

import raw from './licencias.json';

export const LicenciaPaqueteSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  license: z.string().min(1),
  repository: z.string().nullable(),
  /** Ausente si el JSON se generó sin textos (pasó los 300 KB) o el paquete no trae archivo. */
  text: z.string().nullable().optional(),
});
export type LicenciaPaquete = z.infer<typeof LicenciaPaqueteSchema>;

const LicenciasFileSchema = z.object({ paquetes: z.array(LicenciaPaqueteSchema) });

export const licencias: readonly LicenciaPaquete[] = LicenciasFileSchema.parse(raw).paquetes;
