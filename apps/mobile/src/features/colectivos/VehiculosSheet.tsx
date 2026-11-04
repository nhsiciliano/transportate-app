// Contenido del panel del detalle de línea (tarea 4.6, brief 02-colectivos §3 y §5; F5-MID-B).
// - Encabezado (siempre visible, también colapsado): banda de señal fija («Línea 152 · Ramal A»,
//   «En servicio», el conteo a escala monumental y la antigüedad del dato; con un vehículo elegido
//   se vuelve a señalizar), debajo frescura, favorito y "Actualizar" (en lugar de pull to refresh,
//   que choca con el mapa), y avisos. Con un vehículo elegido suma "Seguir" / "Cerrar".
// - Cuerpo (al subir el panel): ramales y la lista de vehículos, que es la vía principal para el
//   lector de pantalla y para quien no quiere el mapa.
import { Pressable, StyleSheet, View } from 'react-native';

import { FavoriteToggle } from '@/features/favoritos';
import { Icon } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import {
  Alert,
  Button,
  Chip,
  ErrorState,
  FreshnessLabel,
  SignBand,
  Skeleton,
  SkeletonGroup,
  Text,
} from '@/shared/ui';

import { bandaDelPanel, REFRESH_FALLIDO, type VehiculoVista } from './lineaModel';

export const SENTIDO_NOTA =
  'El GPS de los colectivos no informa el sentido: ves los de las dos direcciones.';

export interface RamalOpcion {
  lineaId: string;
  label: string;
  selected: boolean;
}

export type SheetEstado =
  | { kind: 'cargando' }
  | { kind: 'error'; title: string; cause: string; retryable: boolean }
  | { kind: 'vacio' }
  | { kind: 'datos' };

export interface VehiculosSheetHeaderProps {
  /** Sin línea resuelta todavía: skeleton del encabezado. */
  linea: {
    lineaId: string;
    numero: string;
    nombre: string;
    descripcion: string;
    /** «Línea 152 · Ramal A» (`mensajeDeLinea`). */
    mensaje: string;
  } | null;
  estado: SheetEstado;
  cantidad: number;
  /** Segundos del dato más viejo de las posiciones; `null` sin vehículos. */
  edadMasVieja: number | null;
  sourceTimestamp: string | null;
  intervalSeconds: number;
  refreshing: boolean;
  onRefresh: () => void;
  feedViejo: boolean;
  refreshError: boolean;
  seleccionado: VehiculoVista | null;
  siguiendo: boolean;
  onToggleSeguir: () => void;
  onCerrarSeleccion: () => void;
}

export function VehiculosSheetHeader({
  linea,
  estado,
  cantidad,
  edadMasVieja,
  sourceTimestamp,
  intervalSeconds,
  refreshing,
  onRefresh,
  feedViejo,
  refreshError,
  seleccionado,
  siguiendo,
  onToggleSeguir,
  onCerrarSeleccion,
}: VehiculosSheetHeaderProps) {
  const { space } = useTheme();

  if (linea === null) {
    return (
      <SkeletonGroup accessibilityLabel="Cargando la línea…" testID="linea-header-cargando">
        <View style={{ gap: space[2] }}>
          <SignBand.Skeleton variant="lead" />
          <Skeleton width="55%" height={16} />
        </View>
      </SkeletonGroup>
    );
  }

  const conDatos = estado.kind === 'datos' || estado.kind === 'vacio';
  const banda = bandaDelPanel({
    mensaje: linea.mensaje,
    estado: estado.kind,
    cantidad,
    edadMasVieja,
    feedViejo,
    seleccionado,
  });

  return (
    <View style={{ gap: space[2] }}>
      {/* Señal fija: no navega, así que no es botón ni lleva la flecha al borde. */}
      <SignBand
        variant="lead"
        icon="colectivos"
        message={banda.message}
        label={banda.label}
        value={banda.value}
        valueStyle={banda.valueStyle}
        status={banda.status}
        transitionKey={banda.transitionKey}
        accessibilityLabel={banda.accessibilityLabel}
        testID="linea-banda"
      />

      <View style={[styles.row, styles.between, { gap: space[2] }]}>
        <View style={styles.grow}>
          {conDatos ? (
            <FreshnessLabel sourceTimestamp={sourceTimestamp} intervalSeconds={intervalSeconds} />
          ) : null}
        </View>
        <FavoriteToggle
          tipo="linea_colectivo"
          refId={linea.lineaId}
          nombre={linea.nombre}
          subtitulo={linea.descripcion}
        />
        <Button
          label="Actualizar"
          size="sm"
          variant="secondary"
          outline
          icon={<Icon name="refrescar" size={16} />}
          loading={refreshing}
          onPress={onRefresh}
          testID="linea-actualizar"
        />
      </View>

      {estado.kind === 'error' ? (
        <ErrorState
          title={estado.title}
          cause={estado.cause}
          retryable={estado.retryable}
          onRetry={onRefresh}
          retrying={refreshing}
          testID="linea-error"
        />
      ) : null}

      {refreshError ? (
        <Alert
          role="warning"
          message={REFRESH_FALLIDO}
          action={{ label: 'Reintentar', onPress: onRefresh }}
          testID="linea-refresh-error"
        />
      ) : null}

      {seleccionado ? (
        <View style={[styles.row, styles.between, { gap: space[2] }]} testID="linea-seleccionado">
          <Button
            label="Cerrar"
            size="sm"
            variant="link"
            onPress={onCerrarSeleccion}
            accessibilityLabel={`Dejar de mostrar ${seleccionado.nombre}`}
          />
          <Button
            label={siguiendo ? 'Dejar de seguir' : 'Seguir'}
            size="sm"
            variant="primary"
            onPress={onToggleSeguir}
            accessibilityHint="El mapa se mueve con el colectivo en cada actualización"
            testID="linea-seguir"
          />
        </View>
      ) : null}
    </View>
  );
}

export interface VehiculosSheetBodyProps {
  ramales: readonly RamalOpcion[];
  onSelectRamal: (lineaId: string) => void;
  vehiculos: readonly VehiculoVista[];
  seleccionadoId: string | null;
  onSelectVehiculo: (id: string) => void;
}

export function VehiculosSheetBody({
  ramales,
  onSelectRamal,
  vehiculos,
  seleccionadoId,
  onSelectVehiculo,
}: VehiculosSheetBodyProps) {
  const { space, colors, component } = useTheme();
  return (
    <>
      {ramales.length > 1 ? (
        <View style={{ gap: space[2] }}>
          <Text variant="headline.sm" accessibilityRole="header">
            Ramal
          </Text>
          <View style={[styles.row, styles.wrap, { gap: space[2] }]} accessibilityRole="radiogroup">
            {ramales.map((r) => (
              <Chip
                key={r.lineaId}
                label={r.label}
                selected={r.selected}
                onPress={() => {
                  onSelectRamal(r.lineaId);
                }}
                testID={`linea-ramal-${r.lineaId}`}
              />
            ))}
          </View>
        </View>
      ) : null}
      <Text tone="secondary" variant="text.sm">
        {SENTIDO_NOTA}
      </Text>

      {vehiculos.length > 0 ? (
        <View style={{ gap: space[1] }}>
          <Text variant="headline.sm" accessibilityRole="header">
            Colectivos en servicio
          </Text>
          {vehiculos.map((v) => {
            const selected = v.id === seleccionadoId;
            return (
              <Pressable
                key={v.id}
                accessibilityRole="button"
                accessibilityLabel={v.hablado}
                accessibilityState={{ selected }}
                accessibilityHint="Lo muestra en el mapa"
                onPress={() => {
                  onSelectVehiculo(v.id);
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    minHeight: component.hitSlop,
                    gap: space[2],
                    paddingHorizontal: space[2],
                    backgroundColor: pressed || selected ? colors.bg.pressed : 'transparent',
                    opacity: v.viejo ? 0.7 : 1,
                  },
                ]}
                testID={`linea-vehiculo-${v.id}`}
              >
                <Icon name={selected ? 'marcador' : 'colectivos'} size={20} />
                <Text style={styles.grow}>{v.texto}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { justifyContent: 'space-between' },
  wrap: { flexWrap: 'wrap' },
  grow: { flex: 1 },
});
