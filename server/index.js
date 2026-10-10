import 'dotenv/config';
import app from './app.js';
import { initStore } from './store.js';

const port = Number(process.env.PORT || 3000);

await initStore();
app.listen(port, '0.0.0.0', () => {
  console.log(`Aula Continental disponible en http://localhost:${port}`);
});
