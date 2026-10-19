import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Service worker do PWA. Modo "prompt": a versão nova fica em espera e o
    // usuário escolhe quando aplicar (ver src/features/pwa) — nunca recarrega
    // sozinho no meio de um prontuário/agendamento sendo editado.
    // Só o app shell (JS/CSS/HTML/ícones) é cacheado; dados da API nunca, por
    // serem dados de saúde e precisarem estar sempre atualizados.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false, // registrado em src/features/pwa/pwaStore.ts
      manifest: false, // usa public/site.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,webp,svg,woff2,webmanifest}'],
        globIgnores: ['logo-email.png'], // só usado nos e-mails
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/admin\//, /^\/static\//, /^\/media\//],
        cleanupOutdatedCaches: true,
        // O bundle principal já passa de 1 MB; acima do limite padrão (2 MiB)
        // o Workbox deixaria de cacheá-lo sem erro nenhum.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
