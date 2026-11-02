// Vitrina mínima de shared/ui: renderiza cada componente con sus variantes principales. La usa el
// test de claro/oscuro (cada componente tiene que renderizar en los dos esquemas) y sirve como
// "story" para revisar el look a mano. Los hex de acá son DATOS de prueba (route_color del GTFS de
// subte, docs/02b-colores-subte.md §3), no estilos de los componentes.
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useTheme } from '../../theme';
import {
  Alert,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  FreshnessLabel,
  LineBadge,
  OfflineBanner,
  SearchInput,
  SegmentedControl,
  Skeleton,
  SkeletonGroup,
  StatusChip,
  Text,
} from '..';

/** route_color / route_text_color de las líneas A y H (docs/02b-colores-subte.md §3). */
export const SUBTE_FIXTURE = {
  A: { color: '#A5C8FF', textColor: '#000000' },
  H: { color: '#FFF300', textColor: '#000000' },
  C: { color: '#0000FF', textColor: '#FFFFFF' },
} as const;

export function Showcase({ now }: { now: number }) {
  const { space } = useTheme();
  const [query, setQuery] = useState('Callao');
  const [vista, setVista] = useState<'lista' | 'mapa'>('lista');
  const [filtro, setFiltro] = useState(true);
  return (
    <ScrollView contentContainerStyle={{ gap: space[3], padding: space[3] }}>
      <OfflineBanner visible />
      <Text variant="heading.h1">Transportate</Text>
      <Text variant="headline.md">Subtes</Text>
      <Text variant="text.sm" tone="secondary">
        Texto secundario
      </Text>

      <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap' }}>
        <Button label="Guardar" variant="primary" haptic="success" onPress={() => undefined} />
        <Button label="Secundario" variant="secondary" size="md" onPress={() => undefined} />
        <Button label="Terciario" variant="tertiary" size="sm" onPress={() => undefined} />
        <Button label="Borrar" variant="danger" onPress={() => undefined} />
        <Button label="Claro" variant="light" onPress={() => undefined} />
        <Button label="Ver más" variant="link" onPress={() => undefined} />
        <Button label="Contorno" variant="primary" outline onPress={() => undefined} />
        <Button label="Cargando" loading onPress={() => undefined} />
        <Button label="Deshabilitado" disabled onPress={() => undefined} />
      </View>

      <Card>
        <Text variant="headline.lg">Línea A</Text>
        <Text variant="text.md">Plaza de Mayo - San Pedrito</Text>
      </Card>
      <Card onPress={() => undefined} accessibilityLabel="Abrir línea H">
        <Text variant="headline.lg">Línea H</Text>
      </Card>

      <Alert role="warning" title="Con demoras" message="Estación Medrano cerrada por obras." />
      <Alert role="danger" variant="system" message="Servicio interrumpido." live="assertive" />
      <Alert
        role="info"
        message="No pudimos actualizar. Mostramos lo último que sabemos."
        action={{ label: 'Reintentar', onPress: () => undefined }}
      />
      <Alert role="success" message="Guardado en favoritos." />

      <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap' }}>
        <Badge label="Nuevo" tone="info" />
        <Badge label="Primaria" tone="warning" variant="primary" size="sm" />
        <LineBadge kind="subte" label="A" {...SUBTE_FIXTURE.A} />
        <LineBadge kind="subte" label="H" size="lg" {...SUBTE_FIXTURE.H} />
        <LineBadge kind="subte" label="C" size="sm" {...SUBTE_FIXTURE.C} />
        <LineBadge kind="colectivo" label="152" />
        <StatusChip estado="normal" />
        <StatusChip estado="demorada" />
        <StatusChip estado="interrumpida" />
        <StatusChip estado="sin_datos" size="sm" />
      </View>

      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <Chip
          label="Todas"
          selected={filtro}
          onPress={() => {
            setFiltro(true);
          }}
        />
        <Chip
          label="Con demoras"
          selected={!filtro}
          onPress={() => {
            setFiltro(false);
          }}
        />
      </View>

      <SearchInput label="Buscar estación" value={query} onChangeText={setQuery} />
      <SegmentedControl
        accessibilityLabel="Vista"
        options={[
          { value: 'lista', label: 'Lista' },
          { value: 'mapa', label: 'Mapa' },
        ]}
        value={vista}
        onChange={setVista}
      />

      <SkeletonGroup>
        <Skeleton height={20} width="60%" />
        <Skeleton height={44} circle />
      </SkeletonGroup>

      <FreshnessLabel sourceTimestamp={new Date(now - 12_000).toISOString()} now={() => now} />
      <FreshnessLabel sourceTimestamp={new Date(now - 4 * 60_000).toISOString()} now={() => now} />
      <FreshnessLabel sourceTimestamp={null} />

      <EmptyState
        message="Todavía no guardaste favoritos. Tocá la estrella en una línea, parada o estación."
        action={{ label: 'Buscar una línea', onPress: () => undefined }}
      />
      <ErrorState
        title="El servicio de la Ciudad no responde"
        cause="Puede ser algo momentáneo. Probá de nuevo en un rato."
        onRetry={() => undefined}
      />
      <ErrorState
        title="No disponible"
        cause="Esta información no está disponible por ahora."
        retryable={false}
      />
    </ScrollView>
  );
}
