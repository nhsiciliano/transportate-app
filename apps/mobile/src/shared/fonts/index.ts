// Fuente de la app: Fira Sans en los pesos 400/600/700, una sola familia para títulos y texto
// (dirección «Señalética de terminal», piloto de la Fase 5; antes Nunito + Open Sans, tarea 3.4).
// Nombres exactos en `docs/versiones.md` y `tokens.ts` (`fontFamily`).
//
// Se importan SOLO los 3 subpaths por peso de `@expo-google-fonts/fira-sans` 0.4.1: cada uno
// exporta el `require()` del `.ttf` empaquetado con la app (Metro lo trata como asset). Nada se
// descarga por red en ejecución (`docs/05-privacidad.md`); por eso no se usa `@expo-google-fonts/dev`.
//
// Carga con `useFonts` de `expo-font` y no con el config plugin de `expo-font`: con el plugin,
// iOS toma el nombre de familia del archivo (p. ej. "Fira Sans") y Android del nombre del archivo
// ("FiraSans_400Regular"), así que el `fontFamily` diferiría entre plataformas. Con `useFonts` el
// nombre es la clave del objeto y es el mismo en iOS, Android y Jest.
import { FiraSans_400Regular } from '@expo-google-fonts/fira-sans/400Regular';
import { FiraSans_600SemiBold } from '@expo-google-fonts/fira-sans/600SemiBold';
import { FiraSans_700Bold } from '@expo-google-fonts/fira-sans/700Bold';
import { useFonts } from 'expo-font';

/** Un `fontFamily` por peso: en RN no hay `fontWeight` sobre una familia cargada (DESIGN.md §3). */
const firaSans = {
  regular: 'FiraSans_400Regular',
  semibold: 'FiraSans_600SemiBold',
  bold: 'FiraSans_700Bold',
} as const;

/**
 * Títulos y texto usan la misma familia; se mantienen los dos roles para que la escala
 * (`tokens.ts`, `typography`) siga distinguiendo títulos de texto corrido (tope de Dynamic Type).
 */
export const fontFamilies = {
  /** Títulos y headlines. */
  heading: firaSans,
  /** Texto corrido y etiquetas. */
  body: firaSans,
} as const;

type FontGroup = (typeof fontFamilies)[keyof typeof fontFamilies];
export type FontFamily = FontGroup[keyof FontGroup];

/** Mapa `fontFamily` → asset para `useFonts`. Las claves son los nombres de `fontFamilies`. */
export const fontAssets = {
  FiraSans_400Regular,
  FiraSans_600SemiBold,
  FiraSans_700Bold,
} satisfies Record<FontFamily, number>;

export interface AppFontsState {
  /** `true` cuando las 3 fuentes están disponibles. */
  loaded: boolean;
  /** Error de carga. Si hay error, la app sigue con la fuente del sistema. */
  error: Error | null;
}

/** Carga las 3 fuentes de la app. Se llama una sola vez, en el layout raíz. */
export function useAppFonts(): AppFontsState {
  const [loaded, error] = useFonts(fontAssets);
  return { loaded, error };
}
