# Íconos

`Icon` dibuja Material Symbols Rounded (FILL 1) como SVG con `react-native-svg`. La decisión está en `docs/adr/ADR-0004-iconos-material-symbols.md`; la tabla de usos, con la verificación de cada archivo, en `docs/08-design-system.md`.

```tsx
import { Icon } from '@/shared/icons';

<Icon name="subtes" />                                            {/* decorativo: junto a un texto */}
<Icon name="interrumpida" accessibilityLabel="Servicio interrumpido" />  {/* con significado propio */}
```

| Prop | Tipo | Default |
|---|---|---|
| `name` | `IconName` (clave de `iconMap`) | — |
| `size` | `16 \| 20 \| 24 \| 32` | `24` |
| `color` | `string` | `colors.text.primary` del tema activo (`useTheme()`, claro u oscuro) |
| `accessibilityLabel` | `string`; si está, el ícono deja de ser decorativo | — |
| `decorative` | `true` oculta a VoiceOver/TalkBack; `false` exige `accessibilityLabel` | `true` si no hay etiqueta |
| `testID` | `string`, va en el `View` contenedor | — |

## Archivos

| Archivo | Qué hace |
|---|---|
| `map.ts` | Mapa curado: 45 usos sobre 42 SVG de `@material-symbols/svg-400` 0.48.2. **Cada SVG se importa de forma explícita**, así que Metro empaqueta solo esos. Exporta `iconMap` y `IconName`. |
| `Icon.tsx` | Componente. `View` contenedor de `size` × `size` con las props de accesibilidad y el `Svg` adentro. |
| `svg.d.ts` | Declara `*.svg` como `FC<SvgProps>`. |
| `index.ts` | Exporta `Icon`, `IconProps`, `IconSize`, `iconMap`, `IconName`. |

## Cómo se importan los `.svg`

- **Metro:** `apps/mobile/metro.config.js` usa `react-native-svg-transformer/expo` (SVGR + SVGO) y mueve `svg` de `assetExts` a `sourceExts`.
- **Jest:** `jest.config.js` transforma los `.svg` con `test/mocks/svg-transformer.js`, que exporta un componente que renderiza un `View` con `testID="svg:<archivo>"` (por ejemplo `svg:subway-fill`) y las mismas props que recibiría `Svg`. Así los tests (`test/icons.test.tsx`) verifican qué glifo se eligió, su `width`/`height` y su `fill`.
- Los SVG del paquete tienen `viewBox="0 -960 960 960"` y un solo `<path>`; el transformer conserva el `viewBox` y deja que `fill` se herede del `Svg`.

## Sumar un ícono

1. Elegí el nombre de Material Symbols y verificá el archivo: `curl -sI https://cdn.jsdelivr.net/npm/@material-symbols/svg-400@0.48.2/rounded/<nombre>-fill.svg` tiene que dar `200`.
2. Agregá el `import` y la entrada en `map.ts` (nombre de uso en camelCase, comentario con el uso).
3. Agregá la fila en `docs/08-design-system.md` y ajustá la cantidad que chequea `test/icons.test.tsx`.

## Excepción de FILL

`favoritoOff` usa `rounded/star.svg` (contorno, FILL 0) para que "no es favorito" se distinga de `favoritoOn` sin depender solo del color. Es la única excepción a FILL 1 y está pendiente de validación del usuario (`docs/08-design-system.md`, nota 1).

## Licencia

`@material-symbols/svg-400` es Apache-2.0. La pantalla Acerca de tiene que mencionar los íconos (ver `docs/08-design-system.md`, "Licencia y atribución").
