// Acerca de (tarea 4.10; brief `docs/briefs/06-ajustes.md`, §3): lectura corta de 150–250
// palabras. Nombre, versión y build; de dónde salen los datos (CC BY 2.5 AR, S27: no es una app
// oficial); privacidad en bullets (`docs/05-privacidad.md:89-90`); mapa; diseño; y la pantalla de
// licencias de terceros. La atribución de trenes (fuente comunitaria no oficial, Fase 6) va en
// «Datos», con su enlace a la fuente. Sin contacto ni "reportar un problema" (F4-ajustes-3).
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Image, Linking, ScrollView, View } from 'react-native';

import { useTheme } from '@/shared/theme';
import { Text, type TextProps } from '@/shared/ui';

import { Row, Section } from './SettingsList';

import appIcon from '../../../assets/images/icon.png';

export const CC_LICENSE_URL = 'https://creativecommons.org/licenses/by/2.5/ar/';
export const DATOS_ABIERTOS_URL = 'https://www.buenosaires.gob.ar/datosabiertos';
export const TRENES_FUENTE_URL = 'https://github.com/ariedro/api-trenes';

export const PRIVACIDAD_BULLETS = [
  'No necesitás crear una cuenta.',
  'Tus favoritos y ajustes quedan en tu teléfono.',
  'Tu ubicación solo se usa con la app abierta y nunca sale de tu teléfono.',
  'No medimos ni rastreamos lo que hacés.',
] as const;

/** Copy oficial de la atribución de trenes (`PRODUCT.md`, Brand Commitments). */
export const TRENES_ATRIBUCION =
  'Trenes: datos de Trenes Argentinos (SOFSE) a través de una API comunitaria no oficial.';
export const MAPA_ATRIBUCION =
  'Mapa base: © OpenStreetMap contributors, © OpenMapTiles, tiles de OpenFreeMap.';
export const MAPA_PRIVACIDAD =
  'El mapa se descarga de un servicio externo, que puede ver tu dirección IP y la zona que mirás.';
export const DISENO_TEXTO =
  'La app sigue Obelisco v2, el sistema de diseño de la Ciudad de Buenos Aires, adaptado a nativo y con la tipografía Fira Sans. Sobre esa paleta tiene una dirección visual propia: «Señalética de terminal».';

/** "Versión 0.1.0 (build 12)"; sin build (Expo Go, web) queda "Versión 0.1.0". */
export function describeVersion(version: string | undefined, build: string | null): string {
  const base = `Versión ${version ?? '—'}`;
  return build ? `${base} (build ${build})` : base;
}

function openLink(url: string): void {
  // Si el sistema no puede abrirlo (sin navegador), no hay nada útil que mostrar: se ignora.
  Linking.openURL(url).catch(() => undefined);
}

/** Título de sección de lectura: 20/26 en 600 (contrato de Ajustes). */
function Titulo({ children }: { children: string }) {
  return (
    <Text variant="heading.h6" style={{ lineHeight: 26 }}>
      {children}
    </Text>
  );
}

/** Párrafo de lectura: 17/26 en 400, con el tope de Dynamic Type de 1.3 del texto corrido. */
function Parrafo({ style, ...rest }: TextProps) {
  return (
    <Text maxFontSizeMultiplier={1.3} style={[{ fontSize: 17, lineHeight: 26 }, style]} {...rest} />
  );
}

export function AcercaScreen() {
  const { space, radius, colors, scheme, fontFamily } = useTheme();
  const router = useRouter();
  // `nativeBuildVersion` está tipado como `any` en expo-constants: se acota acá.
  const build: unknown = Constants.nativeBuildVersion;
  const version = describeVersion(
    Constants.expoConfig?.version,
    typeof build === 'string' ? build : null,
  );

  return (
    <ScrollView
      testID="acerca-screen"
      style={{ backgroundColor: scheme === 'light' ? colors.bg.elevated : colors.bg.base }}
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
        <Text variant="heading.h4" style={{ fontFamily: fontFamily.heading[700], lineHeight: 34 }}>
          Transportate
        </Text>
        <Text
          variant="text.sm"
          tone="secondary"
          testID="acerca-version"
          style={{ fontSize: 15, lineHeight: 20 }}
        >
          {version}
        </Text>
      </View>

      <View style={{ gap: space[2] }}>
        <Titulo>Datos</Titulo>
        <Parrafo>
          Los datos de transporte son del Gobierno de la Ciudad de Buenos Aires (API de Transporte),
          publicados bajo licencia Creative Commons Atribución 2.5 Argentina. Las paradas de
          colectivo salen del catálogo «Colectivos: paradas» de BA Data, con la misma licencia.
        </Parrafo>
        <Parrafo>{TRENES_ATRIBUCION}</Parrafo>
        <Parrafo>Transportate no es una app oficial del Gobierno de la Ciudad.</Parrafo>
        <Parrafo>
          Los datos pueden tardar en actualizarse o fallar: siempre te mostramos hace cuánto se
          actualizaron.
        </Parrafo>
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
          <Row
            title="API comunitaria de trenes"
            role="link"
            trailing="externo"
            titleTone="link"
            onPress={() => {
              openLink(TRENES_FUENTE_URL);
            }}
          />
        </Section>
      </View>

      <View style={{ gap: space[2] }}>
        <Titulo>Privacidad</Titulo>
        {PRIVACIDAD_BULLETS.map((bullet) => (
          <View key={bullet} style={{ flexDirection: 'row', gap: space[2] }}>
            <Parrafo accessibilityElementsHidden importantForAccessibility="no">
              •
            </Parrafo>
            <Parrafo style={{ flex: 1 }}>{bullet}</Parrafo>
          </View>
        ))}
      </View>

      <View style={{ gap: space[2] }}>
        <Titulo>Mapa</Titulo>
        <Parrafo>{MAPA_ATRIBUCION}</Parrafo>
        <Parrafo>{MAPA_PRIVACIDAD}</Parrafo>
      </View>

      <View style={{ gap: space[2] }}>
        <Titulo>Diseño</Titulo>
        <Parrafo>{DISENO_TEXTO}</Parrafo>
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
