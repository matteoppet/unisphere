import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    base: '/',
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.', './src'),
      },
    },
    build: {
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: path.resolve(import.meta.dirname || '.', 'index.html'),
          login: path.resolve(import.meta.dirname || '.', 'pages/login.html'),
          dashboard: path.resolve(import.meta.dirname || '.', 'pages/dashboard.html'),
          courses: path.resolve(import.meta.dirname || '.', 'pages/courses.html'),
          logs: path.resolve(import.meta.dirname || '.', 'pages/logs.html'),
          assignments: path.resolve(import.meta.dirname || '.', 'pages/assignments.html'),
          squads: path.resolve(import.meta.dirname || '.', 'pages/squads.html'),
          settings: path.resolve(import.meta.dirname || '.', 'pages/settings.html'),
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
