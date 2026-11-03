// Licencias de software de terceros (Acerca de). Lista nombre · versión · licencia de las
// dependencias de la app, con el texto expandible. Los datos salen de `licencias.json`, que
// genera `scripts/licencias.mjs` (`pnpm licencias` en `apps/mobile`).
import { useState } from 'react';
import { FlatList, Linking, Pressable, View } from 'react-native';

import { Icon } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import { Text } from '@/shared/ui';

import { licencias as defaultLicencias, type LicenciaPaquete } from './licencias';

export const LICENCIAS_INTRO =
  'Transportate está hecha con estas librerías de código abierto. Gracias a quienes las mantienen.';

export interface LicenciasScreenProps {
  /** Se inyecta en los tests; por defecto, el JSON generado. */
  paquetes?: readonly LicenciaPaquete[];
}

export function LicenciasScreen({ paquetes = defaultLicencias }: LicenciasScreenProps) {
  const { space } = useTheme();
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  const toggle = (name: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <FlatList
      data={paquetes}
      keyExtractor={(item) => item.name}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space[3], paddingBottom: space[5] }}
      ListHeaderComponent={
        <Text tone="secondary" style={{ marginBottom: space[3] }}>
          {LICENCIAS_INTRO}
        </Text>
      }
      renderItem={({ item }) => (
        <LicenciaItem
          paquete={item}
          expanded={open.has(item.name)}
          onToggle={() => {
            toggle(item.name);
          }}
        />
      )}
    />
  );
}

function LicenciaItem({
  paquete,
  expanded,
  onToggle,
}: {
  paquete: LicenciaPaquete;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { space, colors, component } = useTheme();
  const summary = `${paquete.name} ${paquete.version}, licencia ${paquete.license}`;
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border.subtle }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={summary}
        accessibilityState={{ expanded }}
        style={({ pressed }) => ({
          minHeight: component.hitSlop + space[2],
          paddingVertical: space[2],
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[2],
          backgroundColor: pressed ? colors.bg.pressed : 'transparent',
        })}
      >
        <View style={{ flex: 1 }}>
          <Text variant="headline.sm">{paquete.name}</Text>
          <Text variant="text.sm" tone="secondary">
            {paquete.version} · {paquete.license}
          </Text>
        </View>
        {/* Sin ícono de "expandir" en el mapa: el chevron gira para marcar el estado. */}
        <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
          <Icon name="chevron" size={20} />
        </View>
      </Pressable>
      {expanded ? (
        <View style={{ paddingBottom: space[3], gap: space[2] }}>
          {paquete.text ? (
            <Text variant="text.xs" tone="secondary" selectable>
              {paquete.text}
            </Text>
          ) : (
            <Text variant="text.sm" tone="secondary">
              Este paquete no incluye el texto de la licencia. Podés leerlo en su repositorio.
            </Text>
          )}
          {paquete.repository ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Repositorio de ${paquete.name}`}
              onPress={() => {
                Linking.openURL(paquete.repository ?? '').catch(() => undefined);
              }}
              style={{ minHeight: component.hitSlop, justifyContent: 'center' }}
            >
              <Text variant="text.sm" tone="link">
                Ver repositorio
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
