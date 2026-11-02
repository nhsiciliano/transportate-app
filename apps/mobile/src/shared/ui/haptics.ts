// Hápticos sobrios (docs/briefs/README.md, "Interacción común", y suposición S25): solo en
// selección (cambiar segmento o filtro, marcar favorito) y éxito al guardar un favorito. Nada en
// refrescos automáticos. Si el dispositivo no tiene motor de vibración o el usuario los desactivó
// en el sistema, expo-haptics no hace nada; los errores se ignoran (no son críticos).
import * as Haptics from 'expo-haptics';

export type HapticKind = 'selection' | 'success';

export function triggerHaptic(kind: HapticKind): void {
  const run =
    kind === 'selection'
      ? Haptics.selectionAsync()
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  run.catch(() => undefined);
}
