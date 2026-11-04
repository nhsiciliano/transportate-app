// Licencias de software de terceros (Acerca de). Lista nombre · versión · licencia de las
// dependencias de la app, con el texto expandible. Los datos salen de `licencias.json`, que
// genera `scripts/licencias.mjs` (`pnpm licencias` en `apps/mobile`).
import { Fragment, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';

import { Icon } from '@/shared/icons';
import { useTheme } from '@/shared/theme';
import { Card, Text } from '@/shared/ui';

import { licencias as defaultLicencias, type LicenciaPaquete } from './licencias';
import {
  Hairline,
  ROW_MIN_HEIGHT,
  ROW_PADDING_X,
  RowDetail,
  RowTitle,
  SECTION_GAP,
} from './SettingsList';

export const LICENCIAS_INTRO =
  'Transportate está hecha con estas librerías de código abierto. Gracias a quienes las mantienen.';

export interface LicenciasScreenProps {
  /** Se inyecta en los tests; por defecto, el JSON generado. */
  paquetes?: readonly LicenciaPaquete[];
}

export function LicenciasScreen({ paquetes = defaultLicencias }: LicenciasScreenProps) {
  const { space, colors, scheme } = useTheme();
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  const toggle = (name: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Una placa con todas las filas (son ~25: no hace falta virtualizar, y así el radio, el outline
  // y los hairlines son los de las demás pantallas). El texto de la licencia solo se monta abierto.
  return (
    <ScrollView
      testID="licencias-screen"
      style={{ backgroundColor: scheme === 'light' ? colors.bg.elevated : colors.bg.base }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space[3], gap: SECTION_GAP, paddingBottom: space[5] }}
    >
      <RowDetail style={{ fontSize: 17, lineHeight: 26 }}>{LICENCIAS_INTRO}</RowDetail>
      <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
        {paquetes.map((paquete, index) => (
          <Fragment key={paquete.name}>
            {index > 0 ? <Hairline /> : null}
            <LicenciaItem
              paquete={paquete}
              expanded={open.has(paquete.name)}
              onToggle={() => {
                toggle(paquete.name);
              }}
            />
          </Fragment>
        ))}
      </Card>
    </ScrollView>
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
  const { space, colors, component, fontFamily } = useTheme();
  const summary = `${paquete.name} ${paquete.version}, licencia ${paquete.license}`;
  return (
    <View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={summary}
        accessibilityState={{ expanded }}
        style={({ pressed }) => ({
          minHeight: ROW_MIN_HEIGHT,
          paddingVertical: space[2] + 2,
          paddingHorizontal: ROW_PADDING_X,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          backgroundColor: pressed ? colors.bg.pressed : 'transparent',
        })}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <RowTitle style={{ fontFamily: fontFamily.text[600] }}>{paquete.name}</RowTitle>
          <RowDetail>
            {paquete.version} · {paquete.license}
          </RowDetail>
        </View>
        {/* Sin ícono de "expandir" en el mapa: el chevron gira para marcar el estado. */}
        <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
          <Icon name="chevron" size={20} color={colors.text.tertiary} />
        </View>
      </Pressable>
      {expanded ? (
        <View
          style={{
            paddingHorizontal: ROW_PADDING_X,
            paddingBottom: space[3],
            gap: space[2],
          }}
        >
          {paquete.text ? (
            <Text
              variant="text.sm"
              tone="secondary"
              selectable
              style={{ fontSize: 15, lineHeight: 22 }}
            >
              {paquete.text}
            </Text>
          ) : (
            <RowDetail>
              Este paquete no incluye el texto de la licencia. Podés leerlo en su repositorio.
            </RowDetail>
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
              <RowDetail tone="link">Ver repositorio</RowDetail>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
