// Inicio, piloto «Señalética de terminal» (F5-HIGH-A): Alert destacada, tira «Subte ahora»,
// bandas de señal de los favoritos (líder por cercanía con el permiso ya concedido) y fila meta.
// Cliente con `fetch` mockeado por ruta, favoritos en memoria y `expo-location` controlable.
import { act, userEvent, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { renderRouter, screen } from 'expo-router/testing-library';

import FavoritosRoute from '@/app/(tabs)/favoritos/index';
import InicioLayout from '@/app/(tabs)/inicio/_layout';
import InicioRoute from '@/app/(tabs)/inicio/index';
import SubtesLayout from '@/app/(tabs)/subtes/_layout';
import LineaRoute from '@/app/(tabs)/subtes/[linea]';
import EstacionRoute from '@/app/(tabs)/subtes/estacion/[id]';
import SubtesRoute from '@/app/(tabs)/subtes/index';
import { MmkvFavoritosRepository, type NuevoFavorito } from '@/features/favoritos';
import { SUBTE_NORMAL } from '@/features/inicio';
import { MemoryKeyValueStore } from '@/shared/storage/kv';
import { light } from '@/shared/theme';

import { locationMock } from './mocks/expo-location';
import {
  arribos,
  createHarness,
  defaultRoutes,
  errorBody,
  estaciones,
  estado,
  isoAgo,
  jsonResponse,
  VERSION,
  type Routes,
} from './subtes/fixtures';

// Montan el router y los providers reales: con la máquina cargada pasan los 5 s por defecto.
jest.setTimeout(30_000);

async function renderInicio(routes: Routes = defaultRoutes(), favoritos: NuevoFavorito[] = []) {
  const kv = new MemoryKeyValueStore();
  const repo = new MmkvFavoritosRepository(kv);
  for (const f of favoritos) repo.add(f);
  const harness = createHarness(routes, { kv });
  await renderRouter(
    {
      'inicio/_layout': InicioLayout,
      'inicio/index': InicioRoute,
      'subtes/_layout': SubtesLayout,
      'subtes/index': SubtesRoute,
      'subtes/[linea]': LineaRoute,
      'subtes/estacion/[id]': EstacionRoute,
      'favoritos/index': FavoritosRoute,
    },
    { initialUrl: '/inicio', wrapper: harness.Wrapper },
  );
  return harness;
}

const MEDRANO: NuevoFavorito = {
  tipo: 'estacion_subte',
  refId: '2002',
  nombre: 'Medrano',
  subtitulo: 'Línea B',
};
const CATEDRAL: NuevoFavorito = {
  tipo: 'estacion_subte',
  refId: '4001',
  nombre: 'Catedral',
  subtitulo: 'Línea D',
};
const LINEA_D: NuevoFavorito = {
  tipo: 'linea_subte',
  refId: 'D',
  nombre: 'Línea D',
  subtitulo: 'Congreso de Tucumán – Catedral',
};

const medranoArribos =
  (enSegundos = 240) =>
  () =>
    jsonResponse(
      arribos('2002', [
        { linea: 'B', estacion: 'Medrano', destino: 'Leandro N. Alem', enSegundos },
      ]),
    );
const catedralArribos = () =>
  jsonResponse(
    arribos('4001', [
      { linea: 'D', estacion: 'Catedral', destino: 'Congreso de Tucumán', enSegundos: 120 },
    ]),
  );

/** Estaciones con posiciones distintas: Catedral al lado del Obelisco, Medrano en Almagro. */
function estacionesConPosicion() {
  return {
    ...estaciones,
    estaciones: estaciones.estaciones.map((e) =>
      e.id === '4001'
        ? { ...e, lat: -34.6076, lon: -58.3737 }
        : e.id === '2002'
          ? { ...e, lat: -34.6033, lon: -58.4209 }
          : e,
    ),
  };
}

describe('Inicio: tira «Subte ahora»', () => {
  it('las 7 insignias en orden fijo, "funcionan con normalidad" y abre Subtes', async () => {
    await renderInicio();
    const tira = await screen.findByTestId('subte-ahora');
    expect(tira).toHaveStyle({ backgroundColor: light.bg.card, borderRadius: 6 });
    const insignias = screen.getAllByTestId(/^subte-ahora-[A-Z]+$/, {
      includeHiddenElements: true,
    });
    expect(insignias.map((i) => i.props.testID as string)).toEqual([
      'subte-ahora-A',
      'subte-ahora-B',
      'subte-ahora-C',
      'subte-ahora-D',
      'subte-ahora-E',
      'subte-ahora-H',
      'subte-ahora-PM',
    ]);
    expect(insignias[0]).toHaveStyle({ height: 28 });
    expect(screen.getByText(SUBTE_NORMAL, { includeHiddenElements: true })).toHaveStyle({
      color: light.text.secondary,
    });
    expect(screen.queryByTestId('alerta-destacada')).toBeNull();
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: `Subte ahora. ${SUBTE_NORMAL}.` }));
    expect(screen).toHavePathname('/subtes');
  });

  it('una línea con demoras: "B con demoras · resumen" en warning y sin Alert', async () => {
    await renderInicio({
      ...defaultRoutes(),
      '/v1/subtes/estado': () =>
        jsonResponse(estado({ B: { estado: 'demorada', resumen: 'Obras entre Medrano y Alem' } })),
    });
    const linea = await screen.findByText('B con demoras · Obras entre Medrano y Alem', {
      includeHiddenElements: true,
    });
    expect(linea).toHaveStyle({ color: light.role.warning.text });
    expect(screen.queryByTestId('alerta-destacada')).toBeNull();
  });

  it('varias con demoras: "B y D con demoras"', async () => {
    await renderInicio({
      ...defaultRoutes(),
      '/v1/subtes/estado': () =>
        jsonResponse(estado({ B: { estado: 'demorada' }, D: { estado: 'demorada' } })),
    });
    expect(
      await screen.findByText('B y D con demoras', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('una línea interrumpida: Alert destacada y la tira en danger', async () => {
    await renderInicio({
      ...defaultRoutes(),
      '/v1/subtes/estado': () =>
        jsonResponse(
          estado({ B: { estado: 'interrumpida', resumen: 'Interrumpida entre Medrano y Alem' } }),
        ),
    });
    expect(await screen.findByText('Línea B interrumpida')).toBeOnTheScreen();
    expect(
      screen.getByText('B interrumpida · Interrumpida entre Medrano y Alem', {
        includeHiddenElements: true,
      }),
    ).toHaveStyle({ color: light.role.danger.text });
    await userEvent.setup().press(screen.getByRole('button', { name: 'Ver la línea' }));
    expect(screen).toHavePathname('/subtes/B');
  });

  it('varias líneas interrumpidas: "N líneas con problemas" lleva a Subtes', async () => {
    await renderInicio({
      ...defaultRoutes(),
      '/v1/subtes/estado': () =>
        jsonResponse(
          estado({
            A: { estado: 'interrumpida' },
            'PM-C': { estado: 'interrumpida' },
            E: { estado: 'interrumpida' },
          }),
        ),
    });
    expect(await screen.findByText('3 líneas con problemas')).toBeOnTheScreen();
    expect(screen.getByText('Línea A, Línea E, Premetro')).toBeOnTheScreen();
    expect(
      screen.getByText('A, E y Premetro interrumpidas', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Ver el subte' }));
    expect(screen).toHavePathname('/subtes');
  });

  it('las 7 interrumpidas: "El subte no está funcionando"', async () => {
    const todas = Object.fromEntries(
      (['A', 'B', 'C', 'D', 'E', 'H', 'PM-C', 'PM-S'] as const).map((id) => [
        id,
        { estado: 'interrumpida' as const },
      ]),
    );
    await renderInicio({
      ...defaultRoutes(),
      '/v1/subtes/estado': () => jsonResponse(estado(todas)),
    });
    expect(await screen.findByText('El subte no está funcionando')).toBeOnTheScreen();
  });

  it('primera carga: skeleton de la tira; las bandas de favoritos ya se ven', async () => {
    await renderInicio({ ...defaultRoutes(), '/v1/subtes/estado': () => undefined }, [
      { ...MEDRANO },
    ]);
    expect(await screen.findByTestId('estado-skeleton')).toBeOnTheScreen();
    expect(
      screen.getByText('Línea B · Medrano', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('error sin caché: ErrorState dentro de la tira, bandas visibles y reintento', async () => {
    let falla = true;
    await renderInicio(
      {
        ...defaultRoutes(),
        '/v1/subtes/estado': () =>
          falla ? jsonResponse(errorBody('upstream_unavailable'), 503) : jsonResponse(estado()),
        '/v1/subtes/estaciones/2002/arribos': () => jsonResponse(arribos('2002', [])),
      },
      [{ ...MEDRANO }],
    );
    expect(await screen.findByTestId('estado-error')).toBeOnTheScreen();
    expect(screen.getByText('Servicio no disponible')).toBeOnTheScreen();
    expect(screen.getByText('Subte ahora')).toBeOnTheScreen();
    expect(screen.getByTestId('inicio-favorito-estacion_subte:2002')).toBeOnTheScreen();
    falla = false;
    await userEvent.setup().press(screen.getByRole('button', { name: 'Volver a intentar' }));
    expect(await screen.findByTestId('subte-ahora')).toBeOnTheScreen();
  });

  it('con datos y actualización fallida: Alert en línea debajo de la tira, que se queda', async () => {
    let falla = false;
    const harness = await renderInicio({
      ...defaultRoutes(),
      '/v1/subtes/estado': () =>
        falla ? jsonResponse(errorBody('upstream_unavailable'), 503) : jsonResponse(estado()),
    });
    await screen.findByTestId('subte-ahora');
    falla = true;
    await act(() => harness.queryClient.refetchQueries({ queryKey: ['subtes', 'estado'] }));
    expect(
      await screen.findByText('No pudimos actualizar. Mostramos lo último que sabemos.'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('subte-ahora')).toBeOnTheScreen();
  });
});

describe('Inicio: bandas de favoritos', () => {
  it('sin favoritos: EmptyState con "Explorar subtes"', async () => {
    await renderInicio();
    expect(
      await screen.findByText('Guardá tus líneas, paradas y estaciones para verlas acá.'),
    ).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Explorar subtes' }));
    expect(screen).toHavePathname('/subtes');
  });

  it('con 7 favoritos: 5 bandas (1 líder + 4) y "Ver todos los favoritos (7)"', async () => {
    const favs: NuevoFavorito[] = (['A', 'B', 'C', 'D', 'E', 'H', 'PM'] as const).map((k) => ({
      tipo: 'linea_subte',
      refId: k,
      nombre: k === 'PM' ? 'Premetro' : `Línea ${k}`,
    }));
    await renderInicio(defaultRoutes(), favs);
    await screen.findByTestId('subte-ahora');
    const bandas = screen.getAllByTestId(/^inicio-favorito-[^-]+$/);
    expect(bandas).toHaveLength(5);
    // Sin permiso de ubicación, la líder es la primera en el orden guardado.
    expect(bandas[0]?.props.testID).toBe('inicio-favorito-linea_subte:A');
    expect(bandas[0]).toHaveStyle({ minHeight: 148, backgroundColor: light.role.secondary.base });
    expect(bandas[1]).toHaveStyle({ minHeight: 72, backgroundColor: light.role.primary.base });
    // Las líneas de subte muestran su estado (sin «Próximo»: no es un arribo).
    expect(screen.getAllByText('Normal', { includeHiddenElements: true })).toHaveLength(5);
    expect(screen.queryByText('Próximo', { includeHiddenElements: true })).toBeNull();
    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Ver todos los favoritos (7)' }));
    expect(screen).toHavePathname('/favoritos');
  });

  it('líder con arribo: mensaje, «Próximo», minutos a 56 pt y etiqueta compuesta; abre el detalle', async () => {
    await renderInicio(
      { ...defaultRoutes(), '/v1/subtes/estaciones/2002/arribos': medranoArribos() },
      [{ ...MEDRANO }],
    );
    const banda = await screen.findByRole('button', {
      name: 'Estación Medrano, Línea B, Hacia Leandro N. Alem en 4 minutos',
    });
    expect(
      screen.getByText('Línea B · Medrano hacia Leandro N. Alem', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Próximo', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('4 min', { includeHiddenElements: true })).toHaveStyle({
      fontSize: 56,
      fontFamily: 'FiraSans_700Bold',
    });
    expect(screen.getByTestId('inicio-frescura')).toBeOnTheScreen();
    await userEvent.setup().press(banda);
    expect(screen).toHavePathname('/subtes/estacion/2002');
  });

  it('estación de una línea con demoras: cuadrado ámbar + «Con demoras» en la banda', async () => {
    await renderInicio(
      {
        ...defaultRoutes(),
        '/v1/subtes/estado': () => jsonResponse(estado({ B: { estado: 'demorada' } })),
        '/v1/subtes/estaciones/2002/arribos': medranoArribos(180),
      },
      [{ ...MEDRANO }],
    );
    expect(
      await screen.findByRole('button', {
        name: 'Estación Medrano, Línea B, Hacia Leandro N. Alem en 3 minutos, con demoras',
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId('signband-estado-cuadrado', { includeHiddenElements: true }),
    ).toHaveStyle({ backgroundColor: light.role.warning.base });
  });

  it('dato viejo: el valor se mantiene y suma «hace N min» sin cuadrado', async () => {
    await renderInicio(
      {
        ...defaultRoutes(),
        '/v1/subtes/estaciones/2002/arribos': () =>
          jsonResponse(
            arribos(
              '2002',
              [{ linea: 'B', estacion: 'Medrano', destino: 'Leandro N. Alem', enSegundos: 240 }],
              { sourceTimestamp: isoAgo(6 * 60), ageSeconds: 360 },
            ),
          ),
      },
      [{ ...MEDRANO }],
    );
    expect(
      await screen.findByText('hace 6 min', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByText('4 min', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(
      screen.queryByTestId('signband-estado-cuadrado', { includeHiddenElements: true }),
    ).toBeNull();
    expect(screen.getByText(/Dato de hace 6 min/)).toBeOnTheScreen();
  });

  it('error del dato vivo: «Sin información» y la banda sigue abriendo el detalle', async () => {
    await renderInicio(
      {
        ...defaultRoutes(),
        '/v1/subtes/estaciones/2002/arribos': () =>
          jsonResponse(errorBody('upstream_unavailable'), 503),
      },
      [{ ...MEDRANO }],
    );
    const banda = await screen.findByRole('button', {
      name: 'Estación Medrano, Línea B, Sin información',
    });
    await userEvent.setup().press(banda);
    expect(screen).toHavePathname('/subtes/estacion/2002');
  });

  it('con el permiso ya concedido, la líder es la estación más cercana', async () => {
    locationMock.setPermission('granted');
    locationMock.setPosition({ latitude: -34.6037, longitude: -58.3816 }); // Obelisco
    await renderInicio(
      {
        ...defaultRoutes(),
        [`/v1/static/${VERSION}/subte-estaciones.json`]: () =>
          jsonResponse(estacionesConPosicion()),
        '/v1/subtes/estaciones/2002/arribos': medranoArribos(),
        '/v1/subtes/estaciones/4001/arribos': catedralArribos,
      },
      [{ ...LINEA_D }, { ...MEDRANO }, { ...CATEDRAL }],
    );
    await screen.findByText('Línea D · Catedral hacia Congreso de Tucumán', {
      includeHiddenElements: true,
    });
    const orden = () =>
      screen.getAllByTestId(/^inicio-favorito-[^-]+$/).map((b) => b.props.testID as string);
    await waitFor(() => {
      expect(orden()).toEqual([
        'inicio-favorito-estacion_subte:4001',
        'inicio-favorito-linea_subte:D',
        'inicio-favorito-estacion_subte:2002',
      ]);
    });
    const bandas = screen.getAllByTestId(/^inicio-favorito-[^-]+$/);
    expect(bandas[0]).toHaveStyle({ minHeight: 148 });
    // Inicio nunca pide el permiso (S32): solo lo lee.
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('sin permiso: no pide ubicación y la líder es la primera', async () => {
    await renderInicio(
      {
        ...defaultRoutes(),
        [`/v1/static/${VERSION}/subte-estaciones.json`]: () =>
          jsonResponse(estacionesConPosicion()),
        '/v1/subtes/estaciones/2002/arribos': medranoArribos(),
        '/v1/subtes/estaciones/4001/arribos': catedralArribos,
      },
      [{ ...MEDRANO }, { ...CATEDRAL }],
    );
    await screen.findByText('Línea B · Medrano hacia Leandro N. Alem', {
      includeHiddenElements: true,
    });
    const bandas = screen.getAllByTestId(/^inicio-favorito-[^-]+$/);
    expect(bandas[0]?.props.testID).toBe('inicio-favorito-estacion_subte:2002');
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('alias: la banda muestra el alias y el lector lee alias, tipo y nombre', async () => {
    const harness = await renderInicio(
      { ...defaultRoutes(), '/v1/subtes/estaciones/2002/arribos': medranoArribos(120) },
      [{ ...MEDRANO }],
    );
    const fav = harness.repository.list()[0];
    if (fav === undefined) throw new Error('falta el favorito');
    await act(() => {
      harness.repository.setAlias(fav.id, 'Trabajo');
    });
    expect(
      await screen.findByRole('button', {
        name: 'Trabajo. Estación Medrano, Línea B, Hacia Leandro N. Alem en 2 minutos',
      }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Trabajo', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('Dynamic Type: valor con tope 1.2 y textos con tope 1.3; áreas táctiles ≥ 44', async () => {
    await renderInicio(
      { ...defaultRoutes(), '/v1/subtes/estaciones/2002/arribos': medranoArribos() },
      [{ ...MEDRANO }],
    );
    const valor = await screen.findByText('4 min', { includeHiddenElements: true });
    expect(valor.props.maxFontSizeMultiplier).toBe(1.2);
    expect(
      screen.getByText('Línea B · Medrano hacia Leandro N. Alem', { includeHiddenElements: true })
        .props.maxFontSizeMultiplier,
    ).toBe(1.3);
    expect(screen.getByRole('button', { name: 'Ver todos los favoritos (1)' })).toHaveStyle({
      minHeight: 44,
    });
  });
});
