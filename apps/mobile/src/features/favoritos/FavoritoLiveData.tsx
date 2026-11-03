// Dato vivo de un favorito para las filas de Inicio y Favoritos (slot `liveData` de
// `FavoritoRow`). Se oculta al lector: la fila arma su etiqueta con `useFavoritoLiveData().spoken`.
import { View } from 'react-native';

import { Skeleton, StatusChip, Text } from '@/shared/ui';

import type { FavoritoV1 } from './model';
import { useFavoritoLiveData, type FavoritoLiveDataResult } from './useFavoritoLiveData';

export interface FavoritoLiveDataProps {
  favorito: Pick<FavoritoV1, 'tipo' | 'refId' | 'subtitulo'>;
  /** `false` para filas fuera de pantalla: no se pide nada. */
  enabled?: boolean;
  /** Resultado ya calculado (si la fila llamó a `useFavoritoLiveData` para su etiqueta). */
  live?: FavoritoLiveDataResult;
  testID?: string;
}

export function FavoritoLiveData({
  favorito,
  enabled = true,
  live,
  testID,
}: FavoritoLiveDataProps) {
  return live === undefined ? (
    <Connected favorito={favorito} enabled={enabled} testID={testID} />
  ) : (
    <LiveDataView live={live} testID={testID} />
  );
}

function Connected({
  favorito,
  enabled,
  testID,
}: {
  favorito: FavoritoLiveDataProps['favorito'];
  enabled: boolean;
  testID: string | undefined;
}) {
  const live = useFavoritoLiveData(favorito, { enabled });
  return <LiveDataView live={live} testID={testID} />;
}

/** Solo presentación: skeleton chico, chip de estado o texto (atenuado si es viejo o falló). */
export function LiveDataView({
  live,
  testID,
}: {
  live: FavoritoLiveDataResult;
  testID?: string | undefined;
}) {
  const hidden = {
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants' as const,
  };
  if (live.status === 'none') return null;
  if (live.status === 'loading') {
    return (
      <View testID={testID} {...hidden}>
        <Skeleton width={120} height={16} />
      </View>
    );
  }
  if (live.estado !== undefined) {
    return (
      <View
        testID={testID}
        {...hidden}
        style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}
      >
        <StatusChip estado={live.estado} size="sm" />
        {live.ageText !== undefined && live.ageText !== '' ? (
          <Text variant="text.xs" tone="tertiary">
            {live.ageText}
          </Text>
        ) : null}
      </View>
    );
  }
  return (
    <View testID={testID} {...hidden}>
      <Text
        variant="text.sm"
        tone={live.tone === 'muted' ? 'tertiary' : 'secondary'}
        numberOfLines={1}
      >
        {live.text}
      </Text>
    </View>
  );
}
