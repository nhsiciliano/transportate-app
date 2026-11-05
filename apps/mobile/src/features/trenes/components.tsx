// Piezas propias de Trenes. Lo que es igual a Subtes (placa de estado, alertas, scroll, fondo,
// rótulo) se reutiliza desde `@/features/subtes`, sin copiar: se mueve a `shared/ui` en la 6.8.
import type { AlertaTrenV1, EstadoServicioV1 } from '@transportate/contracts';

import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/shared/theme';
import { contrastRatio } from '@/shared/theme/contrast';
import { LineBadge, type LineBadgeSize } from '@/shared/ui';

import { AvisoAlert, horaBsAs } from './deps';
import type { LineaTren } from './model';

/** Insignia rectangular de la línea con sus siglas y el color de `trenes-lineas.json`. */
export function LineaTrenBadge({
  linea,
  size = 'md',
  surface,
}: {
  linea: Pick<LineaTren, 'siglas' | 'color' | 'colorTexto' | 'nombre'>;
  size?: LineBadgeSize;
  /** Superficie donde se apoya (decide el borde, `02c-colores-trenes.md` §3). */
  surface: string;
}) {
  return (
    <LineBadge
      kind="tren"
      label={linea.siglas}
      color={linea.color}
      textColor={linea.colorTexto}
      size={size}
      surface={surface}
      accessibilityLabel={linea.nombre}
    />
  );
}

/** «Hasta el 6/11 a las 01:13» (hora de Buenos Aires); `undefined` sin vigencia de fin. */
export function vigenciaAlerta(alerta: Pick<AlertaTrenV1, 'hasta'>): string | undefined {
  if (alerta.hasta === undefined) return undefined;
  const ms = Date.parse(alerta.hasta);
  if (Number.isNaN(ms)) return undefined;
  const d = new Date(ms - 3 * 60 * 60 * 1000);
  const hora = horaBsAs(alerta.hasta);
  return `Hasta el ${d.getUTCDate()}/${d.getUTCMonth() + 1}${hora === undefined ? '' : ` a las ${hora}`}`;
}

/**
 * Una alerta completa: el título en negrita; debajo, el texto completo solo si agrega algo, el
 * sentido («Hacia Moreno», S39) y la vigencia. Roja si el servicio está interrumpido.
 */
export function AlertaTren({
  alerta,
  estado,
  sentido,
}: {
  alerta: AlertaTrenV1;
  estado: EstadoServicioV1 | undefined;
  /** «Hacia Moreno» si la alerta es de un sentido. */
  sentido?: string | undefined;
}) {
  const titulo = alerta.titulo.trim();
  const descripcion = alerta.descripcion.trim();
  const texto = descripcion === titulo ? '' : descripcion;
  const message = [texto, vigenciaAlerta(alerta)]
    .filter((x) => x !== undefined && x !== '')
    .join('\n');
  return (
    <AvisoAlert
      role={estado === 'interrumpida' ? 'danger' : 'warning'}
      title={sentido === undefined ? titulo : `${sentido}: ${titulo}`}
      {...(message === '' ? {} : { message })}
      testID={`alerta-${alerta.id}`}
    />
  );
}

/** Ancho del riel (trazo + punto) a la izquierda de cada estación. */
export const RIEL = 24;

/**
 * Trazo del color de la línea a todo el alto de la fila, con el punto de la estación (como el
 * diagrama de línea de Subtes). Si el color no llega a 3:1 contra la placa (Tren de la Costa en
 * oscuro, `02c-colores-trenes.md` §3), el trazo lleva contorno en `text.primary`.
 */
export function Riel({
  color,
  primera,
  ultima,
  apagada = false,
}: {
  color: string;
  primera: boolean;
  ultima: boolean;
  /** Estación sin servicio en este ramal: punto hueco atenuado. */
  apagada?: boolean;
}) {
  const { colors } = useTheme();
  const contorno = contrastRatio(color, colors.bg.card) < 3;
  return (
    <View style={styles.riel} accessible={false} importantForAccessibility="no-hide-descendants">
      <View
        testID="riel-trazo"
        style={[
          styles.trazo,
          {
            backgroundColor: color,
            top: primera ? '50%' : 0,
            bottom: ultima ? '50%' : 0,
            ...(contorno ? { borderWidth: 1, borderColor: colors.text.primary } : {}),
          },
        ]}
      />
      <View
        style={[
          styles.punto,
          { backgroundColor: colors.bg.card, borderColor: apagada ? colors.text.secondary : color },
        ]}
      >
        <View style={[styles.puntoBorde, { borderColor: colors.text.primary }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  riel: { width: RIEL, flex: 1, alignItems: 'center', justifyContent: 'center' },
  trazo: { position: 'absolute', width: 6, left: (RIEL - 6) / 2 },
  punto: { width: 16, height: 16, borderRadius: 8, borderWidth: 4 },
  puntoBorde: { position: 'absolute', inset: -5, borderRadius: 13, borderWidth: 1 },
});
