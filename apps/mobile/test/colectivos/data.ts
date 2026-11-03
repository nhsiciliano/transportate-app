// Estático mínimo de colectivos, validado con los contratos: paradas cerca del Obelisco, una en
// Palermo y una fuera de CABA; líneas con ramales (60, 152, 10) y una sin número (EBUS).
import { LineasColectivoArchivoV1, ParadasArchivoV1, type ParadaV1 } from '@transportate/contracts';

const parada = (
  id: string,
  calle: string,
  altura: number | null,
  lat: number,
  lon: number,
  numeros: (number | string)[],
  barrio: string | null = 'San Nicolás',
): ParadaV1 => ({
  id,
  calle,
  altura,
  nombre: altura === null ? calle : `${calle} ${String(altura)}`,
  lat,
  lon,
  comuna: 1,
  barrio,
  lineas: numeros.map((n) => ({
    linea: String(n),
    numero: typeof n === 'number' ? n : null,
    sentido: 'ida' as const,
  })),
});

/** El Obelisco (posición por defecto del mock de expo-location). */
export const OBELISCO = { lat: -34.6037, lon: -58.3816 };

export const paradasArchivo = ParadasArchivoV1.parse({
  version: 1,
  fuente: 'prueba',
  paradas: [
    // ~110 m del Obelisco.
    parada('p-corrientes', 'Av. Corrientes', 1000, -34.6035, -58.3804, [60, 152, 10]),
    // ~330 m.
    parada('p-9dejulio', 'Av. 9 de Julio', 500, -34.6067, -58.3812, [10, 'EBUS']),
    // ~2,7 km: fuera del radio de 1,5 km.
    parada('p-plazaitalia', 'Av. Santa Fe', 3900, -34.5812, -58.4208, [152], 'Palermo'),
    // La parada de los tests de Favoritos (low-dev).
    parada('9002', 'Av. Rivadavia y Acoyte', null, -34.6185, -58.4366, [1, 25, 132], 'Caballito'),
    // Fuera de CABA (La Plata).
    parada('p-laplata', 'Calle 7', 800, -34.9205, -57.9536, [60], null),
  ],
});

export const lineasArchivo = LineasColectivoArchivoV1.parse({
  version: 1,
  fuente: 'prueba',
  nota: 'semilla',
  capturadoEn: '2026-11-01',
  lineas: [
    {
      lineaId: '601',
      linea: '60 A',
      ramal: 'A',
      empresa: 'MOCBA',
      cabeceras: ['a Constitución'],
      numero: 60,
      agencyId: '1',
      enCaba: true,
    },
    {
      lineaId: '602',
      linea: '60 B',
      ramal: 'B',
      empresa: 'MOCBA',
      cabeceras: ['a Escobar'],
      numero: 60,
      agencyId: '1',
      enCaba: true,
    },
    {
      lineaId: '1521',
      linea: '152',
      empresa: 'TALP',
      cabeceras: ['a Olivos'],
      numero: 152,
      agencyId: '2',
      enCaba: true,
    },
    {
      lineaId: '101',
      linea: '10',
      empresa: 'Empresa Diez',
      cabeceras: ['a Palermo'],
      numero: 10,
      agencyId: '3',
      enCaba: true,
    },
    {
      lineaId: '1600',
      linea: '160',
      empresa: 'Otra',
      cabeceras: ['a Pompeya'],
      numero: 160,
      agencyId: '4',
      enCaba: true,
    },
    {
      lineaId: '9001',
      linea: 'EBUS',
      empresa: 'Metrobús',
      cabeceras: ['a Retiro'],
      numero: null,
      agencyId: '5',
      enCaba: true,
    },
  ],
});

/** Cuerpos tal cual los manda el proxy (texto). */
export const ARCHIVOS_TEXTO: Record<string, string> = {
  'paradas.json': JSON.stringify(paradasArchivo),
  'lineas-colectivos.json': JSON.stringify(lineasArchivo),
};
