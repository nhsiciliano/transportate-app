// Tabs del MVP: Inicio, Colectivos, Subtes y Favoritos.
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
      <NativeTabs.Trigger name="favoritos">
        <NativeTabs.Trigger.Label>Favoritos</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'star', selected: 'star.fill' }} md="star" />
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
