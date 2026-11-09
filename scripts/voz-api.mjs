// Arma api/_voz.mjs: los textos de Flow (src/lib/voice.ts) para las funciones de Vercel.
// Así el aviso de las 8:00 dice exactamente lo mismo que Inicio. Corre solo en cada build
// (npm run build); si se cambia voice.ts, también se puede correr a mano: npm run voz-api
import { build } from 'esbuild';

await build({
  stdin: {
    contents: "export { daySummary, greeting, nowMerida } from './src/lib/voice.ts';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'api/_voz.mjs',
  banner: { js: '// GENERADO por scripts/voz-api.mjs desde src/lib/voice.ts. No editar a mano.' },
  logLevel: 'warning',
});
