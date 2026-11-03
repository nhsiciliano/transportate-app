// Una fila de la lista con su dato vivo conectado (tarea 4.4 + 4.9). El hook va acá y no en
// `FavoritoRow` para que la fila siga siendo presentacional. Solo las filas visibles piden datos
// (`enabled`), así con 50 favoritos no se hacen 50 pedidos; las queries comparten caché con las
// pantallas de cada tipo.
import { useEffect } from 'react';

import { FavoritoLiveData } from './FavoritoLiveData';
import { FavoritoRow, type FavoritoRowProps } from './FavoritoRow';
import { useFavoritoLiveData } from './useFavoritoLiveData';

export interface FavoritoItemProps extends Omit<FavoritoRowProps, 'liveData' | 'liveDataLabel'> {
  /** La fila está en pantalla: recién ahí se piden sus datos. */
  visible: boolean;
  /** Avisa el `sourceTimestamp` del dato (o `null`) para el `FreshnessLabel` global de la lista. */
  onTimestamp?: (id: string, sourceTimestamp: string | null) => void;
}

export function FavoritoItem({ visible, onTimestamp, orphan, ...row }: FavoritoItemProps) {
  const { favorito } = row;
  // Un huérfano no existe en los datos oficiales: no tiene nada que pedir.
  const enabled = visible && orphan !== true;
  const live = useFavoritoLiveData(favorito, { enabled });
  const timestamp = enabled ? live.sourceTimestamp : null;
  const id = favorito.id;

  useEffect(() => {
    onTimestamp?.(id, timestamp);
    return () => {
      onTimestamp?.(id, null);
    };
  }, [id, timestamp, onTimestamp]);

  // El dato estático de la parada (sus líneas) ya sale como detalle de la fila: no se repite.
  const showLive = orphan !== true && live.status !== 'static' && live.status !== 'none';
  return (
    <FavoritoRow
      {...row}
      orphan={orphan}
      liveData={showLive ? <FavoritoLiveData favorito={favorito} live={live} /> : undefined}
      liveDataLabel={showLive ? live.spoken : undefined}
    />
  );
}
