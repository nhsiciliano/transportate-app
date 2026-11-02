// Estado de conexión para el `OfflineBanner`: lee el onlineManager de TanStack (alimentado por
// NetInfo en `connectQueryManagers`), así banner y consultas pausadas nunca se contradicen.
import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

const subscribe = (listener: () => void) => onlineManager.subscribe(listener);
const getSnapshot = () => onlineManager.isOnline();

export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
