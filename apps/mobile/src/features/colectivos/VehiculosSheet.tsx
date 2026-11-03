// Contenido del panel del detalle de línea (tarea 4.6, brief 02-colectivos §3 y §5).
// - Encabezado (siempre visible, también colapsado): insignia, ramal, "18 colectivos en servicio",
//   frescura, favorito, "Actualizar" (en lugar de pull to refresh, que choca con el mapa), avisos
//   y el vehículo elegido con "Seguir".
// - Cuerpo (al subir el panel): ramales y la lista de vehículos, que es la vía principal para el
//   lector de pantalla y para quien no quiere el mapa.
import { Pressable, StyleSheet, View } from 'react-native';

import { FavoriteToggle } from '@/features/favoritos';
import { Icon } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import {
  Alert,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  FreshnessLabel,
  LineBadge,
  Skeleton,
  SkeletonGroup,
  Text,
} from '@/shared/ui';

import {
  enServicio,
  POSICIONES_VIEJAS,
  REFRESH_FALLIDO,
  SIN_VEHICULOS,
  type VehiculoVista,
} from './lineaModel';

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
  linea: { lineaId: string; numero: string; nombre: string; descripcion: string } | null;
  estado: SheetEstado;
  cantidad: number;
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
        <View style={[styles.row, { gap: space[3] }]}>
          <Skeleton width={48} height={32} />
          <View style={[styles.grow, { gap: space[2] }]}>
            <Skeleton width="70%" height={16} />
            <Skeleton width="45%" height={14} />
          </View>
        </View>
      </SkeletonGroup>
    );
  }

  return (
    <View style={{ gap: space[2] }}>
      <View style={[styles.row, { gap: space[3] }]}>
        <LineBadge kind="colectivo" label={linea.numero} size="lg" />
        <View style={styles.grow}>
          <Text variant="headline.md" numberOfLines={2}>
            {linea.descripcion}
          </Text>
          {estado.kind === 'datos' || estado.kind === 'vacio' ? (
            <Text tone="secondary" testID="linea-cantidad">
              {enServicio(cantidad)}
            </Text>
          ) : null}
        </View>
        <FavoriteToggle
          tipo="linea_colectivo"
          refId={linea.lineaId}
          nombre={linea.nombre}
          subtitulo={linea.descripcion}
        />
      </View>

      <View style={[styles.row, styles.between, { gap: space[2] }]}>
        {estado.kind === 'datos' || estado.kind === 'vacio' ? (
          <FreshnessLabel sourceTimestamp={sourceTimestamp} intervalSeconds={intervalSeconds} />
        ) : (
          <View />
        )}
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

      {estado.kind === 'cargando' ? (
        <SkeletonGroup accessibilityLabel="Buscando colectivos…" testID="linea-vehiculos-cargando">
          <Skeleton width="60%" height={14} />
        </SkeletonGroup>
      ) : null}

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

      {estado.kind === 'vacio' ? (
        <EmptyState
          message={SIN_VEHICULOS}
          icon={<Icon name="colectivos" size={32} />}
          testID="linea-vacio"
        />
      ) : null}

      {refreshError ? (
        <Alert
          role="warning"
          message={REFRESH_FALLIDO}
          action={{ label: 'Reintentar', onPress: onRefresh }}
          testID="linea-refresh-error"
        />
      ) : feedViejo ? (
        <Alert role="warning" message={POSICIONES_VIEJAS} testID="linea-feed-viejo" />
      ) : null}

      {seleccionado ? (
        <Card testID="linea-seleccionado">
          <View style={{ gap: space[2] }}>
            <Text accessibilityLabel={seleccionado.hablado}>{seleccionado.texto}</Text>
            <View style={[styles.row, { gap: space[2] }]}>
              <Button
                label={siguiendo ? 'Dejar de seguir' : 'Seguir'}
                size="sm"
                variant="primary"
                onPress={onToggleSeguir}
                accessibilityHint="El mapa se mueve con el colectivo en cada actualización"
                testID="linea-seguir"
              />
              <Button
                label="Cerrar"
                size="sm"
                variant="link"
                onPress={onCerrarSeleccion}
                accessibilityLabel={`Dejar de mostrar ${seleccionado.nombre}`}
              />
            </View>
          </View>
        </Card>
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
