// Inicio (tarea 4.4): estado del subte en 7 filas, Alert destacada, estados del bloque y
// favoritos con su dato vivo. Cliente con `fetch` mockeado por ruta y favoritos en memoria.
import { act, userEvent } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';

import FavoritosRoute from '@/app/(tabs)/favoritos/index';
import InicioLayout from '@/app/(tabs)/inicio/_layout';
import InicioRoute from '@/app/(tabs)/inicio/index';
import SubtesLayout from '@/app/(tabs)/subtes/_layout';
import LineaRoute from '@/app/(tabs)/subtes/[linea]';
import SubtesRoute from '@/app/(tabs)/subtes/index';
import { MmkvFavoritosRepository, type NuevoFavorito } from '@/features/favoritos';
import { MemoryKeyValueStore } from '@/shared/storage/kv';

import {
  arribos,
  createHarness,
  defaultRoutes,
  errorBody,
  estado,
  jsonResponse,
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
      'favoritos/index': FavoritosRoute,
    },
    { initialUrl: '/inicio', wrapper: harness.Wrapper },
  );
  return harness;
}

const ESTACION: NuevoFavorito = {
  tipo: 'estacion_subte',
  refId: '2002',
  nombre: 'Medrano',
  subtitulo: 'Línea B',
};

describe('Inicio: estado del subte', () => {
  it('7 filas en orden fijo, sin Alert destacada y con frescura', async () => {
    await renderInicio();
    const filas = await screen.findAllByTestId(/^inicio-linea-/);
    expect(filas.map((f) => f.props.testID as string)).toEqual([
      'inicio-linea-A',
      'inicio-linea-B',
      'inicio-linea-C',
      'inicio-linea-D',
      'inicio-linea-E',
      'inicio-linea-H',
      'inicio-linea-PM',
    ]);
    expect(screen.getByRole('button', { name: 'Línea B, normal' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Premetro, normal' })).toBeOnTheScreen();
    expect(screen.queryByTestId('alerta-destacada')).toBeNull();
    expect(screen.getByText(/Actualizado hace/)).toBeOnTheScreen();
  });

  it('una línea interrumpida: Alert destacada que lleva a la línea', async () => {
    await renderInicio({
      ...defaultRoutes(),
      '/v1/subtes/estado': () =>
        jsonResponse(
          estado({ B: { estado: 'interrumpida', resumen: 'Interrumpida entre Medrano y Alem' } }),
        ),
    });
    expect(await screen.findByText('Línea B interrumpida')).toBeOnTheScreen();
    expect(screen.getByText('Interrumpida entre Medrano y Alem')).toBeOnTheScreen();
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

  it('primera carga: skeleton de 7 filas; los favoritos ya se ven', async () => {
    await renderInicio({ ...defaultRoutes(), '/v1/subtes/estado': () => undefined }, [
      { ...ESTACION },
    ]);
    expect(await screen.findByTestId('estado-skeleton')).toBeOnTheScreen();
    expect(screen.getByText('Medrano')).toBeOnTheScreen();
  });

  it('error sin caché: ErrorState dentro del bloque, favoritos visibles y reintento', async () => {
    let falla = true;
    await renderInicio(
      {
        ...defaultRoutes(),
        '/v1/subtes/estado': () =>
          falla ? jsonResponse(errorBody('upstream_unavailable'), 503) : jsonResponse(estado()),
        '/v1/subtes/estaciones/2002/arribos': () => jsonResponse(arribos('2002', [])),
      },
      [{ ...ESTACION }],
    );
    expect(await screen.findByTestId('estado-error')).toBeOnTheScreen();
    expect(screen.getByText('Servicio no disponible')).toBeOnTheScreen();
    expect(screen.getByText('Medrano')).toBeOnTheScreen();
    falla = false;
    await userEvent.setup().press(screen.getByRole('button', { name: 'Volver a intentar' }));
    expect(await screen.findByTestId('inicio-linea-A')).toBeOnTheScreen();
  });

  it('con datos y actualización fallida: Alert en línea y las filas se quedan', async () => {
    let falla = false;
    const harness = await renderInicio({
      ...defaultRoutes(),
      '/v1/subtes/estado': () =>
        falla ? jsonResponse(errorBody('upstream_unavailable'), 503) : jsonResponse(estado()),
    });
    await screen.findByTestId('inicio-linea-A');
    falla = true;
    await act(() => harness.queryClient.refetchQueries({ queryKey: ['subtes', 'estado'] }));
    expect(
      await screen.findByText('No pudimos actualizar. Mostramos lo último que sabemos.'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('inicio-linea-A')).toBeOnTheScreen();
  });

  it('tocar una fila abre el detalle de la línea', async () => {
    await renderInicio();
    await userEvent.setup().press(await screen.findByTestId('inicio-linea-C'));
    expect(screen).toHavePathname('/subtes/C');
  });
});

describe('Inicio: favoritos', () => {
  it('sin favoritos: EmptyState con "Explorar subtes"', async () => {
    await renderInicio();
    expect(
      await screen.findByText('Guardá tus líneas, paradas y estaciones para verlas acá.'),
    ).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Explorar subtes' }));
    expect(screen).toHavePathname('/subtes');
  });

  it('con 7 favoritos muestra 5 y "Ver todos (7)"', async () => {
    const favs: NuevoFavorito[] = (['A', 'B', 'C', 'D', 'E', 'H', 'PM'] as const).map((k) => ({
      tipo: 'linea_subte',
      refId: k,
      nombre: k === 'PM' ? 'Premetro' : `Línea ${k}`,
    }));
    await renderInicio(defaultRoutes(), favs);
    await screen.findByTestId('inicio-linea-A');
    expect(screen.getAllByTestId(/^inicio-favorito-/)).toHaveLength(5);
    await userEvent.setup().press(screen.getByRole('button', { name: 'Ver todos (7)' }));
    expect(screen).toHavePathname('/favoritos');
  });

  it('la fila se lee como una unidad con alias, tipo, nombre y dato vivo, y abre su detalle', async () => {
    const harness = await renderInicio(
      {
        ...defaultRoutes(),
        '/v1/subtes/estaciones/2002/arribos': () =>
          jsonResponse(
            arribos('2002', [
              { linea: 'B', estacion: 'Medrano', destino: 'Leandro N. Alem', enSegundos: 120 },
            ]),
          ),
      },
      [{ ...ESTACION }],
    );
    const fav = harness.repository.list()[0];
    if (fav === undefined) throw new Error('falta el favorito');
    harness.repository.setAlias(fav.id, 'Trabajo');
    expect(
      await screen.findByRole('button', {
        name: 'Trabajo. Estación Medrano, Línea B. Hacia Leandro N. Alem en 2 minutos.',
      }),
    ).toBeOnTheScreen();
    expect(
      screen.getByText('→ Leandro N. Alem 2 min', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });
});
