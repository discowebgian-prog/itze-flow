# Itzé Flow

PMS y CRM a medida para Itzé Hostel Boutique (Progreso, Yucatán).

- **Stack:** React + Vite, Supabase (base de datos, auth, storage, tiempo real), deploy en Vercel.
- **Variables de entorno (Vercel):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `CLAUDE_API_KEY`.
- **Claude:** la clave vive solo en la función `api/claude.js`. `CLAUDE_API_KEY` nunca debe llevar el prefijo `VITE_`, porque Vite publica esas variables en el navegador.
- **Desarrollo local:** `npm install` y luego `npm run dev` (para probar `/api/claude` en local hace falta `vercel dev`).
