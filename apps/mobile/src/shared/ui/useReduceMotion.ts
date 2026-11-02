import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * `true` si la persona activó "Reducir movimiento" (iOS) o "Quitar animaciones" (Android).
 * Arranca en `true` hasta saber la respuesta: así ningún componente anima antes de tiempo.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setReduce(v);
      })
      .catch(() => {
        if (alive) setReduce(false);
      });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v: boolean) => {
      setReduce(v);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
