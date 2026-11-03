// Una fila de la lista con su dato vivo conectado (tarea 4.4 + 4.9). El hook va acá y no en
// `FavoritoRow` para que la fila siga siendo presentacional. Solo las filas visibles piden datos
// (`enabled`), así con 50 favoritos no se hacen 50 pedidos; las queries comparten caché con las
// pantallas de cada tipo.
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { FavoritoLiveData } from './FavoritoLiveData';
import { FavoritoRow, type FavoritoRowProps } from './FavoritoRow';
import { serviceHealth, type ServiceHealth } from './servicio';
import { useFavoritoLiveData } from './useFavoritoLiveData';

export interface FavoritoItemProps extends Omit<FavoritoRowProps, 'liveData' | 'liveDataLabel'> {
  /** La fila está en pantalla: recién ahí se piden sus datos. */
  visible: boolean;
  /** Avisa el `sourceTimestamp` del dato (o `null`) para el `FreshnessLabel` global de la lista. */
  onTimestamp?: (id: string, sourceTimestamp: string | null) => void;
  /** Avisa si el dato vivo de la fila está caído (`down`) o no, para la Alert única de la lista. `null`: sin dato vivo. */
  onHealth?: (id: string, health: ServiceHealth | null) => void;
}

export function FavoritoItem({
  visible,
  onTimestamp,
  onHealth,
  orphan,
  ...row
}: FavoritoItemProps) {
  const { favorito } = row;
  // Un huérfano no existe en los datos oficiales: no tiene nada que pedir.
  const enabled = visible && orphan !== true;
  const live = useFavoritoLiveData(favorito, { enabled });
  const timestamp = enabled ? live.sourceTimestamp : null;
  const id = favorito.id;
  const queryClient = useQueryClient();
  // Solo cuentan las filas que de verdad piden un dato vivo (no huérfanos, no paradas estáticas).
  const hasLive = enabled && live.status !== 'static' && live.status !== 'none';
  const health = hasLive ? serviceHealth(favorito, live.status, queryClient) : null;

  useEffect(() => {
    onTimestamp?.(id, timestamp);
    return () => {
      onTimestamp?.(id, null);
    };
  }, [id, timestamp, onTimestamp]);

  useEffect(() => {
    onHealth?.(id, health);
    return () => {
      onHealth?.(id, null);
    };
  }, [id, health, onHealth]);

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
