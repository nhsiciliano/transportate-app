// Ajustes (tarea 4.10; brief `docs/briefs/06-ajustes.md`). Lista agrupada con filas de ≥ 44 pt.
// Cada cambio se aplica al instante y se guarda solo (sin botón "Guardar"):
// - Tema → `useTheme().setPreference` (el ThemeProvider de la app persiste en MMKV).
// - Intervalo → `useRefreshInterval().setSeconds` (RefreshIntervalProvider ← MMKV).
// - Índice → `useManifest()` + avance de la descarga de los archivos grandes (`IndiceRow`).
// - Ubicación → estado real del permiso (`usePermisoUbicacion`); tocar pide o abre la configuración.
// - Limpiar datos → vacía el QueryClient y la caché persistida; no toca favoritos ni ajustes.
// - Borrar favoritos → confirmación nativa + Snackbar con "Deshacer".
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert as NativeAlert, ScrollView, View } from 'react-native';

import { useFavoritos } from '@/features/favoritos';
import { usePermisoUbicacion, type PermisoUbicacion } from '@/features/ubicacion';
import { useManifest } from '@/shared/api';
import { useIsOnline, useRefreshInterval } from '@/shared/query';
import { getDefaultKeyValueStore, type KeyValueStore } from '@/shared/storage/kv';
import { clearPersistedQueryCache } from '@/shared/storage/queryPersister';
import { useTheme, type ThemePreference } from '@/shared/theme';
import { Button, SegmentedControl, SnackbarProvider, Text, useSnackbar } from '@/shared/ui';

import { IndiceRow } from './IndiceRow';
import { REFRESH_INTERVAL_HELP, REFRESH_INTERVAL_OPTIONS, THEME_OPTIONS } from './preferences';
import { Row, Section } from './SettingsList';

export const CLEAR_DONE_MESSAGE = 'Listo, limpiamos los datos guardados';
export const FAVORITOS_EMPTY_MESSAGE = 'No tenés favoritos guardados';
export const FAVORITOS_REMOVED_MESSAGE = 'Borraste tus favoritos.';

export const UBICACION_COPY: Record<PermisoUbicacion, { value: string; hint?: string }> = {
  granted: { value: 'Permitida mientras usás la app' },
  denied: { value: 'No permitida', hint: 'Podés buscar paradas a mano' },
  blocked: { value: 'No permitida', hint: 'Podés buscar paradas a mano' },
  undetermined: {
    value: 'Todavía no la pediste',
    hint: 'Te la pedimos cuando busques paradas cerca tuyo',
  },
};

export interface AjustesScreenProps {
  /** Dónde está la caché persistida (default: MMKV de la app). Se inyecta en los tests. */
  queryCacheStore?: KeyValueStore;
}

export function AjustesScreen(props: AjustesScreenProps) {
  return (
    <SnackbarProvider>
      <AjustesContent {...props} />
    </SnackbarProvider>
  );
}

function AjustesContent({ queryCacheStore }: AjustesScreenProps) {
  const theme = useTheme();
  const { space } = theme;
  const router = useRouter();
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();
  const { favoritos, repository } = useFavoritos();
  const refreshInterval = useRefreshInterval();
  const manifest = useManifest();
  const online = useIsOnline();
  const ubicacion = usePermisoUbicacion();

  const handleClearData = () => {
    // Primero la memoria y después el disco: si no, el persister escribiría de nuevo lo viejo.
    queryClient.clear();
    clearPersistedQueryCache(queryCacheStore ?? getDefaultKeyValueStore());
    snackbar.show(CLEAR_DONE_MESSAGE);
  };

  const removeAllFavoritos = () => {
    // `list()` antes de `clear()`: es lo que permite deshacer (favoritos/README.md, S19).
    const snapshot = repository.list();
    repository.clear();
    snackbar.show(FAVORITOS_REMOVED_MESSAGE, {
      action: {
        label: 'Deshacer',
        onPress: () => {
          for (const favorito of snapshot) repository.restore(favorito);
        },
      },
    });
  };

  const confirmRemoveAll = () => {
    const n = favoritos.length;
    NativeAlert.alert(
      '¿Borrar todos tus favoritos?',
      `Se ${n === 1 ? 'va a borrar tu favorito guardado' : `van a borrar tus ${String(n)} favoritos guardados`} en este teléfono.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: removeAllFavoritos },
      ],
    );
  };

  // F4-ubicacion-6: sin preguntar (o negado pero preguntable) la fila pide el permiso, porque
  // la persona lo tocó a propósito; si no, lleva a la configuración del teléfono.
  const canRequestUbicacion =
    ubicacion.permission === 'undetermined' || ubicacion.permission === 'denied';
  const ubicacionCopy = UBICACION_COPY[ubicacion.permission];

  const favoritosText =
    favoritos.length === 0
      ? FAVORITOS_EMPTY_MESSAGE
      : `Tenés ${String(favoritos.length)} ${favoritos.length === 1 ? 'favorito guardado' : 'favoritos guardados'}.`;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space[3], gap: space[4], paddingBottom: space[5] }}
    >
      <Section title="Apariencia">
        <View style={{ padding: space[3], gap: space[2] }}>
          <Text variant="text.md">Tema</Text>
          <SegmentedControl<ThemePreference>
            accessibilityLabel="Tema"
            options={THEME_OPTIONS}
            value={theme.preference}
            onChange={(preference) => {
              theme.setPreference(preference);
            }}
          />
        </View>
      </Section>

      <Section title="Datos">
        <View style={{ padding: space[3], gap: space[2] }}>
          <Text variant="text.md">Actualizar cada</Text>
          <SegmentedControl
            accessibilityLabel="Actualizar cada"
            options={REFRESH_INTERVAL_OPTIONS.map((option) => ({
              value: String(option.value),
              label: option.label,
              accessibilityLabel: `${String(option.value)} segundos`,
            }))}
            value={String(refreshInterval.seconds)}
            onChange={(value) => {
              const picked = REFRESH_INTERVAL_OPTIONS.find((o) => String(o.value) === value);
              if (picked) refreshInterval.setSeconds(picked.value);
            }}
          />
          <Text variant="text.sm" tone="secondary">
            {REFRESH_INTERVAL_HELP}
          </Text>
        </View>
        <IndiceRow manifest={manifest} online={online} />
        <Row
          title="Limpiar datos guardados"
          value="Borra los datos de transporte guardados en tu teléfono. No toca tus favoritos."
          titleTone="link"
          onPress={handleClearData}
        />
      </Section>

      <Section title="Favoritos">
        <View style={{ padding: space[3], gap: space[2] }}>
          <Text variant="text.sm" tone="secondary">
            {favoritosText}
          </Text>
          <Button
            label="Borrar todos los favoritos"
            variant="danger"
            outline
            fullWidth
            disabled={favoritos.length === 0}
            onPress={confirmRemoveAll}
          />
        </View>
      </Section>

      <Section title="Privacidad">
        <Row
          title="Ubicación"
          icon="sinUbicacion"
          value={ubicacionCopy.value}
          trailing={canRequestUbicacion ? undefined : 'externo'}
          accessibilityLabel={`Ubicación, ${ubicacionCopy.value}${ubicacionCopy.hint ? `. ${ubicacionCopy.hint}` : ''}. ${canRequestUbicacion ? 'Tocá para pedir el permiso' : 'Tocá para abrir la configuración'}`}
          onPress={() => {
            if (canRequestUbicacion) void ubicacion.request();
            else void ubicacion.openSettings();
          }}
        >
          {ubicacionCopy.hint ? (
            <Text variant="text.sm" tone="secondary">
              {ubicacionCopy.hint}
            </Text>
          ) : null}
        </Row>
      </Section>

      <Section title="Información">
        <Row
          title="Acerca de Transportate"
          icon="acercaDe"
          trailing="chevron"
          onPress={() => {
            router.push('/inicio/acerca');
          }}
        />
      </Section>
    </ScrollView>
  );
}
