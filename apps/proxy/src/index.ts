// Punto de entrada del Worker `transportate-proxy`.
import { createAdapters } from './adapters';
import { createApp } from './app';

const app = createApp({ adapters: createAdapters });

export default app;
