// indice-colectivos.json: lo único que el proxy necesita para posiciones y arribos, compacto y ya
// indexado, para no parsear paradas.json (1,7 MB) ni equivalencias en el Worker. Medido en workerd:
// el índice completo costaba ~27 ms de CPU en frío y el plan Free da 10 ms
// (apps/proxy/src/adapters/README.md). Contrato: IndiceColectivosArchivoV1.
import type { IndiceColectivosArchivoV1 } from '@transportate/contracts';
import type { EquivalenciaPublicada, LineaColectivo, Parada } from '../schemas.js';

export interface IndiceStats {
  paradas: number;
  paradasConStopIds: number;
  stopIds: number;
  numeros: number;
}

export function buildIndice(
  paradas: Parada[],
  lineas: LineaColectivo[],
  equivalencias: EquivalenciaPublicada[],
): { indice: IndiceColectivosArchivoV1; stats: IndiceStats } {
  // Número → lineaIds con vehículos en CABA (las paradas BA son todas de CABA).
  const porNumero = new Map<number, string[]>();
  for (const l of lineas) {
    if (l.numero === null || !l.enCaba) continue;
    const list = porNumero.get(l.numero) ?? [];
    list.push(l.lineaId);
    porNumero.set(l.numero, list);
  }
  const stopsPorParada = new Map<string, string[]>();
  for (const e of equivalencias) {
    const list = stopsPorParada.get(e.paradaId) ?? [];
    list.push(e.stopId);
    stopsPorParada.set(e.paradaId, list);
  }
  const numerosUsados = new Set<number>();
  const out: IndiceColectivosArchivoV1['paradas'] = {};
  for (const p of paradas) {
    const numeros = [
      ...new Set(p.lineas.map((l) => l.numero).filter((n): n is number => n !== null)),
    ].sort((a, b) => a - b);
    for (const n of numeros) numerosUsados.add(n);
    out[p.id] = [(stopsPorParada.get(p.id) ?? []).sort(), numeros];
  }
  const lineasPorNumero: IndiceColectivosArchivoV1['lineasPorNumero'] = {};
  for (const n of [...numerosUsados].sort((a, b) => a - b)) {
    const ids = porNumero.get(n);
    if (ids?.length) {
      lineasPorNumero[String(n)] = [...ids].sort((a, b) =>
        a.localeCompare(b, 'en', { numeric: true }),
      );
    }
  }
  return {
    indice: { version: 1, lineasPorNumero, paradas: out },
    stats: {
      paradas: paradas.length,
      paradasConStopIds: [...stopsPorParada.keys()].length,
      stopIds: equivalencias.length,
      numeros: Object.keys(lineasPorNumero).length,
    },
  };
}
