// Migraciones del documento de favoritos: `schemaVersion` N → función que devuelve el documento
// en la versión N + 1. Se aplican en cadena hasta `FAVORITOS_SCHEMA_VERSION` y el resultado se
// valida con `FavoritosDocV1Schema`. Un documento sin `schemaVersion` cuenta como versión 0.
//
// Hoy no hay migraciones: la v1 es la primera versión publicada. Al cambiar el formato:
// 1. subir `FAVORITOS_SCHEMA_VERSION` y crear el esquema nuevo en `model.ts`;
// 2. agregar acá `[versiónVieja]: (doc) => docEnLaVersiónSiguiente`;
// 3. sumar un test con un documento real de la versión vieja.
import { FAVORITOS_SCHEMA_VERSION } from './model';

export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;
export type Migrations = Readonly<Partial<Record<number, Migration>>>;

export const favoritosMigrations: Migrations = {};

export type MigrationResult =
  { ok: true; doc: Record<string, unknown> } | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Lleva `doc` a la versión actual. No valida el resultado: eso lo hace quien llama. */
export function migrateFavoritosDoc(
  doc: unknown,
  migrations: Migrations = favoritosMigrations,
  target: number = FAVORITOS_SCHEMA_VERSION,
): MigrationResult {
  if (!isRecord(doc)) return { ok: false, reason: 'el documento no es un objeto' };
  let current = doc;
  let version = typeof current.schemaVersion === 'number' ? current.schemaVersion : 0;
  if (version > target)
    return { ok: false, reason: `versión ${String(version)} más nueva que la app` };
  while (version < target) {
    const migrate = migrations[version];
    if (!migrate) return { ok: false, reason: `sin migrador desde la versión ${String(version)}` };
    current = { ...migrate(current), schemaVersion: version + 1 };
    version += 1;
  }
  return { ok: true, doc: current };
}
