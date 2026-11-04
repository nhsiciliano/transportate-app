// Design tokens de Transportate: Obelisco v2 (identidad vigente) en claro + paleta oscura derivada.
//
// Fuentes: docs/02-obelisco-tokens.md y DESIGN.md (raíz; §2.1 superficies, §2.2 roles, §3.2 escala). Cada hoja cita la sección del doc y, entre paréntesis,
// el `archivo:línea` de Obelisco que ese doc cita (abreviaturas del doc: colors, typo, borders,
// c/<componente>, dist). TypeScript puro: sin imports de React Native, para poder usarlo en tests,
// scripts y en DESIGN.md (tarea 3.6).
//
// Decisiones que mandan sobre el doc (docs/00-plan.md, "Correcciones tras la Fase 1"):
// - Identidad VIGENTE: primary #1d3343, secondary #035c80, tertiary #009688.
// - Tipografía: Fira Sans en títulos y texto, pesos 400/600/700 (dirección «Señalética de
//   terminal», Fase 5; reemplaza a Nunito + Open Sans). El doc §2 cita Archivo para títulos en el
//   código vigente de Obelisco; la tipografía es libre por decisión del usuario (2026-11-03).

// ---------------------------------------------------------------- 1. Primitivas

export const primitives = {
  // 02-obelisco-tokens.md §1.1 (colors:3-13)
  yellow: {
    50: '#fff2da',
    100: '#ffdf97',
    200: '#ffcd02',
    300: '#dfb300',
    400: '#c09a00',
    500: '#a28100',
    600: '#856a00',
    700: '#6a5300',
    800: '#3d2f00',
    900: '#271d00',
    950: '#0f0800',
  },
  // 02-obelisco-tokens.md §1.1 (colors:16-26)
  blue: {
    50: '#e9f5ff',
    100: '#c7e7ff',
    200: '#a4d9ff',
    300: '#82bfe8',
    400: '#67a5cd',
    500: '#4c8cb3',
    600: '#2f7499',
    700: '#035c80',
    800: '#1d3343',
    900: '#08202f',
    950: '#000b15',
  },
  // 02-obelisco-tokens.md §1.1 (colors:29-39)
  cyan: {
    50: '#c5fff5',
    100: '#83f6e5',
    200: '#73e6d5',
    300: '#55cabb',
    400: '#35b0a1',
    500: '#009688',
    600: '#007b6f',
    700: '#006157',
    800: '#003832',
    900: '#00241f',
    950: '#000d0a',
  },
  // 02-obelisco-tokens.md §1.1 (colors:42-52)
  sky: {
    50: '#e7f6ff',
    100: '#c0e8ff',
    200: '#98dcff',
    300: '#1ec6ff',
    400: '#00abde',
    500: '#0090bc',
    600: '#00769a',
    700: '#005d7b',
    800: '#003548',
    900: '#002230',
    950: '#000c13',
  },
  // 02-obelisco-tokens.md §1.1 (colors:55-65)
  green: {
    50: '#d0ffda',
    100: '#87faa9',
    200: '#77ea9a',
    300: '#5bce80',
    400: '#3db368',
    500: '#179950',
    600: '#007e3e',
    700: '#00642f',
    800: '#003a18',
    900: '#002509',
    950: '#000d00',
  },
  // 02-obelisco-tokens.md §1.1 (colors:68-78)
  orange: {
    50: '#fff1e6',
    100: '#ffdcbf',
    200: '#ffc898',
    300: '#ffa341',
    400: '#e88700',
    500: '#c47100',
    600: '#a25c00',
    700: '#814800',
    800: '#4b2800',
    900: '#2f1900',
    950: '#120700',
  },
  // 02-obelisco-tokens.md §1.1 (colors:81-91)
  red: {
    50: '#fff0ee',
    100: '#ffdad5',
    200: '#ffc5bd',
    300: '#ff9e92',
    400: '#ff7266',
    500: '#ea4f48',
    600: '#cb3232',
    700: '#ad0b1e',
    800: '#6a0009',
    900: '#450200',
    950: '#1b0200',
  },
  // 02-obelisco-tokens.md §1.1 (colors:94-104)
  purple: {
    50: '#fbf0ff',
    100: '#f5d9ff',
    200: '#efc4ff',
    300: '#e39eff',
    400: '#d576ff',
    500: '#c447ff',
    600: '#ad00f3',
    700: '#8a00c3',
    800: '#520077',
    900: '#360051',
    950: '#1b0022',
  },
  // 02-obelisco-tokens.md §1.1 (colors:107-117): neutro azulado de Obelisco
  slate: {
    50: '#edf4ff',
    100: '#d6e4f6',
    200: '#c7d4e6',
    300: '#acb9cb',
    400: '#92a0b1',
    500: '#7a8697',
    600: '#626e7e',
    700: '#4a5766',
    800: '#253240',
    900: '#121f2c',
    950: '#000b18',
  },
  // 02-obelisco-tokens.md §1.1 (colors:120-131)
  gray: {
    0: '#ffffff',
    50: '#f3f3f3',
    100: '#e2e2e2',
    200: '#d3d3d3',
    300: '#b8b8b8',
    400: '#9e9e9e',
    500: '#858585',
    600: '#6d6d6d',
    700: '#565656',
    800: '#313131',
    900: '#1e1e1e',
    950: '#090909',
  },
} as const;

export type Primitives = typeof primitives;

// ---------------------------------------------------------------- 2. Esquemas de color

export type RoleName =
  'primary' | 'secondary' | 'tertiary' | 'danger' | 'success' | 'warning' | 'info';

export interface RoleColors {
  /** Relleno sólido del rol (botón, badge primaria, alert `system`). */
  base: string;
  /** Texto/ícono sobre `base`. */
  on: string;
  /** Fondo presionado/hover de `base`. */
  hover: string;
  /** Fondo suave del rol (alert estándar, badge secundaria). */
  container: string;
  /** Texto/ícono sobre `container`. */
  onContainer: string;
  /**
   * El rol usado como texto, ícono o borde sobre `bg.base`/`container` (≥ 4.5:1 en claro).
   * Ej.: "Dato de hace 4 min" en warning, borde de la alert estándar. DESIGN.md §2.2 notas.
   */
  text: string;
}

export interface ColorScheme {
  bg: { base: string; elevated: string; card: string; pressed: string; disabled: string };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    placeholder: string;
    link: string;
    inverse: string;
  };
  border: { subtle: string; strong: string; focus: string };
  focusRing: { color: string; width: number; subtleWidth: number };
  role: Record<RoleName, RoleColors>;
  /** Neutro para insignias y chips sin rol (badge "default", número de colectivo). */
  neutral: {
    container: string;
    onContainer: string;
    border: string;
    solid: string;
    onSolid: string;
  };
}

const p = primitives;

/** Obelisco v2 tal cual (§1), con los ajustes de contraste de §7 para la app. */
export const light: ColorScheme = {
  bg: {
    base: p.gray[0], // 02-obelisco-tokens.md §1.3 fondo body (dist:85)
    elevated: p.slate[50], // §1.2 light (colors:142)
    card: p.gray[0], // §4 Card: sin fondo propio, outline (c/cards:63-70)
    pressed: p.slate[100], // §1.5 link activo slate-100 (c/button:8-12)
    disabled: p.slate[100], // §1.3 fondo deshabilitado (colors:208)
  },
  text: {
    primary: p.blue[900], // §1.3 texto cuerpo (colors:180)
    // Obelisco usa $body-secondary-color slate-950 (más oscuro que el cuerpo); en la app
    // "secondary" es texto de menor jerarquía: slate-700, el placeholder de §1.3 (7.38:1, §7).
    secondary: p.slate[700], // §1.3 placeholder (colors:224)
    tertiary: p.slate[600], // §7 badge prim. default slate-600 (5.18:1 sobre blanco)
    disabled: p.slate[400], // §1.3 texto deshabilitado (colors:207)
    placeholder: p.slate[700], // §1.3 placeholder (colors:224)
    link: p.blue[700], // §1.3 enlace (colors:212)
    inverse: p.gray[0], // §1.3 $text-white (typo:170)
  },
  border: {
    subtle: p.slate[100], // §1.3 borde neutro (colors:216); solo decorativo (§7 fix 4)
    strong: p.blue[900], // §4 Input outline $body-color (c/form-text:215-226), 16.69:1
    focus: p.cyan[800], // §1.4 color de foco (colors:191)
  },
  focusRing: {
    color: p.cyan[800], // §1.4 (colors:191)
    width: 4, // §1.4 anillo 0.25rem (colors:192)
    subtleWidth: 2, // §1.4 anillo sutil 0.125rem (colors:193)
  },
  role: {
    primary: {
      base: p.blue[800], // §1.2 primary (colors:135)
      on: p.gray[0], // §1.5 primary texto blanco (c/button:24)
      hover: p.blue[950], // §1.5 primary hover (c/button:203)
      container: p.slate[50], // §1.2 light (colors:142)
      onContainer: p.blue[800], // §1.3 $text-primary (typo:159)
      text: p.blue[800], // §1.3 $text-primary (typo:159)
    },
    secondary: {
      base: p.blue[700], // §1.2 secondary (colors:136)
      on: p.gray[0], // §1.5 secondary texto blanco (c/button:25)
      hover: p.blue[900], // §1.5 secondary hover (c/button:25)
      container: p.blue[50], // §1.1 blue-50 (colors:16)
      onContainer: p.blue[700], // §1.3 $text-secondary (typo:160)
      text: p.blue[700], // §1.3 $text-secondary (typo:160)
    },
    tertiary: {
      base: p.cyan[500], // §1.2 tertiary (colors:137)
      on: p.blue[900], // §1.5 tertiary texto blue-900 (c/button:26), 4.55:1 (§7)
      hover: p.cyan[600], // §1.5 tertiary hover (c/button:235-237)
      container: p.cyan[50], // §1.1 cyan-50 (colors:29)
      onContainer: p.cyan[800], // §1.4 cyan-800 (colors:191)
      text: p.cyan[700], // cyan-700 (colors:36): cyan-500 como texto no llega a 4.5:1 sobre blanco
    },
    danger: {
      base: p.red[600], // §1.2 danger (colors:141)
      on: p.gray[0], // §1.5 danger texto blanco (c/button:28)
      hover: p.red[500], // §1.4 hover danger (colors:186)
      container: p.red[50], // §1.2 fondos semánticos (colors:172-177)
      onContainer: p.blue[900], // DESIGN.md §2.2 contenedor claro: texto #08202f (colors:172-177)
      text: p.red[600], // §4 Badge secundaria danger (c/badge:7-41), 4.69:1
    },
    success: {
      base: p.green[700], // §1.2 success (colors:140)
      on: p.gray[0], // §1.5 success texto blanco (c/button:29)
      hover: p.green[800], // §1.1 green-800: un paso más oscuro (Obelisco no cambia el fondo)
      container: p.green[50], // §1.2 fondos semánticos (colors:172-177)
      onContainer: p.blue[900], // DESIGN.md §2.2 contenedor claro: texto #08202f (colors:172-177)
      text: p.green[600], // §4 Badge secundaria success (c/badge:7-41)
    },
    warning: {
      base: p.orange[400], // §1.2 warning (colors:139)
      on: p.blue[800], // §4 Alert system warning usa $primary (c/alert:85-98), 4.91:1 (§7 fix 3)
      hover: p.orange[500], // §1.1 orange-500 (colors:73)
      container: p.orange[50], // §1.2 fondos semánticos (colors:172-177)
      onContainer: p.blue[900], // DESIGN.md §2.2 contenedor claro: texto #08202f (colors:172-177)
      text: p.orange[600], // §7 fix 1 / DESIGN.md §2.2: warning como texto #a25c00
    },
    info: {
      base: p.sky[600], // §1.2 info (colors:138)
      on: p.gray[0], // §7 texto info/blanco 5.17:1
      hover: p.sky[700], // §4 Badge primaria info sky-700 (c/badge:47-72)
      container: p.sky[50], // §1.2 fondos semánticos (colors:172-177)
      onContainer: p.blue[900], // DESIGN.md §2.2 contenedor claro: texto #08202f (colors:172-177)
      text: p.sky[600], // §4 Badge secundaria info (c/badge:7-41), 5.17:1
    },
  },
  neutral: {
    container: p.slate[100], // §4 Badge secundaria default slate-100 (c/badge:7-41)
    onContainer: p.blue[900], // §4 Badge secundaria default texto cuerpo, 12.95:1 (§7)
    border: p.blue[900], // §4 Badge secundaria default borde cuerpo (c/badge:7-41)
    solid: p.slate[600], // §4 Badge primaria default slate-600 (c/badge:47-72)
    onSolid: p.gray[0], // §7 blanco / slate-600 5.18:1
  },
};

/**
 * Paleta oscura derivada (§6): mismo matiz, luminosidad invertida, contenedores en 900 con texto
 * 100–200 de la misma rampa. Verificada en §7 (0 fallas). Los `hover` y los contenedores de
 * primary/secondary/tertiary no están en la tabla de §6: se derivan con los mismos criterios
 * (hover = un paso más claro en la misma rampa; contenedor = 900 + texto 100/200).
 */
export const dark: ColorScheme = {
  bg: {
    base: p.slate[950], // §6 bg.base
    elevated: p.slate[900], // §6 bg.elevated
    card: '#1b2836', // §6 bg.card: mezcla 50 % slate-900/slate-800 (única no primitiva)
    pressed: p.slate[800], // §6 bg.pressed
    disabled: p.slate[800], // §1.3 deshabilitado sobre oscuro (colors:209) → slate-800 en §6
  },
  text: {
    primary: p.slate[50], // §6 text.primary
    secondary: p.slate[200], // §6 text.secondary
    tertiary: p.slate[400], // §6 text.tertiary
    disabled: p.slate[600], // §6 text.disabled
    placeholder: p.slate[400], // §6 text.tertiary (7.43:1 sobre bg.base, §7)
    link: p.blue[300], // §6 text.link
    inverse: p.blue[900], // DESIGN.md §2.1 (on-primary oscuro, texto sobre rellenos claros)
  },
  border: {
    subtle: p.slate[800], // §6 border.subtle (decorativo)
    strong: p.slate[500], // §6 border.strong (controles, ≥ 3:1)
    focus: p.cyan[200], // §6 focus
  },
  focusRing: {
    color: p.cyan[200], // §6 focus, anillo 4 px
    width: 4, // §1.4 (colors:192)
    subtleWidth: 2, // §1.4 (colors:193)
  },
  role: {
    primary: {
      base: p.blue[200], // §6 primary
      on: p.blue[900], // §6 on-primary
      hover: p.blue[100], // derivado (§6 criterio 2)
      container: p.blue[900], // derivado (§6 criterio 3)
      onContainer: p.blue[200], // derivado (§6 criterio 3)
      text: p.blue[200], // §6 primary (sobre fondos oscuros el relleno ya es claro)
    },
    secondary: {
      base: p.blue[400], // §6 secondary
      on: p.blue[950], // §6 on-secondary
      hover: p.blue[300], // derivado (§6 criterio 2)
      container: p.blue[900], // derivado (§6 criterio 3)
      onContainer: p.blue[100], // derivado (§6 criterio 3)
      text: p.blue[400], // §6 secondary (sobre fondos oscuros el relleno ya es claro)
    },
    tertiary: {
      base: p.cyan[300], // §6 tertiary
      on: p.cyan[950], // §6 on-tertiary
      hover: p.cyan[200], // derivado (§6 criterio 2)
      container: p.cyan[900], // derivado (§6 criterio 3)
      onContainer: p.cyan[100], // derivado (§6 criterio 3)
      text: p.cyan[300], // §6 tertiary (sobre fondos oscuros el relleno ya es claro)
    },
    danger: {
      base: p.red[400], // §6 danger
      on: p.red[950], // §6 on-danger
      hover: p.red[300], // derivado (§6 criterio 2)
      container: p.red[900], // §6 danger.container
      onContainer: p.red[200], // §6 danger.container on
      text: p.red[400], // §6 danger (sobre fondos oscuros el relleno ya es claro)
    },
    success: {
      base: p.green[300], // §6 success
      on: p.green[950], // §6 on-success
      hover: p.green[200], // derivado (§6 criterio 2)
      container: p.green[900], // §6 success.container
      onContainer: p.green[100], // §6 success.container on
      text: p.green[300], // §6 success (sobre fondos oscuros el relleno ya es claro)
    },
    warning: {
      base: p.orange[300], // §6 warning
      on: p.orange[950], // §6 on-warning
      hover: p.orange[200], // derivado (§6 criterio 2)
      container: p.orange[900], // §6 warning.container
      onContainer: p.orange[200], // §6 warning.container on
      text: p.orange[300], // §6 warning (sobre fondos oscuros el relleno ya es claro)
    },
    info: {
      base: p.sky[300], // §6 info
      on: p.sky[950], // §6 on-info
      hover: p.sky[200], // derivado (§6 criterio 2)
      container: p.sky[900], // §6 info.container
      onContainer: p.sky[200], // §6 info.container on
      text: p.sky[300], // §6 info (sobre fondos oscuros el relleno ya es claro)
    },
  },
  neutral: {
    container: p.slate[800], // §6 bg.pressed (texto primario 11.80:1, §7)
    onContainer: p.slate[50], // §6 text.primary
    border: p.slate[500], // §6 border.strong
    solid: p.slate[400], // §6 text.tertiary como relleno
    onSolid: p.slate[950], // §6 bg.base
  },
};

export const schemes = { light, dark } as const;
export type SchemeName = keyof typeof schemes;

// ---------------------------------------------------------------- 3. Tipografía

/**
 * Nombres de `fontFamily` que exporta @expo-google-fonts/fira-sans (0.4.1). Una sola familia,
 * tres pesos: `heading` y `text` apuntan a la misma; se separan para que la escala siga sabiendo
 * qué es título (tope de Dynamic Type 1.2) y qué es texto (1.3). En RN no hay cascada de pesos:
 * cada peso es una familia distinta. Mientras la fuente no está cargada, RN usa la del sistema
 * (no rompe el layout).
 */
const firaSans = {
  400: 'FiraSans_400Regular',
  600: 'FiraSans_600SemiBold',
  700: 'FiraSans_700Bold',
} as const;

export const fontFamily = {
  heading: firaSans,
  text: firaSans,
} as const;

export type FontWeight = 400 | 600 | 700;
export type FontRole = keyof typeof fontFamily;

export interface TypeStyle {
  family: FontRole;
  size: number;
  lineHeight: number;
  weight: FontWeight;
}

const t = (family: FontRole, size: number, lineHeight: number, weight: FontWeight): TypeStyle => ({
  family,
  size,
  lineHeight,
  weight,
});

export const typography = {
  // 02-obelisco-tokens.md §2 pesos normal/semibold/bold (dist:8376-8389)
  weight: { regular: 400, semibold: 600, bold: 700 },
  // §2.1 headings, tamaños MOBILE (< md) cuando existen (typo:4-28)
  heading: {
    h1: t('heading', 38, 48, 700), // §2.1 h1 mobile 2.375rem / 3rem (typo:10,15,23)
    h2: t('heading', 34, 44, 600), // §2.1 h2 mobile 2.125rem / 2.75rem (typo:11,16,24)
    h3: t('heading', 30, 44, 600), // §2.1 h3 mobile 1.875rem / 2.75rem (typo:12,17,25)
    h4: t('heading', 28, 36, 600), // §2.1 h4 1.75rem / 2.25rem (typo:7,18,26)
    h5: t('heading', 24, 32, 600), // §2.1 h5 1.5rem / 2rem (typo:8,19,27)
    h6: t('heading', 20, 28, 600), // §2.1 h6 1.25rem / 1.75rem (typo:9,20,28)
  },
  // §2.2 titulares (typo:68-100)
  headline: {
    lg: t('heading', 20, 24, 700), // §2.2 headline-lg (typo:70,75,80)
    md: t('heading', 18, 24, 600), // §2.2 headline-md (typo:71,76,81)
    sm: t('heading', 16, 20, 600), // §2.2 headline-sm (typo:72,77,82)
  },
  // §2.3 cuerpo, peso 400 (typo:102-151)
  text: {
    xl: t('text', 20, 28, 400), // §2.3 text-xl (typo:104,112,119)
    lg: t('text', 18, 28, 400), // §2.3 text-lg (typo:105,113,120)
    md: t('text', 16, 24, 400), // §2.3 text-md = p (typo:107,114,121)
    sm: t('text', 14, 20, 400), // §2.3 text-sm = small (typo:108,115,122)
    xs: t('text', 12, 16, 400), // §2.3 text-xs (typo:109,116,123)
  },
} as const;

type Groups = 'heading' | 'headline' | 'text';
/** Variante tipográfica: `heading.h1`, `headline.md`, `text.sm`… */
export type TextVariant = {
  [G in Groups]: `${G}.${Extract<keyof (typeof typography)[G], string>}`;
}[Groups];

/** Busca la variante (`'headline.md'`) en la escala. */
export function typeStyle(variant: TextVariant): TypeStyle {
  const [group, key] = variant.split('.') as [Groups, string];
  const scale: Record<string, TypeStyle> = typography[group];
  const style = scale[key];
  if (!style) throw new Error(`Variante tipográfica desconocida: ${variant}`);
  return style;
}

/**
 * Tope de escalado de fuente (Dynamic Type / tamaño de fuente de Android), DESIGN.md §3.2:
 * 1.3 en texto corrido y 1.2 en títulos, headlines y etiquetas de tab (suposición del plan,
 * tarea 3.4). Los títulos ya son grandes (h1 38 → 46) y las etiquetas de tab/segmento viven en
 * controles de alto fijo: más escala los trunca. Con escala grande las filas crecen en alto;
 * nunca se trunca el estado ni la frescura (docs/briefs/README.md).
 */
export const maxFontSizeMultiplier = { heading: 1.2, text: 1.3 } as const;

// ---------------------------------------------------------------- 4. Espaciado, radios, bordes

// §3.1 escala de spacers (dist:8080-8101) y space-units n × 4 (mixins:1-5)
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 16,
  4: 24,
  5: 48,
  unit: 4,
} as const;

// §3.2 radios (borders:2-14)
export const radius = {
  xs: 1, // borders:2
  sm: 2, // borders:3
  md: 4, // borders:4
  lg: 6, // borders:5
  xl: 8, // borders:6
  '2xl': 12, // borders:7
  '3xl': 16, // borders:8
  '4xl': 20, // borders:9
  '5xl': 24, // borders:10
  '6xl': 32, // borders:11 (cards en web)
  pill: 9999, // borders:14
} as const;

export const borderWidth = {
  hairline: 1, // §1.3 borde neutro 1 px (dist:106,108)
  control: 2, // §1.3 $outline-border 0.125rem (colors:219); §1.5 outline 2 px (c/button:206)
} as const;

/** Obelisco no usa sombras: separa superficies con outline de 2 px (§3.3). */
export const elevation = {
  none: { borderWidth: 0 },
  outline: { borderWidth: borderWidth.control }, // §3.3 card outline (c/cards:63-70)
} as const;

// ---------------------------------------------------------------- 5. Componentes

/** Área táctil mínima: 44×44 pt iOS / 48×48 dp Android (docs/briefs/README.md, "Interacción común"). */
export const hitSlop = 44;

export const component = {
  button: {
    height: { sm: 32, md: 40, lg: 48 }, // §4 Button (c/button:129,142,152)
    paddingX: { sm: 8, md: 16, lg: 20 }, // §3.1 botón 4×8 / 8×16 / 12×20 (c/button:2-4)
    paddingY: { sm: 4, md: 8, lg: 12 }, // §3.1 (c/button:2-4)
    iconSize: { sm: 16, md: 18, lg: 20 }, // §4 Button ícono (c/button:137,147,157)
    gap: 4, // §4 Button gap (c/button:133)
    radius: radius.pill, // §4 Button radio pill (c/button:128)
    outlineWidth: borderWidth.control, // §1.5 outline 2 px (c/button:206-207)
  },
  badge: {
    height: { sm: 20, md: 24 }, // §4 Badge (c/badge:3,222-228)
    paddingX: 8, // §4 Badge padding 4×8 (c/badge:199)
    paddingY: { sm: 2, md: 4 }, // §4 Badge (c/badge:199,222-228)
    radius: radius.lg, // §4 Badge radio 6 (c/badge:191-204)
    staticRadius: radius.xl, // §4 Badge estática radio 8 (c/badge:80,88)
    gap: 4, // §4 Badge gap (c/badge:191-204)
    iconSize: 20, // §4 Badge ícono (c/badge:238)
    borderWidth: borderWidth.hairline, // §4 Chip/badge clickeable borde 1 px (c/badge:92-135)
  },
  chip: {
    minHeight: 32, // §4 Chip: badge secundaria clickeable con alto ≥ 32
    paddingX: 12, // derivado de badge paddingX 8 + borde (§4 Chip)
    radius: radius.pill, // §4 Tabs pill (c/nav:4-8), consistente con filtros tipo pill
  },
  card: {
    padding: 16, // §4 Card body 24 en web (c/cards:2); en teléfono 16 (§3.1 spacer 3)
    // §4 Card radio 32 (`6xl`, c/cards:63-70) en web. En nativo, 6 (`lg`): la dirección
    // «Señalética de terminal» (Fase 5) fija radio 6 y sin sombra para toda superficie elevada
    // (bandas, tira «Subte ahora», tarjetas), para que las placas se lean como señales y no como
    // tarjetas infladas. Antes de la Fase 5 era 16 (`3xl`).
    radius: radius.lg,
    webRadius: radius['6xl'],
    outlineWidth: borderWidth.control, // §3.3 card outline 0.125rem (colors:219)
  },
  alert: {
    // §4 Alert mobile 16/16/16/52 (c/alert:2-3)
    padding: { top: 16, right: 16, bottom: 16, left: 52 },
    iconSize: 24, // §4 Alert ícono 24 (c/alert:63-68)
    iconInset: 16, // §4 Alert ícono a 16 del borde (c/alert:63-68)
    gap: 8, // §4 Alert gap (c/alert:2-12)
    radius: radius.lg, // §4 Alert radio 6 (c/alert:52-58)
    outlineWidth: borderWidth.hairline, // §4 Alert outline 1 px (c/alert:52-58)
  },
  input: {
    height: 48, // §4 Input alto de controles 48 (c/form-text:176,186)
    paddingX: 16, // §4 Input padding 12×16 (c/form-text:217)
    radius: radius.pill, // §4 Input radio pill (c/form-text:215-226)
    outlineWidth: borderWidth.control, // §4 Input outline 0.125rem (c/form-text:215-226)
    iconInset: 16, // §4 Búsqueda: lupa a 16 del borde (c/form-text:321-327)
    iconPadding: 50, // §4 Búsqueda: padding lateral 50 (c/form-text:321-327)
  },
  tab: {
    height: { sm: 32, md: 40, lg: 48 }, // §4 Nav-link pill alto mín. (c/nav:4-8,18-37)
    paddingX: 16, // §4 Nav-link padding 8×16 (c/nav:6)
    radius: radius.pill, // §4 Nav-link radio pill (c/nav:4-8)
    indicator: 4, // §4 Tabs subrayado 4 px (c/tabs:58-62)
  },
  lineBadge: {
    size: { sm: 24, md: 32, lg: 44 }, // sm/md como badge+; lg = área táctil (hitSlop)
    paddingX: 6, // colectivo: número con aire mínimo (badge paddingX 8 − borde 1 − ajuste óptico)
    radius: radius.xl, // §4 Badge estática radio 8 (c/badge:80,88)
  },
  /** Insignias con texto (letra de línea, glifo de estado): son íconos, no párrafos. */
  badgeFontScale: 1.3,
  hitSlop,
} as const;

/** Duraciones de animación: solo para comunicar estado (docs/briefs/README.md, "Movimiento"). */
export const motion = {
  fast: 150,
  normal: 200,
  slow: 250,
} as const;

// ---------------------------------------------------------------- tipos derivados

export type Space = typeof space;
export type Radius = typeof radius;
export type Typography = typeof typography;
export type ComponentTokens = typeof component;
