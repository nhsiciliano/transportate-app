// Acerca de (tarea 4.10; brief `docs/briefs/06-ajustes.md`, §3): lectura corta de 150–250
// palabras. Nombre, versión y build; de dónde salen los datos (CC BY 2.5 AR, S27: no es una app
// oficial); privacidad en bullets (`docs/05-privacidad.md:89-90`); mapa; diseño; y la pantalla de
// licencias de terceros. Sin contacto ni "reportar un problema" (F4-ajustes-3).
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Image, Linking, ScrollView, View } from 'react-native';

import { useTheme } from '@/shared/theme';
import { Text } from '@/shared/ui';

import { Row, Section } from './SettingsList';

import appIcon from '../../../assets/images/icon.png';

export const CC_LICENSE_URL = 'https://creativecommons.org/licenses/by/2.5/ar/';
export const DATOS_ABIERTOS_URL = 'https://www.buenosaires.gob.ar/datosabiertos';

export const PRIVACIDAD_BULLETS = [
  'No necesitás crear una cuenta.',
  'Tus favoritos y ajustes quedan en tu teléfono.',
  'Tu ubicación solo se usa con la app abierta y nunca sale de tu teléfono.',
  'No medimos ni rastreamos lo que hacés.',
] as const;

/** "Versión 0.1.0 (build 12)"; sin build (Expo Go, web) queda "Versión 0.1.0". */
export function describeVersion(version: string | undefined, build: string | null): string {
  const base = `Versión ${version ?? '—'}`;
  return build ? `${base} (build ${build})` : base;
}

function openLink(url: string): void {
  // Si el sistema no puede abrirlo (sin navegador), no hay nada útil que mostrar: se ignora.
  Linking.openURL(url).catch(() => undefined);
}

export function AcercaScreen() {
  const { space, radius } = useTheme();
  const router = useRouter();
  // `nativeBuildVersion` está tipado como `any` en expo-constants: se acota acá.
  const build: unknown = Constants.nativeBuildVersion;
  const version = describeVersion(
    Constants.expoConfig?.version,
    typeof build === 'string' ? build : null,
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space[3], gap: space[4], paddingBottom: space[5] }}
    >
      <View style={{ alignItems: 'center', gap: space[2] }}>
        <Image
          source={appIcon}
          accessible={false}
          accessibilityIgnoresInvertColors
          style={{ width: 72, height: 72, borderRadius: radius.lg }}
        />
        <Text variant="heading.h4">Transportate</Text>
        <Text variant="text.sm" tone="secondary" testID="acerca-version">
          {version}
        </Text>
      </View>

      <View style={{ gap: space[2] }}>
        <Text variant="heading.h6">Datos</Text>
        <Text>
          Los datos de transporte son del Gobierno de la Ciudad de Buenos Aires (API de Transporte),
          publicados bajo licencia Creative Commons Atribución 2.5 Argentina. Las paradas de
          colectivo salen del catálogo «Colectivos: paradas» de BA Data, con la misma licencia.
        </Text>
        <Text>Transportate no es una app oficial del Gobierno de la Ciudad.</Text>
        <Text>
          Los datos pueden tardar en actualizarse o fallar: siempre te mostramos hace cuánto se
          actualizaron.
        </Text>
        <Section title="Enlaces">
          <Row
            title="Licencia CC BY 2.5 Argentina"
            role="link"
            trailing="externo"
            titleTone="link"
            onPress={() => {
              openLink(CC_LICENSE_URL);
            }}
          />
          <Row
            title="Datos abiertos de la Ciudad"
            role="link"
            trailing="externo"
            titleTone="link"
            onPress={() => {
              openLink(DATOS_ABIERTOS_URL);
            }}
          />
        </Section>
      </View>

      <View style={{ gap: space[2] }}>
        <Text variant="heading.h6">Privacidad</Text>
        {PRIVACIDAD_BULLETS.map((bullet) => (
          <View key={bullet} style={{ flexDirection: 'row', gap: space[2] }}>
            <Text accessibilityElementsHidden importantForAccessibility="no">
              •
            </Text>
            <Text style={{ flex: 1 }}>{bullet}</Text>
          </View>
        ))}
      </View>

      <View style={{ gap: space[2] }}>
        <Text variant="heading.h6">Mapa</Text>
        <Text>Mapa base: © OpenStreetMap contributors, © OpenMapTiles, tiles de OpenFreeMap.</Text>
        <Text>
          El mapa se descarga de un servicio externo, que puede ver tu dirección IP y la zona que
          mirás.
        </Text>
      </View>

      <View style={{ gap: space[2] }}>
        <Text variant="heading.h6">Diseño</Text>
        <Text>Basado en Obelisco, el sistema de diseño de la Ciudad de Buenos Aires.</Text>
      </View>

      <Section title="Software">
        <Row
          title="Licencias de software de terceros"
          trailing="chevron"
          onPress={() => {
            router.push('/inicio/licencias');
          }}
        />
      </Section>
    </ScrollView>
  );
}
