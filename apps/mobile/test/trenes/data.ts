// Estático mínimo de trenes (las 6 líneas, 7 ramales, 15 estaciones) validado con los esquemas del
// paquete. Ids y nombres reales de SOFSE (fixtures de `apps/proxy/test/fixtures/sofse/`); colores
// de `docs/02c-colores-trenes.md`. Lo importan el harness de Trenes y el de Subtes (su manifiesto
// incluye estos archivos porque Favoritos e Inicio los leen).
import {
  TrenesEstacionesArchivoV1,
  TrenesLineasArchivoV1,
  type LineaTrenId,
} from '@transportate/contracts';

const est = (id: string, nombre: string, lineas: LineaTrenId[], ramalIds: string[]) => ({
  id,
  nombre,
  lat: -34.6,
  lon: -58.45,
  lineas,
  ramalIds,
});

export const estacionesTren = TrenesEstacionesArchivoV1.parse({
  version: 1,
  fuente: 'prueba',
  capturadoEn: '2026-11-05T11:56:14.337Z',
  estaciones: [
    est('293', 'Once', ['sarmiento'], ['1', '111']),
    est('50', 'Caballito', ['sarmiento'], ['1', '111']),
    // Flores figura en Once – Bragado pero no opera en él (brief §3).
    est('139', 'Flores', ['sarmiento'], ['1']),
    est('278', 'Moreno', ['sarmiento'], ['1']),
    est('400', 'Bragado', ['sarmiento'], ['111']),
    est('1', 'Plaza Constitución', ['roca'], ['11']),
    est('2', 'La Plata', ['roca'], ['11']),
    est('332', 'Retiro (LGM)', ['mitre'], ['5']),
    est('900', 'Tigre', ['mitre'], ['5']),
    est('331', 'Retiro (San Martín)', ['san-martin'], ['65']),
    est('901', 'Dr. Domingo Cabred', ['san-martin'], ['65']),
    est('902', 'Buenos Aires', ['belgrano-sur'], ['21']),
    est('903', 'M.C.G. Belgrano', ['belgrano-sur'], ['21']),
    est('248', 'Maipú', ['tren-de-la-costa'], ['41']),
    est('104', 'Delta', ['tren-de-la-costa'], ['41']),
  ],
});

const nombre = new Map(estacionesTren.estaciones.map((e) => [e.id, e.nombre]));

function ramal(id: string, linea: LineaTrenId, nombreSofse: string, estacionIds: string[]) {
  const ini = estacionIds[0] ?? '';
  const fin = estacionIds[estacionIds.length - 1] ?? '';
  return {
    id,
    linea,
    nombre: nombreSofse,
    cabeceraInicial: { id: ini, nombre: nombre.get(ini) ?? ini },
    cabeceraFinal: { id: fin, nombre: nombre.get(fin) ?? fin },
    electrico: true,
    estacionIds,
  };
}

const linea = (
  id: LineaTrenId,
  idGerencia: string,
  nombreLinea: string,
  color: string,
  colorTexto: string,
  ramales: ReturnType<typeof ramal>[],
) => ({ id, idGerencia, nombre: nombreLinea, color, colorTexto, ramales });

export const lineasTren = TrenesLineasArchivoV1.parse({
  version: 1,
  fuente: 'prueba',
  capturadoEn: '2026-11-05T11:56:14.337Z',
  lineas: [
    linea('roca', '11', 'Roca', '#F07D2B', '#000000', [
      ramal('11', 'roca', 'Constitución-La Plata', ['1', '2']),
    ]),
    linea('sarmiento', '1', 'Sarmiento', '#B8237A', '#FFFFFF', [
      ramal('1', 'sarmiento', 'Once-Moreno', ['293', '50', '139', '278']),
      ramal('111', 'sarmiento', 'Once-Bragado', ['293', '50', '139', '400']),
    ]),
    linea('mitre', '5', 'Mitre', '#42B874', '#000000', [
      ramal('5', 'mitre', 'Retiro-Tigre', ['332', '900']),
    ]),
    linea('san-martin', '31', 'San Martín', '#6438C4', '#FFFFFF', [
      ramal('65', 'san-martin', 'Retiro-Cabred', ['331', '901']),
    ]),
    linea('belgrano-sur', '21', 'Belgrano Sur', '#5C4858', '#FFFFFF', [
      ramal('21', 'belgrano-sur', 'Buenos Aires-M.C.G. Belgrano', ['902', '903']),
    ]),
    linea('tren-de-la-costa', '41', 'Tren de la Costa', '#A020B8', '#FFFFFF', [
      ramal('41', 'tren-de-la-costa', 'Maipú-Delta', ['248', '104']),
    ]),
  ],
});
