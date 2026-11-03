// Fila "Índice de líneas y paradas" de Ajustes (brief `docs/briefs/06-ajustes.md`, §3 y §5):
// versión y peso del índice estático, y la acción "Buscar actualización".
//
// Estados:
// - con datos: "Versión del 12/10/2026 · 4,8 MB";
// - buscando: indicador en la fila ("Buscando actualización…");
// - error: "No pudimos actualizar. Tocá para reintentar.";
// - sin conexión: la acción dice "Necesitás conexión" y queda deshabilitada.
//
// La descarga real del índice grande llega con la tarea 4.5: esa tarea le pasa `downloadProgress`
// (0 a 1) y la fila muestra "Descargando… 40 %" en vez de "Buscando…".
import type { ManifestV1 } from '@transportate/contracts';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { ResourceQuery } from '@/shared/api';
import { Icon } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import { Text } from '@/shared/ui';

import { describeIndice } from './format';
import { Row } from './SettingsList';

export const INDICE_TITLE = 'Índice de líneas y paradas';
export const INDICE_ERROR = 'No pudimos actualizar. Tocá para reintentar.';
export const INDICE_OFFLINE = 'Necesitás conexión';
export const INDICE_SEARCH = 'Buscar actualización';

export interface IndiceRowProps {
  manifest: Pick<
    ResourceQuery<ManifestV1>,
    'data' | 'isPending' | 'isFetching' | 'isLoadingError' | 'isRefreshError' | 'refetch'
  >;
  online: boolean;
  /** Avance de la descarga (0 a 1); `null` o ausente si no hay descarga en curso. */
  downloadProgress?: number | null;
}

export function IndiceRow({ manifest, online, downloadProgress = null }: IndiceRowProps) {
  const { colors, space } = useTheme();
  const { data, isPending, isFetching, isLoadingError, isRefreshError, refetch } = manifest;

  const searching = isFetching && online;
  const hasError = isLoadingError || isRefreshError;
  const progressText =
    downloadProgress === null
      ? 'Buscando actualización…'
      : `Descargando… ${String(Math.round(downloadProgress * 100))} %`;

  let status: string;
  if (searching) status = progressText;
  else if (data) status = describeIndice(data);
  else if (!online) status = 'No pudimos ver la versión del índice.';
  else if (isPending) status = 'Buscando…';
  else status = INDICE_ERROR;

  let action: string;
  if (!online) action = INDICE_OFFLINE;
  else if (searching) action = 'Buscando…';
  else if (hasError) action = 'Reintentar';
  else action = INDICE_SEARCH;

  const disabled = !online || searching;
  // El error con datos viejos no pisa la versión: va en un renglón aparte.
  const showErrorLine = !searching && online && isRefreshError && data !== undefined;

  return (
    <Row
      title={INDICE_TITLE}
      icon="lista"
      disabled={disabled}
      busy={searching}
      onPress={() => {
        void refetch();
      }}
      accessibilityLabel={`${INDICE_TITLE}. ${status}.${showErrorLine ? ` ${INDICE_ERROR}.` : ''} ${action}`}
    >
      <View style={styles.line}>
        {searching ? <ActivityIndicator size="small" color={colors.text.secondary} /> : null}
        <Text variant="text.sm" tone="secondary" style={styles.flex}>
          {status}
        </Text>
      </View>
      {showErrorLine ? (
        <View style={[styles.line, { gap: space[1] }]}>
          <Icon name="error" size={16} color={colors.role.danger.text} />
          <Text variant="text.sm" color={colors.role.danger.text} style={styles.flex}>
            {INDICE_ERROR}
          </Text>
        </View>
      ) : null}
      <Text variant="headline.sm" tone={disabled ? 'disabled' : 'link'}>
        {action}
      </Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
});
