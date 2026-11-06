// Tabs: Inicio, Colectivos, Subtes y Trenes (Fase 6): 4 visibles; Tránsito oculto. Favoritos
// salió de la barra (pedido del usuario, 2026-11-06): es una pantalla del Stack de Inicio
// (`inicio/favoritos.tsx`) que se abre con la estrella del header. No alcanzaba con esconderla:
// una tab `hidden` no se puede navegar.
//
// Se usan las tabs nativas de Expo Router (`expo-router/native-tabs` en SDK 58; hasta SDK 57 era `unstable-native-tabs`):
// UITabBarController en iOS y BottomNavigationView de Material en Android, en línea con la
// plataforma "adaptive" de PRODUCT.md. No tienen header propio: cada tab anida su Stack
// (https://docs.expo.dev/router/advanced/native-tabs/).
//
// Íconos: SF Symbols en iOS (`sf`) y Material Symbols en Android (`md`), que vienen con el
// sistema y no necesitan dependencias.
// Pendiente: pasar a los íconos propios (`Icon`, Material Symbols rounded fill) cuando NativeTabs
// acepte imágenes en vez de SF Symbols/`md`; `Icon` ya existe pero es un componente SVG.
import { NativeTabs } from 'expo-router/native-tabs';

export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="inicio">
        <NativeTabs.Trigger.Label>Inicio</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="colectivos">
        <NativeTabs.Trigger.Label>Colectivos</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bus', selected: 'bus.fill' }}
          md="directions_bus"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="subtes">
        <NativeTabs.Trigger.Label>Subtes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'tram', selected: 'tram.fill' }} md="subway" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="trenes">
        <NativeTabs.Trigger.Label>Trenes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'train.side.front.car', selected: 'train.side.front.car' }}
          md="train"
        />
      </NativeTabs.Trigger>
      {/*
        Tránsito queda OCULTO: decisión del usuario del 2026-11-01 (`docs/00-plan.md`,
        "Correcciones tras la Fase 1"): `/transito/v1/cortes` devuelve 500 y las tareas 2.7 y
        4.8 están diferidas. Una tab `hidden` no se puede navegar de ninguna forma.
      */}
      <NativeTabs.Trigger name="transito" hidden />
    </NativeTabs>
  );
}
