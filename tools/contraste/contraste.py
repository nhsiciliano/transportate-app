#!/usr/bin/env python3
"""Verificador de contraste WCAG 2.x para las paletas de Transportate.

Usa la fórmula de luminancia relativa del W3C:
https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio

Uso:
    python3 tools/contraste/contraste.py            # imprime tablas Markdown
    python3 tools/contraste/contraste.py --check    # sale con código 1 si falla algún par exigible

Cada par es (nombre, texto/primer plano, fondo, tipo). Tipos:
    "texto"  -> exige >= 4.5:1 (WCAG 1.4.3 AA, texto normal)
    "grande" -> exige >= 3:1   (texto grande: >= 18.66 px bold o >= 24 px)
    "ui"     -> exige >= 3:1   (WCAG 1.4.11: bordes de controles, íconos, anillo de foco)
    "exento" -> solo informativo (p. ej. texto deshabilitado, WCAG 1.4.3 lo exime)
"""
from __future__ import annotations

import sys

MINIMOS = {"texto": 4.5, "grande": 3.0, "ui": 3.0, "exento": 0.0}


def _canal(c8: int) -> float:
    c = c8 / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminancia(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    r, g, b = (int(h[i : i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * _canal(r) + 0.7152 * _canal(g) + 0.0722 * _canal(b)


def ratio(a: str, b: str) -> float:
    la, lb = luminancia(a), luminancia(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


# ---------------------------------------------------------------------------
# Paleta CLARA: tokens de Obelisco v2 tal cual (src/styles/variables/_colors.scss,
# HEAD c85a37e). Ver docs/02-obelisco-tokens.md para la cita de cada valor.
# ---------------------------------------------------------------------------
CLARA = {
    "white": "#ffffff",
    "body": "#08202f",  # $body-color = $blue-900
    "body-secondary": "#000b18",  # $body-secondary-color = $slate-950
    "primary": "#1d3343",  # $blue-800
    "secondary": "#035c80",  # $blue-700
    "tertiary": "#009688",  # $cyan-500
    "success": "#00642f",  # $green-700
    "danger": "#cb3232",  # $red-600
    "warning": "#e88700",  # $orange-400
    "info": "#00769a",  # $sky-600
    "light": "#edf4ff",  # $slate-50
    "dark": "#002230",  # $sky-900
    "text-warning": "#c47100",  # $orange-500
    "text-tertiary": "#000d0a",  # $cyan-950
    "placeholder": "#4a5766",  # $slate-700
    "disabled-text": "#92a0b1",  # $slate-400
    "disabled-bg": "#d6e4f6",  # $slate-100
    "border": "#d6e4f6",  # $border-color = $slate-100
    "focus": "#003832",  # $focus-color = $cyan-800
    "link": "#035c80",  # $link-color = $blue-700
    "hover-primary": "#000b15",  # btn primary hover $blue-950
    "hover-secondary": "#08202f",  # btn secondary hover $blue-900
    "green-50": "#d0ffda",
    "red-50": "#fff0ee",
    "orange-50": "#fff1e6",
    "sky-50": "#e7f6ff",
    "slate-100": "#d6e4f6",
    "sky-600": "#00769a",
    "green-600": "#007e3e",
    "red-600": "#cb3232",
    "orange-600": "#a25c00",
    "slate-600": "#626e7e",
    "sky-700": "#005d7b",
    "green-700": "#00642f",
    "red-700": "#ad0b1e",
    "orange-400": "#e88700",
    "purple-600": "#ad00f3",
    "purple-50": "#fbf0ff",
}
C = CLARA
PARES_CLARA = [
    ("Texto cuerpo / fondo", C["body"], C["white"], "texto"),
    ("Texto secundario / fondo", C["body-secondary"], C["white"], "texto"),
    ("Texto cuerpo / light", C["body"], C["light"], "texto"),
    ("Placeholder / fondo", C["placeholder"], C["white"], "texto"),
    ("Enlace / fondo", C["link"], C["white"], "texto"),
    ("Texto primary / fondo", C["primary"], C["white"], "texto"),
    ("Texto info / fondo", C["info"], C["white"], "texto"),
    ("Texto success / fondo", C["success"], C["white"], "texto"),
    ("Texto danger / fondo", C["danger"], C["white"], "texto"),
    ("Texto warning ($text-warning) / fondo", C["text-warning"], C["white"], "texto"),
    ("Btn primary: blanco / primary", C["white"], C["primary"], "texto"),
    ("Btn primary hover: blanco / blue-950", C["white"], C["hover-primary"], "texto"),
    ("Btn secondary: blanco / secondary", C["white"], C["secondary"], "texto"),
    ("Btn secondary hover: blanco / blue-900", C["white"], C["hover-secondary"], "texto"),
    ("Btn tertiary: blue-900 / tertiary", C["body"], C["tertiary"], "texto"),
    ("Btn success: blanco / success", C["white"], C["success"], "texto"),
    ("Btn danger: blanco / danger", C["white"], C["danger"], "texto"),
    ("Alert system info: blanco / secondary", C["white"], C["secondary"], "texto"),
    ("Alert system warning: primary / warning", C["primary"], C["warning"], "texto"),
    ("Alert success: cuerpo / green-50", C["body"], C["green-50"], "texto"),
    ("Alert danger: cuerpo / red-50", C["body"], C["red-50"], "texto"),
    ("Alert warning: cuerpo / orange-50", C["body"], C["orange-50"], "texto"),
    ("Alert info: cuerpo / sky-50", C["body"], C["sky-50"], "texto"),
    ("Alert borde success / green-50", C["success"], C["green-50"], "ui"),
    ("Alert borde warning / orange-50", C["warning"], C["orange-50"], "ui"),
    ("Badge sec. info: sky-600 / sky-50", C["sky-600"], C["sky-50"], "texto"),
    ("Badge sec. success: green-600 / green-50", C["green-600"], C["green-50"], "texto"),
    ("Badge sec. danger: red-600 / red-50", C["red-600"], C["red-50"], "texto"),
    ("Badge sec. warning: orange-600 / orange-50", C["orange-600"], C["orange-50"], "texto"),
    ("Badge sec. highlight: purple-600 / purple-50", C["purple-600"], C["purple-50"], "texto"),
    ("Badge sec. default: cuerpo / slate-100", C["body"], C["slate-100"], "texto"),
    ("Badge prim. default: blanco / slate-600", C["white"], C["slate-600"], "texto"),
    ("Badge prim. info: blanco / sky-700", C["white"], C["sky-700"], "texto"),
    ("Badge prim. success: blanco / green-700", C["white"], C["green-700"], "texto"),
    ("Badge prim. danger: blanco / red-700", C["white"], C["red-700"], "texto"),
    ("Badge prim. warning: blanco / orange-400", C["white"], C["orange-400"], "texto"),
    ("Anillo de foco cyan-800 / fondo", C["focus"], C["white"], "ui"),
    ("Outline input (cuerpo) / fondo", C["body"], C["white"], "ui"),
    ("Borde neutro slate-100 / fondo", C["border"], C["white"], "ui"),
    ("Btn tertiary (relleno) / fondo", C["tertiary"], C["white"], "ui"),
    ("Btn warning (relleno) / fondo", C["warning"], C["white"], "ui"),
    ("Deshabilitado: slate-400 / slate-100", C["disabled-text"], C["disabled-bg"], "exento"),
]

# ---------------------------------------------------------------------------
# Paleta OSCURA derivada (propuesta Transportate). Sale de las rampas
# primitivas de Obelisco (mismo matiz) invertidas en luminosidad.
# ---------------------------------------------------------------------------
OSCURA = {
    "bg-base": "#000b18",  # $slate-950
    "bg-elevated": "#121f2c",  # $slate-900
    "bg-card": "#1b2836",  # mezcla 50/50 slate-900/slate-800 (no primitiva)
    "bg-pressed": "#253240",  # $slate-800
    "text-primary": "#edf4ff",  # $slate-50
    "text-secondary": "#c7d4e6",  # $slate-200
    "text-tertiary": "#92a0b1",  # $slate-400
    "text-disabled": "#626e7e",  # $slate-600
    "border-subtle": "#253240",  # $slate-800 (decorativo)
    "border-strong": "#7a8697",  # $slate-500 (controles)
    "focus": "#73e6d5",  # $cyan-200
    "link": "#82bfe8",  # $blue-300
    "primary": "#a4d9ff",  # $blue-200
    "on-primary": "#08202f",  # $blue-900
    "secondary": "#67a5cd",  # $blue-400
    "on-secondary": "#000b15",  # $blue-950
    "tertiary": "#55cabb",  # $cyan-300
    "on-tertiary": "#000d0a",  # $cyan-950
    "danger": "#ff7266",  # $red-400
    "on-danger": "#1b0200",  # $red-950
    "success": "#5bce80",  # $green-300
    "on-success": "#000d00",  # $green-950
    "warning": "#ffa341",  # $orange-300
    "on-warning": "#120700",  # $orange-950
    "info": "#1ec6ff",  # $sky-300
    "on-info": "#000c13",  # $sky-950
    # contenedores (fondos de alertas/badges secundarios)
    "danger-container": "#450200",  # $red-900
    "on-danger-container": "#ffc5bd",  # $red-200
    "success-container": "#002509",  # $green-900
    "on-success-container": "#87faa9",  # $green-100
    "warning-container": "#2f1900",  # $orange-900
    "on-warning-container": "#ffc898",  # $orange-200
    "info-container": "#002230",  # $sky-900
    "on-info-container": "#98dcff",  # $sky-200
}
D = OSCURA
PARES_OSCURA = []
for fondo in ("bg-base", "bg-elevated", "bg-card"):
    PARES_OSCURA += [
        (f"Texto primario / {fondo}", D["text-primary"], D[fondo], "texto"),
        (f"Texto secundario / {fondo}", D["text-secondary"], D[fondo], "texto"),
        (f"Texto terciario / {fondo}", D["text-tertiary"], D[fondo], "texto"),
        (f"Enlace / {fondo}", D["link"], D[fondo], "texto"),
        (f"Borde fuerte (controles) / {fondo}", D["border-strong"], D[fondo], "ui"),
        (f"Anillo de foco / {fondo}", D["focus"], D[fondo], "ui"),
    ]
PARES_OSCURA += [
    ("Texto primario / bg-pressed", D["text-primary"], D["bg-pressed"], "texto"),
    ("Texto terciario / bg-pressed", D["text-tertiary"], D["bg-pressed"], "texto"),
]
for rol in ("primary", "secondary", "tertiary", "danger", "success", "warning", "info"):
    PARES_OSCURA += [
        (f"on-{rol} / {rol}", D[f"on-{rol}"], D[rol], "texto"),
        (f"{rol} (texto/ícono) / bg-base", D[rol], D["bg-base"], "texto"),
        (f"{rol} (texto/ícono) / bg-card", D[rol], D["bg-card"], "texto"),
    ]
for rol in ("danger", "success", "warning", "info"):
    PARES_OSCURA += [
        (f"on-{rol}-container / {rol}-container", D[f"on-{rol}-container"], D[f"{rol}-container"], "texto"),
        (f"Texto primario / {rol}-container", D["text-primary"], D[f"{rol}-container"], "texto"),
        (f"Borde {rol} / {rol}-container", D[rol], D[f"{rol}-container"], "ui"),
    ]
PARES_OSCURA += [
    ("Deshabilitado slate-600 / bg-card", D["text-disabled"], D["bg-card"], "exento"),
    ("Borde sutil slate-800 / bg-base (decorativo)", D["border-subtle"], D["bg-base"], "exento"),
]

# ---------------------------------------------------------------------------
# Paleta HISTÓRICA (app/out/, export viejo del sitio de docs). Solo referencia.
# ---------------------------------------------------------------------------
H = {
    "white": "#ffffff",
    "primary": "#336ACC",
    "secondary": "#101E37",
    "tertiary": "#005E7A",
    "danger": "#CC3333",
    "success": "#26874A",
    "warning": "#FF9500",
    "info": "#0086AD",
    "light": "#F3F6F9",
    "dark": "#002733",
}
PARES_HISTORICA = [
    (f"Blanco / {k}", H["white"], H[k], "texto")
    for k in ("primary", "secondary", "tertiary", "danger", "success", "warning", "info", "dark")
] + [
    (f"{k} (texto) / blanco", H[k], H["white"], "texto")
    for k in ("primary", "danger", "success", "warning", "info")
] + [("dark / light", H["dark"], H["light"], "texto")]


def tabla(titulo: str, pares: list[tuple[str, str, str, str]]) -> tuple[str, int]:
    filas = [
        f"#### {titulo}",
        "",
        "| Par | Primer plano | Fondo | Tipo | Ratio | Mínimo | Cumple |",
        "|---|---|---|---|---:|---:|:---:|",
    ]
    fallas = 0
    for nombre, fg, bg, tipo in pares:
        r = ratio(fg, bg)
        minimo = MINIMOS[tipo]
        if tipo == "exento":
            estado = "— (exento)"
        elif r >= minimo:
            estado = "✅"
        else:
            estado = "❌"
            fallas += 1
        filas.append(
            f"| {nombre} | `{fg.lower()}` | `{bg.lower()}` | {tipo} | {r:.2f}:1 | "
            f"{'—' if tipo == 'exento' else f'{minimo:g}:1'} | {estado} |"
        )
    return "\n".join(filas) + "\n", fallas


def main() -> int:
    salida = []
    total = {}
    for titulo, pares in (
        ("Paleta clara (Obelisco v2 vigente, tal cual)", PARES_CLARA),
        ("Paleta oscura derivada (propuesta)", PARES_OSCURA),
        ("Paleta histórica de app/out (referencia)", PARES_HISTORICA),
    ):
        t, f = tabla(titulo, pares)
        salida.append(t)
        total[titulo] = f
    print("\n".join(salida))
    print("Fallas por paleta: " + ", ".join(f"{k}: {v}" for k, v in total.items()))
    if "--check" in sys.argv:
        return 1 if total["Paleta oscura derivada (propuesta)"] else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
