import 'dotenv/config';
import { initStore, seedStore, closeStore, storeMode } from './store.js';

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'yes') {
  throw new Error('Sembrado bloqueado en producción. Usa ALLOW_DEMO_SEED=yes únicamente sobre una base de demostración.');
}

await initStore();
await seedStore();
console.log(`Datos de demostración cargados en modo ${storeMode()}.`);
await closeStore();
