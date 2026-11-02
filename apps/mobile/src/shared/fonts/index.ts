// Fuentes de Obelisco (tarea 3.4): Nunito para títulos y Open Sans para texto, pesos 400/600/700
// (`docs/02-obelisco-tokens.md` §2; nombres exactos en DESIGN.md §3 y `docs/versiones.md`).
//
// Se importan SOLO los 6 subpaths por peso de `@expo-google-fonts/*` 0.4.2: cada uno exporta el
// `require()` del `.ttf` empaquetado con la app (Metro lo trata como asset). Nada se descarga por
// red en ejecución (`docs/05-privacidad.md`); por eso no se usa `@expo-google-fonts/dev`.
//
// Carga con `useFonts` de `expo-font` y no con el config plugin de `expo-font`: con el plugin,
// iOS toma el nombre de familia del archivo (p. ej. "Nunito") y Android del nombre del archivo
// ("Nunito_400Regular"), así que el `fontFamily` diferiría entre plataformas. Con `useFonts` el
// nombre es la clave del objeto y es el mismo en iOS, Android y Jest.
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { OpenSans_400Regular } from '@expo-google-fonts/open-sans/400Regular';
import { OpenSans_600SemiBold } from '@expo-google-fonts/open-sans/600SemiBold';
import { OpenSans_700Bold } from '@expo-google-fonts/open-sans/700Bold';
import { useFonts } from 'expo-font';

/** Un `fontFamily` por peso: en RN no hay `fontWeight` sobre una familia cargada (DESIGN.md §3). */
export const fontFamilies = {
  /** Títulos y headlines (Nunito). */
  heading: {
    regular: 'Nunito_400Regular',
    semibold: 'Nunito_600SemiBold',
    bold: 'Nunito_700Bold',
  },
  /** Texto corrido y etiquetas (Open Sans). */
  body: {
    regular: 'OpenSans_400Regular',
    semibold: 'OpenSans_600SemiBold',
    bold: 'OpenSans_700Bold',
  },
} as const;

type FontGroup = (typeof fontFamilies)[keyof typeof fontFamilies];
export type FontFamily = FontGroup[keyof FontGroup];

/** Mapa `fontFamily` → asset para `useFonts`. Las claves son los nombres de `fontFamilies`. */
export const fontAssets = {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  OpenSans_400Regular,
  OpenSans_600SemiBold,
  OpenSans_700Bold,
} satisfies Record<FontFamily, number>;

export interface AppFontsState {
  /** `true` cuando las 6 fuentes están disponibles. */
  loaded: boolean;
  /** Error de carga. Si hay error, la app sigue con la fuente del sistema. */
  error: Error | null;
}

/** Carga las 6 fuentes de la app. Se llama una sola vez, en el layout raíz. */
export function useAppFonts(): AppFontsState {
  const [loaded, error] = useFonts(fontAssets);
  return { loaded, error };
}
