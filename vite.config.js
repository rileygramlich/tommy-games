import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// GitHub Pages serves a project site from /<repo>/, so the built asset paths
// need that prefix. Override with BASE_PATH=/ for a user site or local preview.
export default defineConfig(({ command }) => ({
  base: process.env.BASE_PATH ?? (command === 'build' ? '/tommy-games/' : '/'),
  plugins: [svelte()],
  build: { target: 'es2022' }
}));
